/**
 * lib/integrations/sfv/standings-provider.ts
 *
 * SFV standings provider with tenant-scoped club resolution, read-through cache,
 * and durable last-known-good snapshot fallback.
 */

import type { ClubRankingEntry } from "./client";
import type { SportingStandingsTable } from "@/lib/sporting-data/standings-types";
import { fetchClubRanking } from "./client";
import { SfvError } from "./errors";
import {
  buildStandingsCacheKey,
  getCachedStandingsEntries,
  setCachedStandingsEntries,
} from "./standings-cache";
import {
  loadStandingsSnapshot,
  persistStandingsSnapshot,
  type StandingsSnapshotIdentity,
} from "./standings-snapshot-repository";
import {
  resolveStandingsTableWithIdentity,
} from "./standings-table";
import {
  isSfvEnabledForTenant,
  requireEnabledSfvConfigForTenant,
} from "./tenant-config-service";

export type FetchTeamStandingsInput = {
  tenantId: string;
  externalTeamId: number;
  externalSeasonId: number;
  providerLeagueId?: number | null;
  teamSeasonId?: string | null;
};

/** In-flight deduplication keyed by tenant + season (canonical cache scope). */
const inflightRankingFetches = new Map<string, Promise<ClubRankingEntry[]>>();

type StandingsFailureCategory =
  | "SFV_AUTH"
  | "SFV_TIMEOUT"
  | "SFV_UNAVAILABLE"
  | "SFV_PROVIDER_ERROR"
  | "UNKNOWN";

function isPositiveInteger(value: number): boolean {
  return Number.isInteger(value) && value > 0;
}

function buildSnapshotIdentity(
  input: FetchTeamStandingsInput,
): StandingsSnapshotIdentity | null {
  if (
    input.providerLeagueId == null ||
    !isPositiveInteger(input.providerLeagueId)
  ) {
    return null;
  }

  return {
    tenantId: input.tenantId,
    externalSeasonId: input.externalSeasonId,
    externalTeamId: input.externalTeamId,
    providerLeagueId: input.providerLeagueId,
  };
}

function classifyStandingsFailure(error: unknown): StandingsFailureCategory {
  if (!(error instanceof SfvError)) {
    return "UNKNOWN";
  }

  switch (error.code) {
    case "SFV_UNAUTHORIZED":
    case "SFV_FORBIDDEN":
      return "SFV_AUTH";
    case "SFV_TIMEOUT":
      return "SFV_TIMEOUT";
    case "SFV_UNAVAILABLE":
    case "SFV_RATE_LIMITED":
      return "SFV_UNAVAILABLE";
    default:
      return "SFV_PROVIDER_ERROR";
  }
}

function isProviderFailureEligibleForSnapshotFallback(
  error: unknown,
): boolean {
  if (error instanceof SfvError) {
    switch (error.code) {
      case "CONFIGURATION_MISSING":
      case "CONFIGURATION_INVALID":
      case "CONTRACT_UNRESOLVED":
        return false;
      default:
        return true;
    }
  }

  return true;
}

function logStandingsProviderFailure(
  input: FetchTeamStandingsInput,
  error: unknown,
): void {
  const isSfvError = error instanceof SfvError;

  console.error(
    JSON.stringify({
      event: "SFV_STANDINGS_PROVIDER_FAILURE",
      tenantId: input.tenantId,
      teamSeasonId: input.teamSeasonId ?? null,
      externalTeamId: input.externalTeamId,
      externalSeasonId: input.externalSeasonId,
      providerLeagueId: input.providerLeagueId ?? null,
      errorName: error instanceof Error ? error.name : "UnknownError",
      errorCode: isSfvError ? error.code : "INTERNAL_ERROR",
      errorMessage: isSfvError
        ? error.message
        : "An unexpected error occurred in the SFV standings provider.",
      failureCategory: classifyStandingsFailure(error),
    }),
  );
}

function logStandingsSnapshotFallback(
  input: FetchTeamStandingsInput,
  snapshot: { fetchedAt: Date },
  error: unknown,
): void {
  const isSfvError = error instanceof SfvError;

  console.warn(
    JSON.stringify({
      event: "SFV_STANDINGS_SNAPSHOT_FALLBACK",
      tenantId: input.tenantId,
      teamSeasonId: input.teamSeasonId ?? null,
      externalTeamId: input.externalTeamId,
      externalSeasonId: input.externalSeasonId,
      providerLeagueId: input.providerLeagueId ?? null,
      snapshotFetchedAt: snapshot.fetchedAt.toISOString(),
      errorCode: isSfvError ? error.code : "INTERNAL_ERROR",
      failureCategory: classifyStandingsFailure(error),
    }),
  );
}

