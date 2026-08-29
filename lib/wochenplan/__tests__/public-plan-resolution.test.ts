/**
 * WOCHENPLAN-2.0-01E — canonical plan identity resolution tests.
 *
 * Proves tenant-level WochenplanPlan resolves to WeekplannerPlan by stable
 * wochenplanPlanId, never by display name.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import type { WochenplanPlanDto } from "../plan-types";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    weekplannerPlan: { findFirst: vi.fn() },
  },
}));

import { prisma } from "@/lib/db/prisma";
import {
  findLinkedWeekplannerPlan,
  resolvePublicWeekplannerPlan,
} from "../public-plan-resolution";

const TENANT_A = "tenant-a";
const TENANT_B = "tenant-b";
const WEEK_ID = "2026-08-24";
const OTHER_WEEK = "2026-08-17";
const WCP_DEFAULT = "wcp-default";
const WCP_ALT = "wcp-alt";
const WP_LINKED = "wp-linked";

function wochenplanPlan(overrides: Partial<WochenplanPlanDto> = {}): WochenplanPlanDto {
  return {
    id: WCP_ALT,
    tenantId: TENANT_A,
    name: "Schlechtwetterplan",
    description: null,
    isDefault: false,
    isActive: true,
    displayOrder: 1,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    archivedAt: null,
    ...overrides,
  };
}

describe("findLinkedWeekplannerPlan", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("scopes lookup by tenantId, weekId, and wochenplanPlanId", async () => {
    vi.mocked(prisma.weekplannerPlan.findFirst).mockResolvedValue({ id: WP_LINKED } as never);

    const result = await findLinkedWeekplannerPlan(TENANT_A, WEEK_ID, WCP_ALT);

    expect(result).toEqual({ id: WP_LINKED });
    expect(prisma.weekplannerPlan.findFirst).toHaveBeenCalledWith({
      where: {
        tenantId: TENANT_A,
        weekId: WEEK_ID,
        wochenplanPlanId: WCP_ALT,
        archivedAt: null,
      },
      select: { id: true },
    });
  });

  it("returns null when no linked concrete plan exists", async () => {
    vi.mocked(prisma.weekplannerPlan.findFirst).mockResolvedValue(null);

    const result = await findLinkedWeekplannerPlan(TENANT_A, WEEK_ID, WCP_ALT);
    expect(result).toBeNull();
  });
});

describe("resolvePublicWeekplannerPlan", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("1. tenant isolation — lookup uses caller tenantId", async () => {
    vi.mocked(prisma.weekplannerPlan.findFirst).mockResolvedValue(null);

    await resolvePublicWeekplannerPlan(TENANT_B, WEEK_ID, wochenplanPlan({ tenantId: TENANT_B }));

    expect(prisma.weekplannerPlan.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: TENANT_B }),
      }),
    );
  });

  it("2. default/base plan resolves to Standardplan (null weekplannerPlanId)", async () => {
    const result = await resolvePublicWeekplannerPlan(
      TENANT_A,
      WEEK_ID,
      wochenplanPlan({ id: WCP_DEFAULT, isDefault: true, isActive: true, name: "Standardplan" }),
    );

    expect(result.weekplannerPlanId).toBeNull();
    expect(result.usedStandardplanFallback).toBe(false);
    expect(prisma.weekplannerPlan.findFirst).not.toHaveBeenCalled();
  });

  it("3. alternative plan resolves by wochenplanPlanId, not name", async () => {
    vi.mocked(prisma.weekplannerPlan.findFirst).mockResolvedValue({ id: WP_LINKED } as never);

    const result = await resolvePublicWeekplannerPlan(TENANT_A, WEEK_ID, wochenplanPlan());

    expect(result.weekplannerPlanId).toBe(WP_LINKED);
    expect(result.usedStandardplanFallback).toBe(false);
    expect(prisma.weekplannerPlan.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          wochenplanPlanId: WCP_ALT,
          archivedAt: null,
        }),
      }),
    );
    const where = vi.mocked(prisma.weekplannerPlan.findFirst).mock.calls[0][0]?.where as Record<string, unknown>;
    expect(where).not.toHaveProperty("name");
  });

  it("4. renaming WochenplanPlan does not break week association", async () => {
    vi.mocked(prisma.weekplannerPlan.findFirst).mockResolvedValue({ id: WP_LINKED } as never);

    const renamed = wochenplanPlan({ name: "Umbenannter Plan" });
    const result = await resolvePublicWeekplannerPlan(TENANT_A, WEEK_ID, renamed);

    expect(result.weekplannerPlanId).toBe(WP_LINKED);
    expect(prisma.weekplannerPlan.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ wochenplanPlanId: WCP_ALT }),
      }),
    );
  });

  it("5. same display names cannot cause cross-plan resolution", async () => {
    vi.mocked(prisma.weekplannerPlan.findFirst).mockResolvedValue({ id: WP_LINKED } as never);

    const winterTenantPlan = wochenplanPlan({ id: "wcp-winter", name: "Winterplan" });
    await resolvePublicWeekplannerPlan(TENANT_A, WEEK_ID, winterTenantPlan);

    expect(prisma.weekplannerPlan.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ wochenplanPlanId: "wcp-winter" }),
      }),
    );
  });

  it("6. week scoping is respected", async () => {
    vi.mocked(prisma.weekplannerPlan.findFirst).mockResolvedValue(null);

    await resolvePublicWeekplannerPlan(TENANT_A, OTHER_WEEK, wochenplanPlan());

    expect(prisma.weekplannerPlan.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ weekId: OTHER_WEEK }),
      }),
    );
  });

  it("7. missing concrete week alternative falls back to Standardplan deterministically", async () => {
    vi.mocked(prisma.weekplannerPlan.findFirst).mockResolvedValue(null);

    const result = await resolvePublicWeekplannerPlan(TENANT_A, WEEK_ID, wochenplanPlan());

    expect(result.weekplannerPlanId).toBeNull();
    expect(result.usedStandardplanFallback).toBe(true);
    expect(result.activeWochenplanPlan?.id).toBe(WCP_ALT);
  });

  it("8. archived active WochenplanPlan does not leak into public resolution", async () => {
    const result = await resolvePublicWeekplannerPlan(
      TENANT_A,
      WEEK_ID,
      wochenplanPlan({ archivedAt: "2026-08-01T00:00:00.000Z", isActive: false }),
    );

    expect(result.activeWochenplanPlan).toBeNull();
    expect(result.weekplannerPlanId).toBeNull();
    expect(prisma.weekplannerPlan.findFirst).not.toHaveBeenCalled();
  });

  it("9. null active plan returns empty resolution", async () => {
    const result = await resolvePublicWeekplannerPlan(TENANT_A, WEEK_ID, null);

    expect(result).toEqual({
      weekplannerPlanId: null,
      activeWochenplanPlan: null,
      usedStandardplanFallback: false,
    });
  });
});
