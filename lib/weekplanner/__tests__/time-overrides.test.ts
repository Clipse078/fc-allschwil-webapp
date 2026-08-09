/**
 * lib/weekplanner/__tests__/time-overrides.test.ts
 *
 * WEEKPLANNER-01D — focused tests for getWeekplannerWeek()'s TIME override
 * resolution (lib/weekplanner/queries.ts). Mirrors plan-overrides.test.ts's
 * structure exactly, but for start/end instead of FacilityResource
 * allocations. Covers:
 *   1. Standardplan uses canonical time (no plan selected).
 *   2. alternative time override for TRAINING.
 *   3. alternative time override for HOME MATCH.
 *   4. alternative time override for HOME TOURNAMENT.
 *   5. missing override falls back to canonical time.
 *   7. the canonical TrainingSession/Event records are never mutated.
 *   9. effective time + effective resource together drive conflict
 *      detection ("⚠ Doppelbelegung") — Standardplan stays conflict-free.
 *   10. conflict isolation between two different plans for the SAME week.
 *   11. tenant isolation for the time-override lookup itself.
 *
 * All external dependencies (Prisma) are mocked. No DB access.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  facilityResourceFindMany: vi.fn(),
  trainingAllocationFindMany: vi.fn(),
  trainingSessionAllocationFindMany: vi.fn(),
  trainingSessionFindMany: vi.fn(),
  eventFindMany: vi.fn(),
  weekplannerPlanAllocationFindMany: vi.fn(),
  weekplannerPlanActivityOverrideFindMany: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    facilityResource: { findMany: mocks.facilityResourceFindMany },
    trainingAllocation: { findMany: mocks.trainingAllocationFindMany },
    trainingSessionAllocation: { findMany: mocks.trainingSessionAllocationFindMany },
    trainingSession: { findMany: mocks.trainingSessionFindMany },
    event: { findMany: mocks.eventFindMany },
    weekplannerPlanAllocation: { findMany: mocks.weekplannerPlanAllocationFindMany },
    weekplannerPlanActivityOverride: { findMany: mocks.weekplannerPlanActivityOverrideFindMany },
  },
}));

import { getWeekplannerWeek } from "../queries";

const TENANT_A = "tenant-a";
const TENANT_B = "tenant-b";
const PLAN_STANDARD_WEATHER = "plan-schlechtwetter";
const PLAN_OTHER = "plan-other";

const WEEK_WINDOW = {
  from: new Date("2026-08-09T22:00:00.000Z"),
  to: new Date("2026-08-16T21:59:59.999Z"),
  days: [
    "2026-08-10",
    "2026-08-11",
    "2026-08-12",
    "2026-08-13",
    "2026-08-14",
    "2026-08-15",
    "2026-08-16",
  ],
  param: "2026-08-10",
  previousParam: "2026-08-03",
  nextParam: "2026-08-17",
};

const HALLE = { id: "res-halle", code: "HALLE", name: "Dreifachhalle", facility: { name: "Sportanlage Bruel" } };
const STANDARD_PITCH = { id: "res-pitch-standard", code: "KR2", name: "Kunstrasen 2", facility: { name: "Sportanlage Bruel" } };

function trainingSessionRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "session-1",
    tenantId: TENANT_A,
    trainingSeriesId: "series-1",
    teamSeasonId: "teamseason-1",
    date: new Date("2026-08-10T00:00:00.000Z"),
    weekday: "MONDAY",
    startAt: new Date("2026-08-10T16:00:00.000Z"),
    endAt: new Date("2026-08-10T17:00:00.000Z"),
    timezone: "Europe/Zurich",
    status: "SCHEDULED",
    overrideDate: null,
    overrideStartAt: null,
    overrideEndAt: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    trainingSeries: {
      title: "E1 Training",
      teamSeason: { displayName: "FC Allschwil E1", team: { name: "E1", shortName: null, alternativeName: null } },
    },
    ...overrides,
  };
}

function secondTrainingSessionRow(overrides: Record<string, unknown> = {}) {
  return trainingSessionRow({
    id: "session-2",
    startAt: new Date("2026-08-10T18:00:00.000Z"),
    endAt: new Date("2026-08-10T19:00:00.000Z"),
    trainingSeriesId: "series-2",
    trainingSeries: {
      title: "E2 Training",
      teamSeason: { displayName: "FC Allschwil E2", team: { name: "E2", shortName: null, alternativeName: null } },
    },
    ...overrides,
  });
}

function matchEventRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "event-match-1",
    tenantId: TENANT_A,
    type: "MATCH",
    source: "MANUAL",
    status: "SCHEDULED",
    reviewStage: "DRAFT",
    reviewRequestedAt: null,
    reviewedAt: null,
    publishedAt: null,
    reviewNotes: null,
    title: "FC Allschwil 1 - Gegner FC",
    description: null,
    location: "Im Brüel",
    startAt: new Date("2026-08-15T13:00:00.000Z"),
    endAt: new Date("2026-08-15T14:30:00.000Z"),
    externalSource: null,
    externalSourceId: null,
    lastSyncedAt: null,
    opponentName: "Gegner FC",
    organizerName: null,
    competitionLabel: "3. Liga",
    homeAway: "HOME",
    resultLabel: null,
    intermediateResultLabel: null,
    meetingTime: null,
    websiteVisible: true,
    infoboardVisible: false,
    homepageVisible: false,
    wochenplanVisible: true,
    trainingsplanVisible: false,
    teamPageVisible: true,
    remarks: null,
    pitchCode: STANDARD_PITCH.code,
    homeDressingRoomCode: null,
    awayDressingRoomCode: null,
    team: { id: "team-own", name: "FC Allschwil 1", shortName: "1. Mannschaft", alternativeName: null },
    matchExternalMapping: null,
    ...overrides,
  };
}

function tournamentEventRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "event-tournament-1",
    tenantId: TENANT_A,
    title: "FCA Sommerturnier",
    description: null,
    status: "SCHEDULED",
    source: "MANUAL",
    reviewStage: "DRAFT",
    startAt: new Date("2026-08-15T08:00:00.000Z"),
    endAt: new Date("2026-08-15T16:00:00.000Z"),
    meetingTime: null,
    location: "Im Brüel",
    organizerName: "FC Allschwil",
    competitionLabel: null,
    resultLabel: null,
    remarks: null,
    homeAway: "HOME",
    websiteVisible: true,
    infoboardVisible: false,
    homepageVisible: false,
    wochenplanVisible: true,
    teamPageVisible: true,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    season: { id: "season-1", key: "2026-2027", name: "2026/2027" },
    team: null,
    tournamentParticipants: [],
    tournamentResourceAllocations: [],
    ...overrides,
  };
}

/** Raw WeekplannerPlanActivityOverride row, as selected by findWeekplannerPlanTimeOverrides(). */
function timeOverrideRow(overrides: Record<string, unknown> = {}) {
  return {
    activityType: "TRAINING",
    activityId: "session-1",
    overrideStartAt: new Date("2026-08-10T17:00:00.000Z"),
    overrideEndAt: new Date("2026-08-10T18:00:00.000Z"),
    ...overrides,
  };
}

