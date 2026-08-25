import { describe, expect, it } from "vitest";
import {
  buildMatchcenterViewModel,
  normalizeMatchcenterActionFilter,
  normalizeMatchcenterTab,
  normalizeMatchcenterWochenplanFilter,
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

  it("excludes past stale SCHEDULED fixtures from Spielplanung when provider is still not played", () => {
    const stalePast = createMatch({
      id: "m-stale-past",
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
    const upcoming = createMatch({
      id: "m-upcoming",
      startAt: new Date("2026-09-10T10:00:00.000Z"),
    });

    const viewModel = buildMatchcenterViewModel([stalePast, upcoming], {
      now: new Date("2026-08-25T12:00:00.000Z"),
    });

    expect(viewModel.spielplanung.map((row) => row.match.id)).toEqual([
      "m-upcoming",
    ]);
    expect(viewModel.kpis.anstehend).toBe(1);
  });

  it("includes provider-completed matches in Resultate even when Event.status is SCHEDULED", () => {
    const providerCompleted = createMatch({
      id: "m-provider-completed",
      status: "SCHEDULED",
      startAt: new Date("2026-08-02T16:00:00.000Z"),
      scoreHome: 2,
      scoreAway: 1,
      synchronization: {
        eventLastSyncedAt: null,
        mappingLastSyncedAt: null,
        detailSyncedAt: null,
        providerMatchState: null,
        providerMatchStateName: "ausgetragen",
      },
    });

    const viewModel = buildMatchcenterViewModel([providerCompleted], {
      now: new Date("2026-08-25T12:00:00.000Z"),
    });

    expect(viewModel.resultate.map((match) => match.id)).toEqual([
      "m-provider-completed",
    ]);
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

  it("routes NEEDS_RECONCILIATION fixtures to the admin bucket only", () => {
    const stalePast = createMatch({
      id: "m-reconcile",
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

    const viewModel = buildMatchcenterViewModel([stalePast], {
      now: new Date("2026-08-25T12:00:00.000Z"),
    });

    expect(viewModel.needsReconciliation.map((row) => row.match.id)).toEqual([
      "m-reconcile",
    ]);
    expect(viewModel.spielplanung).toEqual([]);
    expect(viewModel.resultate).toEqual([]);
    expect(viewModel.kpis.anstehend).toBe(0);
    expect(viewModel.kpis.resultate).toBe(0);
  });

  it("excludes POSTPONED from Resultate and CANCELLED from all buckets", () => {
    const postponed = createMatch({
      id: "m-postponed",
      status: "POSTPONED",
      startAt: new Date("2026-09-05T16:00:00.000Z"),
      scoreHome: 0,
      scoreAway: 0,
    });
    const cancelled = createMatch({
      id: "m-cancelled",
      status: "CANCELLED",
      scoreHome: 0,
      scoreAway: 0,
    });

    const viewModel = buildMatchcenterViewModel([postponed, cancelled], {
      now: new Date("2026-08-25T12:00:00.000Z"),
    });

    expect(viewModel.resultate).toEqual([]);
    expect(viewModel.spielplanung.map((row) => row.match.id)).toEqual([
      "m-postponed",
    ]);
    expect(viewModel.needsReconciliation).toEqual([]);
  });

  it("excludes past postponed fixtures from Spielplanung (02.08-style regression)", () => {
    const pastPostponed = createMatch({
      id: "m-past-postponed",
      status: "POSTPONED",
      startAt: new Date("2026-08-02T16:00:00.000Z"),
      synchronization: {
        eventLastSyncedAt: null,
        mappingLastSyncedAt: null,
        detailSyncedAt: null,
        providerMatchState: null,
        providerMatchStateName: "verschoben",
      },
    });
    const futureUpcoming = createMatch({
      id: "m-future",
      startAt: new Date("2026-09-10T10:00:00.000Z"),
    });

    const viewModel = buildMatchcenterViewModel(
      [pastPostponed, futureUpcoming],
      { now: new Date("2026-08-25T12:00:00.000Z") },
    );

    expect(viewModel.spielplanung.map((row) => row.match.id)).toEqual([
      "m-future",
    ]);
    expect(viewModel.resultate).toEqual([]);
    expect(viewModel.needsReconciliation).toEqual([]);
    expect(viewModel.kpis.anstehend).toBe(1);
  });

  it("does not treat future 0:0 as a completed result", () => {
    const futurePlaceholder = createMatch({
      id: "m-future-zero",
      status: "SCHEDULED",
      startAt: new Date("2026-09-10T10:00:00.000Z"),
      scoreHome: 0,
      scoreAway: 0,
    });

    const viewModel = buildMatchcenterViewModel([futurePlaceholder], {
      now: new Date("2026-08-25T12:00:00.000Z"),
    });

    expect(viewModel.resultate).toEqual([]);
    expect(viewModel.spielplanung.map((row) => row.match.id)).toEqual([
      "m-future-zero",
    ]);
  });

  it("keeps KPI buckets mutually exclusive", () => {
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
    const reconcile = createMatch({
      id: "m-reconcile",
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

    const viewModel = buildMatchcenterViewModel(
      [open, ready, completed, reconcile],
      { now: new Date("2026-08-25T12:00:00.000Z") },
    );

    expect(viewModel.kpis).toEqual({
      anstehend: 2,
      offen: 1,
      bereit: 1,
      resultate: 1,
    });
    expect(viewModel.needsReconciliation).toHaveLength(1);
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

// ── PUB-WEEKPLAN-VISIBILITY-01 — Wochenplan filter ──────────────────────────

describe("normalizeMatchcenterWochenplanFilter", () => {
  it("accepts IM_WOCHENPLAN case-insensitively", () => {
    expect(normalizeMatchcenterWochenplanFilter("im_wochenplan")).toBe("IM_WOCHENPLAN");
    expect(normalizeMatchcenterWochenplanFilter("IM_WOCHENPLAN")).toBe("IM_WOCHENPLAN");
  });

  it("accepts NICHT_IM_WOCHENPLAN case-insensitively", () => {
    expect(normalizeMatchcenterWochenplanFilter("nicht_im_wochenplan")).toBe("NICHT_IM_WOCHENPLAN");
    expect(normalizeMatchcenterWochenplanFilter("NICHT_IM_WOCHENPLAN")).toBe("NICHT_IM_WOCHENPLAN");
  });

  it("defaults to ALLE for missing or invalid values", () => {
    expect(normalizeMatchcenterWochenplanFilter(undefined)).toBe("ALLE");
    expect(normalizeMatchcenterWochenplanFilter(null)).toBe("ALLE");
    expect(normalizeMatchcenterWochenplanFilter("garbage")).toBe("ALLE");
  });

  it("accepts ALLE explicitly", () => {
    expect(normalizeMatchcenterWochenplanFilter("alle")).toBe("ALLE");
    expect(normalizeMatchcenterWochenplanFilter("ALLE")).toBe("ALLE");
  });
});

describe("buildMatchcenterViewModel — wochenplanFilter", () => {
  function makeWochenplanMatch(
    id: string,
    wochenplanVisible: boolean,
    extra: Partial<MatchcenterMatchSummary> = {},
  ): MatchcenterMatchSummary {
    return createMatch({
      id,
      visibility: {
        websiteVisible: true,
        // infoboardVisible=true keeps HOME matches READY (assessMatchOperationalState
        // requires it for home-match operational completeness).
        infoboardVisible: true,
        homepageVisible: false,
        wochenplanVisible,
        trainingsplanVisible: false,
        teamPageVisible: false,
      },
      ...extra,
    });
  }

  it("ALLE returns all matches regardless of wochenplanVisible", () => {
    const visible = makeWochenplanMatch("m-vis", true);
    const hidden = makeWochenplanMatch("m-hid", false);

    const vm = buildMatchcenterViewModel([visible, hidden], {
      wochenplanFilter: "ALLE",
    });

    const ids = vm.spielplanung.map((r) => r.match.id).sort();
    expect(ids).toEqual(["m-hid", "m-vis"]);
  });

  it("IM_WOCHENPLAN returns only wochenplanVisible=true matches", () => {
    const visible = makeWochenplanMatch("m-vis", true);
    const hidden = makeWochenplanMatch("m-hid", false);

    const vm = buildMatchcenterViewModel([visible, hidden], {
      wochenplanFilter: "IM_WOCHENPLAN",
    });

    expect(vm.spielplanung.map((r) => r.match.id)).toEqual(["m-vis"]);
    expect(vm.kpis.anstehend).toBe(1);
  });

  it("NICHT_IM_WOCHENPLAN returns only wochenplanVisible=false matches", () => {
    const visible = makeWochenplanMatch("m-vis", true);
    const hidden = makeWochenplanMatch("m-hid", false);

    const vm = buildMatchcenterViewModel([visible, hidden], {
      wochenplanFilter: "NICHT_IM_WOCHENPLAN",
    });

    expect(vm.spielplanung.map((r) => r.match.id)).toEqual(["m-hid"]);
    expect(vm.kpis.anstehend).toBe(1);
  });

  it("wochenplanFilter=IM_WOCHENPLAN with no matching matches returns empty Spielplanung", () => {
    const hidden = makeWochenplanMatch("m-hid", false);

    const vm = buildMatchcenterViewModel([hidden], {
      wochenplanFilter: "IM_WOCHENPLAN",
    });

    expect(vm.spielplanung).toEqual([]);
    expect(vm.kpis.anstehend).toBe(0);
  });

  it("wochenplanFilter applies to Resultate as well as Spielplanung", () => {
    const visibleCompleted = makeWochenplanMatch("m-vis-done", true, {
      status: "COMPLETED",
    });
    const hiddenCompleted = makeWochenplanMatch("m-hid-done", false, {
      status: "COMPLETED",
    });

    const vm = buildMatchcenterViewModel([visibleCompleted, hiddenCompleted], {
      wochenplanFilter: "IM_WOCHENPLAN",
    });

    expect(vm.resultate.map((m) => m.id)).toEqual(["m-vis-done"]);
    expect(vm.kpis.resultate).toBe(1);
  });

  it("combining wochenplanFilter with actionFilter narrows the list correctly", () => {
    const openAndVisible = makeWochenplanMatch("m-open-vis", true, {
      operational: {
        pitchCode: null,
        homeDressingRoomCode: null,
        awayDressingRoomCode: null,
        meetingTime: null,
        remarks: null,
      },
    });
    const readyAndVisible = makeWochenplanMatch("m-ready-vis", true);
    const readyAndHidden = makeWochenplanMatch("m-ready-hid", false);

    const vm = buildMatchcenterViewModel(
      [openAndVisible, readyAndVisible, readyAndHidden],
      {
        wochenplanFilter: "IM_WOCHENPLAN",
        actionFilter: "ERLEDIGT",
      },
    );

    // IM_WOCHENPLAN keeps the 2 visible ones; ERLEDIGT of those keeps only ready
    expect(vm.spielplanung.map((r) => r.match.id)).toEqual(["m-ready-vis"]);
  });
});

describe("buildMatchcenterViewModel — teamFilter", () => {
  it("returns all matches when no team filter is set", () => {
    const teamA = createMatch({ id: "match-a", teamId: "team-a" });
    const teamB = createMatch({ id: "match-b", teamId: "team-b" });

    const vm = buildMatchcenterViewModel([teamA, teamB]);

    expect(vm.spielplanung.map((row) => row.match.id).sort()).toEqual([
      "match-a",
      "match-b",
    ]);
  });

  it("filters Spielplanung and Resultate by internal team id", () => {
    const teamAUpcoming = createMatch({ id: "up-a", teamId: "team-a" });
    const teamBUpcoming = createMatch({ id: "up-b", teamId: "team-b" });
    const teamACompleted = createMatch({
      id: "res-a",
      teamId: "team-a",
      status: "COMPLETED",
      scoreHome: 1,
      scoreAway: 0,
    });
    const teamBCompleted = createMatch({
      id: "res-b",
      teamId: "team-b",
      status: "COMPLETED",
      scoreHome: 2,
      scoreAway: 1,
    });

    const vm = buildMatchcenterViewModel(
      [teamAUpcoming, teamBUpcoming, teamACompleted, teamBCompleted],
      { teamFilter: "team-a" },
    );

    expect(vm.spielplanung.map((row) => row.match.id)).toEqual(["up-a"]);
    expect(vm.resultate.map((match) => match.id)).toEqual(["res-a"]);
    expect(vm.kpis.anstehend).toBe(1);
    expect(vm.kpis.resultate).toBe(1);
  });
});
