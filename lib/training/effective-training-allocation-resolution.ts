/**
 * lib/training/effective-training-allocation-resolution.ts
 *
 * WOCHENPLAN-CANONICAL-UPSTREAM-01 — canonical per-occurrence training
 * resource resolution shared by Weekplanner, availability integration, and
 * public Wochenplan consumers.
 *
 * Precedence (per allocation group — Spielfeld/Halle and Garderobe are
 * independent):
 *   1. TrainingSessionAllocation rows for this occurrence + group
 *   2. TrainingSeries TrainingAllocation rows for this group
 *
 * Within each tier exactly one resource per group is returned — the row with
 * the lowest displayOrder (then createdAt) — so arbitrary DB ordering or
 * stale multi-row series history cannot surface the wrong pitch/dressing room
 * on a different weekday occurrence.
 */

import { classifyFacilityResourceType, type TrainingAllocationGroupKey } from "./allocation-groups";

export type TrainingAllocationResourceRow = {
  displayOrder: number;
  createdAt?: Date;
  facilityResource: {
    id: string;
    code: string;
    name: string;
    type: string;
    facility: { name: string };
  };
};

export type ResolvedTrainingAllocationGroup = {
  pitch: TrainingAllocationResourceRow[];
  dressingRoom: TrainingAllocationResourceRow[];
};

function compareAllocationRows(a: TrainingAllocationResourceRow, b: TrainingAllocationResourceRow): number {
  const orderDiff = a.displayOrder - b.displayOrder;
  if (orderDiff !== 0) return orderDiff;
  const aCreated = a.createdAt?.getTime() ?? 0;
  const bCreated = b.createdAt?.getTime() ?? 0;
  return aCreated - bCreated;
}

function pickCanonicalRow(
  rows: readonly TrainingAllocationResourceRow[],
): TrainingAllocationResourceRow[] {
  if (rows.length === 0) return [];
  const sorted = [...rows].sort(compareAllocationRows);
  return [sorted[0]!];
}

/**
 * Resolves the canonical Standardplan allocation for one training occurrence
 * and allocation group. Session-level overrides win independently per group;
 * otherwise the series default resolves to a single deterministic row.
 */
export function resolveTrainingOccurrenceAllocationGroup(
  group: Extract<TrainingAllocationGroupKey, "PITCH_HALL" | "DRESSING_ROOM">,
  seriesRows: readonly TrainingAllocationResourceRow[],
  sessionOverrideRows: readonly TrainingAllocationResourceRow[],
): TrainingAllocationResourceRow[] {
  const overridesForGroup = sessionOverrideRows.filter(
    (row) => classifyFacilityResourceType(row.facilityResource.type) === group,
  );
  if (overridesForGroup.length > 0) {
    return pickCanonicalRow(overridesForGroup);
  }

  const seriesForGroup = seriesRows.filter(
    (row) => classifyFacilityResourceType(row.facilityResource.type) === group,
  );
  return pickCanonicalRow(seriesForGroup);
}

/**
 * Resolves both Weekplanner-relevant allocation groups for one occurrence.
 */
export function resolveTrainingOccurrenceAllocations(input: {
  seriesRows: readonly TrainingAllocationResourceRow[];
  sessionOverrideRows: readonly TrainingAllocationResourceRow[];
}): ResolvedTrainingAllocationGroup {
  return {
    pitch: resolveTrainingOccurrenceAllocationGroup(
      "PITCH_HALL",
      input.seriesRows,
      input.sessionOverrideRows,
    ),
    dressingRoom: resolveTrainingOccurrenceAllocationGroup(
      "DRESSING_ROOM",
      input.seriesRows,
      input.sessionOverrideRows,
    ),
  };
}
