import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ClubRankingEntry } from "../client";
import { SfvAuthError, SfvNetworkError } from "../errors";
import { resetStandingsCacheForTests } from "../standings-cache";
import {
  fetchTeamStandingsForMapping,
  resetStandingsInflightForTests,
} from "../standings-provider";

const mocks = vi.hoisted(() => ({
  fetchClubRanking: vi.fn(),
  isSfvEnabledForTenant: vi.fn(),
  requireEnabledSfvConfigForTenant: vi.fn(),
  loadStandingsSnapshot: vi.fn(),
  persistStandingsSnapshot: vi.fn(),
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

vi.mock("../standings-snapshot-repository", () => ({
  loadStandingsSnapshot: mocks.loadStandingsSnapshot,
  persistStandingsSnapshot: mocks.persistStandingsSnapshot,
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

function createSnapshotTable() {
  return {
    competition: {
      name: "League",
      divisionName: null,
      groupName: null,
    },
    rows: [
      {
        position: 1,
        externalTeamId: 100,
        teamName: "Team 100",
        shortName: null,
        played: 6,
        won: 5,
        drawn: 1,
        lost: 0,
        goalsFor: 12,
        goalsAgainst: 3,
        points: 16,
        penaltyPoints: 0,
      },
      {
        position: 2,
        externalTeamId: 200,
        teamName: "Team 200",
        shortName: null,
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        points: 0,
        penaltyPoints: 0,
      },
    ],
  };
}

const mappingInput = {
  tenantId: "tenant-a",
  externalTeamId: 100,
  externalSeasonId: 2027,
  providerLeagueId: 10,
};

describe("fetchTeamStandingsForMapping", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStandingsCacheForTests();
    resetStandingsInflightForTests();
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    mocks.isSfvEnabledForTenant.mockResolvedValue(true);
    mocks.requireEnabledSfvConfigForTenant.mockResolvedValue({
      tenantId: "tenant-a",
      clubId: 123,
      defaultSeasonId: 2027,
      organisationId: null,
      enabled: true,
    });
    mocks.fetchClubRanking.mockResolvedValue(defaultEntries);
    mocks.loadStandingsSnapshot.mockResolvedValue(null);
    mocks.persistStandingsSnapshot.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
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

  it("returns null and logs a safe auth diagnostic for SfvAuthError", async () => {
    const token = "sensitive-token-value";
    mocks.fetchClubRanking.mockRejectedValue(
      new SfvAuthError("SFV_UNAUTHORIZED", "SFV ranking request rejected: 401 Unauthorized."),
    );

    const result = await fetchTeamStandingsForMapping({
      tenantId: "tenant-a",
      externalTeamId: 100,
      externalSeasonId: 2027,
      providerLeagueId: 10,
    });

    expect(result).toBeNull();
    expect(console.error).toHaveBeenCalledTimes(1);

    const serializedDiagnostic = String(vi.mocked(console.error).mock.calls[0]?.[0]);
    expect(serializedDiagnostic).toContain("SFV_STANDINGS_PROVIDER_FAILURE");
    expect(serializedDiagnostic).toContain("SFV_UNAUTHORIZED");
    expect(serializedDiagnostic).toContain("SFV_AUTH");
    expect(serializedDiagnostic).not.toContain(token);
  });

  it.each([
    ["SFV_TIMEOUT", "SFV_TIMEOUT"],
    ["SFV_UNAVAILABLE", "SFV_UNAVAILABLE"],
  ] as const)(
    "returns null and classifies %s network errors as %s",
    async (errorCode, expectedCategory) => {
      mocks.fetchClubRanking.mockRejectedValue(
        new SfvNetworkError(errorCode, "Safe provider failure."),
      );

      const result = await fetchTeamStandingsForMapping({
        tenantId: "tenant-a",
        externalTeamId: 100,
        externalSeasonId: 2027,
      });

      expect(result).toBeNull();
      const diagnostic = JSON.parse(
        String(vi.mocked(console.error).mock.calls[0]?.[0]),
      ) as Record<string, unknown>;
      expect(diagnostic).toMatchObject({
        event: "SFV_STANDINGS_PROVIDER_FAILURE",
        errorCode,
        failureCategory: expectedCategory,
      });
    },
  );

  it("returns null and classifies unknown errors without logging their message", async () => {
    const unsafeMessage = "provider down with sensitive-token-value";
    mocks.fetchClubRanking.mockRejectedValue(new Error(unsafeMessage));

    const result = await fetchTeamStandingsForMapping({
      tenantId: "tenant-a",
      externalTeamId: 100,
      externalSeasonId: 2027,
    });

    expect(result).toBeNull();
    const serializedDiagnostic = String(vi.mocked(console.error).mock.calls[0]?.[0]);
    const diagnostic = JSON.parse(serializedDiagnostic) as Record<string, unknown>;
    expect(diagnostic).toMatchObject({
      event: "SFV_STANDINGS_PROVIDER_FAILURE",
      errorName: "Error",
      errorCode: "INTERNAL_ERROR",
      failureCategory: "UNKNOWN",
    });
    expect(serializedDiagnostic).not.toContain(unsafeMessage);
    expect(serializedDiagnostic).not.toContain("sensitive-token-value");
  });

  it("logs a separate diagnostic when fetched rankings cannot be resolved", async () => {
    const result = await fetchTeamStandingsForMapping({
      tenantId: "tenant-a",
      externalTeamId: 999,
      externalSeasonId: 2027,
      providerLeagueId: 10,
    });

    expect(result).toBeNull();
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(vi.mocked(console.warn).mock.calls[0]?.[0]))).toMatchObject({
      event: "SFV_STANDINGS_RESOLUTION_EMPTY",
      tenantId: "tenant-a",
      externalTeamId: 999,
      externalSeasonId: 2027,
      providerLeagueId: 10,
      rankingEntryCount: 2,
      externalTeamIdPresent: false,
    });
    expect(mocks.loadStandingsSnapshot).toHaveBeenCalledTimes(1);
  });

  it("returns resolved standings without emitting diagnostics", async () => {
    const result = await fetchTeamStandingsForMapping({
      tenantId: "tenant-a",
      externalTeamId: 100,
      externalSeasonId: 2027,
      providerLeagueId: 10,
    });

    expect(result).not.toBeNull();
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
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

  describe("durable snapshot", () => {
    it("persists a snapshot on successful provider fetch", async () => {
      const result = await fetchTeamStandingsForMapping(mappingInput);

      expect(result).not.toBeNull();
      expect(mocks.persistStandingsSnapshot).toHaveBeenCalledTimes(1);
      expect(mocks.persistStandingsSnapshot).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: "tenant-a",
          externalSeasonId: 2027,
          externalTeamId: 100,
          providerLeagueId: 10,
          sfvLeagueId: 10,
          sfvDivisionId: 20,
          sfvGroupId: 30,
          standingsTable: createSnapshotTable(),
        }),
      );
    });

    it("returns snapshot on auth failure when a durable snapshot exists", async () => {
      const fetchedAt = new Date("2026-08-20T10:00:00.000Z");
      const snapshotTable = createSnapshotTable();
      mocks.fetchClubRanking.mockRejectedValue(
        new SfvAuthError("SFV_UNAUTHORIZED", "SFV ranking request rejected: 401 Unauthorized."),
      );
      mocks.loadStandingsSnapshot.mockResolvedValue({
        standingsTable: snapshotTable,
        fetchedAt,
        sfvLeagueId: 10,
        sfvDivisionId: 20,
        sfvGroupId: 30,
      });

      const result = await fetchTeamStandingsForMapping({
        ...mappingInput,
        teamSeasonId: "team-season-1",
      });

      expect(result).toEqual(snapshotTable);
      expect(console.warn).toHaveBeenCalledTimes(1);
      expect(JSON.parse(String(vi.mocked(console.warn).mock.calls[0]?.[0]))).toMatchObject({
        event: "SFV_STANDINGS_SNAPSHOT_FALLBACK",
        tenantId: "tenant-a",
        teamSeasonId: "team-season-1",
        snapshotFetchedAt: fetchedAt.toISOString(),
        errorCode: "SFV_UNAUTHORIZED",
        failureCategory: "SFV_AUTH",
      });
    });

    it.each([
      ["SFV_TIMEOUT", "SFV_TIMEOUT"],
      ["SFV_UNAVAILABLE", "SFV_UNAVAILABLE"],
    ] as const)(
      "returns snapshot on %s when a durable snapshot exists",
      async (errorCode, expectedCategory) => {
        const snapshotTable = createSnapshotTable();
        mocks.fetchClubRanking.mockRejectedValue(
          new SfvNetworkError(errorCode, "Safe provider failure."),
        );
        mocks.loadStandingsSnapshot.mockResolvedValue({
          standingsTable: snapshotTable,
          fetchedAt: new Date("2026-08-20T10:00:00.000Z"),
          sfvLeagueId: 10,
          sfvDivisionId: 20,
          sfvGroupId: 30,
        });

        const result = await fetchTeamStandingsForMapping(mappingInput);

        expect(result).toEqual(snapshotTable);
        const diagnostic = JSON.parse(
          String(vi.mocked(console.warn).mock.calls[0]?.[0]),
        ) as Record<string, unknown>;
        expect(diagnostic).toMatchObject({
          event: "SFV_STANDINGS_SNAPSHOT_FALLBACK",
          failureCategory: expectedCategory,
        });
      },
    );

    it("returns null on provider failure when no snapshot exists", async () => {
      mocks.fetchClubRanking.mockRejectedValue(
        new SfvAuthError("SFV_UNAUTHORIZED", "SFV ranking request rejected: 401 Unauthorized."),
      );

      const result = await fetchTeamStandingsForMapping(mappingInput);

      expect(result).toBeNull();
      expect(mocks.loadStandingsSnapshot).toHaveBeenCalledTimes(1);
      expect(console.warn).not.toHaveBeenCalled();
    });

    it("does not overwrite snapshot when provider resolution is empty", async () => {
      const result = await fetchTeamStandingsForMapping({
        tenantId: "tenant-a",
        externalTeamId: 999,
        externalSeasonId: 2027,
        providerLeagueId: 10,
      });

      expect(result).toBeNull();
      expect(mocks.persistStandingsSnapshot).not.toHaveBeenCalled();
      expect(mocks.loadStandingsSnapshot).toHaveBeenCalledTimes(1);
    });

    it("returns snapshot when provider resolution is empty and a durable snapshot exists", async () => {
      const fetchedAt = new Date("2026-08-20T10:00:00.000Z");
      const snapshotTable = createSnapshotTable();
      mocks.loadStandingsSnapshot.mockResolvedValue({
        standingsTable: snapshotTable,
        fetchedAt,
        sfvLeagueId: 10,
        sfvDivisionId: 20,
        sfvGroupId: 30,
      });

      const result = await fetchTeamStandingsForMapping({
        tenantId: "tenant-a",
        externalTeamId: 999,
        externalSeasonId: 2027,
        providerLeagueId: 10,
        teamSeasonId: "team-season-1",
      });

      expect(result).toEqual(snapshotTable);
      expect(mocks.persistStandingsSnapshot).not.toHaveBeenCalled();
      expect(console.warn).toHaveBeenCalledTimes(2);
      expect(JSON.parse(String(vi.mocked(console.warn).mock.calls[0]?.[0]))).toMatchObject({
        event: "SFV_STANDINGS_RESOLUTION_EMPTY",
      });
      expect(JSON.parse(String(vi.mocked(console.warn).mock.calls[1]?.[0]))).toMatchObject({
        event: "SFV_STANDINGS_SNAPSHOT_FALLBACK",
        tenantId: "tenant-a",
        teamSeasonId: "team-season-1",
        snapshotFetchedAt: fetchedAt.toISOString(),
        errorCode: "SFV_STANDINGS_RESOLUTION_EMPTY",
        failureCategory: "SFV_EMPTY_OR_UNUSABLE",
      });
    });

    it("returns snapshot when provider returns an unusable table and a durable snapshot exists", async () => {
      const snapshotTable = createSnapshotTable();
      mocks.fetchClubRanking.mockResolvedValue([
        createEntry({ teamId: 100, position: 1 }),
      ]);
      mocks.loadStandingsSnapshot.mockResolvedValue({
        standingsTable: snapshotTable,
        fetchedAt: new Date("2026-08-20T10:00:00.000Z"),
        sfvLeagueId: 10,
        sfvDivisionId: 20,
        sfvGroupId: 30,
      });

      const result = await fetchTeamStandingsForMapping({
        tenantId: "tenant-a",
        externalTeamId: 999,
        externalSeasonId: 2027,
        providerLeagueId: 10,
      });

      expect(result).toEqual(snapshotTable);
      expect(mocks.persistStandingsSnapshot).not.toHaveBeenCalled();
      const fallbackDiagnostic = JSON.parse(
        String(vi.mocked(console.warn).mock.calls.at(-1)?.[0]),
      ) as Record<string, unknown>;
      expect(fallbackDiagnostic).toMatchObject({
        event: "SFV_STANDINGS_SNAPSHOT_FALLBACK",
        failureCategory: "SFV_EMPTY_OR_UNUSABLE",
      });
    });

    it("isolates snapshots by tenant", async () => {
      mocks.fetchClubRanking.mockRejectedValue(
        new SfvAuthError("SFV_UNAUTHORIZED", "SFV ranking request rejected: 401 Unauthorized."),
      );
      mocks.loadStandingsSnapshot.mockImplementation(async (identity) => {
        if (identity.tenantId === "tenant-a") {
          return {
            standingsTable: createSnapshotTable(),
            fetchedAt: new Date("2026-08-20T10:00:00.000Z"),
            sfvLeagueId: 10,
            sfvDivisionId: 20,
            sfvGroupId: 30,
          };
        }
        return null;
      });

      const tenantA = await fetchTeamStandingsForMapping(mappingInput);
      const tenantB = await fetchTeamStandingsForMapping({
        ...mappingInput,
        tenantId: "tenant-b",
      });

      expect(tenantA).not.toBeNull();
      expect(tenantB).toBeNull();
    });

    it("isolates snapshots by season/league identity", async () => {
      mocks.fetchClubRanking.mockRejectedValue(
        new SfvAuthError("SFV_UNAUTHORIZED", "SFV ranking request rejected: 401 Unauthorized."),
      );
      mocks.loadStandingsSnapshot.mockImplementation(async (identity) => {
        if (
          identity.externalSeasonId === 2027 &&
          identity.providerLeagueId === 10
        ) {
          return {
            standingsTable: createSnapshotTable(),
            fetchedAt: new Date("2026-08-20T10:00:00.000Z"),
            sfvLeagueId: 10,
            sfvDivisionId: 20,
            sfvGroupId: 30,
          };
        }
        return null;
      });

      const matching = await fetchTeamStandingsForMapping(mappingInput);
      const otherLeague = await fetchTeamStandingsForMapping({
        ...mappingInput,
        providerLeagueId: 99,
      });

      expect(matching).not.toBeNull();
      expect(otherLeague).toBeNull();
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
