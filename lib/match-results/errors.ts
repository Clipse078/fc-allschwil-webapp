/**
 * lib/match-results/errors.ts
 *
 * Canonical error vocabulary for the match-results module.
 *
 * Architecture invariants:
 *   - All errors are structured (code + message).
 *   - No provider-specific error codes here.
 *   - Callers discriminate by `code`, not by instance type, to allow
 *     serialisation across API boundaries.
 */

// ── Error codes ────────────────────────────────────────────────────────────

export type MatchResultErrorCode =
  | "MATCH_NOT_FOUND"
  | "MATCH_ARCHIVED"
  | "INVALID_SCORE"
  | "INVALID_STATUS"
  | "TENANT_MISMATCH"
  | "PROVIDER_NOT_SUPPORTED";

// ── Error class ────────────────────────────────────────────────────────────

/**
 * Structured error thrown by the match-results service.
 *
 * Callers should catch this class and switch on `code` for handling.
 *
 * @example
 * ```ts
 * try {
 *   await updateMatchResult(db, input)
 * } catch (err) {
 *   if (err instanceof MatchResultError) {
 *     switch (err.code) {
 *       case "MATCH_NOT_FOUND": return 404
 *       case "TENANT_MISMATCH":  return 403
 *       default: return 400
 *     }
 *   }
 *   throw err
 * }
 * ```
 */
export class MatchResultError extends Error {
  readonly code: MatchResultErrorCode;

  constructor(code: MatchResultErrorCode, message: string) {
    super(message);
    this.name = "MatchResultError";
    this.code = code;
  }
}

// ── Factory helpers ────────────────────────────────────────────────────────

export function matchNotFound(matchId: string): MatchResultError {
  return new MatchResultError(
    "MATCH_NOT_FOUND",
    `Match not found: ${matchId}`,
  );
}

export function matchArchived(matchId: string): MatchResultError {
  return new MatchResultError(
    "MATCH_ARCHIVED",
    `Match is archived and cannot be updated: ${matchId}`,
  );
}

export function invalidScore(reason: string): MatchResultError {
  return new MatchResultError("INVALID_SCORE", reason);
}

export function invalidStatus(reason: string): MatchResultError {
  return new MatchResultError("INVALID_STATUS", reason);
}

export function tenantMismatch(
  matchId: string,
  expectedTenantId: string,
): MatchResultError {
  return new MatchResultError(
    "TENANT_MISMATCH",
    `Match ${matchId} does not belong to tenant ${expectedTenantId}`,
  );
}

export function providerNotSupported(provider: string): MatchResultError {
  return new MatchResultError(
    "PROVIDER_NOT_SUPPORTED",
    `Provider is not supported: ${provider}`,
  );
}
