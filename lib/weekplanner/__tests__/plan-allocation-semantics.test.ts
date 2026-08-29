/**
 * WOCHENPLAN-2.0-01H-E2 — plan allocation occupancy semantics tests.
 */

import { describe, expect, it } from "vitest";
import {
  isCanonicalAllocationGroupState,
  normalizePlanOccupancyMinutes,
  validatePlanOccupancyMinutes,
} from "../plan-allocation-semantics";

describe("normalizePlanOccupancyMinutes", () => {
  it("defaults absent values to 0", () => {
    expect(normalizePlanOccupancyMinutes(undefined)).toBe(0);
    expect(normalizePlanOccupancyMinutes(null)).toBe(0);
  });

  it("accepts arbitrary non-negative integers", () => {
    expect(normalizePlanOccupancyMinutes(17)).toBe(17);
    expect(normalizePlanOccupancyMinutes(23)).toBe(23);
  });
});

describe("validatePlanOccupancyMinutes", () => {
  it("rejects negative and non-integer values", () => {
    expect(() => validatePlanOccupancyMinutes(-1, "occupancyBeforeMinutes")).toThrow();
    expect(() => validatePlanOccupancyMinutes(1.5, "occupancyAfterMinutes")).toThrow();
  });
});

describe("isCanonicalAllocationGroupState", () => {
  const canonical = ["room-e1"];

  it("canonical E1 0/0 => override may clear", () => {
    expect(
      isCanonicalAllocationGroupState({
        selectedAllocations: [{ facilityResourceId: "room-e1", occupancyBeforeMinutes: 0, occupancyAfterMinutes: 0 }],
        canonicalResourceIds: canonical,
      }),
    ).toBe(true);
  });

  it("canonical E1 45/30 => override MUST remain", () => {
    expect(
      isCanonicalAllocationGroupState({
        selectedAllocations: [{ facilityResourceId: "room-e1", occupancyBeforeMinutes: 45, occupancyAfterMinutes: 30 }],
        canonicalResourceIds: canonical,
      }),
    ).toBe(false);
  });

  it("canonical E1 plan E2 0/0 => override remains", () => {
    expect(
      isCanonicalAllocationGroupState({
        selectedAllocations: [{ facilityResourceId: "room-e2", occupancyBeforeMinutes: 0, occupancyAfterMinutes: 0 }],
        canonicalResourceIds: canonical,
      }),
    ).toBe(false);
  });

  it("canonical E1 plan E2 45/30 => override remains", () => {
    expect(
      isCanonicalAllocationGroupState({
        selectedAllocations: [{ facilityResourceId: "room-e2", occupancyBeforeMinutes: 45, occupancyAfterMinutes: 30 }],
        canonicalResourceIds: canonical,
      }),
    ).toBe(false);
  });
});
