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
import { fetchClubSchedule } from "../client";
import { toSafePublicError } from "../errors";
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
import {
  logScheduleSyncStarted,
  logScheduleSyncCompleted,
  logScheduleSyncFailed,
  logMatchPersistenceFailed,
  logUnresolvedTeam,
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
        unresolvedTeams: 0,
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
      unresolvedTeams: 0,
      errors: [
        {
          code: safe.code,
          message: `Failed to fetch schedule from SFV: ${safe.message}`,
        },
      ],
    });
  }

  // ── Load existing data ───────────────────────────────────────────────────

  const [existingMappings, teamMappings, seasonId] = await Promise.all([
    loadExistingMatchMappings(tenantId, PROVIDER, context.seasonId),
    loadTeamMappings(tenantId, PROVIDER, context.seasonId),
    resolveActiveSeason(tenantId),
  ]);

  // ── Process each schedule entry ──────────────────────────────────────────

  let created = 0;
  let updated = 0;
  let unchanged = 0;
  let failed = 0;
  let scoresUpdated = 0;
  let kickoffChanges = 0;
  let statusChanges = 0;
  let unresolvedTeams = 0;
  const errors: SyncErrorEntry[] = [];

  for (const entry of providerEntries) {
    const { outcome, wasUnresolved } = await processScheduleEntry(
      entry,
      context,
      seasonId,
      existingMappings,
      teamMappings,
    );

    if (wasUnresolved) {
      unresolvedTeams++;
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
    unresolvedTeams,
    errors,
  });

  logScheduleSyncCompleted(result);

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
  | "unresolvedTeams"
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
