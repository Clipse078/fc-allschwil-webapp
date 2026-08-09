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
 *
 * WEEKPLANNER-01B — Multiple Planning Variants.
 *
 * Adds the *effective* resource allocation for an optional, tenant-defined,
 * week-scoped, named alternative plan (see lib/weekplanner/plan-types.ts +
 * lib/weekplanner/plan-service.ts). "Standardplan" (no plan selected) is
 * unchanged from 01A: the `*Overridden` flags below are simply always
 * `false` and every allocation array is exactly the canonical default.
 * When an alternative plan IS selected, lib/weekplanner/queries.ts resolves
 * each allocation group as (plan override, if any) else (Standardplan
 * default) — see queries.ts's module doc comment for the full
 * "override by presence, per allocation group" semantics.
 *
 * WEEKPLANNER-01D — Alternative Time Overrides.
 *
 * `startAt`/`endAt` above are already the EFFECTIVE time for the currently
 * selected plan (plan override, if any, else the canonical Standardplan
 * time) — every downstream consumer (day-bucketing, conflict detection,
 * rendering, availability lookups) reads them and therefore automatically
 * operates on effective time with no changes of its own. `canonicalStartAt`/
 * `canonicalEndAt` preserve the untouched Standardplan value for display
 * ("Standard: 17:00–18:00 · …") and `timeOverridden` flags whether the
 * selected plan replaced it. Always `startAt === canonicalStartAt` (and
 * `endAt === canonicalEndAt`, `timeOverridden === false`) for the
 * Standardplan.
 */

export type WeekplannerItemType = "TRAINING" | "MATCH" | "TOURNAMENT";

/** The two allocation groups a WeekplannerPlan may override — see prisma/schema.prisma#WeekplannerAllocationGroup. */
export type WeekplannerAllocationGroup = "PITCH_HALL" | "DRESSING_ROOM";

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
  participantId: string;
  participantLabel: string;
  dressingRoomAllocations: WeekplannerResourceRef[];
  /** Untouched canonical Standardplan Garderobe for this participant — for restrained "Standard: …" display when overridden. */
  canonicalDressingRoomAllocations: WeekplannerResourceRef[];
  /** True when the currently selected plan overrides this participant's Garderobe. Always false for the Standardplan. */
  dressingRoomOverridden: boolean;
};

export type WeekplannerItemBase = {
  /** Globally unique within one resolved week — type-prefixed to avoid id collisions across sources. */
  id: string;
  tenantId: string;
  type: WeekplannerItemType;
  /** EFFECTIVE start — the selected plan's time override, if any, else the canonical Standardplan start. See module doc comment. */
  startAt: Date;
  /** EFFECTIVE end — the selected plan's time override, if any, else the canonical Standardplan end. See module doc comment. */
  endAt: Date;
  /** Untouched canonical Standardplan start — never overridden, for "Standard: …" display. */
  canonicalStartAt: Date;
  /** Untouched canonical Standardplan end — never overridden, for "Standard: …" display. */
  canonicalEndAt: Date;
  /** True when the currently selected plan overrides start and/or end. Always false for the Standardplan. */
  timeOverridden: boolean;
  title: string;
  /** FC Allschwil team(s) associated with this item. */
  teamNames: string[];
  /** Spielfeld/Halle allocation(s) — the currently selected plan's EFFECTIVE allocation (override, else Standardplan default). */
  pitchAllocations: WeekplannerResourceRef[];
  /** Garderobe allocation(s) — the item's own/home side for MATCH. Same override/fallback semantics as pitchAllocations. */
  dressingRoomAllocations: WeekplannerResourceRef[];
  /** Untouched canonical Standardplan Spielfeld/Halle — never overridden, for restrained "Standard: …" display. */
  canonicalPitchAllocations: WeekplannerResourceRef[];
  /** Untouched canonical Standardplan Garderobe (home side) — never overridden, for restrained "Standard: …" display. */
  canonicalDressingRoomAllocations: WeekplannerResourceRef[];
  /** True when the currently selected plan overrides pitchAllocations for this item. Always false for the Standardplan. */
  pitchOverridden: boolean;
  /** True when the currently selected plan overrides dressingRoomAllocations for this item. Always false for the Standardplan. */
  dressingRoomOverridden: boolean;
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
  /**
   * Away side Garderobe — WEEKPLANNER-01B deliberately does not support
   * plan overrides for the away side (out of scope: "HOME Match" only per
   * product spec). Always the Standardplan/legacy value.
   */
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
