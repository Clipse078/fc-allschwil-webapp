/**
 * lib/weekplanner/availability-integration.ts
 *
 * WOCHENPLAN-2.0-01H-E2/E7 — weekplanner-aware availability conflict
 * integration for lib/facilities/availability-service.ts.
 *
 * Plan overrides replace canonical bookings for the same activity/group —
 * never double-count. Effective occupancy windows include before/after buffers.
 *
 * E7: findWeekplannerPlanConflicts resolves the SAME effective plan state as
 * lib/weekplanner/queries.ts + detectWeekplannerConflicts — including canonical
 * fallback allocations when no plan override row exists.
 */

import { prisma } from "@/lib/db/prisma";
import type { WeekplannerActivityType, WeekplannerAllocationGroup } from "@prisma/client";
import {
  computeResourceOccupancyWindow,
  isMeaningfulEventInterval,
  resourceOccupancyWindowsOverlap,
} from "@/lib/facilities/resource-occupancy-window";
import { timeRangesOverlap } from "@/lib/facilities/allocation-rules";
import {
  resolveTrainingOccurrenceAllocations,
  type TrainingAllocationResourceRow,
} from "@/lib/training/effective-training-allocation-resolution";
import { getWochenplanPlanBaselineMode } from "@/lib/wochenplan/plan-baseline";
import {
  listMatchcenterMatches,
  type MatchcenterQueryDatabase,
} from "@/lib/matchcenter/query-service";
import { listTournaments } from "@/lib/tournaments/tournament-service";
import { planOverrideKey } from "@/lib/weekplanner/plan-override-key";
import type { AvailabilityResourceGroup } from "@/lib/facilities/availability-service";
import {
  activityIdentityKey,
  collectActivitiesWithOverrides,
  resolveCanonicalTrainingSessionTime,
  resolveEffectiveAllocation,
  resolveEffectiveTime,
  type TimeOverrideEntry,
} from "@/lib/weekplanner/effective-plan-resolution";
import type { WeekplannerResourceRef } from "@/lib/weekplanner/types";

export type WeekplannerAvailabilityContext = {
  weekplannerPlanId: string;
  excludeActivityType?: WeekplannerActivityType;
  excludeActivityId?: string;
};

type ConflictWindow = {
  resourceId: string;
  label: string;
  startAt: Date;
  endAt: Date;
  sourceType: "TRAINING" | "MATCH" | "TOURNAMENT";
};

const GROUP_TO_PLANNER_GROUP: Record<AvailabilityResourceGroup, WeekplannerAllocationGroup> = {
  PITCH_HALL: "PITCH_HALL",
  DRESSING_ROOM: "DRESSING_ROOM",
};

function overlapsQuery(
  queryStartAt: Date,
  queryEndAt: Date,
  occupancyStartAt: Date,
  occupancyEndAt: Date,
): boolean {
  return resourceOccupancyWindowsOverlap(
    { effectiveStartAt: queryStartAt, effectiveEndAt: queryEndAt },
    { effectiveStartAt: occupancyStartAt, effectiveEndAt: occupancyEndAt },
  );
}

