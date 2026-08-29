/**
 * WOCHENPLAN-2.0-01H-E5 — meaningful interval + zero-duration availability tests.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    facilityResource: { findMany: vi.fn() },
    trainingSession: { findMany: vi.fn() },
    event: { findMany: vi.fn() },
    tournamentResourceAllocation: { findMany: vi.fn() },
    tournamentParticipantAllocation: { findMany: vi.fn() },
    weekplannerPlanAllocation: { findMany: vi.fn() },
    weekplannerPlanActivityOverride: { findMany: vi.fn() },
    weekplannerPlan: { findFirst: vi.fn() },
  },
}));

import { prisma } from "@/lib/db/prisma";
import { getResourceAvailability } from "../availability-service";
import { isMeaningfulEventInterval } from "../resource-occupancy-window";

const TENANT = "tenant-a";
const START = "2026-08-10T07:30:00.000Z";

describe("isMeaningfulEventInterval", () => {
  it("treats start==end as not meaningful", () => {
    expect(isMeaningfulEventInterval(START, START)).toBe(false);
  });

  it("treats end after start as meaningful", () => {
    expect(isMeaningfulEventInterval(START, "2026-08-10T09:15:00.000Z")).toBe(true);
  });
});

describe("getResourceAvailability — zero-duration query", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.facilityResource.findMany).mockResolvedValue([
      {
        id: "res-1",
        name: "Kunstrasen 2 A",
        code: "KR2A",
        facilityId: "fac-1",
        facility: { name: "Anlage" },
      },
    ] as never);
  });

  it("returns no occupancy conflicts when interval is not meaningful", async () => {
    const result = await getResourceAvailability({
      tenantId: TENANT,
      startAt: START,
      endAt: START,
      group: "PITCH_HALL",
    });

    expect(result[0]?.status).toBe("FREE");
    expect(result[0]?.conflicts).toEqual([]);
    expect(prisma.trainingSession.findMany).not.toHaveBeenCalled();
  });
});
