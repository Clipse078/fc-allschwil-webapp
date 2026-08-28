import { beforeEach, describe, expect, it, vi } from "vitest";

import type { TeamMatchQueryDatabase } from "../team-match-query-service";
import {
  getTeamCockpitSportingData,
  loadCurrentSeasonSfvMapping,
  loadCurrentSeasonSfvMappingsForList,
} from "../team-cockpit-sporting-data";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    teamExternalMapping: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/integrations/sfv/standings-provider", () => ({
  fetchTeamStandingsForMapping: vi.fn(),
}));

vi.mock("../team-match-query-service", async () => {
  const actual = await vi.importActual<typeof import("../team-match-query-service")>(
    "../team-match-query-service",
  );
  return {
    ...actual,
    listTeamSeasonMatches: vi.fn(),
  };
});

import { prisma } from "@/lib/db/prisma";
import { fetchTeamStandingsForMapping } from "@/lib/integrations/sfv/standings-provider";
import { listTeamSeasonMatches } from "../team-match-query-service";

const TENANT_ID = "tenant-1";
const TEAM_ID = "team-1";
const TEAM_SEASON_ID = "team-season-1";
const NOW = new Date("2026-08-25T12:00:00.000Z");

const mockPrisma = prisma as unknown as {
  teamExternalMapping: {
    findFirst: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
  };
};
const mockFetchStandings = fetchTeamStandingsForMapping as ReturnType<typeof vi.fn>;
const mockListMatches = listTeamSeasonMatches as ReturnType<typeof vi.fn>;

function createUpcomingMatch(overrides: Record<string, unknown> = {}) {
  return {
    eventId: "event-upcoming",
    tenantId: TENANT_ID,
    teamSeasonId: TEAM_SEASON_ID,
    seasonId: "season-1",
    side: "HOME",
    startAt: new Date("2026-09-01T18:00:00.000Z"),
    endAt: null,
    status: "SCHEDULED",
    lifecycle: "UPCOMING",
    lifecycleStage: "UPCOMING",
    home: {
      canonicalTeamId: TEAM_ID,
      canonicalExternalTeamId: null,
      displayName: "FC Test",
      clubName: null,
      externalLogoUrl: null,
      providerTeamId: null,
      providerTeamName: null,
    },
    away: {
      canonicalTeamId: null,
      canonicalExternalTeamId: "ext-1",
      displayName: "Opponent FC",
      clubName: "Opponent FC",
      externalLogoUrl: "https://blob.vercel-storage.com/opponent.png",
      providerTeamId: 200,
      providerTeamName: "Opponent",
    },
    opponent: {
      displayName: "Opponent FC",
      canonicalTeamId: null,
      canonicalExternalTeamId: "ext-1",
      providerTeamId: 200,
      providerTeamName: "Opponent",
    },
    competition: {
      eventCompetitionLabel: null,
      providerLeagueId: null,
      providerLeagueName: null,
      providerDivisionId: null,
      providerDivisionName: null,
      providerRoundNumber: null,
      canonicalCompetitionId: null,
      canonicalCompetitionName: null,
      canonicalCompetitionShortName: null,
    },
    location: "Home ground",
    venueName: "Home ground",
    resultLabel: null,
    scoreHome: null,
    scoreAway: null,
    intermediateResultLabel: null,
    provider: {
      provider: "SFV",
      externalMatchId: 1,
      externalSeasonId: 2027,
      matchNumber: 1,
      providerMatchState: 1,
      providerMatchStateName: "Geplant",
    },
    ...overrides,
  };
}

function createCompletedMatch(overrides: Record<string, unknown> = {}) {
  return createUpcomingMatch({
    eventId: "event-completed",
    side: "AWAY",
    startAt: new Date("2026-08-01T18:00:00.000Z"),
    status: "COMPLETED",
    lifecycle: "COMPLETED",
    lifecycleStage: "COMPLETED",
    scoreHome: 1,
    scoreAway: 2,
    ...overrides,
  });
}

