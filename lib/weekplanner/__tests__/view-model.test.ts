/**
 * lib/weekplanner/__tests__/view-model.test.ts
 *
 * WEEKPLANNER-01A — focused tests for the pure Weekplanner view-model:
 * day-bucketing, chronological ordering within a day, and resource-conflict
 * ("⚠ Doppelbelegung") detection. No I/O, no Prisma.
 */

import { describe, expect, it } from "vitest";
import { buildWeekplannerWeek, detectWeekplannerConflicts } from "../view-model";
import type { WeekplannerItem, WeekplannerMatchItem, WeekplannerTrainingItem } from "../types";

const WEEK_DAYS = [
  "2026-08-10",
  "2026-08-11",
  "2026-08-12",
  "2026-08-13",
  "2026-08-14",
  "2026-08-15",
  "2026-08-16",
];

const PITCH = { facilityResourceId: "res-pitch-1", code: "KUNSTRASEN_1", name: "Kunstrasen 1", facilityName: "Sportanlage" };
const ROOM_A = { facilityResourceId: "res-room-a", code: "G1", name: "Garderobe 1", facilityName: "Garderobentrakt" };
const ROOM_B = { facilityResourceId: "res-room-b", code: "G2", name: "Garderobe 2", facilityName: "Garderobentrakt" };

function trainingItem(overrides: Partial<WeekplannerTrainingItem> = {}): WeekplannerTrainingItem {
  return {
    id: "training:s1",
    tenantId: "tenant-a",
    type: "TRAINING",
    startAt: new Date("2026-08-10T16:00:00.000Z"),
    endAt: new Date("2026-08-10T17:30:00.000Z"),
    title: "E2 Training",
    teamNames: ["FC Allschwil E2"],
    pitchAllocations: [PITCH],
    dressingRoomAllocations: [ROOM_A],
    pitchOverridden: false,
    dressingRoomOverridden: false,
    conflicts: [],
    trainingSeriesId: "series-1",
    trainingSessionId: "s1",
    ...overrides,
  };
}

function matchItem(overrides: Partial<WeekplannerMatchItem> = {}): WeekplannerMatchItem {
  return {
    id: "match:e1",
    tenantId: "tenant-a",
    type: "MATCH",
    startAt: new Date("2026-08-10T16:30:00.000Z"),
    endAt: new Date("2026-08-10T18:00:00.000Z"),
    title: "FC Allschwil 1 - Gegner FC",
    teamNames: ["FC Allschwil 1"],
    opponentName: "Gegner FC",
    homeAway: "HOME",
    eventId: "e1",
    pitchAllocations: [PITCH],
    dressingRoomAllocations: [ROOM_B],
    pitchOverridden: false,
    dressingRoomOverridden: false,
    awayDressingRoomAllocations: [],
    conflicts: [],
    ...overrides,
  };
}

describe("detectWeekplannerConflicts", () => {
  it("flags two items sharing the same FacilityResource for an overlapping time window", () => {
    const training = trainingItem();
    const match = matchItem(); // overlaps 16:30–18:00 with training's 16:00–17:30, same pitch
    const [flaggedTraining, flaggedMatch] = detectWeekplannerConflicts([training, match]);

    expect(flaggedTraining.conflicts).toEqual([
      { facilityResourceId: PITCH.facilityResourceId, facilityResourceName: PITCH.name },
    ]);
    expect(flaggedMatch.conflicts).toEqual([
      { facilityResourceId: PITCH.facilityResourceId, facilityResourceName: PITCH.name },
    ]);
  });

  it("does NOT flag items sharing a resource when their time windows do not overlap", () => {
    const training = trainingItem({
      startAt: new Date("2026-08-10T16:00:00.000Z"),
      endAt: new Date("2026-08-10T17:00:00.000Z"),
    });
    const match = matchItem({
      startAt: new Date("2026-08-10T18:00:00.000Z"),
      endAt: new Date("2026-08-10T19:30:00.000Z"),
    });

    const [flaggedTraining, flaggedMatch] = detectWeekplannerConflicts([training, match]);
    expect(flaggedTraining.conflicts).toEqual([]);
    expect(flaggedMatch.conflicts).toEqual([]);
  });

  it("does NOT flag items that overlap in time but use different resources", () => {
    const training = trainingItem({ pitchAllocations: [PITCH], dressingRoomAllocations: [ROOM_A] });
    const match = matchItem({
      pitchAllocations: [{ ...PITCH, facilityResourceId: "res-pitch-2", code: "KUNSTRASEN_2", name: "Kunstrasen 2" }],
      dressingRoomAllocations: [ROOM_B],
    });

    const [flaggedTraining, flaggedMatch] = detectWeekplannerConflicts([training, match]);
    expect(flaggedTraining.conflicts).toEqual([]);
    expect(flaggedMatch.conflicts).toEqual([]);
  });

  it("never flags an item against itself", () => {
    const training = trainingItem();
    const [flagged] = detectWeekplannerConflicts([training]);
    expect(flagged.conflicts).toEqual([]);
  });
});