/** Raw WeekplannerPlanAllocation resource-override row (for the combined time+resource conflict tests). */
function resourceOverrideRow(overrides: Record<string, unknown> = {}) {
  return {
    activityType: "TRAINING",
    activityId: "session-1",
    allocationGroup: "PITCH_HALL",
    participantId: "",
    facilityResource: { id: HALLE.id, code: HALLE.code, name: HALLE.name, facility: { name: HALLE.facility.name } },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.facilityResourceFindMany.mockResolvedValue([STANDARD_PITCH, HALLE]);
  mocks.trainingAllocationFindMany.mockResolvedValue([]);
  mocks.trainingSessionAllocationFindMany.mockResolvedValue([]);
  mocks.trainingSessionFindMany.mockResolvedValue([]);
  mocks.eventFindMany.mockResolvedValue([]);
  mocks.weekplannerPlanAllocationFindMany.mockResolvedValue([]);
  mocks.weekplannerPlanActivityOverrideFindMany.mockResolvedValue([]);
});

describe("getWeekplannerWeek — Standardplan uses canonical time (test 1)", () => {
  it("omitting planId never queries WeekplannerPlanActivityOverride and timeOverridden is false", async () => {
    mocks.trainingSessionFindMany.mockResolvedValue([trainingSessionRow()]);

    const week = await getWeekplannerWeek(TENANT_A, WEEK_WINDOW);

    expect(mocks.weekplannerPlanActivityOverrideFindMany).not.toHaveBeenCalled();
    const [item] = week.days.find((d) => d.dayKey === "2026-08-10")!.items;
    expect(item.startAt.toISOString()).toBe("2026-08-10T16:00:00.000Z");
    expect(item.endAt.toISOString()).toBe("2026-08-10T17:00:00.000Z");
    expect(item.timeOverridden).toBe(false);
  });
});

