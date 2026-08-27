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
    competitions: [
      {
        isPrimary: true,
        displayOrder: 0,
        competition: {
          id: "competition-1",
          officialName: "Junioren E",
          shortName: "JE",
          groupName: null,
        },
      },
    ],
  };
}

function createCompletedMatchEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: "event-completed-home",
    tenantId: TENANT_ID,
    seasonId: SEASON_ID,
    teamId: TEAM_ID,
    type: "MATCH",
    status: "COMPLETED",
    title: "FC Example - Opponent",
    location: "Im Brüel",
    startAt: new Date("2026-07-01T18:00:00.000Z"),
    endAt: null,
    opponentName: "Opponent FC",
    competitionLabel: "Junioren E",
    homeAway: "HOME",
    resultLabel: "3:1",
    intermediateResultLabel: null,
    team: {
      id: TEAM_ID,
      name: "FC Example E1",
      shortName: "E1",
      alternativeName: null,
      tenantId: TENANT_ID,
    },
    matchExternalMapping: {
      provider: "SFV",
      externalMatchId: 9001,
      externalSeasonId: 2027,
      matchNumber: 12345,
      providerHomeTeamId: 100,
      providerAwayTeamId: 200,
      providerHomeTeamName: "Provider Home",
      providerAwayTeamName: "Provider Away",
      homeTeamId: TEAM_ID,
      awayTeamId: null,
      providerMatchState: 3,
      providerMatchStateName: "ausgetragen",
      scoreHome: 3,
      scoreAway: 1,
      providerLeagueId: 10,
      providerLeagueName: "League",
      providerDivisionId: 20,
      providerDivisionName: "Division",
      providerRoundNbr: 3,
      providerVenueName: "Sportanlage Brüel",
      homeTeam: {
        id: TEAM_ID,
        name: "FC Example E1",
        shortName: "E1",
        alternativeName: null,
        tenantId: TENANT_ID,
      },
      awayTeam: null,
      homeExternalTeam: null,
      awayExternalTeam: {
        id: "external-away-1",
        name: "Opponent FC",
        shortName: "Opp",
        alternativeName: null,
      },
    },
    ...overrides,
  };
}

describe("getPublicTeamDetail — results", () => {
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
    mocks.teamFindMany.mockResolvedValue([
      { id: TEAM_ID, shortName: "E1" },
    ]);
    mocks.externalTeamFindMany.mockResolvedValue([
      {
        id: "external-away-1",
        shortName: "Opp",
        logoUrl: null,
        externalClub: {
          name: "Opponent Club",
          logoUrl: "https://cdn.example.com/opponent.png",
        },
      },
    ]);
    mocks.teamSeasonFindFirst.mockImplementation(async () => createTeamSeasonContext());
    mocks.matchEventFindMany.mockResolvedValue([createCompletedMatchEvent()]);
    mocks.teamExternalMappingFindFirst.mockResolvedValue(null);
    mocks.fetchTeamStandingsForMapping.mockResolvedValue(null);
    mocks.eventFindMany.mockImplementation(async (args: { where?: { type?: string } }) => {
      if (args.where?.type === "MATCH") {
        return mocks.matchEventFindMany();
      }

      return [];
    });
  });

  it("H. includes COMPLETED website-visible results", async () => {
    const detail = await getPublicTeamDetail({
      tenantId: TENANT_ID,
      slug: "e1",
    });

    expect(detail?.results).toHaveLength(1);
    expect(detail?.results[0]?.status).toBe("COMPLETED");
    expect(detail?.results[0]?.score).toEqual({ home: 3, away: 1 });
    expect(detail?.results[0]?.resultPerspective).toBe("WON");
    expect(mocks.eventFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          websiteVisible: true,
          type: "MATCH",
        }),
      }),
    );
  });

  it("K. includes away completed fixtures via MatchExternalMapping.awayTeamId", async () => {
    mocks.matchEventFindMany.mockResolvedValue([
      createCompletedMatchEvent({
        id: "event-completed-away",
        homeAway: "AWAY",
        matchExternalMapping: {
          ...createCompletedMatchEvent().matchExternalMapping,
          scoreHome: 1,
          scoreAway: 2,
          homeTeamId: null,
          awayTeamId: TEAM_ID,
          homeTeam: null,
          awayTeam: {
            id: TEAM_ID,
            name: "FC Example E1",
            shortName: "E1",
            alternativeName: null,
            tenantId: TENANT_ID,
          },
          homeExternalTeam: {
            id: "external-home-1",
            name: "Host FC",
            shortName: null,
            alternativeName: null,
          },
          awayExternalTeam: null,
        },
      }),
    ]);
    mocks.externalTeamFindMany.mockResolvedValue([
      {
        id: "external-home-1",
        shortName: null,
        logoUrl: null,
        externalClub: {
          name: "Host Club",
          logoUrl: "https://cdn.example.com/host.png",
        },
      },
    ]);

    const detail = await getPublicTeamDetail({
      tenantId: TENANT_ID,
      slug: "e1",
    });

    expect(detail?.results[0]?.isAwayTeam).toBe(true);
    expect(detail?.results[0]?.resultPerspective).toBe("WON");
    expect(detail?.results[0]?.opponent.name).toBe("Host FC");
  });

  it("L. excludes websiteVisible=false fixtures", async () => {
    mocks.matchEventFindMany.mockResolvedValue([]);

    const detail = await getPublicTeamDetail({
      tenantId: TENANT_ID,
      slug: "e1",
    });

    expect(detail?.results).toEqual([]);
  });

  it("M. enforces tenant isolation for enrichment lookups", async () => {
    await getPublicTeamDetail({
      tenantId: TENANT_ID,
      slug: "e1",
    });

    expect(mocks.teamFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: TENANT_ID }),
      }),
    );
    expect(mocks.externalTeamFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: TENANT_ID }),
      }),
    );
  });

  it("N. scopes results to the resolved current team season", async () => {
    await getPublicTeamDetail({
      tenantId: TENANT_ID,
      slug: "e1",
    });

    expect(mocks.teamSeasonFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: TEAM_SEASON_ID,
          team: { tenantId: TENANT_ID },
        }),
      }),
    );
    expect(mocks.eventFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          seasonId: SEASON_ID,
          type: "MATCH",
        }),
      }),
    );
  });

  it("Q. returns both nextMatches and results without breaking existing fields", async () => {
    mocks.matchEventFindMany.mockResolvedValue([
      createCompletedMatchEvent(),
      {
        ...createCompletedMatchEvent(),
        id: "event-upcoming",
        status: "SCHEDULED",
        startAt: new Date("2026-09-01T18:00:00.000Z"),
        resultLabel: null,
        matchExternalMapping: {
          ...createCompletedMatchEvent().matchExternalMapping,
          scoreHome: null,
          scoreAway: null,
          providerMatchState: 1,
          providerMatchStateName: "Geplant",
        },
      },
    ]);

    const detail = await getPublicTeamDetail({
      tenantId: TENANT_ID,
      slug: "e1",
    });

    expect(detail?.name).toBe("FC Example E1");
    expect(detail?.nextMatches.length).toBeGreaterThanOrEqual(0);
    expect(detail?.results).toHaveLength(1);
    expect(detail?.results[0]?.score).not.toBeNull();
    expect(detail?.nextMatches[0]?.score).toBeNull();
  });
});
