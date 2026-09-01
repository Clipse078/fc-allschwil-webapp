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
 * Within each tier exactly one resource per group is returned:
 *   - Session overrides: when multiple siblings exist for the same group,
 *     the row with the highest displayOrder (then newest createdAt) is the
 *     occurrence's authored override — matching reassignment-service.ts,
 *     which deletes prior group rows before creating the next override.
 *   - Series defaults: lowest displayOrder (then oldest createdAt) — the
 *     canonical primary allocation for the recurring series.
 *   - Cross-layer tie-break: when both tiers have a candidate, the row with
 *     the newer updatedAt (then createdAt) wins. A stale occurrence override
 *     left behind after the series canonical row was updated must not block
 *     the current series default (e.g. old O4 session row vs. newer E3
 *     series row).
 */

import { classifyFacilityResourceType, type TrainingAllocationGroupKey } from "./allocation-groups";

export type TrainingAllocationResourceRow = {
  displayOrder: number;
  createdAt?: Date;
  updatedAt?: Date;
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

function rowAuthorityTimestamp(row: TrainingAllocationResourceRow): number {
  return row.updatedAt?.getTime() ?? row.createdAt?.getTime() ?? 0;
}

function compareSeriesAllocationRows(
  a: TrainingAllocationResourceRow,
  b: TrainingAllocationResourceRow,
): number {
  const orderDiff = a.displayOrder - b.displayOrder;
  if (orderDiff !== 0) return orderDiff;
  const aCreated = a.createdAt?.getTime() ?? 0;
  const bCreated = b.createdAt?.getTime() ?? 0;
  return aCreated - bCreated;
}

function compareSessionOverrideRows(
  a: TrainingAllocationResourceRow,
  b: TrainingAllocationResourceRow,
): number {
  const orderDiff = b.displayOrder - a.displayOrder;
  if (orderDiff !== 0) return orderDiff;
  const aCreated = a.createdAt?.getTime() ?? 0;
  const bCreated = b.createdAt?.getTime() ?? 0;
  return bCreated - aCreated;
}

function pickCanonicalSeriesRow(
  rows: readonly TrainingAllocationResourceRow[],
): TrainingAllocationResourceRow[] {
  if (rows.length === 0) return [];
  const sorted = [...rows].sort(compareSeriesAllocationRows);
  return [sorted[0]!];
}

function pickCanonicalSessionOverrideRow(
  rows: readonly TrainingAllocationResourceRow[],
): TrainingAllocationResourceRow[] {
  if (rows.length === 0) return [];
  const sorted = [...rows].sort(compareSessionOverrideRows);
  return [sorted[0]!];
}

function resolveCrossLayerAllocation(
  seriesCanonical: readonly TrainingAllocationResourceRow[],
  sessionCanonical: readonly TrainingAllocationResourceRow[],
): TrainingAllocationResourceRow[] {
  if (sessionCanonical.length === 0) return [...seriesCanonical];
  if (seriesCanonical.length === 0) return [...sessionCanonical];

  const sessionRow = sessionCanonical[0]!;
  const seriesRow = seriesCanonical[0]!;
  const sessionAuthority = rowAuthorityTimestamp(sessionRow);
  const seriesAuthority = rowAuthorityTimestamp(seriesRow);

  return sessionAuthority > seriesAuthority ? [sessionRow] : [seriesRow];
}

/**
 * Resolves the canonical Standardplan allocation for one training occurrence
 * and allocation group. Session-level overrides win independently per group
 * when they are the more recently authored assignment; otherwise the series
 * canonical row applies.
 */
export function resolveTrainingOccurrenceAllocationGroup(
  group: Extract<TrainingAllocationGroupKey, "PITCH_HALL" | "DRESSING_ROOM">,
  seriesRows: readonly TrainingAllocationResourceRow[],
  sessionOverrideRows: readonly TrainingAllocationResourceRow[],
): TrainingAllocationResourceRow[] {
  const overridesForGroup = sessionOverrideRows.filter(
    (row) => classifyFacilityResourceType(row.facilityResource.type) === group,
  );
  const seriesForGroup = seriesRows.filter(
    (row) => classifyFacilityResourceType(row.facilityResource.type) === group,
  );

  const seriesCanonical = pickCanonicalSeriesRow(seriesForGroup);
  if (overridesForGroup.length === 0) {
    return seriesCanonical;
  }

  const sessionCanonical = pickCanonicalSessionOverrideRow(overridesForGroup);
  return resolveCrossLayerAllocation(seriesCanonical, sessionCanonical);
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
