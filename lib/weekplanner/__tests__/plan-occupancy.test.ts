/**
 * WOCHENPLAN-2.0-01H-E2 — occupancy persistence tests for plan-service.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    weekplannerPlan: { findFirst: vi.fn() },
    weekplannerPlanAllocation: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      aggregate: vi.fn(),
    },
    trainingSession: { findFirst: vi.fn() },
    event: { findFirst: vi.fn() },
    tournamentParticipant: { findFirst: vi.fn() },
    facilityResource: { findFirst: vi.fn() },
  },
}));

import { prisma } from "@/lib/db/prisma";
import {
  createWeekplannerPlanAllocation,
  updateWeekplannerPlanAllocation,
} from "../plan-service";
import { WeekplannerPlanAllocationOccupancyValidationError } from "../plan-errors";

const TENANT = "tenant-a";
const PLAN_ID = "plan-1";
const ROOM_RESOURCE = {
  id: "res-room-1",
  type: "DRESSING_ROOM",
  status: "ACTIVE",
  facility: { id: "fac-1", status: "ACTIVE" },
};

function allocationRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "alloc-1",
    tenantId: TENANT,
    weekplannerPlanId: PLAN_ID,
    activityType: "TRAINING",
    activityId: "session-1",
    allocationGroup: "DRESSING_ROOM",
    participantId: "",
    facilityResourceId: ROOM_RESOURCE.id,
    notes: null,
    displayOrder: 0,
    occupancyBeforeMinutes: 0,
    occupancyAfterMinutes: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    facilityResource: {
      name: "Garderobe E1",
      code: "E1",
      type: "DRESSING_ROOM",
      facilityId: "fac-1",
      facility: { name: "Garderobentrakt" },
    },
    ...overrides,
  };
}

describe("plan occupancy persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.weekplannerPlan.findFirst).mockResolvedValue({
      id: PLAN_ID,
      tenantId: TENANT,
      weekId: "2026-08-10",
      archivedAt: null,
    } as never);
    vi.mocked(prisma.trainingSession.findFirst).mockResolvedValue({ id: "session-1" } as never);
    vi.mocked(prisma.facilityResource.findFirst).mockResolvedValue(ROOM_RESOURCE as never);
    vi.mocked(prisma.weekplannerPlanAllocation.aggregate).mockResolvedValue({ _max: { displayOrder: 0 } } as never);
  });

  it("defaults to 0/0 on create", async () => {
    vi.mocked(prisma.weekplannerPlanAllocation.create).mockResolvedValue(allocationRow() as never);
    const dto = await createWeekplannerPlanAllocation(TENANT, {
      weekplannerPlanId: PLAN_ID,
      activityType: "TRAINING",
      activityId: "session-1",
      allocationGroup: "DRESSING_ROOM",
      facilityResourceId: ROOM_RESOURCE.id,
    });
    expect(dto.occupancyBeforeMinutes).toBe(0);
    expect(dto.occupancyAfterMinutes).toBe(0);
  });

  it("saves and reads 45/30 round-trip", async () => {
    vi.mocked(prisma.weekplannerPlanAllocation.create).mockResolvedValue(
      allocationRow({ occupancyBeforeMinutes: 45, occupancyAfterMinutes: 30 }) as never,
    );
    const dto = await createWeekplannerPlanAllocation(TENANT, {
      weekplannerPlanId: PLAN_ID,
      activityType: "TRAINING",
      activityId: "session-1",
      allocationGroup: "DRESSING_ROOM",
      facilityResourceId: ROOM_RESOURCE.id,
      occupancyBeforeMinutes: 45,
      occupancyAfterMinutes: 30,
    });
    expect(dto.occupancyBeforeMinutes).toBe(45);
    expect(dto.occupancyAfterMinutes).toBe(30);
  });

  it("accepts arbitrary 17/23", async () => {
    vi.mocked(prisma.weekplannerPlanAllocation.create).mockResolvedValue(
      allocationRow({ occupancyBeforeMinutes: 17, occupancyAfterMinutes: 23 }) as never,
    );
    const dto = await createWeekplannerPlanAllocation(TENANT, {
      weekplannerPlanId: PLAN_ID,
      activityType: "TRAINING",
      activityId: "session-1",
      allocationGroup: "DRESSING_ROOM",
      facilityResourceId: ROOM_RESOURCE.id,
      occupancyBeforeMinutes: 17,
      occupancyAfterMinutes: 23,
    });
    expect(dto.occupancyBeforeMinutes).toBe(17);
    expect(dto.occupancyAfterMinutes).toBe(23);
  });

  it("rejects negative occupancy", async () => {
    await expect(
      createWeekplannerPlanAllocation(TENANT, {
        weekplannerPlanId: PLAN_ID,
        activityType: "TRAINING",
        activityId: "session-1",
        allocationGroup: "DRESSING_ROOM",
        facilityResourceId: ROOM_RESOURCE.id,
        occupancyBeforeMinutes: -5,
      }),
    ).rejects.toBeInstanceOf(WeekplannerPlanAllocationOccupancyValidationError);
  });

  it("rejects non-integer occupancy", async () => {
    await expect(
      createWeekplannerPlanAllocation(TENANT, {
        weekplannerPlanId: PLAN_ID,
        activityType: "TRAINING",
        activityId: "session-1",
        allocationGroup: "DRESSING_ROOM",
        facilityResourceId: ROOM_RESOURCE.id,
        occupancyAfterMinutes: 12.5,
      }),
    ).rejects.toBeInstanceOf(WeekplannerPlanAllocationOccupancyValidationError);
  });

  it("updates occupancy via PATCH service", async () => {
    vi.mocked(prisma.weekplannerPlanAllocation.findFirst).mockResolvedValue(allocationRow() as never);
    vi.mocked(prisma.weekplannerPlanAllocation.update).mockResolvedValue(
      allocationRow({ occupancyBeforeMinutes: 60, occupancyAfterMinutes: 45 }) as never,
    );
    const dto = await updateWeekplannerPlanAllocation(TENANT, "alloc-1", {
      occupancyBeforeMinutes: 60,
      occupancyAfterMinutes: 45,
    });
    expect(dto.occupancyBeforeMinutes).toBe(60);
    expect(dto.occupancyAfterMinutes).toBe(45);
  });
});
