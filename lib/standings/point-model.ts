/**
 * lib/standings/point-model.ts
 *
 * Point model interface and canonical default implementation.
 *
 * STANDINGS-01: The point model is deliberately separated from the engine to
 * allow future sports or competition-specific rules to override the default
 * without touching the calculation core.
 *
 * Architecture invariants:
 *   - IPointModel is defined in types.ts; implementations live here.
 *   - DefaultPointModel uses Win=3, Draw=1, Loss=0.
 *   - Point values are NOT hardcoded in the engine — always delegated here.
 *   - Future implementors: BonusPointModel, DeductionAwareModel, etc.
 */

import type { IPointModel, MatchOutcome } from "./types";

// ── Default point model ─────────────────────────────────────────────────────

/**
 * Canonical default point model for SportClubEvo.
 *
 *   Win  = 3 points
 *   Draw = 1 point
 *   Loss = 0 points
 *
 * This is the standard three-points-for-a-win system used by the vast
 * majority of association football leagues worldwide.
 */
export class DefaultPointModel implements IPointModel {
  static readonly WIN_POINTS = 3;
  static readonly DRAW_POINTS = 1;
  static readonly LOSS_POINTS = 0;

  pointsFor(outcome: MatchOutcome): number {
    switch (outcome) {
      case "WIN":
        return DefaultPointModel.WIN_POINTS;
      case "DRAW":
        return DefaultPointModel.DRAW_POINTS;
      case "LOSS":
        return DefaultPointModel.LOSS_POINTS;
    }
  }
}

/**
 * Singleton default instance.
 * Use this unless a competition requires a custom point model.
 */
export const defaultPointModel = new DefaultPointModel();

// ── Outcome resolver ────────────────────────────────────────────────────────

/**
 * Determines the match outcome for the home and away team based on the score.
 *
 * @returns { home, away } outcomes for each side.
 */
export function resolveOutcomes(
  scoreHome: number,
  scoreAway: number,
): { home: MatchOutcome; away: MatchOutcome } {
  if (scoreHome > scoreAway) {
    return { home: "WIN", away: "LOSS" };
  }
  if (scoreAway > scoreHome) {
    return { home: "LOSS", away: "WIN" };
  }
  return { home: "DRAW", away: "DRAW" };
}
