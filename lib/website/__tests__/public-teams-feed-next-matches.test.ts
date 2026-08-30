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
  findNextTournamentEventForTeamSeason: vi.fn(),
  listTournamentsByIds: vi.fn(),
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

vi.mock("@/lib/tournaments/queries", () => ({
  findNextTournamentEventForTeamSeason:
    mocks.findNextTournamentEventForTeamSeason,
}));

vi.mock("@/lib/tournaments/tournament-service", () => ({
  listTournamentsByIds: mocks.listTournamentsByIds,
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

function createMatchEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: "event-home",
    tenantId: TENANT_ID,
    seasonId: SEASON_ID,
    teamId: TEAM_ID,
    type: "MATCH",
    status: "SCHEDULED",
    title: "FC Example - Opponent",
    location: "Im Brüel",
    startAt: new Date("2026-09-01T18:00:00.000Z"),
    endAt: null,
    opponentName: "Opponent FC",
    competitionLabel: "Junioren E",
    homeAway: "HOME",
    resultLabel: null,
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
      providerMatchState: 1,
      providerMatchStateName: "Geplant",
      scoreHome: null,
      scoreAway: null,
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

describe("getPublicTeamDetail — nextMatches", () => {
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
    mocks.matchEventFindMany.mockResolvedValue([createMatchEvent()]);
    mocks.teamExternalMappingFindFirst.mockResolvedValue(null);
    mocks.fetchTeamStandingsForMapping.mockResolvedValue(null);
    mocks.findNextTournamentEventForTeamSeason.mockResolvedValue(null);
    mocks.listTournamentsByIds.mockResolvedValue([]);
    mocks.eventFindMany.mockImplementation(async (args: { where?: { type?: string } }) => {
      if (args.where?.type === "MATCH") {
        return mocks.matchEventFindMany();
      }

      return [];
    });
  });

  it("J. includes website-visible SFV fixtures without requiring teamPageVisible=true", async () => {
    const detail = await getPublicTeamDetail({
      tenantId: TENANT_ID,
      slug: "e1",
    });

    expect(detail?.nextMatches).toHaveLength(1);
    expect(detail?.nextMatches[0]?.opponent.name).toBe("Opponent FC");
    expect(mocks.eventFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          websiteVisible: true,
          type: "MATCH",
        }),
      }),
    );
  });

  it("B. includes away fixtures resolved via MatchExternalMapping.awayTeamId", async () => {
    mocks.matchEventFindMany.mockResolvedValue([
      createMatchEvent({
        id: "event-away",
        homeAway: "AWAY",
        matchExternalMapping: {
          ...createMatchEvent().matchExternalMapping,
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

    const detail = await getPublicTeamDetail({
      tenantId: TENANT_ID,
      slug: "e1",
    });

    expect(detail?.nextMatches[0]?.isAwayTeam).toBe(true);
    expect(detail?.nextMatches[0]?.opponent.name).toBe("Host FC");
  });

  it("K. enforces tenant isolation for enrichment lookups", async () => {
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

  it("L. scopes matches to the resolved current team season", async () => {
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

  it("exposes the seasonal publication flags without changing nextMatches", async () => {
    mocks.teamFindFirst.mockResolvedValueOnce({
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
          showNextMatch: false,
          showNextTournament: false,
          season: { key: "2026-2027", name: "Saison 2026/27" },
        },
      ],
    });

    const detail = await getPublicTeamDetail({
      tenantId: TENANT_ID,
      slug: "e1",
    });

    expect(detail?.publication).toEqual({
      showNextMatch: false,
      showNextTournament: false,
    });
    expect(detail?.nextMatches).toHaveLength(1);
    expect(detail?.nextEvent).toBeNull();
  });

  it("exposes the canonical next tournament with canonical club logos", async () => {
    mocks.teamFindFirst.mockResolvedValueOnce({
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
          showNextMatch: false,
          showNextTournament: true,
          season: { key: "2026-2027", name: "Saison 2026/27" },
        },
      ],
    });
    mocks.findNextTournamentEventForTeamSeason.mockResolvedValueOnce({
      id: "tournament-1",
    });
    mocks.listTournamentsByIds.mockResolvedValueOnce([
      {
        id: "tournament-1",
        tenantId: TENANT_ID,
        title: "Herbstturnier",
        description: null,
        status: "SCHEDULED",
        source: "MANUAL",
        startAt: "2026-09-01T08:00:00.000Z",
        endAt: "2026-09-01T16:00:00.000Z",
        meetingTime: null,
        location: "Im Brüel",
        organizerName: "FC Host",
        organizerLogoUrl: "https://cdn.example.com/host.png",
        organizerExternalClubId: "club-host",
        competitionLabel: null,
        resultLabel: null,
        remarks: null,
        season: { id: SEASON_ID, key: "2026-2027", name: "Saison 2026/27" },
        team: null,
        teamLogoUrl: null,
        homeAway: "AWAY",
        participants: [
          {
            id: "participant-1",
            displayName: "FC Guest",
            logoUrl: "https://cdn.example.com/guest.png",
            kind: "EXTERNAL_CLUB",
            team: null,
            externalClub: { club: { id: "club-guest" } },
          },
        ],
        resourceAllocations: [],
        visibility: {
          websiteVisible: true,
          infoboardVisible: true,
          homepageVisible: false,
          wochenplanVisible: true,
          teamPageVisible: false,
        },
        reviewStage: "PUBLISHED",
        createdAt: "2026-08-01T08:00:00.000Z",
        updatedAt: "2026-08-01T08:00:00.000Z",
      },
    ]);

    const detail = await getPublicTeamDetail({
      tenantId: TENANT_ID,
      slug: "e1",
    });

    expect(mocks.findNextTournamentEventForTeamSeason).toHaveBeenCalledWith(
      TENANT_ID,
      TEAM_SEASON_ID,
      NOW,
    );
    expect(detail?.nextTournament).toMatchObject({
      id: "tournament-1",
      organizer: {
        logoUrl: "https://cdn.example.com/host.png",
      },
      participants: [
        {
          logoUrl: "https://cdn.example.com/guest.png",
        },
      ],
    });
    expect(detail?.nextEvent?.type).toBe("TOURNAMENT");
  });
});
