import { describe, expect, it } from "vitest";
import { buildSportingMatchView } from "../view";
import type { MatchcenterMatchSummary } from "@/lib/matchcenter/types";

function createMatch(
  overrides: Partial<MatchcenterMatchSummary> = {},
): MatchcenterMatchSummary {
  return {
    id: "match-1",
    tenantId: "tenant-1",
    teamId: "team-1",
    seasonId: "season-2026-2027",
    type: "MATCH",
    title: "FC Allschwil – Gegner",
    description: null,
    status: "SCHEDULED",
    startAt: new Date("2026-09-05T16:00:00.000Z"),
    endAt: null,
    location: "Im Brüel",
    competitionLabel: "Meisterschaft",
    homeAway: "HOME",
    resultLabel: null,
    intermediateResultLabel: null,
    scoreHome: null,
    scoreAway: null,
    home: {
      providerTeamId: 1,
      providerTeamName: "FC Allschwil",
      canonicalTeamId: "team-1",
      canonicalTeamName: "FC Allschwil",
      canonicalTeamShortName: "FCA",
      displayName: "FC Allschwil",
      resolution: "RESOLVED",
      isOwnTeam: true,
    },
    away: {
      providerTeamId: 2,
      providerTeamName: "Gegner FC",
      canonicalTeamId: null,
      canonicalTeamName: null,
      displayName: "Gegner FC",
      resolution: "UNRESOLVED",
      isOwnTeam: false,
      externalLogoUrl: "https://example.com/opponent.png",
    },
    source: {
      eventSource: "SFV",
      externalSource: "SFV",
      externalSourceId: "1",
      provider: "SFV",
      externalMatchId: 42,
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
      pitchCode: null,
      homeDressingRoomCode: null,
      awayDressingRoomCode: null,
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

describe("buildSportingMatchView", () => {
  it("14. preserves canonical opponent/home-away identity", () => {
    const view = buildSportingMatchView(createMatch(), {
      tenantLogoUrl: "https://example.com/tenant.png",
    });

    expect(view.homeTeam.isOwnTeam).toBe(true);
    expect(view.awayTeam.isOwnTeam).toBe(false);
    expect(view.opponent.displayName).toBe("Gegner FC");
    expect(view.opponent.logoUrl).toBe("https://example.com/opponent.png");
    expect(view.homeAway).toBe("HOME");
    expect(view.externalMatchId).toBe(42);
  });

  it("does not leak provider metadata beyond public-safe fields", () => {
    const view = buildSportingMatchView(createMatch());

    expect(view).not.toHaveProperty("providerMatchStateName");
    expect(view.match.synchronization.providerMatchStateName).toBe(
      "noch nicht ausgetragen",
    );
  });
});
