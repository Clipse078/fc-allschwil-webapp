/**
 * lib/integrations/sfv/sync/schedule-logging.ts
 *
 * Structured, sanitized logging for the SFV schedule synchronization layer.
 *
 * Security invariants — never log:
 *   - Application password or access tokens
 *   - Authorization header values
 *   - Full provider payloads
 *   - Personal data
 *   - Test login credentials
 *   - Stack traces that may embed sensitive context
 *
 * Only log:
 *   - Counts, identifiers, and date ranges
 *   - Tenant identifiers (not names)
 *   - Season, club, and date-window context
 *   - Duration in milliseconds
 *   - Sanitized error codes
 *   - Unresolved team reference counts
 */

import type { SfvScheduleSyncContext, SfvScheduleSyncResult } from "./schedule-types";

function emit(level: "info" | "warn" | "error", payload: Record<string, unknown>): void {
  console[level](JSON.stringify({ ...payload, timestamp: new Date().toISOString() }));
}

/**
 * Emits a structured log entry when a schedule sync run begins.
 */
export function logScheduleSyncStarted(context: SfvScheduleSyncContext): void {
  emit("info", {
    event: "sfv_schedule_sync_started",
    tenantId: context.tenantId,
    source: "SFV",
    clubId: context.clubId,
    seasonId: context.seasonId,
    dateFrom: context.dateFrom,
    dateTo: context.dateTo,
    hasOrganisationFilter: context.organisationId !== null,
  });
}

/**
 * Emits a structured log entry when a schedule sync run completes successfully.
 */
export function logScheduleSyncCompleted(result: SfvScheduleSyncResult): void {
  emit("info", {
    event: "sfv_schedule_sync_completed",
    tenantId: result.tenantId,
    source: result.source,
    clubId: result.clubId,
    seasonId: result.seasonId,
    dateFrom: result.dateFrom,
    dateTo: result.dateTo,
    fetched: result.fetched,
    created: result.created,
    updated: result.updated,
    unchanged: result.unchanged,
    failed: result.failed,
    scoresUpdated: result.scoresUpdated,
    kickoffChanges: result.kickoffChanges,
    statusChanges: result.statusChanges,
    unresolvedTeams: result.unresolvedTeams,
    durationMs: result.durationMs,
  });
}

/**
 * Emits a structured log entry when a schedule sync run fails at the fetch stage.
 */
export function logScheduleSyncFailed(
  context: SfvScheduleSyncContext,
  errorCode: string,
  durationMs: number,
): void {
  emit("error", {
    event: "sfv_schedule_sync_failed",
    tenantId: context.tenantId,
    source: "SFV",
    clubId: context.clubId,
    seasonId: context.seasonId,
    dateFrom: context.dateFrom,
    dateTo: context.dateTo,
    errorCode,
    durationMs,
  });
}

/**
 * Emits a per-match warning when a single match record fails to persist.
 */
export function logMatchPersistenceFailed(
  tenantId: string,
  externalMatchId: number,
  errorCode: string,
): void {
  emit("warn", {
    event: "sfv_match_persistence_failed",
    tenantId,
    source: "SFV",
    externalMatchId,
    errorCode,
  });
}

/**
 * Emits a warning when a schedule entry cannot be resolved to any local team.
 * Only logs the external match ID and team IDs — no team names or personal data.
 */
export function logUnresolvedTeam(
  tenantId: string,
  externalMatchId: number,
  homeTeamSfvId: number,
  awayTeamSfvId: number,
): void {
  emit("warn", {
    event: "sfv_schedule_unresolved_team",
    tenantId,
    source: "SFV",
    externalMatchId,
    homeTeamSfvId,
    awayTeamSfvId,
  });
}
