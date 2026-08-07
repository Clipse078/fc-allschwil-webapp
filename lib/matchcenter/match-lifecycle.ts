/**
 * lib/matchcenter/match-lifecycle.ts
 *
 * MATCHCENTER-UX-01 — canonical match lifecycle / result-display semantics.
 *
 * Root cause of the "fake 0:0" bug (see Phase 0 investigation):
 *   `MatchExternalMapping.scoreHome` / `scoreAway` are written directly from
 *   the SFV `scoreTeamA` / `scoreTeamB` fields (see
 *   lib/integrations/sfv/sync/schedule-mapper.ts::buildMappingFields), and
 *   the SFV API returns `0` — never `null` — for a fixture that has not been
 *   played yet. Nullability of scoreHome/scoreAway therefore cannot be used
 *   to decide whether a real result exists.
 *
 *   The canonical, already-correct source of truth is `Event.status`
 *   (EventStatus). `buildResultLabel()` in schedule-mapper.ts already gates
 *   `resultLabel` on status (only COMPLETED/LIVE produce a label), but the
 *   previous Matchcenter UI ignored that and read scoreHome/scoreAway first,
 *   which reintroduced the exact bug resultLabel was designed to avoid.
 *
 * This module is the single place Matchcenter presentation code should call
 * to decide "is this match completed?" and "what score, if any, should be
 * shown?". Pure, synchronous, no I/O.
 */

import type { MatchcenterMatchSummary } from "./types";

export type MatchcenterLifecycleStage = "UPCOMING" | "COMPLETED";

type StatusSource = Pick<MatchcenterMatchSummary, "status">;
type ScoreSource = Pick<
  MatchcenterMatchSummary,
  "status" | "scoreHome" | "scoreAway" | "resultLabel"
>;

function normalizedStatus(status: string): string {
  return status.trim().toUpperCase();
}

/** True only for the canonical, definitively-played EventStatus. */
export function isMatchCompleted(match: StatusSource): boolean {
  return normalizedStatus(match.status) === "COMPLETED";
}

/** True for POSTPONED/CANCELED — never a real result, never operationally actionable. */
export function isMatchCancelledOrPostponed(match: StatusSource): boolean {
  const status = normalizedStatus(match.status);
  return status === "CANCELED" || status === "CANCELLED" || status === "POSTPONED";
}

export function isMatchLive(match: StatusSource): boolean {
  return normalizedStatus(match.status) === "LIVE";
}

/**
 * Coarse Spielplanung/Resultate bucket for a match.
 * Only a definitively COMPLETED match belongs in Resultate — everything
 * else (SCHEDULED, LIVE, POSTPONED, CANCELED, DRAFT, ARCHIVED) is Spielplanung.
 */
export function getMatchcenterLifecycleStage(
  match: StatusSource,
): MatchcenterLifecycleStage {
  return isMatchCompleted(match) ? "COMPLETED" : "UPCOMING";
}

/**
 * Resolves the score label to display for a match, or `null` when no
 * legitimate result exists yet.
 *
 * Hard rules (MATCHCENTER-UX-01 §12):
 *   SCHEDULED / future            → null (never a fake "0:0")
 *   POSTPONED / CANCELED          → null (status is shown instead)
 *   COMPLETED                    → actual result, including a legitimate "0:0"
 *   LIVE                         → current score when the provider supplies one
 */
export function getMatchcenterResultLabel(match: ScoreSource): string | null {
  if (!isMatchCompleted(match) && !isMatchLive(match)) {
    return null;
  }

  if (match.scoreHome !== null && match.scoreAway !== null) {
    return `${match.scoreHome}:${match.scoreAway}`;
  }

  const resultLabel = match.resultLabel?.trim();
  return resultLabel ? resultLabel : null;
}
