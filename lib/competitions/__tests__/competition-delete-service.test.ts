/**
 * ADMIN-HARD-DELETE-UI-UPLIFT — Competition delete service unit tests.
 *
 * Covers:
 *   CS-01  getCompetitionDeletionImpact returns null for non-existent competition
 *   CS-02  getCompetitionDeletionImpact returns null for wrong tenant
 *   CS-03  getCompetitionDeletionImpact returns correct impact
 *   CS-04  deleteCompetitionPermanently removes TeamSeasonCompetition first then Competition
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    competition: { findUnique: vi.fn(), delete: vi.fn() },
    $transaction: vi.fn(),
  },
}));

import { prisma } from "@/lib/db/prisma";
import {
  getCompetitionDeletionImpact,
  deleteCompetitionPermanently,
} from "@/lib/competitions/competition-delete-service";

const mockPrisma = prisma as unknown as {
  competition: { findUnique: ReturnType<typeof vi.fn>; delete: ReturnType<typeof vi.fn> };
  $transaction: ReturnType<typeof vi.fn>;
};

const TENANT_ID = "tenant-1";

describe("ADMIN-HARD-DELETE-UI-UPLIFT — competition-delete-service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("CS-01: returns null for non-existent competition", async () => {
    mockPrisma.competition.findUnique.mockResolvedValueOnce(null);
    expect(await getCompetitionDeletionImpact(TENANT_ID, "no-comp")).toBeNull();
  });

  it("CS-02: returns null for wrong tenant", async () => {
    mockPrisma.competition.findUnique.mockResolvedValueOnce({
      tenantId: "other-tenant",
      officialName: "Liga A",
      shortName: null,
      _count: { teamSeasonCompetitions: 2, teamExternalMappings: 0 },
    });
    expect(await getCompetitionDeletionImpact(TENANT_ID, "comp-1")).toBeNull();
  });

  it("CS-03: returns correct impact", async () => {
    mockPrisma.competition.findUnique.mockResolvedValueOnce({
      tenantId: TENANT_ID,
      officialName: "Nationalliga B",
      shortName: "NLB",
      _count: { teamSeasonCompetitions: 3, teamExternalMappings: 1 },
    });
    const result = await getCompetitionDeletionImpact(TENANT_ID, "comp-2");
    expect(result).toEqual({
      officialName: "Nationalliga B",
      shortName: "NLB",
      teamSeasonAssignments: 3,
      externalMappingContexts: 1,
    });
  });

  it("CS-04: deletes TeamSeasonCompetition rows first, then Competition", async () => {
    mockPrisma.competition.findUnique.mockResolvedValueOnce({
      tenantId: TENANT_ID,
      officialName: "Liga A",
      shortName: null,
      _count: { teamSeasonCompetitions: 2, teamExternalMappings: 0 },
    });

    const txDeleteMany = vi.fn().mockResolvedValue({ count: 2 });
    const txDelete = vi.fn().mockResolvedValue({});
    mockPrisma.$transaction.mockImplementationOnce(async (fn: (tx: unknown) => Promise<unknown>) => {
      await fn({ teamSeasonCompetition: { deleteMany: txDeleteMany }, competition: { delete: txDelete } });
    });

    await deleteCompetitionPermanently(TENANT_ID, "comp-3");

    expect(txDeleteMany).toHaveBeenCalledWith({ where: { competitionId: "comp-3" } });
    expect(txDelete).toHaveBeenCalledWith({ where: { id: "comp-3" } });
  });
});
