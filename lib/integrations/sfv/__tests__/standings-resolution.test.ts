/**
 * lib/integrations/sfv/__tests__/standings-resolution.test.ts
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  resolveStandingsForMapping,
  resolveStandingsForTeamSeason,
} from "../standings-resolution";

const mocks = vi.hoisted(() => ({
  fetchTeamStandingsForMapping: vi.fn(),
  loadEffectiveTeamStandingsMapping: vi.fn(),
}));

vi.mock("../standings-provider", () => ({
  fetchTeamStandingsForMapping: mocks.fetchTeamStandingsForMapping,
}));

vi.mock("@/lib/teams/team-standings-mapping", () => ({
  loadEffectiveTeamStandingsMapping: mocks.loadEffectiveTeamStandingsMapping,
}));

function createStandingsTable() {
  return {
    competition: {
      name: "Junioren E",
      divisionName: null,
      groupName: null,
    },
    rows: [
      {
        position: 1,
        externalTeamId: 100,
        teamName: "FC Example",
        shortName: null,
        played: 1,
        won: 1,
        drawn: 0,
        lost: 0,
        goalsFor: 2,
        goalsAgainst: 0,
        points: 3,
        penaltyPoints: 0,
      },
    ],
  };
}

describe("standings-resolution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resolveStandingsForMapping delegates to fetchTeamStandingsForMapping", async () => {
    const table = createStandingsTable();
    mocks.fetchTeamStandingsForMapping.mockResolvedValue(table);

    const result = await resolveStandingsForMapping({
      tenantId: "tenant-a",
      teamSeasonId: "team-season-1",
      externalTeamId: 100,
      externalSeasonId: 2027,
      providerLeagueId: 10,
    });

    expect(result).toEqual(table);
    expect(mocks.fetchTeamStandingsForMapping).toHaveBeenCalledWith({
      tenantId: "tenant-a",
      teamSeasonId: "team-season-1",
      externalTeamId: 100,
      externalSeasonId: 2027,
      providerLeagueId: 10,
    });
  });

  it("resolveStandingsForTeamSeason loads mapping and uses the same provider path", async () => {
    const table = createStandingsTable();
    mocks.loadEffectiveTeamStandingsMapping.mockResolvedValue({
      externalTeamId: 100,
      externalSeasonId: 2027,
      providerLeagueId: 10,
      providerLeagueName: "League",
      providerTeamName: "FC Example",
      lastSyncedAt: new Date(),
    });
    mocks.fetchTeamStandingsForMapping.mockResolvedValue(table);

    const result = await resolveStandingsForTeamSeason({
      tenantId: "tenant-a",
      teamSeasonId: "team-season-1",
      seasonKey: "2026-2027",
    });

    expect(result).toEqual({
      standings: table,
      externalTeamId: 100,
    });
    expect(mocks.loadEffectiveTeamStandingsMapping).toHaveBeenCalledWith({
      tenantId: "tenant-a",
      teamSeasonId: "team-season-1",
      seasonKey: "2026-2027",
    });
    expect(mocks.fetchTeamStandingsForMapping).toHaveBeenCalledWith({
      tenantId: "tenant-a",
      externalTeamId: 100,
      externalSeasonId: 2027,
      providerLeagueId: 10,
      teamSeasonId: "team-season-1",
    });
  });

  it("resolveStandingsForTeamSeason returns null when mapping is missing", async () => {
    mocks.loadEffectiveTeamStandingsMapping.mockResolvedValue(null);

    const result = await resolveStandingsForTeamSeason({
      tenantId: "tenant-a",
      teamSeasonId: "team-season-1",
      seasonKey: "2026-2027",
    });

    expect(result).toBeNull();
    expect(mocks.fetchTeamStandingsForMapping).not.toHaveBeenCalled();
  });
});
