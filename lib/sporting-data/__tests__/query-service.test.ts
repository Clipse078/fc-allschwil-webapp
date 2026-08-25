import { describe, expect, it, vi } from "vitest";
import {
  listRecentResults,
  listTeamMatches,
  listUpcomingMatches,
} from "../query-service";
import type { SportingQueryDatabase } from "../query-service";

const NOW = new Date("2026-08-25T12:00:00.000Z");

function createEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: "event-1",
    tenantId: "tenant-1",
    seasonId: "season-2026-2027",
    teamId: "team-1",
    type: "MATCH",
    source: "SFV",
    status: "SCHEDULED",
    reviewStage: "APPROVED",
    reviewRequestedAt: null,
    reviewedAt: null,
    publishedAt: null,
    reviewNotes: null,
    title: "FCA – Gegner",
    description: null,
    location: "Im Brüel",
    startAt: new Date("2026-08-02T16:00:00.000Z"),
    endAt: null,
    externalSource: "SFV",
    externalSourceId: "1",
    lastSyncedAt: null,
    opponentName: "Gegner",
    organizerName: null,
    competitionLabel: "Meisterschaft",
    homeAway: "HOME",
    resultLabel: null,
    intermediateResultLabel: null,
    meetingTime: null,
    websiteVisible: true,
    infoboardVisible: true,
    homepageVisible: false,
    wochenplanVisible: false,
    trainingsplanVisible: false,
    teamPageVisible: false,
    remarks: null,
    pitchCode: null,
    homeDressingRoomCode: null,
    awayDressingRoomCode: null,
    team: {
      id: "team-1",
      name: "FC Allschwil",
      shortName: "FCA",
      alternativeName: null,
    },
    matchExternalMapping: {
      provider: "SFV",
      externalMatchId: 1,
      externalSeasonId: 2027,
      matchNumber: 1,
      providerHomeTeamId: 1,
      providerAwayTeamId: 2,
      providerHomeTeamName: "FC Allschwil",
      providerAwayTeamName: "Gegner",
      homeTeamId: "team-1",
      awayTeamId: null,
      providerMatchState: 1,
      providerMatchStateName: "ausgetragen",
      scoreHome: 2,
      scoreAway: 1,
      providerLeagueId: null,
      providerLeagueName: null,
      providerDivisionId: null,
      providerDivisionName: null,
      providerRoundNbr: null,
      providerOrganisationId: null,
      providerPlaygroundId: null,
      providerVenueName: null,
      providerSeasonName: "2026/2027",
      lastSyncedAt: new Date(),
      detailSyncedAt: null,
      homeTeam: {
        id: "team-1",
        name: "FC Allschwil",
        shortName: "FCA",
        alternativeName: null,
      },
      awayTeam: null,
      homeExternalTeam: null,
      awayExternalTeam: null,
    },
    ...overrides,
  };
}

function createDatabase(events: ReturnType<typeof createEvent>[]) {
  return {
    event: {
      findMany: vi.fn().mockResolvedValue(events),
      findFirst: vi.fn(),
    },
    teamSeason: {
      findFirst: vi.fn().mockResolvedValue({
        id: "ts-1",
        teamId: "team-1",
        seasonId: "season-2026-2027",
        team: { tenantId: "tenant-1" },
        season: { id: "season-2026-2027", key: "2026/2027" },
      }),
    },
    season: {
      findFirst: vi.fn().mockResolvedValue({
        id: "season-2026-2027",
        key: "2026/2027",
      }),
      findUnique: vi.fn().mockResolvedValue({
        id: "season-2026-2027",
        key: "2026/2027",
      }),
    },
  } as unknown as SportingQueryDatabase;
}

describe("sporting-data query-service", () => {
  it("listRecentResults returns provider-completed matches even when Event.status is SCHEDULED", async () => {
    const database = createDatabase([createEvent()]);

    const results = await listRecentResults(database, {
      tenantId: "tenant-1",
      teamSeasonId: "ts-1",
      now: NOW,
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.lifecycle).toBe("COMPLETED");
    expect(results[0]?.score.displayLabel).toBe("2:1");
  });

  it("listUpcomingMatches excludes past stale SCHEDULED fixtures", async () => {
    const database = createDatabase([
      createEvent({
        matchExternalMapping: {
          ...createEvent().matchExternalMapping,
          providerMatchStateName: "noch nicht ausgetragen",
          scoreHome: 0,
          scoreAway: 0,
        },
      }),
    ]);

    const upcoming = await listUpcomingMatches(database, {
      tenantId: "tenant-1",
      teamSeasonId: "ts-1",
      now: NOW,
    });

    expect(upcoming).toHaveLength(0);
  });

  it("listTeamMatches is tenant + season scoped", async () => {
    const database = createDatabase([
      createEvent({ tenantId: "tenant-other" }),
      createEvent({ seasonId: "season-2025-2026" }),
      createEvent(),
    ]);

    const matches = await listTeamMatches(database, {
      tenantId: "tenant-1",
      teamSeasonId: "ts-1",
      now: NOW,
    });

    expect(matches).toHaveLength(1);
    expect(matches[0]?.tenantId).toBe("tenant-1");
    expect(matches[0]?.seasonId).toBe("season-2026-2027");
  });
});