describe("TEAM-COCKPIT-PREMIUM-01C — getTeamCockpitSportingData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListMatches.mockResolvedValue({
      upcoming: [createUpcomingMatch()],
      completed: [createCompletedMatch()],
    });
    mockFetchStandings.mockResolvedValue(null);
  });

  it("loads next matches without websiteVisible restriction", async () => {
    const data = await getTeamCockpitSportingData({
      tenantId: TENANT_ID,
      teamId: TEAM_ID,
      teamSeasonId: TEAM_SEASON_ID,
      seasonKey: "2026-2027",
      teamDisplayName: "FC Test",
      database: {} as TeamMatchQueryDatabase,
      now: NOW,
    });

    expect(mockListMatches).toHaveBeenCalledWith(expect.anything(), {
      tenantId: TENANT_ID,
      teamSeasonId: TEAM_SEASON_ID,
      now: NOW,
    });
    expect(data.nextMatches).toHaveLength(1);
    expect(data.nextMatches[0]?.side).toBe("HOME");
    expect(data.nextMatches[0]?.home.isOwnTeam).toBe(true);
    expect(data.nextMatches[0]?.status).toBe("SCHEDULED");
    expect(data.nextMatches[0]?.lifecycle).toBe("UPCOMING");
    expect(data.nextMatches[0]?.competitionName).toBeNull();
  });

  it("maps tenant and external identity onto HOME and AWAY fixture sides", async () => {
    const data = await getTeamCockpitSportingData({
      tenantId: TENANT_ID,
      tenantClubName: "FC Test Club",
      tenantLogoUrl: "/tenant-crest.svg",
      teamId: TEAM_ID,
      teamSeasonId: TEAM_SEASON_ID,
      seasonKey: "2026-2027",
      teamDisplayName: "1. Mannschaft",
      database: {} as TeamMatchQueryDatabase,
      now: NOW,
    });

    expect(data.nextMatches[0]?.home).toEqual({
      displayName: "FC Test",
      isOwnTeam: true,
      clubName: "FC Test Club",
      logoUrl: "/tenant-crest.svg",
    });
    expect(data.nextMatches[0]?.away).toEqual({
      displayName: "Opponent FC",
      isOwnTeam: false,
      clubName: "Opponent FC",
      logoUrl: "https://blob.vercel-storage.com/opponent.png",
    });
    expect(JSON.stringify(data.nextMatches[0])).not.toMatch(
      /providerTeamId|providerTeamName|sfv/i,
    );
  });

  it("uses the tenant crest when the internal team is AWAY", async () => {
    mockListMatches.mockResolvedValue({
      upcoming: [
        createUpcomingMatch({
          side: "AWAY",
          home: {
            canonicalTeamId: null,
            canonicalExternalTeamId: "ext-home",
            displayName: "Host FC",
            clubName: "Host Club",
            externalLogoUrl: "/host-crest.svg",
            providerTeamId: 300,
            providerTeamName: "Host FC",
          },
          away: {
            canonicalTeamId: TEAM_ID,
            canonicalExternalTeamId: null,
            displayName: "1. Mannschaft",
            clubName: null,
            externalLogoUrl: null,
            providerTeamId: 123,
            providerTeamName: "FC Test",
          },
        }),
      ],
      completed: [],
    });

    const data = await getTeamCockpitSportingData({
      tenantId: TENANT_ID,
      tenantClubName: "FC Test Club",
      tenantLogoUrl: "/tenant-crest.svg",
      teamId: TEAM_ID,
      teamSeasonId: TEAM_SEASON_ID,
      seasonKey: "2026-2027",
      teamDisplayName: "1. Mannschaft",
      database: {} as TeamMatchQueryDatabase,
      now: NOW,
    });

    expect(data.nextMatches[0]?.home.logoUrl).toBe("/host-crest.svg");
    expect(data.nextMatches[0]?.away.logoUrl).toBe("/tenant-crest.svg");
    expect(data.nextMatches[0]?.away.displayName).toBe("1. Mannschaft");
  });

  it("uses the tenant crest for another internal team side without marking it as own", async () => {
    mockListMatches.mockResolvedValue({
      upcoming: [
        createUpcomingMatch({
          away: {
            canonicalTeamId: "team-internal-opponent",
            canonicalExternalTeamId: null,
            displayName: "2. Mannschaft",
            clubName: null,
            externalLogoUrl: null,
            providerTeamId: 500,
            providerTeamName: "FC Test 2",
          },
        }),
      ],
      completed: [],
    });

    const data = await getTeamCockpitSportingData({
      tenantId: TENANT_ID,
      tenantClubName: "FC Test Club",
      tenantLogoUrl: "/tenant-crest.svg",
      teamId: TEAM_ID,
      teamSeasonId: TEAM_SEASON_ID,
      seasonKey: "2026-2027",
      teamDisplayName: "1. Mannschaft",
      database: {} as TeamMatchQueryDatabase,
      now: NOW,
    });

    expect(data.nextMatches[0]?.away).toMatchObject({
      displayName: "2. Mannschaft",
      isOwnTeam: false,
      clubName: "FC Test Club",
      logoUrl: "/tenant-crest.svg",
    });
  });

  it("preserves null when an external fixture side has no canonical crest", async () => {
    mockListMatches.mockResolvedValue({
      upcoming: [
        createUpcomingMatch({
          away: {
            canonicalTeamId: null,
            canonicalExternalTeamId: "ext-no-logo",
            displayName: "No Crest FC",
            clubName: "No Crest FC",
            externalLogoUrl: null,
            providerTeamId: 400,
            providerTeamName: "No Crest FC",
          },
        }),
      ],
      completed: [],
    });

    const data = await getTeamCockpitSportingData({
      tenantId: TENANT_ID,
      tenantLogoUrl: "/tenant-crest.svg",
      teamId: TEAM_ID,
      teamSeasonId: TEAM_SEASON_ID,
      seasonKey: "2026-2027",
      teamDisplayName: "FC Test",
      database: {} as TeamMatchQueryDatabase,
      now: NOW,
    });

    expect(data.nextMatches[0]?.away.logoUrl).toBeNull();
  });

  it("returns away results with WON/DRAW/LOST perspective and scores", async () => {
    const data = await getTeamCockpitSportingData({
      tenantId: TENANT_ID,
      teamId: TEAM_ID,
      teamSeasonId: TEAM_SEASON_ID,
      seasonKey: "2026-2027",
      teamDisplayName: "FC Test",
      database: {} as TeamMatchQueryDatabase,
      now: NOW,
    });

    expect(data.results).toHaveLength(1);
    expect(data.results[0]?.side).toBe("AWAY");
    expect(data.results[0]?.teamScore).toBe(2);
    expect(data.results[0]?.opponentScore).toBe(1);
    expect(data.results[0]?.resultPerspective).toBe("WON");
  });

  it("orders next matches ascending and results latest first via canonical query", async () => {
    mockListMatches.mockResolvedValue({
      upcoming: [
        createUpcomingMatch({
          eventId: "later",
          startAt: new Date("2026-09-10T18:00:00.000Z"),
        }),
        createUpcomingMatch({
          eventId: "earlier",
          startAt: new Date("2026-09-01T18:00:00.000Z"),
        }),
      ],
      completed: [
        createCompletedMatch({
          eventId: "older",
          startAt: new Date("2026-07-01T18:00:00.000Z"),
        }),
        createCompletedMatch({
          eventId: "newer",
          startAt: new Date("2026-08-01T18:00:00.000Z"),
        }),
      ],
    });

    const data = await getTeamCockpitSportingData({
      tenantId: TENANT_ID,
      teamId: TEAM_ID,
      teamSeasonId: TEAM_SEASON_ID,
      seasonKey: "2026-2027",
      teamDisplayName: "FC Test",
      database: {} as TeamMatchQueryDatabase,
      now: NOW,
      limits: { nextMatches: 10, results: 10 },
    });

    expect(data.nextMatches.map((match) => match.eventId)).toEqual(["earlier", "later"]);
    expect(data.results.map((match) => match.eventId)).toEqual(["newer", "older"]);
  });

  it("maps fixture competition and postponed lifecycle fields", async () => {
    mockListMatches.mockResolvedValue({
      upcoming: [
        createUpcomingMatch({
          eventId: "postponed",
          lifecycle: "POSTPONED",
          status: "POSTPONED",
          competition: {
            eventCompetitionLabel: "Cup Runde 1",
            providerLeagueId: null,
            providerLeagueName: null,
            providerDivisionId: null,
            providerDivisionName: null,
            providerRoundNumber: null,
            canonicalCompetitionId: null,
            canonicalCompetitionName: null,
            canonicalCompetitionShortName: null,
          },
        }),
      ],
      completed: [],
    });

    const data = await getTeamCockpitSportingData({
      tenantId: TENANT_ID,
      teamId: TEAM_ID,
      teamSeasonId: TEAM_SEASON_ID,
      seasonKey: "2026-2027",
      teamDisplayName: "FC Test",
      database: {} as TeamMatchQueryDatabase,
      now: NOW,
    });

    expect(data.nextMatches[0]?.competitionName).toBe("Cup Runde 1");
    expect(data.nextMatches[0]?.lifecycle).toBe("POSTPONED");
    expect(data.nextMatches[0]?.status).toBe("POSTPONED");
  });

  it("excludes completed results from next matches", async () => {
    mockListMatches.mockResolvedValue({
      upcoming: [],
      completed: [createCompletedMatch()],
    });

    const data = await getTeamCockpitSportingData({
      tenantId: TENANT_ID,
      teamId: TEAM_ID,
      teamSeasonId: TEAM_SEASON_ID,
      seasonKey: "2026-2027",
      teamDisplayName: "FC Test",
      database: {} as TeamMatchQueryDatabase,
      now: NOW,
    });

    expect(data.nextMatches).toHaveLength(0);
    expect(data.results).toHaveLength(1);
  });

  it("excludes cancelled fixtures from next matches", async () => {
    mockListMatches.mockResolvedValue({
      upcoming: [
        createUpcomingMatch({
          eventId: "cancelled",
          lifecycle: "CANCELLED",
          status: "CANCELLED",
        }),
      ],
      completed: [],
    });

    const data = await getTeamCockpitSportingData({
      tenantId: TENANT_ID,
      teamId: TEAM_ID,
      teamSeasonId: TEAM_SEASON_ID,
      seasonKey: "2026-2027",
      teamDisplayName: "FC Test",
      database: {} as TeamMatchQueryDatabase,
      now: NOW,
    });

    expect(data.nextMatches).toHaveLength(0);
  });

  it("L. first detailed fixture matches overview next-match semantics", async () => {
    mockListMatches.mockResolvedValue({
      upcoming: [
        createUpcomingMatch({
          eventId: "first",
          startAt: new Date("2026-09-01T18:00:00.000Z"),
        }),
        createUpcomingMatch({
          eventId: "second",
          startAt: new Date("2026-09-10T18:00:00.000Z"),
        }),
      ],
      completed: [],
    });

    const overviewData = await getTeamCockpitSportingData({
      tenantId: TENANT_ID,
      teamId: TEAM_ID,
      teamSeasonId: TEAM_SEASON_ID,
      seasonKey: "2026-2027",
      teamDisplayName: "FC Test",
      database: {} as TeamMatchQueryDatabase,
      now: NOW,
      limits: { nextMatches: 1, results: 0 },
    });

    const detailData = await getTeamCockpitSportingData({
      tenantId: TENANT_ID,
      teamId: TEAM_ID,
      teamSeasonId: TEAM_SEASON_ID,
      seasonKey: "2026-2027",
      teamDisplayName: "FC Test",
      database: {} as TeamMatchQueryDatabase,
      now: NOW,
      limits: { nextMatches: 10, results: 0 },
    });

    expect(detailData.nextMatches[0]?.eventId).toBe(overviewData.nextMatches[0]?.eventId);
    expect(detailData.nextMatches[0]?.startAt).toEqual(overviewData.nextMatches[0]?.startAt);
    expect(detailData.nextMatches[0]?.side).toBe(overviewData.nextMatches[0]?.side);
  });

  it("Q. first detailed result matches overview latest-result semantics", async () => {
    mockListMatches.mockResolvedValue({
      upcoming: [],
      completed: [
        createCompletedMatch({
          eventId: "newer",
          startAt: new Date("2026-08-20T18:00:00.000Z"),
          scoreHome: 1,
          scoreAway: 2,
        }),
        createCompletedMatch({
          eventId: "older",
          startAt: new Date("2026-07-01T18:00:00.000Z"),
          scoreHome: 3,
          scoreAway: 0,
        }),
      ],
    });

    const overviewData = await getTeamCockpitSportingData({
      tenantId: TENANT_ID,
      teamId: TEAM_ID,
      teamSeasonId: TEAM_SEASON_ID,
      seasonKey: "2026-2027",
      teamDisplayName: "FC Test",
      database: {} as TeamMatchQueryDatabase,
      now: NOW,
      limits: { nextMatches: 0, results: 1 },
    });

    const detailData = await getTeamCockpitSportingData({
      tenantId: TENANT_ID,
      teamId: TEAM_ID,
      teamSeasonId: TEAM_SEASON_ID,
      seasonKey: "2026-2027",
      teamDisplayName: "FC Test",
      database: {} as TeamMatchQueryDatabase,
      now: NOW,
      limits: { nextMatches: 0, results: 10 },
    });

    const overviewResult = overviewData.results[0];
    const detailResult = detailData.results[0];

    expect(detailResult?.eventId).toBe(overviewResult?.eventId);
    expect(detailResult?.startAt).toEqual(overviewResult?.startAt);
    expect(detailResult?.scoreHome).toBe(overviewResult?.scoreHome);
    expect(detailResult?.scoreAway).toBe(overviewResult?.scoreAway);
    expect(detailResult?.resultPerspective).toBe(overviewResult?.resultPerspective);
    expect(detailResult?.side).toBe(overviewResult?.side);
  });

  it("M. scopes match query to tenant and current team season", async () => {
    await getTeamCockpitSportingData({
      tenantId: TENANT_ID,
      teamId: TEAM_ID,
      teamSeasonId: TEAM_SEASON_ID,
      seasonKey: "2026-2027",
      teamDisplayName: "FC Test",
      database: {} as TeamMatchQueryDatabase,
      now: NOW,
    });

    expect(mockListMatches).toHaveBeenCalledWith(expect.anything(), {
      tenantId: TENANT_ID,
      teamSeasonId: TEAM_SEASON_ID,
      now: NOW,
    });
  });

  it("includes website-invisible fixtures for authenticated cockpit", async () => {
    await getTeamCockpitSportingData({
      tenantId: TENANT_ID,
      teamId: TEAM_ID,
      teamSeasonId: TEAM_SEASON_ID,
      seasonKey: "2026-2027",
      teamDisplayName: "FC Test",
      database: {} as TeamMatchQueryDatabase,
      now: NOW,
    });

    const call = mockListMatches.mock.calls[0]?.[1];
    expect(call?.websiteVisibleOnly).toBeUndefined();
  });

  it("N. excludes non-completed fixtures from results", async () => {
    mockListMatches.mockResolvedValue({
      upcoming: [],
      completed: [
        createCompletedMatch({ eventId: "valid" }),
        createCompletedMatch({
          eventId: "scheduled-in-completed",
          status: "SCHEDULED",
          lifecycle: "UPCOMING",
          lifecycleStage: "UPCOMING",
        }),
      ],
    });

    const data = await getTeamCockpitSportingData({
      tenantId: TENANT_ID,
      teamId: TEAM_ID,
      teamSeasonId: TEAM_SEASON_ID,
      seasonKey: "2026-2027",
      teamDisplayName: "FC Test",
      database: {} as TeamMatchQueryDatabase,
      now: NOW,
    });

    expect(data.results).toHaveLength(1);
    expect(data.results[0]?.eventId).toBe("valid");
  });

  it("P. maps completed match with missing scores to UNKNOWN perspective", async () => {
    mockListMatches.mockResolvedValue({
      upcoming: [],
      completed: [
        createCompletedMatch({
          eventId: "missing-score",
          scoreHome: null,
          scoreAway: null,
        }),
      ],
    });

    const data = await getTeamCockpitSportingData({
      tenantId: TENANT_ID,
      teamId: TEAM_ID,
      teamSeasonId: TEAM_SEASON_ID,
      seasonKey: "2026-2027",
      teamDisplayName: "FC Test",
      database: {} as TeamMatchQueryDatabase,
      now: NOW,
    });

    expect(data.results[0]?.scoreHome).toBeNull();
    expect(data.results[0]?.scoreAway).toBeNull();
    expect(data.results[0]?.resultPerspective).toBe("UNKNOWN");
  });

  it("uses standings competition when provider succeeds", async () => {
    mockFetchStandings.mockResolvedValue({
      competition: {
        name: "2. Liga interregional",
        divisionName: "Gruppe 3",
        groupName: null,
      },
      rows: [
        {
          position: 1,
          externalTeamId: 123,
          teamName: "FC Test",
          shortName: "TST",
          played: 1,
          won: 1,
          drawn: 0,
          lost: 0,
          goalsFor: 2,
          goalsAgainst: 0,
          points: 3,
          penaltyPoints: null,
        },
      ],
    });

    const data = await getTeamCockpitSportingData({
      tenantId: TENANT_ID,
      teamId: TEAM_ID,
      teamSeasonId: TEAM_SEASON_ID,
      seasonKey: "2026-2027",
      teamDisplayName: "FC Test",
      teamShortName: "TST",
      sfvMapping: {
        externalTeamId: 123,
        externalSeasonId: 2027,
        providerLeagueId: 10,
        providerLeagueName: "2. Liga interregional",
      },
      database: {} as TeamMatchQueryDatabase,
      now: NOW,
    });

    expect(mockFetchStandings).toHaveBeenCalled();
    expect(data.competition?.source).toBe("STANDINGS");
    expect(data.standings?.rows[0]?.isCurrentTeam).toBe(true);
    expect(data.standings?.rows[0]?.position).toBe(1);
    expect(data.standings?.rows[0]?.goalDifference).toBe(2);
    expect(data.standings?.rows[0]?.penaltyPoints).toBeNull();
  });

  it("batch-enriches standings by stable provider team ID with canonical crests", async () => {
    mockFetchStandings.mockResolvedValue({
      competition: {
        name: "2. Liga interregional",
        divisionName: "Gruppe 3",
        groupName: null,
      },
      rows: [
        {
          position: 1,
          externalTeamId: 200,
          teamName: "External Team Override",
          shortName: null,
          played: 1,
          won: 1,
          drawn: 0,
          lost: 0,
          goalsFor: 2,
          goalsAgainst: 0,
          points: 3,
          penaltyPoints: null,
        },
        {
          position: 2,
          externalTeamId: 123,
          teamName: "FC Test Provider Name",
          shortName: "Provider Short",
          played: 1,
          won: 0,
          drawn: 0,
          lost: 1,
          goalsFor: 0,
          goalsAgainst: 2,
          points: 0,
          penaltyPoints: null,
        },
        {
          position: 3,
          externalTeamId: 300,
          teamName: "External Club Fallback",
          shortName: null,
          played: 1,
          won: 0,
          drawn: 0,
          lost: 1,
          goalsFor: 0,
          goalsAgainst: 1,
          points: 0,
          penaltyPoints: null,
        },
        {
          position: 4,
          externalTeamId: 400,
          teamName: "External Missing",
          shortName: null,
          played: 1,
          won: 0,
          drawn: 0,
          lost: 1,
          goalsFor: 0,
          goalsAgainst: 1,
          points: 0,
          penaltyPoints: null,
        },
      ],
    });
    const findMany = vi.fn().mockResolvedValue([
      {
        shortName: "Override",
        logoUrl: "/team-override.svg",
        providerMappings: [{ providerTeamId: 200 }],
        externalClub: { logoUrl: "/club-ignored.svg" },
      },
      {
        shortName: "Fallback",
        logoUrl: null,
        providerMappings: [{ providerTeamId: 300 }],
        externalClub: { logoUrl: "/club-fallback.svg" },
      },
      {
        shortName: null,
        logoUrl: null,
        providerMappings: [{ providerTeamId: 400 }],
        externalClub: { logoUrl: null },
      },
    ]);

    const data = await getTeamCockpitSportingData({
      tenantId: TENANT_ID,
      tenantLogoUrl: "/tenant-crest.svg",
      teamId: TEAM_ID,
      teamSeasonId: TEAM_SEASON_ID,
      seasonKey: "2026-2027",
      teamDisplayName: "1. Mannschaft",
      teamShortName: "1. Mannschaft",
      sfvMapping: {
        externalTeamId: 123,
        externalSeasonId: 2027,
        providerLeagueId: 10,
        providerLeagueName: "2. Liga interregional",
      },
      database: {} as TeamMatchQueryDatabase,
      identityDatabase: { externalTeam: { findMany } },
      now: NOW,
    });

    expect(findMany).toHaveBeenCalledTimes(1);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId: TENANT_ID,
          providerMappings: {
            some: {
              provider: "SFV",
              providerTeamId: { in: [200, 300, 400] },
            },
          },
        },
      }),
    );
    expect(data.standings?.rows.map((row) => row.logoUrl)).toEqual([
      "/team-override.svg",
      "/tenant-crest.svg",
      "/club-fallback.svg",
      null,
    ]);
    expect(data.standings?.rows[1]).toMatchObject({
      isCurrentTeam: true,
      shortName: "1. Mannschaft",
    });
  });

  it("falls back to providerLeagueName when standings fail", async () => {
    mockFetchStandings.mockResolvedValue(null);

    const data = await getTeamCockpitSportingData({
      tenantId: TENANT_ID,
      teamId: TEAM_ID,
      teamSeasonId: TEAM_SEASON_ID,
      seasonKey: "2026-2027",
      teamDisplayName: "FC Test",
      sfvMapping: {
        externalTeamId: 123,
        externalSeasonId: 2027,
        providerLeagueId: 10,
        providerLeagueName: "2. Liga interregional",
      },
      database: {} as TeamMatchQueryDatabase,
      now: NOW,
    });

    expect(data.competition).toEqual({
      name: "2. Liga interregional",
      source: "PROVIDER_MAPPING",
    });
    expect(data.standings).toBeNull();
    expect(data.nextMatches).toHaveLength(1);
  });

  it("isolates standings failure from match data", async () => {
    mockFetchStandings.mockRejectedValue(new Error("SFV down"));

    const data = await getTeamCockpitSportingData({
      tenantId: TENANT_ID,
      teamId: TEAM_ID,
      teamSeasonId: TEAM_SEASON_ID,
      seasonKey: "2026-2027",
      teamDisplayName: "FC Test",
      sfvMapping: {
        externalTeamId: 123,
        externalSeasonId: 2027,
        providerLeagueName: "2. Liga interregional",
      },
      database: {} as TeamMatchQueryDatabase,
      now: NOW,
    });

    expect(data.standings).toBeNull();
    expect(data.competition?.name).toBe("2. Liga interregional");
    expect(data.nextMatches).toHaveLength(1);
    expect(data.results).toHaveLength(1);
  });
});

