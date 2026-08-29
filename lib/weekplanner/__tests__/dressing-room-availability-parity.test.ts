/**
 * WOCHENPLAN-2.0-01H-E9 — TrainingCenter vs Wochenplanner dressing-room parity.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  facilityResourceFindMany: vi.fn(),
  trainingSessionFindMany: vi.fn(),
  trainingAllocationFindMany: vi.fn(),
  trainingSessionAllocationFindMany: vi.fn(),
  eventFindMany: vi.fn(),
  tournamentResourceAllocationFindMany: vi.fn(),
  tournamentParticipantAllocationFindMany: vi.fn(),
  weekplannerPlanAllocationFindMany: vi.fn(),
  weekplannerPlanActivityOverrideFindMany: vi.fn(),
  weekplannerPlanFindFirst: vi.fn(),
  wochenplanPlanFindFirst: vi.fn(),
  listMatchcenterMatches: vi.fn(),
  listTournaments: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    facilityResource: { findMany: mocks.facilityResourceFindMany },
    trainingSession: { findMany: mocks.trainingSessionFindMany },
    trainingAllocation: { findMany: mocks.trainingAllocationFindMany },
    trainingSessionAllocation: { findMany: mocks.trainingSessionAllocationFindMany },
    event: { findMany: mocks.eventFindMany },
    tournamentResourceAllocation: { findMany: mocks.tournamentResourceAllocationFindMany },
    tournamentParticipantAllocation: { findMany: mocks.tournamentParticipantAllocationFindMany },
    weekplannerPlanAllocation: { findMany: mocks.weekplannerPlanAllocationFindMany },
    weekplannerPlanActivityOverride: { findMany: mocks.weekplannerPlanActivityOverrideFindMany },
    weekplannerPlan: { findFirst: mocks.weekplannerPlanFindFirst },
    wochenplanPlan: { findFirst: mocks.wochenplanPlanFindFirst },
  },
}));

vi.mock("@/lib/matchcenter/query-service", () => ({
  listMatchcenterMatches: mocks.listMatchcenterMatches,
}));

vi.mock("@/lib/tournaments/tournament-service", () => ({
  listTournaments: mocks.listTournaments,
}));

import { getResourceAvailability } from "@/lib/facilities/availability-service";

const TENANT = "tenant-a";
const PLAN_ID = "plan-1";
const ROOM_ID = "res-e1";

const ROOM = {
  id: ROOM_ID,
  name: "Garderobe E1",
  code: "E1",
  type: "DRESSING_ROOM",
  facilityId: "fac-2",
  facility: { name: "Garderobentrakt" },
};

function seedSharedOccupancyState() {
  mocks.facilityResourceFindMany.mockResolvedValue([ROOM]);
  mocks.eventFindMany.mockResolvedValue([]);
  mocks.tournamentResourceAllocationFindMany.mockResolvedValue([]);
  mocks.tournamentParticipantAllocationFindMany.mockResolvedValue([]);
  mocks.listMatchcenterMatches.mockResolvedValue([]);
  mocks.listTournaments.mockResolvedValue([]);
  mocks.weekplannerPlanFindFirst.mockResolvedValue({ id: PLAN_ID });
  mocks.wochenplanPlanFindFirst.mockResolvedValue({ description: null });
  mocks.weekplannerPlanAllocationFindMany.mockResolvedValue([]);
  mocks.weekplannerPlanActivityOverrideFindMany.mockResolvedValue([]);
  mocks.trainingSessionAllocationFindMany.mockResolvedValue([]);

  mocks.trainingSessionFindMany.mockResolvedValue([
    {
      id: "session-a",
      trainingSeriesId: "series-a",
      startAt: new Date("2026-08-10T10:00:00.000Z"),
      endAt: new Date("2026-08-10T11:00:00.000Z"),
      overrideStartAt: new Date("2026-08-10T15:00:00.000Z"),
      overrideEndAt: new Date("2026-08-10T16:30:00.000Z"),
      trainingSeries: {
        title: "Junioren F2",
        allocations: [{ facilityResourceId: ROOM_ID, facilityResource: { type: "DRESSING_ROOM" } }],
      },
      sessionAllocations: [],
    },
    {
      id: "session-b",
      trainingSeriesId: "series-b",
      startAt: new Date("2026-08-10T15:15:00.000Z"),
      endAt: new Date("2026-08-10T18:45:00.000Z"),
      overrideStartAt: null,
      overrideEndAt: null,
      trainingSeries: {
        title: "Frauen 1",
        allocations: [],
      },
      sessionAllocations: [],
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
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("TrainingCenter vs Wochenplanner dressing-room parity", () => {
  it("reports the same E1 occupant for session B in both paths", async () => {
    seedSharedOccupancyState();

    const query = {
      tenantId: TENANT,
      startAt: "2026-08-10T15:15:00.000Z",
      endAt: "2026-08-10T18:45:00.000Z",
      group: "DRESSING_ROOM" as const,
      excludeTrainingSessionId: "session-b",
    };

    const trainingCenter = await getResourceAvailability(query);
    const weekplanner = await getResourceAvailability({
      ...query,
      weekplannerPlanId: PLAN_ID,
      excludeWeekplannerActivityType: "TRAINING",
      excludeWeekplannerActivityId: "session-b",
    });

    const tcRoom = trainingCenter.find((row) => row.resourceId === ROOM_ID);
    const wpRoom = weekplanner.find((row) => row.resourceId === ROOM_ID);

    expect(tcRoom?.status).toBe("OCCUPIED");
    expect(wpRoom?.status).toBe("OCCUPIED");
    expect(tcRoom?.conflictLabel).toBe("Junioren F2");
    expect(wpRoom?.conflictLabel).toBe("Junioren F2");
    expect(tcRoom?.conflictStartAt).toBe("2026-08-10T15:00:00.000Z");
    expect(wpRoom?.conflictStartAt).toBe("2026-08-10T15:00:00.000Z");
    expect(tcRoom?.conflictEndAt).toBe("2026-08-10T16:30:00.000Z");
    expect(wpRoom?.conflictEndAt).toBe("2026-08-10T16:30:00.000Z");
  });
});
