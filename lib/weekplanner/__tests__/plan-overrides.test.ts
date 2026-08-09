/**
 * lib/weekplanner/__tests__/plan-overrides.test.ts
 *
 * WEEKPLANNER-01B — focused tests for getWeekplannerWeek()'s plan-override
 * resolution (lib/weekplanner/queries.ts). Covers:
 *   - sparse override fallback to the Standardplan default
 *   - Training / HOME Match / HOME Tournament allocation overrides
 *   - dressing-room (Garderobe) participant-scoped override
 *   - conflict isolation between two different plans for the SAME week
 *   - the canonical TrainingSession/Event/FacilityResource records are
 *     never mutated by this read-only resolution (only findMany is ever
 *     invoked against Prisma)
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

const STANDARD_PITCH = { id: "res-pitch-standard", code: "KR2", name: "Kunstrasen 2", facility: { name: "Sportanlage Bruel" } };
const HALLE = { id: "res-halle", code: "HALLE", name: "Dreifachhalle", facility: { name: "Sportanlage Bruel" } };
const STANDARD_ROOM = { id: "res-room-standard", code: "G1", name: "Garderobe 1", facility: { name: "Garderobentrakt" } };
const ALT_ROOM = { id: "res-room-alt", code: "G3", name: "Garderobe 3", facility: { name: "Garderobentrakt" } };

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

function secondTrainingSessionRow(overrides: Record<string, unknown> = {}) {
  return trainingSessionRow({
    id: "session-2",
    startAt: new Date("2026-08-10T16:15:00.000Z"),
    endAt: new Date("2026-08-10T17:45:00.000Z"),
    trainingSeriesId: "series-2",
    trainingSeries: {
      title: "E3 Training",
      teamSeason: { displayName: "FC Allschwil E3", team: { name: "E3", shortName: null, alternativeName: null } },
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
    homeDressingRoomCode: STANDARD_ROOM.code,
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
              id: STANDARD_ROOM.id,
              code: STANDARD_ROOM.code,
              name: STANDARD_ROOM.name,
              type: "DRESSING_ROOM",
              facilityId: "fac-2",
              facility: { name: STANDARD_ROOM.facility.name },
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
          id: STANDARD_PITCH.id,
          code: STANDARD_PITCH.code,
          name: STANDARD_PITCH.name,
          type: "FULL_PITCH",
          facilityId: "fac-1",
          facility: { name: STANDARD_PITCH.facility.name },
        },
      },
    ],
    ...overrides,
  };
}

/** Raw WeekplannerPlanAllocation override row, as selected by findWeekplannerPlanOverrides(). */
function overrideRow(overrides: Record<string, unknown> = {}) {
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
  mocks.facilityResourceFindMany.mockResolvedValue([STANDARD_PITCH, HALLE, STANDARD_ROOM, ALT_ROOM]);
  mocks.trainingAllocationFindMany.mockResolvedValue([]);
  mocks.trainingSessionAllocationFindMany.mockResolvedValue([]);
  mocks.trainingSessionFindMany.mockResolvedValue([]);
  mocks.eventFindMany.mockResolvedValue([]);
  mocks.weekplannerPlanAllocationFindMany.mockResolvedValue([]);
  mocks.weekplannerPlanActivityOverrideFindMany.mockResolvedValue([]);
});

