/**
 * lib/integrations/sfv/sync/__tests__/club-consolidation.test.ts
 *
 * CLUB-DIRECTORY-02C — unit tests for the SFV-specific orchestration layer
 * above the pure consolidation service. Mocks the SFV client and the
 * consolidation service/adapter — the merge logic itself is unit- and
 * integration-tested independently in
 * lib/club-directory/__tests__/consolidation-service.test.ts.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFetchTeamList = vi.fn();
const mockFetchClubRanking = vi.fn();
vi.mock("../../client", () => ({
  fetchTeamList: (...args: unknown[]) => mockFetchTeamList(...args),
  fetchClubRanking: (...args: unknown[]) => mockFetchClubRanking(...args),
}));

const mockConsolidateExternalClubsByProviderIdentity = vi.fn();
vi.mock("@/lib/club-directory/consolidation-service", () => ({
  consolidateExternalClubsByProviderIdentity: (...args: unknown[]) =>
    mockConsolidateExternalClubsByProviderIdentity(...args),
}));

const mockCreateClubConsolidationDatabase = vi.fn().mockReturnValue({ fake: "consolidation-database" });
vi.mock("@/lib/club-directory/prisma-consolidation-adapter", () => ({
  createClubConsolidationDatabase: (...args: unknown[]) => mockCreateClubConsolidationDatabase(...args),
}));

vi.mock("@/lib/db/prisma", () => ({ prisma: { fake: "prisma-client" } }));

const { runSfvClubConsolidationForCurrentSync, runSfvClubConsolidationForTenant } = await import(
  "../club-consolidation"
);

beforeEach(() => {
  vi.clearAllMocks();
  mockCreateClubConsolidationDatabase.mockReturnValue({ fake: "consolidation-database" });
});

describe("runSfvClubConsolidationForCurrentSync", () => {
  it("returns null without calling the consolidation service when no index was resolved this run", async () => {
    const result = await runSfvClubConsolidationForCurrentSync("tenant-1", undefined);

    expect(result).toBeNull();
    expect(mockConsolidateExternalClubsByProviderIdentity).not.toHaveBeenCalled();
  });

  it("returns null without calling the consolidation service when the index is empty", async () => {
    const result = await runSfvClubConsolidationForCurrentSync("tenant-1", new Map());

    expect(result).toBeNull();
    expect(mockConsolidateExternalClubsByProviderIdentity).not.toHaveBeenCalled();
  });

  it("invokes the consolidation service with the tenantId, provider SFV, and the resolved index", async () => {
    const index = new Map([[2001, 700]]);
    mockConsolidateExternalClubsByProviderIdentity.mockResolvedValueOnce({
      groupsProcessed: 1,
      groupsMerged: 1,
      groupsAlreadyConsolidated: 0,
      teamsMoved: 1,
      clubsArchived: 1,
      details: [],
    });

    const result = await runSfvClubConsolidationForCurrentSync("tenant-1", index);

    expect(mockConsolidateExternalClubsByProviderIdentity).toHaveBeenCalledWith(
      { fake: "consolidation-database" },
      { tenantId: "tenant-1", provider: "SFV", resolvedClubIdsByTeamId: index },
    );
    expect(result).toMatchObject({ groupsMerged: 1 });
  });

  it("never throws — a consolidation failure resolves to null (best-effort)", async () => {
    mockConsolidateExternalClubsByProviderIdentity.mockRejectedValueOnce(new Error("DB unavailable"));

    await expect(
      runSfvClubConsolidationForCurrentSync("tenant-1", new Map([[2001, 700]])),
    ).resolves.toBeNull();
  });
});

describe("runSfvClubConsolidationForTenant", () => {
  it("fetches own teams and ranking, builds the identity index, and invokes consolidation", async () => {
    mockFetchTeamList.mockResolvedValueOnce([
      {
        isHomeTeam: true,
        teamId: 1001,
        teamName: "FC Allschwil 1",
        teamFullname: "FC Allschwil 1",
        clubNumber: 483,
        clubName: "FC Allschwil",
        teamLeagueId: 1,
        teamLeagueName: "2. Liga",
        teamDivisionName: "Vorrunde",
        teamOrganisationId: 1,
        isTeamActive: true,
      },
    ]);
    mockFetchClubRanking.mockResolvedValueOnce([
      {
        leagueId: 1,
        leagueNumber: 1,
        leagueName: "2. Liga",
        divisionId: 1,
        divisionName: "Vorrunde",
        groupId: 1,
        groupName: "Gruppe 1",
        teamName: "FC Therwil 1",
        clubNumber: 700,
        position: 2,
        matches: 3,
        wins: 1,
        draws: 1,
        losses: 1,
        penaltyPoints: 0,
        goalsFor: 4,
        goalsAgainst: 4,
        points: 4,
        teamId: 2001,
      },
    ]);
    mockConsolidateExternalClubsByProviderIdentity.mockResolvedValueOnce({
      groupsProcessed: 2,
      groupsMerged: 0,
      groupsAlreadyConsolidated: 2,
      teamsMoved: 0,
      clubsArchived: 0,
      details: [],
    });

    const result = await runSfvClubConsolidationForTenant("tenant-1", 483, 2027);

    expect(mockFetchTeamList).toHaveBeenCalledWith({ SeasonId: 2027, ClubId: 483 });
    expect(mockFetchClubRanking).toHaveBeenCalledWith({ SeasonId: 2027, ClubId: 483 });
    expect(mockConsolidateExternalClubsByProviderIdentity).toHaveBeenCalledWith(
      { fake: "consolidation-database" },
      expect.objectContaining({ tenantId: "tenant-1", provider: "SFV" }),
    );
    const [, callArg] = mockConsolidateExternalClubsByProviderIdentity.mock.calls[0];
    expect(callArg.resolvedClubIdsByTeamId.get(1001)).toBe(483);
    expect(callArg.resolvedClubIdsByTeamId.get(2001)).toBe(700);
    expect(result.consolidation.groupsProcessed).toBe(2);
  });

  it("includes OrganisationId in both fetches when supplied", async () => {
    mockFetchTeamList.mockResolvedValueOnce([]);
    mockFetchClubRanking.mockResolvedValueOnce([]);
    mockConsolidateExternalClubsByProviderIdentity.mockResolvedValueOnce({
      groupsProcessed: 0,
      groupsMerged: 0,
      groupsAlreadyConsolidated: 0,
      teamsMoved: 0,
      clubsArchived: 0,
      details: [],
    });

    await runSfvClubConsolidationForTenant("tenant-1", 483, 2027, 8);

    expect(mockFetchTeamList).toHaveBeenCalledWith({ SeasonId: 2027, ClubId: 483, OrganisationId: 8 });
    expect(mockFetchClubRanking).toHaveBeenCalledWith({ SeasonId: 2027, ClubId: 483, OrganisationId: 8 });
  });

  it("propagates a real fetch failure — this entry point is NOT best-effort (used by the explicit backfill script)", async () => {
    mockFetchTeamList.mockRejectedValueOnce(new Error("SFV unavailable"));

    await expect(runSfvClubConsolidationForTenant("tenant-1", 483, 2027)).rejects.toThrow("SFV unavailable");
    expect(mockConsolidateExternalClubsByProviderIdentity).not.toHaveBeenCalled();
  });
});
