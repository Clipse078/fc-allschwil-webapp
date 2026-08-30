import { beforeEach, describe, expect, it, vi } from "vitest";

import { getPublicTeams } from "../public-teams-feed";

const mocks = vi.hoisted(() => ({
  teamFindMany: vi.fn(),
  teamExternalMappingFindMany: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    team: {
      findMany: mocks.teamFindMany,
    },
    teamExternalMapping: {
      findMany: mocks.teamExternalMappingFindMany,
    },
  },
}));

const TENANT_ID = "tenant-fca";

function makeTeamRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "team-ff14",
    name: "FC Allschwil Juniorinnen FF-14",
    slug: "juniorinnen-ff-14",
    category: "FRAUEN",
    genderGroup: "FEMALE",
    ageGroup: "FF-14",
    sortOrder: 10,
    teamSeasons: [
      {
        id: "team-season-ff14",
        displayName: "FC Allschwil Juniorinnen FF-14 (9v9)",
        shortName: "FF-14",
        season: { key: "2026-2027", name: "Saison 2026/27" },
        orgUnits: [],
      },
    ],
    ...overrides,
  };
}

describe("getPublicTeams — hasStandings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.teamExternalMappingFindMany.mockResolvedValue([]);
  });

  it("exposes hasStandings=true for standings-capable TeamSeasons", async () => {
    mocks.teamFindMany.mockResolvedValue([makeTeamRow()]);
    mocks.teamExternalMappingFindMany.mockResolvedValue([
      {
        externalTeamId: 100,
        externalSeasonId: 2027,
        providerLeagueId: 42,
        providerLeagueName: "Juniorinnen FF-14",
        providerTeamName: "FC Allschwil Juniorinnen FF-14",
        lastSyncedAt: new Date("2026-08-01T00:00:00.000Z"),
        teamSeasonId: "team-season-ff14",
        provider: "SFV",
        providerIsActive: true,
      },
    ]);

    const teams = await getPublicTeams({ tenantId: TENANT_ID });

    expect(teams).toHaveLength(1);
    expect(teams[0]?.hasStandings).toBe(true);
    expect(mocks.teamExternalMappingFindMany).toHaveBeenCalledTimes(1);
  });

  it("exposes hasStandings=false for non-standings TeamSeasons", async () => {
    mocks.teamFindMany.mockResolvedValue([
      makeTeamRow({
        id: "team-kf",
        slug: "kinderfussball-f2",
        teamSeasons: [
          {
            id: "team-season-kf",
            displayName: "Kinderfussball F2",
            shortName: "F2",
            season: { key: "2026-2027", name: "Saison 2026/27" },
            orgUnits: [],
          },
        ],
      }),
    ]);
    mocks.teamExternalMappingFindMany.mockResolvedValue([
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

    const teams = await getPublicTeams({ tenantId: TENANT_ID });

    expect(teams[0]?.hasStandings).toBe(false);
  });

  it("does not require live standings fetches to resolve hasStandings", async () => {
    mocks.teamFindMany.mockResolvedValue([makeTeamRow()]);
    mocks.teamExternalMappingFindMany.mockResolvedValue([
      {
        externalTeamId: 100,
        externalSeasonId: 2027,
        providerLeagueId: 42,
        providerLeagueName: "Juniorinnen FF-14",
        providerTeamName: "FC Allschwil Juniorinnen FF-14",
        lastSyncedAt: new Date("2026-08-01T00:00:00.000Z"),
        teamSeasonId: "team-season-ff14",
        provider: "SFV",
        providerIsActive: true,
      },
    ]);

    await getPublicTeams({ tenantId: TENANT_ID });

    expect(mocks.teamExternalMappingFindMany).toHaveBeenCalledTimes(1);
  });
});
