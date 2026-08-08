/**
 * lib/integrations/sfv/sync/club-master-import.ts
 *
 * CLUB-DIRECTORY-05 — Full SFV Club Master Import.
 *
 * ─── Capability investigation (documented here, not guessed) ──────────────────
 *
 * The task required proving what the SFV ClubCorner API actually supports
 * before importing anything. The full existing SFV client surface
 * (lib/integrations/sfv/client.ts, confirmed against the official SFV
 * Swagger/OpenAPI v26.6.15.2 spec — see docs/integrations/sfv-slice-*.md) was
 * inspected for every capability the task asked about:
 *
 *   | Capability requested                    | Available? | Evidence |
 *   |------------------------------------------|-----------|----------|
 *   | All clubs (national club master list)    | NO        | No such endpoint exists anywhere in the client/spec. |
 *   | Clubs by association/region               | NO        | No association/region-scoped club endpoint exists. |
 *   | Club search                               | NO        | No search endpoint exists. |
 *   | Clubs by competition/league                | PARTIAL   | GET /api/club/ranking accepts optional LeagueId/DivisionId/GroupeId filters, but ClubId + SeasonId are ALWAYS required — every call is scoped to the CALLING club's own participation, never an arbitrary league browsed independently of a club. |
 *   | All teams with club references             | PARTIAL   | GET /api/team/list only ever returns the CONFIGURED club's own teams (TeamDetail.clubNumber == the caller's own clubId) — never other clubs' teams. |
 *   | Ranking/standings traversal                 | YES (bounded) | GET /api/club/ranking, called with SeasonId+ClubId and no League/Division/Group filter, returns the FULL standings for EVERY league/group the calling club's own teams currently compete in — own teams AND every opponent sharing those groups, each carrying a stable `clubNumber` (ClubRankingEntry.clubNumber) and `teamName`. This is the single broadest club-enumeration signal SFV exposes to this integration. Already implemented, already tested (client.ts#fetchClubRanking, __tests__/club-ranking.test.ts) and already used for club identity by CLUB-DIRECTORY-02C (see club-identity.ts). |
 *   | Season-wide competition traversal            | NO        | GET /api/competition* endpoints (competition-sync.ts) enumerate the tenant's OWN competitions/rounds, never other clubs. |
 *   | Any other exhaustive/near-exhaustive source  | NO        | No further endpoint exists in the confirmed OpenAPI spec or this codebase's already-implemented client surface. |
 *
 * CONCLUSION (proven, not assumed): the SFV ClubCorner API, as available to
 * this integration's credentials, is entirely CLUB-SCOPED — every business
 * endpoint requires the caller's own clubId and returns data relative to
 * that club's own participation. There is no "browse the national club
 * register" capability at any level. The broadest reliable club-enumeration
 * source available is GET /api/club/ranking for the tenant's configured
 * (clubId, defaultSeasonId): every club currently sharing a league/group
 * table with one of the tenant's own teams, whether or not a match against
 * that opponent has actually been scheduled/synced yet.
 *
 * ─── Coverage (documented, never oversold) ─────────────────────────────────────
 *
 * This is REGIONAL/COMPETITION-SCOPED coverage for the CURRENT default
 * season, not a national SFV club master list:
 *   - Included: every club with a team in a league/group the tenant's own
 *     teams currently compete in (own teams' entire set of leagues/groups —
 *     GET /api/club/ranking with no League/Division/Group filter returns
 *     all of them in one call, see schedule.ts's identical existing usage).
 *   - NOT included: clubs the tenant has no current standings overlap with
 *     — e.g. a cup/friendly-only opponent, a club in a completely different
 *     league, or any club from a season other than the configured default
 *     season. This mirrors the exact, already-documented coverage
 *     limitation CLUB-DIRECTORY-02C established for opponent discovery (see
 *     docs/integrations/sfv-slice-club-directory-02c-canonical-consolidation.md,
 *     "Coverage limitation") — this slice does not change or widen that
 *     limitation, it only pre-populates what IS already reliably knowable
 *     from that same source, instead of waiting for a match to be synced.
 *
 * ─── Architecture (smallest safe extension, no parallel framework) ─────────────
 *
 * Reuses, unchanged:
 *   - fetchClubRanking / fetchTeamList (lib/integrations/sfv/client.ts) — the
 *     SAME two calls schedule.ts already makes every sync run. This module
 *     makes its OWN call (it can run independently of a schedule sync), but
 *     introduces no new SFV endpoint and no new request shape.
 *   - buildProviderClubIdIndex (club-identity.ts) — the SAME identity
 *     resolution (including its conflict guard) opponent discovery uses, via
 *     the new buildClubMasterCandidates() wrapper in the same module. A club
 *     found here is guaranteed to resolve to the exact same providerClubId a
 *     later schedule sync's opponent discovery would resolve for one of its
 *     teams — the two paths can never diverge or create two different
 *     canonical clubs for the same real-world club.
 *   - discoverExternalClubFromProvider (lib/club-directory/discovery-service.ts)
 *     — the new, narrow, club-ONLY sibling of the already-proven
 *     discoverExternalTeamFromProvider — same race-safety, same idempotency,
 *     same STRICT OWNERSHIP RULE (tenant-managed fields never overwritten),
 *     via the existing linkExternalClubProvider (mutation-service.ts).
 *   - ExternalClub / ExternalClubProviderMapping — no schema change beyond
 *     one new TenantSfvConfig.lastClubMasterImportAt timestamp column,
 *     mirroring the existing lastTeamSyncAt / lastScheduleSyncAt / etc.
 *     pattern used for every other sync surface's "last run" admin display.
 *
 * Deliberately does NOT create any ExternalTeam — the ranking source proves
 * club identity, never team-level detail, and creating placeholder teams
 * "just to have something under the club" would misrepresent provider data
 * that was never actually fetched (no roster/team-list call is made for
 * opponent clubs). A master-imported club may have zero teams until its
 * teams are discovered normally through schedule/ranking-driven opponent
 * resolution — at which point they attach to this SAME canonical club.
 *
 * The tenant's OWN club (TenantSfvConfig.clubId) is always excluded from the
 * candidate list (see buildClubMasterCandidates) — it is not an "opponent"
 * and must never appear as an ExternalClub in this tenant's own directory.
 *
 * Bounded, safe error handling:
 *   - Exactly two SFV calls per run (fetchClubRanking, fetchTeamList) —
 *     never one call per candidate club. Call volume is therefore
 *     independent of how many clubs are discovered.
 *   - A ranking-fetch failure aborts the whole run before any database
 *     write — no partial/garbage import.
 *   - A team-list-fetch failure is best-effort (mirrors schedule.ts):
 *     ranking data alone already covers the tenant's own teams too, so this
 *     only narrows own-club-name resolution slightly, never coverage.
 *   - Each candidate club is persisted independently; one candidate's
 *     failure (counted, logged, returned in `errors`) never aborts or rolls
 *     back any other candidate already persisted this run.
 */

