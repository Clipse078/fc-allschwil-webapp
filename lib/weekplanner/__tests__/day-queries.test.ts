/**
 * lib/weekplanner/__tests__/day-queries.test.ts
 *
 * DAYPLANNER-01A — focused tests for getWeekplannerDay(), the ONE-DAY
 * projection of the exact same canonical + effective planning state
 * getWeekplannerWeek() already resolves (see queries.ts's doc comment).
 *
 * Covers the DAYPLANNER-01A test matrix:
 *   1. selected date filtering
 *   2-4. TRAINING / MATCH / TOURNAMENT appear
 *   5. chronological ordering
 *   6-7. Standardplan uses canonical time + resources
 *   8-9. alternative plan uses effective time + resource overrides
 *   10. Weekplanner and Day Planning resolve identical effective values
 *   11+15. effective time determines the selected day / Europe/Zurich
 *          day-boundary correctness (uses the real, already-tested
 *          resolveTrainingDayWindow — no second date resolver)
 *   12. resource conflict displayed
 *   13. tenant isolation
 *
 * All external dependencies (Prisma) are mocked. No DB access.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { resolveTrainingDayWindow } from "@/lib/training/date-range";

const mocks = vi.hoisted(() => ({
  facilityResourceFindMany: vi.fn(),
  trainingAllocationFindMany: vi.fn(),
  trainingSessionAllocationFindMany: vi.fn(),
  trainingSessionFindMany: vi.fn(),
  eventFindMany: vi.fn(),
  weekplannerPlanAllocationFindMany: vi.fn(),
  weekplannerPlanActivityOverrideFindMany: vi.fn(),
  weekplannerPlanFindFirst: vi.fn(),
  wochenplanPlanFindFirst: vi.fn(),
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
    weekplannerPlan: { findFirst: mocks.weekplannerPlanFindFirst },
    wochenplanPlan: { findFirst: mocks.wochenplanPlanFindFirst },
  },
}));

import { getWeekplannerDay, getWeekplannerWeek, type WeekplannerDayWindow, type WeekplannerWindow } from "../queries";

const TENANT_A = "tenant-a";
const TENANT_B = "tenant-b";
const PLAN_ID = "plan-schlechtwetter";

// Monday 2026-08-10 (Europe/Zurich) — same fixture day used across the Weekplanner test suite.
const DAY_WINDOW: WeekplannerDayWindow = {
  from: new Date("2026-08-09T22:00:00.000Z"), // Monday 00:00 Europe/Zurich
  to: new Date("2026-08-10T21:59:59.999Z"), // Monday 23:59:59.999 Europe/Zurich
  date: "2026-08-10",
  param: "2026-08-10",
  previousParam: "2026-08-09",
  nextParam: "2026-08-11",
};

const WEEK_WINDOW: WeekplannerWindow = {
  from: new Date("2026-08-09T22:00:00.000Z"),
  to: new Date("2026-08-16T21:59:59.999Z"),
  days: ["2026-08-10", "2026-08-11", "2026-08-12", "2026-08-13", "2026-08-14", "2026-08-15", "2026-08-16"],
  param: "2026-08-10",
  previousParam: "2026-08-03",
  nextParam: "2026-08-17",
};

const PITCH_RESOURCE = { id: "res-pitch-1", code: "KUNSTRASEN_1", name: "Kunstrasen 1", facility: { name: "Sportanlage Bruel" } };
const HALLE_RESOURCE = { id: "res-halle", code: "HALLE", name: "Halle Gartenhof", facility: { name: "Sportanlage Bruel" } };
const HOME_ROOM_RESOURCE = { id: "res-room-home", code: "G1", name: "Garderobe 1", facility: { name: "Garderobentrakt" } };
const AWAY_ROOM_RESOURCE = { id: "res-room-away", code: "G2", name: "Garderobe 2", facility: { name: "Garderobentrakt" } };

function trainingSessionRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "session-1",
    tenantId: TENANT_A,
    trainingSeriesId: "series-1",
    teamSeasonId: "teamseason-1",
    date: new Date("2026-08-10T00:00:00.000Z"),
    weekday: "MONDAY",
    startAt: new Date("2026-08-10T16:00:00.000Z"),
    endAt: new Date("2026-08-10T17:30:00.000Z"),
    timezone: "Europe/Zurich",
    status: "SCHEDULED",
    overrideDate: null,
    overrideStartAt: null,
    overrideEndAt: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    trainingSeries: {
      title: "E2 Training",
      teamSeason: { displayName: "FC Allschwil E2", team: { name: "E2", shortName: null, alternativeName: null } },
    },
    ...overrides,
  };
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
    startAt: new Date("2026-08-10T18:00:00.000Z"),
    endAt: new Date("2026-08-10T19:30:00.000Z"),
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
    pitchCode: PITCH_RESOURCE.code,
    homeDressingRoomCode: HOME_ROOM_RESOURCE.code,
    awayDressingRoomCode: AWAY_ROOM_RESOURCE.code,
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
    startAt: new Date("2026-08-10T08:00:00.000Z"),
    endAt: new Date("2026-08-10T16:00:00.000Z"),
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
    tournamentParticipants: [
      {
        id: "participant-1",
        eventId: "event-tournament-1",
        teamId: "team-own",
        externalTeamId: null,
        manualLabel: null,
        displayOrder: 0,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
        team: { id: "team-own", name: "FC Allschwil E1", slug: "fca-e1", category: "JUNIOREN", genderGroup: null, ageGroup: "E" },
        externalTeam: null,
        dressingRoomAllocations: [
          {
            id: "participant-alloc-1",
            notes: null,
            displayOrder: 0,
            facilityResource: {
              id: HOME_ROOM_RESOURCE.id,
              code: HOME_ROOM_RESOURCE.code,
              name: HOME_ROOM_RESOURCE.name,
              type: "DRESSING_ROOM",
              facilityId: "fac-2",
              facility: { name: HOME_ROOM_RESOURCE.facility.name },
            },
          },
        ],
      },
    ],
    tournamentResourceAllocations: [
      {
        id: "resource-alloc-1",
        notes: null,
        displayOrder: 0,
        facilityResource: {
          id: PITCH_RESOURCE.id,
          code: PITCH_RESOURCE.code,
          name: PITCH_RESOURCE.name,
          type: "FULL_PITCH",
          facilityId: "fac-1",
          facility: { name: PITCH_RESOURCE.facility.name },
        },
      },
    ],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.facilityResourceFindMany.mockResolvedValue([PITCH_RESOURCE, HALLE_RESOURCE, HOME_ROOM_RESOURCE, AWAY_ROOM_RESOURCE]);
  mocks.trainingAllocationFindMany.mockResolvedValue([]);
  mocks.trainingSessionAllocationFindMany.mockResolvedValue([]);
  mocks.trainingSessionFindMany.mockResolvedValue([]);
  mocks.eventFindMany.mockResolvedValue([]);
  mocks.weekplannerPlanAllocationFindMany.mockResolvedValue([]);
  mocks.weekplannerPlanActivityOverrideFindMany.mockResolvedValue([]);
  mocks.weekplannerPlanFindFirst.mockResolvedValue({ wochenplanPlanId: null });
  mocks.wochenplanPlanFindFirst.mockResolvedValue(null);
});

describe("getWeekplannerDay — selected date filtering", () => {
  it("only surfaces items for the selected day, excluding items on other days", async () => {
    mocks.trainingSessionFindMany.mockResolvedValue([trainingSessionRow()]);

    const day = await getWeekplannerDay(TENANT_A, DAY_WINDOW);
    expect(day.dayKey).toBe("2026-08-10");
    expect(day.items).toHaveLength(1);

    const tuesday = await getWeekplannerDay(TENANT_A, {
      ...DAY_WINDOW,
      from: new Date("2026-08-10T22:00:00.000Z"),
      to: new Date("2026-08-11T21:59:59.999Z"),
      date: "2026-08-11",
      param: "2026-08-11",
    });
    expect(tuesday.items).toHaveLength(0);
  });
});

describe("getWeekplannerDay — TRAINING / MATCH / TOURNAMENT appear", () => {
  it("surfaces a TRAINING item", async () => {
    mocks.trainingSessionFindMany.mockResolvedValue([trainingSessionRow()]);
    const day = await getWeekplannerDay(TENANT_A, DAY_WINDOW);
    expect(day.items.map((i) => i.type)).toEqual(["TRAINING"]);
  });

  it("surfaces a HOME MATCH item", async () => {
    mocks.eventFindMany.mockImplementation((args: { where?: { type?: string } }) =>
      Promise.resolve(args.where?.type === "MATCH" ? [matchEventRow()] : []),
    );
    const day = await getWeekplannerDay(TENANT_A, DAY_WINDOW);
    expect(day.items.map((i) => i.type)).toEqual(["MATCH"]);
  });

  it("surfaces a HOME TOURNAMENT item", async () => {
    mocks.eventFindMany.mockImplementation((args: { where?: { type?: string } }) =>
      Promise.resolve(args.where?.type === "TOURNAMENT" ? [tournamentEventRow()] : []),
    );
    const day = await getWeekplannerDay(TENANT_A, DAY_WINDOW);
    expect(day.items.map((i) => i.type)).toEqual(["TOURNAMENT"]);
  });
});

describe("getWeekplannerDay — chronological ordering", () => {
  it("orders TRAINING, TOURNAMENT and MATCH items by effective start time", async () => {
    mocks.trainingSessionFindMany.mockResolvedValue([trainingSessionRow()]); // 16:00
    mocks.eventFindMany.mockImplementation((args: { where?: { type?: string } }) => {
      if (args.where?.type === "MATCH") return Promise.resolve([matchEventRow()]); // 18:00
      if (args.where?.type === "TOURNAMENT") return Promise.resolve([tournamentEventRow()]); // 08:00
      return Promise.resolve([]);
    });

    const day = await getWeekplannerDay(TENANT_A, DAY_WINDOW);
    expect(day.items.map((i) => i.type)).toEqual(["TOURNAMENT", "TRAINING", "MATCH"]);
    for (let i = 1; i < day.items.length; i++) {
      expect(day.items[i].startAt.getTime()).toBeGreaterThanOrEqual(day.items[i - 1].startAt.getTime());
    }
  });
});

describe("getWeekplannerDay — Standardplan uses canonical values", () => {
  it("uses the canonical time and resources when no plan is selected", async () => {
    mocks.trainingSessionFindMany.mockResolvedValue([trainingSessionRow()]);
    mocks.trainingAllocationFindMany.mockResolvedValue([
      { trainingSeriesId: "series-1", facilityResource: { id: PITCH_RESOURCE.id, code: PITCH_RESOURCE.code, name: PITCH_RESOURCE.name, type: "FULL_PITCH", facility: { name: PITCH_RESOURCE.facility.name } } },
    ]);

    const day = await getWeekplannerDay(TENANT_A, DAY_WINDOW);
    const [item] = day.items;
    expect(item.startAt).toEqual(new Date("2026-08-10T16:00:00.000Z"));
    expect(item.endAt).toEqual(new Date("2026-08-10T17:30:00.000Z"));
    expect(item.timeOverridden).toBe(false);
    expect(item.pitchAllocations.map((r) => r.code)).toEqual([PITCH_RESOURCE.code]);
    expect(item.pitchOverridden).toBe(false);
  });
});

describe("getWeekplannerDay — alternative plan uses effective overrides", () => {
  it("uses the plan's effective TIME override, not the canonical time", async () => {
    mocks.trainingSessionFindMany.mockResolvedValue([trainingSessionRow()]);
    mocks.weekplannerPlanActivityOverrideFindMany.mockResolvedValue([
      {
        activityType: "TRAINING",
        activityId: "session-1",
        overrideStartAt: new Date("2026-08-10T15:30:00.000Z"),
        overrideEndAt: new Date("2026-08-10T16:30:00.000Z"),
      },
    ]);

    const day = await getWeekplannerDay(TENANT_A, DAY_WINDOW, PLAN_ID);
    const [item] = day.items;
    expect(item.startAt).toEqual(new Date("2026-08-10T15:30:00.000Z"));
    expect(item.endAt).toEqual(new Date("2026-08-10T16:30:00.000Z"));
    expect(item.timeOverridden).toBe(true);
    expect(item.canonicalStartAt).toEqual(new Date("2026-08-10T16:00:00.000Z"));
  });

  it("uses the plan's effective RESOURCE override, not the canonical resource — the Schlechtwetterplan example from the product spec", async () => {
    mocks.trainingSessionFindMany.mockResolvedValue([trainingSessionRow()]);
    mocks.trainingAllocationFindMany.mockResolvedValue([
      { trainingSeriesId: "series-1", facilityResource: { id: PITCH_RESOURCE.id, code: PITCH_RESOURCE.code, name: PITCH_RESOURCE.name, type: "FULL_PITCH", facility: { name: PITCH_RESOURCE.facility.name } } },
    ]);
    mocks.weekplannerPlanAllocationFindMany.mockResolvedValue([
      {
        activityType: "TRAINING",
        activityId: "session-1",
        allocationGroup: "PITCH_HALL",
        participantId: "",
        facilityResource: { id: HALLE_RESOURCE.id, code: HALLE_RESOURCE.code, name: HALLE_RESOURCE.name, facility: { name: HALLE_RESOURCE.facility.name } },
      },
    ]);
    mocks.weekplannerPlanActivityOverrideFindMany.mockResolvedValue([
      { activityType: "TRAINING", activityId: "session-1", overrideStartAt: new Date("2026-08-10T15:30:00.000Z"), overrideEndAt: new Date("2026-08-10T16:30:00.000Z") },
    ]);

    const day = await getWeekplannerDay(TENANT_A, DAY_WINDOW, PLAN_ID);
    const [item] = day.items;
    expect(item.pitchAllocations.map((r) => r.code)).toEqual([HALLE_RESOURCE.code]);
    expect(item.pitchOverridden).toBe(true);
    expect(item.canonicalPitchAllocations.map((r) => r.code)).toEqual([PITCH_RESOURCE.code]);
    expect(item.startAt).toEqual(new Date("2026-08-10T15:30:00.000Z"));
  });
});

describe("getWeekplannerDay — Weekplanner/Day Planning parity", () => {
  it("resolves byte-for-byte identical effective time/resources as getWeekplannerWeek for the same tenant + plan + day", async () => {
    mocks.trainingSessionFindMany.mockResolvedValue([trainingSessionRow()]);
    mocks.trainingAllocationFindMany.mockResolvedValue([
      { trainingSeriesId: "series-1", facilityResource: { id: PITCH_RESOURCE.id, code: PITCH_RESOURCE.code, name: PITCH_RESOURCE.name, type: "FULL_PITCH", facility: { name: PITCH_RESOURCE.facility.name } } },
    ]);
    mocks.weekplannerPlanAllocationFindMany.mockResolvedValue([
      {
        activityType: "TRAINING",
        activityId: "session-1",
        allocationGroup: "PITCH_HALL",
        participantId: "",
        facilityResource: { id: HALLE_RESOURCE.id, code: HALLE_RESOURCE.code, name: HALLE_RESOURCE.name, facility: { name: HALLE_RESOURCE.facility.name } },
      },
    ]);
    mocks.weekplannerPlanActivityOverrideFindMany.mockResolvedValue([
      { activityType: "TRAINING", activityId: "session-1", overrideStartAt: new Date("2026-08-10T15:30:00.000Z"), overrideEndAt: new Date("2026-08-10T16:30:00.000Z") },
    ]);

    const week = await getWeekplannerWeek(TENANT_A, WEEK_WINDOW, PLAN_ID);
    const day = await getWeekplannerDay(TENANT_A, DAY_WINDOW, PLAN_ID);

    const weekMonday = week.days.find((d) => d.dayKey === "2026-08-10")!;
    expect(day.items).toEqual(weekMonday.items);
  });
});

describe("getWeekplannerDay — effective time determines the selected day (Europe/Zurich boundary)", () => {
  it("a session just before Zurich midnight stays on today; nothing spills into tomorrow's window", async () => {
    mocks.trainingSessionFindMany.mockResolvedValue([
      trainingSessionRow({ startAt: new Date("2026-08-10T21:00:00.000Z"), endAt: new Date("2026-08-10T21:45:00.000Z") }), // 23:00 Europe/Zurich (CEST, UTC+2)
    ]);

    const today = resolveTrainingDayWindow({ dayParam: "2026-08-10", timeZone: "Europe/Zurich" });
    const tomorrow = resolveTrainingDayWindow({ dayParam: "2026-08-11", timeZone: "Europe/Zurich" });

    const dayToday = await getWeekplannerDay(TENANT_A, { ...today, date: today.param });
    const dayTomorrow = await getWeekplannerDay(TENANT_A, { ...tomorrow, date: tomorrow.param });

    expect(dayToday.items).toHaveLength(1);
    expect(dayTomorrow.items).toHaveLength(0);
  });
});

describe("getWeekplannerDay — resource conflict displayed", () => {
  it("flags two same-day items sharing a FacilityResource for an overlapping window", async () => {
    mocks.trainingSessionFindMany.mockResolvedValue([
      trainingSessionRow({ startAt: new Date("2026-08-10T17:45:00.000Z"), endAt: new Date("2026-08-10T19:00:00.000Z") }),
    ]);
    mocks.trainingAllocationFindMany.mockResolvedValue([
      { trainingSeriesId: "series-1", facilityResource: { id: PITCH_RESOURCE.id, code: PITCH_RESOURCE.code, name: PITCH_RESOURCE.name, type: "FULL_PITCH", facility: { name: PITCH_RESOURCE.facility.name } } },
    ]);
    mocks.eventFindMany.mockImplementation((args: { where?: { type?: string } }) =>
      Promise.resolve(args.where?.type === "MATCH" ? [matchEventRow()] : []), // 18:00–19:30, same pitch code
    );

    const day = await getWeekplannerDay(TENANT_A, DAY_WINDOW);
    expect(day.items).toHaveLength(2);
    for (const item of day.items) {
      expect(item.conflicts).toEqual([{ facilityResourceId: PITCH_RESOURCE.id, facilityResourceName: PITCH_RESOURCE.name }]);
    }
  });
});

describe("getWeekplannerDay — tenant isolation", () => {
  it("scopes every underlying query by the given tenantId, never leaking a foreign tenant's plan overrides", async () => {
    mocks.trainingSessionFindMany.mockResolvedValue([trainingSessionRow()]);

    await getWeekplannerDay(TENANT_B, DAY_WINDOW, PLAN_ID);

    expect(mocks.trainingSessionFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ tenantId: TENANT_B }) }));
    expect(mocks.weekplannerPlanAllocationFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId: TENANT_B, weekplannerPlanId: PLAN_ID }) }),
    );
    expect(mocks.weekplannerPlanActivityOverrideFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId: TENANT_B, weekplannerPlanId: PLAN_ID }) }),
    );
    for (const call of mocks.eventFindMany.mock.calls) {
      expect(call[0]).toEqual(expect.objectContaining({ where: expect.objectContaining({ tenantId: TENANT_B }) }));
    }
  });
});
