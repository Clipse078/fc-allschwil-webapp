/**
 * WOCHENPLAN-2.0-01H-E5 / 02B — hard delete tests for WochenplanPlan.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    wochenplanPlan: { findFirst: vi.fn(), count: vi.fn(), delete: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    weekplannerPlan: { findMany: vi.fn(), delete: vi.fn() },
    $transaction: vi.fn(),
  },
}));

import { prisma } from "@/lib/db/prisma";
import { deleteWochenplanPlan } from "../plan-service";
import {
  WochenplanPlanDeleteActiveForbiddenError,
  WochenplanPlanDeleteLastPlanForbiddenError,
  WochenplanPlanNotFoundError,
} from "../plan-errors";

const TENANT = "tenant-a";
const PLAN_DRAFT = "plan-draft";
const PLAN_ACTIVE = "plan-active";
const PLAN_LEGACY_DEFAULT = "plan-legacy-default";

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
        wochenplanPlan: {
          findFirst: vi.fn().mockResolvedValue(planRow({ id: PLAN_ACTIVE, name: "Standardplan", isActive: true, isDefault: false })),
          updateMany: vi.fn(),
          update: vi.fn(),
          delete: vi.fn(),
        },
        weekplannerPlan: {
          findMany: vi.fn().mockResolvedValue([{ id: "wp-1" }]),
          delete: vi.fn(),
        },
      } as never),
    );
  });

  it("hard deletes a draft plan and cascades linked weekplanner plans", async () => {
    vi.mocked(prisma.wochenplanPlan.findFirst).mockResolvedValue(planRow() as never);

    const result = await deleteWochenplanPlan(TENANT, PLAN_DRAFT);

    expect(result).toEqual({ id: PLAN_DRAFT, name: "Schlechtwetterplan" });
    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it("allows deleting inactive legacy default Wochenplan when another plan remains", async () => {
    vi.mocked(prisma.wochenplanPlan.findFirst).mockResolvedValue(
      planRow({ id: PLAN_LEGACY_DEFAULT, name: "Wochenplan", isDefault: true, isActive: false }) as never,
    );

    const result = await deleteWochenplanPlan(TENANT, PLAN_LEGACY_DEFAULT);

    expect(result).toEqual({ id: PLAN_LEGACY_DEFAULT, name: "Wochenplan" });
    expect(prisma.$transaction).toHaveBeenCalled();
    const tx = vi.mocked(prisma.$transaction).mock.calls[0][0] as (tx: {
      wochenplanPlan: { updateMany: ReturnType<typeof vi.fn> };
    }) => Promise<unknown>;
    const txMock = {
      wochenplanPlan: {
        findFirst: vi.fn().mockResolvedValue(planRow({ id: PLAN_ACTIVE, name: "Standardplan", isActive: true, isDefault: false })),
        updateMany: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      weekplannerPlan: {
        findMany: vi.fn().mockResolvedValue([]),
        delete: vi.fn(),
      },
    };
    await tx(txMock as never);
    expect(txMock.wochenplanPlan.updateMany).toHaveBeenCalledWith({
      where: { tenantId: TENANT, isDefault: true, archivedAt: null },
      data: { isDefault: false },
    });
  });

  it("rejects deleting the active plan", async () => {
    vi.mocked(prisma.wochenplanPlan.findFirst).mockResolvedValue(planRow({ id: PLAN_ACTIVE, isActive: true }) as never);

    await expect(deleteWochenplanPlan(TENANT, PLAN_ACTIVE)).rejects.toBeInstanceOf(
      WochenplanPlanDeleteActiveForbiddenError,
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
