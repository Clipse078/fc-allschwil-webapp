/**
 * lib/integrations/sfv/admin-diagnostics-service.ts
 *
 * SFV Admin Diagnostics Service — stateless, read-only.
 *
 * Inspects the complete SFV aggregation pipeline and returns a typed
 * diagnostics result safe to expose through a future authenticated admin route.
 * Composes resolveClubIds and loadClubSeasonData without duplicating any raw
 * HTTP logic from client.ts.
 *
 * Architecture invariants:
 *   - Stateless: no side effects, no process-wide state, no caching.
 *   - Read-only: no database access, no persistence, no background jobs.
 *   - Safe output: no base64, no tokens, no credentials, no raw error bodies,
 *     no stack traces.
 *   - Health classification is deterministic and name-independent.
 *   - Throws TypeError for programmer errors (invalid clubId/seasonId).
 *   - Returns structured unhealthy diagnostics for SFV operational failures.
 *
 * Data flow:
 *   runSfvAdminDiagnostics()
 *   ↓
 *   resolveClubIds()            (stage 1: connectivity + auth validation)
 *   ↓
 *   loadClubSeasonData()        (stage 2: full aggregation pipeline)
 *   ↓
 *   deriveDiagnosticCounts()    (safe count derivation from ClubSeasonData)
 *   ↓
 *   classifyHealth()            (deterministic HEALTHY / DEGRADED / UNHEALTHY)
 *   ↓
 *   deriveIssues()              (machine-readable issue codes + safe messages)
 *   ↓
 *   SfvAdminDiagnostics
 */

import { resolveClubIds } from "./client";
import { loadClubSeasonData, type ClubSeasonData } from "./club-data-service";
import { toSafePublicError, isRetryableSfvError } from "./errors";
import type { BatchOpponentIdentityOptions } from "./batch-opponent-identity";

// ── Public types ───────────────────────────────────────────────────────────────

/**
 * Overall integration health classification.
 *
 * healthy   — all pipeline stages succeeded; no anomalies detected.
 * degraded  — aggregation succeeded but one or more warnings are present
 *             (e.g. no-own-team rows, missing pictures, zero teams).
 * unhealthy — a top-level failure prevented successful aggregation
 *             (e.g. auth failure, network error, invalid input).
 */
export type SfvDiagnosticHealth = "healthy" | "degraded" | "unhealthy";

/**
 * Identifies a diagnostic pipeline stage.
 *
 * resolve-common-ids   — GET /api/common/ids (connectivity + auth validation).
 * load-club-season-data — full aggregation: teams, schedule, ranking, pictures.
 */
export type SfvDiagnosticStage = "resolve-common-ids" | "load-club-season-data";

/**
 * Wall-clock duration for one diagnostic stage.
 * durationMs is a finite non-negative integer (milliseconds, monotonic timer).
 */
export type SfvDiagnosticTiming = {
  /** Pipeline stage identifier. */
  stage: SfvDiagnosticStage;
  /** Stage duration in milliseconds (rounded, non-negative). */
  durationMs: number;
  /** Whether the stage completed without an error. */
  success: boolean;
};

/**
 * Severity classification for diagnostic issues.
 *
 * info    — notable state but not an operational problem (e.g. no picture from SFV: valid 204).
 * warning — data quality anomaly or ambiguous state requiring attention.
 * error   — top-level failure preventing normal operation.
 */
export type SfvDiagnosticIssueSeverity = "info" | "warning" | "error";

/**
 * A single structured diagnostic issue.
 *
 * code    — stable, machine-readable identifier (e.g. "SFV_SCHEDULE_NO_OWN_TEAM").
 * message — concise, safe human-readable description (no credentials, no payloads).
 * count   — optional affected-item count where applicable.
 * retryable — optional flag indicating whether the condition may resolve on retry.
 */
export type SfvDiagnosticIssue = {
  severity: SfvDiagnosticIssueSeverity;
  code: string;
  message: string;
  count?: number;
  retryable?: boolean;
};

