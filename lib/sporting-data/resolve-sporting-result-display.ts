/**
 * lib/sporting-data/resolve-sporting-result-display.ts
 *
 * TEAM-SFV-02B — result display gated on canonical sporting lifecycle.
 */

import type { SportingMatchLifecycle } from "./lifecycle";

export type SportingResultDisplayInput = {
  lifecycle: SportingMatchLifecycle;
  resultLabel?: string | null;
  scoreHome?: number | null;
  scoreAway?: number | null;
};

function isResultEligibleLifecycle(lifecycle: SportingMatchLifecycle): boolean {
  return lifecycle === "COMPLETED" || lifecycle === "LIVE";
}

/**
 * Resolves the human-readable result label using lifecycle (not raw Event.status).
 *
 * Precedence:
 *   1. Non-completed/non-live lifecycle → null
 *   2. Explicit Event.resultLabel when present
 *   3. Numeric scores from MatchExternalMapping
 *   4. null
 */
export function resolveSportingResultDisplay(
  input: SportingResultDisplayInput,
): string | null {
  if (!isResultEligibleLifecycle(input.lifecycle)) {
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
