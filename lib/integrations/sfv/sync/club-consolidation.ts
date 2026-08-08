/**
 * lib/integrations/sfv/sync/club-consolidation.ts
 *
 * CLUB-DIRECTORY-02C — SFV-specific orchestration for the provider-agnostic
 * backfill/consolidation service (lib/club-directory/consolidation-service.ts).
 *
 * Responsibilities (and nothing else — the actual merge logic lives in the
 * pure consolidation service, unit- and integration-tested independently):
 *   - Build the `providerTeamId -> providerClubId` identity map for a
 *     tenant from SFV's already-implemented, already-tested endpoints
 *     (`fetchTeamList` for own teams, `fetchClubRanking` for every team —
 *     own AND opponents — appearing in the tenant's league/group standings;
 *     see club-identity.ts for the full investigation).
 *   - Invoke the pure consolidation service with that map through the real
 *     Prisma adapter.
 *   - Never throw: a consolidation attempt is best-effort, exactly like
 *     every other opportunistic step in the schedule sync pipeline (stale-
 *     match reconciliation, team-mapping healing, logo enrichment).
 *
 * Two entry points:
 *   - `runSfvClubConsolidationForCurrentSync()` — bounded to teamIds this
 *     one sync run's ranking/team-list fetch already covers (reuses data
 *     the caller already fetched — zero EXTRA SFV calls). Wired into
 *     schedule.ts so STAGE self-heals opportunistically on every sync,
 *     without a separate maintenance job.
 *   - `runSfvClubConsolidationForTenant()` — a full, standalone pass for one
 *     tenant, fetching its own ranking/team-list data itself. Used by
 *     scripts/club-directory-02c-sfv-consolidation.ts (the explicit,
 *     operator-run backfill for pre-existing STAGE duplicates) and
 *     available for any future admin-triggered "reconcile now" action.
 */

import { prisma } from "@/lib/db/prisma";
import {
  consolidateExternalClubsByProviderIdentity,
  type ConsolidationResult,
} from "@/lib/club-directory/consolidation-service";
import { createClubConsolidationDatabase } from "@/lib/club-directory/prisma-consolidation-adapter";
import { fetchClubRanking, fetchTeamList, type TeamDetail, type ClubRankingEntry } from "../client";
import { buildProviderClubIdIndex } from "./club-identity";

const PROVIDER = "SFV";

/**
 * Runs consolidation for exactly the `providerClubIdIndex` a caller already
 * built this sync run (see schedule.ts) — makes zero additional SFV calls.
 * Bounded to whatever teamIds this run's ranking/team-list fetch covered;
 * over repeated sync runs this opportunistically reconciles more of the
 * tenant's history as ranking coverage naturally shifts (season progress,
 * new league groups, etc.) without a separate maintenance job.
 *
 * Never throws — a consolidation failure never blocks schedule sync.
 */
export async function runSfvClubConsolidationForCurrentSync(
  tenantId: string,
  providerClubIdIndex: ReadonlyMap<number, number> | undefined,
): Promise<ConsolidationResult | null> {
  if (providerClubIdIndex === undefined || providerClubIdIndex.size === 0) {
    return null;
  }

  try {
    const database = createClubConsolidationDatabase(prisma);
    return await consolidateExternalClubsByProviderIdentity(database, {
      tenantId,
      provider: PROVIDER,
      resolvedClubIdsByTeamId: providerClubIdIndex,
    });
  } catch {
    return null;
  }
}

export type SfvClubConsolidationTenantResult = {
  ownTeams: readonly TeamDetail[];
  rankingEntries: readonly ClubRankingEntry[];
  consolidation: ConsolidationResult;
};

/**
 * Runs a full, standalone consolidation pass for one tenant: fetches its
 * own team-list + ranking data (independent of any concurrently-running
 * schedule sync), builds the club-identity index, and reconciles every
 * currently-known duplicate the resulting map has evidence for.
 *
 * Unlike `runSfvClubConsolidationForCurrentSync`, this DOES make its own
 * SFV calls — intended for the explicit, operator-run backfill
 * (scripts/club-directory-02c-sfv-consolidation.ts), not the ordinary
 * per-sync opportunistic path.
 *
 * @throws whatever `fetchTeamList`/`fetchClubRanking` throw — callers (the
 *   backfill script) are expected to handle/report this explicitly, unlike
 *   the best-effort sync-time path above.
 */
export async function runSfvClubConsolidationForTenant(
  tenantId: string,
  clubId: number,
  seasonId: number,
  organisationId: number | null = null,
): Promise<SfvClubConsolidationTenantResult> {
  const [ownTeams, rankingEntries] = await Promise.all([
    fetchTeamList({
      SeasonId: seasonId,
      ClubId: clubId,
      ...(organisationId !== null ? { OrganisationId: organisationId } : {}),
    }),
    fetchClubRanking({
      SeasonId: seasonId,
      ClubId: clubId,
      ...(organisationId !== null ? { OrganisationId: organisationId } : {}),
    }),
  ]);

  const { indexByTeamId } = buildProviderClubIdIndex(ownTeams, rankingEntries);

  const database = createClubConsolidationDatabase(prisma);
  const consolidation = await consolidateExternalClubsByProviderIdentity(database, {
    tenantId,
    provider: PROVIDER,
    resolvedClubIdsByTeamId: indexByTeamId,
  });

  return { ownTeams, rankingEntries, consolidation };
}
