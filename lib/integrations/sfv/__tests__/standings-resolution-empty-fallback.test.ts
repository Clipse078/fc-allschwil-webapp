/**
 * lib/integrations/sfv/__tests__/standings-resolution-empty-fallback.test.ts
 *
 * Integration coverage for empty/unusable provider results falling back to the
 * durable snapshot through the canonical resolution entry points used by
 * Team Cockpit and the public API.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ClubRankingEntry } from "../client";
import { resetStandingsCacheForTests } from "../standings-cache";
import {
  resetStandingsInflightForTests,
} from "../standings-provider";
import {
  resolveStandingsForMapping,
  resolveStandingsForTeamSeason,
} from "../standings-resolution";

const mocks = vi.hoisted(() => ({
  fetchClubRanking: vi.fn(),
  isSfvEnabledForTenant: vi.fn(),
  requireEnabledSfvConfigForTenant: vi.fn(),
  loadStandingsSnapshot: vi.fn(),
  persistStandingsSnapshot: vi.fn(),
  loadEffectiveTeamStandingsMapping: vi.fn(),
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

vi.mock("@/lib/teams/team-standings-mapping", () => ({
  loadEffectiveTeamStandingsMapping: mocks.loadEffectiveTeamStandingsMapping,
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
    ],
  };
}

const mappingInput = {
  tenantId: "tenant-a",
  externalTeamId: 100,
  externalSeasonId: 2027,
  providerLeagueId: 10,
  teamSeasonId: "team-season-1",
};

describe("standings-resolution empty/unusable snapshot fallback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStandingsCacheForTests();
    resetStandingsInflightForTests();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    mocks.isSfvEnabledForTenant.mockResolvedValue(true);
    mocks.requireEnabledSfvConfigForTenant.mockResolvedValue({
      tenantId: "tenant-a",
      clubId: 123,
      defaultSeasonId: 2027,
      organisationId: null,
      enabled: true,
    });
    mocks.fetchClubRanking.mockResolvedValue([
      createEntry({ teamId: 200, position: 1 }),
    ]);
    mocks.loadStandingsSnapshot.mockResolvedValue({
      standingsTable: createSnapshotTable(),
      fetchedAt: new Date("2026-08-20T10:00:00.000Z"),
      sfvLeagueId: 10,
      sfvDivisionId: 20,
      sfvGroupId: 30,
    });
    mocks.persistStandingsSnapshot.mockResolvedValue(undefined);
    mocks.loadEffectiveTeamStandingsMapping.mockResolvedValue({
      externalTeamId: 100,
      externalSeasonId: 2027,
      providerLeagueId: 10,
      providerLeagueName: "League",
      providerTeamName: "FC Example",
      lastSyncedAt: new Date(),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("resolveStandingsForMapping returns snapshot when provider resolution is empty", async () => {
    const result = await resolveStandingsForMapping({
      ...mappingInput,
      externalTeamId: 999,
    });

    expect(result).toEqual(createSnapshotTable());
    expect(mocks.persistStandingsSnapshot).not.toHaveBeenCalled();
  });

  it("resolveStandingsForTeamSeason returns snapshot when provider resolution is empty", async () => {
    mocks.loadEffectiveTeamStandingsMapping.mockResolvedValue({
      externalTeamId: 999,
      externalSeasonId: 2027,
      providerLeagueId: 10,
      providerLeagueName: "League",
      providerTeamName: "FC Example",
      lastSyncedAt: new Date(),
    });

    const result = await resolveStandingsForTeamSeason({
      tenantId: "tenant-a",
      teamSeasonId: "team-season-1",
      seasonKey: "2026-2027",
    });

    expect(result).toEqual({
      standings: createSnapshotTable(),
      externalTeamId: 999,
    });
    expect(mocks.persistStandingsSnapshot).not.toHaveBeenCalled();
  });
});