/**
 * All safe count fields derived from one ClubSeasonData aggregate.
 *
 * All values are finite non-negative integers.
 * No base64, no names, no team payload data.
 *
 * Count semantics:
 *   ownTeams              — own-team records returned by GET /api/team/list.
 *   scheduleRows          — raw entries from GET /api/club/schedule.
 *   rankingRows           — raw entries from GET /api/club/ranking.
 *   resolvedScheduleRows  — schedule rows where the opponent was identified
 *                           and a picture fetch was attempted.
 *   scheduleBothOwnRows   — schedule rows where both teamA and teamB match
 *                           own-team IDs (ambiguous, no picture requested).
 *   scheduleNoOwnTeamRows — schedule rows where neither team matches an
 *                           own-team ID (ambiguous, no picture requested).
 *   scheduleInvalidRows   — schedule rows with missing/invalid team IDs.
 *   scheduleFailedRows    — schedule rows where the opponent was identified
 *                           but the picture fetch threw an error.
 *   rankingOwnTeamRows    — ranking rows belonging to own teams (no picture).
 *   rankingOpponentRows   — ranking rows where the opponent was identified
 *                           and a picture fetch was attempted.
 *   rankingInvalidRows    — ranking rows with missing/invalid team IDs.
 *   rankingFailedRows     — ranking rows where the opponent was identified
 *                           but the picture fetch threw an error.
 *   uniqueOpponentTeams   — distinct opponent teamIds across schedule and
 *                           ranking combined (includes failed-picture teams).
 *   picturesRequested     — unique opponent team IDs for which a picture
 *                           request was made (equals uniqueOpponentTeams).
 *   picturesPresent       — unique opponent teams with a non-null picture.
 *   picturesMissing       — unique opponent teams where SFV returned 204/null
 *                           (valid state, not a failure).
 *   pictureFailures       — unique opponent teams where the picture fetch
 *                           threw an error (uniqueOpponentTeams − picturesPresent
 *                           − picturesMissing).
 */
export type SfvDiagnosticCounts = {
  ownTeams: number;
  scheduleRows: number;
  rankingRows: number;
  resolvedScheduleRows: number;
  scheduleBothOwnRows: number;
  scheduleNoOwnTeamRows: number;
  scheduleInvalidRows: number;
  scheduleFailedRows: number;
  rankingOwnTeamRows: number;
  rankingOpponentRows: number;
  rankingInvalidRows: number;
  rankingFailedRows: number;
  uniqueOpponentTeams: number;
  picturesRequested: number;
  picturesPresent: number;
  picturesMissing: number;
  pictureFailures: number;
};

/**
 * Complete safe diagnostics result for one SFV club+season inspection.
 *
 * Safe to expose through a future authenticated admin route.
 * No base64, no credentials, no tokens, no raw error bodies, no stack traces.
 */
export type SfvAdminDiagnostics = {
  /** Overall integration health. */
  health: SfvDiagnosticHealth;
  /** Club ID passed to the diagnostic run. */
  clubId: number;
  /** Season ID passed to the diagnostic run. */
  seasonId: number;
  /** Full season name from the SFV API (e.g. "2026/2027"), or null. */
  seasonName: string | null;
  /** Short season label derived from seasonName (e.g. "26/27"), or null. */
  seasonShortName: string | null;
  /** ISO 8601 timestamp of when the diagnostic run started. */
  generatedAt: string;
  /** Total diagnostic duration in milliseconds (rounded, non-negative). */
  totalDurationMs: number;
  /** Per-stage timings in pipeline execution order. */
  timings: readonly SfvDiagnosticTiming[];
  /** Safe derived counts from the aggregation result. */
  counts: SfvDiagnosticCounts;
  /** Structured machine-readable issues. Empty when health is "healthy". */
  issues: readonly SfvDiagnosticIssue[];
};

/**
 * Parameters accepted by runSfvAdminDiagnostics.
 */
