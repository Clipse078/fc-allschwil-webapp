/**
 * lib/weekplanner/availability-integration.ts
 *
 * WOCHENPLAN-2.0-01H-E2 — weekplanner-aware availability conflict
 * integration for lib/facilities/availability-service.ts.
 *
 * Plan overrides replace canonical bookings for the same activity/group —
 * never double-count. Effective occupancy windows include before/after buffers.
 */

import { prisma } from "@/lib/db/prisma";
import type { WeekplannerActivityType, WeekplannerAllocationGroup } from "@prisma/client";
import {
  computeResourceOccupancyWindow,
  isMeaningfulEventInterval,
  resourceOccupancyWindowsOverlap,
} from "@/lib/facilities/resource-occupancy-window";
import { timeRangesOverlap } from "@/lib/facilities/allocation-rules";
import { classifyFacilityResourceType } from "@/lib/training/allocation-groups";
import { planOverrideKey } from "@/lib/weekplanner/plan-override-key";
import type { AvailabilityResourceGroup } from "@/lib/facilities/availability-service";

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

function activityKey(activityType: WeekplannerActivityType, activityId: string): string {
  return `${activityType}:${activityId}`;
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
    replaced.add(activityKey(row.activityType, row.activityId));
  }
  for (const row of timeOverrideRows) {
    replaced.add(activityKey(row.activityType, row.activityId));
  }
  return replaced;
}

async function resolveActivityLabel(
  tenantId: string,
  activityType: WeekplannerActivityType,
  activityId: string,
): Promise<string> {
  if (activityType === "TRAINING") {
    const session = await prisma.trainingSession.findFirst({
      where: { id: activityId, tenantId },
      select: { trainingSeries: { select: { title: true } } },
    });
    return session?.trainingSeries.title ?? "Training";
  }

  const event = await prisma.event.findFirst({
    where: { id: activityId, tenantId },
    select: { title: true, opponentName: true, type: true },
  });
  if (!event) return "Veranstaltung";
  if (event.type === "MATCH" && event.opponentName) return `vs. ${event.opponentName}`;
  return event.title;
}

async function resolveEffectiveActivityWindow(
  tenantId: string,
  weekplannerPlanId: string,
  activityType: WeekplannerActivityType,
  activityId: string,
): Promise<{ startAt: Date; endAt: Date } | null> {
  const timeOverride = await prisma.weekplannerPlanActivityOverride.findFirst({
    where: { tenantId, weekplannerPlanId, activityType, activityId },
    select: { overrideStartAt: true, overrideEndAt: true },
  });

  if (activityType === "TRAINING") {
    const session = await prisma.trainingSession.findFirst({
      where: { id: activityId, tenantId },
      select: { startAt: true, endAt: true },
    });
    if (!session) return null;
    const startAt = timeOverride?.overrideStartAt ?? session.startAt;
    const canonicalEnd = session.endAt;
    const endAt = timeOverride?.overrideEndAt ?? canonicalEnd;
    if (!isMeaningfulEventInterval(startAt, endAt)) return null;
    return { startAt, endAt };
  }

  const event = await prisma.event.findFirst({
    where: { id: activityId, tenantId, type: activityType },
    select: { startAt: true, endAt: true },
  });
  if (!event) return null;
  const startAt = timeOverride?.overrideStartAt ?? event.startAt;
  const canonicalEnd = event.endAt ?? event.startAt;
  const endAt = timeOverride?.overrideEndAt ?? canonicalEnd;
  if (!isMeaningfulEventInterval(startAt, endAt)) return null;
  return { startAt, endAt };
}

async function resolveCanonicalResourceIds(
  tenantId: string,
  activityType: WeekplannerActivityType,
  activityId: string,
  group: AvailabilityResourceGroup,
  resourcesByCode: Map<string, string>,
): Promise<string[]> {
  if (activityType === "TRAINING") {
    const session = await prisma.trainingSession.findFirst({
      where: { id: activityId, tenantId },
      select: {
        sessionAllocations: {
          select: { facilityResourceId: true, facilityResource: { select: { type: true } } },
        },
        trainingSeries: {
          select: {
            allocations: {
              select: { facilityResourceId: true, facilityResource: { select: { type: true } } },
            },
          },
        },
      },
    });
    if (!session) return [];

    const overridesForGroup = session.sessionAllocations.filter(
      (a) => classifyFacilityResourceType(a.facilityResource.type) === group,
    );
    const effective =
      overridesForGroup.length > 0 ? overridesForGroup : session.trainingSeries.allocations.filter(
        (a) => classifyFacilityResourceType(a.facilityResource.type) === group,
      );
    return effective.map((a) => a.facilityResourceId);
  }

  if (activityType === "MATCH") {
    const event = await prisma.event.findFirst({
      where: { id: activityId, tenantId, type: "MATCH" },
      select: { pitchCode: true, homeDressingRoomCode: true, awayDressingRoomCode: true },
    });
    if (!event) return [];
    const codes =
      group === "PITCH_HALL"
        ? [event.pitchCode]
        : [event.homeDressingRoomCode, event.awayDressingRoomCode];
    return codes
      .filter((code): code is string => Boolean(code))
      .map((code) => resourcesByCode.get(code))
      .filter((id): id is string => Boolean(id));
  }

  if (activityType === "TOURNAMENT" && group === "PITCH_HALL") {
    const rows = await prisma.tournamentResourceAllocation.findMany({
      where: { tenantId, eventId: activityId },
      select: { facilityResourceId: true },
    });
    return rows.map((r) => r.facilityResourceId);
  }

  if (activityType === "TOURNAMENT" && group === "DRESSING_ROOM") {
    const rows = await prisma.tournamentParticipantAllocation.findMany({
      where: { tenantId, tournamentParticipant: { eventId: activityId } },
      select: { facilityResourceId: true },
    });
    return rows.map((r) => r.facilityResourceId);
  }

  return [];
}

