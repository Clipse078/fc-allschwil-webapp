/**
 * WOCHENPLAN-2.0-01H-E5 — availability integration tests.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    weekplannerPlanAllocation: { findMany: vi.fn() },
    weekplannerPlanActivityOverride: { findMany: vi.fn(), findFirst: vi.fn() },
    weekplannerPlan: { findFirst: vi.fn() },
    trainingSession: { findFirst: vi.fn() },
    event: { findFirst: vi.fn() },
    tournamentResourceAllocation: { findMany: vi.fn() },
    tournamentParticipantAllocation: { findMany: vi.fn() },
  },
}));

import { prisma } from "@/lib/db/prisma";
import {
  findWeekplannerReplacedActivities,
  findWeekplannerPlanConflicts,
} from "../availability-integration";

const TENANT = "tenant-a";
const PLAN_ID = "plan-1";

describe("findWeekplannerReplacedActivities", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.weekplannerPlanAllocation.findMany).mockResolvedValue([
      { activityType: "TRAINING", activityId: "session-1" },
    ] as never);
    vi.mocked(prisma.weekplannerPlanActivityOverride.findMany).mockResolvedValue([
      { activityType: "MATCH", activityId: "match-1" },
    ] as never);
  });

  it("includes activities with allocation and time overrides", async () => {
    const replaced = await findWeekplannerReplacedActivities(TENANT, PLAN_ID, "PITCH_HALL");
    expect(replaced.has("TRAINING:session-1")).toBe(true);
    expect(replaced.has("MATCH:match-1")).toBe(true);
  });
});

describe("findWeekplannerPlanConflicts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.weekplannerPlan.findFirst).mockResolvedValue({ id: PLAN_ID } as never);
    vi.mocked(prisma.weekplannerPlanActivityOverride.findFirst).mockResolvedValue(null as never);
    vi.mocked(prisma.weekplannerPlanAllocation.findMany).mockResolvedValue([
      {
        activityType: "TRAINING",
        activityId: "session-2",
        facilityResourceId: "res-1",
        occupancyBeforeMinutes: 0,
        occupancyAfterMinutes: 0,
      },
    ] as never);
    vi.mocked(prisma.weekplannerPlanActivityOverride.findMany).mockResolvedValue([]);
    vi.mocked(prisma.trainingSession.findFirst).mockResolvedValue({
      startAt: new Date("2026-08-10T15:00:00.000Z"),
      endAt: new Date("2026-08-10T16:30:00.000Z"),
      sessionAllocations: [],
      trainingSeries: {
        title: "Junioren F2",
        allocations: [],
      },
    } as never);
  });

  it("scopes conflicts to the context plan only", async () => {
    await findWeekplannerPlanConflicts(
      TENANT,
      new Date("2026-08-10T15:00:00.000Z"),
      new Date("2026-08-10T16:30:00.000Z"),
      "PITCH_HALL",
      { weekplannerPlanId: PLAN_ID },
      new Map(),
    );

    expect(prisma.weekplannerPlanAllocation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ weekplannerPlanId: PLAN_ID }),
      }),
    );
  });

  it("excludes only the edited activity", async () => {
    vi.mocked(prisma.trainingSession.findFirst).mockResolvedValue({
      trainingSeries: { title: "Junioren F2" },
      startAt: new Date("2026-08-10T15:00:00.000Z"),
      endAt: new Date("2026-08-10T16:30:00.000Z"),
    } as never);

    const conflicts = await findWeekplannerPlanConflicts(
      TENANT,
      new Date("2026-08-10T15:00:00.000Z"),
      new Date("2026-08-10T16:30:00.000Z"),
      "PITCH_HALL",
      {
        weekplannerPlanId: PLAN_ID,
        excludeActivityType: "TRAINING",
        excludeActivityId: "session-2",
      },
      new Map(),
    );

    expect(conflicts).toHaveLength(0);
  });
});
