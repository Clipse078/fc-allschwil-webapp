/**
 * lib/integrations/sfv/sync/logging.ts
 *
 * Structured, sanitized logging for the SFV team synchronization layer.
 *
 * Security invariants — never log:
 *   - Application password or access tokens
 *   - Authorization header values
 *   - Full provider payloads
 *   - Personal data from provider responses
 *   - Test login credentials
 *   - Stack traces from errors that may embed sensitive context
 *
 * Only log:
 *   - Counts and identifiers
 *   - Tenant identifiers (not names)
 *   - Season and club identifiers
 *   - Duration in milliseconds
 *   - Sanitized error codes
 */

import type { SfvTeamSyncContext } from "./types";
import type { SfvTeamSyncResult } from "./types";

// Use a simple structured log helper that emits JSON to stdout.
// In a production environment this integrates with the logging pipeline.

function emit(level: "info" | "warn" | "error", payload: Record<string, unknown>): void {
  console[level](JSON.stringify({ ...payload, timestamp: new Date().toISOString() }));
}

/**
 * Emits a structured log entry when a team sync run begins.
 * Only logs identifiers and configuration — never credentials.
 */
export function logSyncStarted(context: SfvTeamSyncContext): void {
  emit("info", {
    event: "sfv_team_sync_started",
    tenantId: context.tenantId,
    source: "SFV",
    clubId: context.clubId,
    seasonId: context.seasonId,
    hasOrganisationFilter: context.organisationId !== null,
  });
}

/**
 * Emits a structured log entry when a team sync run completes successfully.
 */
export function logSyncCompleted(result: SfvTeamSyncResult): void {
  emit("info", {
    event: "sfv_team_sync_completed",
    tenantId: result.tenantId,
    source: result.source,
    clubId: result.clubId,
    seasonId: result.seasonId,
    fetched: result.fetched,
    created: result.created,
    updated: result.updated,
    unchanged: result.unchanged,
    markedInactive: result.markedInactive,
    failed: result.failed,
    durationMs: result.durationMs,
  });
}

/**
 * Emits a structured log entry when a team sync run fails at the fetch stage.
 * Only logs the sanitized error code — never the raw error or credentials.
 */
export function logSyncFailed(context: SfvTeamSyncContext, errorCode: string, durationMs: number): void {
  emit("error", {
    event: "sfv_team_sync_failed",
    tenantId: context.tenantId,
    source: "SFV",
    clubId: context.clubId,
    seasonId: context.seasonId,
    errorCode,
    durationMs,
  });
}

/**
 * Emits a per-team warning when a single team record fails to persist.
 * Only logs the external team ID and sanitized error code — never raw data.
 */
export function logTeamPersistenceFailed(
  tenantId: string,
  externalTeamId: number,
  errorCode: string,
): void {
  emit("warn", {
    event: "sfv_team_persistence_failed",
    tenantId,
    source: "SFV",
    externalTeamId,
    errorCode,
  });
}
