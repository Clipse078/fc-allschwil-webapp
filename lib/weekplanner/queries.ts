/**
 * lib/weekplanner/queries.ts
 *
 * WEEKPLANNER-01A — Canonical Weekplanner Foundation.
 *
 * Read-only aggregator over the three EXISTING canonical planning sources —
 * introduces no second planning database, no duplicated TrainingSession/
 * Event rows, and no parallel allocation model:
 *
 *   - TrainingSession, via the canonical lib/training/session-generation-
 *     service.ts::listTrainingSessions() (already tenant-scoped, already
 *     resolves TRAININGCENTER-02 occurrence-level reschedule overrides).
 *     Resource allocation is resolved the same way TrainingCenter's own
 *     availability aggregator does it (lib/facilities/availability-
 *     service.ts): a TrainingSessionAllocation override for a given
 *     allocation group (Spielfeld/Halle vs. Garderobe — see
 *     lib/training/allocation-groups.ts) wins when present, otherwise the
 *     parent TrainingSeries' TrainingAllocation default applies.
 *
 *   - Event(type=MATCH), via the canonical lib/matchcenter/query-
 *     service.ts::listMatchcenterMatches(). Only HOME matches are surfaced
 *     — an AWAY match is never FC Allschwil's facility occupancy (product
 *     requirement). Facility allocation is still the legacy Wochenplan V1
 *     Event.pitchCode / homeDressingRoomCode / awayDressingRoomCode string
 *     fields (NOT migrated in this slice, per the WEEKPLANNER-01A scope) —
 *     resolved to the canonical FacilityResource by code, exactly like
 *     lib/facilities/availability-service.ts#findMatchConflicts already
 *     does for guided creation.
 *
 *   - Event(type=TOURNAMENT), via the canonical lib/tournaments/tournament-
 *     service.ts::listTournaments(). Only HOME tournaments are surfaced.
 *     Facility allocation is the canonical TournamentResourceAllocation
 *     (Spielfeld/Halle) + per-participant TournamentParticipantAllocation
 *     (Garderobe) — already keyed by FacilityResource id, no code
 *     resolution needed.
 *
 * Security invariants:
 *   - tenantId always comes from a trusted session context — never from
 *     client-supplied input.
 *   - Every query below is scoped by tenantId; a cross-tenant TrainingSeries/
 *     TrainingSession/FacilityResource/Event can never leak into the result.
 *
 * WEEKPLANNER-01B — Multiple Planning Variants.
 *
 * `getWeekplannerWeek()` accepts an optional `planId`. When present, this
 * module additionally loads that WeekplannerPlan's sparse
 * WeekplannerPlanAllocation override rows (scoped by tenantId +
 * weekplannerPlanId — a planId belonging to a different tenant simply
 * yields zero rows, i.e. behaves exactly like no plan selected) and
 * resolves each item's Spielfeld/Halle and Garderobe allocations as
 * (plan override, if any) else (Standardplan default) — "override by
 * presence, per allocation group", mirroring the identical
 * TrainingSessionAllocation-over-TrainingAllocation precedence already
 * used for TRAINING above. When `planId` is omitted, every code path below
 * is byte-for-byte identical to WEEKPLANNER-01A — the Standardplan.
 *
 * Because the override map is scoped to exactly one plan per call, and
 * conflict detection (view-model.ts) always runs against this call's
 * already-resolved EFFECTIVE items, two different plans' conflicts can
 * never leak into each other — conflict isolation falls out of this
 * request-scoped resolution, with no changes needed to view-model.ts.
 *
 * WEEKPLANNER-01D — Alternative Time Overrides.
 *
 * Exactly the same "override by presence" resolution, applied to each
 * item's start/end instead of its FacilityResource allocations — see
 * findWeekplannerPlanTimeOverrides()/resolveEffectiveTime() below and
 * lib/weekplanner/plan-service.ts's WeekplannerPlanActivityOverride doc
 * comment. Every item below is built with its EFFECTIVE startAt/endAt
 * (plan override, if any, else canonical) — view-model.ts's conflict
 * detection and day-bucketing therefore automatically operate on effective
 * time with zero changes of their own.
 */

