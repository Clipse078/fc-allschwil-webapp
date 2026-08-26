/**
 * lib/integrations/sfv/sync/external-team-discovery.ts
 *
 * CLUB-DIRECTORY-02 — SFV-side adapter that wires the provider-agnostic
 * `discoverExternalTeamFromProvider` (lib/club-directory/discovery-service.ts)
 * into schedule sync.
 *
 * Responsibilities:
 *   - Resolve an SFV opponent teamId to a canonical Club Directory
 *     ExternalTeam id, creating the canonical shell on first sight.
 *   - Memoize per SFV teamId for the lifetime of a single sync run, so an
 *     opponent appearing in several schedule entries within the same run is
 *     only discovered/resolved once (still fully idempotent across runs —
 *     see discoverExternalTeamFromProvider).
 *   - Never throw: discovery is best-effort. A single opponent lookup
 *     failure must never block match persistence — schedule sync behaves
 *     exactly as before CLUB-DIRECTORY-02 when discovery fails
 *     (homeExternalTeamId/awayExternalTeamId simply stay null, same as the
 *     pre-existing "external opponent — name only" behaviour).
 *   - CLUB-DIRECTORY-02C: resolve a stable SFV club identity (`clubNumber`)
 *     for this teamId, when this run's ranking/team-list data covers it
 *     (see club-identity.ts), and forward it as `providerClubId` so
 *     discoverExternalTeamFromProvider consolidates onto ONE canonical
 *     ExternalClub per real-world club instead of one dedicated club per
 *     team. See discovery-service.ts's module doc for the full identity
 *     strategy and race-safety guarantees.
 *   - CLUB-DIRECTORY-02B/02C: opportunistically enrich the resolved
 *     ExternalClub's crest from SFV's team-picture endpoint (see
 *     team-logo.ts) — but ONLY when the club does not already have a logo
 *     (tenant-managed or previously provider-filled). This keeps repeated
 *     syncs idempotent and avoids an SFV network call for every already-
 *     enriched opponent on every run (see resolveOpponentLogoIfNeeded
 *     below). CLUB-DIRECTORY-02C widens the candidate set beyond just this
 *     one teamId to every OTHER provider teamId already linked to the same
 *     resolved club, so one team's picture-fetch failure never means the
 *     club stays logo-less while a sibling team could have supplied the
 *     crest. The actual "never overwrite a tenant logo" rule is enforced
 *     one layer down, unchanged, by
 *     lib/club-directory/provider-sync.ts#buildExternalClubTenantFieldUpdate
 *     — this module never touches ExternalClub.logoUrl directly.
 *   - CLUB-DIRECTORY-04: forwards real sporting context (league/competition
 *     group name), when this run's ranking data covers this teamId (see
 *     team-competition-context.ts), as `providerLeagueName`/
 *     `providerGroupName` — so identically-named provider teams (e.g. four
 *     different "AC Rossoneri" SFV teams) can be distinguished in the Club
 *     Directory UI without exposing the provider Team-ID. Provider-owned,
 *     refreshed every sync, never inspected or derived from the team name.
 *
 * Architecture invariant: this module NEVER creates a tenant-owned Team —
 * only canonical Club Directory ExternalClub/ExternalTeam records, which is
 * the entire point of routing external opponents through the Club Directory
 * instead of the tenant Team table (see schedule-persistence.ts doc header).
 */

import { prisma } from "@/lib/db/prisma";
import { createClubDirectoryMutationDatabase } from "@/lib/club-directory/prisma-mutation-adapter";
import { createClubDirectoryQueryDatabase } from "@/lib/club-directory/prisma-adapter";
import { discoverExternalTeamFromProvider } from "@/lib/club-directory/discovery-service";
import {
  findExternalClubByProviderClubId,
  findExternalTeamByProviderIdentity,
} from "@/lib/club-directory/query-service";
import { resolveClubLogoFromCandidateTeamIds } from "./team-logo";
import { resolveProviderClubId } from "./club-identity";
import {
  resolveProviderCompetitionContext,
  type ProviderCompetitionContext,
} from "./team-competition-context";
import { logClubLogoEnrichmentExhausted } from "./schedule-logging";

