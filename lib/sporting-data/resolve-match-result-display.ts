/**
 * lib/sporting-data/resolve-match-result-display.ts
 *
 * TEAM-SFV-01B — canonical match result display resolution.
 *
 * Precedence (documented, deterministic, pure):
 *   1. Non-completed/non-live statuses → null (never fake results)
 *   2. Explicit Event.resultLabel when present and non-empty
 *   3. Numeric scores from MatchExternalMapping when both sides present
 *   4. null
 */

export type MatchResultDisplayInput = {
  status: string;
  resultLabel?: string | null;
  scoreHome?: number | null;
  scoreAway?: number | null;
};

function normalizedStatus(status: string): string {
  return status.trim().toUpperCase();
}

function isResultEligibleStatus(status: string): boolean {
  return status === "COMPLETED" || status === "LIVE";
}

/**
 * Resolves the human-readable match result label for display.
 *
 * Does not mutate input. Safe for unfinished matches (returns null).
 */
export function resolveMatchResultDisplay(
  input: MatchResultDisplayInput,
): string | null {
  const status = normalizedStatus(input.status);

  if (!isResultEligibleStatus(status)) {
    return null;
  }

  const explicitLabel = input.resultLabel?.trim();
  if (explicitLabel) {
    return explicitLabel;
  }

  if (input.scoreHome != null && input.scoreAway != null) {
    return `${input.scoreHome}:${input.scoreAway}`;
  }

  return null;
}