import { prisma } from "@/lib/db/prisma";
import { isMeaningfulEventInterval } from "@/lib/facilities/resource-occupancy-window";
import { getWochenplanPlanBaselineMode, type WochenplanPlanBaselineMode } from "@/lib/wochenplan/plan-baseline";
import { listTrainingSessions } from "@/lib/training/session-generation-service";
import {
  resolveTrainingOccurrenceAllocations,
  type TrainingAllocationResourceRow,
} from "@/lib/training/effective-training-allocation-resolution";
import {
  listMatchcenterMatches,
  type MatchcenterQueryDatabase,
} from "@/lib/matchcenter/query-service";
import { listTournaments } from "@/lib/tournaments/tournament-service";
import { formatWeekNumberLabel, formatWeekRangeLabel } from "./date";
import { buildWeekplannerWeek } from "./view-model";
import { planOverrideKey, planTimeOverrideKey } from "./plan-override-key";
import type {
  WeekplannerDay,
  WeekplannerItem,
  WeekplannerMatchItem,
  WeekplannerResourceRef,
  WeekplannerTournamentItem,
  WeekplannerTrainingItem,
  WeekplannerWeek,
} from "./types";

export type WeekplannerWindow = {
  from: Date;
  to: Date;
  /** 7 "YYYY-MM-DD" day keys, Monday first (Europe/Zurich calendar dates). */
  days: readonly string[];
  param: string;
  previousParam: string;
  nextParam: string;
};

/**
 * DAYPLANNER-01A — the single-day equivalent of WeekplannerWindow. Comes
 * from lib/training/date-range.ts#resolveTrainingDayWindow — the same
 * DST-safe, Europe/Zurich, TrainingCenter "Tag" boundary resolver already
 * proven correct (see lib/training/__tests__/date-range.test.ts) — not a
 * second date-window implementation.
 */
export type WeekplannerDayWindow = {
  from: Date;
  to: Date;
  /** "YYYY-MM-DD" Europe/Zurich calendar date. */
  date: string;
  param: string;
  previousParam: string;
  nextParam: string;
};

// ── FacilityResource code map (legacy MATCH pitchCode/dressingRoomCode resolution) ──

type FacilityResourceRow = {
  id: string;
  code: string;
  name: string;
  facility: { name: string };
};

function toResourceRef(
  row: FacilityResourceRow,
  occupancy: { occupancyBeforeMinutes: number; occupancyAfterMinutes: number } = {
    occupancyBeforeMinutes: 0,
    occupancyAfterMinutes: 0,
  },
): WeekplannerResourceRef {
  return {
    facilityResourceId: row.id,
    code: row.code,
    name: row.name,
    facilityName: row.facility.name,
    occupancyBeforeMinutes: occupancy.occupancyBeforeMinutes,
    occupancyAfterMinutes: occupancy.occupancyAfterMinutes,
  };
}

async function findFacilityResourceCodeMap(
  tenantId: string,
): Promise<Map<string, WeekplannerResourceRef>> {
  const resources = await prisma.facilityResource.findMany({
    where: {
      tenantId,
      status: { not: "ARCHIVED" },
      facility: { status: { not: "ARCHIVED" } },
    },
    select: { id: true, code: true, name: true, facility: { select: { name: true } } },
  });

  return new Map(resources.map((resource) => [resource.code, toResourceRef(resource)]));
}

// ── WEEKPLANNER-01B: plan override resolution ───────────────────────────────
//
// planOverrideKey() itself lives in ./plan-override-key.ts (a pure, I/O-free
// module) so both this server-side resolver and WeekPlannerPage.tsx (a
// server component deciding which override editor to render) share the
// exact same key format without ever drifting apart.

