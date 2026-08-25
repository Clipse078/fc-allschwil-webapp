import { describe, expect, it } from "vitest";
import { matchBelongsToSeasonScope } from "../season-scope";
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
      displayName: "FC Allschwil",
      resolution: "RESOLVED",
      isOwnTeam: true,
    },
    away: {
      providerTeamId: 2,
      providerTeamName: "Gegner",
      canonicalTeamId: null,
      canonicalTeamName: null,
      displayName: "Gegner",
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
      providerMatchStateName: null,
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

const SCOPE_2026_2027 = {
  tenantId: "tenant-1",
  seasonId: "season-2026-2027",
  seasonKey: "2026/2027",
  teamId: "team-1",
  teamSeasonId: "ts-2026-2027",
};

describe("matchBelongsToSeasonScope", () => {
  it("9. rejects cross-tenant matches", () => {
    expect(
      matchBelongsToSeasonScope(
        createMatch({ tenantId: "tenant-other" }),
        SCOPE_2026_2027,
      ),
    ).toBe(false);
  });

  it("10. rejects cross-team matches", () => {
    expect(
      matchBelongsToSeasonScope(
        createMatch({ teamId: "team-other" }),
        SCOPE_2026_2027,
      ),
    ).toBe(false);
  });

  it("11. accepts matching tenant + team + season", () => {
    expect(matchBelongsToSeasonScope(createMatch(), SCOPE_2026_2027)).toBe(
      true,
    );
  });

  it("12. excludes previous-season matches via seasonId", () => {
    expect(
      matchBelongsToSeasonScope(
        createMatch({ seasonId: "season-2025-2026" }),
        SCOPE_2026_2027,
      ),
    ).toBe(false);
  });

  it("13. excludes next-season matches via externalSeasonId", () => {
    expect(
      matchBelongsToSeasonScope(
        createMatch({
          seasonId: null,
          source: {
            ...createMatch().source,
            externalSeasonId: 2028,
          },
        }),
        SCOPE_2026_2027,
      ),
    ).toBe(false);
  });
});
