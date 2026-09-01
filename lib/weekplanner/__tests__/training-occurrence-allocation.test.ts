/**
 * WOCHENPLAN-CANONICAL-UPSTREAM-01 — weekplanner occurrence allocation tests.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrainingSessionDto } from "@/lib/training/types";
import { getWeekplannerWeek } from "../queries";

const mocks = vi.hoisted(() => ({
  listTrainingSessions: vi.fn(),
  trainingAllocationFindMany: vi.fn(),
  trainingSessionAllocationFindMany: vi.fn(),
  facilityResourceFindMany: vi.fn(),
  weekplannerPlanFindFirst: vi.fn(),
  wochenplanPlanFindFirst: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    trainingAllocation: { findMany: mocks.trainingAllocationFindMany },
    trainingSessionAllocation: { findMany: mocks.trainingSessionAllocationFindMany },
    facilityResource: { findMany: mocks.facilityResourceFindMany },
    weekplannerPlan: { findFirst: mocks.weekplannerPlanFindFirst },
    wochenplanPlan: { findFirst: mocks.wochenplanPlanFindFirst },
    weekplannerPlanAllocation: { findMany: vi.fn().mockResolvedValue([]) },
    weekplannerPlanActivityOverride: { findMany: vi.fn().mockResolvedValue([]) },
  },
}));

vi.mock("@/lib/training/session-generation-service", () => ({
  listTrainingSessions: mocks.listTrainingSessions,
}));

vi.mock("@/lib/matchcenter/query-service", () => ({
  listMatchcenterMatches: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/tournaments/tournament-service", () => ({
  listTournaments: vi.fn().mockResolvedValue([]),
}));

const TENANT_A = "tenant-a";
const WEEK_WINDOW = {
  from: new Date("2026-08-24T00:00:00.000Z"),
  to: new Date("2026-08-30T23:59:59.999Z"),
  days: [
    "2026-08-24",
    "2026-08-25",
    "2026-08-26",
    "2026-08-27",
    "2026-08-28",
    "2026-08-29",
    "2026-08-30",
  ],
  param: "2026-08-24",
  previousParam: "2026-08-17",
  nextParam: "2026-08-31",
} as const;

function trainingSessionDto(overrides: Partial<TrainingSessionDto> = {}): TrainingSessionDto {
  return {
    id: "session-mon",
    tenantId: TENANT_A,
    trainingSeriesId: "series-d7",
    trainingSeriesTitle: "Junioren D-7 D1 Training",
    teamSeasonId: "team-season-d7",
    teamName: "Junioren D-7 D1",
    date: "2026-08-24",
    weekday: "MONDAY",
    startAt: "2026-08-24T15:15:00.000Z",
    endAt: "2026-08-24T16:45:00.000Z",
    timezone: "Europe/Zurich",
    status: "SCHEDULED",
    originalDate: "2026-08-24",
    originalStartAt: "2026-08-24T15:15:00.000Z",
    originalEndAt: "2026-08-24T16:45:00.000Z",
    isRescheduled: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function allocationRow(
  seriesId: string,
  code: string,
  name: string,
  type: string,
  displayOrder: number,
) {
  return {
    trainingSeriesId: seriesId,
    displayOrder,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    facilityResource: {
      id: `res-${code}`,
      code,
      name,
      type,
      facility: { name: "Sportanlage" },
    },
  };
}

function sessionAllocationRow(
  sessionId: string,
  code: string,
  name: string,
  type: string,
  displayOrder: number,
) {
  return {
    trainingSessionId: sessionId,
    displayOrder,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    facilityResource: {
      id: `res-${code}`,
      code,
      name,
      type,
      facility: { name: "Sportanlage" },
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.facilityResourceFindMany.mockResolvedValue([]);
  mocks.trainingSessionAllocationFindMany.mockResolvedValue([]);
  mocks.weekplannerPlanFindFirst.mockResolvedValue({ wochenplanPlanId: null });
  mocks.wochenplanPlanFindFirst.mockResolvedValue(null);
});

describe("getWeekplannerWeek — occurrence-specific training allocations", () => {
  it("D7-D1 Monday resolves Kunstrasen 3 B and Garderobe E4 independently from Wednesday", async () => {
    mocks.listTrainingSessions.mockResolvedValue([
      trainingSessionDto({ id: "session-mon", weekday: "MONDAY", date: "2026-08-24" }),
      trainingSessionDto({
        id: "session-wed",
        weekday: "WEDNESDAY",
        date: "2026-08-26",
        startAt: "2026-08-26T15:15:00.000Z",
        endAt: "2026-08-26T16:45:00.000Z",
        originalDate: "2026-08-26",
        originalStartAt: "2026-08-26T15:15:00.000Z",
        originalEndAt: "2026-08-26T16:45:00.000Z",
      }),
    ]);
    mocks.trainingAllocationFindMany.mockResolvedValue([
      allocationRow("series-d7", "KR3B", "Kunstrasen 3 B", "HALF_PITCH", 0),
      allocationRow("series-d7", "O4", "Garderobe O4", "DRESSING_ROOM", 5),
    ]);
    mocks.trainingSessionAllocationFindMany.mockResolvedValue([
      sessionAllocationRow("session-mon", "KR3B", "Kunstrasen 3 B", "HALF_PITCH", 0),
      sessionAllocationRow("session-mon", "E4", "Garderobe E4", "DRESSING_ROOM", 0),
      sessionAllocationRow("session-wed", "KR3A", "Kunstrasen 3 A", "HALF_PITCH", 0),
      sessionAllocationRow("session-wed", "O3", "Garderobe O3", "DRESSING_ROOM", 0),
    ]);

    const week = await getWeekplannerWeek(TENANT_A, WEEK_WINDOW);
    const monday = week.days.find((day) => day.dayKey === "2026-08-24")?.items[0];
    const wednesday = week.days.find((day) => day.dayKey === "2026-08-26")?.items[0];

    expect(monday?.type).toBe("TRAINING");
    expect(wednesday?.type).toBe("TRAINING");
    if (monday?.type !== "TRAINING" || wednesday?.type !== "TRAINING") throw new Error("expected TRAINING");

    expect(monday.pitchAllocations[0]?.name).toBe("Kunstrasen 3 B");
    expect(monday.dressingRoomAllocations[0]?.name).toBe("Garderobe E4");
    expect(wednesday.pitchAllocations[0]?.name).toBe("Kunstrasen 3 A");
    expect(wednesday.dressingRoomAllocations[0]?.name).toBe("Garderobe O3");
  });

  it("D9-D1 Wednesday resolves Garderobe E3 from canonical occurrence override", async () => {
    mocks.listTrainingSessions.mockResolvedValue([
      trainingSessionDto({
        id: "session-d9-wed",
        trainingSeriesId: "series-d9",
        trainingSeriesTitle: "Junioren D-9 D1 Training",
        teamName: "Junioren D-9 D1",
        weekday: "WEDNESDAY",
        date: "2026-08-26",
        startAt: "2026-08-26T16:45:00.000Z",
        endAt: "2026-08-26T18:15:00.000Z",
        originalDate: "2026-08-26",
        originalStartAt: "2026-08-26T16:45:00.000Z",
        originalEndAt: "2026-08-26T18:15:00.000Z",
      }),
    ]);
    mocks.trainingAllocationFindMany.mockResolvedValue([
      allocationRow("series-d9", "KR3A", "Kunstrasen 3 A", "HALF_PITCH", 0),
      allocationRow("series-d9", "O4", "Garderobe O4", "DRESSING_ROOM", 0),
    ]);
    mocks.trainingSessionAllocationFindMany.mockResolvedValue([
      sessionAllocationRow("session-d9-wed", "KR3A", "Kunstrasen 3 A", "HALF_PITCH", 0),
      sessionAllocationRow("session-d9-wed", "E3", "Garderobe E3", "DRESSING_ROOM", 0),
    ]);

    const week = await getWeekplannerWeek(TENANT_A, WEEK_WINDOW);
    const wednesday = week.days.find((day) => day.dayKey === "2026-08-26")?.items[0];

    expect(wednesday?.type).toBe("TRAINING");
    if (wednesday?.type !== "TRAINING") throw new Error("expected TRAINING");
    expect(wednesday.pitchAllocations[0]?.name).toBe("Kunstrasen 3 A");
    expect(wednesday.dressingRoomAllocations[0]?.name).toBe("Garderobe E3");
    expect(wednesday.dressingRoomAllocations).toHaveLength(1);
  });

  it("D9-D1 Wednesday ignores stale occurrence dressing-room rows when a newer override exists", async () => {
    mocks.listTrainingSessions.mockResolvedValue([
      trainingSessionDto({
        id: "session-d9-wed",
        trainingSeriesId: "series-d9",
        trainingSeriesTitle: "Junioren D-9 D1 Training",
        teamName: "Junioren D-9 D1",
        weekday: "WEDNESDAY",
        date: "2026-08-26",
        startAt: "2026-08-26T16:45:00.000Z",
        endAt: "2026-08-26T18:15:00.000Z",
        originalDate: "2026-08-26",
        originalStartAt: "2026-08-26T16:45:00.000Z",
        originalEndAt: "2026-08-26T18:15:00.000Z",
      }),
    ]);
    mocks.trainingAllocationFindMany.mockResolvedValue([
      allocationRow("series-d9", "KR3A", "Kunstrasen 3 A", "HALF_PITCH", 0),
      allocationRow("series-d9", "O4", "Garderobe O4", "DRESSING_ROOM", 0),
    ]);
    mocks.trainingSessionAllocationFindMany.mockResolvedValue([
      sessionAllocationRow("session-d9-wed", "KR3A", "Kunstrasen 3 A", "HALF_PITCH", 0),
      sessionAllocationRow("session-d9-wed", "O4", "Garderobe O4", "DRESSING_ROOM", 1),
      sessionAllocationRow("session-d9-wed", "E3", "Garderobe E3", "DRESSING_ROOM", 2),
    ]);

    const week = await getWeekplannerWeek(TENANT_A, WEEK_WINDOW);
    const wednesday = week.days.find((day) => day.dayKey === "2026-08-26")?.items[0];

    expect(wednesday?.type).toBe("TRAINING");
    if (wednesday?.type !== "TRAINING") throw new Error("expected TRAINING");
    expect(wednesday.pitchAllocations[0]?.name).toBe("Kunstrasen 3 A");
    expect(wednesday.dressingRoomAllocations).toEqual([
      expect.objectContaining({ code: "E3", name: "Garderobe E3" }),
    ]);
  });

  it("uses lowest displayOrder series allocation when no occurrence override exists", async () => {
    mocks.listTrainingSessions.mockResolvedValue([trainingSessionDto()]);
    mocks.trainingAllocationFindMany.mockResolvedValue([
      allocationRow("series-d7", "KR3B", "Kunstrasen 3 B", "HALF_PITCH", 1),
      allocationRow("series-d7", "KR3A", "Kunstrasen 3 A", "HALF_PITCH", 0),
      allocationRow("series-d7", "O4", "Garderobe O4", "DRESSING_ROOM", 2),
      allocationRow("series-d7", "E3", "Garderobe E3", "DRESSING_ROOM", 0),
    ]);

    const week = await getWeekplannerWeek(TENANT_A, WEEK_WINDOW);
    const monday = week.days.find((day) => day.dayKey === "2026-08-24")?.items[0];

    expect(monday?.type).toBe("TRAINING");
    if (monday?.type !== "TRAINING") throw new Error("expected TRAINING");
    expect(monday.pitchAllocations).toHaveLength(1);
    expect(monday.pitchAllocations[0]?.name).toBe("Kunstrasen 3 A");
    expect(monday.dressingRoomAllocations).toHaveLength(1);
    expect(monday.dressingRoomAllocations[0]?.name).toBe("Garderobe E3");
  });
});
