/**
 * lib/weekplanner/effective-plan-resolution.ts
 *
 * WOCHENPLAN-2.0-01H-E7 — shared effective-plan allocation/time resolution
 * primitives used by lib/weekplanner/queries.ts (week grid) and
 * lib/weekplanner/availability-integration.ts (editor occupancy).
 *
 * Canonical activity + plan-specific override = ONE effective activity.
 * Plan overrides replace canonical state — never double-count.
 */

import { planOverrideKey, planTimeOverrideKey } from "./plan-override-key";
import type { WeekplannerAllocationGroup, WeekplannerItemType, WeekplannerResourceRef } from "./types";

export type TimeOverrideEntry = {
  overrideStartAt: Date | null;
  overrideEndAt: Date | null;
};

export function resolveEffectiveAllocation(
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

export function resolveEffectiveTime(
  timeOverridesByKey: ReadonlyMap<string, TimeOverrideEntry>,
  key: string,
  canonicalStartAt: Date,
  canonicalEndAt: Date,
): { startAt: Date; endAt: Date; overridden: boolean } {
  const override = timeOverridesByKey.get(key);
  const startAt = override?.overrideStartAt ?? canonicalStartAt;
  const endAt = override?.overrideEndAt ?? canonicalEndAt;
  const overridden = Boolean(override?.overrideStartAt || override?.overrideEndAt);
  return { startAt, endAt, overridden };
}

export function collectActivitiesWithOverrides(
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

export function activityIdentityKey(activityType: WeekplannerItemType, activityId: string): string {
  return `${activityType}:${activityId}`;
}

/**
 * TRAININGCENTER-02 canonical occurrence time — session-level override wins
 * when present, matching lib/facilities/availability-service.ts#findTrainingConflicts
 * and listTrainingSessions toDto().
 */
export function resolveCanonicalTrainingSessionTime(session: {
  startAt: Date;
  endAt: Date;
  overrideStartAt?: Date | null;
  overrideEndAt?: Date | null;
}): { startAt: Date; endAt: Date } {
  return {
    startAt: session.overrideStartAt ?? session.startAt,
    endAt: session.overrideEndAt ?? session.endAt,
  };
}

export function allocationGroupKey(
  activityType: WeekplannerItemType,
  activityId: string,
  allocationGroup: WeekplannerAllocationGroup,
  participantId = "",
): string {
  return planOverrideKey(activityType, activityId, allocationGroup, participantId);
}

export function timeKey(activityType: WeekplannerItemType, activityId: string): string {
  return planTimeOverrideKey(activityType, activityId);
}
