import { beforeEach, describe, expect, it, vi } from "vitest";

import { getPublicTeamDetail } from "../public-teams-feed";

const mocks = vi.hoisted(() => ({
  teamFindFirst: vi.fn(),
  playerSquadMemberFindMany: vi.fn(),
  trainerTeamMemberFindMany: vi.fn(),
  eventFindMany: vi.fn(),
  facilityResourceFindMany: vi.fn(),
  tenantFindUnique: vi.fn(),
  teamFindMany: vi.fn(),
  externalTeamFindMany: vi.fn(),
  teamSeasonFindFirst: vi.fn(),
  matchEventFindMany: vi.fn(),
  teamExternalMappingFindFirst: vi.fn(),
  fetchTeamStandingsForMapping: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    team: {
      findFirst: mocks.teamFindFirst,
      findMany: mocks.teamFindMany,
    },
    playerSquadMember: {
      findMany: mocks.playerSquadMemberFindMany,
    },
    trainerTeamMember: {
      findMany: mocks.trainerTeamMemberFindMany,
    },
    event: {
      findMany: mocks.eventFindMany,
    },
    facilityResource: {
      findMany: mocks.facilityResourceFindMany,
    },
    tenant: {
      findUnique: mocks.tenantFindUnique,
    },
    externalTeam: {
      findMany: mocks.externalTeamFindMany,
    },
    teamSeason: {
      findFirst: mocks.teamSeasonFindFirst,
    },
    teamExternalMapping: {
      findFirst: mocks.teamExternalMappingFindFirst,
    },
  },
}));

vi.mock("@/lib/integrations/sfv/standings-provider", () => ({
  fetchTeamStandingsForMapping: mocks.fetchTeamStandingsForMapping,
}));

const TENANT_ID = "tenant-fca";
const TEAM_ID = "team-e1";
const TEAM_SEASON_ID = "team-season-1";
const SEASON_ID = "season-2026-2027";
const NOW = new Date("2026-08-25T12:00:00.000Z");

function createTeamSeasonContext() {
  return {
    id: TEAM_SEASON_ID,
    teamId: TEAM_ID,
    seasonId: SEASON_ID,
    displayName: "FC Example E1 2026/27",
    team: {
      id: TEAM_ID,
      name: "FC Example E1",
      shortName: "E1",
      alternativeName: null,
      tenantId: TENANT_ID,
    },
    season: {
      id: SEASON_ID,
      key: "2026-2027",
      name: "Saison 2026/27",
    },
    competitions: [],
  };
}

function createStandingsTable() {
  return {
    competition: {
      name: "Junioren E",
      divisionName: "Division 1",
      groupName: "Gruppe A",
    },
    rows: [
      {
        position: 1,
        externalTeamId: 100,
        teamName: "FC Example E1",
        shortName: null,
        played: 10,
        won: 8,
        drawn: 1,
        lost: 1,
        goalsFor: 25,
        goalsAgainst: 8,
        points: 25,
        penaltyPoints: 0,
      },
    ],
  };
}

describe("getPublicTeamDetail — standings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(NOW);

    mocks.teamFindFirst.mockResolvedValue({
      id: TEAM_ID,
      name: "FC Example E1",
      slug: "e1",
      category: "JUNIOREN",
      genderGroup: null,
      ageGroup: null,
      teamSeasons: [
        {
          id: TEAM_SEASON_ID,
          displayName: "FC Example E1 2026/27",
          shortName: "E1",
          squadWebsiteVisible: false,
          trainerTeamWebsiteVisible: false,
          season: { key: "2026-2027", name: "Saison 2026/27" },
        },
      ],
    });
    mocks.eventFindMany.mockResolvedValue([]);
    mocks.facilityResourceFindMany.mockResolvedValue([]);
    mocks.tenantFindUnique.mockResolvedValue({
      name: "FC Example",
      logoUrl: "https://cdn.example.com/tenant.png",
    });
    mocks.teamFindMany.mockResolvedValue([]);
    mocks.externalTeamFindMany.mockResolvedValue([]);
    mocks.teamSeasonFindFirst.mockImplementation(async () => createTeamSeasonContext());
    mocks.matchEventFindMany.mockResolvedValue([]);
    mocks.teamExternalMappingFindFirst.mockResolvedValue({
      externalTeamId: 100,
      externalSeasonId: 2027,
      providerLeagueId: 10,
    });
    mocks.fetchTeamStandingsForMapping.mockResolvedValue(createStandingsTable());
  });

  it("includes nextMatches, results, and standings", async () => {
    const detail = await getPublicTeamDetail({
      tenantId: TENANT_ID,
      slug: "e1",
    });

    expect(detail).toMatchObject({
      nextMatches: [],
      results: [],
      standings: {
        competition: {
          name: "Junioren E",
          divisionName: "Division 1",
          groupName: "Gruppe A",
        },
      },
    });
    expect(detail?.standings?.rows).toHaveLength(1);
  });

  it("returns standings null when no mapping exists", async () => {
    mocks.teamExternalMappingFindFirst.mockResolvedValue(null);

    const detail = await getPublicTeamDetail({
      tenantId: TENANT_ID,
      slug: "e1",
    });

    expect(detail?.standings).toBeNull();
    expect(mocks.fetchTeamStandingsForMapping).not.toHaveBeenCalled();
  });

  it("returns standings null when provider fails", async () => {
    mocks.fetchTeamStandingsForMapping.mockResolvedValue(null);

    const detail = await getPublicTeamDetail({
      tenantId: TENANT_ID,
      slug: "e1",
    });

    expect(detail?.standings).toBeNull();
    expect(detail?.name).toBe("FC Example E1");
  });

  it("returns standings null on season mismatch", async () => {
    mocks.teamExternalMappingFindFirst.mockResolvedValue({
      externalTeamId: 100,
      externalSeasonId: 2026,
      providerLeagueId: 10,
    });

    const detail = await getPublicTeamDetail({
      tenantId: TENANT_ID,
      slug: "e1",
    });

    expect(detail?.standings).toBeNull();
    expect(mocks.fetchTeamStandingsForMapping).not.toHaveBeenCalled();
  });

  it("does not leak raw provider fields", async () => {
    const detail = await getPublicTeamDetail({
      tenantId: TENANT_ID,
      slug: "e1",
    });

    const serialized = JSON.stringify(detail?.standings);
    expect(serialized).not.toContain("leagueId");
    expect(serialized).not.toContain("provider");
    expect(serialized).not.toContain("clubNumber");
    expect(serialized).not.toContain("externalTeamId");
  });

  it("enforces tenant isolation for mapping lookup", async () => {
    await getPublicTeamDetail({
      tenantId: TENANT_ID,
      slug: "e1",
    });

    expect(mocks.teamExternalMappingFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: TENANT_ID,
          teamSeasonId: TEAM_SEASON_ID,
          provider: "SFV",
        }),
      }),
    );
  });
});
