/**
 * WOCHENPLAN-2.0-01H-E — resource occupancy window derivation tests.
 * Pure functions only; persistence on WeekplannerPlanAllocation (01H-E2).
 */

import { describe, expect, it } from "vitest";
import {
  computeResourceOccupancyWindow,
  normalizeOccupancyBufferMinutes,
  resourceOccupancyWindowsOverlap,
} from "@/lib/facilities/resource-occupancy-window";

const TRAINING_START = "2026-09-20T15:00:00.000Z"; // 17:00 Zurich summer
const TRAINING_END = "2026-09-20T16:30:00.000Z"; // 18:30
const MATCH_START = "2026-09-20T16:30:00.000Z"; // 18:30
const MATCH_END = "2026-09-20T18:00:00.000Z"; // 20:00

describe("normalizeOccupancyBufferMinutes", () => {
  it("accepts arbitrary non-negative integers", () => {
    expect(normalizeOccupancyBufferMinutes(17)).toBe(17);
    expect(normalizeOccupancyBufferMinutes(23)).toBe(23);
  });

  it("clamps negatives and non-finite values to 0", () => {
    expect(normalizeOccupancyBufferMinutes(-5)).toBe(0);
    expect(normalizeOccupancyBufferMinutes(NaN)).toBe(0);
  });
});

describe("computeResourceOccupancyWindow", () => {
  it("0/0 matches event window", () => {
    const w = computeResourceOccupancyWindow(TRAINING_START, TRAINING_END, 0, 0);
    expect(w.effectiveStartAt.toISOString()).toBe(TRAINING_START);
    expect(w.effectiveEndAt.toISOString()).toBe(TRAINING_END);
  });

  it("applies before buffer correctly", () => {
    const w = computeResourceOccupancyWindow(TRAINING_START, TRAINING_END, 45, 0);
    expect(w.effectiveStartAt.toISOString()).toBe("2026-09-20T14:15:00.000Z");
    expect(w.effectiveEndAt.toISOString()).toBe(TRAINING_END);
  });

  it("applies after buffer correctly", () => {
    const w = computeResourceOccupancyWindow(TRAINING_START, TRAINING_END, 0, 30);
    expect(w.effectiveStartAt.toISOString()).toBe(TRAINING_START);
    expect(w.effectiveEndAt.toISOString()).toBe("2026-09-20T17:00:00.000Z");
  });

  it("applies both buffers correctly (dressing room example)", () => {
    const w = computeResourceOccupancyWindow(TRAINING_START, TRAINING_END, 45, 30);
    expect(w.effectiveStartAt.toISOString()).toBe("2026-09-20T14:15:00.000Z");
    expect(w.effectiveEndAt.toISOString()).toBe("2026-09-20T17:00:00.000Z");
  });
});

describe("resourceOccupancyWindowsOverlap", () => {
  it("detects overlap when event intervals barely touch but occupancy buffers overlap", () => {
    const training = computeResourceOccupancyWindow(TRAINING_START, TRAINING_END, 45, 30);
    const match = computeResourceOccupancyWindow(MATCH_START, MATCH_END, 60, 45);
    expect(resourceOccupancyWindowsOverlap(training, match)).toBe(true);
  });

  it("does not falsely overlap adjacent half-open intervals", () => {
    const first = computeResourceOccupancyWindow(
      "2026-09-20T14:00:00.000Z",
      "2026-09-20T15:00:00.000Z",
      0,
      0,
    );
    const second = computeResourceOccupancyWindow(
      "2026-09-20T15:00:00.000Z",
      "2026-09-20T16:00:00.000Z",
      0,
      0,
    );
    expect(resourceOccupancyWindowsOverlap(first, second)).toBe(false);
  });

  it("detects true overlap on occupancy windows", () => {
    const a = computeResourceOccupancyWindow(TRAINING_START, TRAINING_END, 45, 30);
    const b = computeResourceOccupancyWindow(
      "2026-09-20T15:30:00.000Z",
      "2026-09-20T17:00:00.000Z",
      0,
      0,
    );
    expect(resourceOccupancyWindowsOverlap(a, b)).toBe(true);
  });
});