/**
 * Groups a plan's WeekplannerPlanAllocation rows by exactly the key an
 * item's allocation resolution looks up — one entry per
 * (activityType, activityId, allocationGroup, participantId) combination
 * that has at least one override row. A combination absent from this map
 * has NO override — the caller falls back to the Standardplan default for
 * that group.
 */
async function findWeekplannerPlanOverrides(
  tenantId: string,
  planId: string | undefined,
): Promise<Map<string, WeekplannerResourceRef[]>> {
  const map = new Map<string, WeekplannerResourceRef[]>();
  if (!planId) return map;

  const rows = await prisma.weekplannerPlanAllocation.findMany({
    where: { tenantId, weekplannerPlanId: planId },
    select: {
      activityType: true,
      activityId: true,
      allocationGroup: true,
      participantId: true,
      occupancyBeforeMinutes: true,
      occupancyAfterMinutes: true,
      facilityResource: { select: { id: true, code: true, name: true, facility: { select: { name: true } } } },
    },
    orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
  });

  for (const row of rows) {
    const key = planOverrideKey(row.activityType, row.activityId, row.allocationGroup, row.participantId);
    const list = map.get(key) ?? [];
    list.push(
      toResourceRef(row.facilityResource, {
        occupancyBeforeMinutes: row.occupancyBeforeMinutes,
        occupancyAfterMinutes: row.occupancyAfterMinutes,
      }),
    );
    map.set(key, list);
  }

  return map;
}

/** Resolves one allocation group as (plan override, if present) else `standardplanDefault` — the "override by presence" rule. */
function resolveEffectiveAllocation(
  overridesByKey: ReadonlyMap<string, WeekplannerResourceRef[]>,
  key: string,
  standardplanDefault: WeekplannerResourceRef[],
): { allocations: WeekplannerResourceRef[]; overridden: boolean } {
  const override = overridesByKey.get(key);
  if (override && override.length > 0) {
    return { allocations: override, overridden: true };
  }
  return { allocations: standardplanDefault, overridden: false };
}

// ── WEEKPLANNER-01D: plan TIME override resolution ──────────────────────────
//
// Mirrors findWeekplannerPlanOverrides()/resolveEffectiveAllocation() above
// exactly, but for one canonical activity's start/end instead of a
// FacilityResource allocation group — see lib/weekplanner/plan-service.ts's
// WeekplannerPlanActivityOverride doc comment for the persisted shape.

type TimeOverrideEntry = { overrideStartAt: Date | null; overrideEndAt: Date | null };

/**
 * Groups a plan's WeekplannerPlanActivityOverride rows by
 * (activityType, activityId) — a combination absent from this map has NO
 * time override; the caller falls back to the canonical Standardplan time
 * for that side (start and/or end independently — see
 * resolveEffectiveTime()).
 */
async function findWeekplannerPlanTimeOverrides(
  tenantId: string,
  planId: string | undefined,
): Promise<Map<string, TimeOverrideEntry>> {
  const map = new Map<string, TimeOverrideEntry>();
  if (!planId) return map;

  const rows = await prisma.weekplannerPlanActivityOverride.findMany({
    where: { tenantId, weekplannerPlanId: planId },
    select: { activityType: true, activityId: true, overrideStartAt: true, overrideEndAt: true },
  });

  for (const row of rows) {
    map.set(planTimeOverrideKey(row.activityType, row.activityId), {
      overrideStartAt: row.overrideStartAt,
      overrideEndAt: row.overrideEndAt,
    });
  }

  return map;
}

/**
 * Resolves one activity's EFFECTIVE start/end as (plan override start/end,
 * if present) else (canonical Standardplan start/end) — independently per
 * side, mirroring resolveEffectiveAllocation()'s "override by presence"
 * rule. `overridden` is true when EITHER side is overridden.
 */
