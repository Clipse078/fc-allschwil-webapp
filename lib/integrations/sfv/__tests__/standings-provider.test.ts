import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ClubRankingEntry } from "../client";
import { resetStandingsCacheForTests } from "../standings-cache";
import { fetchTeamStandingsForMapping } from "../standings-provider";

const mocks = vi.hoisted(() => ({
  fetchClubRanking: vi.fn(),
  isSfvEnabledForTenant: vi.fn(),
  requireEnabledSfvConfigForTenant: vi.fn(),
}));

vi.mock("../client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../client")>();
  return {
    ...actual,
    fetchClubRanking: mocks.fetchClubRanking,
  };
});

vi.mock("../tenant-config-service", () => ({
  isSfvEnabledForTenant: mocks.isSfvEnabledForTenant,
  requireEnabledSfvConfigForTenant: mocks.requireEnabledSfvConfigForTenant,
}));

function createEntry(
  overrides: Partial<ClubRankingEntry> & Pick<ClubRankingEntry, "teamId" | "position">,
): ClubRankingEntry {
  return {
    leagueId: 10,
    leagueNumber: 1,
    leagueName: "League",
    divisionId: 20,
    divisionName: null,
    groupId: 30,
    groupName: null,
    teamName: `Team ${overrides.teamId}`,
    clubNumber: 100,
    matches: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    penaltyPoints: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    points: 0,
    ...overrides,
  };
}

describe("fetchTeamStandingsForMapping", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStandingsCacheForTests();
    mocks.isSfvEnabledForTenant.mockResolvedValue(true);
    mocks.requireEnabledSfvConfigForTenant.mockResolvedValue({
      tenantId: "tenant-a",
      clubId: 123,
      defaultSeasonId: 2027,
      organisationId: null,
      enabled: true,
    });
    mocks.fetchClubRanking.mockResolvedValue([
      createEntry({ teamId: 100, position: 1 }),
      createEntry({ teamId: 200, position: 2 }),
    ]);
  });

  it("fetches on first request and reuses cache on second request", async () => {
    const input = {
      tenantId: "tenant-a",
      externalTeamId: 100,
      externalSeasonId: 2027,
    };

    await fetchTeamStandingsForMapping(input);
    await fetchTeamStandingsForMapping(input);

    expect(mocks.fetchClubRanking).toHaveBeenCalledTimes(1);
    expect(mocks.fetchClubRanking).toHaveBeenCalledWith({
      SeasonId: 2027,
      ClubId: 123,
    });
  });

  it("returns null when SFV is disabled", async () => {
    mocks.isSfvEnabledForTenant.mockResolvedValue(false);

    const result = await fetchTeamStandingsForMapping({
      tenantId: "tenant-a",
      externalTeamId: 100,
      externalSeasonId: 2027,
    });

    expect(result).toBeNull();
    expect(mocks.fetchClubRanking).not.toHaveBeenCalled();
  });

  it("returns null when provider fetch fails", async () => {
    mocks.fetchClubRanking.mockRejectedValue(new Error("provider down"));

    const result = await fetchTeamStandingsForMapping({
      tenantId: "tenant-a",
      externalTeamId: 100,
      externalSeasonId: 2027,
    });

    expect(result).toBeNull();
  });
});