export type RunSfvAdminDiagnosticsParams = {
  /** Positive integer club identifier (e.g. 483 for FC Allschwil). */
  clubId: number;
  /** Positive integer season identifier (e.g. 2027 for the 2026/2027 season). */
  seasonId: number;
  /**
   * Batch resolver options forwarded to loadClubSeasonData.
   * Defaults: concurrency=4, failFast=false.
   */
  batchOptions?: BatchOpponentIdentityOptions;
};

// ── Internal helpers ───────────────────────────────────────────────────────────

/**
 * Returns an all-zero counts object used when aggregation could not run.
 */
function emptyDiagnosticCounts(): SfvDiagnosticCounts {
  return {
    ownTeams: 0,
    scheduleRows: 0,
    rankingRows: 0,
    resolvedScheduleRows: 0,
    scheduleBothOwnRows: 0,
    scheduleNoOwnTeamRows: 0,
    scheduleInvalidRows: 0,
    scheduleFailedRows: 0,
    rankingOwnTeamRows: 0,
    rankingOpponentRows: 0,
    rankingInvalidRows: 0,
    rankingFailedRows: 0,
    uniqueOpponentTeams: 0,
    picturesRequested: 0,
    picturesPresent: 0,
    picturesMissing: 0,
    pictureFailures: 0,
  };
}

/**
 * Derives safe diagnostic counts from a successfully loaded ClubSeasonData.
 *
 * pictureFailures is derived as:
 *   uniqueOpponentTeams − picturesPresent − picturesMissing
 *
 * This is correct because uniqueOpponentTeams = teams_with_picture +
 * teams_with_null_picture + teams_with_fetch_error. Teams with fetch errors
 * are added to the unique-opponents set by buildSummary but are excluded
 * from pictureStatusByTeamId, so they do not count toward pictureCount or
 * missingPictures.
 *
 * Math.max(0, …) guards against rounding anomalies in hypothetical edge cases.
 */
function deriveDiagnosticCounts(data: ClubSeasonData): SfvDiagnosticCounts {
  const { schedule, ranking, summary } = data;
  const ss = schedule.resolution.summary;
  const rs = ranking.resolution.summary;

  const pictureFailures = Math.max(
    0,
    summary.uniqueOpponentTeams - summary.pictureCount - summary.missingPictures,
  );

  return {
    ownTeams: summary.ownTeamCount,
    scheduleRows: summary.scheduleCount,
    rankingRows: summary.rankingCount,
    resolvedScheduleRows: ss.resolved,
    scheduleBothOwnRows: ss.bothOwn,
    scheduleNoOwnTeamRows: ss.noOwnTeam,
    scheduleInvalidRows: ss.invalid,
    scheduleFailedRows: ss.failed,
    rankingOwnTeamRows: rs.ownTeam,
    rankingOpponentRows: rs.resolved,
    rankingInvalidRows: rs.invalid,
    rankingFailedRows: rs.failed,
    uniqueOpponentTeams: summary.uniqueOpponentTeams,
    picturesRequested: summary.uniqueOpponentTeams,
    picturesPresent: summary.pictureCount,
    picturesMissing: summary.missingPictures,
    pictureFailures,
  };
}

/**
 * Classifies overall integration health deterministically from counts.
 *
 * HEALTHY — all of the following:
 *   - ownTeams > 0
 *   - scheduleRows > 0
 *   - rankingRows > 0
 *   - seasonName is not null
 *   - no schedule no-own-team, both-own, invalid, or failed rows
 *   - no ranking invalid or failed rows
 *   - no missing pictures (204 from SFV — valid but incomplete)
 *   - no picture failures (fetch errors)
 *
 * DEGRADED — aggregation succeeded but one or more conditions above are false.
 *
 * UNHEALTHY — used only when a top-level error prevents aggregation.
 *             (This function is not called in the unhealthy path.)
 *
 * Classification is based solely on counts and seasonName.
 * Team names, entry payloads, and raw API responses are never consulted.
 */