function resolveEffectiveTime(
  timeOverridesByKey: ReadonlyMap<string, TimeOverrideEntry>,
  key: string,
  canonicalStartAt: Date,
  canonicalEndAt: Date,
): { startAt: Date; endAt: Date; canonicalStartAt: Date; canonicalEndAt: Date; overridden: boolean } {
  const override = timeOverridesByKey.get(key);
  const startAt = override?.overrideStartAt ?? canonicalStartAt;
  const endAt = override?.overrideEndAt ?? canonicalEndAt;
  const overridden = Boolean(override?.overrideStartAt || override?.overrideEndAt);
  return { startAt, endAt, canonicalStartAt, canonicalEndAt, overridden };
}

async function resolveWeekplannerPlanBaselineMode(
  tenantId: string,
  planId: string | undefined,
): Promise<WochenplanPlanBaselineMode> {
  if (!planId) return "canonical";

  const row = await prisma.weekplannerPlan.findFirst({
    where: { id: planId, tenantId, archivedAt: null },
    select: { wochenplanPlanId: true },
  });
  if (!row?.wochenplanPlanId) return "canonical";

  const definition = await prisma.wochenplanPlan.findFirst({
    where: { id: row.wochenplanPlanId, tenantId },
    select: { description: true },
  });

  return getWochenplanPlanBaselineMode(definition?.description);
}

function collectActivitiesWithOverrides(
  overridesByKey: ReadonlyMap<string, WeekplannerResourceRef[]>,
  timeOverridesByKey: ReadonlyMap<string, TimeOverrideEntry>,
): Set<string> {
  const present = new Set<string>();

  for (const key of overridesByKey.keys()) {
    const [activityType, activityId] = key.split(":");
    if (activityType && activityId) {
      present.add(`${activityType}:${activityId}`);
    }
  }

  for (const key of timeOverridesByKey.keys()) {
    present.add(key);
  }

  return present;
}

function filterItemsForEmptyBaseline(
  items: WeekplannerItem[],
  activitiesWithOverrides: Set<string>,
): WeekplannerItem[] {
  return items.filter((item) => {
    const activityId = item.type === "TRAINING" ? item.trainingSessionId : item.eventId;
    return activitiesWithOverrides.has(`${item.type}:${activityId}`);
  });
}

// ── TrainingSession → WeekplannerTrainingItem ───────────────────────────────

type AllocationResourceRow = TrainingAllocationResourceRow;

function toWeekplannerResourceRefs(
  rows: readonly AllocationResourceRow[],
): WeekplannerResourceRef[] {
  return rows.map((row) => ({
    facilityResourceId: row.facilityResource.id,
    code: row.facilityResource.code,
    name: row.facilityResource.name,
    facilityName: row.facilityResource.facility.name,
    occupancyBeforeMinutes: 0,
    occupancyAfterMinutes: 0,
  }));
}

