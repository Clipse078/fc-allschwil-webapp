/**
 * WOCHENPLAN-2.0-02D — regression for DELETE /api/wochenplan/plans/[planId]
 * when FC Allschwil has Standardplan active and legacy Wochenplan inactive.
 *
 * Exercises the REAL deleteWochenplanPlan transaction path (same service the
 * WeekplannerPlanBar DELETE fetch calls). The 02B bug left isDefault=true on
 * the row being deleted while promoting the successor, triggering Prisma P2002
 * and HTTP 500 ("Fehler: HTTP 500" in WeekplannerPlanBar).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

type PlanRow = {
  id: string;
  tenantId: string;
  name: string;
  isDefault: boolean;
  isActive: boolean;
  archivedAt: Date | null;
  displayOrder: number;
  createdAt: Date;
};

const TENANT_FCA = "tenant-fca";
const PLAN_LEGACY = "wcp-legacy";
const PLAN_STANDARD = "wcp-standard";
const WEEK_ID = "2026-08-24";

function makePlans(): Map<string, PlanRow> {
  return new Map([
    [
      PLAN_LEGACY,
      {
        id: PLAN_LEGACY,
        tenantId: TENANT_FCA,
        name: "Wochenplan",
        isDefault: true,
        isActive: false,
        archivedAt: null,
        displayOrder: 0,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    ],
    [
      PLAN_STANDARD,
      {
        id: PLAN_STANDARD,
        tenantId: TENANT_FCA,
        name: "Standardplan",
        isDefault: false,
        isActive: true,
        archivedAt: null,
        displayOrder: 1,
        createdAt: new Date("2026-02-01T00:00:00.000Z"),
      },
    ],
  ]);
}

function createTransactionMock(plans: Map<string, PlanRow>) {
  const assertAtMostOneDefault = () => {
    const defaults = [...plans.values()].filter((p) => p.isDefault && !p.archivedAt);
    expect(defaults.length).toBeLessThanOrEqual(1);
  };

  return {
    wochenplanPlan: {
      findFirst: vi.fn(async (args: { where?: Record<string, unknown> }) => {
        const where = args.where ?? {};
        const candidates = [...plans.values()].filter((plan) => {
          if (plan.tenantId !== TENANT_FCA || plan.archivedAt) return false;
          if ("id" in where && where.id !== plan.id) return false;
          if ("NOT" in where) {
            const not = where.NOT as { id?: string };
            if (not?.id === plan.id) return false;
          }
          if ("isActive" in where && where.isActive !== plan.isActive) return false;
          return true;
        });
        candidates.sort((a, b) => {
          if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
          if (a.displayOrder !== b.displayOrder) return a.displayOrder - b.displayOrder;
          return a.createdAt.getTime() - b.createdAt.getTime();
        });
        return candidates[0] ?? null;
      }),
      updateMany: vi.fn(async (args: { where?: Record<string, unknown>; data?: { isDefault?: boolean } }) => {
        const where = args.where ?? {};
        for (const plan of plans.values()) {
          if (plan.tenantId !== TENANT_FCA || plan.archivedAt) continue;
          if ("isDefault" in where && where.isDefault !== plan.isDefault) continue;
          if ("NOT" in where) {
            const not = where.NOT as { id?: string };
            if (not?.id === plan.id) continue;
          }
          if (args.data?.isDefault !== undefined) {
            plan.isDefault = args.data.isDefault;
          }
        }
        assertAtMostOneDefault();
        return { count: 1 };
      }),
      update: vi.fn(async (args: { where: { id: string }; data: { isDefault?: boolean } }) => {
        const plan = plans.get(args.where.id);
        if (!plan) throw new Error("plan not found");
        if (args.data.isDefault !== undefined) {
          plan.isDefault = args.data.isDefault;
        }
        assertAtMostOneDefault();
        return plan;
      }),
      delete: vi.fn(async (args: { where: { id: string } }) => {
        plans.delete(args.where.id);
      }),
    },
    weekplannerPlan: {
      findMany: vi.fn(async () => [{ id: "wp-legacy-week" }]),
      delete: vi.fn(async () => undefined),
    },
    assertAtMostOneDefault,
  };
}

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    wochenplanPlan: {
      findFirst: vi.fn(),
      count: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

import { prisma } from "@/lib/db/prisma";
import { deleteWochenplanPlan } from "../plan-service";

describe("deleteWochenplanPlan — FC Allschwil legacy default draft", () => {
  let plans: Map<string, PlanRow>;
  let tx: ReturnType<typeof createTransactionMock>;

  beforeEach(() => {
    vi.clearAllMocks();
    plans = makePlans();
    tx = createTransactionMock(plans);

    vi.mocked(prisma.wochenplanPlan.findFirst).mockImplementation(async (args) => {
      const where = (args as { where?: { id?: string } }).where;
      if (where?.id) return plans.get(where.id) ?? null;
      return null;
    });
    vi.mocked(prisma.wochenplanPlan.count).mockResolvedValue(2 as never);
    vi.mocked(prisma.$transaction).mockImplementation(async (fn) => fn(tx as never));
  });

  it("deletes inactive legacy default Wochenplan without violating isDefault uniqueness", async () => {
    const result = await deleteWochenplanPlan(TENANT_FCA, PLAN_LEGACY);

    expect(result).toEqual({ id: PLAN_LEGACY, name: "Wochenplan" });
    expect(plans.has(PLAN_LEGACY)).toBe(false);
    expect(plans.get(PLAN_STANDARD)?.isDefault).toBe(true);
    expect(plans.get(PLAN_STANDARD)?.isActive).toBe(true);
    expect(tx.wochenplanPlan.updateMany).toHaveBeenCalledWith({
      where: { tenantId: TENANT_FCA, isDefault: true, archivedAt: null },
      data: { isDefault: false },
    });
    expect(tx.weekplannerPlan.delete).toHaveBeenCalledWith({ where: { id: "wp-legacy-week" } });
  });
});