import { requireEnabledSfvConfigForTenant } from "../tenant-config-service";
import { markClubMasterImportSuccessful } from "../tenant-config-repository";
import { fetchClubRanking, fetchTeamList } from "../client";
import { toSafePublicError } from "../errors";
import { prisma } from "@/lib/db/prisma";
import { createClubDirectoryMutationDatabase } from "@/lib/club-directory/prisma-mutation-adapter";
import { discoverExternalClubFromProvider } from "@/lib/club-directory/discovery-service";
import { buildClubMasterCandidates } from "./club-identity";
import {
  logClubMasterImportStarted,
  logClubMasterImportCompleted,
  logClubMasterImportFailed,
  logClubIdentityConflict,
} from "./schedule-logging";
import type { SyncErrorEntry } from "./types";

const PROVIDER = "SFV";

/**
 * Fixed, always-included description of this import's data source and
 * coverage — surfaced verbatim in every result so the admin UI never has to
 * infer coverage from raw counts alone (STEP 4 requirement: "coverage/source
 * description").
 */
export const SFV_CLUB_MASTER_IMPORT_COVERAGE_DESCRIPTION =
  "Quelle: SFV-Rangliste (GET /api/club/ranking) für die konfigurierte Saison " +
  "des eigenen Clubs. Umfasst jeden Verein, der aktuell in einer Liga-/" +
  "Gruppentabelle des eigenen Clubs geführt wird — auch ohne bereits " +
  "synchronisiertes Direktduell. Keine landesweite SFV-Vollständigkeit: " +
  "Vereine aus reinen Pokal-/Freundschaftsspielen ausserhalb dieser " +
  "Tabellen oder aus anderen Saisons/Ligen werden dadurch nicht erfasst. " +
  "Die SFV-API stellt keinen Endpunkt für ein vollständiges, landesweites " +
  "Vereinsregister bereit.";