async function findWeekplannerTrainingItems(
  tenantId: string,
  days: readonly string[],
  overridesByKey: ReadonlyMap<string, WeekplannerResourceRef[]>,
  timeOverridesByKey: ReadonlyMap<string, TimeOverrideEntry>,
): Promise<WeekplannerTrainingItem[]> {
  if (days.length === 0) return [];

  // TrainingSession.date is a pure calendar-date key (UTC-midnight
  // convention — see the TrainingSession Prisma model doc comment), NOT a
  // real timezone-zoned instant. The correct, DST-safe way to bound it is
  // therefore to build UTC-midnight Dates directly from the already
  // Europe/Zurich-resolved day keys — never by truncating a genuine zoned
  // instant (which would silently shift the window by one calendar day).
  const dateFrom = new Date(`${days[0]}T00:00:00.000Z`);
  const dateTo = new Date(`${days[days.length - 1]}T00:00:00.000Z`);

  const sessions = await listTrainingSessions(tenantId, { dateFrom, dateTo });
  if (sessions.length === 0) return [];

  const seriesIds = [...new Set(sessions.map((session) => session.trainingSeriesId))];
  const sessionIds = sessions.map((session) => session.id);

  const [seriesAllocationRows, sessionOverrideRows] = await Promise.all([
    prisma.trainingAllocation.findMany({
      where: { tenantId, trainingSeriesId: { in: seriesIds } },
      select: {
        trainingSeriesId: true,
        displayOrder: true,
        createdAt: true,
        updatedAt: true,
        facilityResource: {
          select: { id: true, code: true, name: true, type: true, facility: { select: { name: true } } },
        },
      },
      orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
    }),
    prisma.trainingSessionAllocation.findMany({
      where: { tenantId, trainingSessionId: { in: sessionIds } },
      select: {
        trainingSessionId: true,
        displayOrder: true,
        createdAt: true,
        updatedAt: true,
        facilityResource: {
          select: { id: true, code: true, name: true, type: true, facility: { select: { name: true } } },
        },
      },
      orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
    }),
  ]);

  const seriesAllocationsById = new Map<string, AllocationResourceRow[]>();
  for (const row of seriesAllocationRows) {
    const list = seriesAllocationsById.get(row.trainingSeriesId) ?? [];
    list.push(row);
    seriesAllocationsById.set(row.trainingSeriesId, list);
  }

  const sessionOverridesById = new Map<string, AllocationResourceRow[]>();
  for (const row of sessionOverrideRows) {
    const list = sessionOverridesById.get(row.trainingSessionId) ?? [];
    list.push(row);
    sessionOverridesById.set(row.trainingSessionId, list);
  }

  return sessions.map((session) => {
    const seriesRows = seriesAllocationsById.get(session.trainingSeriesId) ?? [];
    const overrideRows = sessionOverridesById.get(session.id) ?? [];
    const occurrenceAllocations = resolveTrainingOccurrenceAllocations({
      seriesRows,
      sessionOverrideRows: overrideRows,
    });

    // TRAININGCENTER-02 override-by-presence-per-group: any TrainingSessionAllocation
    // override row for a group supersedes that group's series-level default for this
    // occurrence only (see lib/training/session-allocation-service.ts). This
    // resolved value is the Standardplan default the WEEKPLANNER-01B plan
    // override (if any) is layered on top of below.
    const standardplanPitch = toWeekplannerResourceRefs(occurrenceAllocations.pitch);
    const standardplanDressingRoom = toWeekplannerResourceRefs(occurrenceAllocations.dressingRoom);

    const pitch = resolveEffectiveAllocation(
      overridesByKey,
      planOverrideKey("TRAINING", session.id, "PITCH_HALL"),
      standardplanPitch,
    );
    const dressingRoom = resolveEffectiveAllocation(
      overridesByKey,
      planOverrideKey("TRAINING", session.id, "DRESSING_ROOM"),
      standardplanDressingRoom,
    );
    const time = resolveEffectiveTime(
      timeOverridesByKey,
      planTimeOverrideKey("TRAINING", session.id),
      new Date(session.startAt),
      new Date(session.endAt),
    );

    return {
      id: `training:${session.id}`,
      tenantId,
      type: "TRAINING",
      startAt: time.startAt,
      endAt: time.endAt,
      canonicalStartAt: time.canonicalStartAt,
      canonicalEndAt: time.canonicalEndAt,
      timeOverridden: time.overridden,
      title: session.trainingSeriesTitle,
      teamNames: [session.teamName],
      pitchAllocations: pitch.allocations,
      dressingRoomAllocations: dressingRoom.allocations,
      canonicalPitchAllocations: standardplanPitch,
      canonicalDressingRoomAllocations: standardplanDressingRoom,
      pitchOverridden: pitch.overridden,
      dressingRoomOverridden: dressingRoom.overridden,
      conflicts: [],
      trainingSeriesId: session.trainingSeriesId,
      trainingSessionId: session.id,
    } satisfies WeekplannerTrainingItem;
  });
}

