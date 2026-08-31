import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ClubRankingEntry } from "../client";
import { SfvAuthError } from "../errors";
import { resetStandingsCacheForTests } from "../standings-cache";
import {
  fetchTeamStandingsForMapping,
  resetStandingsInflightForTests,
} from "../standings-provider";

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

const defaultEntries = [
  createEntry({
    teamId: 100,
    position: 1,
    matches: 6,
    wins: 5,
    draws: 1,
    losses: 0,
    goalsFor: 12,
    goalsAgainst: 3,
    points: 16,
  }),
  createEntry({ teamId: 200, position: 2 }),
];

describe("fetchTeamStandingsForMapping", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStandingsCacheForTests();
    resetStandingsInflightForTests();
    mocks.isSfvEnabledForTenant.mockResolvedValue(true);
    mocks.requireEnabledSfvConfigForTenant.mockResolvedValue({
      tenantId: "tenant-a",
      clubId: 123,
      defaultSeasonId: 2027,
      organisationId: null,
      enabled: true,
    });
    mocks.fetchClubRanking.mockResolvedValue(defaultEntries);
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

  describe("inflight deduplication", () => {
    it("issues exactly one provider request for 10 concurrent cache-miss callers", async () => {
      let resolveFetch: (entries: ClubRankingEntry[]) => void = () => {};
      const fetchGate = new Promise<ClubRankingEntry[]>((resolve) => {
        resolveFetch = resolve;
      });
      mocks.fetchClubRanking.mockReturnValue(fetchGate);

      const input = {
        tenantId: "tenant-a",
        externalTeamId: 100,
        externalSeasonId: 2027,
      };

      const pending = Array.from({ length: 10 }, () => fetchTeamStandingsForMapping(input));
      await vi.waitFor(() => {
        expect(mocks.fetchClubRanking).toHaveBeenCalledTimes(1);
      });

      resolveFetch(defaultEntries);
      const results = await Promise.all(pending);

      expect(mocks.fetchClubRanking).toHaveBeenCalledTimes(1);
      for (const result of results) {
        expect(result).not.toBeNull();
        expect(result!.rows).toHaveLength(2);
        expect(result!.rows[0]?.externalTeamId).toBe(100);
      }
    });

    it("fans out the same successful ranking dataset to all concurrent callers", async () => {
      const input = {
        tenantId: "tenant-a",
        externalTeamId: 100,
        externalSeasonId: 2027,
      };

      const results = await Promise.all(
        Array.from({ length: 5 }, () => fetchTeamStandingsForMapping(input)),
      );

      expect(mocks.fetchClubRanking).toHaveBeenCalledTimes(1);
      const first = results[0];
      for (const result of results) {
        expect(result).toEqual(first);
      }
    });

    it("clears inflight after failure so a later request can succeed", async () => {
      mocks.fetchClubRanking.mockRejectedValueOnce(new Error("transient failure"));
      mocks.fetchClubRanking.mockResolvedValueOnce(defaultEntries);

      const input = {
        tenantId: "tenant-a",
        externalTeamId: 100,
        externalSeasonId: 2027,
      };

      const first = await fetchTeamStandingsForMapping(input);
      const second = await fetchTeamStandingsForMapping(input);

      expect(first).toBeNull();
      expect(second).not.toBeNull();
      expect(mocks.fetchClubRanking).toHaveBeenCalledTimes(2);
    });

    it("does not share inflight promises across tenants", async () => {
      let resolveTenantA: (entries: ClubRankingEntry[]) => void = () => {};
      let resolveTenantB: (entries: ClubRankingEntry[]) => void = () => {};
      const gateA = new Promise<ClubRankingEntry[]>((resolve) => {
        resolveTenantA = resolve;
      });
      const gateB = new Promise<ClubRankingEntry[]>((resolve) => {
        resolveTenantB = resolve;
      });

      mocks.requireEnabledSfvConfigForTenant.mockImplementation(async (tenantId: string) => ({
        tenantId,
        clubId: tenantId === "tenant-a" ? 123 : 456,
        defaultSeasonId: 2027,
        organisationId: null,
        enabled: true,
      }));
      mocks.fetchClubRanking.mockImplementation(async (params: { ClubId: number }) => {
        if (params.ClubId === 123) return gateA;
        return gateB;
      });

      const pendingA = fetchTeamStandingsForMapping({
        tenantId: "tenant-a",
        externalTeamId: 100,
        externalSeasonId: 2027,
      });
      const pendingB = fetchTeamStandingsForMapping({
        tenantId: "tenant-b",
        externalTeamId: 300,
        externalSeasonId: 2027,
      });

      await vi.waitFor(() => {
        expect(mocks.fetchClubRanking).toHaveBeenCalledTimes(2);
      });

      resolveTenantA(defaultEntries);
      resolveTenantB([createEntry({ teamId: 300, position: 1 })]);

      const [resultA, resultB] = await Promise.all([pendingA, pendingB]);

      expect(resultA?.rows[0]?.externalTeamId).toBe(100);
      expect(resultB?.rows[0]?.externalTeamId).toBe(300);
    });

    it("does not share inflight promises across seasons", async () => {
      let resolve2026: (entries: ClubRankingEntry[]) => void = () => {};
      let resolve2027: (entries: ClubRankingEntry[]) => void = () => {};
      const gate2026 = new Promise<ClubRankingEntry[]>((resolve) => {
        resolve2026 = resolve;
      });
      const gate2027 = new Promise<ClubRankingEntry[]>((resolve) => {
        resolve2027 = resolve;
      });

      mocks.fetchClubRanking.mockImplementation(async (params: { SeasonId: number }) => {
        if (params.SeasonId === 2026) return gate2026;
        return gate2027;
      });

      const pending2026 = fetchTeamStandingsForMapping({
        tenantId: "tenant-a",
        externalTeamId: 100,
        externalSeasonId: 2026,
      });
      const pending2027 = fetchTeamStandingsForMapping({
        tenantId: "tenant-a",
        externalTeamId: 100,
        externalSeasonId: 2027,
      });

      await vi.waitFor(() => {
        expect(mocks.fetchClubRanking).toHaveBeenCalledTimes(2);
      });

      resolve2026([createEntry({ teamId: 100, position: 3 })]);
      resolve2027(defaultEntries);

      const [result2026, result2027] = await Promise.all([pending2026, pending2027]);

      expect(result2026?.rows[0]?.position).toBe(3);
      expect(result2027?.rows[0]?.position).toBe(1);
    });
  });

  describe("cache preservation", () => {
    it("serves cached rankings inside TTL without a new provider call", async () => {
      const input = {
        tenantId: "tenant-a",
        externalTeamId: 100,
        externalSeasonId: 2027,
      };

      await fetchTeamStandingsForMapping(input);
      resetStandingsInflightForTests();
      await fetchTeamStandingsForMapping(input);

      expect(mocks.fetchClubRanking).toHaveBeenCalledTimes(1);
    });
  });

  describe("presentation and mapping", () => {
    it("preserves W/D/L, goals, goal difference and points in resolved standings", async () => {
      const result = await fetchTeamStandingsForMapping({
        tenantId: "tenant-a",
        externalTeamId: 100,
        externalSeasonId: 2027,
      });

      expect(result).not.toBeNull();
      const row = result!.rows.find((entry) => entry.externalTeamId === 100);
      expect(row).toMatchObject({
        position: 1,
        played: 6,
        won: 5,
        drawn: 1,
        lost: 0,
        goalsFor: 12,
        goalsAgainst: 3,
        points: 16,
      });
    });
  });
});
