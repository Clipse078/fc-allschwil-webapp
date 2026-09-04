import { describe, expect, it, vi } from "vitest";

import {
  listTeamSeasonMatches,
  resolveTeamMatchPerspectiveSide,
  type TeamMatchQueryDatabase,
} from "../team-match-query-service";

const TENANT_ID = "tenant-1";
const TEAM_ID = "team-own";
const OTHER_TEAM_ID = "team-other";
const TEAM_SEASON_ID = "team-season-1";
const OTHER_TEAM_SEASON_ID = "team-season-2";
const SEASON_ID = "season-2026-2027";
const OTHER_SEASON_ID = "season-2025-2026";
const NOW = new Date("2026-08-25T12:00:00.000Z");

function createTeamSeason(overrides: Record<string, unknown> = {}) {
  return {
    id: TEAM_SEASON_ID,
    teamId: TEAM_ID,
    seasonId: SEASON_ID,
    displayName: "FC Allschwil E1 2026/27",
    team: {
      id: TEAM_ID,
      name: "FC Allschwil E1",
      shortName: "E1",
      alternativeName: "Junioren E1",
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
    ...overrides,
  };
}

function createMapping(overrides: Record<string, unknown> = {}) {
  return {
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
    providerVenueName: "Im Brüel",
    homeTeam: {
      id: TEAM_ID,
      name: "FC Allschwil E1",
      shortName: "E1",
      alternativeName: "Junioren E1",
      tenantId: TENANT_ID,
    },
    awayTeam: null,
    homeExternalTeam: null,
    awayExternalTeam: {
      id: "external-away-1",
      name: "Opponent FC",
      shortName: null,
      alternativeName: null,
      logoUrl: "https://blob.vercel-storage.com/opponent-team.png",
      externalClub: {
        name: "Opponent FC",
        logoUrl: "https://blob.vercel-storage.com/opponent-club.png",
      },
    },
    ...overrides,
  };
}

function createEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: "event-1",
    tenantId: TENANT_ID,
    seasonId: SEASON_ID,
    teamId: TEAM_ID,
    type: "MATCH",
    status: "SCHEDULED",
    title: "FC Allschwil - Opponent",
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
      name: "FC Allschwil E1",
      shortName: "E1",
      alternativeName: "Junioren E1",
      tenantId: TENANT_ID,
    },
    matchExternalMapping: createMapping(),
    ...overrides,
  };
}

function createDatabase(input?: {
  teamSeason?: ReturnType<typeof createTeamSeason> | null;
  events?: ReturnType<typeof createEvent>[];
}) {
  const teamSeason =
    input !== undefined && "teamSeason" in input
      ? input.teamSeason
      : createTeamSeason();

  return {
    teamSeason: {
      findFirst: vi.fn().mockResolvedValue(teamSeason),
    },
    event: {
      findMany: vi.fn().mockResolvedValue(input?.events ?? []),
    },
  } satisfies TeamMatchQueryDatabase;
}

describe("resolveTeamMatchPerspectiveSide", () => {
  it("A. requested team is HOME via canonical mapping", () => {
    expect(
      resolveTeamMatchPerspectiveSide(
        { teamId: TEAM_ID, homeAway: "HOME" },
        { homeTeamId: TEAM_ID, awayTeamId: null },
        TEAM_ID,
      ),
    ).toBe("HOME");
  });

  it("B. requested team is AWAY via canonical mapping", () => {
    expect(
      resolveTeamMatchPerspectiveSide(
        { teamId: TEAM_ID, homeAway: "AWAY" },
        { homeTeamId: null, awayTeamId: TEAM_ID },
        TEAM_ID,
      ),
    ).toBe("AWAY");
  });

  it("returns null when canonical mapping does not include requested team", () => {
    expect(
      resolveTeamMatchPerspectiveSide(
        { teamId: TEAM_ID, homeAway: "HOME" },
        { homeTeamId: OTHER_TEAM_ID, awayTeamId: null },
        TEAM_ID,
      ),
    ).toBeNull();
  });
});