// ── Event(type=MATCH) → WeekplannerMatchItem (HOME only) ────────────────────

function isAwayHomeAway(value: string | null): boolean {
  return value?.trim().toUpperCase() === "AWAY";
}

function isCancelled(status: string): boolean {
  const normalized = status.trim().toUpperCase();
  return normalized === "CANCELLED" || normalized === "CANCELED";
}

async function findWeekplannerHomeMatches(
  tenantId: string,
  from: Date,
  to: Date,
  resourceByCode: ReadonlyMap<string, WeekplannerResourceRef>,
  overridesByKey: ReadonlyMap<string, WeekplannerResourceRef[]>,
  timeOverridesByKey: ReadonlyMap<string, TimeOverrideEntry>,
): Promise<WeekplannerMatchItem[]> {
  const database = prisma as unknown as MatchcenterQueryDatabase;
  const matches = await listMatchcenterMatches(database, { tenantId, from, to });

  const homeMatches = matches.filter(
    (match) => !isAwayHomeAway(match.homeAway) && !isCancelled(match.status),
  );

  return homeMatches.map((match) => {
    const pitchRef = match.operational.pitchCode
      ? resourceByCode.get(match.operational.pitchCode)
      : undefined;
    const homeRoomRef = match.operational.homeDressingRoomCode
      ? resourceByCode.get(match.operational.homeDressingRoomCode)
      : undefined;
    const awayRoomRef = match.operational.awayDressingRoomCode
      ? resourceByCode.get(match.operational.awayDressingRoomCode)
      : undefined;

    // WEEKPLANNER-01B only supports overrides for the HOME side (Spielfeld/
    // Halle + the club's own Garderobe) — the away room is always the
    // legacy/Standardplan value, see WeekplannerMatchItem.awayDressingRoomAllocations doc comment.
    const pitch = resolveEffectiveAllocation(
      overridesByKey,
      planOverrideKey("MATCH", match.id, "PITCH_HALL"),
      pitchRef ? [pitchRef] : [],
    );
    const dressingRoom = resolveEffectiveAllocation(
      overridesByKey,
      planOverrideKey("MATCH", match.id, "DRESSING_ROOM"),
      homeRoomRef ? [homeRoomRef] : [],
    );
    const canonicalStartAt = new Date(match.startAt);
    const rawEndAt = match.endAt ? new Date(match.endAt) : null;
    const canonicalEndAt =
      rawEndAt && isMeaningfulEventInterval(canonicalStartAt, rawEndAt) ? rawEndAt : canonicalStartAt;
    const time = resolveEffectiveTime(
      timeOverridesByKey,
      planTimeOverrideKey("MATCH", match.id),
      canonicalStartAt,
      canonicalEndAt,
    );

    return {
      id: `match:${match.id}`,
      tenantId: match.tenantId,
      type: "MATCH",
      startAt: time.startAt,
      endAt: time.endAt,
      canonicalStartAt: time.canonicalStartAt,
      canonicalEndAt: time.canonicalEndAt,
      timeOverridden: time.overridden,
      title: match.title,
      teamNames: [match.home.displayName],
      opponentName: match.away.displayName,
      homeAway: "HOME",
      eventId: match.id,
      pitchAllocations: pitch.allocations,
      dressingRoomAllocations: dressingRoom.allocations,
      canonicalPitchAllocations: pitchRef ? [pitchRef] : [],
      canonicalDressingRoomAllocations: homeRoomRef ? [homeRoomRef] : [],
      pitchOverridden: pitch.overridden,
      dressingRoomOverridden: dressingRoom.overridden,
      awayDressingRoomAllocations: awayRoomRef ? [awayRoomRef] : [],
      conflicts: [],
    } satisfies WeekplannerMatchItem;
  });
}

// ── Event(type=TOURNAMENT) → WeekplannerTournamentItem (HOME only) ──────────

