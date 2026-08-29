/**
 * WOCHENPLAN-2.0-01H-E5 — hard delete tests for WochenplanPlan.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    wochenplanPlan: { findFirst: vi.fn(), count: vi.fn(), delete: vi.fn() },
    weekplannerPlan: { findMany: vi.fn(), delete: vi.fn() },
    $transaction: vi.fn(),
  },
}));

import { prisma } from "@/lib/db/prisma";
import { deleteWochenplanPlan } from "../plan-service";
import {
  WochenplanPlanDeleteActiveForbiddenError,
  WochenplanPlanDeleteLastPlanForbiddenError,
  WochenplanPlanDeleteDefaultForbiddenError,
  WochenplanPlanNotFoundError,
} from "../plan-errors";

const TENANT = "tenant-a";
const PLAN_DRAFT = "plan-draft";
const PLAN_ACTIVE = "plan-active";

function planRow(overrides: Record<string, unknown> = {}) {
  return {
    id: PLAN_DRAFT,
    tenantId: TENANT,
    name: "Schlechtwetterplan",
    description: null,
    isDefault: false,
    isActive: false,
    displayOrder: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    archivedAt: null,
    ...overrides,
  };
}

describe("deleteWochenplanPlan", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.wochenplanPlan.count).mockResolvedValue(2 as never);
    vi.mocked(prisma.$transaction).mockImplementation(async (fn) =>
      fn({
        weekplannerPlan: {
          findMany: vi.fn().mockResolvedValue([{ id: "wp-1" }]),
          delete: vi.fn(),
        },
        wochenplanPlan: { delete: vi.fn() },
      } as never),
    );
  });

  it("hard deletes a draft plan and cascades linked weekplanner plans", async () => {
    vi.mocked(prisma.wochenplanPlan.findFirst).mockResolvedValue(planRow() as never);

    const result = await deleteWochenplanPlan(TENANT, PLAN_DRAFT);

    expect(result).toEqual({ id: PLAN_DRAFT, name: "Schlechtwetterplan" });
    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it("rejects deleting the active plan", async () => {
    vi.mocked(prisma.wochenplanPlan.findFirst).mockResolvedValue(planRow({ id: PLAN_ACTIVE, isActive: true }) as never);

    await expect(deleteWochenplanPlan(TENANT, PLAN_ACTIVE)).rejects.toBeInstanceOf(
      WochenplanPlanDeleteActiveForbiddenError,
    );
  });

  it("rejects deleting the default plan", async () => {
    vi.mocked(prisma.wochenplanPlan.findFirst).mockResolvedValue(planRow({ isDefault: true }) as never);

    await expect(deleteWochenplanPlan(TENANT, PLAN_DRAFT)).rejects.toBeInstanceOf(
      WochenplanPlanDeleteDefaultForbiddenError,
    );
  });

  it("rejects deleting the last remaining plan", async () => {
    vi.mocked(prisma.wochenplanPlan.findFirst).mockResolvedValue(planRow() as never);
    vi.mocked(prisma.wochenplanPlan.count).mockResolvedValue(1 as never);

    await expect(deleteWochenplanPlan(TENANT, PLAN_DRAFT)).rejects.toBeInstanceOf(
      WochenplanPlanDeleteLastPlanForbiddenError,
    );
  });

  it("rejects cross-tenant delete via not found", async () => {
    vi.mocked(prisma.wochenplanPlan.findFirst).mockResolvedValue(null as never);

    await expect(deleteWochenplanPlan("tenant-b", PLAN_DRAFT)).rejects.toBeInstanceOf(WochenplanPlanNotFoundError);
  });
});