function classifyHealth(
  counts: SfvDiagnosticCounts,
  seasonName: string | null,
): SfvDiagnosticHealth {
  const isDegraded =
    counts.ownTeams === 0 ||
    counts.scheduleRows === 0 ||
    counts.rankingRows === 0 ||
    seasonName === null ||
    counts.scheduleNoOwnTeamRows > 0 ||
    counts.scheduleBothOwnRows > 0 ||
    counts.scheduleInvalidRows > 0 ||
    counts.scheduleFailedRows > 0 ||
    counts.rankingInvalidRows > 0 ||
    counts.rankingFailedRows > 0 ||
    counts.picturesMissing > 0 ||
    counts.pictureFailures > 0;

  return isDegraded ? "degraded" : "healthy";
}

/**
 * Derives structured machine-readable issues from diagnostic counts.
 *
 * Issue codes are stable and match the following conventions:
 *   SFV_NO_OWN_TEAMS               — ownTeams = 0
 *   SFV_NO_SCHEDULE_ROWS           — scheduleRows = 0
 *   SFV_NO_RANKING_ROWS            — rankingRows = 0
 *   SFV_SEASON_METADATA_INCOMPLETE — seasonName is null
 *   SFV_SCHEDULE_NO_OWN_TEAM       — scheduleNoOwnTeamRows > 0
 *   SFV_SCHEDULE_BOTH_OWN          — scheduleBothOwnRows > 0
 *   SFV_SCHEDULE_INVALID_ROWS      — scheduleInvalidRows > 0
 *   SFV_SCHEDULE_FAILED_ROWS       — scheduleFailedRows > 0
 *   SFV_RANKING_INVALID_ROWS       — rankingInvalidRows > 0
 *   SFV_RANKING_FAILED_ROWS        — rankingFailedRows > 0
 *   SFV_MISSING_PICTURES           — picturesMissing > 0 (info: valid 204 state)
 *   SFV_PICTURE_FAILURES           — pictureFailures > 0
 *
 * Messages are concise and contain no row payloads, base64, or credentials.
 */
function deriveIssues(
  counts: SfvDiagnosticCounts,
  seasonName: string | null,
): readonly SfvDiagnosticIssue[] {
  const issues: SfvDiagnosticIssue[] = [];

  if (counts.ownTeams === 0) {
    issues.push({
      severity: "warning",
      code: "SFV_NO_OWN_TEAMS",
      message: "No own teams found for this club and season.",
    });
  }
  if (counts.scheduleRows === 0) {
    issues.push({
      severity: "warning",
      code: "SFV_NO_SCHEDULE_ROWS",
      message: "No schedule rows found for this club and season.",
    });
  }
  if (counts.rankingRows === 0) {
    issues.push({
      severity: "warning",
      code: "SFV_NO_RANKING_ROWS",
      message: "No ranking rows found for this club and season.",
    });
  }
  if (seasonName === null) {
    issues.push({
      severity: "warning",
      code: "SFV_SEASON_METADATA_INCOMPLETE",
      message: "Season name could not be determined from the schedule.",
    });
  }
  if (counts.scheduleNoOwnTeamRows > 0) {
    issues.push({
      severity: "warning",
      code: "SFV_SCHEDULE_NO_OWN_TEAM",
      message: `${counts.scheduleNoOwnTeamRows} schedule row(s) matched neither team as an own team.`,
      count: counts.scheduleNoOwnTeamRows,
    });
  }
  if (counts.scheduleBothOwnRows > 0) {
    issues.push({
      severity: "warning",
      code: "SFV_SCHEDULE_BOTH_OWN",
      message: `${counts.scheduleBothOwnRows} schedule row(s) matched both teams as own teams.`,
      count: counts.scheduleBothOwnRows,
    });
  }
  if (counts.scheduleInvalidRows > 0) {
    issues.push({
      severity: "warning",
      code: "SFV_SCHEDULE_INVALID_ROWS",
      message: `${counts.scheduleInvalidRows} schedule row(s) contained invalid team IDs.`,
      count: counts.scheduleInvalidRows,
    });
  }
  if (counts.scheduleFailedRows > 0) {
    issues.push({
      severity: "warning",
      code: "SFV_SCHEDULE_FAILED_ROWS",
      message: `${counts.scheduleFailedRows} schedule row(s) had picture fetch failures.`,
      count: counts.scheduleFailedRows,
    });
  }
  if (counts.rankingInvalidRows > 0) {
    issues.push({
      severity: "warning",
      code: "SFV_RANKING_INVALID_ROWS",
      message: `${counts.rankingInvalidRows} ranking row(s) contained invalid team IDs.`,
      count: counts.rankingInvalidRows,
    });
  }
  if (counts.rankingFailedRows > 0) {
    issues.push({
      severity: "warning",
      code: "SFV_RANKING_FAILED_ROWS",
      message: `${counts.rankingFailedRows} ranking row(s) had picture fetch failures.`,
      count: counts.rankingFailedRows,
    });
  }
  if (counts.picturesMissing > 0) {
    issues.push({
      severity: "info",
      code: "SFV_MISSING_PICTURES",
      message:
        `${counts.picturesMissing} opponent team(s) returned no picture from SFV` +
        " (204 — valid state, not a failure).",
      count: counts.picturesMissing,
    });
  }
  if (counts.pictureFailures > 0) {
    issues.push({
      severity: "warning",
      code: "SFV_PICTURE_FAILURES",
      message: `${counts.pictureFailures} unique opponent team(s) had picture fetch errors.`,
      count: counts.pictureFailures,
    });
  }

  return issues;
}

