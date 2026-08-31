/**
 * lib/integrations/sfv/standings-provider.ts
 *
 * SFV standings provider with tenant-scoped club resolution and read-through cache.
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
import { resolveStandingsTable } from "./standings-table";
import {
  isSfvEnabledForTenant,
  requireEnabledSfvConfigForTenant,
} from "./tenant-config-service";

export type FetchTeamStandingsInput = {
  tenantId: string;
  externalTeamId: number;
  externalSeasonId: number;
  providerLeagueId?: number | null;
};

/** In-flight deduplication keyed by tenant + season (canonical cache scope). */
const inflightRankingFetches = new Map<string, Promise<ClubRankingEntry[]>>();

type StandingsFailureCategory =
  | "SFV_AUTH"
  | "SFV_TIMEOUT"
  | "SFV_UNAVAILABLE"
  | "SFV_PROVIDER_ERROR"
  | "UNKNOWN";

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

function logStandingsProviderFailure(
  input: FetchTeamStandingsInput,
  error: unknown,
): void {
  const isSfvError = error instanceof SfvError;

  console.error(
    JSON.stringify({
      event: "SFV_STANDINGS_PROVIDER_FAILURE",
      tenantId: input.tenantId,
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

/**
 * Fetches the authoritative standings table for a mapped SFV team.
 *
 * ClubId is always resolved from tenant configuration — never caller-supplied.
 * Returns null on any configuration, provider, or resolution failure.
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

    const standings = resolveStandingsTable({
      entries,
      externalTeamId: input.externalTeamId,
      providerLeagueId: input.providerLeagueId,
    });

    if (!standings) {
      console.warn(
        JSON.stringify({
          event: "SFV_STANDINGS_RESOLUTION_EMPTY",
          tenantId: input.tenantId,
          externalTeamId: input.externalTeamId,
          externalSeasonId: input.externalSeasonId,
          providerLeagueId: input.providerLeagueId ?? null,
          rankingEntryCount: entries.length,
          externalTeamIdPresent: entries.some(
            (entry) => entry.teamId === input.externalTeamId,
          ),
        }),
      );
    }

    return standings;
  } catch (error) {
    logStandingsProviderFailure(input, error);
    return null;
  }
}