export type SfvClubMasterImportResult = {
  /** ISO 8601 timestamp when the import started. */
  startedAt: string;
  /** ISO 8601 timestamp when the import finished. */
  finishedAt: string;
  /** Elapsed time in milliseconds. */
  durationMs: number;
  tenantId: string;
  /** External provider identifier, always "SFV". */
  source: string;
  /** SFV clubId used for the ranking/team-list requests (the tenant's own club). */
  clubId: number;
  /** SFV seasonId used for the ranking/team-list requests. */
  seasonId: number;
  /** Total ranking rows fetched from SFV this run. */
  rankingRowsFetched: number;
  /** Distinct opponent clubs (providerClubId) identified this run, excluding the tenant's own club. */
  candidateClubs: number;
  /** New ExternalClub + ExternalClubProviderMapping pairs created this run. */
  created: number;
  /** Already-known providerClubId mappings whose provider metadata was refreshed (no new club). */
  updated: number;
  /** Candidate clubs that failed to persist this run. Never aborts other candidates. */
  failed: number;
  /** Sanitized per-candidate error entries. Empty when failed === 0. */
  errors: SyncErrorEntry[];
  /** Fixed, human-readable description of this import's data source and coverage limits. */
  coverageDescription: string;
};

type ClubMasterImportContext = {
  tenantId: string;
  clubId: number;
  seasonId: number;
  organisationId: number | null;
};

function buildResult(
  context: ClubMasterImportContext,
  startedAt: Date,
  finishedAt: Date,
  counts: Pick<
    SfvClubMasterImportResult,
    "rankingRowsFetched" | "candidateClubs" | "created" | "updated" | "failed" | "errors"
  >,
): SfvClubMasterImportResult {
  return {
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    tenantId: context.tenantId,
    source: PROVIDER,
    clubId: context.clubId,
    seasonId: context.seasonId,
    coverageDescription: SFV_CLUB_MASTER_IMPORT_COVERAGE_DESCRIPTION,
    ...counts,
  };
}

/**
 * Runs a full tenant-scoped SFV club master import.
 *
 * Fetches the tenant's current ranking table (the broadest reliable SFV
 * club-enumeration source — see module doc) and the tenant's own team list,
 * derives the distinct set of opponent clubs currently provable via
 * `clubNumber`, and resolves-or-creates a canonical `ExternalClub` +
 * `ExternalClubProviderMapping` for each one — without ever creating an
 * `ExternalTeam` (see module doc).
 *
 * Idempotent: rerunning against unchanged SFV data creates zero new clubs
 * and only refreshes provider-owned mapping metadata (never tenant-managed
 * fields) on already-known clubs.
 *
 * @throws {SfvTenantConfigNotFoundError}  No TenantSfvConfig for this tenant.
 * @throws {SfvTenantConfigDisabledError}  Integration disabled for this tenant.
 */
