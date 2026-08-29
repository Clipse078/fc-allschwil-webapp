/**
 * lib/weekplanner/__tests__/empty-baseline.test.ts
 *
 * WOCHENPLAN-2.0-01H-D — empty-baseline plans must not inherit canonical activities.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { WOCHEPLAN_EMPTY_BASELINE_MARKER } from "@/lib/wochenplan/plan-baseline";

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
  listTournaments: vi.fn(),
  listMatchcenterMatches: vi.fn(),
  listTrainingSessions: vi.fn(),
}));

vi.mock("@/lib/tournaments/tournament-service", () => ({
  listTournaments: mocks.listTournaments,
}));

vi.mock("@/lib/matchcenter/query-service", () => ({
  listMatchcenterMatches: mocks.listMatchcenterMatches,
}));

vi.mock("@/lib/training/session-generation-service", () => ({
  listTrainingSessions: mocks.listTrainingSessions,
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

import { getWeekplannerWeek } from "../queries";

const TENANT_A = "tenant-a";
const EMPTY_PLAN_ID = "wp-empty";

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

function setupCanonicalWeek() {
  mocks.facilityResourceFindMany.mockResolvedValue([]);
  mocks.trainingAllocationFindMany.mockResolvedValue([]);
  mocks.trainingSessionAllocationFindMany.mockResolvedValue([]);
  mocks.listTrainingSessions.mockResolvedValue([
    {
      id: "session-1",
      tenantId: TENANT_A,
      trainingSeriesId: "series-1",
      startAt: new Date("2026-08-10T16:00:00.000Z"),
      endAt: new Date("2026-08-10T17:30:00.000Z"),
      status: "SCHEDULED",
      title: "E2 Training",
      teamName: "E2",
      allocations: [],
    },
  ]);
  mocks.listMatchcenterMatches.mockResolvedValue([]);
  mocks.listTournaments.mockResolvedValue([]);
  mocks.weekplannerPlanAllocationFindMany.mockResolvedValue([]);
  mocks.weekplannerPlanActivityOverrideFindMany.mockResolvedValue([]);
  mocks.weekplannerPlanFindFirst.mockResolvedValue({ wochenplanPlanId: "wcp-empty" });
}

describe("getWeekplannerWeek — empty baseline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupCanonicalWeek();
  });

  it("returns an empty week when the plan has empty baseline and no overrides", async () => {
    mocks.wochenplanPlanFindFirst.mockResolvedValue({
      description: WOCHEPLAN_EMPTY_BASELINE_MARKER,
    });

    const week = await getWeekplannerWeek(TENANT_A, WEEK_WINDOW, EMPTY_PLAN_ID);
    const allItems = week.days.flatMap((day) => day.items);
    expect(allItems).toHaveLength(0);
  });

  it("still inherits canonical activities for canonical-baseline plans without overrides", async () => {
    mocks.wochenplanPlanFindFirst.mockResolvedValue({ description: null });

    const week = await getWeekplannerWeek(TENANT_A, WEEK_WINDOW, EMPTY_PLAN_ID);
    const allItems = week.days.flatMap((day) => day.items);
    expect(allItems.length).toBeGreaterThan(0);
  });
});