describe("getWeekplannerWeek — sparse override fallback to Standardplan", () => {
  it("1. omitting planId behaves exactly like WEEKPLANNER-01A — no override lookup, pitchOverridden/dressingRoomOverridden are false", async () => {
    mocks.trainingSessionFindMany.mockResolvedValue([trainingSessionRow()]);
    mocks.trainingAllocationFindMany.mockResolvedValue([
      { trainingSeriesId: "series-1", facilityResource: { id: STANDARD_PITCH.id, code: STANDARD_PITCH.code, name: STANDARD_PITCH.name, type: "FULL_PITCH", facility: { name: STANDARD_PITCH.facility.name } } },
    ]);

    const week = await getWeekplannerWeek(TENANT_A, WEEK_WINDOW);

    expect(mocks.weekplannerPlanAllocationFindMany).not.toHaveBeenCalled();
    const [item] = week.days.find((d) => d.dayKey === "2026-08-10")!.items;
    expect(item.pitchAllocations.map((r) => r.code)).toEqual([STANDARD_PITCH.code]);
    expect(item.pitchOverridden).toBe(false);
    expect(item.dressingRoomOverridden).toBe(false);
  });

  it("2. a plan with zero override rows for an activity falls back to the Standardplan default for every group", async () => {
    mocks.trainingSessionFindMany.mockResolvedValue([trainingSessionRow()]);
    mocks.trainingAllocationFindMany.mockResolvedValue([
      { trainingSeriesId: "series-1", facilityResource: { id: STANDARD_PITCH.id, code: STANDARD_PITCH.code, name: STANDARD_PITCH.name, type: "FULL_PITCH", facility: { name: STANDARD_PITCH.facility.name } } },
    ]);
    mocks.weekplannerPlanAllocationFindMany.mockResolvedValue([]);

    const week = await getWeekplannerWeek(TENANT_A, WEEK_WINDOW, PLAN_STANDARD_WEATHER);

    expect(mocks.weekplannerPlanAllocationFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: TENANT_A, weekplannerPlanId: PLAN_STANDARD_WEATHER } }),
    );
    const [item] = week.days.find((d) => d.dayKey === "2026-08-10")!.items;
    expect(item.pitchAllocations.map((r) => r.code)).toEqual([STANDARD_PITCH.code]);
    expect(item.pitchOverridden).toBe(false);
  });
});

describe("getWeekplannerWeek — Training allocation override", () => {
  it("3. a plan-level PITCH_HALL override for a TrainingSession replaces the Standardplan pitch — only in that plan", async () => {
    mocks.trainingSessionFindMany.mockResolvedValue([trainingSessionRow()]);
    mocks.trainingAllocationFindMany.mockResolvedValue([
      { trainingSeriesId: "series-1", facilityResource: { id: STANDARD_PITCH.id, code: STANDARD_PITCH.code, name: STANDARD_PITCH.name, type: "FULL_PITCH", facility: { name: STANDARD_PITCH.facility.name } } },
    ]);
    mocks.weekplannerPlanAllocationFindMany.mockResolvedValue([
      overrideRow({ activityType: "TRAINING", activityId: "session-1", allocationGroup: "PITCH_HALL" }),
    ]);

    const week = await getWeekplannerWeek(TENANT_A, WEEK_WINDOW, PLAN_STANDARD_WEATHER);
    const [item] = week.days.find((d) => d.dayKey === "2026-08-10")!.items;

    expect(item.pitchAllocations.map((r) => r.code)).toEqual([HALLE.code]);
    expect(item.pitchOverridden).toBe(true);
    expect(item.dressingRoomOverridden).toBe(false);
  });

  it("3b. the SAME TrainingSession's Standardplan allocation is untouched when no planId is passed", async () => {
    mocks.trainingSessionFindMany.mockResolvedValue([trainingSessionRow()]);
    mocks.trainingAllocationFindMany.mockResolvedValue([
      { trainingSeriesId: "series-1", facilityResource: { id: STANDARD_PITCH.id, code: STANDARD_PITCH.code, name: STANDARD_PITCH.name, type: "FULL_PITCH", facility: { name: STANDARD_PITCH.facility.name } } },
    ]);

    const week = await getWeekplannerWeek(TENANT_A, WEEK_WINDOW);
    const [item] = week.days.find((d) => d.dayKey === "2026-08-10")!.items;
    expect(item.pitchAllocations.map((r) => r.code)).toEqual([STANDARD_PITCH.code]);
  });
});

