/**
 * lib/integrations/sfv/sync/schedule.ts
 *
 * SFV schedule (match fixture) synchronization — main orchestrator.
 *
 * Implements a full, idempotent synchronization of SFV match schedules for a
 * single tenant. Fetches the schedule from the SFV API within a configurable
 * date window, compares against existing MatchExternalMapping records, and
 * creates or updates Event + MatchExternalMapping records as needed.
 *
 * Call contract:
 *   - tenantId MUST originate from a trusted session. Never accept from
 *     caller-supplied request body.
 *   - Requires an enabled TenantSfvConfig. Throws if not configured/disabled.
 *   - Never deletes. Matches absent from the date-window response are not
 *     deactivated — they may simply be outside the requested window.
 *   - Provider failure causes no database mutation.
 *
 * Architecture invariants:
 *   - No duplicated authentication logic — delegates to acquireToken().
 *   - No client-side provider calls — runs server-side only.
 *   - Tenant context required for every operation.
 *   - Structured and typed result — safe to serialize to JSON.
 *   - Safe error handling — no credentials or raw payloads leak.
 *   - Idempotent — running twice produces identical DB state.
 *   - Transactions used per record (atomic Event + mapping).
 *
 * Synchronization window:
 *   Default: 30 days past → 90 days future from today (UTC).
 *   Configurable via SCHEDULE_WINDOW_PAST_DAYS / SCHEDULE_WINDOW_FUTURE_DAYS.
 *
 * Opponent strategy:
 *   External opponents are NEVER created as tenant-owned Teams.
 *   Their display names are stored in MatchExternalMapping and Event.opponentName.
 *
 * Status/result mapping:
 *   Raw providerMatchState is preserved in MatchExternalMapping.
 *   Event.status is mapped conservatively from matchStateName text patterns.
 *   Scores are preserved in MatchExternalMapping.scoreHome/scoreAway.
 *   Event.resultLabel is populated with "X:Y" when the match is played.
 *
 * Security invariants:
 *   - No secrets in errors or logs.
 *   - No raw provider payloads in the result.
 *   - All DB queries are scoped to tenantId.
 */

import { requireEnabledSfvConfigForTenant } from "../tenant-config-service";
import { markScheduleSyncSuccessful } from "../tenant-config-repository";
import { fetchClubRanking, fetchClubSchedule, fetchTeamList } from "../client";
import { toSafePublicError } from "../errors";
import { createExternalOpponentResolver } from "./external-team-discovery";
import { buildProviderClubIdIndex } from "./club-identity";
import { buildProviderCompetitionContextIndex } from "./team-competition-context";
import { runSfvClubConsolidationForCurrentSync } from "./club-consolidation";
import { logClubIdentityConflict } from "./schedule-logging";
import type { SfvScheduleSyncContext, SfvScheduleSyncResult } from "./schedule-types";
import type { SyncErrorEntry } from "./types";
import {
  computeDefaultWindow,
  validateWindow,
  toSfvDateParam,
  toIsoDateString,
} from "./schedule-window";
import {
  loadExistingMatchMappings,
  loadTeamMappings,
  resolveActiveSeason,
  processScheduleEntry,
} from "./schedule-persistence";
import { healMissingClubTeamMappings } from "./schedule-team-sync";
import type { SfvTeamSyncContext } from "./types";
import {
  loadStaleMatchCandidates,
  buildStaleMatchReconciliationReport,
  applyRepairableEntries,
} from "./stale-match-reconciliation";
import {
  logScheduleSyncStarted,
  logScheduleSyncCompleted,
  logScheduleSyncFailed,
  logMatchPersistenceFailed,
  logUnresolvedTeam,
  logStaleMatchReconciliationApplied,
} from "./schedule-logging";

// ── Constants ─────────────────────────────────────────────────────────────────

