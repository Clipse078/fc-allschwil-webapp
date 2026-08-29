/**
 * WOCHENPLAN-2.0-02B — public weekplan active-plan sync integration tests.
 *
 * Exercises the REAL buildPublicCurrentWeekFeed pipeline (same entrypoint as
 * GET /api/public/[tenant]/website/weekplan) with only Prisma mocked.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WeekplannerWeek } from "@/lib/weekplanner/types";

const mocks = vi.hoisted(() => ({
  wochenplanPlanFindFirst: vi.fn(),
  weekplannerPlanFindFirst: vi.fn(),
  tenantFindFirst: vi.fn(),
  eventFindMany: vi.fn(),
  trainingSessionFindMany: vi.fn(),
  wochenplanPublicationFindUnique: vi.fn(),
  getWeekplannerWeek: vi.fn(),
  listTournamentsByIds: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    wochenplanPlan: {
      findFirst: mocks.wochenplanPlanFindFirst,
      count: vi.fn(),
      delete: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    weekplannerPlan: { findFirst: mocks.weekplannerPlanFindFirst, findMany: vi.fn(), delete: vi.fn() },
    tenant: { findFirst: mocks.tenantFindFirst },
    event: { findMany: mocks.eventFindMany },
    trainingSession: { findMany: mocks.trainingSessionFindMany },
    wochenplanPublication: { findUnique: mocks.wochenplanPublicationFindUnique },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/weekplanner/queries", () => ({
  getWeekplannerWeek: mocks.getWeekplannerWeek,
}));

vi.mock("@/lib/tournaments/tournament-service", () => ({
  listTournamentsByIds: mocks.listTournamentsByIds,
}));

import { buildPublicCurrentWeekFeed } from "../public-feed";
import { deleteWochenplanPlan } from "../plan-service";
import { prisma } from "@/lib/db/prisma";

const TENANT_FCA = "tenant-fca";
const TENANT_NAME = "FC Allschwil";
const WEEK_ID = "2026-08-24";
const NOW = new Date("2026-08-26T10:00:00.000Z");

const PLAN_WOCHENPLAN = {
  id: "wcp-legacy",
  tenantId: TENANT_FCA,
  name: "Wochenplan",
  description: null,
  isDefault: true,
  isActive: false,
  displayOrder: 0,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  archivedAt: null,
};

const PLAN_STANDARD = {
  id: "wcp-standard",
  tenantId: TENANT_FCA,
  name: "Standardplan",
  description: null,
  isDefault: false,
  isActive: true,
  displayOrder: 1,
  createdAt: new Date("2026-02-01T00:00:00.000Z"),
  updatedAt: new Date("2026-02-01T00:00:00.000Z"),
  archivedAt: null,
};

const PLAN_SCHLECHTWETTER = {
  id: "wcp-schlechtwetter",
  tenantId: TENANT_FCA,
  name: "Schlechtwetterplan",
  description: null,
  isDefault: false,
  isActive: true,
  displayOrder: 2,
  createdAt: new Date("2026-03-01T00:00:00.000Z"),
  updatedAt: new Date("2026-03-01T00:00:00.000Z"),
  archivedAt: null,
};

function emptyWeek(): WeekplannerWeek {
  const days = [
    "2026-08-24",
    "2026-08-25",
    "2026-08-26",
    "2026-08-27",
    "2026-08-28",
    "2026-08-29",
    "2026-08-30",
  ].map((dayKey) => ({ dayKey, items: [] }));

  return {
    days,
    weekNumberLabel: "KW 35",
    rangeLabel: "24. Aug – 30. Aug 2026",
    param: WEEK_ID,
    previousParam: "2026-08-17",
    nextParam: "2026-08-31",
  };
}

function setupFeedMocks(activePlan: typeof PLAN_STANDARD) {
  mocks.tenantFindFirst.mockResolvedValue({
    logoUrl: null,
    timezone: "Europe/Zurich",
  });
  mocks.wochenplanPlanFindFirst.mockImplementation(async (args: { where?: Record<string, unknown> }) => {
    if (args.where && "isActive" in args.where && args.where.isActive === true) {
      return activePlan;
    }
    if (args.where && "id" in args.where) {
      const id = args.where.id as string;
      if (id === PLAN_WOCHENPLAN.id) return PLAN_WOCHENPLAN;
      if (id === PLAN_STANDARD.id) return PLAN_STANDARD;
      if (id === PLAN_SCHLECHTWETTER.id) return PLAN_SCHLECHTWETTER;
    }
    return null;
  });
  mocks.weekplannerPlanFindFirst.mockResolvedValue(null);
  mocks.getWeekplannerWeek.mockResolvedValue(emptyWeek());
  mocks.wochenplanPublicationFindUnique.mockResolvedValue(null);
  mocks.listTournamentsByIds.mockResolvedValue([]);
  mocks.eventFindMany.mockResolvedValue([]);
  mocks.trainingSessionFindMany.mockResolvedValue([]);
}

describe("public weekplan active plan sync — buildPublicCurrentWeekFeed", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("A. FC Allschwil regression: Standardplan active, legacy Wochenplan inactive", async () => {
    setupFeedMocks(PLAN_STANDARD);

    const feed = await buildPublicCurrentWeekFeed({
      tenantId: TENANT_FCA,
      tenantName: TENANT_NAME,
      now: NOW,
    });

    expect(feed.currentWeek.weekId).toBe(WEEK_ID);
    expect(feed.activePlan.name).toBe("Standardplan");
    expect(feed.activePlan.id).toBe(PLAN_STANDARD.id);
    expect(mocks.getWeekplannerWeek.mock.calls[0][2]).toBeUndefined();
  });

  it("B. switching active plan to Schlechtwetterplan updates public identity", async () => {
    setupFeedMocks(PLAN_SCHLECHTWETTER);
    mocks.weekplannerPlanFindFirst.mockResolvedValue({ id: "wp-schlechtwetter" });

    const feed = await buildPublicCurrentWeekFeed({
      tenantId: TENANT_FCA,
      tenantName: TENANT_NAME,
      now: NOW,
    });

    expect(feed.activePlan.name).toBe("Schlechtwetterplan");
    expect(mocks.getWeekplannerWeek.mock.calls[0][2]).toBe("wp-schlechtwetter");
  });

  it("C. active alternative without materialized week keeps alternative identity", async () => {
    setupFeedMocks(PLAN_SCHLECHTWETTER);
    mocks.weekplannerPlanFindFirst.mockResolvedValue(null);

    const feed = await buildPublicCurrentWeekFeed({
      tenantId: TENANT_FCA,
      tenantName: TENANT_NAME,
      now: NOW,
    });

    expect(feed.activePlan.name).toBe("Schlechtwetterplan");
    expect(feed.activePlan.name).not.toBe("Wochenplan");
    expect(mocks.getWeekplannerWeek.mock.calls[0][2]).toBeUndefined();
  });

  it("H. plan switch is reflected on the next feed build without stale fallback name", async () => {
    setupFeedMocks(PLAN_STANDARD);
    const first = await buildPublicCurrentWeekFeed({
      tenantId: TENANT_FCA,
      tenantName: TENANT_NAME,
      now: NOW,
    });
    expect(first.activePlan.name).toBe("Standardplan");

    setupFeedMocks(PLAN_SCHLECHTWETTER);
    mocks.weekplannerPlanFindFirst.mockResolvedValue({ id: "wp-schlechtwetter" });

    const second = await buildPublicCurrentWeekFeed({
      tenantId: TENANT_FCA,
      tenantName: TENANT_NAME,
      now: NOW,
    });
    expect(second.activePlan.name).toBe("Schlechtwetterplan");
  });
});

describe("public weekplan draft deletion — deleteWochenplanPlan", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("D. inactive legacy Wochenplan can be deleted while Standardplan stays active", async () => {
    vi.mocked(prisma.wochenplanPlan.findFirst).mockResolvedValue(PLAN_WOCHENPLAN as never);
    vi.mocked(prisma.wochenplanPlan.count).mockResolvedValue(2 as never);
    vi.mocked(prisma.$transaction).mockImplementation(async (fn) =>
      fn({
        wochenplanPlan: {
          findFirst: vi.fn().mockResolvedValue(PLAN_STANDARD),
          updateMany: vi.fn(),
          update: vi.fn(),
          delete: vi.fn(),
        },
        weekplannerPlan: {
          findMany: vi.fn().mockResolvedValue([]),
          delete: vi.fn(),
        },
      } as never),
    );

    const deleted = await deleteWochenplanPlan(TENANT_FCA, PLAN_WOCHENPLAN.id);
    expect(deleted).toEqual({ id: PLAN_WOCHENPLAN.id, name: "Wochenplan" });
  });

  it("E. active plan deletion is rejected", async () => {
    vi.mocked(prisma.wochenplanPlan.findFirst).mockResolvedValue(PLAN_STANDARD as never);

    await expect(deleteWochenplanPlan(TENANT_FCA, PLAN_STANDARD.id)).rejects.toThrow(
      /cannot be deleted/i,
    );
  });

  it("F. last remaining plan deletion is rejected", async () => {
    vi.mocked(prisma.wochenplanPlan.findFirst).mockResolvedValue(
      { ...PLAN_WOCHENPLAN, isActive: false } as never,
    );
    vi.mocked(prisma.wochenplanPlan.count).mockResolvedValue(1 as never);

    await expect(deleteWochenplanPlan(TENANT_FCA, PLAN_WOCHENPLAN.id)).rejects.toThrow(
      /at least one plan must remain/i,
    );
  });
});
