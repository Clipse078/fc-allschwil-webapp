import { describe, expect, it } from "vitest";
import {
  buildMatchcenterViewModel,
  normalizeMatchcenterActionFilter,
  normalizeMatchcenterTab,
} from "../view-model";
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

describe("buildMatchcenterViewModel", () => {
  it("partitions COMPLETED matches into Resultate and everything else into Spielplanung", () => {
    const scheduled = createMatch({ id: "m-scheduled", status: "SCHEDULED" });
    const completed = createMatch({
      id: "m-completed",
      status: "COMPLETED",
      scoreHome: 2,
      scoreAway: 1,
    });

    const viewModel = buildMatchcenterViewModel([scheduled, completed]);

    expect(viewModel.spielplanung.map((r) => r.match.id)).toEqual([
      "m-scheduled",
    ]);
    expect(viewModel.resultate.map((m) => m.id)).toEqual(["m-completed"]);
  });

  it("K. Alle / Offen / Erledigt semantics are correct and completed matches never appear in either bucket", () => {
    const open = createMatch({
      id: "m-open",
      operational: {
        pitchCode: null,
        homeDressingRoomCode: null,
        awayDressingRoomCode: null,
        meetingTime: null,
        remarks: null,
      },
    });
    const ready = createMatch({ id: "m-ready" });
    const completed = createMatch({ id: "m-completed", status: "COMPLETED" });

    const alle = buildMatchcenterViewModel([open, ready, completed], {
      actionFilter: "ALLE",
    });
    expect(alle.spielplanung.map((r) => r.match.id).sort()).toEqual([
      "m-open",
      "m-ready",
    ]);

    const offen = buildMatchcenterViewModel([open, ready, completed], {
      actionFilter: "OFFEN",
    });
    expect(offen.spielplanung.map((r) => r.match.id)).toEqual(["m-open"]);

    const erledigt = buildMatchcenterViewModel([open, ready, completed], {
      actionFilter: "ERLEDIGT",
    });
    expect(erledigt.spielplanung.map((r) => r.match.id)).toEqual(["m-ready"]);
  });

  it("KPIs always reflect the full month population, independent of the active action filter", () => {
    const open = createMatch({
      id: "m-open",
      operational: {
        pitchCode: null,
        homeDressingRoomCode: null,
        awayDressingRoomCode: null,
        meetingTime: null,
        remarks: null,
      },
    });
    const ready = createMatch({ id: "m-ready" });
    const completed = createMatch({ id: "m-completed", status: "COMPLETED" });

    const viewModel = buildMatchcenterViewModel([open, ready, completed], {
      actionFilter: "OFFEN",
    });

    expect(viewModel.kpis).toEqual({
      anstehend: 2,
      offen: 1,
      bereit: 1,
      resultate: 1,
    });
  });

  it("does not count a completed match with historically missing allocations as Offen", () => {
    const completedIncomplete = createMatch({
      id: "m-completed-incomplete",
      status: "COMPLETED",
      operational: {
        pitchCode: null,
        homeDressingRoomCode: null,
        awayDressingRoomCode: null,
        meetingTime: null,
        remarks: null,
      },
    });

    const viewModel = buildMatchcenterViewModel([completedIncomplete]);

    expect(viewModel.kpis.offen).toBe(0);
    expect(viewModel.kpis.anstehend).toBe(0);
    expect(viewModel.kpis.resultate).toBe(1);
    expect(viewModel.spielplanung).toEqual([]);
  });

  it("sorts Spielplanung ascending and Resultate descending by kickoff", () => {
    const earlier = createMatch({
      id: "m-earlier",
      startAt: new Date("2026-09-01T10:00:00.000Z"),
    });
    const later = createMatch({
      id: "m-later",
      startAt: new Date("2026-09-10T10:00:00.000Z"),
    });
    const resultOlder = createMatch({
      id: "m-result-older",
      status: "COMPLETED",
      startAt: new Date("2026-09-01T10:00:00.000Z"),
    });
    const resultNewer = createMatch({
      id: "m-result-newer",
      status: "COMPLETED",
      startAt: new Date("2026-09-10T10:00:00.000Z"),
    });

    const viewModel = buildMatchcenterViewModel([
      later,
      earlier,
      resultOlder,
      resultNewer,
    ]);

    expect(viewModel.spielplanung.map((r) => r.match.id)).toEqual([
      "m-earlier",
      "m-later",
    ]);
    expect(viewModel.resultate.map((m) => m.id)).toEqual([
      "m-result-newer",
      "m-result-older",
    ]);
  });
});

describe("normalizeMatchcenterActionFilter", () => {
  it("accepts valid values case-insensitively", () => {
    expect(normalizeMatchcenterActionFilter("offen")).toBe("OFFEN");
    expect(normalizeMatchcenterActionFilter("ERLEDIGT")).toBe("ERLEDIGT");
  });

  it("defaults to ALLE for anything invalid or missing", () => {
    expect(normalizeMatchcenterActionFilter(undefined)).toBe("ALLE");
    expect(normalizeMatchcenterActionFilter("garbage")).toBe("ALLE");
  });
});

describe("normalizeMatchcenterTab", () => {
  it("accepts RESULTATE case-insensitively", () => {
    expect(normalizeMatchcenterTab("resultate")).toBe("RESULTATE");
  });

  it("defaults to SPIELPLANUNG for anything else", () => {
    expect(normalizeMatchcenterTab(undefined)).toBe("SPIELPLANUNG");
    expect(normalizeMatchcenterTab("garbage")).toBe("SPIELPLANUNG");
  });
});
