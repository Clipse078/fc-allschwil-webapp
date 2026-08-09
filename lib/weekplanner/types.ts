/**
 * lib/weekplanner/types.ts
 *
 * WEEKPLANNER-01A — canonical Weekplanner Foundation.
 *
 * Weekplanner is a READ-ONLY aggregation surface over three ALREADY
 * canonical planning inputs — it introduces no new persisted planning
 * model:
 *
 *   TrainingSession (+ TrainingAllocation / TrainingSessionAllocation)
 *   Event(type=MATCH)      — legacy pitchCode/homeDressingRoomCode/awayDressingRoomCode
 *   Event(type=TOURNAMENT) — TournamentResourceAllocation / TournamentParticipantAllocation
 *
 * `WeekplannerItem` is a pure, in-memory read model built by
 * lib/weekplanner/queries.ts + lib/weekplanner/view-model.ts — never
 * written back to the database.
 */

export type WeekplannerItemType = "TRAINING" | "MATCH" | "TOURNAMENT";

/** Denormalised FacilityResource reference — the canonical resource, never duplicated. */
export type WeekplannerResourceRef = {
  facilityResourceId: string;
  code: string;
  name: string;
  facilityName: string;
};

/** One FacilityResource this item shares an overlapping booking with — the "⚠ Doppelbelegung" signal. */
export type WeekplannerConflict = {
  facilityResourceId: string;
  facilityResourceName: string;
};

export type WeekplannerTournamentParticipantAllocation = {
  participantLabel: string;
  dressingRoomAllocations: WeekplannerResourceRef[];
};

export type WeekplannerItemBase = {
  /** Globally unique within one resolved week — type-prefixed to avoid id collisions across sources. */
  id: string;
  tenantId: string;
  type: WeekplannerItemType;
  startAt: Date;
  endAt: Date;
  title: string;
  /** FC Allschwil team(s) associated with this item. */
  teamNames: string[];
  /** Spielfeld/Halle allocation(s). */
  pitchAllocations: WeekplannerResourceRef[];
  /** Garderobe allocation(s) — the item's own/home side for MATCH. */
  dressingRoomAllocations: WeekplannerResourceRef[];
  /** Populated by the view-model's conflict pass — empty until then. */
  conflicts: WeekplannerConflict[];
};

export type WeekplannerTrainingItem = WeekplannerItemBase & {
  type: "TRAINING";
  trainingSeriesId: string;
  trainingSessionId: string;
};

export type WeekplannerMatchItem = WeekplannerItemBase & {
  type: "MATCH";
  eventId: string;
  opponentName: string | null;
  /** Weekplanner only ever surfaces HOME matches — see queries.ts. */
  homeAway: "HOME";
  awayDressingRoomAllocations: WeekplannerResourceRef[];
};

export type WeekplannerTournamentItem = WeekplannerItemBase & {
  type: "TOURNAMENT";
  eventId: string;
  /** Weekplanner only ever surfaces HOME tournaments — see queries.ts. */
  homeAway: "HOME";
  participantAllocations: WeekplannerTournamentParticipantAllocation[];
};

export type WeekplannerItem =
  | WeekplannerTrainingItem
  | WeekplannerMatchItem
  | WeekplannerTournamentItem;

export type WeekplannerDay = {
  /** "YYYY-MM-DD", Europe/Zurich calendar date. */
  dayKey: string;
  /** Chronologically sorted (by effective startAt, then title as a tiebreaker). */
  items: WeekplannerItem[];
};

export type WeekplannerWeek = {
  /** 7 "YYYY-MM-DD" day keys, Monday first. */
  days: WeekplannerDay[];
  weekNumberLabel: string;
  rangeLabel: string;
  param: string;
  previousParam: string;
  nextParam: string;
};