describe("getWeekplannerWeek — alternative time override (tests 2, 3, 4)", () => {
  it("2. a plan-level time override replaces the canonical TRAINING start/end — only in that plan", async () => {
    mocks.trainingSessionFindMany.mockResolvedValue([trainingSessionRow()]);
    mocks.weekplannerPlanActivityOverrideFindMany.mockResolvedValue([timeOverrideRow()]);

    const week = await getWeekplannerWeek(TENANT_A, WEEK_WINDOW, PLAN_STANDARD_WEATHER);
    const [item] = week.days.find((d) => d.dayKey === "2026-08-10")!.items;

    expect(item.startAt.toISOString()).toBe("2026-08-10T17:00:00.000Z");
    expect(item.endAt.toISOString()).toBe("2026-08-10T18:00:00.000Z");
    expect(item.timeOverridden).toBe(true);
    expect(item.canonicalStartAt.toISOString()).toBe("2026-08-10T16:00:00.000Z");
    expect(item.canonicalEndAt.toISOString()).toBe("2026-08-10T17:00:00.000Z");
  });

  it("3. a plan-level time override replaces the canonical HOME MATCH start/end", async () => {
    mocks.eventFindMany.mockImplementation((args: { where?: { type?: string } }) => {
      if (args.where?.type === "MATCH") return Promise.resolve([matchEventRow()]);
      return Promise.resolve([]);
    });
    mocks.weekplannerPlanActivityOverrideFindMany.mockResolvedValue([
      timeOverrideRow({
        activityType: "MATCH",
        activityId: "event-match-1",
        overrideStartAt: new Date("2026-08-15T14:00:00.000Z"),
        overrideEndAt: new Date("2026-08-15T15:30:00.000Z"),
      }),
    ]);

    const week = await getWeekplannerWeek(TENANT_A, WEEK_WINDOW, PLAN_STANDARD_WEATHER);
    const [item] = week.days.find((d) => d.dayKey === "2026-08-15")!.items;
    if (item.type !== "MATCH") throw new Error("expected MATCH");

    expect(item.startAt.toISOString()).toBe("2026-08-15T14:00:00.000Z");
    expect(item.endAt.toISOString()).toBe("2026-08-15T15:30:00.000Z");
    expect(item.timeOverridden).toBe(true);
  });

  it("4. a plan-level time override replaces the canonical HOME TOURNAMENT start/end", async () => {
    mocks.eventFindMany.mockImplementation((args: { where?: { type?: string } }) => {
      if (args.where?.type === "TOURNAMENT") return Promise.resolve([tournamentEventRow()]);
      return Promise.resolve([]);
    });
    mocks.weekplannerPlanActivityOverrideFindMany.mockResolvedValue([
      timeOverrideRow({
        activityType: "TOURNAMENT",
        activityId: "event-tournament-1",
        overrideStartAt: new Date("2026-08-15T09:00:00.000Z"),
        overrideEndAt: null,
      }),
    ]);

    const week = await getWeekplannerWeek(TENANT_A, WEEK_WINDOW, PLAN_STANDARD_WEATHER);
    const [item] = week.days.find((d) => d.dayKey === "2026-08-15")!.items;
    if (item.type !== "TOURNAMENT") throw new Error("expected TOURNAMENT");

    // Only the start side is overridden — end independently falls back to canonical (sparse override).
    expect(item.startAt.toISOString()).toBe("2026-08-15T09:00:00.000Z");
    expect(item.endAt.toISOString()).toBe("2026-08-15T16:00:00.000Z");
    expect(item.timeOverridden).toBe(true);
  });
});

