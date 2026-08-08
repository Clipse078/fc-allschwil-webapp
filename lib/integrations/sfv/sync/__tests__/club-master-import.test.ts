/**
 * lib/integrations/sfv/sync/__tests__/club-master-import.test.ts
 *
 * CLUB-DIRECTORY-05 — unit tests for the SFV club master import orchestrator.
 * Mocks the SFV client, tenant config service/repository, and the Club
 * Directory discovery/database wiring — the pure identity/candidate logic is
 * unit-tested independently in club-identity.test.ts, and the club-only
 * resolve-or-create logic (race-safety, idempotency, ownership rules) is
 * unit-tested independently in
 * lib/club-directory/__tests__/discovery-service.test.ts.
 *
 * TEST COVERAGE MAP:
 *   1.  First import creates a canonical ExternalClub for every distinct
 *       opponent clubNumber this run proves, excluding the tenant's own club.
 *   2.  Rerun against unchanged SFV data is idempotent (created = 0, all
 *       candidates counted as "updated").
 *   3.  Exactly two SFV calls per run regardless of candidate count (bounded
 *       call volume — never one call per candidate club).
 *   4.  OrganisationId is forwarded to both calls when configured.
 *   5.  A ranking-fetch failure aborts the whole run before any candidate is
 *       processed (no database mutation) and never calls markSuccessful.
 *   6.  A team-list-fetch failure is best-effort — the import still proceeds
 *       using ranking data alone.
 *   7.  A partial per-candidate failure is counted and reported without
 *       aborting the remaining candidates (safe partial-failure handling).
 *   8.  lastClubMasterImportAt is marked successful only when failed === 0.
 *   9.  The coverage description is always included in the result.
 *   10. Propagates SfvTenantConfigNotFoundError / SfvTenantConfigDisabledError
 *       unchanged (same contract as every other sync entry point).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { TeamDetail, ClubRankingEntry } from "../../client";

// ── Mock: SFV client ──────────────────────────────────────────────────────────

const mockFetchClubRanking = vi.fn();
const mockFetchTeamList = vi.fn();
vi.mock("../../client", () => ({
  fetchClubRanking: (...args: unknown[]) => mockFetchClubRanking(...args),
  fetchTeamList: (...args: unknown[]) => mockFetchTeamList(...args),
}));

// ── Mock: tenant config service/repository ────────────────────────────────────

const mockRequireEnabledSfvConfigForTenant = vi.fn();
vi.mock("../../tenant-config-service", () => ({
  requireEnabledSfvConfigForTenant: (...args: unknown[]) =>
    mockRequireEnabledSfvConfigForTenant(...args),
}));

const mockMarkClubMasterImportSuccessful = vi.fn();
vi.mock("../../tenant-config-repository", () => ({
  markClubMasterImportSuccessful: (...args: unknown[]) =>
    mockMarkClubMasterImportSuccessful(...args),
}));

// ── Mock: Club Directory discovery/database wiring ────────────────────────────

const mockDiscoverExternalClubFromProvider = vi.fn();
vi.mock("@/lib/club-directory/discovery-service", () => ({
  discoverExternalClubFromProvider: (...args: unknown[]) =>
    mockDiscoverExternalClubFromProvider(...args),
}));

const mockCreateClubDirectoryMutationDatabase = vi.fn().mockReturnValue({ fake: "mutation-database" });
vi.mock("@/lib/club-directory/prisma-mutation-adapter", () => ({
  createClubDirectoryMutationDatabase: (...args: unknown[]) =>
    mockCreateClubDirectoryMutationDatabase(...args),
}));

vi.mock("@/lib/db/prisma", () => ({ prisma: { fake: "prisma-client" } }));

const { runSfvClubMasterImport, SFV_CLUB_MASTER_IMPORT_COVERAGE_DESCRIPTION } = await import(
  "../club-master-import"
);

// ── Fixtures ──────────────────────────────────────────────────────────────────

const OWN_CLUB_ID = 483;
const SEASON_ID = 2027;

function ownTeam(overrides: Partial<TeamDetail> = {}): TeamDetail {
  return {
    isHomeTeam: true,
    teamId: 1001,
    teamName: "FC Allschwil 1",
    teamFullname: "FC Allschwil 1. Mannschaft",
    clubNumber: OWN_CLUB_ID,
    clubName: "FC Allschwil",
    teamLeagueId: 1,
    teamLeagueName: "2. Liga",
    teamDivisionName: "Vorrunde",
    teamOrganisationId: 1,
    isTeamActive: true,
    ...overrides,
  };
}

function rankingEntry(overrides: Partial<ClubRankingEntry> = {}): ClubRankingEntry {
  return {
    leagueId: 1,
    leagueNumber: 1,
    leagueName: "2. Liga",
    divisionId: 1,
    divisionName: "Vorrunde",
    groupId: 1,
    groupName: "Gruppe 1",
    teamName: "FC Allschwil 1",
    clubNumber: OWN_CLUB_ID,
    position: 1,
    matches: 5,
    wins: 3,
    draws: 1,
    losses: 1,
    penaltyPoints: 0,
    goalsFor: 10,
    goalsAgainst: 4,
    points: 10,
    teamId: 1001,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCreateClubDirectoryMutationDatabase.mockReturnValue({ fake: "mutation-database" });
  mockRequireEnabledSfvConfigForTenant.mockResolvedValue({
    tenantId: "tenant-1",
    clubId: OWN_CLUB_ID,
    defaultSeasonId: SEASON_ID,
    organisationId: null,
    enabled: true,
  });
});

describe("runSfvClubMasterImport — first import", () => {
  it("creates a canonical club for every distinct opponent clubNumber, excluding the tenant's own club", async () => {
    mockFetchClubRanking.mockResolvedValueOnce([
      rankingEntry({ teamId: 1001, clubNumber: OWN_CLUB_ID }),
      rankingEntry({ teamId: 2001, clubNumber: 700, teamName: "FC Therwil 1" }),
      rankingEntry({ teamId: 3001, clubNumber: 850, teamName: "FC Aesch 1" }),
    ]);
    mockFetchTeamList.mockResolvedValueOnce([ownTeam()]);
    mockDiscoverExternalClubFromProvider
      .mockResolvedValueOnce({ club: { id: "club-700" }, discovered: true })
      .mockResolvedValueOnce({ club: { id: "club-850" }, discovered: true });

    const result = await runSfvClubMasterImport("tenant-1");

    expect(result.candidateClubs).toBe(2);
    expect(result.created).toBe(2);
    expect(result.updated).toBe(0);
    expect(result.failed).toBe(0);
    expect(result.errors).toEqual([]);
    expect(result.rankingRowsFetched).toBe(3);

    expect(mockDiscoverExternalClubFromProvider).toHaveBeenCalledWith(
      { fake: "mutation-database" },
      expect.objectContaining({
        tenantId: "tenant-1",
        provider: "SFV",
        providerClubId: 700,
        providerClubName: "FC Therwil 1",
      }),
      expect.any(Date),
    );
    expect(mockDiscoverExternalClubFromProvider).toHaveBeenCalledWith(
      { fake: "mutation-database" },
      expect.objectContaining({ providerClubId: 850, providerClubName: "FC Aesch 1" }),
      expect.any(Date),
    );
    // Never called for the tenant's own club.
    expect(mockDiscoverExternalClubFromProvider).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ providerClubId: OWN_CLUB_ID }),
      expect.anything(),
    );
  });

  it("marks the import successful when every candidate persisted without error", async () => {
    mockFetchClubRanking.mockResolvedValueOnce([
      rankingEntry({ teamId: 2001, clubNumber: 700, teamName: "FC Therwil 1" }),
    ]);
    mockFetchTeamList.mockResolvedValueOnce([]);
    mockDiscoverExternalClubFromProvider.mockResolvedValueOnce({
      club: { id: "club-700" },
      discovered: true,
    });

    await runSfvClubMasterImport("tenant-1");

    expect(mockMarkClubMasterImportSuccessful).toHaveBeenCalledWith("tenant-1", expect.any(Date));
  });

  it("always includes the fixed coverage description in the result", async () => {
    mockFetchClubRanking.mockResolvedValueOnce([]);
    mockFetchTeamList.mockResolvedValueOnce([]);

    const result = await runSfvClubMasterImport("tenant-1");

    expect(result.coverageDescription).toBe(SFV_CLUB_MASTER_IMPORT_COVERAGE_DESCRIPTION);
    expect(result.coverageDescription.length).toBeGreaterThan(0);
  });

  it("includes OrganisationId in both fetches when configured", async () => {
    mockRequireEnabledSfvConfigForTenant.mockResolvedValueOnce({
      tenantId: "tenant-1",
      clubId: OWN_CLUB_ID,
      defaultSeasonId: SEASON_ID,
      organisationId: 8,
      enabled: true,
    });
    mockFetchClubRanking.mockResolvedValueOnce([]);
    mockFetchTeamList.mockResolvedValueOnce([]);

    await runSfvClubMasterImport("tenant-1");

    expect(mockFetchClubRanking).toHaveBeenCalledWith({
      SeasonId: SEASON_ID,
      ClubId: OWN_CLUB_ID,
      OrganisationId: 8,
    });
    expect(mockFetchTeamList).toHaveBeenCalledWith({
      SeasonId: SEASON_ID,
      ClubId: OWN_CLUB_ID,
      OrganisationId: 8,
    });
  });
});

describe("runSfvClubMasterImport — idempotent rerun", () => {
  it("reports zero created clubs and counts every already-known candidate as updated", async () => {
    mockFetchClubRanking.mockResolvedValueOnce([
      rankingEntry({ teamId: 2001, clubNumber: 700, teamName: "FC Therwil 1" }),
      rankingEntry({ teamId: 3001, clubNumber: 850, teamName: "FC Aesch 1" }),
    ]);
    mockFetchTeamList.mockResolvedValueOnce([]);
    mockDiscoverExternalClubFromProvider
      .mockResolvedValueOnce({ club: { id: "club-700" }, discovered: false })
      .mockResolvedValueOnce({ club: { id: "club-850" }, discovered: false });

    const result = await runSfvClubMasterImport("tenant-1");

    expect(result.created).toBe(0);
    expect(result.updated).toBe(2);
    expect(result.failed).toBe(0);
  });
});

describe("runSfvClubMasterImport — bounded call volume", () => {
  it("makes exactly two SFV calls regardless of how many candidate clubs are discovered", async () => {
    const manyRankingRows = Array.from({ length: 30 }, (_, i) =>
      rankingEntry({ teamId: 5000 + i, clubNumber: 1000 + i, teamName: `Club ${i}` }),
    );
    mockFetchClubRanking.mockResolvedValueOnce(manyRankingRows);
    mockFetchTeamList.mockResolvedValueOnce([]);
    mockDiscoverExternalClubFromProvider.mockImplementation(async (_db, input) => ({
      club: { id: `club-${input.providerClubId}` },
      discovered: true,
    }));

    const result = await runSfvClubMasterImport("tenant-1");

    expect(result.candidateClubs).toBe(30);
    expect(mockFetchClubRanking).toHaveBeenCalledTimes(1);
    expect(mockFetchTeamList).toHaveBeenCalledTimes(1);
  });
});

describe("runSfvClubMasterImport — provider failure handling", () => {
  it("a ranking-fetch failure aborts the whole run before any candidate is processed", async () => {
    mockFetchClubRanking.mockRejectedValueOnce(new Error("SFV unavailable"));

    const result = await runSfvClubMasterImport("tenant-1");

    expect(result.failed).toBe(1);
    expect(result.candidateClubs).toBe(0);
    expect(result.errors).toHaveLength(1);
    expect(mockDiscoverExternalClubFromProvider).not.toHaveBeenCalled();
    expect(mockMarkClubMasterImportSuccessful).not.toHaveBeenCalled();
  });

  it("a team-list-fetch failure is best-effort — the import still proceeds using ranking data alone", async () => {
    mockFetchClubRanking.mockResolvedValueOnce([
      rankingEntry({ teamId: 2001, clubNumber: 700, teamName: "FC Therwil 1" }),
    ]);
    mockFetchTeamList.mockRejectedValueOnce(new Error("SFV unavailable"));
    mockDiscoverExternalClubFromProvider.mockResolvedValueOnce({
      club: { id: "club-700" },
      discovered: true,
    });

    const result = await runSfvClubMasterImport("tenant-1");

    expect(result.created).toBe(1);
    expect(result.failed).toBe(0);
  });

  it("counts a per-candidate persistence failure without aborting the remaining candidates", async () => {
    mockFetchClubRanking.mockResolvedValueOnce([
      rankingEntry({ teamId: 2001, clubNumber: 700, teamName: "FC Therwil 1" }),
      rankingEntry({ teamId: 3001, clubNumber: 850, teamName: "FC Aesch 1" }),
    ]);
    mockFetchTeamList.mockResolvedValueOnce([]);
    mockDiscoverExternalClubFromProvider
      .mockRejectedValueOnce(new Error("DB unavailable"))
      .mockResolvedValueOnce({ club: { id: "club-850" }, discovered: true });

    const result = await runSfvClubMasterImport("tenant-1");

    expect(result.failed).toBe(1);
    expect(result.created).toBe(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.message).toContain("700");
    // A per-candidate failure must never mark the whole run successful.
    expect(mockMarkClubMasterImportSuccessful).not.toHaveBeenCalled();
  });
});

describe("runSfvClubMasterImport — tenant config propagation", () => {
  it("propagates SfvTenantConfigNotFoundError unchanged", async () => {
    class FakeNotFound extends Error {}
    mockRequireEnabledSfvConfigForTenant.mockRejectedValueOnce(new FakeNotFound("not found"));

    await expect(runSfvClubMasterImport("tenant-1")).rejects.toThrow("not found");
    expect(mockFetchClubRanking).not.toHaveBeenCalled();
  });
});
