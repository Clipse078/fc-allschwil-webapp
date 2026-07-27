/**
 * lib/standings/errors.ts
 *
 * Error types for the canonical standings engine.
 *
 * STANDINGS-01: All error codes are canonical and provider-neutral.
 * No provider-specific error states are defined here.
 */

// ── Error codes ─────────────────────────────────────────────────────────────

/**
 * Canonical error codes emitted by the standings engine and service layer.
 *
 * COMPETITION_NOT_FOUND       — The requested competition does not exist or is
 *                               not accessible for the given tenant.
 * TEAM_SEASON_NOT_FOUND       — A TeamSeason referenced by a match result could
 *                               not be resolved to a known team in this competition.
 * CROSS_TENANT_MATCH          — A match result references teams from different
 *                               tenants.
 * DUPLICATE_MATCH             — The same matchId appears more than once in the
 *                               input result set.
 * INVALID_SCORE               — A match result carries a negative or non-integer
 *                               score value.
 * TEAM_NOT_IN_COMPETITION     — A team referenced by a match is not enrolled in
 *                               the competition being calculated.
 * TENANT_NOT_FOUND            — The requested tenant does not exist or is
 *                               inactive.
 * NO_FINISHED_MATCHES         — The competition has no FINISHED matches; a table
 *                               was requested but no data is available.
 * UNKNOWN_ERROR               — An unexpected internal error occurred.
 */
export type StandingsErrorCode =
  | "COMPETITION_NOT_FOUND"
  | "TEAM_SEASON_NOT_FOUND"
  | "CROSS_TENANT_MATCH"
  | "DUPLICATE_MATCH"
  | "INVALID_SCORE"
  | "TEAM_NOT_IN_COMPETITION"
  | "TENANT_NOT_FOUND"
  | "NO_FINISHED_MATCHES"
  | "UNKNOWN_ERROR";

// ── Error class ─────────────────────────────────────────────────────────────

/**
 * Structured error emitted by the standings engine.
 *
 * Always carries a canonical error code so callers can branch on specific
 * failure modes without parsing message strings.
 */
export class StandingsError extends Error {
  readonly code: StandingsErrorCode;

  constructor(code: StandingsErrorCode, message: string) {
    super(message);
    this.name = "StandingsError";
    this.code = code;
  }
}

// ── Validation result ───────────────────────────────────────────────────────

/**
 * Result of a pre-calculation validation run.
 */
export interface StandingsValidationResult {
  valid: boolean;
  errors: Array<{
    code: StandingsErrorCode;
    message: string;
    matchId?: string;
    teamSeasonId?: string;
  }>;
}
