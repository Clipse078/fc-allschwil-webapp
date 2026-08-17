/**
 * ADMIN-HARD-DELETE-UI — TeamSeason delete service unit tests.
 *
 * Covers:
 *   TS-01  getTeamSeasonDeletionImpact returns null for non-existent season
 *   TS-02  getTeamSeasonDeletionImpact returns correct counts including weekplanner
 *   TS-03  deleteTeamSeasonPermanently returns null for non-existent season
 *   TS-04  deleteTeamSeasonPermanently calls weekplanner cleanup + teamSeason.delete
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    teamSeason: { findUnique: vi.fn(), delete: vi.fn() },
    trainingSession: { findMany: vi.fn() },
    weekplannerPlanAllocation: { count: vi.fn(), deleteMany: vi.fn() },
    weekplannerPlanActivityOverride: { count: vi.fn(), deleteMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));

import { prisma } from "@/lib/db/prisma";
import {
  getTeamSeasonDeletionImpact,
  deleteTeamSeasonPermanently,
} from "@/lib/teams/team-season-delete-service";

const mockPrisma = prisma as unknown as {
  teamSeason: { findUnique: ReturnType<typeof vi.fn>; delete: ReturnType<typeof vi.fn> };
  trainingSession: { findMany: ReturnType<typeof vi.fn> };
  weekplannerPlanAllocation: { count: ReturnType<typeof vi.fn>; deleteMany: ReturnType<typeof vi.fn> };
  weekplannerPlanActivityOverride: { count: ReturnType<typeof vi.fn>; deleteMany: ReturnType<typeof vi.fn> };
  $transaction: ReturnType<typeof vi.fn>;
};

describe("ADMIN-HARD-DELETE-UI — team-season-delete-service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("TS-01: returns null for non-existent TeamSeason", async () => {
    mockPrisma.teamSeason.findUnique.mockResolvedValueOnce(null);
    expect(await getTeamSeasonDeletionImpact("no-ts")).toBeNull();
  });

  it("TS-02: returns correct impact counts including weekplanner non-FK rows", async () => {
    mockPrisma.teamSeason.findUnique.mockResolvedValueOnce({
      displayName: "FC Allschwil 1 | U14 | 2026/27",
      season: { name: "2026/27" },
      team: { tenantId: "tenant-1" },
      _count: {
        playerSquadMembers: 18,
        trainerTeamMembers: 3,
        trainingSeries: 2,
        trainingSessions: 40,
        competitions: 1,
        externalMappings: 1,
      },
    });
    mockPrisma.trainingSession.findMany.mockResolvedValueOnce([
      { id: "sess-1" }, { id: "sess-2" },
    ]);
    mockPrisma.weekplannerPlanAllocation.count.mockResolvedValueOnce(5);
    mockPrisma.weekplannerPlanActivityOverride.count.mockResolvedValueOnce(3);

    const result = await getTeamSeasonDeletionImpact("ts-1");
    expect(result).toMatchObject({
      squadMembers: 18,
      trainerMembers: 3,
      trainingSeries: 2,
      trainingSessions: 40,
      weekplannerAllocations: 5,
      weekplannerOverrides: 3,
      competitionAssignments: 1,
      externalMappings: 1,
      tenantId: "tenant-1",
    });
  });

  it("TS-03: returns null from delete for non-existent TeamSeason", async () => {
    mockPrisma.teamSeason.findUnique.mockResolvedValueOnce(null);
    expect(await deleteTeamSeasonPermanently("no-ts")).toBeNull();
  });

  it("TS-04: runs weekplanner cleanup + teamSeason.delete inside transaction", async () => {
    // For getTeamSeasonDeletionImpact (called inside delete)
    mockPrisma.teamSeason.findUnique.mockResolvedValueOnce({
      displayName: "TestSeason",
      season: { name: "2026/27" },
      team: { tenantId: "tenant-1" },
      _count: {
        playerSquadMembers: 2,
        trainerTeamMembers: 1,
        trainingSeries: 1,
        trainingSessions: 5,
        competitions: 0,
        externalMappings: 0,
      },
    });
    mockPrisma.trainingSession.findMany
      .mockResolvedValueOnce([{ id: "s1" }, { id: "s2" }])
      .mockResolvedValueOnce([{ id: "s1" }, { id: "s2" }]);
    mockPrisma.weekplannerPlanAllocation.count.mockResolvedValueOnce(2);
    mockPrisma.weekplannerPlanActivityOverride.count.mockResolvedValueOnce(1);

    // Mock $transaction to invoke the callback
    mockPrisma.$transaction.mockImplementationOnce(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        weekplannerPlanAllocation: { deleteMany: vi.fn().mockResolvedValue({ count: 2 }) },
        weekplannerPlanActivityOverride: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
        teamSeason: { delete: vi.fn().mockResolvedValue({}) },
      };
      await fn(tx);
      expect(tx.weekplannerPlanAllocation.deleteMany).toHaveBeenCalledWith({
        where: { tenantId: "tenant-1", activityType: "TRAINING", activityId: { in: ["s1", "s2"] } },
      });
      expect(tx.teamSeason.delete).toHaveBeenCalledWith({ where: { id: "ts-2" } });
    });

    await deleteTeamSeasonPermanently("ts-2");
    expect(mockPrisma.$transaction).toHaveBeenCalledOnce();
  });
});