describe("buildWeekplannerWeek", () => {
  it("buckets each item under its Europe/Zurich calendar day", () => {
    const monday = trainingItem({ id: "training:mon", startAt: new Date("2026-08-10T16:00:00.000Z"), endAt: new Date("2026-08-10T17:00:00.000Z") });
    // 2026-08-16T22:15:00.000Z is Monday 2026-08-17 00:15 in Zurich — the NEXT week, must NOT leak into this week's Sunday bucket.
    const sunday = trainingItem({ id: "training:sun", startAt: new Date("2026-08-16T19:00:00.000Z"), endAt: new Date("2026-08-16T20:00:00.000Z") });

    const week = buildWeekplannerWeek({
      items: [monday, sunday],
      days: WEEK_DAYS,
      weekNumberLabel: "KW 33",
      rangeLabel: "10. Aug – 16. Aug 2026",
      param: "2026-08-10",
      previousParam: "2026-08-03",
      nextParam: "2026-08-17",
    });

    expect(week.days).toHaveLength(7);
    expect(week.days[0].dayKey).toBe("2026-08-10");
    expect(week.days[0].items.map((i) => i.id)).toEqual(["training:mon"]);
    expect(week.days[6].dayKey).toBe("2026-08-16");
    expect(week.days[6].items.map((i) => i.id)).toEqual(["training:sun"]);
    // Every other day is present and empty.
    for (const day of week.days.slice(1, 6)) {
      expect(day.items).toEqual([]);
    }
  });

  it("sorts items within a day chronologically by start time", () => {
    const later = trainingItem({ id: "training:later", startAt: new Date("2026-08-10T18:00:00.000Z"), endAt: new Date("2026-08-10T19:00:00.000Z"), title: "Z Training" });
    const earlier = matchItem({ id: "match:earlier", startAt: new Date("2026-08-10T09:00:00.000Z"), endAt: new Date("2026-08-10T10:30:00.000Z") });
    const middle = trainingItem({ id: "training:middle", startAt: new Date("2026-08-10T14:00:00.000Z"), endAt: new Date("2026-08-10T15:00:00.000Z"), title: "A Training" });

    const week = buildWeekplannerWeek({
      items: [later, earlier, middle],
      days: WEEK_DAYS,
      weekNumberLabel: "KW 33",
      rangeLabel: "10. Aug – 16. Aug 2026",
      param: "2026-08-10",
      previousParam: "2026-08-03",
      nextParam: "2026-08-17",
    });

    expect(week.days[0].items.map((i) => i.id)).toEqual(["match:earlier", "training:middle", "training:later"]);
  });

  it("propagates week navigation params through unchanged", () => {
    const week = buildWeekplannerWeek({
      items: [] as WeekplannerItem[],
      days: WEEK_DAYS,
      weekNumberLabel: "KW 33",
      rangeLabel: "10. Aug – 16. Aug 2026",
      param: "2026-08-10",
      previousParam: "2026-08-03",
      nextParam: "2026-08-17",
    });

    expect(week.param).toBe("2026-08-10");
    expect(week.previousParam).toBe("2026-08-03");
    expect(week.nextParam).toBe("2026-08-17");
  });
});