/** Test-only helper — not exposed as a public runtime API. */
export function resetStandingsInflightForTests(): void {
  inflightRankingFetches.clear();
}

async function fetchRankingEntriesWithInflightDedup(
  cacheKey: string,
  fetchRanking: () => Promise<ClubRankingEntry[]>,
): Promise<ClubRankingEntry[]> {
  const cached = getCachedStandingsEntries(cacheKey);
  if (cached) {
    return cached;
  }

  const inflight = inflightRankingFetches.get(cacheKey);
  if (inflight) {
    return inflight;
  }

  const promise = fetchRanking()
    .then((entries) => {
      setCachedStandingsEntries(cacheKey, entries);
      return entries;
    })
    .finally(() => {
      inflightRankingFetches.delete(cacheKey);
    });

  inflightRankingFetches.set(cacheKey, promise);
  return promise;
}

async function tryLoadSnapshotFallback(
  input: FetchTeamStandingsInput,
  error: unknown,
): Promise<SportingStandingsTable | null> {
  const identity = buildSnapshotIdentity(input);
  if (!identity || !isProviderFailureEligibleForSnapshotFallback(error)) {
    return null;
  }

  const snapshot = await loadStandingsSnapshot(identity);
  if (!snapshot) {
    return null;
  }

  logStandingsSnapshotFallback(input, snapshot, error);
  return snapshot.standingsTable;
}

async function persistSuccessfulStandingsSnapshot(
  input: FetchTeamStandingsInput,
  resolved: {
    standings: SportingStandingsTable;
    sfvLeagueId: number;
    sfvDivisionId: number;
    sfvGroupId: number;
  },
  fetchedAt: Date,
): Promise<void> {
  const identity = buildSnapshotIdentity(input);
  if (!identity) {
    return;
  }

  await persistStandingsSnapshot({
    ...identity,
    standingsTable: resolved.standings,
    sfvLeagueId: resolved.sfvLeagueId,
    sfvDivisionId: resolved.sfvDivisionId,
    sfvGroupId: resolved.sfvGroupId,
    fetchedAt,
  });
}

/**
 * Fetches the authoritative standings table for a mapped SFV team.
 *
 * ClubId is always resolved from tenant configuration — never caller-supplied.
 * On transient provider failure, returns the durable last-known-good snapshot
 * when one exists. Returns null when no snapshot exists and fetch/resolution fails.
 */
export async function fetchTeamStandingsForMapping(
  input: FetchTeamStandingsInput,
): Promise<SportingStandingsTable | null> {
  if (
    !Number.isInteger(input.externalTeamId) ||
    input.externalTeamId <= 0 ||
    !Number.isInteger(input.externalSeasonId) ||
    input.externalSeasonId <= 0
  ) {
    return null;
  }

  const enabled = await isSfvEnabledForTenant(input.tenantId);
  if (!enabled) {
    return null;
  }

  try {
    const config = await requireEnabledSfvConfigForTenant(input.tenantId);
    const cacheKey = buildStandingsCacheKey(input.tenantId, input.externalSeasonId);

    const entries = await fetchRankingEntriesWithInflightDedup(cacheKey, () =>
      fetchClubRanking({
        SeasonId: input.externalSeasonId,
        ClubId: config.clubId,
        ...(config.organisationId !== null
          ? { OrganisationId: config.organisationId }
          : {}),
      }),
    );

    const resolved = resolveStandingsTableWithIdentity({
      entries,
      externalTeamId: input.externalTeamId,
      providerLeagueId: input.providerLeagueId,
    });

    if (!resolved) {
      console.warn(
        JSON.stringify({
          event: "SFV_STANDINGS_RESOLUTION_EMPTY",
          tenantId: input.tenantId,
          teamSeasonId: input.teamSeasonId ?? null,
          externalTeamId: input.externalTeamId,
          externalSeasonId: input.externalSeasonId,
          providerLeagueId: input.providerLeagueId ?? null,
          rankingEntryCount: entries.length,
          externalTeamIdPresent: entries.some(
            (entry) => entry.teamId === input.externalTeamId,
          ),
        }),
      );
      return null;
    }

    const fetchedAt = new Date();
    await persistSuccessfulStandingsSnapshot(input, resolved, fetchedAt);

    return resolved.standings;
  } catch (error) {
    logStandingsProviderFailure(input, error);
    return await tryLoadSnapshotFallback(input, error);
  }
}
