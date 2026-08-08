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
    unresolvedLocalTeamRefs: result.unresolvedLocalTeamRefs,
    externalOpponents: result.externalOpponents,
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
 * Emits a structured log entry when the best-effort stale-match
 * reconciliation step (TEAM-SFV-MAPPING-04) repairs one or more already-
 * persisted MatchExternalMapping rows whose homeTeamId/awayTeamId had gone
 * stale outside the rolling schedule-fetch window. Only counts and the
 * season are logged — never team names or raw provider payloads.
 */
export function logStaleMatchReconciliationApplied(
  tenantId: string,
  seasonId: number,
  sidesRepaired: number,
  rowsRepaired: number,
): void {
  emit("info", {
    event: "sfv_stale_match_reconciliation_applied",
    tenantId,
    source: "SFV",
    seasonId,
    sidesRepaired,
    rowsRepaired,
  });
}

/**
 * CLUB-DIRECTORY-02C — LOGO COMPLETENESS diagnostics.
 *
 * Emits a warning when a canonical ExternalClub with a known, resolved SFV
 * clubNumber still has no crest after trying every currently-linked
 * provider teamId (see
 * lib/integrations/sfv/sync/team-logo.ts#resolveClubLogoFromCandidateTeamIds).
 * This is the "missing provider logos after attempted enrichment must be
 * diagnosable rather than silently treated as normal" requirement — a real
 * SFV club genuinely has no picture on file for ANY of its currently-known
 * teams, which is worth an operator's attention, as distinct from the
 * ordinary (unlogged) "brand-new opponent, no club identity resolved yet"
 * case that every sync run naturally passes through before enrichment ever
 * has a chance to run.
 *
 * Only logs identifiers and counts — never team names or raw provider
 * payloads.
 */
export function logClubLogoEnrichmentExhausted(
  tenantId: string,
  providerClubId: number,
  attemptedTeamIds: readonly number[],
): void {
  emit("warn", {
    event: "sfv_club_logo_enrichment_exhausted",
    tenantId,
    source: "SFV",
    providerClubId,
    attemptedTeamIdCount: attemptedTeamIds.length,
    attemptedTeamIds: [...attemptedTeamIds],
  });
}

/**
 * CLUB-DIRECTORY-02C — emitted when the same SFV teamId reports two
 * different clubNumbers within one run's ranking/team-list data (see
 * lib/integrations/sfv/sync/club-identity.ts#buildProviderClubIdIndex). The
 * teamId is excluded from consolidation entirely rather than guessed — this
 * log is what makes that "avoid false consolidation" decision diagnosable
 * instead of a silent no-op.
 */
export function logClubIdentityConflict(
  tenantId: string,
  teamId: number,
  observedClubIds: readonly number[],
): void {
  emit("warn", {
    event: "sfv_club_identity_conflict",
    tenantId,
    source: "SFV",
    teamId,
    observedClubIds: [...observedClubIds],
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