const PROVIDER = "SFV";

/**
 * Defensive cap on how many linked sibling teamIds a single logo-enrichment
 * attempt will try for one still-logo-less club, in addition to the
 * currently-discovered team itself. Bounds the worst-case number of SFV
 * calls per resolver invocation even for a club with many teams — a club
 * legitimately has at most a handful of teams in practice (see the CLUB-
 * DIRECTORY-02C canonical model), so this is a safety bound, not an expected
 * limit.
 */
const MAX_LOGO_CANDIDATE_TEAM_IDS = 8;

export type ExternalOpponentResolver = (
  sfvTeamId: number,
  sfvTeamName: string | null,
) => Promise<string | null>;

function dedupeCandidateTeamIds(teamIds: readonly number[]): number[] {
  return [...new Set(teamIds)].slice(0, MAX_LOGO_CANDIDATE_TEAM_IDS);
}

/**
 * Decides whether this SFV teamId still needs a fresh logo fetch, and
 * performs it (best-effort) when so.
 *
 * "Needs a fetch" means: no canonical ExternalTeam has been linked to this
 * provider identity yet (brand-new discovery — the about-to-be-created club
 * obviously has no logo), OR one exists but its parent ExternalClub.logoUrl
 * is still empty (never yet enriched, and never manually set by a Club
 * Admin). Once a club has ANY logo — tenant-uploaded or provider-filled —
 * this returns null without calling the SFV picture endpoint at all,
 * satisfying "avoid unnecessary provider/network calls" without needing any
 * separate cache: the ExternalClub row itself is the durable memoization.
 *
 * CLUB-DIRECTORY-02C: when a `providerClubId` is resolved for this teamId
 * (see club-identity.ts) and it already identifies a known ExternalClub,
 * the candidate set widens to every OTHER provider teamId already linked to
 * that same club (capped, see MAX_LOGO_CANDIDATE_TEAM_IDS) — so a failure
 * for this one teamId does not leave an otherwise-enrichable club logo-less.
 * When every candidate fails and the club identity is known, this emits a
 * diagnosable warning (logClubLogoEnrichmentExhausted) rather than silently
 * treating "still no crest" as unremarkable.
 *
 * Never throws: a failure of this pre-check (e.g. a transient DB error)
 * simply skips enrichment for this call — discovery/link below still
 * proceeds exactly as it would if no logo were available this round.
 */
async function resolveOpponentLogoIfNeeded(
  queryDatabase: ReturnType<typeof createClubDirectoryQueryDatabase>,
  tenantId: string,
  tenantKey: string | null,
  sfvTeamId: number,
  providerClubId: number | null,
): Promise<string | null> {
  let candidateTeamIds: number[] = [sfvTeamId];
  let existingNormalizedLogoUrl: string | null = null;
  const existingSourceFingerprint: string | null = null;

  try {
    const existingTeam = await findExternalTeamByProviderIdentity(queryDatabase, {
      tenantId,
      provider: PROVIDER,
      providerTeamId: sfvTeamId,
    });

    if (existingTeam !== null && existingTeam.externalClub.logoUrl !== null) {
      return null;
    }

    if (providerClubId !== null) {
      const club = await findExternalClubByProviderClubId(queryDatabase, {
        tenantId,
        provider: PROVIDER,
        providerClubId,
      });

      if (club !== null) {
        if (club.logoUrl !== null) {
          // A sibling team already supplied the crest for this club — no
          // fetch needed at all, regardless of whether THIS teamId's own
          // mapping row exists yet.
          return null;
        }
        existingNormalizedLogoUrl = club.logoUrl;
        candidateTeamIds = dedupeCandidateTeamIds([sfvTeamId, ...club.linkedProviderTeamIds]);
      }
    }
  } catch {
    return null;
  }

  const persistContext =
    tenantKey !== null
      ? {
          tenantKey,
          provider: PROVIDER,
          providerClubId,
          existingNormalizedLogoUrl,
          existingSourceFingerprint,
        }
      : undefined;

  const { logoUrl, attemptedTeamIds } = await resolveClubLogoFromCandidateTeamIds(
    candidateTeamIds,
    persistContext,
  );

  if (logoUrl === null && providerClubId !== null) {
    logClubLogoEnrichmentExhausted(tenantId, providerClubId, attemptedTeamIds);
  }

  return logoUrl;
}

