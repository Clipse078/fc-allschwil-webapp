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
  resolveStandingsForTeamSeason: vi.fn(),
  buildStandingsClubEnrichmentByProviderTeamId: vi.fn(),
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
  },
}));

vi.mock("@/lib/integrations/sfv/standings-resolution", () => ({
  resolveStandingsForTeamSeason: mocks.resolveStandingsForTeamSeason,
}));

vi.mock("@/lib/club-directory/standings-club-enrichment", () => ({
  buildStandingsClubEnrichmentByProviderTeamId:
    mocks.buildStandingsClubEnrichmentByProviderTeamId,
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
    mocks.resolveStandingsForTeamSeason.mockResolvedValue({
      standings: createStandingsTable(),
      externalTeamId: 100,
    });
    mocks.buildStandingsClubEnrichmentByProviderTeamId.mockResolvedValue(new Map());
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
    expect(mocks.resolveStandingsForTeamSeason).toHaveBeenCalledWith({
      tenantId: TENANT_ID,
      teamSeasonId: TEAM_SEASON_ID,
      seasonKey: "2026-2027",
    });
  });

  it("returns standings null when no mapping exists", async () => {
    mocks.resolveStandingsForTeamSeason.mockResolvedValue(null);

    const detail = await getPublicTeamDetail({
      tenantId: TENANT_ID,
      slug: "e1",
    });

    expect(detail?.standings).toBeNull();
    expect(mocks.resolveStandingsForTeamSeason).toHaveBeenCalled();
  });

  it("returns standings null when provider fails", async () => {
    mocks.resolveStandingsForTeamSeason.mockResolvedValue(null);

    const detail = await getPublicTeamDetail({
      tenantId: TENANT_ID,
      slug: "e1",
    });

    expect(detail?.standings).toBeNull();
    expect(detail?.name).toBe("FC Example E1");
  });

  it("returns standings null on season mismatch", async () => {
    mocks.resolveStandingsForTeamSeason.mockResolvedValue(null);

    const detail = await getPublicTeamDetail({
      tenantId: TENANT_ID,
      slug: "e1",
    });

    expect(detail?.standings).toBeNull();
    expect(mocks.resolveStandingsForTeamSeason).toHaveBeenCalled();
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

  it("enforces tenant isolation for canonical standings resolution", async () => {
    await getPublicTeamDetail({
      tenantId: TENANT_ID,
      slug: "e1",
    });

    expect(mocks.resolveStandingsForTeamSeason).toHaveBeenCalledWith({
      tenantId: TENANT_ID,
      teamSeasonId: TEAM_SEASON_ID,
      seasonKey: "2026-2027",
    });
  });

  it("exposes auto-resolved canonical logos in standings rows", async () => {
    mocks.resolveStandingsForTeamSeason.mockResolvedValue({
      standings: {
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
          {
            position: 2,
            externalTeamId: 200,
            teamName: "FC Black Stars D7a",
            shortName: null,
            played: 10,
            won: 7,
            drawn: 2,
            lost: 1,
            goalsFor: 20,
            goalsAgainst: 10,
            points: 23,
            penaltyPoints: 0,
          },
        ],
      },
      externalTeamId: 100,
    });
    mocks.buildStandingsClubEnrichmentByProviderTeamId.mockResolvedValue(
      new Map([
        [
          200,
          {
            canonicalClubId: "club-black-stars",
            shortName: "Black Stars",
            logoUrl: "https://cdn.example.com/fc-black-stars.png",
            resolutionSource: "prefix_name_match",
            providerTeamName: null,
          },
        ],
      ]),
    );

    const detail = await getPublicTeamDetail({
      tenantId: TENANT_ID,
      slug: "e1",
    });

    const opponent = detail?.standings?.rows.find((row) => !row.team.isCurrentTeam);
    expect(opponent?.team.name).toBe("FC Black Stars D7a");
    expect(opponent?.team.logoUrl).toBe("https://cdn.example.com/fc-black-stars.png");
    expect(opponent?.team.shortName).toBe("Black Stars");
  });
});