describe("getWeekplannerWeek — HOME Match allocation override", () => {
  it("4. overrides HOME Match Spielfeld/Halle and Garderobe (home side) independently", async () => {
    mocks.eventFindMany.mockImplementation((args: { where?: { type?: string } }) => {
      if (args.where?.type === "MATCH") return Promise.resolve([matchEventRow()]);
      return Promise.resolve([]);
    });
    mocks.weekplannerPlanAllocationFindMany.mockResolvedValue([
      overrideRow({ activityType: "MATCH", activityId: "event-match-1", allocationGroup: "PITCH_HALL" }),
      overrideRow({
        activityType: "MATCH",
        activityId: "event-match-1",
        allocationGroup: "DRESSING_ROOM",
        facilityResource: { id: ALT_ROOM.id, code: ALT_ROOM.code, name: ALT_ROOM.name, facility: { name: ALT_ROOM.facility.name } },
      }),
    ]);

    const week = await getWeekplannerWeek(TENANT_A, WEEK_WINDOW, PLAN_STANDARD_WEATHER);
    const [item] = week.days.find((d) => d.dayKey === "2026-08-15")!.items;
    if (item.type !== "MATCH") throw new Error("expected MATCH");

    expect(item.pitchAllocations.map((r) => r.code)).toEqual([HALLE.code]);
    expect(item.dressingRoomAllocations.map((r) => r.code)).toEqual([ALT_ROOM.code]);
    expect(item.pitchOverridden).toBe(true);
    expect(item.dressingRoomOverridden).toBe(true);
    // Away side is never overridable in this slice — always the legacy/Standardplan value.
    expect(item.awayDressingRoomAllocations).toEqual([]);
  });
});

describe("getWeekplannerWeek — HOME Tournament allocation override (incl. dressing-room participant override)", () => {
  it("5. overrides the tournament's Spielfeld/Halle AND one specific participant's Garderobe, leaving other participants untouched", async () => {
    mocks.eventFindMany.mockImplementation((args: { where?: { type?: string } }) => {
      if (args.where?.type === "TOURNAMENT") return Promise.resolve([tournamentEventRow()]);
      return Promise.resolve([]);
    });
    mocks.weekplannerPlanAllocationFindMany.mockResolvedValue([
      overrideRow({ activityType: "TOURNAMENT", activityId: "event-tournament-1", allocationGroup: "PITCH_HALL" }),
      overrideRow({
        activityType: "TOURNAMENT",
        activityId: "event-tournament-1",
        allocationGroup: "DRESSING_ROOM",
        participantId: "participant-1",
        facilityResource: { id: ALT_ROOM.id, code: ALT_ROOM.code, name: ALT_ROOM.name, facility: { name: ALT_ROOM.facility.name } },
      }),
    ]);

    const week = await getWeekplannerWeek(TENANT_A, WEEK_WINDOW, PLAN_STANDARD_WEATHER);
    const [item] = week.days.find((d) => d.dayKey === "2026-08-15")!.items;
    if (item.type !== "TOURNAMENT") throw new Error("expected TOURNAMENT");

    expect(item.pitchAllocations.map((r) => r.code)).toEqual([HALLE.code]);
    expect(item.pitchOverridden).toBe(true);
    expect(item.participantAllocations).toHaveLength(1);
    expect(item.participantAllocations[0].dressingRoomAllocations.map((r) => r.code)).toEqual([ALT_ROOM.code]);
    expect(item.participantAllocations[0].dressingRoomOverridden).toBe(true);
  });

  it("6. a participant WITHOUT an override row keeps the Standardplan Garderobe", async () => {
    mocks.eventFindMany.mockImplementation((args: { where?: { type?: string } }) => {
      if (args.where?.type === "TOURNAMENT") return Promise.resolve([tournamentEventRow()]);
      return Promise.resolve([]);
    });
    mocks.weekplannerPlanAllocationFindMany.mockResolvedValue([]);

    const week = await getWeekplannerWeek(TENANT_A, WEEK_WINDOW, PLAN_STANDARD_WEATHER);
    const [item] = week.days.find((d) => d.dayKey === "2026-08-15")!.items;
    if (item.type !== "TOURNAMENT") throw new Error("expected TOURNAMENT");

    expect(item.participantAllocations[0].dressingRoomAllocations.map((r) => r.code)).toEqual([STANDARD_ROOM.code]);
    expect(item.participantAllocations[0].dressingRoomOverridden).toBe(false);
  });
});