async function findWeekplannerHomeTournaments(
  tenantId: string,
  from: Date,
  to: Date,
  overridesByKey: ReadonlyMap<string, WeekplannerResourceRef[]>,
  timeOverridesByKey: ReadonlyMap<string, TimeOverrideEntry>,
): Promise<WeekplannerTournamentItem[]> {
  const tournaments = await listTournaments(tenantId);

  const homeTournaments = tournaments.filter((tournament) => {
    if (tournament.homeAway !== "HOME") return false;
    if (isCancelled(tournament.status)) return false;

    const startAt = new Date(tournament.startAt).getTime();
    const endAt = tournament.endAt ? new Date(tournament.endAt).getTime() : startAt;
    return startAt < to.getTime() && endAt >= from.getTime();
  });

  return homeTournaments.map((tournament) => {
    const canonicalStartAt = new Date(tournament.startAt);
    const canonicalEndAt = tournament.endAt ? new Date(tournament.endAt) : canonicalStartAt;
    const time = resolveEffectiveTime(
      timeOverridesByKey,
      planTimeOverrideKey("TOURNAMENT", tournament.id),
      canonicalStartAt,
      canonicalEndAt,
    );

    const ownTeamNames = tournament.participants
      .filter((participant) => participant.kind === "TEAM")
      .map((participant) => participant.displayName);

    const standardplanPitch = tournament.resourceAllocations.map((allocation) => ({
      facilityResourceId: allocation.facilityResourceId,
      code: allocation.facilityResourceCode,
      name: allocation.facilityResourceName,
      facilityName: allocation.facilityName,
      occupancyBeforeMinutes: 0,
      occupancyAfterMinutes: 0,
    }));
    const pitch = resolveEffectiveAllocation(
      overridesByKey,
      planOverrideKey("TOURNAMENT", tournament.id, "PITCH_HALL"),
      standardplanPitch,
    );

    return {
      id: `tournament:${tournament.id}`,
      tenantId: tournament.tenantId,
      type: "TOURNAMENT",
      startAt: time.startAt,
      endAt: time.endAt,
      canonicalStartAt: time.canonicalStartAt,
      canonicalEndAt: time.canonicalEndAt,
      timeOverridden: time.overridden,
      title: tournament.title,
      teamNames: ownTeamNames,
      homeAway: "HOME",
      eventId: tournament.id,
      pitchAllocations: pitch.allocations,
      dressingRoomAllocations: [],
      canonicalPitchAllocations: standardplanPitch,
      canonicalDressingRoomAllocations: [],
      pitchOverridden: pitch.overridden,
      dressingRoomOverridden: false,
      participantAllocations: tournament.participants.map((participant) => {
        const standardplanParticipantDressingRoom = participant.dressingRoomAllocations.map((allocation) => ({
          facilityResourceId: allocation.facilityResourceId,
          code: allocation.facilityResourceCode,
          name: allocation.facilityResourceName,
          facilityName: allocation.facilityName,
          occupancyBeforeMinutes: 0,
          occupancyAfterMinutes: 0,
        }));
        const dressingRoom = resolveEffectiveAllocation(
          overridesByKey,
          planOverrideKey("TOURNAMENT", tournament.id, "DRESSING_ROOM", participant.id),
          standardplanParticipantDressingRoom,
        );

        return {
          participantId: participant.id,
          participantLabel: participant.displayName,
          dressingRoomAllocations: dressingRoom.allocations,
          canonicalDressingRoomAllocations: standardplanParticipantDressingRoom,
          dressingRoomOverridden: dressingRoom.overridden,
        };
      }),
      conflicts: [],
    } satisfies WeekplannerTournamentItem;
  });
}

// ── Public API ────────────────────────────────────────────────────────────