/**
 * Maps a top-level SFV operational error to a structured diagnostic issue.
 *
 * Uses toSafePublicError to extract a sanitized code and message.
 * Never includes tokens, credentials, raw response bodies, or stack traces.
 *
 * Issue codes:
 *   SFV_AUTH_FAILURE   — authentication or configuration errors.
 *   SFV_TIMEOUT        — request timed out (retryable).
 *   SFV_NETWORK_FAILURE — network/availability failures (retryable if transient).
 *   SFV_SERVER_FAILURE  — invalid response, contract error, or unexpected failure.
 */
function mapTopLevelErrorToIssue(error: unknown): SfvDiagnosticIssue {
  const safe = toSafePublicError(error);

  let code: string;
  let retryable: boolean;

  switch (safe.code) {
    case "SFV_UNAUTHORIZED":
    case "SFV_FORBIDDEN":
    case "CONFIGURATION_MISSING":
    case "CONFIGURATION_INVALID":
      code = "SFV_AUTH_FAILURE";
      retryable = false;
      break;
    case "SFV_TIMEOUT":
      code = "SFV_TIMEOUT";
      retryable = true;
      break;
    case "SFV_RATE_LIMITED":
    case "SFV_UNAVAILABLE":
    case "SFV_NOT_FOUND":
      code = "SFV_NETWORK_FAILURE";
      retryable = isRetryableSfvError(safe.code);
      break;
    case "SFV_INVALID_RESPONSE":
    case "CONTRACT_UNRESOLVED":
    case "INTERNAL_ERROR":
      code = "SFV_SERVER_FAILURE";
      retryable = false;
      break;
    default:
      code = "SFV_SERVER_FAILURE";
      retryable = false;
  }

  return {
    severity: "error",
    code,
    message: safe.message,
    retryable,
  };
}

/**
 * Returns elapsed milliseconds from a performance.now() start point.
 * Rounded to the nearest integer. Clamped to a minimum of 0.
 */
function elapsedMs(start: number): number {
  return Math.max(0, Math.round(performance.now() - start));
}

// ── Public service function ────────────────────────────────────────────────────

