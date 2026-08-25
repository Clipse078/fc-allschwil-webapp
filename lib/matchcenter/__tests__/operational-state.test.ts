import { describe, expect, it } from "vitest";
import {
  assessMatchOperationalState,
  isMatchOperationallyActionable,
  isMatchOperationallyOpen,
} from "../operational-state";
import type { MatchcenterMatchSummary, MatchcenterSide } from "../types";

function side(overrides: Partial<MatchcenterSide> = {}): MatchcenterSide {
  return {
    providerTeamId: 1,
    providerTeamName: "Provider Team",
    canonicalTeamId: "team-1",
    canonicalTeamName: "FC Allschwil B2",
    displayName: "FC Allschwil B2",
    resolution: "RESOLVED",
    isOwnTeam: true,
    ...overrides,
  };
}

function createMatch(
  overrides: Partial<MatchcenterMatchSummary> = {},
): MatchcenterMatchSummary {
  return {
    id: "match-1",
    tenantId: "tenant-1",
    teamId: "team-1",
    seasonId: "season-2026-2027",
    type: "MATCH",
    title: "FC Allschwil B2 – Gegner",
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
    home: side({ isOwnTeam: true }),
    away: side({
      canonicalTeamId: null,
      canonicalTeamName: null,
      displayName: "Gegner FC",
      resolution: "UNRESOLVED",
      isOwnTeam: false,
    }),
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

describe("isMatchOperationallyActionable", () => {
  it("returns false for past completed matches", () => {
    const match = createMatch({
      status: "COMPLETED",
      startAt: new Date("2026-08-24T16:00:00.000Z"),
    });

    expect(
      isMatchOperationallyActionable(match, new Date("2026-08-25T12:00:00.000Z")),
    ).toBe(false);
  });

  it("returns true for future home matches", () => {
    const match = createMatch({
      status: "SCHEDULED",
      startAt: new Date("2026-09-10T10:00:00.000Z"),
    });

    expect(
      isMatchOperationallyActionable(match, new Date("2026-08-25T12:00:00.000Z")),
    ).toBe(true);
  });

  it("returns false for past unresolved fixtures without inventing completion", () => {
    const match = createMatch({
      status: "SCHEDULED",
      startAt: new Date("2026-08-02T16:00:00.000Z"),
      synchronization: {
        eventLastSyncedAt: null,
        mappingLastSyncedAt: null,
        detailSyncedAt: null,
        providerMatchState: null,
        providerMatchStateName: "noch nicht ausgetragen",
      },
    });

    expect(
      isMatchOperationallyActionable(match, new Date("2026-08-25T12:00:00.000Z")),
    ).toBe(false);
    expect(assessMatchOperationalState(match, new Date("2026-08-25T12:00:00.000Z"))
      .status).toBe("NOT_APPLICABLE");
  });
});

describe("assessMatchOperationalState — MATCHCENTER-UX-01 §10 hard rule", () => {
  it("D. a COMPLETED match with missing pitch/dressing rooms has ZERO open actions", () => {
    const match = createMatch({
      status: "COMPLETED",
      operational: {
        pitchCode: null,
        homeDressingRoomCode: null,
        awayDressingRoomCode: null,
        meetingTime: null,
        remarks: null,
      },
      visibility: {
        websiteVisible: true,
        infoboardVisible: false,
        homepageVisible: false,
        wochenplanVisible: false,
        trainingsplanVisible: false,
        teamPageVisible: false,
      },
      home: side({ isOwnTeam: true, resolution: "RESOLVED" }),
    });

    const assessment = assessMatchOperationalState(match);

    expect(assessment.status).toBe("NOT_APPLICABLE");
    expect(assessment.actionCount).toBe(0);
    expect(assessment.actions).toEqual([]);
    expect(isMatchOperationallyOpen(match)).toBe(false);
  });

  it("a POSTPONED match with missing setup also has zero open actions", () => {
    const match = createMatch({
      status: "POSTPONED",
      operational: {
        pitchCode: null,
        homeDressingRoomCode: null,
        awayDressingRoomCode: null,
        meetingTime: null,
        remarks: null,
      },
    });

    expect(assessMatchOperationalState(match).status).toBe("NOT_APPLICABLE");
  });

  it("a CANCELED match with missing setup also has zero open actions", () => {
    const match = createMatch({
      status: "CANCELED",
      operational: {
        pitchCode: null,
        homeDressingRoomCode: null,
        awayDressingRoomCode: null,
        meetingTime: null,
        remarks: null,
      },
    });

    expect(assessMatchOperationalState(match).status).toBe("NOT_APPLICABLE");
  });
});

describe("assessMatchOperationalState — future HOME matches", () => {
  it("E. a future HOME match missing setup produces open actions", () => {
    const match = createMatch({
      status: "SCHEDULED",
      homeAway: "HOME",
      operational: {
        pitchCode: null,
        homeDressingRoomCode: null,
        awayDressingRoomCode: "G2",
        meetingTime: null,
        remarks: null,
      },
    });

    const assessment = assessMatchOperationalState(match);

    expect(assessment.status).toBe("OPEN");
    expect(assessment.actionCount).toBe(2);
    expect(assessment.actions.map((a) => a.label)).toEqual([
      "Spielfeld",
      "Heimkabine",
    ]);
    expect(isMatchOperationallyOpen(match)).toBe(true);
  });

  it("F. a fully set-up future HOME match is READY", () => {
    const match = createMatch({ status: "SCHEDULED", homeAway: "HOME" });

    const assessment = assessMatchOperationalState(match);

    expect(assessment.status).toBe("READY");
    expect(assessment.actionCount).toBe(0);
  });
});

describe("assessMatchOperationalState — away matches", () => {
  it("G. an away match does not receive pitch/dressing-room warnings", () => {
    const match = createMatch({
      status: "SCHEDULED",
      homeAway: "AWAY",
      home: side({
        canonicalTeamId: null,
        canonicalTeamName: null,
        resolution: "UNRESOLVED",
        isOwnTeam: false,
      }),
      away: side({ isOwnTeam: true, resolution: "RESOLVED" }),
      operational: {
        pitchCode: null,
        homeDressingRoomCode: null,
        awayDressingRoomCode: null,
        meetingTime: null,
        remarks: null,
      },
    });

    const assessment = assessMatchOperationalState(match);

    expect(assessment.status).toBe("AWAY");
    expect(assessment.actionCount).toBe(0);
    expect(assessment.actions).toEqual([]);
  });

  it("an away match with a genuinely unresolved FCA side still warns (TEAM-SFV-MAPPING-05)", () => {
    const match = createMatch({
      status: "SCHEDULED",
      homeAway: "AWAY",
      home: side({ isOwnTeam: false, resolution: "RESOLVED" }),
      away: side({
        canonicalTeamId: null,
        canonicalTeamName: null,
        resolution: "UNRESOLVED",
        isOwnTeam: true,
      }),
    });

    const assessment = assessMatchOperationalState(match);

    expect(assessment.status).toBe("OPEN");
    expect(assessment.teamUnresolved).toBe(true);
    expect(assessment.actions.map((a) => a.label)).toContain(
      "Team nicht zugeordnet",
    );
  });
});

describe("assessMatchOperationalState — TEAM-SFV-MAPPING-05 semantics", () => {
  it("H. an unmapped external opponent never produces a team-assignment warning when the FCA side resolves", () => {
    const match = createMatch({
      status: "SCHEDULED",
      homeAway: "HOME",
      home: side({ isOwnTeam: true, resolution: "RESOLVED" }),
      away: side({
        canonicalTeamId: null,
        canonicalTeamName: null,
        resolution: "UNRESOLVED",
        isOwnTeam: false,
      }),
    });

    const assessment = assessMatchOperationalState(match);

    expect(assessment.teamUnresolved).toBe(false);
    expect(assessment.actions.map((a) => a.key)).not.toContain("team");
  });

  it("I. an unresolved FCA home side produces the team-assignment warning even if the opponent is mapped", () => {
    const match = createMatch({
      status: "SCHEDULED",
      homeAway: "HOME",
      home: side({
        canonicalTeamId: null,
        canonicalTeamName: null,
        resolution: "UNRESOLVED",
        isOwnTeam: false,
      }),
      away: side({ isOwnTeam: false, resolution: "RESOLVED" }),
    });

    const assessment = assessMatchOperationalState(match);

    expect(assessment.teamUnresolved).toBe(true);
    expect(assessment.actions.map((a) => a.label)).toContain(
      "Team nicht zugeordnet",
    );
  });
});
