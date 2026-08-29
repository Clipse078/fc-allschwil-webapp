/**
 * lib/wochenplan/__tests__/plan-queries.test.ts
 *
 * WOCHENPLAN-2.0-01B — allocation resolution and plan isolation tests.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    wochenplanPlanAllocation: { findMany: vi.fn() },
    wochenplanPlan: { findFirst: vi.fn() },
  },
}));

vi.mock("../plan-service", () => ({
  getWochenplanPlan: vi.fn(),
  getActiveWochenplanPlan: vi.fn(),
}));

import { prisma } from "@/lib/db/prisma";
import { getActiveWochenplanPlan, getWochenplanPlan } from "../plan-service";
import {
  applyWochenplanPlanAllocations,
  applyActiveWochenplanPlanAllocations,
  mergeEventAllocation,
} from "../plan-queries";

const TENANT_A = "tenant-a";

const baseEvent = {
  id: "evt-1",
  pitchCode: "STADION",
  homeDressingRoomCode: "E1",
  awayDressingRoomCode: null,
};

describe("Wochenplan plan-queries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("default plan leaves canonical Event allocations unchanged", async () => {
    const events = await applyWochenplanPlanAllocations(TENANT_A, [baseEvent], {
      id: "plan-default",
      isDefault: true,
    });
    expect(events[0]).toEqual(baseEvent);
    expect(prisma.wochenplanPlanAllocation.findMany).not.toHaveBeenCalled();
  });

  it("alternative plan applies sparse overrides per event", async () => {
    vi.mocked(prisma.wochenplanPlanAllocation.findMany).mockResolvedValue([
      {
        eventId: "evt-1",
        pitchCode: "KUNSTRASEN_2",
        homeDressingRoomCode: "E2",
        awayDressingRoomCode: null,
      },
    ] as never);

    const events = await applyWochenplanPlanAllocations(TENANT_A, [baseEvent], {
      id: "plan-alt",
      isDefault: false,
    });

    expect(events[0].pitchCode).toBe("KUNSTRASEN_2");
    expect(events[0].homeDressingRoomCode).toBe("E2");
  });

  it("events without overrides inherit canonical allocations in alternative plans", async () => {
    vi.mocked(prisma.wochenplanPlanAllocation.findMany).mockResolvedValue([]);

    const events = await applyWochenplanPlanAllocations(
      TENANT_A,
      [baseEvent, { ...baseEvent, id: "evt-2", pitchCode: "KUNSTRASEN_3" }],
      { id: "plan-alt", isDefault: false },
    );

    expect(events[0].pitchCode).toBe("STADION");
    expect(events[1].pitchCode).toBe("KUNSTRASEN_3");
  });

  it("applyActiveWochenplanPlanAllocations resolves only the active public plan", async () => {
    vi.mocked(getActiveWochenplanPlan).mockResolvedValue({
      id: "plan-active",
      tenantId: TENANT_A,
      name: "Winterplan",
      description: null,
      isDefault: false,
      isActive: true,
      displayOrder: 1,
      createdAt: "",
      updatedAt: "",
      archivedAt: null,
    });
    vi.mocked(prisma.wochenplanPlanAllocation.findMany).mockResolvedValue([
      {
        eventId: "evt-1",
        pitchCode: "KUNSTRASEN_2",
        homeDressingRoomCode: null,
        awayDressingRoomCode: null,
      },
    ] as never);

    const { events, activePlan } = await applyActiveWochenplanPlanAllocations(TENANT_A, [baseEvent]);
    expect(activePlan?.name).toBe("Winterplan");
    expect(events[0].pitchCode).toBe("KUNSTRASEN_2");
  });

  it("mergeEventAllocation replaces all allocation fields when override exists", () => {
    const merged = mergeEventAllocation(baseEvent, {
      id: "evt-1",
      pitchCode: "KUNSTRASEN_3",
      homeDressingRoomCode: "O1",
      awayDressingRoomCode: "O2",
    });
    expect(merged.pitchCode).toBe("KUNSTRASEN_3");
    expect(merged.homeDressingRoomCode).toBe("O1");
    expect(merged.awayDressingRoomCode).toBe("O2");
  });

  it("inactive plans are not applied by applyActiveWochenplanPlanAllocations when none active", async () => {
    vi.mocked(getActiveWochenplanPlan).mockResolvedValue(null);
    const { events, activePlan } = await applyActiveWochenplanPlanAllocations(TENANT_A, [baseEvent]);
    expect(activePlan).toBeNull();
    expect(events[0]).toEqual(baseEvent);
  });
});

describe("resolveWochenplanPlanForRead", () => {
  it("viewed plan and active plan are independent concepts", async () => {
    const { resolveWochenplanPlanForRead } = await import("../plan-queries");
    vi.mocked(getWochenplanPlan).mockResolvedValue({
      id: "plan-view",
      tenantId: TENANT_A,
      name: "Ansichtsplan",
      description: null,
      isDefault: false,
      isActive: false,
      displayOrder: 2,
      createdAt: "",
      updatedAt: "",
      archivedAt: null,
    });
    vi.mocked(getActiveWochenplanPlan).mockResolvedValue({
      id: "plan-active",
      tenantId: TENANT_A,
      name: "Öffentlicher Plan",
      description: null,
      isDefault: true,
      isActive: true,
      displayOrder: 0,
      createdAt: "",
      updatedAt: "",
      archivedAt: null,
    });

    const viewed = await resolveWochenplanPlanForRead(TENANT_A, "plan-view");
    const active = await getActiveWochenplanPlan(TENANT_A);

    expect(viewed?.id).toBe("plan-view");
    expect(viewed?.isActive).toBe(false);
    expect(active?.id).toBe("plan-active");
    expect(active?.isActive).toBe(true);
  });
});
