/**
 * WOCHENPLAN-2.0-01H-E7 — effective plan resolution unit tests.
 */

import { describe, expect, it } from "vitest";
import {
  collectActivitiesWithOverrides,
  resolveCanonicalTrainingSessionTime,
  resolveEffectiveAllocation,
  resolveEffectiveTime,
} from "../effective-plan-resolution";
import type { WeekplannerResourceRef } from "../types";

const PITCH: WeekplannerResourceRef = {
  facilityResourceId: "res-1",
  code: "KR2_A",
  name: "Kunstrasen 2 A",
  facilityName: "Kunstrasen 2",
  occupancyBeforeMinutes: 0,
  occupancyAfterMinutes: 0,
};

describe("resolveEffectiveAllocation", () => {
  it("uses plan override when present", () => {
    const overrides = new Map<string, WeekplannerResourceRef[]>([
      ["TRAINING:session-1:PITCH_HALL:", [PITCH]],
    ]);
    const result = resolveEffectiveAllocation(overrides, "TRAINING:session-1:PITCH_HALL:", []);
    expect(result.overridden).toBe(true);
    expect(result.allocations).toEqual([PITCH]);
  });

  it("falls back to canonical when no override exists", () => {
    const result = resolveEffectiveAllocation(new Map(), "TRAINING:session-1:PITCH_HALL:", [PITCH]);
    expect(result.overridden).toBe(false);
    expect(result.allocations).toEqual([PITCH]);
  });
});

describe("resolveEffectiveTime", () => {
  it("uses plan time override when present", () => {
    const overrides = new Map([
      [
        "TRAINING:session-1",
        {
          overrideStartAt: new Date("2026-08-10T15:00:00.000Z"),
          overrideEndAt: new Date("2026-08-10T16:30:00.000Z"),
        },
      ],
    ]);
    const result = resolveEffectiveTime(
      overrides,
      "TRAINING:session-1",
      new Date("2026-08-10T16:00:00.000Z"),
      new Date("2026-08-10T17:00:00.000Z"),
    );
    expect(result.overridden).toBe(true);
    expect(result.startAt.toISOString()).toBe("2026-08-10T15:00:00.000Z");
  });
});

describe("resolveCanonicalTrainingSessionTime", () => {
  it("prefers occurrence-level override instants over series-generated defaults", () => {
    const result = resolveCanonicalTrainingSessionTime({
      startAt: new Date("2026-08-10T10:00:00.000Z"),
      endAt: new Date("2026-08-10T11:00:00.000Z"),
      overrideStartAt: new Date("2026-08-10T15:00:00.000Z"),
      overrideEndAt: new Date("2026-08-10T16:30:00.000Z"),
    });
    expect(result.startAt.toISOString()).toBe("2026-08-10T15:00:00.000Z");
    expect(result.endAt.toISOString()).toBe("2026-08-10T16:30:00.000Z");
  });
});

describe("collectActivitiesWithOverrides", () => {
  it("collects activities with allocation or time overrides", () => {
    const overrides = new Map<string, WeekplannerResourceRef[]>([
      ["TRAINING:session-1:PITCH_HALL:", [PITCH]],
    ]);
    const timeOverrides = new Map([
      ["MATCH:match-1", { overrideStartAt: null, overrideEndAt: null }],
    ]);
    const present = collectActivitiesWithOverrides(overrides, timeOverrides);
    expect(present.has("TRAINING:session-1")).toBe(true);
    expect(present.has("MATCH:match-1")).toBe(true);
  });
});