/**
 * Builds a memoized resolver for one sync run.
 *
 * `syncedAt` is the sync run's own timestamp (SfvScheduleSyncContext.syncedAt)
 * so `lastSyncedAt` on any refreshed ExternalTeamProviderMapping matches the
 * rest of this run's provider-owned fields.
 *
 * `providerClubIdIndex` (CLUB-DIRECTORY-02C, optional) is a pre-built
 * `teamId -> clubNumber` map for this run (see
 * club-identity.ts#buildProviderClubIdIndex, built once from this run's
 * already-fetched TeamDetail[]/ClubRankingEntry[] — no extra SFV calls).
 * Omitted (or a teamId not covered by it) falls back to the narrow,
 * documented "no club identity evidence" behaviour, unchanged from
 * CLUB-DIRECTORY-02.
 *
 * `providerCompetitionContextIndex` (CLUB-DIRECTORY-04, optional) is a
 * pre-built `teamId -> { leagueName, groupName }` map for this run (see
 * team-competition-context.ts#buildProviderCompetitionContextIndex, built
 * from the SAME already-fetched ClubRankingEntry[] — no extra SFV calls).
 * Omitted (or a teamId not covered by it) simply means no sporting context
 * is refreshed this run — the Club Directory falls back to whatever real
 * context was persisted on a previous run, or to no context at all.
 */
export function createExternalOpponentResolver(
  tenantId: string,
  syncedAt: Date,
  providerClubIdIndex?: ReadonlyMap<number, number>,
  providerCompetitionContextIndex?: ReadonlyMap<number, ProviderCompetitionContext>,
  tenantKey?: string | null,
): ExternalOpponentResolver {
  const database = createClubDirectoryMutationDatabase(prisma);
  const queryDatabase = createClubDirectoryQueryDatabase(prisma);
  const cache = new Map<number, Promise<string | null>>();
  let resolvedTenantKey: string | null = tenantKey?.trim() || null;

  return (sfvTeamId: number, sfvTeamName: string | null): Promise<string | null> => {
    const cached = cache.get(sfvTeamId);
    if (cached !== undefined) {
      return cached;
    }

    const pending = (async () => {
      if (resolvedTenantKey === null) {
        try {
          const tenant = await prisma.tenant.findUnique({
            where: { id: tenantId },
            select: { key: true },
          });
          resolvedTenantKey = tenant?.key?.trim() || null;
        } catch {
          resolvedTenantKey = null;
        }
      }

      const providerClubId = resolveProviderClubId(providerClubIdIndex, sfvTeamId);
      const competitionContext = resolveProviderCompetitionContext(
        providerCompetitionContextIndex,
        sfvTeamId,
      );

      const providerLogoUrl = await resolveOpponentLogoIfNeeded(
        queryDatabase,
        tenantId,
        resolvedTenantKey,
        sfvTeamId,
        providerClubId,
      );

      const result = await discoverExternalTeamFromProvider(
        database,
        {
          tenantId,
          provider: PROVIDER,
          providerTeamId: sfvTeamId,
          providerTeamName: sfvTeamName,
          providerClubId,
          providerLogoUrl,
          providerLeagueName: competitionContext.leagueName,
          providerGroupName: competitionContext.groupName,
        },
        syncedAt,
      );

      return result.team.id;
    })().catch(() => null);

    cache.set(sfvTeamId, pending);
    return pending;
  };
}
