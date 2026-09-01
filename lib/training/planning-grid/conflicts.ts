/**
 * lib/training/planning-grid/conflicts.ts
 *
 * Pairwise resource conflict detection for the planning grid — reuses the
 * same overlap primitive as lib/weekplanner/view-model.ts and
 * lib/facilities/availability-service.ts.
 */

import { timeRangesOverlap } from "@/lib/facilities/allocation-rules";
import type { ResourceConflict, ResourceConflictType, ScheduledActivityBlock } from "./types";

export type ConflictOccupancy = {
  sessionId: string;
  teamName: string;
  trainingSeriesTitle: string;
  resourceId: string;
  resourceName: string;
  startAt: string;
  endAt: string;
};

function conflictId(resourceId: string, startAt: string, endAt: string, sessionIds: string[]): string {
  return `${resourceId}:${startAt}:${endAt}:${sessionIds.sort().join(",")}`;
}

/**
 * Detects direct resource double-bookings among training activities on the
 * same FacilityResource for overlapping time windows.
 */
export function detectResourceConflicts(occupancies: readonly ConflictOccupancy[]): ResourceConflict[] {
  const byResource = new Map<string, ConflictOccupancy[]>();
  for (const item of occupancies) {
    const list = byResource.get(item.resourceId) ?? [];
    list.push(item);
    byResource.set(item.resourceId, list);
  }

  const conflicts: ResourceConflict[] = [];
  const seen = new Set<string>();

  for (const [, items] of byResource) {
    for (let i = 0; i < items.length; i += 1) {
      for (let j = i + 1; j < items.length; j += 1) {
        const a = items[i];
        const b = items[j];
        if (a.sessionId === b.sessionId) continue;

        const overlaps = timeRangesOverlap({
          startA: a.startAt,
          endA: a.endAt,
          startB: b.startAt,
          endB: b.endAt,
        });
        if (!overlaps) continue;

        const sessionIds = [a.sessionId, b.sessionId];
        const startAt = a.startAt < b.startAt ? a.startAt : b.startAt;
        const endAt = a.endAt > b.endAt ? a.endAt : b.endAt;
        const id = conflictId(a.resourceId, startAt, endAt, sessionIds);
        if (seen.has(id)) continue;
        seen.add(id);

        conflicts.push({
          id,
          type: "RESOURCE_OVERLAP" satisfies ResourceConflictType,
          resourceId: a.resourceId,
          resourceName: a.resourceName,
          startAt,
          endAt,
          sessionIds,
          activityLabels: [a.teamName, b.teamName],
        });
      }
    }
  }

  return conflicts.sort((x, y) => x.startAt.localeCompare(y.startAt));
}

export function attachConflictsToBlocks(
  blocks: ScheduledActivityBlock[],
  conflicts: readonly ResourceConflict[],
): ScheduledActivityBlock[] {
  const bySession = new Map<string, ResourceConflict[]>();
  for (const conflict of conflicts) {
    for (const sessionId of conflict.sessionIds) {
      const list = bySession.get(sessionId) ?? [];
      list.push(conflict);
      bySession.set(sessionId, list);
    }
  }

  return blocks.map((block) => {
    const blockConflicts = bySession.get(block.sessionId) ?? [];
    return {
      ...block,
      conflicts: blockConflicts,
      hasConflict: blockConflicts.length > 0,
    };
  });
}

export function filterConflicts(
  conflicts: readonly ResourceConflict[],
  options: { sessionIds?: ReadonlySet<string>; resourceId?: string | null },
): ResourceConflict[] {
  return conflicts.filter((conflict) => {
    if (options.resourceId && conflict.resourceId !== options.resourceId) return false;
    if (options.sessionIds) {
      return conflict.sessionIds.some((id) => options.sessionIds!.has(id));
    }
    return true;
  });
}