export async function runSfvClubMasterImport(tenantId: string): Promise<SfvClubMasterImportResult> {
  const startedAt = new Date();

  const tenantConfig = await requireEnabledSfvConfigForTenant(tenantId);

  const context: ClubMasterImportContext = {
    tenantId,
    clubId: tenantConfig.clubId,
    seasonId: tenantConfig.defaultSeasonId,
    organisationId: tenantConfig.organisationId,
  };

  logClubMasterImportStarted(context.tenantId, context.clubId, context.seasonId);

  // ── Fetch the broadest reliable club-enumeration source ──────────────────
  //
  // A single bounded call (no pagination — the endpoint returns the full
  // standings for every league/group the tenant's own teams compete in, per
  // CLUB-DIRECTORY-02C's already-proven usage of this exact call in
  // schedule.ts). A failure here aborts the whole run before any database
  // write — never a partial/garbage import.

  let rankingEntries: Awaited<ReturnType<typeof fetchClubRanking>>;
  try {
    rankingEntries = await fetchClubRanking({
      SeasonId: context.seasonId,
      ClubId: context.clubId,
      ...(context.organisationId !== null ? { OrganisationId: context.organisationId } : {}),
    });
  } catch (fetchError) {
    const finishedAt = new Date();
    const safe = toSafePublicError(fetchError);
    logClubMasterImportFailed(
      context.tenantId,
      context.clubId,
      context.seasonId,
      safe.code,
      finishedAt.getTime() - startedAt.getTime(),
    );
    return buildResult(context, startedAt, finishedAt, {
      rankingRowsFetched: 0,
      candidateClubs: 0,
      created: 0,
      updated: 0,
      failed: 1,
      errors: [
        {
          code: safe.code,
          message: `Failed to fetch ranking from SFV: ${safe.message}`,
        },
      ],
    });
  }

  // Best-effort, exactly like schedule.ts's identical fetch: ranking data
  // already covers the tenant's own teams too, so a failure here only
  // narrows own-club-name resolution slightly — never coverage or
  // correctness — and must never abort the import.
  let ownTeams: Awaited<ReturnType<typeof fetchTeamList>> = [];
  try {
    ownTeams = await fetchTeamList({
      SeasonId: context.seasonId,
      ClubId: context.clubId,
      ...(context.organisationId !== null ? { OrganisationId: context.organisationId } : {}),
    });
  } catch {
    // Best-effort — see comment above.
  }

  // ── Derive the distinct candidate club list ──────────────────────────────

  const { candidates, conflicts } = buildClubMasterCandidates(
    context.clubId,
    ownTeams,
    rankingEntries,
  );

  for (const conflict of conflicts) {
    logClubIdentityConflict(context.tenantId, conflict.teamId, conflict.observedClubIds);
  }

  // ── Resolve-or-create each candidate club (never a team) ─────────────────
  //
  // Each candidate is persisted independently: one candidate's failure is
  // counted and logged but never aborts or rolls back any other candidate
  // already persisted this run (safe partial-failure handling).

  const database = createClubDirectoryMutationDatabase(prisma);

  let created = 0;
  let updated = 0;
  let failed = 0;
  const errors: SyncErrorEntry[] = [];

  for (const candidate of candidates) {
    try {
      const result = await discoverExternalClubFromProvider(
        database,
        {
          tenantId: context.tenantId,
          provider: PROVIDER,
          providerClubId: candidate.providerClubId,
          providerClubName: candidate.providerClubName,
        },
        startedAt,
      );

      if (result.discovered) {
        created++;
      } else {
        updated++;
      }
    } catch (err) {
      failed++;
      const safe = toSafePublicError(err);
      errors.push({
        code: safe.code,
        message: `providerClubId ${candidate.providerClubId}: ${safe.message}`,
      });
    }
  }

  const finishedAt = new Date();

  const result = buildResult(context, startedAt, finishedAt, {
    rankingRowsFetched: rankingEntries.length,
    candidateClubs: candidates.length,
    created,
    updated,
    failed,
    errors,
  });

  logClubMasterImportCompleted(
    context.tenantId,
    context.clubId,
    context.seasonId,
    {
      rankingRowsFetched: result.rankingRowsFetched,
      candidateClubs: result.candidateClubs,
      created: result.created,
      updated: result.updated,
      failed: result.failed,
    },
    result.durationMs,
  );

  if (failed === 0) {
    await markClubMasterImportSuccessful(tenantId, finishedAt);
  }

  return result;
}
