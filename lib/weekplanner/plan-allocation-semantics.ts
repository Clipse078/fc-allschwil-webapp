/**
 * lib/weekplanner/plan-allocation-semantics.ts
 *
 * WOCHENPLAN-2.0-01H-E2 — shared semantics for plan allocation occupancy
 * buffers and override-presence / canonical-equivalence checks.
 */

import { normalizeOccupancyBufferMinutes } from "@/lib/facilities/resource-occupancy-window";

export type PlanAllocationOccupancyInput = {
  facilityResourceId: string;
  occupancyBeforeMinutes?: number | null;
  occupancyAfterMinutes?: number | null;
};

/** Normalizes absent values to 0 — never allow undefined/null ambiguity. */
export function normalizePlanOccupancyMinutes(value: unknown): number {
  if (value === undefined || value === null) return 0;
  if (typeof value !== "number" || !Number.isInteger(value)) {
    return Number.NaN;
  }
  return normalizeOccupancyBufferMinutes(value);
}

/** Validates occupancy input for API/service layers — throws on invalid values. */
export function validatePlanOccupancyMinutes(value: unknown, label: string): number {
  if (value === undefined || value === null) return 0;
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new Error(`${label} must be a non-negative integer`);
  }
  if (value < 0) {
    throw new Error(`${label} must be >= 0`);
  }
  return value;
}

function setsEqualUnordered(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const left = [...a].sort();
  const right = [...b].sort();
  return left.every((value, index) => value === right[index]);
}

/**
 * True when the plan allocation group matches canonical resource identity
 * AND all occupancy buffers are 0/0 — safe to clear override rows.
 */
export function isCanonicalAllocationGroupState(input: {
  selectedAllocations: readonly PlanAllocationOccupancyInput[];
  canonicalResourceIds: readonly string[];
}): boolean {
  const selectedIds = input.selectedAllocations.map((row) => row.facilityResourceId);
  if (!setsEqualUnordered(selectedIds, input.canonicalResourceIds)) {
    return false;
  }

  return input.selectedAllocations.every((row) => {
    const before = normalizePlanOccupancyMinutes(row.occupancyBeforeMinutes);
    const after = normalizePlanOccupancyMinutes(row.occupancyAfterMinutes);
    return before === 0 && after === 0;
  });
}
