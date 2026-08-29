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
import { computeResourceOccupancyWindow, resourceOccupancyWindowsOverlap } from "@/lib/facilities/resource-occupancy-window";
import { timeRangesOverlap } from "@/lib/facilities/allocation-rules";
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

/** Activities whose canonical booking is replaced by overrides in the context plan for this group. */
export async function findWeekplannerReplacedActivities(
  tenantId: string,
  weekplannerPlanId: string,
  group: AvailabilityResourceGroup,
): Promise<Set<string>> {
  const rows = await prisma.weekplannerPlanAllocation.findMany({
    where: {
      tenantId,
      weekplannerPlanId,
      allocationGroup: GROUP_TO_PLANNER_GROUP[group],
    },
    select: { activityType: true, activityId: true },
    distinct: ["activityType", "activityId"],
  });

  return new Set(rows.map((row) => `${row.activityType}:${row.activityId}`));
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
    return {
      startAt: timeOverride?.overrideStartAt ?? session.startAt,
      endAt: timeOverride?.overrideEndAt ?? session.endAt,
    };
  }

  const event = await prisma.event.findFirst({
    where: { id: activityId, tenantId, type: activityType },
    select: { startAt: true, endAt: true },
  });
  if (!event) return null;
  const endAt = event.endAt ?? event.startAt;
  return {
    startAt: timeOverride?.overrideStartAt ?? event.startAt,
    endAt: timeOverride?.overrideEndAt ?? endAt,
  };
}

/**
 * Collects weekplanner-sourced conflicts for one query occupancy window.
 * Scoped to the context plan's week; excludes the activity being edited.
 */
export async function findWeekplannerPlanConflicts(
  tenantId: string,
  queryStartAt: Date,
  queryEndAt: Date,
  group: AvailabilityResourceGroup,
  context: WeekplannerAvailabilityContext,
): Promise<ConflictWindow[]> {
  const contextPlan = await prisma.weekplannerPlan.findFirst({
    where: { id: context.weekplannerPlanId, tenantId, archivedAt: null },
    select: { id: true, weekId: true },
  });
  if (!contextPlan) return [];

  const allocations = await prisma.weekplannerPlanAllocation.findMany({
    where: {
      tenantId,
      allocationGroup: GROUP_TO_PLANNER_GROUP[group],
      weekplannerPlan: { weekId: contextPlan.weekId, archivedAt: null },
    },
    select: {
      weekplannerPlanId: true,
      activityType: true,
      activityId: true,
      facilityResourceId: true,
      occupancyBeforeMinutes: true,
      occupancyAfterMinutes: true,
    },
  });

  const conflicts: ConflictWindow[] = [];
  const labelCache = new Map<string, string>();
  const windowCache = new Map<string, { startAt: Date; endAt: Date } | null>();

  for (const row of allocations) {
    if (
      row.weekplannerPlanId === context.weekplannerPlanId &&
      row.activityType === context.excludeActivityType &&
      row.activityId === context.excludeActivityId
    ) {
      continue;
    }

    const windowKey = `${row.weekplannerPlanId}:${row.activityType}:${row.activityId}`;
    if (!windowCache.has(windowKey)) {
      const resolved = await resolveEffectiveActivityWindow(
        tenantId,
        row.weekplannerPlanId,
        row.activityType,
        row.activityId,
      );
      windowCache.set(windowKey, resolved);
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

    const labelKey = `${row.activityType}:${row.activityId}`;
    let label = labelCache.get(labelKey);
    if (!label) {
      label = await resolveActivityLabel(tenantId, row.activityType, row.activityId);
      labelCache.set(labelKey, label);
    }

    conflicts.push({
      resourceId: row.facilityResourceId,
      label,
      startAt: occupancy.effectiveStartAt,
      endAt: occupancy.effectiveEndAt,
      sourceType: row.activityType,
    });
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
  return timeRangesOverlap({
    startA: queryStartAt,
    endA: queryEndAt,
    startB: eventStartAt,
    endB: eventEndAt,
  });
}

export { planOverrideKey };
