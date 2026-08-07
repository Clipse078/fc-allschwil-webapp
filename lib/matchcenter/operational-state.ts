/**
 * lib/matchcenter/operational-state.ts
 *
 * MATCHCENTER-UX-01 — operational readiness / action-count derivation.
 *
 * Extracted from the former ad-hoc getMatchReadiness()/getOperationalWarnings()
 * pair in MatchcenterOverview.tsx so the completed-match short-circuit (hard
 * requirement: a definitively COMPLETED match has ZERO open operational
 * actions, regardless of historical allocation gaps) is defined in exactly
 * one place and reused by both the list view and any future consumer
 * (KPIs, detail page, etc).
 *
 * Preserves TEAM-SFV-MAPPING-05 semantics verbatim:
 *   - HOME match  → only the tenant-owned FCA HOME side resolution matters.
 *   - AWAY match  → only the tenant-owned FCA AWAY side resolution matters.
 *   - An unmapped external opponent never produces "Team nicht zugeordnet".
 *
 * Pure, synchronous, no I/O.
 */

import type { MatchcenterMatchSummary } from "./types";
import { isMatchCancelledOrPostponed, isMatchCompleted } from "./match-lifecycle";

export type MatchcenterActionStatus =
  | "READY"
  | "OPEN"
  | "AWAY"
  | "NOT_APPLICABLE";

export type MatchcenterOperationalAction = {
  key: string;
  label: string;
};

export type MatchcenterOperationalAssessment = {
  status: MatchcenterActionStatus;
  actions: MatchcenterOperationalAction[];
  actionCount: number;
  teamUnresolved: boolean;
};

function normalizedHomeAway(
  match: Pick<MatchcenterMatchSummary, "homeAway">,
): "HOME" | "AWAY" | null {
  const value = match.homeAway?.trim().toUpperCase() ?? null;
  return value === "HOME" || value === "AWAY" ? value : null;
}

const NOT_APPLICABLE: MatchcenterOperationalAssessment = {
  status: "NOT_APPLICABLE",
  actions: [],
  actionCount: 0,
  teamUnresolved: false,
};

/**
 * Assesses the operational action state of a single match.
 *
 * HARD RULE (MATCHCENTER-UX-01 §10): once a match is COMPLETED (or
 * POSTPONED/CANCELED — there is nothing left to operationally prepare),
 * it is unconditionally NOT_APPLICABLE — zero open actions — even when
 * historical pitch/dressing-room allocation is incomplete. Historical
 * records are never mutated to achieve this; the match is simply treated
 * as non-actionable going forward.
 */
export function assessMatchOperationalState(
  match: MatchcenterMatchSummary,
): MatchcenterOperationalAssessment {
  if (isMatchCompleted(match) || isMatchCancelledOrPostponed(match)) {
    return NOT_APPLICABLE;
  }

  const homeAway = normalizedHomeAway(match);
  const isAway = homeAway === "AWAY";

  // Only the tenant-owned FCA side's resolution matters (TEAM-SFV-MAPPING-05).
  // The opposite side is always the external opponent and is intentionally
  // allowed to remain unmapped — its resolution never contributes here.
  const ownSide = isAway ? match.away : match.home;
  const teamUnresolved = ownSide.resolution === "UNRESOLVED";

  const actions: MatchcenterOperationalAction[] = [];
  if (teamUnresolved) {
    actions.push({ key: "team", label: "Team nicht zugeordnet" });
  }

  if (isAway) {
    // Away matches never require FCA home-facility setup (pitch, dressing
    // rooms). Only a genuine own-team resolution gap is actionable.
    if (actions.length > 0) {
      return {
        status: "OPEN",
        actions,
        actionCount: actions.length,
        teamUnresolved,
      };
    }
    return { status: "AWAY", actions: [], actionCount: 0, teamUnresolved: false };
  }

  if (!match.operational.pitchCode?.trim()) {
    actions.push({ key: "pitch", label: "Spielfeld" });
  }
  if (!match.operational.homeDressingRoomCode?.trim()) {
    actions.push({ key: "home-dressing-room", label: "Heimkabine" });
  }
  if (!match.operational.awayDressingRoomCode?.trim()) {
    actions.push({ key: "away-dressing-room", label: "Gastkabine" });
  }
  if (homeAway === "HOME" && !match.visibility.infoboardVisible) {
    actions.push({ key: "infoboard", label: "Infoboard" });
  }

  if (actions.length === 0) {
    return { status: "READY", actions: [], actionCount: 0, teamUnresolved };
  }

  return { status: "OPEN", actions, actionCount: actions.length, teamUnresolved };
}

export function isMatchOperationallyOpen(
  match: MatchcenterMatchSummary,
): boolean {
  return assessMatchOperationalState(match).status === "OPEN";
}