function pushConflict(
  conflicts: ConflictWindow[],
  conflict: ConflictWindow,
): void {
  conflicts.push(conflict);
}

/**
 * Collects weekplanner-sourced conflicts for one query occupancy window.
 * Scoped to the context plan only; excludes the activity being edited.
 */
export async function findWeekplannerPlanConflicts(
  tenantId: string,
  queryStartAt: Date,
  queryEndAt: Date,
  group: AvailabilityResourceGroup,
  context: WeekplannerAvailabilityContext,
  resourcesByCode: Map<string, string>,
): Promise<ConflictWindow[]> {
  const contextPlan = await prisma.weekplannerPlan.findFirst({
    where: { id: context.weekplannerPlanId, tenantId, archivedAt: null },
    select: { id: true },
  });
  if (!contextPlan) return [];

  const [allocations, timeOverrides] = await Promise.all([
    prisma.weekplannerPlanAllocation.findMany({
      where: {
        tenantId,
        weekplannerPlanId: context.weekplannerPlanId,
        allocationGroup: GROUP_TO_PLANNER_GROUP[group],
      },
      select: {
        activityType: true,
        activityId: true,
        facilityResourceId: true,
        occupancyBeforeMinutes: true,
        occupancyAfterMinutes: true,
      },
    }),
    prisma.weekplannerPlanActivityOverride.findMany({
      where: { tenantId, weekplannerPlanId: context.weekplannerPlanId },
      select: { activityType: true, activityId: true },
    }),
  ]);

  const conflicts: ConflictWindow[] = [];
  const labelCache = new Map<string, string>();
  const windowCache = new Map<string, { startAt: Date; endAt: Date } | null>();
  const activitiesWithAllocationOverride = new Set<string>();

  for (const row of allocations) {
    const key = activityKey(row.activityType, row.activityId);
    activitiesWithAllocationOverride.add(key);

    if (
      row.activityType === context.excludeActivityType &&
      row.activityId === context.excludeActivityId
    ) {
      continue;
    }

    const windowKey = `${row.activityType}:${row.activityId}`;
    if (!windowCache.has(windowKey)) {
      windowCache.set(
        windowKey,
        await resolveEffectiveActivityWindow(tenantId, context.weekplannerPlanId, row.activityType, row.activityId),
      );
    }
    const activityWindow = windowCache.get(windowKey);
    if (!activityWindow) continue;

    const occupancy = computeResourceOccupancyWindow(
      activityWindow.startAt,
      activityWindow.endAt,
      row.occupancyBeforeMinutes,
      row.occupancyAfterMinutes,
    );

    if (!overlapsQuery(queryStartAt, queryEndAt, occupancy.effectiveStartAt, occupancy.effectiveEndAt)) {
      continue;
    }

    let label = labelCache.get(key);
    if (!label) {
      label = await resolveActivityLabel(tenantId, row.activityType, row.activityId);
      labelCache.set(key, label);
    }

    pushConflict(conflicts, {
      resourceId: row.facilityResourceId,
      label,
      startAt: occupancy.effectiveStartAt,
      endAt: occupancy.effectiveEndAt,
      sourceType: row.activityType,
    });
  }

  for (const row of timeOverrides) {
    const key = activityKey(row.activityType, row.activityId);
    if (activitiesWithAllocationOverride.has(key)) continue;

    if (
      row.activityType === context.excludeActivityType &&
      row.activityId === context.excludeActivityId
    ) {
      continue;
    }

    const activityWindow = await resolveEffectiveActivityWindow(
      tenantId,
      context.weekplannerPlanId,
      row.activityType,
      row.activityId,
    );
    if (!activityWindow) continue;

    const resourceIds = await resolveCanonicalResourceIds(
      tenantId,
      row.activityType,
      row.activityId,
      group,
      resourcesByCode,
    );
    if (resourceIds.length === 0) continue;

    const occupancy = computeResourceOccupancyWindow(
      activityWindow.startAt,
      activityWindow.endAt,
      0,
      0,
    );

    if (!overlapsQuery(queryStartAt, queryEndAt, occupancy.effectiveStartAt, occupancy.effectiveEndAt)) {
      continue;
    }

    let label = labelCache.get(key);
    if (!label) {
      label = await resolveActivityLabel(tenantId, row.activityType, row.activityId);
      labelCache.set(key, label);
    }

    for (const resourceId of resourceIds) {
      pushConflict(conflicts, {
        resourceId,
        label,
        startAt: occupancy.effectiveStartAt,
        endAt: occupancy.effectiveEndAt,
        sourceType: row.activityType,
      });
    }
  }

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