describe("listTeamSeasonMatches", () => {
  it("creates a tenant- and season-scoped canonical match query", async () => {
    const database = createDatabase();

    await listTeamSeasonMatches(database, {
      tenantId: TENANT_ID,
      teamSeasonId: TEAM_SEASON_ID,
      now: NOW,
    });

    expect(database.teamSeason.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: TEAM_SEASON_ID,
          team: { tenantId: TENANT_ID },
        },
      }),
    );

    expect(database.event.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId: TENANT_ID,
          type: "MATCH",
          seasonId: SEASON_ID,
          OR: [
            { matchExternalMapping: { homeTeamId: TEAM_ID } },
            { matchExternalMapping: { awayTeamId: TEAM_ID } },
            { teamId: TEAM_ID, matchExternalMapping: null },
          ],
        },
      }),
    );
  });

  it("PUB. websiteVisibleOnly restricts the canonical event query to websiteVisible=true", async () => {
    const database = createDatabase({
      events: [createEvent()],
    });

    await listTeamSeasonMatches(database, {
      tenantId: TENANT_ID,
      teamSeasonId: TEAM_SEASON_ID,
      now: NOW,
      websiteVisibleOnly: true,
    });

    expect(database.event.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          websiteVisible: true,
        }),
      }),
    );
  });

  it("A. exposes HOME perspective for mapped home fixtures", async () => {
    const database = createDatabase({
      events: [createEvent()],
    });

    const result = await listTeamSeasonMatches(database, {
      tenantId: TENANT_ID,
      teamSeasonId: TEAM_SEASON_ID,
      now: NOW,
    });

    expect(result.upcoming).toHaveLength(1);
    expect(result.upcoming[0]?.side).toBe("HOME");
    expect(result.upcoming[0]?.home.canonicalTeamId).toBe(TEAM_ID);
    expect(result.upcoming[0]?.away.canonicalExternalTeamId).toBe("external-away-1");
    expect(result.upcoming[0]?.away.clubName).toBe("Opponent FC");
    expect(result.upcoming[0]?.away.externalLogoUrl).toBe(
      "https://blob.vercel-storage.com/opponent-team.png",
    );
  });

  it("falls back from ExternalTeam.logoUrl to ExternalClub.logoUrl", async () => {
    const database = createDatabase({
      events: [
        createEvent({
          matchExternalMapping: createMapping({
            awayExternalTeam: {
              id: "external-away-fallback",
              name: "Fallback FC",
              shortName: null,
              alternativeName: null,
              logoUrl: null,
              externalClub: {
                name: "Fallback Club",
                logoUrl: "/fallback-club.svg",
              },
            },
          }),
        }),
      ],
    });

    const result = await listTeamSeasonMatches(database, {
      tenantId: TENANT_ID,
      teamSeasonId: TEAM_SEASON_ID,
      now: NOW,
    });

    expect(result.upcoming[0]?.away.externalLogoUrl).toBe("/fallback-club.svg");
    expect(result.upcoming[0]?.away.clubName).toBe("Fallback Club");
  });

  it("exposes null when neither external identity level has a crest", async () => {
    const database = createDatabase({
      events: [
        createEvent({
          matchExternalMapping: createMapping({
            awayExternalTeam: {
              id: "external-away-missing",
              name: "No Crest FC",
              shortName: null,
              alternativeName: null,
              logoUrl: null,
              externalClub: {
                name: "No Crest Club",
                logoUrl: null,
              },
            },
          }),
        }),
      ],
    });

    const result = await listTeamSeasonMatches(database, {
      tenantId: TENANT_ID,
      teamSeasonId: TEAM_SEASON_ID,
      now: NOW,
    });

    expect(result.upcoming[0]?.away.externalLogoUrl).toBeNull();
  });

  it("B. exposes AWAY perspective for mapped away fixtures", async () => {
    const database = createDatabase({
      events: [
        createEvent({
          homeAway: "AWAY",
          matchExternalMapping: createMapping({
            homeTeamId: null,
            awayTeamId: TEAM_ID,
            homeTeam: null,
            awayTeam: {
              id: TEAM_ID,
              name: "FC Allschwil E1",
              shortName: "E1",
              alternativeName: "Junioren E1",
              tenantId: TENANT_ID,
            },
            awayExternalTeam: null,
            homeExternalTeam: {
              id: "external-home-1",
              name: "Host FC",
              shortName: null,
              alternativeName: null,
              logoUrl: null,
              externalClub: {
                name: "Host FC",
                logoUrl: "https://blob.vercel-storage.com/host-club.png",
              },
            },
          }),
        }),
      ],
    });

    const result = await listTeamSeasonMatches(database, {
      tenantId: TENANT_ID,
      teamSeasonId: TEAM_SEASON_ID,
      now: NOW,
    });

    expect(result.upcoming).toHaveLength(1);
    expect(result.upcoming[0]?.side).toBe("AWAY");
    expect(result.upcoming[0]?.away.canonicalTeamId).toBe(TEAM_ID);
    expect(result.upcoming[0]?.away.externalLogoUrl).toBeNull();
    expect(result.upcoming[0]?.home.externalLogoUrl).toBe(
      "https://blob.vercel-storage.com/host-club.png",
    );
  });

  it("C. excludes unrelated team matches even when opponent labels match", async () => {
    const database = createDatabase({
      events: [
        createEvent({
          id: "event-unrelated",
          opponentName: "FC Allschwil E1",
          matchExternalMapping: createMapping({
            homeTeamId: OTHER_TEAM_ID,
            awayTeamId: null,
            homeTeam: {
              id: OTHER_TEAM_ID,
              name: "Other Team",
              shortName: null,
              alternativeName: null,
              tenantId: TENANT_ID,
            },
          }),
        }),
      ],
    });

    const result = await listTeamSeasonMatches(database, {
      tenantId: TENANT_ID,
      teamSeasonId: TEAM_SEASON_ID,
      now: NOW,
    });

    expect(result.upcoming).toHaveLength(0);
    expect(result.completed).toHaveLength(0);
  });

  it("D. different tenant excluded", async () => {
    const database = createDatabase({
      teamSeason: null,
      events: [createEvent({ tenantId: "tenant-other" })],
    });

    await expect(
      listTeamSeasonMatches(database, {
        tenantId: "tenant-other",
        teamSeasonId: TEAM_SEASON_ID,
        now: NOW,
      }),
    ).rejects.toThrow("TeamSeason not found for tenant.");

    const scopedDatabase = createDatabase({
      events: [createEvent({ tenantId: "tenant-other" })],
    });

    await listTeamSeasonMatches(scopedDatabase, {
      tenantId: TENANT_ID,
      teamSeasonId: TEAM_SEASON_ID,
      now: NOW,
    });

    expect(scopedDatabase.event.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: TENANT_ID,
        }),
      }),
    );
  });

  it("E. excludes matches from a different season", async () => {
    const database = createDatabase({
      events: [
        createEvent({
          id: "event-other-season",
          seasonId: OTHER_SEASON_ID,
        }),
      ],
    });

    await listTeamSeasonMatches(database, {
      tenantId: TENANT_ID,
      teamSeasonId: TEAM_SEASON_ID,
      now: NOW,
    });

    expect(database.event.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          seasonId: SEASON_ID,
        }),
      }),
    );
  });

  it("F. sorts upcoming matches ascending", async () => {
    const database = createDatabase({
      events: [
        createEvent({
          id: "event-later",
          startAt: new Date("2026-09-01T18:00:00.000Z"),
        }),
        createEvent({
          id: "event-earlier",
          startAt: new Date("2026-08-26T18:00:00.000Z"),
        }),
      ],
    });

    const result = await listTeamSeasonMatches(database, {
      tenantId: TENANT_ID,
      teamSeasonId: TEAM_SEASON_ID,
      now: NOW,
    });

    expect(result.upcoming.map((match) => match.eventId)).toEqual([
      "event-earlier",
      "event-later",
    ]);
  });

  it("G. sorts completed matches descending", async () => {
    const database = createDatabase({
      events: [
        createEvent({
          id: "event-older",
          status: "COMPLETED",
          startAt: new Date("2026-07-01T18:00:00.000Z"),
          matchExternalMapping: createMapping({
            scoreHome: 1,
            scoreAway: 0,
            providerMatchStateName: "ausgetragen",
          }),
        }),
        createEvent({
          id: "event-newer",
          status: "COMPLETED",
          startAt: new Date("2026-08-01T18:00:00.000Z"),
          matchExternalMapping: createMapping({
            scoreHome: 2,
            scoreAway: 1,
            providerMatchStateName: "ausgetragen",
          }),
        }),
      ],
    });

    const result = await listTeamSeasonMatches(database, {
      tenantId: TENANT_ID,
      teamSeasonId: TEAM_SEASON_ID,
      now: NOW,
    });

    expect(result.completed.map((match) => match.eventId)).toEqual([
      "event-newer",
      "event-older",
    ]);
  });

  it("H. future SCHEDULED 0:0 is not a result", async () => {
    const database = createDatabase({
      events: [
        createEvent({
          startAt: new Date("2026-09-01T18:00:00.000Z"),
          matchExternalMapping: createMapping({
            scoreHome: 0,
            scoreAway: 0,
          }),
        }),
      ],
    });

    const result = await listTeamSeasonMatches(database, {
      tenantId: TENANT_ID,
      teamSeasonId: TEAM_SEASON_ID,
      now: NOW,
    });

    expect(result.upcoming).toHaveLength(1);
    expect(result.completed).toHaveLength(0);
    expect(result.upcoming[0]?.resultLabel).toBeNull();
  });

  it("I. POSTPONED does not become a fake result", async () => {
    const database = createDatabase({
      events: [
        createEvent({
          status: "POSTPONED",
          matchExternalMapping: createMapping({
            providerMatchStateName: "verschoben",
            scoreHome: 0,
            scoreAway: 0,
          }),
        }),
      ],
    });

    const result = await listTeamSeasonMatches(database, {
      tenantId: TENANT_ID,
      teamSeasonId: TEAM_SEASON_ID,
      now: NOW,
    });

    expect(result.upcoming).toHaveLength(1);
    expect(result.completed).toHaveLength(0);
    expect(result.upcoming[0]?.resultLabel).toBeNull();
    expect(result.upcoming[0]?.lifecycle).toBe("POSTPONED");
  });

  it("I2. past POSTPONED without replacement kickoff is excluded from upcoming", async () => {
    const database = createDatabase({
      events: [
        createEvent({
          id: "past-postponed",
          status: "POSTPONED",
          startAt: new Date("2026-08-02T12:00:00.000Z"),
          matchExternalMapping: createMapping({
            providerMatchStateName: "verschoben",
            scoreHome: 0,
            scoreAway: 0,
          }),
        }),
      ],
    });

    const result = await listTeamSeasonMatches(database, {
      tenantId: TENANT_ID,
      teamSeasonId: TEAM_SEASON_ID,
      now: NOW,
    });

    expect(result.upcoming).toHaveLength(0);
    expect(result.completed).toHaveLength(0);
  });

  it("J. CANCELED/CANCELLED does not become a fake result", async () => {
    const database = createDatabase({
      events: [
        createEvent({
          id: "event-canceled",
          status: "CANCELED",
          matchExternalMapping: createMapping({
            providerMatchStateName: "abgesagt",
            scoreHome: 0,
            scoreAway: 0,
          }),
        }),
        createEvent({
          id: "event-cancelled",
          status: "CANCELLED",
          matchExternalMapping: createMapping({
            providerMatchStateName: "abgesagt",
            scoreHome: 0,
            scoreAway: 0,
          }),
        }),
      ],
    });

    const result = await listTeamSeasonMatches(database, {
      tenantId: TENANT_ID,
      teamSeasonId: TEAM_SEASON_ID,
      now: NOW,
    });

    expect(result.completed).toHaveLength(0);
    expect(result.upcoming).toHaveLength(2);
    expect(result.upcoming.every((match) => match.resultLabel === null)).toBe(true);
  });

  it("K. completed real score is exposed", async () => {
    const database = createDatabase({
      events: [
        createEvent({
          status: "COMPLETED",
          startAt: new Date("2026-07-01T18:00:00.000Z"),
          matchExternalMapping: createMapping({
            scoreHome: 3,
            scoreAway: 1,
            providerMatchStateName: "ausgetragen",
          }),
        }),
      ],
    });

    const result = await listTeamSeasonMatches(database, {
      tenantId: TENANT_ID,
      teamSeasonId: TEAM_SEASON_ID,
      now: NOW,
    });

    expect(result.completed).toHaveLength(1);
    expect(result.completed[0]?.resultLabel).toBe("3:1");
    expect(result.completed[0]?.scoreHome).toBe(3);
    expect(result.completed[0]?.scoreAway).toBe(1);
  });

  it("partitions a Stage-shaped lifecycle dataset without bucket overlap", async () => {
    const future = new Date("2026-09-01T18:00:00.000Z");
    const past = new Date("2026-08-01T18:00:00.000Z");
    const database = createDatabase({
      events: [
        createEvent({
          id: "future-provider-not-played-0-0",
          status: "COMPLETED",
          startAt: future,
          resultLabel: "0:0",
          matchExternalMapping: createMapping({
            providerMatchStateName: "noch nicht ausgetragen",
            scoreHome: 0,
            scoreAway: 0,
          }),
        }),
        createEvent({
          id: "future-scheduled-null-score",
          startAt: new Date("2026-09-02T18:00:00.000Z"),
          matchExternalMapping: createMapping({
            providerMatchStateName: "angesetzt",
            scoreHome: null,
            scoreAway: null,
          }),
        }),
        createEvent({
          id: "completed-draw-0-0",
          status: "COMPLETED",
          startAt: past,
          resultLabel: "0:0",
          matchExternalMapping: createMapping({
            providerMatchStateName: "ausgetragen",
            scoreHome: 0,
            scoreAway: 0,
          }),
        }),
        createEvent({
          id: "completed-home-win",
          status: "COMPLETED",
          startAt: new Date("2026-07-01T18:00:00.000Z"),
          resultLabel: "3:1",
          matchExternalMapping: createMapping({
            providerMatchStateName: "ausgetragen",
            scoreHome: 3,
            scoreAway: 1,
          }),
        }),
        createEvent({
          id: "cancelled",
          status: "CANCELLED",
          startAt: new Date("2026-09-03T18:00:00.000Z"),
          matchExternalMapping: createMapping({
            providerMatchStateName: "abgesagt",
            scoreHome: 0,
            scoreAway: 0,
          }),
        }),
        createEvent({
          id: "postponed",
          status: "POSTPONED",
          startAt: new Date("2026-09-04T18:00:00.000Z"),
          matchExternalMapping: createMapping({
            providerMatchStateName: "verschoben",
            scoreHome: 0,
            scoreAway: 0,
          }),
        }),
      ],
    });

    const result = await listTeamSeasonMatches(database, {
      tenantId: TENANT_ID,
      teamSeasonId: TEAM_SEASON_ID,
      now: NOW,
    });
    const upcomingIds = result.upcoming.map((match) => match.eventId);
    const completedIds = result.completed.map((match) => match.eventId);

    expect(upcomingIds).toEqual(
      expect.arrayContaining([
        "future-provider-not-played-0-0",
        "future-scheduled-null-score",
        "cancelled",
        "postponed",
      ]),
    );
    expect(completedIds).toEqual([
      "completed-draw-0-0",
      "completed-home-win",
    ]);
    expect(completedIds).not.toContain("future-provider-not-played-0-0");
    expect(new Set([...upcomingIds, ...completedIds]).size).toBe(
      upcomingIds.length + completedIds.length,
    );
    expect(
      result.upcoming.find(
        (match) => match.eventId === "future-provider-not-played-0-0",
      ),
    ).toEqual(
      expect.objectContaining({
        lifecycle: "UPCOMING",
        resultLabel: null,
        scoreHome: 0,
        scoreAway: 0,
      }),
    );
  });

  it("L. opponent resolves correctly for HOME perspective", async () => {
    const database = createDatabase({
      events: [createEvent()],
    });

    const result = await listTeamSeasonMatches(database, {
      tenantId: TENANT_ID,
      teamSeasonId: TEAM_SEASON_ID,
      now: NOW,
    });

    expect(result.upcoming[0]?.opponent).toEqual({
      displayName: "Opponent FC",
      canonicalTeamId: null,
      canonicalExternalTeamId: "external-away-1",
      providerTeamId: 200,
      providerTeamName: "Provider Away",
    });
  });

  it("M. opponent resolves correctly for AWAY perspective", async () => {
    const database = createDatabase({
      events: [
        createEvent({
          homeAway: "AWAY",
          matchExternalMapping: createMapping({
            homeTeamId: null,
            awayTeamId: TEAM_ID,
            homeTeam: null,
            awayTeam: {
              id: TEAM_ID,
              name: "FC Allschwil E1",
              shortName: "E1",
              alternativeName: "Junioren E1",
              tenantId: TENANT_ID,
            },
            homeExternalTeam: {
              id: "external-home-1",
              name: "Host FC",
              shortName: null,
              alternativeName: null,
              logoUrl: null,
              externalClub: {
                name: "Host FC",
                logoUrl: "https://blob.vercel-storage.com/host-club.png",
              },
            },
            awayExternalTeam: null,
          }),
        }),
      ],
    });

    const result = await listTeamSeasonMatches(database, {
      tenantId: TENANT_ID,
      teamSeasonId: TEAM_SEASON_ID,
      now: NOW,
    });

    expect(result.upcoming[0]?.opponent.displayName).toBe("Host FC");
    expect(result.upcoming[0]?.opponent.canonicalExternalTeamId).toBe("external-home-1");
  });

  it("N. provider-name fallback works when canonical opponent presentation data is unavailable", async () => {
    const database = createDatabase({
      events: [
        createEvent({
          matchExternalMapping: createMapping({
            awayExternalTeam: null,
            providerAwayTeamName: "Provider Fallback Away",
          }),
        }),
      ],
    });

    const result = await listTeamSeasonMatches(database, {
      tenantId: TENANT_ID,
      teamSeasonId: TEAM_SEASON_ID,
      now: NOW,
    });

    expect(result.upcoming[0]?.away.displayName).toBe("Provider Fallback Away");
    expect(result.upcoming[0]?.opponent.displayName).toBe("Provider Fallback Away");
  });

  it("O. empty dataset returns clean empty arrays", async () => {
    const database = createDatabase({ events: [] });

    const result = await listTeamSeasonMatches(database, {
      tenantId: TENANT_ID,
      teamSeasonId: TEAM_SEASON_ID,
      now: NOW,
    });

    expect(result).toEqual({
      upcoming: [],
      completed: [],
    });
  });

  it("exposes canonical competition context from TeamSeasonCompetition", async () => {
    const database = createDatabase({
      events: [createEvent()],
    });

    const result = await listTeamSeasonMatches(database, {
      tenantId: TENANT_ID,
      teamSeasonId: TEAM_SEASON_ID,
      now: NOW,
    });

    expect(result.upcoming[0]?.competition).toEqual({
      eventCompetitionLabel: "Junioren E",
      providerLeagueId: 10,
      providerLeagueName: "League",
      providerDivisionId: 20,
      providerDivisionName: "Division",
      providerRoundNumber: 3,
      canonicalCompetitionId: "competition-1",
      canonicalCompetitionName: "Junioren E",
      canonicalCompetitionShortName: "JE",
    });
  });

  it("supports manual matches without external mapping via Event.teamId", async () => {
    const database = createDatabase({
      events: [
        createEvent({
          matchExternalMapping: null,
          homeAway: "HOME",
        }),
      ],
    });

    const result = await listTeamSeasonMatches(database, {
      tenantId: TENANT_ID,
      teamSeasonId: TEAM_SEASON_ID,
      now: NOW,
    });

    expect(result.upcoming).toHaveLength(1);
    expect(result.upcoming[0]?.side).toBe("HOME");
    expect(result.upcoming[0]?.provider.provider).toBeNull();
  });

  it("excludes stale past SCHEDULED fixtures from upcoming and completed", async () => {
    const database = createDatabase({
      events: [
        createEvent({
          id: "event-stale-past",
          status: "SCHEDULED",
          startAt: new Date("2026-08-01T18:00:00.000Z"),
          matchExternalMapping: createMapping({
            providerMatchStateName: "Geplant",
            scoreHome: null,
            scoreAway: null,
          }),
        }),
        createEvent({
          id: "event-future-scheduled",
          status: "SCHEDULED",
          startAt: new Date("2026-09-10T18:00:00.000Z"),
          matchExternalMapping: createMapping({
            externalMatchId: 9002,
            providerMatchStateName: "Geplant",
            scoreHome: null,
            scoreAway: null,
          }),
        }),
      ],
    });

    const result = await listTeamSeasonMatches(database, {
      tenantId: TENANT_ID,
      teamSeasonId: TEAM_SEASON_ID,
      now: NOW,
    });

    expect(result.upcoming.map((match) => match.eventId)).toEqual([
      "event-future-scheduled",
    ]);
    expect(result.completed).toHaveLength(0);
  });

  it("includes LIVE fixtures in upcoming even when kickoff is in the past", async () => {
    const database = createDatabase({
      events: [
        createEvent({
          status: "LIVE",
          startAt: new Date("2026-08-20T18:00:00.000Z"),
          matchExternalMapping: createMapping({
            providerMatchStateName: "läuft",
          }),
        }),
      ],
    });

    const result = await listTeamSeasonMatches(database, {
      tenantId: TENANT_ID,
      teamSeasonId: TEAM_SEASON_ID,
      now: NOW,
    });

    expect(result.upcoming).toHaveLength(1);
    expect(result.upcoming[0]?.lifecycle).toBe("LIVE");
    expect(result.completed).toHaveLength(0);
  });

  it("isolates different team seasons for the same Team entity", async () => {
    const database = createDatabase({
      teamSeason: createTeamSeason({
        id: OTHER_TEAM_SEASON_ID,
        seasonId: OTHER_SEASON_ID,
        season: {
          id: OTHER_SEASON_ID,
          key: "2025-2026",
          name: "Saison 2025/26",
        },
      }),
      events: [
        createEvent({
          seasonId: OTHER_SEASON_ID,
        }),
      ],
    });

    await listTeamSeasonMatches(database, {
      tenantId: TENANT_ID,
      teamSeasonId: OTHER_TEAM_SEASON_ID,
      now: NOW,
    });

    expect(database.event.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          seasonId: OTHER_SEASON_ID,
        }),
      }),
    );
  });
});