describe("getWeekplannerWeek — missing override falls back to canonical time (test 5)", () => {
  it("a plan with zero time-override rows for an activity uses the canonical Standardplan time", async () => {
    mocks.trainingSessionFindMany.mockResolvedValue([trainingSessionRow()]);
    mocks.weekplannerPlanActivityOverrideFindMany.mockResolvedValue([]);

    const week = await getWeekplannerWeek(TENANT_A, WEEK_WINDOW, PLAN_STANDARD_WEATHER);
    const [item] = week.days.find((d) => d.dayKey === "2026-08-10")!.items;

    expect(item.startAt.toISOString()).toBe("2026-08-10T16:00:00.000Z");
    expect(item.endAt.toISOString()).toBe("2026-08-10T17:00:00.000Z");
    expect(item.timeOverridden).toBe(false);
  });
});

describe("getWeekplannerWeek — canonical source records remain unchanged (test 7)", () => {
  it("never issues a create/update/delete against any mocked Prisma model while resolving a time override — purely read-only", async () => {
    mocks.trainingSessionFindMany.mockResolvedValue([trainingSessionRow()]);
    mocks.weekplannerPlanActivityOverrideFindMany.mockResolvedValue([timeOverrideRow()]);

    await expect(getWeekplannerWeek(TENANT_A, WEEK_WINDOW, PLAN_STANDARD_WEATHER)).resolves.toBeDefined();
    expect(mocks.trainingSessionFindMany).toHaveBeenCalled();
    expect(mocks.weekplannerPlanActivityOverrideFindMany).toHaveBeenCalled();
  });
});

describe("getWeekplannerWeek — effective time + effective resource drive conflicts (test 9)", () => {
  it("Standardplan: two TrainingSessions with non-overlapping canonical times never conflict, even when sharing a pitch", async () => {
    mocks.trainingSessionFindMany.mockResolvedValue([trainingSessionRow(), secondTrainingSessionRow()]);
    mocks.trainingAllocationFindMany.mockResolvedValue([
      { trainingSeriesId: "series-1", facilityResource: { id: STANDARD_PITCH.id, code: STANDARD_PITCH.code, name: STANDARD_PITCH.name, type: "FULL_PITCH", facility: { name: STANDARD_PITCH.facility.name } } },
      { trainingSeriesId: "series-2", facilityResource: { id: STANDARD_PITCH.id, code: STANDARD_PITCH.code, name: STANDARD_PITCH.name, type: "FULL_PITCH", facility: { name: STANDARD_PITCH.facility.name } } },
    ]);

    const week = await getWeekplannerWeek(TENANT_A, WEEK_WINDOW);
    const monday = week.days.find((d) => d.dayKey === "2026-08-10")!;
    for (const item of monday.items) expect(item.conflicts).toEqual([]);
  });

  it("Schlechtwetterplan: shifting BOTH sessions' EFFECTIVE time into overlap AND onto the same Halle produces a Doppelbelegung", async () => {
    mocks.trainingSessionFindMany.mockResolvedValue([trainingSessionRow(), secondTrainingSessionRow()]);
    mocks.trainingAllocationFindMany.mockResolvedValue([
      { trainingSeriesId: "series-1", facilityResource: { id: STANDARD_PITCH.id, code: STANDARD_PITCH.code, name: STANDARD_PITCH.name, type: "FULL_PITCH", facility: { name: STANDARD_PITCH.facility.name } } },
      { trainingSeriesId: "series-2", facilityResource: { id: "res-pitch-3", code: "KR3", name: "Kunstrasen 3", type: "FULL_PITCH", facility: { name: "Sportanlage Bruel" } } },
    ]);
    // Resource override: BOTH sessions moved onto the same Halle.
    mocks.weekplannerPlanAllocationFindMany.mockResolvedValue([
      resourceOverrideRow({ activityId: "session-1" }),
      resourceOverrideRow({ activityId: "session-2" }),
    ]);
    // Time override: shift session-1 (canonically 16:00–17:00) to 18:15–19:15,
    // now overlapping session-2's canonical 18:00–19:00.
    mocks.weekplannerPlanActivityOverrideFindMany.mockResolvedValue([
      timeOverrideRow({
        activityId: "session-1",
        overrideStartAt: new Date("2026-08-10T18:15:00.000Z"),
        overrideEndAt: new Date("2026-08-10T19:15:00.000Z"),
      }),
    ]);

    const weekWithPlan = await getWeekplannerWeek(TENANT_A, WEEK_WINDOW, PLAN_STANDARD_WEATHER);
    const mondayWithPlan = weekWithPlan.days.find((d) => d.dayKey === "2026-08-10")!;
    for (const item of mondayWithPlan.items) {
      expect(item.conflicts).toEqual([{ facilityResourceId: HALLE.id, facilityResourceName: HALLE.name }]);
    }

    // The exact same underlying data, resolved WITHOUT a plan (Standardplan), has no conflict —
    // neither the resource move nor the time shift ever applies there.
    mocks.weekplannerPlanAllocationFindMany.mockResolvedValue([]);
    mocks.weekplannerPlanActivityOverrideFindMany.mockResolvedValue([]);
    const weekStandard = await getWeekplannerWeek(TENANT_A, WEEK_WINDOW);
    const mondayStandard = weekStandard.days.find((d) => d.dayKey === "2026-08-10")!;
    for (const item of mondayStandard.items) expect(item.conflicts).toEqual([]);
  });
});

