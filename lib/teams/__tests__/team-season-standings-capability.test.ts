import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  loadTeamSeasonHasStandingsForList,
  resolveTeamSeasonHasStandings,
} from "../team-season-standings-capability";

const mocks = vi.hoisted(() => ({
  teamExternalMappingFindMany: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    teamExternalMapping: {
      findMany: mocks.teamExternalMappingFindMany,
    },
  },
}));

const TENANT_ID = "tenant-fca";
const TEAM_SEASON_ID = "team-season-ff14";

describe("resolveTeamSeasonHasStandings", () => {
  it("returns true for a season-aligned mapping with provider league assignment", () => {
    expect(
      resolveTeamSeasonHasStandings(
        {
          provider: "SFV",
          externalTeamId: 100,
          externalSeasonId: 2027,
          providerLeagueId: 42,
          providerLeagueName: "Juniorinnen FF-14",
          teamSeasonId: TEAM_SEASON_ID,
        },
        { teamSeasonId: TEAM_SEASON_ID, seasonKey: "2026-2027" },
      ),
    ).toBe(true);
  });

  it("returns false when provider league assignment is missing", () => {
    expect(
      resolveTeamSeasonHasStandings(
        {
          provider: "SFV",
          externalTeamId: 100,
          externalSeasonId: 2027,
          providerLeagueId: null,
          providerLeagueName: null,
          teamSeasonId: TEAM_SEASON_ID,
        },
        { teamSeasonId: TEAM_SEASON_ID, seasonKey: "2026-2027" },
      ),
    ).toBe(false);
  });

  it("returns false on season mismatch", () => {
    expect(
      resolveTeamSeasonHasStandings(
        {
          provider: "SFV",
          externalTeamId: 100,
          externalSeasonId: 2026,
          providerLeagueId: 42,
          providerLeagueName: "Juniorinnen FF-14",
          teamSeasonId: TEAM_SEASON_ID,
        },
        { teamSeasonId: TEAM_SEASON_ID, seasonKey: "2026-2027" },
      ),
    ).toBe(false);
  });

  it("returns false when mapping belongs to another TeamSeason", () => {
    expect(
      resolveTeamSeasonHasStandings(
        {
          provider: "SFV",
          externalTeamId: 100,
          externalSeasonId: 2027,
          providerLeagueId: 42,
          providerLeagueName: "Juniorinnen FF-14",
          teamSeasonId: "other-team-season",
        },
        { teamSeasonId: TEAM_SEASON_ID, seasonKey: "2026-2027" },
      ),
    ).toBe(false);
  });
});

describe("loadTeamSeasonHasStandingsForList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("batch-resolves standings capability without live standings fetches", async () => {
    mocks.teamExternalMappingFindMany.mockResolvedValue([
      {
        externalTeamId: 100,
        externalSeasonId: 2027,
        providerLeagueId: 42,
        providerLeagueName: "Juniorinnen FF-14",
        providerTeamName: "FC Allschwil Juniorinnen FF-14",
        lastSyncedAt: new Date("2026-08-01T00:00:00.000Z"),
        teamSeasonId: TEAM_SEASON_ID,
        provider: "SFV",
        providerIsActive: true,
      },
      {
        externalTeamId: 200,
        externalSeasonId: 2027,
        providerLeagueId: null,
        providerLeagueName: null,
        providerTeamName: "Kinderfussball F2",
        lastSyncedAt: new Date("2026-08-01T00:00:00.000Z"),
        teamSeasonId: "team-season-kf",
        provider: "SFV",
        providerIsActive: true,
      },
    ]);

    const result = await loadTeamSeasonHasStandingsForList({
      tenantId: TENANT_ID,
      entries: [
        { teamSeasonId: TEAM_SEASON_ID, seasonKey: "2026-2027" },
        { teamSeasonId: "team-season-kf", seasonKey: "2026-2027" },
      ],
    });

    expect(result.get(TEAM_SEASON_ID)).toBe(true);
    expect(result.get("team-season-kf")).toBe(false);
    expect(mocks.teamExternalMappingFindMany).toHaveBeenCalledTimes(1);
  });

  it("keeps standings-capable teams included when provider fetch would fail later", async () => {
    mocks.teamExternalMappingFindMany.mockResolvedValue([
      {
        externalTeamId: 100,
        externalSeasonId: 2027,
        providerLeagueId: 42,
        providerLeagueName: "Juniorinnen FF-14",
        providerTeamName: "FC Allschwil Juniorinnen FF-14",
        lastSyncedAt: new Date("2026-08-01T00:00:00.000Z"),
        teamSeasonId: TEAM_SEASON_ID,
        provider: "SFV",
        providerIsActive: true,
      },
    ]);

    const result = await loadTeamSeasonHasStandingsForList({
      tenantId: TENANT_ID,
      entries: [{ teamSeasonId: TEAM_SEASON_ID, seasonKey: "2026-2027" }],
    });

    expect(result.get(TEAM_SEASON_ID)).toBe(true);
  });
});
