/**
 * lib/matchcenter/match-lifecycle.ts
 *
 * MATCHCENTER-UX-01 — canonical match lifecycle / result-display semantics.
 *
 * TEAM-SFV-02B: delegates lifecycle classification to lib/sporting-data while
 * preserving the existing Matchcenter helper surface for #402/#403 consumers.
 */

import {
  classifySportingMatchLifecycle,
  isSportingMatchCancelled,
  isSportingMatchCompleted,
  isSportingMatchLive,
  isSportingMatchPostponed,
  type SportingMatchLifecycle,
} from "@/lib/sporting-data/lifecycle";
import { resolveSportingResultDisplay } from "@/lib/sporting-data/resolve-sporting-result-display";
import type { MatchcenterMatchSummary } from "./types";

export type MatchcenterLifecycleStage = "UPCOMING" | "COMPLETED";

type LifecycleSource = {
  status: string;
  startAt?: Date;
  synchronization?: Pick<
    MatchcenterMatchSummary["synchronization"],
    "providerMatchStateName"
  >;
};

function resolveLifecycle(match: LifecycleSource, now?: Date): SportingMatchLifecycle {
  if (!match.startAt) {
    const status = match.status.trim().toUpperCase();
    if (status === "COMPLETED") return "COMPLETED";
    if (status === "LIVE") return "LIVE";
    if (status === "POSTPONED") return "POSTPONED";
    if (status === "CANCELLED" || status === "CANCELED") return "CANCELLED";
    return "UPCOMING";
  }

  return classifySportingMatchLifecycle({
    status: match.status,
    startAt: match.startAt,
    providerMatchStateName:
      match.synchronization?.providerMatchStateName ?? null,
    now,
  }).lifecycle;
}

/** True when the canonical sporting lifecycle is COMPLETED. */
export function isMatchCompleted(
  match: LifecycleSource,
  now?: Date,
): boolean {
  return isSportingMatchCompleted(resolveLifecycle(match, now));
}

/** True for POSTPONED/CANCELED — never a real result, never operationally actionable. */
export function isMatchCancelledOrPostponed(
  match: LifecycleSource,
  now?: Date,
): boolean {
  const lifecycle = resolveLifecycle(match, now);
  return (
    isSportingMatchCancelled(lifecycle) || isSportingMatchPostponed(lifecycle)
  );
}

export function isMatchLive(match: LifecycleSource, now?: Date): boolean {
  return isSportingMatchLive(resolveLifecycle(match, now));
}

/**
 * Coarse Spielplanung/Resultate bucket for a match.
 * Only a definitively COMPLETED match belongs in Resultate.
 */
export function getMatchcenterLifecycleStage(
  match: LifecycleSource,
  now?: Date,
): MatchcenterLifecycleStage {
  return isMatchCompleted(match, now) ? "COMPLETED" : "UPCOMING";
}

type ScoreSource = {
  status: string;
  startAt?: Date;
  scoreHome?: number | null;
  scoreAway?: number | null;
  resultLabel?: string | null;
  synchronization?: Pick<
    MatchcenterMatchSummary["synchronization"],
    "providerMatchStateName"
  >;
};

/**
 * Resolves the score label to display for a match, or `null` when no
 * legitimate result exists yet.
 */
export function getMatchcenterResultLabel(
  match: ScoreSource,
  now?: Date,
): string | null {
  const lifecycle = resolveLifecycle(match, now);

  return resolveSportingResultDisplay({
    lifecycle,
    resultLabel: match.resultLabel,
    scoreHome: match.scoreHome,
    scoreAway: match.scoreAway,
  });
}
