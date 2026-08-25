import { describe, expect, it } from "vitest";
import { buildSportingMatchcenterKpis } from "../counts";
import { buildSportingMatchView } from "../view";
import type { MatchcenterMatchSummary } from "@/lib/matchcenter/types";

const NOW = new Date("2026-08-25T12:00:00.000Z");

function createMatch(
  overrides: Partial<MatchcenterMatchSummary> = {},
): MatchcenterMatchSummary {
  return {
    id: overrides.id ?? "match-1",
    tenantId: "tenant-1",
    teamId: "team-1",
    seasonId: "season-2026-2027",
    type: "MATCH",
    title: "Match",
    description: null,
    status: "SCHEDULED",
    startAt: new Date("2026-09-05T16:00:00.000Z"),
    endAt: null,
    location: null,
    competitionLabel: null,
    homeAway: "HOME",
    resultLabel: null,
    intermediateResultLabel: null,
    scoreHome: null,
    scoreAway: null,
    home: {
      providerTeamId: 1,
      providerTeamName: "FCA",
      canonicalTeamId: "team-1",
      canonicalTeamName: "FCA",
      displayName: "FCA",
      resolution: "RESOLVED",
      isOwnTeam: true,
    },
    away: {
      providerTeamId: 2,
      providerTeamName: "Opp",
      canonicalTeamId: null,
      canonicalTeamName: null,
      displayName: "Opp",
      resolution: "UNRESOLVED",
      isOwnTeam: false,
    },
    source: {
      eventSource: "SFV",
      externalSource: "SFV",
      externalSourceId: "1",
      provider: "SFV",
      externalMatchId: 1,
      externalSeasonId: 2027,
      matchNumber: 1,
    },
    synchronization: {
      eventLastSyncedAt: null,
      mappingLastSyncedAt: null,
      detailSyncedAt: null,
      providerMatchState: null,
      providerMatchStateName: "noch nicht ausgetragen",
    },
    operational: {
      pitchCode: "KR2",
      homeDressingRoomCode: "G1",
      awayDressingRoomCode: "G2",
      meetingTime: null,
      remarks: null,
    },
    visibility: {
      websiteVisible: true,
      infoboardVisible: true,
      homepageVisible: false,
      wochenplanVisible: false,
      trainingsplanVisible: false,
      teamPageVisible: false,
    },
    reviewStage: "APPROVED",
    publishedAt: null,
    ...overrides,
  };
}

describe("buildSportingMatchcenterKpis", () => {
  it("15. Matchcenter count semantics with no overlap", () => {
    const upcomingOpen = buildSportingMatchView(
      createMatch({
        id: "upcoming-open",
        operational: {
          pitchCode: null,
          homeDressingRoomCode: null,
          awayDressingRoomCode: null,
          meetingTime: null,
          remarks: null,
        },
      }),
      { now: NOW },
    );
    const upcomingReady = buildSportingMatchView(
      createMatch({ id: "upcoming-ready" }),
      { now: NOW },
    );
    const completed = buildSportingMatchView(
      createMatch({
        id: "completed",
        status: "SCHEDULED",
        startAt: new Date("2026-08-02T16:00:00.000Z"),
        synchronization: {
          eventLastSyncedAt: null,
          mappingLastSyncedAt: null,
          detailSyncedAt: null,
          providerMatchState: null,
          providerMatchStateName: "ausgetragen",
        },
        scoreHome: 2,
        scoreAway: 1,
      }),
      { now: NOW },
    );
    const stalePast = buildSportingMatchView(
      createMatch({
        id: "stale",
        startAt: new Date("2026-08-02T16:00:00.000Z"),
      }),
      { now: NOW },
    );

    const kpis = buildSportingMatchcenterKpis(
      [
        {
          view: upcomingOpen,
          assessment: {
            status: "OPEN",
            actions: [{ key: "pitch", label: "Spielfeld" }],
            actionCount: 1,
            teamUnresolved: false,
          },
        },
        {
          view: upcomingReady,
          assessment: {
            status: "READY",
            actions: [],
            actionCount: 0,
            teamUnresolved: false,
          },
        },
      ],
      [completed],
    );

    expect(kpis).toEqual({
      anstehend: 2,
      offen: 1,
      bereit: 1,
      resultate: 1,
    });
    expect(stalePast.lifecycle).toBe("NEEDS_RECONCILIATION");
  });
});
