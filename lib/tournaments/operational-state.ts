/**
 * lib/tournaments/operational-state.ts
 *
 * TOURNAMENTCENTER-01 / -01B — operational readiness assessment for a
 * single Tournament, mirroring lib/matchcenter/operational-state.ts's
 * OPEN/READY concept.
 *
 * TOURNAMENTCENTER-01B — HOME/AWAY facility gating (mirrors MatchCenter's
 * operational logic at Event level, see lib/matchcenter/operational-state.ts):
 *   - HOME tournament (Event.homeAway === "HOME", the default when unset):
 *     FCA facilities are relevant — at least one Spielfeld/Halle allocation
 *     and, per participating team, a Garderobe allocation are genuine
 *     operational requirements and contribute OPEN actions when missing.
 *   - AWAY tournament (Event.homeAway === "AWAY"): FCA facilities never
 *     apply — no pitch/hall or dressing-room action is ever raised.
 *
 * Pure, synchronous, no I/O.
 */

import { getEffectiveEndAt } from "@/lib/publishing/time/temporal-grouping";
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

/** Canonical effective end for presentation — explicit endAt or TOURNAMENT default duration. */
export function getTournamentEffectiveEndAt(
  tournament: Pick<TournamentDto, "startAt" | "endAt">,
): Date {
  return getEffectiveEndAt({
    startAt: new Date(tournament.startAt),
    endAt: tournament.endAt ? new Date(tournament.endAt) : null,
    type: "TOURNAMENT",
  });
}

/** True when the tournament's canonical effective end is at or before `now`. */
export function isTournamentPastByEffectiveEnd(
  tournament: Pick<TournamentDto, "startAt" | "endAt">,
  now: Date = new Date(),
): boolean {
  return getTournamentEffectiveEndAt(tournament).getTime() <= now.getTime();
}

/**
 * TournamentCenter Archiv bucket — persisted inactive statuses OR past by
 * canonical effective-end semantics. Presentation-only; never mutates status.
 */
export function isTournamentInArchivList(
  tournament: Pick<TournamentDto, "status" | "startAt" | "endAt">,
  now: Date = new Date(),
): boolean {
  if (isTournamentCompletedOrInactive(tournament)) {
    return true;
  }
  return isTournamentPastByEffectiveEnd(tournament, now);
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
  // TOURNAMENTCENTER-01B: a tournament is multi-team — the genuine
  // requirement is "at least one participant", not "a single Event.teamId
  // team" (see lib/tournaments/participant-service.ts).
  if (tournament.participants.length === 0) {
    actions.push({ key: "participants", label: "Teilnehmende Teams" });
  }

  // Facility allocation only ever applies to HOME tournaments — an AWAY
  // tournament has no FCA pitch/hall or dressing-room requirement at all
  // (PRODUCT REQUIREMENT: "Away tournaments: allocation requirements are
  // NOT_APPLICABLE — no facility-related Offen warnings").
  if (tournament.homeAway === "HOME") {
    if (tournament.resourceAllocations.length === 0) {
      actions.push({ key: "pitch-hall", label: "Spielfeld / Halle" });
    }
    const hasParticipantMissingDressingRoom = tournament.participants.some(
      (participant) => participant.dressingRoomAllocations.length === 0,
    );
    if (tournament.participants.length > 0 && hasParticipantMissingDressingRoom) {
      actions.push({ key: "dressing-room", label: "Garderobe" });
    }
  }

  if (actions.length === 0) {
    return { status: "READY", actions: [], actionCount: 0 };
  }

  return { status: "OPEN", actions, actionCount: actions.length };
}

export function isTournamentOperationallyOpen(tournament: TournamentDto): boolean {
  return assessTournamentOperationalState(tournament).status === "OPEN";
}