/**
 * Assembles the full canonical Weekplanner week: TrainingSessions +
 * HOME matches + HOME tournaments, tenant-scoped, day-bucketed,
 * chronologically ordered, and annotated with resource-conflict
 * ("⚠ Doppelbelegung") indicators.
 *
 * WEEKPLANNER-01B: when `planId` is provided, every item's Spielfeld/Halle
 * and Garderobe allocations resolve to that WeekplannerPlan's EFFECTIVE
 * allocation (its own override, else the Standardplan default) — see the
 * module doc comment. Omitting `planId` (or passing a value that does not
 * resolve to any override rows for this tenant) is byte-for-byte identical
 * to WEEKPLANNER-01A: the Standardplan.
 */
export async function getWeekplannerWeek(
  tenantId: string,
  window: WeekplannerWindow,
  planId?: string,
): Promise<WeekplannerWeek> {
  const [resourceByCode, overridesByKey, timeOverridesByKey, baselineMode] = await Promise.all([
    findFacilityResourceCodeMap(tenantId),
    findWeekplannerPlanOverrides(tenantId, planId),
    findWeekplannerPlanTimeOverrides(tenantId, planId),
    resolveWeekplannerPlanBaselineMode(tenantId, planId),
  ]);

  const [trainingItems, matchItems, tournamentItems] = await Promise.all([
    findWeekplannerTrainingItems(tenantId, window.days, overridesByKey, timeOverridesByKey),
    findWeekplannerHomeMatches(tenantId, window.from, window.to, resourceByCode, overridesByKey, timeOverridesByKey),
    findWeekplannerHomeTournaments(tenantId, window.from, window.to, overridesByKey, timeOverridesByKey),
  ]);

  let items: WeekplannerItem[] = [...trainingItems, ...matchItems, ...tournamentItems];

  if (baselineMode === "empty") {
    const activitiesWithOverrides = collectActivitiesWithOverrides(overridesByKey, timeOverridesByKey);
    items = filterItemsForEmptyBaseline(items, activitiesWithOverrides);
  }

  return buildWeekplannerWeek({
    items,
    days: window.days,
    weekNumberLabel: formatWeekNumberLabel(window.days),
    rangeLabel: formatWeekRangeLabel(window.days),
    param: window.param,
    previousParam: window.previousParam,
    nextParam: window.nextParam,
  });
}

/**
 * DAYPLANNER-01A — Day Planning is explicitly NOT a second planning engine
 * (see product spec's "CORE ARCHITECTURAL RULE"): it is a ONE-DAY
 * operational projection of the exact same effective planning state
 * Weekplanner already resolves.
 *
 * This function therefore does not re-implement any query/resolution
 * logic — it narrows `getWeekplannerWeek()`'s window to a single day and
 * returns that one day's already fully-resolved bucket (canonical
 * TrainingSession/Match/Tournament items, layered with the SAME
 * WeekplannerPlan's resource + time overrides, conflict-annotated,
 * chronologically sorted). For the same tenant + activity + planId,
 * Weekplanner and Day Planning are therefore guaranteed byte-for-byte
 * identical on effective time/resources — there is no separate code path
 * that could drift.
 *
 * Bucketing (view-model.ts#buildWeekplannerWeek) buckets by each item's
 * EFFECTIVE start (plan override, if any, else canonical) — an activity
 * belongs to `window.date` according to its effective time under the
 * selected plan, not its canonical time. A time override can never move an
 * activity to a different Europe/Zurich calendar day in the first place
 * (see lib/weekplanner/plan-service.ts#requireSameCalendarDay), so
 * fetching each canonical source by its own canonical-day window (exactly
 * as Weekplanner does per day) can never miss an activity that only
 * "moved days" due to an override.
 */
export async function getWeekplannerDay(
  tenantId: string,
  window: WeekplannerDayWindow,
  planId?: string,
): Promise<WeekplannerDay> {
  const week = await getWeekplannerWeek(
    tenantId,
    {
      from: window.from,
      to: window.to,
      days: [window.date],
      param: window.param,
      previousParam: window.previousParam,
      nextParam: window.nextParam,
    },
    planId,
  );
  return week.days[0];
}
