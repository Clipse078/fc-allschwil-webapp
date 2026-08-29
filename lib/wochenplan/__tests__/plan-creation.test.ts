/**
 * lib/wochenplan/__tests__/plan-creation.test.ts
 *
 * WOCHENPLAN-2.0-01H-C — create plan with week materialization tests.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/wochenplan/plan-service", () => ({
  createWochenplanPlan: vi.fn(),
}));

vi.mock("@/lib/wochenplan/plan-materialization", () => ({
  materializeLinkedWeekplannerPlan: vi.fn(),
}));

vi.mock("@/lib/weekplanner/plan-copy", () => ({
  copyWeekplannerOperationalState: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    wochenplanPlan: { findFirst: vi.fn(), delete: vi.fn() },
    weekplannerPlan: { delete: vi.fn() },
  },
}));

import { createWochenplanPlan } from "../plan-service";
import { materializeLinkedWeekplannerPlan } from "../plan-materialization";
import { copyWeekplannerOperationalState } from "@/lib/weekplanner/plan-copy";
import { prisma } from "@/lib/db/prisma";
import { createWochenplanPlanWithWeek } from "../plan-creation";
import { WochenplanPlanArchivedError, WochenplanPlanValidationError } from "../plan-errors";

const TENANT_A = "tenant-a";
const WEEK_ID = "2026-08-25";

describe("createWochenplanPlanWithWeek", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createWochenplanPlan).mockResolvedValue({
      id: "wcp-new",
      tenantId: TENANT_A,
      name: "Schlechtwetterplan",
      description: null,
      isDefault: false,
      isActive: false,
      displayOrder: 1,
      createdAt: "2026-08-01T00:00:00.000Z",
      updatedAt: "2026-08-01T00:00:00.000Z",
      archivedAt: null,
    });
    vi.mocked(materializeLinkedWeekplannerPlan).mockResolvedValue({
      weekplannerPlan: {
        id: "wp-new",
        tenantId: TENANT_A,
        weekId: WEEK_ID,
        name: "Schlechtwetterplan",
        createdByUserId: null,
        createdAt: "2026-08-01T00:00:00.000Z",
        updatedAt: "2026-08-01T00:00:00.000Z",
        archivedAt: null,
        isActive: false,
        wochenplanPlanId: "wcp-new",
      },
      created: true,
    });
    vi.mocked(prisma.wochenplanPlan.findFirst).mockResolvedValue({
      id: "wcp-source",
      archivedAt: null,
    } as never);
  });

  it("creates an empty alternative plan and materializes it for the week", async () => {
    const result = await createWochenplanPlanWithWeek(TENANT_A, {
      name: "Schlechtwetterplan",
      weekId: WEEK_ID,
      mode: "empty",
    });

    expect(createWochenplanPlan).toHaveBeenCalledWith(TENANT_A, {
      name: "Schlechtwetterplan",
      description: undefined,
    });
    expect(materializeLinkedWeekplannerPlan).toHaveBeenCalledWith(
      TENANT_A,
      WEEK_ID,
      "wcp-new",
      expect.objectContaining({ createdByUserId: null }),
    );
    expect(copyWeekplannerOperationalState).not.toHaveBeenCalled();
    expect(result.plan.isActive).toBe(false);
    expect(result.weekplannerPlan.isActive).toBe(false);
  });

  it("copies operational state when mode is copy", async () => {
    await createWochenplanPlanWithWeek(TENANT_A, {
      name: "Fernwetterplan",
      weekId: WEEK_ID,
      mode: "copy",
      sourceWochenplanPlanId: "wcp-source",
    });

    expect(copyWeekplannerOperationalState).toHaveBeenCalledWith(
      TENANT_A,
      WEEK_ID,
      "wcp-source",
      "wp-new",
    );
  });

  it("requires sourceWochenplanPlanId for copy mode", async () => {
    await expect(
      createWochenplanPlanWithWeek(TENANT_A, {
        name: "Fernwetterplan",
        weekId: WEEK_ID,
        mode: "copy",
      }),
    ).rejects.toBeInstanceOf(WochenplanPlanValidationError);
  });

  it("rejects archived copy sources", async () => {
    vi.mocked(prisma.wochenplanPlan.findFirst).mockResolvedValue({
      id: "wcp-source",
      archivedAt: new Date(),
    } as never);

    await expect(
      createWochenplanPlanWithWeek(TENANT_A, {
        name: "Fernwetterplan",
        weekId: WEEK_ID,
        mode: "copy",
        sourceWochenplanPlanId: "wcp-source",
      }),
    ).rejects.toBeInstanceOf(WochenplanPlanArchivedError);
  });
});