describe("TEAM-COCKPIT-PREMIUM-01C — loadCurrentSeasonSfvMapping", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null for cross-season mapping leakage", async () => {
    mockPrisma.teamExternalMapping.findFirst.mockResolvedValue({
      externalTeamId: 123,
      externalSeasonId: 2025,
      providerLeagueId: 10,
      providerLeagueName: "Old League",
      providerTeamName: "Old Team",
      lastSyncedAt: new Date("2024-01-01T00:00:00.000Z"),
      teamSeasonId: TEAM_SEASON_ID,
      provider: "SFV",
    });

    const mapping = await loadCurrentSeasonSfvMapping({
      tenantId: TENANT_ID,
      teamSeasonId: TEAM_SEASON_ID,
      seasonKey: "2026-2027",
    });

    expect(mapping).toBeNull();
  });

  it("returns season-aligned mapping for current TeamSeason", async () => {
    mockPrisma.teamExternalMapping.findFirst.mockResolvedValue({
      externalTeamId: 123,
      externalSeasonId: 2027,
      providerLeagueId: 10,
      providerLeagueName: "2. Liga interregional",
      providerTeamName: "FC Test",
      lastSyncedAt: new Date("2026-08-01T00:00:00.000Z"),
      teamSeasonId: TEAM_SEASON_ID,
      provider: "SFV",
    });

    const mapping = await loadCurrentSeasonSfvMapping({
      tenantId: TENANT_ID,
      teamSeasonId: TEAM_SEASON_ID,
      seasonKey: "2026-2027",
    });

    expect(mapping).toEqual({
      externalTeamId: 123,
      externalSeasonId: 2027,
      providerLeagueId: 10,
      providerLeagueName: "2. Liga interregional",
      providerTeamName: "FC Test",
      lastSyncedAt: new Date("2026-08-01T00:00:00.000Z"),
    });
  });

  it("scopes mapping lookup to tenant and current team season", async () => {
    mockPrisma.teamExternalMapping.findFirst.mockResolvedValue(null);

    await loadCurrentSeasonSfvMapping({
      tenantId: TENANT_ID,
      teamSeasonId: TEAM_SEASON_ID,
      seasonKey: "2026-2027",
    });

    expect(mockPrisma.teamExternalMapping.findFirst).toHaveBeenCalledWith({
      where: {
        tenantId: TENANT_ID,
        teamSeasonId: TEAM_SEASON_ID,
        provider: "SFV",
        providerIsActive: true,
      },
      select: expect.any(Object),
    });
  });
});

