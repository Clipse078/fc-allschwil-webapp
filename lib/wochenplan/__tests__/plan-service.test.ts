/**
 * lib/wochenplan/__tests__/plan-service.test.ts
 *
 * WOCHENPLAN-2.0-01B — focused tests for tenant-level WochenplanPlan service.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    wochenplanPlan: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      aggregate: vi.fn(),
    },
    wochenplanPlanAllocation: {
      findMany: vi.fn(),
      upsert: vi.fn(),
    },
    weekplannerPlan: { updateMany: vi.fn() },
    event: { findFirst: vi.fn() },
    $transaction: vi.fn(),
  },
}));

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import {
  listWochenplanPlans,
  createWochenplanPlan,
  renameWochenplanPlan,
  activateWochenplanPlan,
  getActiveWochenplanPlan,
  upsertWochenplanPlanAllocation,
} from "../plan-service";
import {
  WochenplanPlanNotFoundError,
  WochenplanPlanNameConflictError,
  WochenplanPlanValidationError,
  WochenplanPlanArchivedError,
  WochenplanPlanActivationConflictError,
} from "../plan-errors";

const TENANT_A = "tenant-a";
const TENANT_B = "tenant-b";
const PLAN_DEFAULT = "plan-default";
const PLAN_ALT = "plan-alt";

function planRow(overrides: Record<string, unknown> = {}) {
  return {
    id: PLAN_DEFAULT,
    tenantId: TENANT_A,
    name: "Wochenplan",
    description: null,
    isDefault: true,
    isActive: true,
    displayOrder: 0,
    createdAt: new Date("2026-08-01T00:00:00.000Z"),
    updatedAt: new Date("2026-08-01T00:00:00.000Z"),
    archivedAt: null,
    ...overrides,
  };
}

describe("WochenplanPlan service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.wochenplanPlan.aggregate).mockResolvedValue({ _max: { displayOrder: 0 } } as never);
    vi.mocked(prisma.wochenplanPlan.update).mockReset();
    vi.mocked(prisma.wochenplanPlan.findFirst).mockReset();
  });

  it("lists non-archived plans for a tenant", async () => {
    vi.mocked(prisma.wochenplanPlan.findMany).mockResolvedValue([
      planRow(),
      planRow({ id: PLAN_ALT, name: "Winterplan", isDefault: false, isActive: false }),
    ] as never);

    const plans = await listWochenplanPlans(TENANT_A);
    expect(plans).toHaveLength(2);
    expect(prisma.wochenplanPlan.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: TENANT_A, archivedAt: null } }),
    );
  });

  it("creates an alternative plan with isDefault=false and isActive=false", async () => {
    vi.mocked(prisma.wochenplanPlan.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.wochenplanPlan.create).mockResolvedValue(
      planRow({ id: PLAN_ALT, name: "Winterplan", isDefault: false, isActive: false }) as never,
    );

    const plan = await createWochenplanPlan(TENANT_A, { name: "Winterplan" });
    expect(plan.name).toBe("Winterplan");
    expect(plan.isDefault).toBe(false);
    expect(plan.isActive).toBe(false);
  });

  it("rejects duplicate plan names within a tenant", async () => {
    vi.mocked(prisma.wochenplanPlan.findFirst).mockResolvedValue(planRow() as never);
    await expect(createWochenplanPlan(TENANT_A, { name: "Wochenplan" })).rejects.toThrow(
      WochenplanPlanNameConflictError,
    );
  });

  it("rename does not change underlying plan content flags", async () => {
    vi.mocked(prisma.wochenplanPlan.findFirst)
      .mockResolvedValueOnce(planRow() as never)
      .mockResolvedValueOnce(null);
    vi.mocked(prisma.wochenplanPlan.update).mockResolvedValue(
      planRow({ name: "Hauptplan" }) as never,
    );
    vi.mocked(prisma.weekplannerPlan.updateMany).mockResolvedValue({ count: 2 } as never);

    const plan = await renameWochenplanPlan(TENANT_A, PLAN_DEFAULT, "Hauptplan");
    expect(plan.name).toBe("Hauptplan");
    expect(plan.isDefault).toBe(true);
    expect(plan.isActive).toBe(true);
    expect(prisma.weekplannerPlan.updateMany).toHaveBeenCalledWith({
      where: { tenantId: TENANT_A, wochenplanPlanId: PLAN_DEFAULT, archivedAt: null },
      data: { name: "Hauptplan" },
    });
  });

  it("activates a plan atomically and deactivates others", async () => {
    const alt = planRow({ id: PLAN_ALT, name: "Winterplan", isDefault: false, isActive: false });
    vi.mocked(prisma.wochenplanPlan.findFirst)
      .mockResolvedValueOnce(alt as never)
      .mockResolvedValueOnce(alt as never);
    vi.mocked(prisma.$transaction).mockImplementation(async (fn) =>
      fn({
        wochenplanPlan: {
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          findFirst: vi.fn().mockResolvedValue({ ...alt, isActive: true }),
        },
      } as never),
    );

    const plan = await activateWochenplanPlan(TENANT_A, PLAN_ALT);
    expect(plan.isActive).toBe(true);
  });

  it("tenant isolation — cross-tenant plan id is not found", async () => {
    vi.mocked(prisma.wochenplanPlan.findFirst).mockResolvedValue(null);
    await expect(renameWochenplanPlan(TENANT_B, PLAN_DEFAULT, "Neuer Name")).rejects.toThrow(
      WochenplanPlanNotFoundError,
    );
  });

  it("getActiveWochenplanPlan returns the active plan for public resolution", async () => {
    vi.mocked(prisma.wochenplanPlan.findFirst).mockResolvedValue(planRow() as never);
    const plan = await getActiveWochenplanPlan(TENANT_A);
    expect(plan?.isActive).toBe(true);
    expect(prisma.wochenplanPlan.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: TENANT_A, isActive: true, archivedAt: null } }),
    );
  });

  it("cannot store allocation overrides on the default plan", async () => {
    vi.mocked(prisma.wochenplanPlan.findFirst).mockResolvedValue(planRow() as never);
    await expect(
      upsertWochenplanPlanAllocation(TENANT_A, {
        wochenplanPlanId: PLAN_DEFAULT,
        eventId: "evt-1",
        pitchCode: "STADION",
        homeDressingRoomCode: null,
        awayDressingRoomCode: null,
      }),
    ).rejects.toThrow(WochenplanPlanValidationError);
  });

  it("stores allocation overrides on alternative plans only", async () => {
    vi.mocked(prisma.wochenplanPlan.findFirst).mockResolvedValue(
      planRow({ id: PLAN_ALT, isDefault: false, isActive: false }) as never,
    );
    vi.mocked(prisma.event.findFirst).mockResolvedValue({ id: "evt-1" } as never);
    vi.mocked(prisma.wochenplanPlanAllocation.upsert).mockResolvedValue({
      id: "alloc-1",
      tenantId: TENANT_A,
      wochenplanPlanId: PLAN_ALT,
      eventId: "evt-1",
      pitchCode: "STADION",
      homeDressingRoomCode: null,
      awayDressingRoomCode: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);

    const allocation = await upsertWochenplanPlanAllocation(TENANT_A, {
      wochenplanPlanId: PLAN_ALT,
      eventId: "evt-1",
      pitchCode: "STADION",
      homeDressingRoomCode: null,
      awayDressingRoomCode: null,
    });
    expect(allocation.pitchCode).toBe("STADION");
  });

  it("activation conflict surfaces as typed error on P2002", async () => {
    vi.mocked(prisma.wochenplanPlan.findFirst).mockResolvedValue(
      planRow({ id: PLAN_ALT, isDefault: false }) as never,
    );
    vi.mocked(prisma.$transaction).mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("unique", {
        code: "P2002",
        clientVersion: "test",
      }),
    );

    await expect(activateWochenplanPlan(TENANT_A, PLAN_ALT)).rejects.toThrow(
      WochenplanPlanActivationConflictError,
    );
  });

  it("archived plan cannot be activated", async () => {
    vi.mocked(prisma.wochenplanPlan.findFirst).mockResolvedValue(
      planRow({ id: PLAN_ALT, archivedAt: new Date(), isDefault: false }) as never,
    );
    await expect(activateWochenplanPlan(TENANT_A, PLAN_ALT)).rejects.toThrow(
      WochenplanPlanArchivedError,
    );
  });
});