function toResourceRef(
  row: {
    id: string;
    code: string;
    name: string;
    facility: { name: string };
  },
  occupancy: { occupancyBeforeMinutes: number; occupancyAfterMinutes: number },
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

function isCancelled(status: string): boolean {
  const normalized = status.trim().toUpperCase();
  return normalized === "CANCELLED" || normalized === "CANCELED";
}

function isAwayHomeAway(value: string | null): boolean {
  return value?.trim().toUpperCase() === "AWAY";
}

function pushConflict(conflicts: ConflictWindow[], conflict: ConflictWindow): void {
  conflicts.push(conflict);
}

function shouldSkipActivity(
  activityType: WeekplannerActivityType,
  activityId: string,
  context: WeekplannerAvailabilityContext,
): boolean {
  return activityType === context.excludeActivityType && activityId === context.excludeActivityId;
}

function pushAllocationConflicts(
  conflicts: ConflictWindow[],
  allocations: WeekplannerResourceRef[],
  activityWindow: { startAt: Date; endAt: Date },
  label: string,
  sourceType: ConflictWindow["sourceType"],
  queryStartAt: Date,
  queryEndAt: Date,
): void {
  for (const allocation of allocations) {
    const occupancy = computeResourceOccupancyWindow(
      activityWindow.startAt,
      activityWindow.endAt,
      allocation.occupancyBeforeMinutes,
      allocation.occupancyAfterMinutes,
    );
    if (!overlapsQuery(queryStartAt, queryEndAt, occupancy.effectiveStartAt, occupancy.effectiveEndAt)) {
      continue;
    }
    pushConflict(conflicts, {
      resourceId: allocation.facilityResourceId,
      label,
      startAt: occupancy.effectiveStartAt,
      endAt: occupancy.effectiveEndAt,
      sourceType,
    });
  }
}

type AllocationResourceRow = TrainingAllocationResourceRow & {
  occupancyBeforeMinutes?: number;
  occupancyAfterMinutes?: number;
};

function toOccurrenceResourceRefs(
  rows: readonly AllocationResourceRow[],
): WeekplannerResourceRef[] {
  return rows.map((row) =>
    toResourceRef(row.facilityResource, {
      occupancyBeforeMinutes: row.occupancyBeforeMinutes ?? 0,
      occupancyAfterMinutes: row.occupancyAfterMinutes ?? 0,
    }),
  );
}

async function buildPlanOverrideMaps(
  tenantId: string,
  weekplannerPlanId: string,
): Promise<{
  overridesByKey: Map<string, WeekplannerResourceRef[]>;
  timeOverridesByKey: Map<string, TimeOverrideEntry>;
}> {
  const overridesByKey = new Map<string, WeekplannerResourceRef[]>();
  const timeOverridesByKey = new Map<string, TimeOverrideEntry>();

  const [allocationRows, timeRows] = await Promise.all([
    prisma.weekplannerPlanAllocation.findMany({
      where: { tenantId, weekplannerPlanId },
      select: {
        activityType: true,
        activityId: true,
        allocationGroup: true,
        participantId: true,
        occupancyBeforeMinutes: true,
        occupancyAfterMinutes: true,
        facilityResource: {
          select: { id: true, code: true, name: true, type: true, facility: { select: { name: true } } },
        },
      },
      orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
    }),
    prisma.weekplannerPlanActivityOverride.findMany({
      where: { tenantId, weekplannerPlanId },
      select: { activityType: true, activityId: true, overrideStartAt: true, overrideEndAt: true },
    }),
  ]);

  for (const row of allocationRows) {
    const key = planOverrideKey(
      row.activityType,
      row.activityId,
      row.allocationGroup,
      row.participantId,
    );
    const list = overridesByKey.get(key) ?? [];
    list.push(
      toResourceRef(row.facilityResource, {
        occupancyBeforeMinutes: row.occupancyBeforeMinutes,
        occupancyAfterMinutes: row.occupancyAfterMinutes,
      }),
    );
    overridesByKey.set(key, list);
  }

  for (const row of timeRows) {
    timeOverridesByKey.set(`${row.activityType}:${row.activityId}`, {
      overrideStartAt: row.overrideStartAt,
      overrideEndAt: row.overrideEndAt,
    });
  }

  return { overridesByKey, timeOverridesByKey };
}

async function resolvePlanBaselineMode(
  tenantId: string,
  weekplannerPlanId: string,
): Promise<"canonical" | "empty"> {
  const row = await prisma.weekplannerPlan.findFirst({
    where: { id: weekplannerPlanId, tenantId, archivedAt: null },
    select: { wochenplanPlanId: true },
  });
  if (!row?.wochenplanPlanId) return "canonical";

  const definition = await prisma.wochenplanPlan.findFirst({
    where: { id: row.wochenplanPlanId, tenantId },
    select: { description: true },
  });
  return getWochenplanPlanBaselineMode(definition?.description);
}

async function collectTrainingOccupants(
  tenantId: string,
  queryStartAt: Date,
  queryEndAt: Date,
  group: AvailabilityResourceGroup,
  context: WeekplannerAvailabilityContext,
  overridesByKey: ReadonlyMap<string, WeekplannerResourceRef[]>,
  timeOverridesByKey: ReadonlyMap<string, TimeOverrideEntry>,
  activitiesWithOverrides: ReadonlySet<string>,
  baselineMode: "canonical" | "empty",
  conflicts: ConflictWindow[],
): Promise<void> {
  const sessions = await prisma.trainingSession.findMany({
    where: {
      tenantId,
      status: "SCHEDULED",
      OR: [
        { overrideStartAt: null, startAt: { lt: queryEndAt }, endAt: { gt: queryStartAt } },
        {
          AND: [{ overrideStartAt: { not: null, lt: queryEndAt } }, { overrideEndAt: { gt: queryStartAt } }],
        },
      ],
    },
    select: {
      id: true,
      weekday: true,
      startAt: true,
      endAt: true,
      overrideStartAt: true,
      overrideEndAt: true,
      trainingSeriesId: true,
      trainingSeries: { select: { title: true } },
    },
  });

  if (sessions.length === 0) return;

  const seriesIds = [...new Set(sessions.map((session) => session.trainingSeriesId))];
  const sessionIds = sessions.map((session) => session.id);

  const [seriesAllocationRows, sessionOverrideRows] = await Promise.all([
    prisma.trainingAllocation.findMany({
      where: { tenantId, trainingSeriesId: { in: seriesIds } },
      select: {
        trainingSeriesId: true,
        displayOrder: true,
        createdAt: true,
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
        facilityResource: {
          select: { id: true, code: true, name: true, type: true, facility: { select: { name: true } } },
        },
      },
      orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
    }),
  ]);

  const seriesAllocMap = new Map<string, AllocationResourceRow[]>();
  for (const row of seriesAllocationRows) {
    const list = seriesAllocMap.get(row.trainingSeriesId) ?? [];
    list.push({
      displayOrder: row.displayOrder,
      createdAt: row.createdAt,
      facilityResource: row.facilityResource,
    });
    seriesAllocMap.set(row.trainingSeriesId, list);
  }

  const sessionAllocMap = new Map<string, AllocationResourceRow[]>();
  for (const row of sessionOverrideRows) {
    const list = sessionAllocMap.get(row.trainingSessionId) ?? [];
    list.push({
      displayOrder: row.displayOrder,
      createdAt: row.createdAt,
      facilityResource: row.facilityResource,
    });
    sessionAllocMap.set(row.trainingSessionId, list);
  }

  for (const session of sessions) {
    if (shouldSkipActivity("TRAINING", session.id, context)) continue;

    const identity = activityIdentityKey("TRAINING", session.id);
    if (baselineMode === "empty" && !activitiesWithOverrides.has(identity)) continue;

    const seriesRows = seriesAllocMap.get(session.trainingSeriesId) ?? [];
    const overrideRows = sessionAllocMap.get(session.id) ?? [];
    const occurrenceAllocations = resolveTrainingOccurrenceAllocations({
      seriesRows,
      sessionOverrideRows: overrideRows,
    });
    const standardplanPitch = toOccurrenceResourceRefs(occurrenceAllocations.pitch);
    const standardplanDressingRoom = toOccurrenceResourceRefs(occurrenceAllocations.dressingRoom);

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

    const canonicalTime = resolveCanonicalTrainingSessionTime(session);
    const time = resolveEffectiveTime(
      timeOverridesByKey,
      activityIdentityKey("TRAINING", session.id),
      canonicalTime.startAt,
      canonicalTime.endAt,
    );
    if (!isMeaningfulEventInterval(time.startAt, time.endAt)) continue;

    const allocations = group === "PITCH_HALL" ? pitch.allocations : dressingRoom.allocations;
    if (allocations.length === 0) continue;

    pushAllocationConflicts(
      conflicts,
      allocations,
      { startAt: time.startAt, endAt: time.endAt },
      session.trainingSeries.title,
      "TRAINING",
      queryStartAt,
      queryEndAt,
    );
  }
}

async function collectMatchOccupants(
  tenantId: string,
  queryStartAt: Date,
  queryEndAt: Date,
  group: AvailabilityResourceGroup,
  context: WeekplannerAvailabilityContext,
  overridesByKey: ReadonlyMap<string, WeekplannerResourceRef[]>,
  timeOverridesByKey: ReadonlyMap<string, TimeOverrideEntry>,
  activitiesWithOverrides: ReadonlySet<string>,
  baselineMode: "canonical" | "empty",
  resourceByCode: ReadonlyMap<string, WeekplannerResourceRef>,
  conflicts: ConflictWindow[],
): Promise<void> {
  const database = prisma as unknown as MatchcenterQueryDatabase;
  const matches = await listMatchcenterMatches(database, { tenantId, from: queryStartAt, to: queryEndAt });

  for (const match of matches) {
    if (isAwayHomeAway(match.homeAway) || isCancelled(match.status)) continue;
    if (shouldSkipActivity("MATCH", match.id, context)) continue;

    const identity = activityIdentityKey("MATCH", match.id);
    if (baselineMode === "empty" && !activitiesWithOverrides.has(identity)) continue;

    const pitchRef = match.operational.pitchCode
      ? resourceByCode.get(match.operational.pitchCode)
      : undefined;
    const homeRoomRef = match.operational.homeDressingRoomCode
      ? resourceByCode.get(match.operational.homeDressingRoomCode)
      : undefined;
    const awayRoomRef = match.operational.awayDressingRoomCode
      ? resourceByCode.get(match.operational.awayDressingRoomCode)
      : undefined;

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
      activityIdentityKey("MATCH", match.id),
      canonicalStartAt,
      canonicalEndAt,
    );
    if (!isMeaningfulEventInterval(time.startAt, time.endAt)) continue;

    const label = match.away.displayName ? `vs. ${match.away.displayName}` : match.title;
    const activityWindow = { startAt: time.startAt, endAt: time.endAt };

    if (group === "PITCH_HALL") {
      if (pitch.allocations.length === 0) continue;
      pushAllocationConflicts(
        conflicts,
        pitch.allocations,
        activityWindow,
        label,
        "MATCH",
        queryStartAt,
        queryEndAt,
      );
      continue;
    }

    if (dressingRoom.allocations.length > 0) {
      pushAllocationConflicts(
        conflicts,
        dressingRoom.allocations,
        activityWindow,
        label,
        "MATCH",
        queryStartAt,
        queryEndAt,
      );
    }
    if (awayRoomRef) {
      pushAllocationConflicts(
        conflicts,
        [awayRoomRef],
        activityWindow,
        label,
        "MATCH",
        queryStartAt,
        queryEndAt,
      );
    }
  }
}

