/**
 * lib/weekplanner/view-model.ts
 *
 * WEEKPLANNER-01A — pure aggregation over an already tenant-scoped,
 * already-filtered flat list of canonical WeekplannerItems: day-bucketing,
 * chronological ordering, and resource-conflict ("⚠ Doppelbelegung")
 * detection.
 *
 * WOCHENPLAN-2.0-01H-E2 — conflict detection uses effective resource
 * occupancy windows (event time + before/after buffers) via the shared
 * primitive in lib/facilities/resource-occupancy-window.ts.
 *
 * Reuses the existing canonical overlap primitive
 * (lib/facilities/allocation-rules.ts#timeRangesOverlap) — the same one
 * already used by the live resource-availability aggregator
 * (lib/facilities/availability-service.ts) and by TrainingCenter/
 * MatchCenter/TournamentCenter guided-creation flows. Weekplanner does NOT
 * introduce a second conflict engine; it only applies that same primitive
 * pairwise across the week's own already-fetched canonical items.
 *
 * Pure, synchronous, no I/O.
 */

import { computeResourceOccupancyWindow, resourceOccupancyWindowsOverlap } from "@/lib/facilities/resource-occupancy-window";
import { zonedDateKey, WEEKPLANNER_DEFAULT_TIMEZONE } from "./date";
import type {
  WeekplannerConflict,
  WeekplannerDay,
  WeekplannerItem,
  WeekplannerResourceRef,
  WeekplannerWeek,
} from "./types";

type OccupiedResource = WeekplannerResourceRef & {
  effectiveStartAt: Date;
  effectiveEndAt: Date;
};

/** Every FacilityResource this item claims to occupy, with derived occupancy windows. */
function collectOccupiedResources(item: WeekplannerItem): OccupiedResource[] {
  const refs: WeekplannerResourceRef[] = [...item.pitchAllocations, ...item.dressingRoomAllocations];

  if (item.type === "MATCH") {
    refs.push(...item.awayDressingRoomAllocations);
  }

  if (item.type === "TOURNAMENT") {
    for (const participant of item.participantAllocations) {
      refs.push(...participant.dressingRoomAllocations);
    }
  }

  return refs.map((ref) => {
    const window = computeResourceOccupancyWindow(
      item.startAt,
      item.endAt,
      ref.occupancyBeforeMinutes,
      ref.occupancyAfterMinutes,
    );
    return {
      ...ref,
      effectiveStartAt: window.effectiveStartAt,
      effectiveEndAt: window.effectiveEndAt,
    };
  });
}

/**
 * Annotates every item with the FacilityResources it shares an overlapping
 * effective occupancy window with, across every OTHER item in `items` (any
 * type, any day) — a genuine double-booking is exactly two canonical items
 * claiming the same FacilityResource for overlapping occupancy windows.
 *
 * Returns a new array; input items are never mutated.
 */
export function detectWeekplannerConflicts(
  items: readonly WeekplannerItem[],
): WeekplannerItem[] {
  const conflictsById = new Map<string, Map<string, WeekplannerConflict>>();

  const withResources = items.map((item) => ({
    item,
    resources: collectOccupiedResources(item),
  }));

  for (let i = 0; i < withResources.length; i += 1) {
    for (let j = i + 1; j < withResources.length; j += 1) {
      const a = withResources[i];
      const b = withResources[j];
      if (a.item.id === b.item.id) continue;

      for (const resourceA of a.resources) {
        const shared = b.resources.find(
          (resourceB) => resourceB.facilityResourceId === resourceA.facilityResourceId,
        );
        if (!shared) continue;

        const overlaps = resourceOccupancyWindowsOverlap(resourceA, shared);
        if (!overlaps) continue;

        const conflict: WeekplannerConflict = {
          facilityResourceId: shared.facilityResourceId,
          facilityResourceName: shared.name,
        };

        const aMap = conflictsById.get(a.item.id) ?? new Map();
        aMap.set(conflict.facilityResourceId, conflict);
        conflictsById.set(a.item.id, aMap);

        const bMap = conflictsById.get(b.item.id) ?? new Map();
        bMap.set(conflict.facilityResourceId, conflict);
        conflictsById.set(b.item.id, bMap);
      }
    }
  }

  return items.map((item) => {
    const conflicts = conflictsById.get(item.id);
    return conflicts ? { ...item, conflicts: [...conflicts.values()] } : item;
  });
}

function compareItems(a: WeekplannerItem, b: WeekplannerItem): number {
  const startDiff = a.startAt.getTime() - b.startAt.getTime();
  if (startDiff !== 0) return startDiff;
  return a.title.localeCompare(b.title, "de-CH");
}

/**
 * Builds the full Weekplanner week: buckets `items` into their Europe/Zurich
 * calendar day (one bucket per entry in `days`, always in that order, even
 * when empty), sorts each day chronologically, and annotates conflicts.
 *
 * `items` must already be tenant-scoped and HOME-filtered by the caller
 * (lib/weekplanner/queries.ts) — this function performs no authorization or
 * tenant filtering of its own.
 */
export function buildWeekplannerWeek(input: {
  items: readonly WeekplannerItem[];
  days: readonly string[];
  weekNumberLabel: string;
  rangeLabel: string;
  param: string;
  previousParam: string;
  nextParam: string;
  timeZone?: string;
}): WeekplannerWeek {
  const timeZone = input.timeZone ?? WEEKPLANNER_DEFAULT_TIMEZONE;
  const annotated = detectWeekplannerConflicts(input.items);

  const byDay = new Map<string, WeekplannerItem[]>();
  for (const item of annotated) {
    const dayKey = zonedDateKey(item.startAt, timeZone);
    const bucket = byDay.get(dayKey) ?? [];
    bucket.push(item);
    byDay.set(dayKey, bucket);
  }

  const days: WeekplannerDay[] = input.days.map((dayKey) => ({
    dayKey,
    items: (byDay.get(dayKey) ?? []).sort(compareItems),
  }));

  return {
    days,
    weekNumberLabel: input.weekNumberLabel,
    rangeLabel: input.rangeLabel,
    param: input.param,
    previousParam: input.previousParam,
    nextParam: input.nextParam,
  };
}
