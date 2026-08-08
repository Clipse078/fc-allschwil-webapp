/**
 * lib/tournaments/operational-state.ts
 *
 * TOURNAMENTCENTER-01 — operational readiness assessment for a single
 * Tournament, mirroring lib/matchcenter/operational-state.ts's OPEN/READY
 * concept but scoped to what is actually required to administer a
 * tenant-managed tournament: organiser and venue/location.
 *
 * Facility allocation (pitch/dressing rooms) is intentionally NOT part of
 * the readiness gate — unlike a home match, a tournament is very often
 * hosted by an external club, so FCA facility allocation legitimately does
 * not apply to most tournaments. It remains editable (see
 * TournamentEditForm) but is not a required field.
 *
 * Pure, synchronous, no I/O.
 */

import type { TournamentDto } from "./types";

export type TournamentActionStatus = "READY" | "OPEN" | "NOT_APPLICABLE";

export type TournamentOperationalAction = {
  key: string;
  label: string;
};

export type TournamentOperationalAssessment = {
  status: TournamentActionStatus;
  actions: TournamentOperationalAction[];
  actionCount: number;
};

const NOT_APPLICABLE: TournamentOperationalAssessment = {
  status: "NOT_APPLICABLE",
  actions: [],
  actionCount: 0,
};

export function isTournamentCompletedOrInactive(tournament: Pick<TournamentDto, "status">): boolean {
  return (
    tournament.status === "COMPLETED" ||
    tournament.status === "CANCELLED" ||
    tournament.status === "ARCHIVED"
  );
}

/**
 * HARD RULE: once a Tournament is COMPLETED/CANCELLED/ARCHIVED, there is
 * nothing left to prepare — it is unconditionally NOT_APPLICABLE.
 */
export function assessTournamentOperationalState(
  tournament: TournamentDto,
): TournamentOperationalAssessment {
  if (isTournamentCompletedOrInactive(tournament)) {
    return NOT_APPLICABLE;
  }

  const actions: TournamentOperationalAction[] = [];

  if (!tournament.organizerName?.trim()) {
    actions.push({ key: "organizer", label: "Organisator" });
  }
  if (!tournament.location?.trim()) {
    actions.push({ key: "location", label: "Ort" });
  }
  if (!tournament.team) {
    actions.push({ key: "team", label: "Team" });
  }

  if (actions.length === 0) {
    return { status: "READY", actions: [], actionCount: 0 };
  }

  return { status: "OPEN", actions, actionCount: actions.length };
}

export function isTournamentOperationallyOpen(tournament: TournamentDto): boolean {
  return assessTournamentOperationalState(tournament).status === "OPEN";
}