async function collectTournamentOccupants(
  tenantId: string,
  queryStartAt: Date,
  queryEndAt: Date,
  group: AvailabilityResourceGroup,
  context: WeekplannerAvailabilityContext,
  overridesByKey: ReadonlyMap<string, WeekplannerResourceRef[]>,
  timeOverridesByKey: ReadonlyMap<string, TimeOverrideEntry>,
  activitiesWithOverrides: ReadonlySet<string>,
  baselineMode: "canonical" | "empty",
  conflicts: ConflictWindow[],
): Promise<void> {
  const tournaments = await listTournaments(tenantId);

  for (const tournament of tournaments) {
    if (tournament.homeAway !== "HOME" || isCancelled(tournament.status)) continue;
    if (shouldSkipActivity("TOURNAMENT", tournament.id, context)) continue;

    const identity = activityIdentityKey("TOURNAMENT", tournament.id);
    if (baselineMode === "empty" && !activitiesWithOverrides.has(identity)) continue;

    const canonicalStartAt = new Date(tournament.startAt);
    const canonicalEndAt = tournament.endAt ? new Date(tournament.endAt) : canonicalStartAt;
    const time = resolveEffectiveTime(
      timeOverridesByKey,
      activityIdentityKey("TOURNAMENT", tournament.id),
      canonicalStartAt,
      canonicalEndAt,
    );
    if (!isMeaningfulEventInterval(time.startAt, time.endAt)) continue;
    if (!timeRangesOverlap({ startA: queryStartAt, endA: queryEndAt, startB: time.startAt, endB: time.endAt })) {
      continue;
    }

    if (group === "PITCH_HALL") {
      const standardplanPitch: WeekplannerResourceRef[] = tournament.resourceAllocations.map((allocation) => ({
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

      pushAllocationConflicts(
        conflicts,
        pitch.allocations,
        { startAt: time.startAt, endAt: time.endAt },
        tournament.title,
        "TOURNAMENT",
        queryStartAt,
        queryEndAt,
      );
      continue;
    }

    for (const participant of tournament.participants) {
      const standardplanParticipantDressingRoom: WeekplannerResourceRef[] =
        participant.dressingRoomAllocations.map((allocation) => ({
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

      pushAllocationConflicts(
        conflicts,
        dressingRoom.allocations,
        { startAt: time.startAt, endAt: time.endAt },
        `${participant.displayName} · ${tournament.title}`,
        "TOURNAMENT",
        queryStartAt,
        queryEndAt,
      );
    }
  }
}

/**
 * Activities whose canonical booking is replaced by overrides in the context plan
 * for this group — allocation overrides OR time overrides.
 */
export async function findWeekplannerReplacedActivities(
  tenantId: string,
  weekplannerPlanId: string,
  group: AvailabilityResourceGroup,
): Promise<Set<string>> {
  const [allocationRows, timeOverrideRows] = await Promise.all([
    prisma.weekplannerPlanAllocation.findMany({
      where: {
        tenantId,
        weekplannerPlanId,
        allocationGroup: GROUP_TO_PLANNER_GROUP[group],
      },
      select: { activityType: true, activityId: true },
      distinct: ["activityType", "activityId"],
    }),
    prisma.weekplannerPlanActivityOverride.findMany({
      where: { tenantId, weekplannerPlanId },
      select: { activityType: true, activityId: true },
    }),
  ]);

  const replaced = new Set<string>();
  for (const row of allocationRows) {
    replaced.add(activityIdentityKey(row.activityType, row.activityId));
  }
  for (const row of timeOverrideRows) {
    replaced.add(activityIdentityKey(row.activityType, row.activityId));
  }
  return replaced;
}

/**
 * Collects effective-plan occupancy conflicts for one query window.
 * Mirrors lib/weekplanner/queries.ts effective resolution + view-model conflict semantics.
 */
export async function findWeekplannerPlanConflicts(
  tenantId: string,
  queryStartAt: Date,
  queryEndAt: Date,
  group: AvailabilityResourceGroup,
  context: WeekplannerAvailabilityContext,
  resourceByCode: ReadonlyMap<string, WeekplannerResourceRef>,
): Promise<ConflictWindow[]> {
  const contextPlan = await prisma.weekplannerPlan.findFirst({
    where: { id: context.weekplannerPlanId, tenantId, archivedAt: null },
    select: { id: true },
  });
  if (!contextPlan) return [];

  const [{ overridesByKey, timeOverridesByKey }, baselineMode] = await Promise.all([
    buildPlanOverrideMaps(tenantId, context.weekplannerPlanId),
    resolvePlanBaselineMode(tenantId, context.weekplannerPlanId),
  ]);

  const activitiesWithOverrides = collectActivitiesWithOverrides(overridesByKey, timeOverridesByKey);
  const conflicts: ConflictWindow[] = [];

  await Promise.all([
    collectTrainingOccupants(
      tenantId,
      queryStartAt,
      queryEndAt,
      group,
      context,
      overridesByKey,
      timeOverridesByKey,
      activitiesWithOverrides,
      baselineMode,
      conflicts,
    ),
    collectMatchOccupants(
      tenantId,
      queryStartAt,
      queryEndAt,
      group,
      context,
      overridesByKey,
      timeOverridesByKey,
      activitiesWithOverrides,
      baselineMode,
      resourceByCode,
      conflicts,
    ),
    collectTournamentOccupants(
      tenantId,
      queryStartAt,
      queryEndAt,
      group,
      context,
      overridesByKey,
      timeOverridesByKey,
      activitiesWithOverrides,
      baselineMode,
      conflicts,
    ),
  ]);

  return conflicts;
}

/** Returns whether a canonical training session should be excluded for this group. */
export function shouldExcludeCanonicalTraining(
  sessionId: string,
  replacedActivities: ReadonlySet<string>,
): boolean {
  return replacedActivities.has(`TRAINING:${sessionId}`);
}

/** Returns whether a canonical match/tournament event should be excluded for this group. */
export function shouldExcludeCanonicalEvent(
  eventId: string,
  eventType: "MATCH" | "TOURNAMENT",
  replacedActivities: ReadonlySet<string>,
): boolean {
  return replacedActivities.has(`${eventType}:${eventId}`);
}

/** Half-open overlap helper for canonical event windows (no occupancy buffers). */
export function canonicalEventOverlapsQuery(
  queryStartAt: Date,
  queryEndAt: Date,
  eventStartAt: Date,
  eventEndAt: Date,
): boolean {
  if (!isMeaningfulEventInterval(eventStartAt, eventEndAt)) return false;
  return timeRangesOverlap({
    startA: queryStartAt,
    endA: queryEndAt,
    startB: eventStartAt,
    endB: eventEndAt,
  });
}

export { planOverrideKey };
