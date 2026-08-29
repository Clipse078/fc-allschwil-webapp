/**
 * lib/wochenplan/__tests__/plan-materialization.test.ts
 *
 * WOCHENPLAN-2.0-01F — materialization, idempotency, rename sync, and safety tests.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    wochenplanPlan: { findFirst: vi.fn() },
    weekplannerPlan: { findFirst: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  },
}));

vi.mock("@/lib/weekplanner/plan-service", () => ({
  createWeekplannerPlan: vi.fn(),
}));

vi.mock("../public-plan-resolution", () => ({
  findLinkedWeekplannerPlan: vi.fn(),
}));

import { prisma } from "@/lib/db/prisma";
import { createWeekplannerPlan } from "@/lib/weekplanner/plan-service";
import { findLinkedWeekplannerPlan } from "../public-plan-resolution";
import {
  materializeLinkedWeekplannerPlan,
  syncMaterializedWeekplannerPlanNames,
} from "../plan-materialization";
import {
  WochenplanPlanArchivedError,
  WochenplanPlanNotFoundError,
  WochenplanPlanValidationError,
} from "../plan-errors";
import { WeekplannerPlanValidationError } from "@/lib/weekplanner/plan-errors";

const TENANT_A = "tenant-a";
const TENANT_B = "tenant-b";
const WEEK_35 = "2026-08-24";
const WEEK_36 = "2026-08-31";
const WCP_DEFAULT = "wcp-default";
const WCP_ALT = "wcp-alt";
const WP_A = "wp-week35";
const WP_B = "wp-week36";

function altDefinition(overrides: Record<string, unknown> = {}) {
  return {
    id: WCP_ALT,
    name: "Schlechtwetterplan",
    isDefault: false,
    archivedAt: null,
    ...overrides,
  };
}

function weekplannerRow(overrides: Record<string, unknown> = {}) {
  return {
    id: WP_A,
    tenantId: TENANT_A,
    weekId: WEEK_35,
    name: "Schlechtwetterplan",
    createdByUserId: "user-1",
    createdAt: new Date("2026-08-01T00:00:00.000Z"),
    updatedAt: new Date("2026-08-01T00:00:00.000Z"),
    archivedAt: null,
    isActive: false,
    wochenplanPlanId: WCP_ALT,
    ...overrides,
  };
}

describe("materializeLinkedWeekplannerPlan", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("1. default plan does not materialize WeekplannerPlan", async () => {
    vi.mocked(prisma.wochenplanPlan.findFirst).mockResolvedValue({
      id: WCP_DEFAULT,
      name: "Standardplan",
      isDefault: true,
      archivedAt: null,
    } as never);

    await expect(
      materializeLinkedWeekplannerPlan(TENANT_A, WEEK_35, WCP_DEFAULT),
    ).rejects.toBeInstanceOf(WochenplanPlanValidationError);

    expect(findLinkedWeekplannerPlan).not.toHaveBeenCalled();
    expect(createWeekplannerPlan).not.toHaveBeenCalled();
  });

  it("2. alternative plan materializes with wochenplanPlanId", async () => {
    vi.mocked(prisma.wochenplanPlan.findFirst).mockResolvedValue(altDefinition() as never);
    vi.mocked(findLinkedWeekplannerPlan).mockResolvedValue(null);
    vi.mocked(createWeekplannerPlan).mockResolvedValue({
      id: WP_A,
      tenantId: TENANT_A,
      weekId: WEEK_35,
      name: "Schlechtwetterplan",
      createdByUserId: "user-1",
      createdAt: "2026-08-01T00:00:00.000Z",
      updatedAt: "2026-08-01T00:00:00.000Z",
      archivedAt: null,
      isActive: false,
      wochenplanPlanId: WCP_ALT,
    });

    const result = await materializeLinkedWeekplannerPlan(TENANT_A, WEEK_35, WCP_ALT, {
      createdByUserId: "user-1",
    });

    expect(result.created).toBe(true);
    expect(result.weekplannerPlan.wochenplanPlanId).toBe(WCP_ALT);
    expect(createWeekplannerPlan).toHaveBeenCalledWith(TENANT_A, {
      weekId: WEEK_35,
      name: "Schlechtwetterplan",
      createdByUserId: "user-1",
      wochenplanPlanId: WCP_ALT,
    });
  });

  it("3. existing linked plan is reused", async () => {
    vi.mocked(prisma.wochenplanPlan.findFirst).mockResolvedValue(altDefinition() as never);
    vi.mocked(findLinkedWeekplannerPlan).mockResolvedValue({ id: WP_A });
    vi.mocked(prisma.weekplannerPlan.findFirst).mockResolvedValue(weekplannerRow() as never);

    const result = await materializeLinkedWeekplannerPlan(TENANT_A, WEEK_35, WCP_ALT);

    expect(result.created).toBe(false);
    expect(result.weekplannerPlan.id).toBe(WP_A);
    expect(createWeekplannerPlan).not.toHaveBeenCalled();
  });

  it("4. repeated materialization is idempotent", async () => {
    vi.mocked(prisma.wochenplanPlan.findFirst).mockResolvedValue(altDefinition() as never);
    vi.mocked(findLinkedWeekplannerPlan).mockResolvedValue({ id: WP_A });
    vi.mocked(prisma.weekplannerPlan.findFirst).mockResolvedValue(weekplannerRow() as never);

    const first = await materializeLinkedWeekplannerPlan(TENANT_A, WEEK_35, WCP_ALT);
    const second = await materializeLinkedWeekplannerPlan(TENANT_A, WEEK_35, WCP_ALT);

    expect(first.created).toBe(false);
    expect(second.created).toBe(false);
    expect(createWeekplannerPlan).not.toHaveBeenCalled();
  });

  it("5. tenant isolation — wrong-tenant plan ID rejected", async () => {
    vi.mocked(prisma.wochenplanPlan.findFirst).mockResolvedValue(null);

    await expect(
      materializeLinkedWeekplannerPlan(TENANT_B, WEEK_35, WCP_ALT),
    ).rejects.toBeInstanceOf(WochenplanPlanNotFoundError);
  });

  it("6. week isolation — same tenant plan materializes independently per week", async () => {
    vi.mocked(prisma.wochenplanPlan.findFirst).mockResolvedValue(altDefinition() as never);
    vi.mocked(findLinkedWeekplannerPlan)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    vi.mocked(createWeekplannerPlan)
      .mockResolvedValueOnce({
        id: WP_A,
        tenantId: TENANT_A,
        weekId: WEEK_35,
        name: "Schlechtwetterplan",
        createdByUserId: null,
        createdAt: "2026-08-01T00:00:00.000Z",
        updatedAt: "2026-08-01T00:00:00.000Z",
        archivedAt: null,
        isActive: false,
        wochenplanPlanId: WCP_ALT,
      })
      .mockResolvedValueOnce({
        id: WP_B,
        tenantId: TENANT_A,
        weekId: WEEK_36,
        name: "Schlechtwetterplan",
        createdByUserId: null,
        createdAt: "2026-08-01T00:00:00.000Z",
        updatedAt: "2026-08-01T00:00:00.000Z",
        archivedAt: null,
        isActive: false,
        wochenplanPlanId: WCP_ALT,
      });

    const week35 = await materializeLinkedWeekplannerPlan(TENANT_A, WEEK_35, WCP_ALT);
    const week36 = await materializeLinkedWeekplannerPlan(TENANT_A, WEEK_36, WCP_ALT);

    expect(week35.weekplannerPlan.id).toBe(WP_A);
    expect(week36.weekplannerPlan.id).toBe(WP_B);
    expect(createWeekplannerPlan).toHaveBeenCalledTimes(2);
  });

  it("7. rename sync updates stale display name on reuse", async () => {
    vi.mocked(prisma.wochenplanPlan.findFirst).mockResolvedValue(
      altDefinition({ name: "Winterplan" }) as never,
    );
    vi.mocked(findLinkedWeekplannerPlan).mockResolvedValue({ id: WP_A });
    vi.mocked(prisma.weekplannerPlan.findFirst).mockResolvedValue(
      weekplannerRow({ name: "Schlechtwetterplan" }) as never,
    );
    vi.mocked(prisma.weekplannerPlan.update).mockResolvedValue(
      weekplannerRow({ name: "Winterplan" }) as never,
    );

    const result = await materializeLinkedWeekplannerPlan(TENANT_A, WEEK_35, WCP_ALT);

    expect(result.weekplannerPlan.name).toBe("Winterplan");
    expect(prisma.weekplannerPlan.update).toHaveBeenCalledWith({
      where: { id: WP_A },
      data: { name: "Winterplan" },
    });
  });

  it("8. rename does not create duplicate materialization on race", async () => {
    vi.mocked(prisma.wochenplanPlan.findFirst).mockResolvedValue(altDefinition() as never);
    vi.mocked(findLinkedWeekplannerPlan)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: WP_A });
    vi.mocked(createWeekplannerPlan).mockRejectedValue(
      new WeekplannerPlanValidationError(
        `A week plan for WochenplanPlan "${WCP_ALT}" already exists for week ${WEEK_35}`,
      ),
    );
    vi.mocked(prisma.weekplannerPlan.findFirst).mockResolvedValue(weekplannerRow() as never);

    const result = await materializeLinkedWeekplannerPlan(TENANT_A, WEEK_35, WCP_ALT);

    expect(result.created).toBe(false);
    expect(result.weekplannerPlan.id).toBe(WP_A);
  });

  it("9. archived WochenplanPlan cannot materialize", async () => {
    vi.mocked(prisma.wochenplanPlan.findFirst).mockResolvedValue(
      altDefinition({ archivedAt: new Date("2026-08-01") }) as never,
    );

    await expect(
      materializeLinkedWeekplannerPlan(TENANT_A, WEEK_35, WCP_ALT),
    ).rejects.toBeInstanceOf(WochenplanPlanArchivedError);
  });
});

describe("syncMaterializedWeekplannerPlanNames", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates all linked non-archived week plans for a tenant definition", async () => {
    vi.mocked(prisma.weekplannerPlan.updateMany).mockResolvedValue({ count: 3 } as never);

    const count = await syncMaterializedWeekplannerPlanNames(TENANT_A, WCP_ALT, "Winterplan");

    expect(count).toBe(3);
    expect(prisma.weekplannerPlan.updateMany).toHaveBeenCalledWith({
      where: { tenantId: TENANT_A, wochenplanPlanId: WCP_ALT, archivedAt: null },
      data: { name: "Winterplan" },
    });
  });
});