/**
 * Runs a complete read-only SFV admin diagnostics pipeline.
 *
 * Required flow:
 *   1. Validate clubId and seasonId (throw TypeError for programmer errors).
 *   2. Record total start time (monotonic clock).
 *   3. Call resolveClubIds() — stage "resolve-common-ids".
 *      On failure: return structured unhealthy result with SFV_AUTH_FAILURE /
 *      SFV_TIMEOUT / SFV_NETWORK_FAILURE / SFV_SERVER_FAILURE issue.
 *   4. Call loadClubSeasonData() — stage "load-club-season-data".
 *      On failure: return structured unhealthy result.
 *   5. Derive safe counts from ClubSeasonData.
 *   6. Classify health deterministically.
 *   7. Derive machine-readable issues.
 *   8. Return compact diagnostics object.
 *
 * Output safety guarantees:
 *   - No base64 image data.
 *   - No credentials, tokens, or authorization header values.
 *   - No raw SFV response bodies.
 *   - No stack traces.
 *   - All counts are finite non-negative integers.
 *   - All durationMs values are finite non-negative integers (milliseconds).
 *
 * @throws {TypeError} if clubId is not a positive integer
 *                     (zero, negative, fractional, NaN, Infinity).
 * @throws {TypeError} if seasonId is not a positive integer
 *                     (zero, negative, fractional, NaN, Infinity).
 */
export async function runSfvAdminDiagnostics(
  params: RunSfvAdminDiagnosticsParams,
): Promise<SfvAdminDiagnostics> {
  const { clubId, seasonId, batchOptions } = params;

  if (!Number.isInteger(clubId) || clubId <= 0) {
    throw new TypeError(
      `clubId must be a positive integer; received ${String(clubId)}.`,
    );
  }
  if (!Number.isInteger(seasonId) || seasonId <= 0) {
    throw new TypeError(
      `seasonId must be a positive integer; received ${String(seasonId)}.`,
    );
  }

  const generatedAt = new Date().toISOString();
  const totalStart = performance.now();
  const timings: SfvDiagnosticTiming[] = [];

  // ── Stage 1: Resolve common IDs ──────────────────────────────────────────────
  // Validates connectivity and authentication before the full aggregation.

  const resolveStart = performance.now();

  try {
    await resolveClubIds();
  } catch (error) {
    timings.push({
      stage: "resolve-common-ids",
      durationMs: elapsedMs(resolveStart),
      success: false,
    });

    return {
      health: "unhealthy",
      clubId,
      seasonId,
      seasonName: null,
      seasonShortName: null,
      generatedAt,
      totalDurationMs: elapsedMs(totalStart),
      timings,
      counts: emptyDiagnosticCounts(),
      issues: [mapTopLevelErrorToIssue(error)],
    };
  }

  timings.push({
    stage: "resolve-common-ids",
    durationMs: elapsedMs(resolveStart),
    success: true,
  });

  // ── Stage 2: Load club season data ───────────────────────────────────────────
  // Full aggregation: own teams, schedule, ranking, opponent pictures.

  const loadStart = performance.now();
  let data: ClubSeasonData;

  try {
    data = await loadClubSeasonData({ clubId, seasonId, batchOptions });
  } catch (error) {
    timings.push({
      stage: "load-club-season-data",
      durationMs: elapsedMs(loadStart),
      success: false,
    });

    return {
      health: "unhealthy",
      clubId,
      seasonId,
      seasonName: null,
      seasonShortName: null,
      generatedAt,
      totalDurationMs: elapsedMs(totalStart),
      timings,
      counts: emptyDiagnosticCounts(),
      issues: [mapTopLevelErrorToIssue(error)],
    };
  }

  timings.push({
    stage: "load-club-season-data",
    durationMs: elapsedMs(loadStart),
    success: true,
  });

  // ── Derive counts, health, and issues ────────────────────────────────────────

  const counts = deriveDiagnosticCounts(data);
  const health = classifyHealth(counts, data.seasonName);
  const issues = deriveIssues(counts, data.seasonName);

  return {
    health,
    clubId,
    seasonId,
    seasonName: data.seasonName,
    seasonShortName: data.seasonShortName,
    generatedAt,
    totalDurationMs: elapsedMs(totalStart),
    timings,
    counts,
    issues,
  };
}
