/**
 * lib/wochenplan/__tests__/active-plan-resolution.test.ts
 *
 * WOCHENPLAN-2.0-01H-D — proves public and Infoboard operational resolution
 * share the canonical active WochenplanPlan source.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/wochenplan/plan-service", () => ({
  getActiveWochenplanPlan: vi.fn(),
}));

vi.mock("@/lib/wochenplan/public-plan-resolution", () => ({
  resolvePublicWeekplannerPlan: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    weekplannerPlan: {
      findFirst: vi.fn(),
    },
  },
}));

import { getActiveWochenplanPlan } from "../plan-service";
import { resolvePublicWeekplannerPlan } from "../public-plan-resolution";
import { getOperationalWeekplannerPlan } from "@/lib/weekplanner/plan-service";
import { prisma } from "@/lib/db/prisma";

const TENANT_A = "tenant-a";
const WEEK_ID = "2026-08-25";
const ACTIVE_ALT_ID = "wcp-alt";
const LINKED_WP_ID = "wp-alt";

const activeAlternative = {
  id: ACTIVE_ALT_ID,
  tenantId: TENANT_A,
  name: "Schlechtwetterplan",
  description: null,
  isDefault: false,
  isActive: true,
  displayOrder: 1,
  createdAt: "2026-08-01T00:00:00.000Z",
  updatedAt: "2026-08-01T00:00:00.000Z",
  archivedAt: null,
};

describe("active plan resolution — unified consumers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resolves operational plan from active WochenplanPlan, not WeekplannerPlan.isActive", async () => {
    vi.mocked(getActiveWochenplanPlan).mockResolvedValue(activeAlternative);
    vi.mocked(resolvePublicWeekplannerPlan).mockResolvedValue({
      weekplannerPlanId: LINKED_WP_ID,
      activeWochenplanPlan: activeAlternative,
      usedStandardplanFallback: false,
    });
    vi.mocked(prisma.weekplannerPlan.findFirst).mockResolvedValue({
      id: LINKED_WP_ID,
      tenantId: TENANT_A,
      weekId: WEEK_ID,
      name: "Schlechtwetterplan",
      createdByUserId: null,
      createdAt: new Date("2026-08-01T00:00:00.000Z"),
      updatedAt: new Date("2026-08-01T00:00:00.000Z"),
      archivedAt: null,
      isActive: false,
      wochenplanPlanId: ACTIVE_ALT_ID,
    } as never);

    const result = await getOperationalWeekplannerPlan(TENANT_A, WEEK_ID);

    expect(getActiveWochenplanPlan).toHaveBeenCalledWith(TENANT_A);
    expect(resolvePublicWeekplannerPlan).toHaveBeenCalledWith(TENANT_A, WEEK_ID, activeAlternative);
    expect(result?.id).toBe(LINKED_WP_ID);
    expect(result?.isActive).toBe(false);
  });

  it("returns null for default active plan (Standardplan)", async () => {
    const defaultPlan = { ...activeAlternative, isDefault: true, isActive: true, id: "wcp-default" };
    vi.mocked(getActiveWochenplanPlan).mockResolvedValue(defaultPlan);
    vi.mocked(resolvePublicWeekplannerPlan).mockResolvedValue({
      weekplannerPlanId: null,
      activeWochenplanPlan: defaultPlan,
      usedStandardplanFallback: false,
    });

    const result = await getOperationalWeekplannerPlan(TENANT_A, WEEK_ID);

    expect(result).toBeNull();
  });

  it("draft plans never leak into operational resolution", async () => {
    vi.mocked(getActiveWochenplanPlan).mockResolvedValue({
      ...activeAlternative,
      id: "wcp-default",
      name: "Standardplan",
      isDefault: true,
      isActive: true,
    });
    vi.mocked(resolvePublicWeekplannerPlan).mockResolvedValue({
      weekplannerPlanId: null,
      activeWochenplanPlan: {
        ...activeAlternative,
        id: "wcp-default",
        name: "Standardplan",
        isDefault: true,
        isActive: true,
      },
      usedStandardplanFallback: false,
    });

    const result = await getOperationalWeekplannerPlan(TENANT_A, WEEK_ID);

    expect(result).toBeNull();
  });
});