const PROVIDER = "SFV";

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Runs a full tenant-scoped SFV schedule synchronization.
 *
 * Fetches the club's match schedule within the default rolling date window
 * (30 days past → 90 days future) and upserts Event + MatchExternalMapping
 * records accordingly.
 *
 * @param tenantId  Trusted session-derived tenant identifier.
 * @returns         Typed, sanitized sync result safe to return from an API route.
 *
 * @throws {SfvTenantConfigNotFoundError}  No TenantSfvConfig for this tenant.
 * @throws {SfvTenantConfigDisabledError}  Integration disabled for this tenant.
 */
export async function syncSfvSchedule(tenantId: string): Promise<SfvScheduleSyncResult> {
  const startedAt = new Date();

  // Resolve tenant config — throws if not configured or disabled
  const tenantConfig = await requireEnabledSfvConfigForTenant(tenantId);

  // Compute date window
  const { dateFrom: windowFrom, dateTo: windowTo } = computeDefaultWindow(startedAt);
  const windowError = validateWindow(windowFrom, windowTo);
  if (windowError) {
    const finishedAt = new Date();
    return buildResult(
      {
        tenantId,
        clubId: tenantConfig.clubId,
        seasonId: tenantConfig.defaultSeasonId,
        organisationId: tenantConfig.organisationId,
        dateFrom: toIsoDateString(windowFrom),
        dateTo: toIsoDateString(windowTo),
        syncedAt: startedAt,
      },
      startedAt,
      finishedAt,
      {
        fetched: 0,
        created: 0,
        updated: 0,
        unchanged: 0,
        failed: 1,
        scoresUpdated: 0,
        kickoffChanges: 0,
        statusChanges: 0,
        unresolvedLocalTeamRefs: 0,
        externalOpponents: 0,
        errors: [{ code: "INVALID_DATE_WINDOW", message: windowError }],
      },
    );
  }

  const context: SfvScheduleSyncContext = {
    tenantId,
    clubId: tenantConfig.clubId,
    seasonId: tenantConfig.defaultSeasonId,
    organisationId: tenantConfig.organisationId,
    dateFrom: toIsoDateString(windowFrom),
    dateTo: toIsoDateString(windowTo),
    syncedAt: startedAt,
  };

  logScheduleSyncStarted(context);

  // ── Fetch provider data ──────────────────────────────────────────────────

  let providerEntries: Awaited<ReturnType<typeof fetchClubSchedule>>;

  try {
    providerEntries = await fetchClubSchedule({
      SeasonId: context.seasonId,
      ClubId: context.clubId,
      DateFrom: toSfvDateParam(windowFrom),
      DateUntil: toSfvDateParam(windowTo),
      ...(context.organisationId !== null
        ? { OrganisationId: context.organisationId }
        : {}),
    });
  } catch (fetchError) {
    const finishedAt = new Date();
    const durationMs = finishedAt.getTime() - startedAt.getTime();
    const safe = toSafePublicError(fetchError);

    logScheduleSyncFailed(context, safe.code, durationMs);

    return buildResult(context, startedAt, finishedAt, {
      fetched: 0,
      created: 0,
      updated: 0,
      unchanged: 0,
      failed: 1,
      scoresUpdated: 0,
      kickoffChanges: 0,
      statusChanges: 0,
      unresolvedLocalTeamRefs: 0,
      externalOpponents: 0,
      errors: [
        {
          code: safe.code,
          message: `Failed to fetch schedule from SFV: ${safe.message}`,
        },
      ],
    });
  }

  // ── Load existing data ───────────────────────────────────────────────────

  const [existingMappings, seasonId] = await Promise.all([
    loadExistingMatchMappings(tenantId, PROVIDER, context.seasonId),
    resolveActiveSeason(tenantId),
  ]);

  let teamMappings = await loadTeamMappings(tenantId, PROVIDER, context.seasonId);

  // ── Fetch club-owned team IDs for participant classification ─────────────
  //
  // GET /api/team/list returns all teams belonging to the configured club.
  // Their teamId values are in the same identity domain as the schedule's
  // teamAId / teamBId. This allows classifying participants as "club-owned"
  // or "external opponent" without relying on TeamExternalMapping being
  // pre-populated — enabling correct metrics even before Slice 3A team sync.
  //
  // On failure: fall back to the TeamExternalMapping key set as a proxy.
  // This preserves backward compatibility but prevents accurate classification
  // of unresolved vs external when the team list is unavailable.

  let clubOwnedSfvTeamIds: ReadonlySet<number>;
  let clubTeamList: Awaited<ReturnType<typeof fetchTeamList>> | null = null;
  try {
    clubTeamList = await fetchTeamList({
      SeasonId: context.seasonId,
      ClubId: context.clubId,
      ...(context.organisationId !== null
        ? { OrganisationId: context.organisationId }
        : {}),
    });
    clubOwnedSfvTeamIds = new Set(clubTeamList.map((t) => t.teamId));
  } catch {
    // Team list fetch failed — fall back to TeamExternalMapping keys.
    // Metrics may be less precise in this fallback path.
    clubOwnedSfvTeamIds = new Set(teamMappings.keys());
  }

  // ── CLUB-DIRECTORY-02C: resolve a stable SFV club identity (clubNumber) ──
  //
  // GET /api/club/ranking reports `clubNumber` for EVERY team appearing in
  // the tenant's current league/group standings — own teams AND opponents
  // alike (see club-identity.ts module doc for the full investigation).
  // Combined with the own-team `clubTeamList` fetched just above (which
  // already carries `clubNumber` per TeamDetail), this builds a per-run
  // `teamId -> clubNumber` index that lets external opponent discovery
  // consolidate onto ONE canonical ExternalClub per real-world club instead
  // of one dedicated club per team (see external-team-discovery.ts).
  //
  // Best-effort, exactly like the team-list fetch above: a ranking-fetch
  // failure never blocks schedule sync — discovery simply falls back to its
  // narrow, documented "no club identity evidence" behaviour for every
  // opponent this run, identical to pre-CLUB-DIRECTORY-02C behaviour.
  let providerClubIdIndex: ReadonlyMap<number, number> | undefined;
  // CLUB-DIRECTORY-04: teamId -> { leagueName, groupName }, built from the
  // SAME already-fetched `rankingEntries` below (zero extra SFV calls) —
  // see team-competition-context.ts for the full investigation. Lets
  // discovered external opponents carry real sporting context (league,
  // competition group) instead of just a name, so identically-named
  // provider teams (e.g. four different "AC Rossoneri" SFV teams) can be
  // told apart in the Club Directory UI.
  let providerCompetitionContextIndex:
    | ReadonlyMap<number, { leagueName: string | null; groupName: string | null }>
    | undefined;
  try {
    const rankingEntries = await fetchClubRanking({
      SeasonId: context.seasonId,
      ClubId: context.clubId,
      ...(context.organisationId !== null
        ? { OrganisationId: context.organisationId }
        : {}),
    });
    const { indexByTeamId, conflicts } = buildProviderClubIdIndex(
      clubTeamList ?? [],
      rankingEntries,
    );
    providerClubIdIndex = indexByTeamId;
    providerCompetitionContextIndex = buildProviderCompetitionContextIndex(rankingEntries);
    for (const conflict of conflicts) {
      logClubIdentityConflict(tenantId, conflict.teamId, conflict.observedClubIds);
    }
  } catch {
    // Ranking fetch failed — proceed without club-identity/competition-context
    // evidence this run. Never blocks schedule sync.
  }

  // ── CLUB-DIRECTORY-02C: opportunistic backfill/consolidation ─────────────
  //
  // Reconciles any PRE-EXISTING duplicate ExternalClub rows for exactly the
  // teamIds this run's providerClubIdIndex covers — bounded, zero extra SFV
  // calls (reuses the ranking/team-list data just fetched above). Runs
  // BEFORE external opponent discovery below so a just-merged canonical
  // club is what discovery sees this run, rather than risking a stale read.
  // Best-effort: never blocks schedule sync on failure. See
  // lib/club-directory/consolidation-service.ts for the full safety
  // invariants (never loses a team, never deletes a club, tenant-scoped,
  // idempotent). runSfvClubConsolidationForCurrentSync already swallows its
  // own errors — this try/catch is defense-in-depth only, matching every
  // other best-effort step in this function.
  try {
    await runSfvClubConsolidationForCurrentSync(tenantId, providerClubIdIndex);
  } catch {
    // Best-effort: consolidation must never block schedule sync.
  }

  // ── TEAM-SFV-MAPPING-02: heal missing current-season team mappings ───────
  //
  // The automatic (cron-triggered) sync never calls syncSfvTeams — only this
  // schedule sync runs on a schedule. Without this step, a season transition
  // (or a newly added club team) would leave every affected match's
  // homeTeamId/awayTeamId permanently null — "Team nicht zugeordnet" in
  // Matchcenter — until an admin manually re-runs "Sync Teams". Reuses the
  // exact tested season-carryover logic from TEAM-SFV-MAPPING-01
  // (team-persistence.ts) scoped to only the teams actually referenced by
  // this batch. Best-effort: never blocks match persistence on failure.
  if (clubTeamList !== null) {
    try {
      const referencedSfvTeamIds = new Set<number>();
      for (const entry of providerEntries) {
        referencedSfvTeamIds.add(entry.teamAId);
        referencedSfvTeamIds.add(entry.teamBId);
      }

      const clubTeamDetailsById = new Map(clubTeamList.map((t) => [t.teamId, t]));
      const teamSyncContext: SfvTeamSyncContext = {
        tenantId,
        clubId: context.clubId,
        seasonId: context.seasonId,
        organisationId: context.organisationId,
        syncedAt: context.syncedAt,
      };

      const healingResult = await healMissingClubTeamMappings(
        tenantId,
        referencedSfvTeamIds,
        clubOwnedSfvTeamIds,
        clubTeamDetailsById,
        teamSyncContext,
      );

      if (healingResult.created > 0 || healingResult.relinked > 0) {
        // Refresh so this run's participant classification immediately sees
        // any mapping just created/relinked — avoids waiting for a second run.
        teamMappings = await loadTeamMappings(tenantId, PROVIDER, context.seasonId);
      }
    } catch {
      // Best-effort: team-mapping healing must never block schedule sync.
    }
  }

  // ── TEAM-SFV-MAPPING-04: self-heal already-persisted stale matches ───────
  //
  // The healing above (and `processScheduleEntry` below) only ever touches
  // matches inside THIS run's rolling fetch window (see schedule-window.ts).
  // A MatchExternalMapping row whose match date has already scrolled outside
  // that window is never re-fetched from the provider, so it is never passed
  // to `processScheduleEntry` again — even after its TeamExternalMapping
  // becomes available. Without this step, such a row's homeTeamId/awayTeamId
  // stays null forever, regardless of how many times sync runs (this is the
  // exact "Team nicht zugeordnet" defect TEAM-SFV-MAPPING-03 diagnosed on
  // STAGE). This reconciles directly against the already-loaded (and, above,
  // possibly just-refreshed) `teamMappings` — fully decoupled from the fetch
  // window, so it needs no window expansion to self-heal. Deterministic,
  // idempotent, tenant/provider/season-scoped, and never touches a non-null
  // homeTeamId/awayTeamId or any Team/TeamExternalMapping row (see
  // stale-match-reconciliation.ts). Best-effort: never blocks match
  // persistence below on failure.
  try {
    const staleCandidates = await loadStaleMatchCandidates(tenantId, PROVIDER, context.seasonId);
    const reconciliationReport = buildStaleMatchReconciliationReport(
      tenantId,
      PROVIDER,
      context.seasonId,
      staleCandidates,
      teamMappings,
    );

    if (reconciliationReport.repairableRows > 0) {
      const { applied } = await applyRepairableEntries(reconciliationReport.entries);
      if (applied.length > 0) {
        const rowsRepaired = new Set(applied.map((a) => a.mappingId)).size;
        logStaleMatchReconciliationApplied(tenantId, context.seasonId, applied.length, rowsRepaired);
      }
    }
  } catch {
    // Best-effort: stale-match reconciliation must never block schedule sync.
  }

  // ── CLUB-DIRECTORY-02: external opponent discovery/resolution ────────────
  //
  // One resolver per sync run, memoized per SFV teamId, so an opponent
  // appearing in several matches within the same run is only discovered
  // once. Never throws — discovery failures must never block schedule sync
  // (see createExternalOpponentResolver).
  const resolveExternalTeamId = createExternalOpponentResolver(
    tenantId,
    context.syncedAt,
    providerClubIdIndex,
    providerCompetitionContextIndex,
  );

  // ── Process each schedule entry ──────────────────────────────────────────

  let created = 0;
  let updated = 0;
  let unchanged = 0;
  let failed = 0;
  let scoresUpdated = 0;
  let kickoffChanges = 0;
  let statusChanges = 0;
  let unresolvedLocalTeamRefs = 0;
  let externalOpponents = 0;
  const errors: SyncErrorEntry[] = [];

  for (const entry of providerEntries) {
    const { outcome, participantCounts } = await processScheduleEntry(
      entry,
      context,
      seasonId,
      existingMappings,
      teamMappings,
      clubOwnedSfvTeamIds,
      resolveExternalTeamId,
    );

    unresolvedLocalTeamRefs += participantCounts.unresolvedLocalTeamRefs;
    externalOpponents += participantCounts.externalOpponents;

    if (participantCounts.unresolvedLocalTeamRefs > 0) {
      logUnresolvedTeam(tenantId, entry.matchId, entry.teamAId, entry.teamBId);
    }

    switch (outcome.status) {
      case "created":
        created++;
        break;
      case "updated":
        updated++;
        if (outcome.scoreChanged) scoresUpdated++;
        if (outcome.kickoffChanged) kickoffChanges++;
        if (outcome.statusChanged) statusChanges++;
        break;
      case "unchanged":
        unchanged++;
        break;
      case "failed":
        failed++;
        errors.push({
          code: outcome.code,
          message: outcome.message,
          externalTeamId: undefined,
        });
        logMatchPersistenceFailed(tenantId, entry.matchId, outcome.code);
        break;
    }
  }

  // ── Build and return result ──────────────────────────────────────────────

  const finishedAt = new Date();

  const result = buildResult(context, startedAt, finishedAt, {
    fetched: providerEntries.length,
    created,
    updated,
    unchanged,
    failed,
    scoresUpdated,
    kickoffChanges,
    statusChanges,
    unresolvedLocalTeamRefs,
    externalOpponents,
    errors,
  });

  logScheduleSyncCompleted(result);

  if (result.failed === 0 && result.errors.length === 0) {
    await markScheduleSyncSuccessful(tenantId, finishedAt);
  }

  return result;
}

// ── Internal helpers ──────────────────────────────────────────────────────────

type CountFields = Pick<
  SfvScheduleSyncResult,
  | "fetched"
  | "created"
  | "updated"
  | "unchanged"
  | "failed"
  | "scoresUpdated"
  | "kickoffChanges"
  | "statusChanges"
  | "unresolvedLocalTeamRefs"
  | "externalOpponents"
  | "errors"
>;

function buildResult(
  context: SfvScheduleSyncContext,
  startedAt: Date,
  finishedAt: Date,
  counts: CountFields,
): SfvScheduleSyncResult {
  return {
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    tenantId: context.tenantId,
    source: PROVIDER,
    clubId: context.clubId,
    seasonId: context.seasonId,
    dateFrom: context.dateFrom,
    dateTo: context.dateTo,
    ...counts,
  };
}
