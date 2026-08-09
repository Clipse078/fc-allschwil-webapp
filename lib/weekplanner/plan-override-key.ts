/**
 * lib/weekplanner/plan-override-key.ts
 *
 * WEEKPLANNER-01B — the single canonical key format identifying one
 * (activityType, activityId, allocationGroup[, participantId]) override
 * target. Used by lib/weekplanner/queries.ts (server-side resolution) AND
 * by components/admin/planner/WeekPlannerPage.tsx (server component —
 * looking up which override editor to render for a given item/group) so
 * both sides can never drift out of sync.
 *
 * Pure, synchronous, no I/O — safe to import from any layer.
 */

import type { WeekplannerAllocationGroup, WeekplannerItemType } from "./types";

export function planOverrideKey(
  activityType: WeekplannerItemType,
  activityId: string,
  allocationGroup: WeekplannerAllocationGroup,
  participantId: string = "",
): string {
  return `${activityType}:${activityId}:${allocationGroup}:${participantId}`;
}

/**
 * WEEKPLANNER-01D — the key format identifying one (activityType,
 * activityId) time-override target — one row per canonical activity per
 * plan, so unlike planOverrideKey() above it has no allocationGroup/
 * participantId dimension.
 */
export function planTimeOverrideKey(activityType: WeekplannerItemType, activityId: string): string {
  return `${activityType}:${activityId}`;
}