describe("TEAM-COCKPIT-PREMIUM-01E2 — loadCurrentSeasonSfvMappingsForList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("batch-loads season-safe providerLeagueName for multiple TeamSeason rows", async () => {
    mockPrisma.teamExternalMapping.findMany.mockResolvedValue([
      {
        externalTeamId: 123,
        externalSeasonId: 2027,
        providerLeagueId: 10,
        providerLeagueName: "2. Liga interregional",
        providerTeamName: "FC Test",
        lastSyncedAt: new Date("2026-08-01T00:00:00.000Z"),
        teamSeasonId: "ts-a",
        provider: "SFV",
      },
      {
        externalTeamId: 456,
        externalSeasonId: 2025,
        providerLeagueId: 11,
        providerLeagueName: "Old League",
        providerTeamName: "Old Team",
        lastSyncedAt: new Date("2024-01-01T00:00:00.000Z"),
        teamSeasonId: "ts-b",
        provider: "SFV",
      },
    ]);

    const mappings = await loadCurrentSeasonSfvMappingsForList({
      tenantId: TENANT_ID,
      entries: [
        { teamSeasonId: "ts-a", seasonKey: "2026-2027" },
        { teamSeasonId: "ts-b", seasonKey: "2026-2027" },
      ],
    });

    expect(mockPrisma.teamExternalMapping.findMany).toHaveBeenCalledTimes(1);
    expect(mappings.get("ts-a")).toEqual({ providerLeagueName: "2. Liga interregional" });
    expect(mappings.has("ts-b")).toBe(false);
  });
});
