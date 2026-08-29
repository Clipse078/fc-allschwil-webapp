/**
 * WOCHENPLAN-2.0-01H-E7 — availability integration tests.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  weekplannerPlanAllocationFindMany: vi.fn(),
  weekplannerPlanActivityOverrideFindMany: vi.fn(),
  weekplannerPlanFindFirst: vi.fn(),
  wochenplanPlanFindFirst: vi.fn(),
  trainingSessionFindMany: vi.fn(),
  trainingAllocationFindMany: vi.fn(),
  trainingSessionAllocationFindMany: vi.fn(),
  eventFindMany: vi.fn(),
  listMatchcenterMatches: vi.fn(),
  listTournaments: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    weekplannerPlanAllocation: { findMany: mocks.weekplannerPlanAllocationFindMany },
    weekplannerPlanActivityOverride: { findMany: mocks.weekplannerPlanActivityOverrideFindMany },
    weekplannerPlan: { findFirst: mocks.weekplannerPlanFindFirst },
    wochenplanPlan: { findFirst: mocks.wochenplanPlanFindFirst },
    trainingSession: { findMany: mocks.trainingSessionFindMany },
    trainingAllocation: { findMany: mocks.trainingAllocationFindMany },
    trainingSessionAllocation: { findMany: mocks.trainingSessionAllocationFindMany },
    event: { findMany: mocks.eventFindMany },
  },
}));

vi.mock("@/lib/matchcenter/query-service", () => ({
  listMatchcenterMatches: mocks.listMatchcenterMatches,
}));

vi.mock("@/lib/tournaments/tournament-service", () => ({
  listTournaments: mocks.listTournaments,
}));

import {
  findWeekplannerReplacedActivities,
  findWeekplannerPlanConflicts,
} from "../availability-integration";

const TENANT = "tenant-a";
const PLAN_ID = "plan-1";
const PITCH_ID = "res-kr2a";
const ROOM_ID = "res-e1";

const resourceByCode = new Map([
  [
    "KR2_A",
    {
      facilityResourceId: PITCH_ID,
      code: "KR2_A",
      name: "Kunstrasen 2 A",
      facilityName: "Kunstrasen 2",
      occupancyBeforeMinutes: 0,
      occupancyAfterMinutes: 0,
    },
  ],
  [
    "E1",
    {
      facilityResourceId: ROOM_ID,
      code: "E1",
      name: "Garderobe E1",
      facilityName: "Garderobentrakt",
      occupancyBeforeMinutes: 0,
      occupancyAfterMinutes: 0,
    },
  ],
]);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.weekplannerPlanFindFirst.mockResolvedValue({ id: PLAN_ID });
  mocks.wochenplanPlanFindFirst.mockResolvedValue({ description: null });
  mocks.weekplannerPlanAllocationFindMany.mockResolvedValue([]);
  mocks.weekplannerPlanActivityOverrideFindMany.mockResolvedValue([]);
  mocks.trainingSessionAllocationFindMany.mockResolvedValue([]);
  mocks.listMatchcenterMatches.mockResolvedValue([]);
  mocks.listTournaments.mockResolvedValue([]);
});

describe("findWeekplannerReplacedActivities", () => {
  beforeEach(() => {
    mocks.weekplannerPlanAllocationFindMany.mockResolvedValue([
      { activityType: "TRAINING", activityId: "session-1" },
    ]);
    mocks.weekplannerPlanActivityOverrideFindMany.mockResolvedValue([
      { activityType: "MATCH", activityId: "match-1" },
    ]);
  });

  it("includes activities with allocation and time overrides", async () => {
    const replaced = await findWeekplannerReplacedActivities(TENANT, PLAN_ID, "PITCH_HALL");
    expect(replaced.has("TRAINING:session-1")).toBe(true);
    expect(replaced.has("MATCH:match-1")).toBe(true);
  });
});

describe("findWeekplannerPlanConflicts — effective plan occupancy", () => {
  it("reports canonical-fallback pitch occupancy when no plan override rows exist", async () => {
    mocks.trainingSessionFindMany.mockResolvedValue([
      {
        id: "session-a",
        startAt: new Date("2026-08-10T15:00:00.000Z"),
        endAt: new Date("2026-08-10T16:30:00.000Z"),
        trainingSeriesId: "series-a",
        trainingSeries: { title: "Junioren F2" },
      },
      {
        id: "session-b",
        startAt: new Date("2026-08-10T15:00:00.000Z"),
        endAt: new Date("2026-08-10T16:00:00.000Z"),
        trainingSeriesId: "series-b",
        trainingSeries: { title: "Frauen 1" },
      },
    ]);
    mocks.trainingAllocationFindMany.mockResolvedValue([
      {
        trainingSeriesId: "series-a",
        facilityResource: {
          id: PITCH_ID,
          code: "KR2_A",
          name: "Kunstrasen 2 A",
          type: "HALF_PITCH",
          facility: { name: "Kunstrasen 2" },
        },
      },
      {
        trainingSeriesId: "series-b",
        facilityResource: {
          id: PITCH_ID,
          code: "KR2_A",
          name: "Kunstrasen 2 A",
          type: "HALF_PITCH",
          facility: { name: "Kunstrasen 2" },
        },
      },
    ]);

    const conflicts = await findWeekplannerPlanConflicts(
      TENANT,
      new Date("2026-08-10T15:00:00.000Z"),
      new Date("2026-08-10T16:00:00.000Z"),
      "PITCH_HALL",
      {
        weekplannerPlanId: PLAN_ID,
        excludeActivityType: "TRAINING",
        excludeActivityId: "session-b",
      },
      resourceByCode,
    );

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]).toMatchObject({
      resourceId: PITCH_ID,
      label: "Junioren F2",
      sourceType: "TRAINING",
    });
  });

  it("excludes only the edited activity (self booking)", async () => {
    mocks.trainingSessionFindMany.mockResolvedValue([
      {
        id: "session-a",
        startAt: new Date("2026-08-10T15:00:00.000Z"),
        endAt: new Date("2026-08-10T16:30:00.000Z"),
        trainingSeriesId: "series-a",
        trainingSeries: { title: "Junioren F2" },
      },
    ]);
    mocks.trainingAllocationFindMany.mockResolvedValue([
      {
        trainingSeriesId: "series-a",
        facilityResource: {
          id: PITCH_ID,
          code: "KR2_A",
          name: "Kunstrasen 2 A",
          type: "HALF_PITCH",
          facility: { name: "Kunstrasen 2" },
        },
      },
    ]);

    const conflicts = await findWeekplannerPlanConflicts(
      TENANT,
      new Date("2026-08-10T15:00:00.000Z"),
      new Date("2026-08-10T16:30:00.000Z"),
      "PITCH_HALL",
      {
        weekplannerPlanId: PLAN_ID,
        excludeActivityType: "TRAINING",
        excludeActivityId: "session-a",
      },
      resourceByCode,
    );

    expect(conflicts).toHaveLength(0);
  });

  it("uses plan allocation override instead of canonical for occupied pitch", async () => {
    mocks.weekplannerPlanAllocationFindMany.mockResolvedValue([
      {
        activityType: "TRAINING",
        activityId: "session-a",
        allocationGroup: "PITCH_HALL",
        participantId: "",
        occupancyBeforeMinutes: 0,
        occupancyAfterMinutes: 0,
        facilityResource: {
          id: PITCH_ID,
          code: "KR2_A",
          name: "Kunstrasen 2 A",
          type: "HALF_PITCH",
          facility: { name: "Kunstrasen 2" },
        },
      },
    ]);
    mocks.trainingSessionFindMany.mockResolvedValue([
      {
        id: "session-a",
        startAt: new Date("2026-08-10T15:00:00.000Z"),
        endAt: new Date("2026-08-10T16:30:00.000Z"),
        trainingSeriesId: "series-a",
        trainingSeries: { title: "Junioren F2" },
      },
    ]);
    mocks.trainingAllocationFindMany.mockResolvedValue([]);

    const conflicts = await findWeekplannerPlanConflicts(
      TENANT,
      new Date("2026-08-10T15:00:00.000Z"),
      new Date("2026-08-10T16:00:00.000Z"),
      "PITCH_HALL",
      { weekplannerPlanId: PLAN_ID },
      resourceByCode,
    );

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]?.resourceId).toBe(PITCH_ID);
  });

  it("scopes conflicts to the requested plan id", async () => {
    await findWeekplannerPlanConflicts(
      TENANT,
      new Date("2026-08-10T15:00:00.000Z"),
      new Date("2026-08-10T16:30:00.000Z"),
      "PITCH_HALL",
      { weekplannerPlanId: PLAN_ID },
      resourceByCode,
    );

    expect(mocks.weekplannerPlanAllocationFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ weekplannerPlanId: PLAN_ID }),
      }),
    );
  });

  it("reports canonical-fallback dressing-room occupancy when no plan override rows exist", async () => {
    mocks.trainingSessionFindMany.mockResolvedValue([
      {
        id: "session-a",
        startAt: new Date("2026-08-10T15:00:00.000Z"),
        endAt: new Date("2026-08-10T16:30:00.000Z"),
        trainingSeriesId: "series-a",
        trainingSeries: { title: "Junioren F2" },
      },
      {
        id: "session-b",
        startAt: new Date("2026-08-10T15:15:00.000Z"),
        endAt: new Date("2026-08-10T18:45:00.000Z"),
        trainingSeriesId: "series-b",
        trainingSeries: { title: "Frauen 1" },
      },
    ]);
    mocks.trainingAllocationFindMany.mockResolvedValue([
      {
        trainingSeriesId: "series-a",
        facilityResource: {
          id: ROOM_ID,
          code: "E1",
          name: "Garderobe E1",
          type: "DRESSING_ROOM",
          facility: { name: "Garderobentrakt" },
        },
      },
    ]);

    const conflicts = await findWeekplannerPlanConflicts(
      TENANT,
      new Date("2026-08-10T15:15:00.000Z"),
      new Date("2026-08-10T18:45:00.000Z"),
      "DRESSING_ROOM",
      {
        weekplannerPlanId: PLAN_ID,
        excludeActivityType: "TRAINING",
        excludeActivityId: "session-b",
      },
      resourceByCode,
    );

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]).toMatchObject({
      resourceId: ROOM_ID,
      label: "Junioren F2",
      sourceType: "TRAINING",
    });
  });

  it("uses TrainingCenter occurrence time overrides before plan time overrides", async () => {
    mocks.trainingSessionFindMany.mockResolvedValue([
      {
        id: "session-a",
        startAt: new Date("2026-08-10T10:00:00.000Z"),
        endAt: new Date("2026-08-10T11:00:00.000Z"),
        overrideStartAt: new Date("2026-08-10T15:00:00.000Z"),
        overrideEndAt: new Date("2026-08-10T16:30:00.000Z"),
        trainingSeriesId: "series-a",
        trainingSeries: { title: "Junioren F2" },
      },
    ]);
    mocks.trainingAllocationFindMany.mockResolvedValue([
      {
        trainingSeriesId: "series-a",
        facilityResource: {
          id: ROOM_ID,
          code: "E1",
          name: "Garderobe E1",
          type: "DRESSING_ROOM",
          facility: { name: "Garderobentrakt" },
        },
      },
    ]);

    const conflicts = await findWeekplannerPlanConflicts(
      TENANT,
      new Date("2026-08-10T15:15:00.000Z"),
      new Date("2026-08-10T16:00:00.000Z"),
      "DRESSING_ROOM",
      { weekplannerPlanId: PLAN_ID },
      resourceByCode,
    );

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]?.startAt.toISOString()).toBe("2026-08-10T15:00:00.000Z");
    expect(conflicts[0]?.endAt.toISOString()).toBe("2026-08-10T16:30:00.000Z");
  });

  it("applies buffer-only dressing-room override occupancy windows", async () => {
    mocks.weekplannerPlanAllocationFindMany.mockResolvedValue([
      {
        activityType: "TRAINING",
        activityId: "session-a",
        allocationGroup: "DRESSING_ROOM",
        participantId: "",
        occupancyBeforeMinutes: 45,
        occupancyAfterMinutes: 30,
        facilityResource: {
          id: ROOM_ID,
          code: "E1",
          name: "Garderobe E1",
          type: "DRESSING_ROOM",
          facility: { name: "Garderobentrakt" },
        },
      },
    ]);
    mocks.trainingSessionFindMany.mockResolvedValue([
      {
        id: "session-a",
        startAt: new Date("2026-08-10T17:00:00.000Z"),
        endAt: new Date("2026-08-10T18:30:00.000Z"),
        overrideStartAt: null,
        overrideEndAt: null,
        trainingSeriesId: "series-a",
        trainingSeries: { title: "Junioren F2" },
      },
    ]);
    mocks.trainingAllocationFindMany.mockResolvedValue([
      {
        trainingSeriesId: "series-a",
        facilityResource: {
          id: ROOM_ID,
          code: "E1",
          name: "Garderobe E1",
          type: "DRESSING_ROOM",
          facility: { name: "Garderobentrakt" },
        },
      },
    ]);

    const conflicts = await findWeekplannerPlanConflicts(
      TENANT,
      new Date("2026-08-10T16:20:00.000Z"),
      new Date("2026-08-10T16:25:00.000Z"),
      "DRESSING_ROOM",
      { weekplannerPlanId: PLAN_ID },
      resourceByCode,
    );

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]?.startAt.toISOString()).toBe("2026-08-10T16:15:00.000Z");
    expect(conflicts[0]?.endAt.toISOString()).toBe("2026-08-10T19:00:00.000Z");
  });
});
