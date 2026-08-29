/**
 * WOCHENPLAN-2.0-01H-E2 — effective occupancy + availability integration tests.
 */

import { describe, expect, it } from "vitest";
import { computeResourceOccupancyWindow, resourceOccupancyWindowsOverlap } from "@/lib/facilities/resource-occupancy-window";

const TRAINING_START = "2026-09-20T15:00:00.000Z";
const TRAINING_END = "2026-09-20T16:30:00.000Z";
const MATCH_START = "2026-09-20T16:30:00.000Z";
const MATCH_END = "2026-09-20T18:00:00.000Z";

describe("effective occupancy calculations", () => {
  it("17:00–18:30 + 45/30 => 16:15–19:00", () => {
    const window = computeResourceOccupancyWindow(TRAINING_START, TRAINING_END, 45, 30);
    expect(window.effectiveStartAt.toISOString()).toBe("2026-09-20T14:15:00.000Z");
    expect(window.effectiveEndAt.toISOString()).toBe("2026-09-20T17:00:00.000Z");
  });

  it("18:30–20:00 + 60/45 => 17:30–20:45", () => {
    const window = computeResourceOccupancyWindow(MATCH_START, MATCH_END, 60, 45);
    expect(window.effectiveStartAt.toISOString()).toBe("2026-09-20T15:30:00.000Z");
    expect(window.effectiveEndAt.toISOString()).toBe("2026-09-20T18:45:00.000Z");
  });

  it("overlap 17:30–19:00 between training and match occupancy windows", () => {
    const training = computeResourceOccupancyWindow(TRAINING_START, TRAINING_END, 45, 30);
    const match = computeResourceOccupancyWindow(MATCH_START, MATCH_END, 60, 45);
    expect(resourceOccupancyWindowsOverlap(training, match)).toBe(true);
  });

  it("plan time override 17:30–19:00 with 45/30 => 16:45–19:30", () => {
    const planStart = "2026-09-20T15:30:00.000Z";
    const planEnd = "2026-09-20T17:00:00.000Z";
    const window = computeResourceOccupancyWindow(planStart, planEnd, 45, 30);
    expect(window.effectiveStartAt.toISOString()).toBe("2026-09-20T14:45:00.000Z");
    expect(window.effectiveEndAt.toISOString()).toBe("2026-09-20T17:30:00.000Z");
    expect(window.eventStartAt.toISOString()).toBe(planStart);
    expect(window.eventEndAt.toISOString()).toBe(planEnd);
  });

  it("arbitrary 17/23 buffers derive correctly", () => {
    const window = computeResourceOccupancyWindow(TRAINING_START, TRAINING_END, 17, 23);
    expect(window.beforeMinutes).toBe(17);
    expect(window.afterMinutes).toBe(23);
    expect(window.effectiveStartAt.getTime()).toBe(new Date(TRAINING_START).getTime() - 17 * 60_000);
    expect(window.effectiveEndAt.getTime()).toBe(new Date(TRAINING_END).getTime() + 23 * 60_000);
  });
});