describe("getWeekplannerWeek — conflict isolation between plans", () => {
  it("7. Standardplan: two TrainingSessions on different pitches never conflict", async () => {
    mocks.trainingSessionFindMany.mockResolvedValue([trainingSessionRow(), secondTrainingSessionRow()]);
    mocks.trainingAllocationFindMany.mockResolvedValue([
      { trainingSeriesId: "series-1", facilityResource: { id: STANDARD_PITCH.id, code: STANDARD_PITCH.code, name: STANDARD_PITCH.name, type: "FULL_PITCH", facility: { name: STANDARD_PITCH.facility.name } } },
      { trainingSeriesId: "series-2", facilityResource: { id: ALT_ROOM.id, code: ALT_ROOM.code, name: "Kunstrasen 3", type: "FULL_PITCH", facility: { name: "Sportanlage Bruel" } } },
    ]);

    const week = await getWeekplannerWeek(TENANT_A, WEEK_WINDOW);
    const monday = week.days.find((d) => d.dayKey === "2026-08-10")!;
    expect(monday.items).toHaveLength(2);
    for (const item of monday.items) expect(item.conflicts).toEqual([]);
  });

  it("8. Schlechtwetterplan: overriding BOTH TrainingSessions onto the same Halle produces a Doppelbelegung — a distinct plan call (Standardplan) is unaffected", async () => {
    mocks.trainingSessionFindMany.mockResolvedValue([trainingSessionRow(), secondTrainingSessionRow()]);
    mocks.trainingAllocationFindMany.mockResolvedValue([
      { trainingSeriesId: "series-1", facilityResource: { id: STANDARD_PITCH.id, code: STANDARD_PITCH.code, name: STANDARD_PITCH.name, type: "FULL_PITCH", facility: { name: STANDARD_PITCH.facility.name } } },
      { trainingSeriesId: "series-2", facilityResource: { id: "res-pitch-3", code: "KR3", name: "Kunstrasen 3", type: "FULL_PITCH", facility: { name: "Sportanlage Bruel" } } },
    ]);
    mocks.weekplannerPlanAllocationFindMany.mockResolvedValue([
      overrideRow({ activityType: "TRAINING", activityId: "session-1", allocationGroup: "PITCH_HALL" }),
      overrideRow({ activityType: "TRAINING", activityId: "session-2", allocationGroup: "PITCH_HALL" }),
    ]);

    const weekWithPlan = await getWeekplannerWeek(TENANT_A, WEEK_WINDOW, PLAN_STANDARD_WEATHER);
    const mondayWithPlan = weekWithPlan.days.find((d) => d.dayKey === "2026-08-10")!;
    expect(mondayWithPlan.items).toHaveLength(2);
    for (const item of mondayWithPlan.items) {
      expect(item.conflicts).toEqual([{ facilityResourceId: HALLE.id, facilityResourceName: HALLE.name }]);
    }

    // The exact same underlying data, resolved WITHOUT a plan (Standardplan), has no conflict.
    mocks.weekplannerPlanAllocationFindMany.mockResolvedValue([]);
    const weekStandard = await getWeekplannerWeek(TENANT_A, WEEK_WINDOW);
    const mondayStandard = weekStandard.days.find((d) => d.dayKey === "2026-08-10")!;
    for (const item of mondayStandard.items) expect(item.conflicts).toEqual([]);
  });

  it("9. a different plan (PLAN_OTHER) for the same activities is unaffected by PLAN_STANDARD_WEATHER's overrides", async () => {
    mocks.trainingSessionFindMany.mockResolvedValue([trainingSessionRow(), secondTrainingSessionRow()]);
    mocks.trainingAllocationFindMany.mockResolvedValue([
      { trainingSeriesId: "series-1", facilityResource: { id: STANDARD_PITCH.id, code: STANDARD_PITCH.code, name: STANDARD_PITCH.name, type: "FULL_PITCH", facility: { name: STANDARD_PITCH.facility.name } } },
      { trainingSeriesId: "series-2", facilityResource: { id: "res-pitch-3", code: "KR3", name: "Kunstrasen 3", type: "FULL_PITCH", facility: { name: "Sportanlage Bruel" } } },
    ]);

    // PLAN_OTHER has zero override rows of its own.
    mocks.weekplannerPlanAllocationFindMany.mockImplementation((args: { where?: { weekplannerPlanId?: string } }) => {
      if (args.where?.weekplannerPlanId === PLAN_STANDARD_WEATHER) {
        return Promise.resolve([
          overrideRow({ activityType: "TRAINING", activityId: "session-1", allocationGroup: "PITCH_HALL" }),
          overrideRow({ activityType: "TRAINING", activityId: "session-2", allocationGroup: "PITCH_HALL" }),
        ]);
      }
      return Promise.resolve([]);
    });

    const weekOther = await getWeekplannerWeek(TENANT_A, WEEK_WINDOW, PLAN_OTHER);
    const mondayOther = weekOther.days.find((d) => d.dayKey === "2026-08-10")!;
    for (const item of mondayOther.items) expect(item.conflicts).toEqual([]);
    expect(mondayOther.items.map((i) => i.pitchOverridden)).toEqual([false, false]);
  });
});