describe("getWeekplannerWeek — conflict isolation between plans (test 10)", () => {
  it("a different plan (PLAN_OTHER) for the same activities is unaffected by PLAN_STANDARD_WEATHER's time override", async () => {
    mocks.trainingSessionFindMany.mockResolvedValue([trainingSessionRow(), secondTrainingSessionRow()]);
    mocks.trainingAllocationFindMany.mockResolvedValue([
      { trainingSeriesId: "series-1", facilityResource: { id: STANDARD_PITCH.id, code: STANDARD_PITCH.code, name: STANDARD_PITCH.name, type: "FULL_PITCH", facility: { name: STANDARD_PITCH.facility.name } } },
      { trainingSeriesId: "series-2", facilityResource: { id: STANDARD_PITCH.id, code: STANDARD_PITCH.code, name: STANDARD_PITCH.name, type: "FULL_PITCH", facility: { name: STANDARD_PITCH.facility.name } } },
    ]);

    mocks.weekplannerPlanActivityOverrideFindMany.mockImplementation(
      (args: { where?: { weekplannerPlanId?: string } }) => {
        if (args.where?.weekplannerPlanId === PLAN_STANDARD_WEATHER) {
          return Promise.resolve([
            timeOverrideRow({
              activityId: "session-1",
              overrideStartAt: new Date("2026-08-10T18:15:00.000Z"),
              overrideEndAt: new Date("2026-08-10T19:15:00.000Z"),
            }),
          ]);
        }
        return Promise.resolve([]);
      },
    );

    const weekOther = await getWeekplannerWeek(TENANT_A, WEEK_WINDOW, PLAN_OTHER);
    const mondayOther = weekOther.days.find((d) => d.dayKey === "2026-08-10")!;
    expect(mondayOther.items.map((i) => i.timeOverridden)).toEqual([false, false]);
    expect(mondayOther.items.find((i) => i.id === "training:session-1")!.startAt.toISOString()).toBe(
      "2026-08-10T16:00:00.000Z",
    );
  });
});

describe("getWeekplannerWeek — tenant isolation for time overrides (test 11)", () => {
  it("a planId belonging to a different tenant yields zero time overrides — behaves exactly like the Standardplan", async () => {
    mocks.trainingSessionFindMany.mockResolvedValue([trainingSessionRow()]);
    mocks.weekplannerPlanActivityOverrideFindMany.mockResolvedValue([]);

    const week = await getWeekplannerWeek(TENANT_B, WEEK_WINDOW, PLAN_STANDARD_WEATHER);

    expect(mocks.weekplannerPlanActivityOverrideFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: TENANT_B, weekplannerPlanId: PLAN_STANDARD_WEATHER } }),
    );
    expect(week.days.every((d) => d.items.every((i) => !i.timeOverridden))).toBe(true);
  });
});