describe("getWeekplannerWeek — tenant isolation for plan overrides", () => {
  it("10. a planId belonging to a different tenant yields zero overrides — behaves exactly like the Standardplan", async () => {
    mocks.trainingSessionFindMany.mockResolvedValue([trainingSessionRow()]);
    mocks.trainingAllocationFindMany.mockResolvedValue([
      { trainingSeriesId: "series-1", facilityResource: { id: STANDARD_PITCH.id, code: STANDARD_PITCH.code, name: STANDARD_PITCH.name, type: "FULL_PITCH", facility: { name: STANDARD_PITCH.facility.name } } },
    ]);
    // The route layer is responsible for tenant-scoping the plan lookup
    // itself; queries.ts additionally scopes the override query by
    // tenantId, so a cross-tenant planId can never surface another
    // tenant's overrides even if it were passed through by mistake.
    mocks.weekplannerPlanAllocationFindMany.mockResolvedValue([]);

    const week = await getWeekplannerWeek(TENANT_B, WEEK_WINDOW, PLAN_STANDARD_WEATHER);
    expect(mocks.weekplannerPlanAllocationFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: TENANT_B, weekplannerPlanId: PLAN_STANDARD_WEATHER } }),
    );
    expect(week.days.every((d) => d.items.every((i) => !i.pitchOverridden))).toBe(true);
  });
});

describe("getWeekplannerWeek — canonical source records remain unchanged", () => {
  it("11. never issues a create/update/delete against any mocked Prisma model — purely read-only", async () => {
    mocks.trainingSessionFindMany.mockResolvedValue([trainingSessionRow()]);
    mocks.eventFindMany.mockImplementation((args: { where?: { type?: string } }) => {
      if (args.where?.type === "MATCH") return Promise.resolve([matchEventRow()]);
      if (args.where?.type === "TOURNAMENT") return Promise.resolve([tournamentEventRow()]);
      return Promise.resolve([]);
    });
    mocks.weekplannerPlanAllocationFindMany.mockResolvedValue([
      overrideRow({ activityType: "TRAINING", activityId: "session-1", allocationGroup: "PITCH_HALL" }),
    ]);

    // Resolves successfully — proving no code path required a mutation
    // method. Every mocked Prisma model in this file exposes ONLY
    // findMany() (see the vi.mock() call above): had queries.ts ever
    // called .create()/.update()/.delete() on TrainingSession, Event,
    // FacilityResource, or WeekplannerPlanAllocation, that call would have
    // thrown "... is not a function" and failed this test.
    await expect(getWeekplannerWeek(TENANT_A, WEEK_WINDOW, PLAN_STANDARD_WEATHER)).resolves.toBeDefined();
    expect(mocks.trainingSessionFindMany).toHaveBeenCalled();
    expect(mocks.weekplannerPlanAllocationFindMany).toHaveBeenCalled();
  });
});
