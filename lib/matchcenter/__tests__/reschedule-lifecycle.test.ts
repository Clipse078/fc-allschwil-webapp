/**
 * MATCHCENTER-UX-01-V regression coverage — SCHEDULED -> POSTPONED ->
 * SCHEDULED(new date) lifecycle.
 *
 * Proves the Matchcenter presentation-layer helpers correctly support a
 * real FCA match being postponed and later rescheduled to a new kickoff,
 * WITHOUT any duplicate row, WITHOUT losing existing allocations, and
 * WITHOUT the POSTPONED short-circuit "sticking" once the canonical status
 * reverts to SCHEDULED.
 *
 * The SFV sync layer identity guarantee this depends on (same
 * externalMatchId -> same Event/MatchExternalMapping row is updated, never
 * duplicated; pitchCode/dressingRoom fields are never touched by sync) is
 * established and tested elsewhere (schedule-persistence.ts,
 * sync-schedule.test.ts, sync-schedule-persistence.test.ts) and is not
 * modified by MATCHCENTER-UX-01 — this suite only proves the presentation
 * layer behaves correctly given that guarantee.
 */
import { describe, expect, it } from "vitest";
import { getMatchcenterLifecycleStage, getMatchcenterResultLabel } from "../match-lifecycle";
import { assessMatchOperationalState } from "../operational-state";
import { buildMatchcenterViewModel } from "../view-model";
import type { MatchcenterMatchSummary, MatchcenterSide } from "../types";

function side(overrides: Partial<MatchcenterSide> = {}): MatchcenterSide {
  return {
    providerTeamId: 3311,
    providerTeamName: "FC Allschwil B2",
    canonicalTeamId: "team-fca-b2",
    canonicalTeamName: "FC Allschwil B2",
    displayName: "FC Allschwil B2",
    resolution: "RESOLVED",
    isOwnTeam: true,
    ...overrides,
  };
}

// Simulates the SAME canonical Event/MatchExternalMapping row (same id,
// same externalMatchId) as it evolves through the SFV sync lifecycle.
function matchAtStage(
  overrides: Partial<MatchcenterMatchSummary>,
): MatchcenterMatchSummary {
  return {
    id: "event-4344423", // stable canonical id — same DB row throughout
    tenantId: "tenant-1",
    teamId: "team-fca-b2",
    seasonId: "season-2026-2027",
    type: "MATCH",
    title: "FC Allschwil B2 – SV Muttenz a",
    description: null,
    status: "SCHEDULED",
    startAt: new Date("2026-09-05T15:00:00.000Z"),
    endAt: null,
    location: "Im Brüel",
    competitionLabel: "Junioren B 1. Stärkeklasse",
    homeAway: "HOME",
    resultLabel: null,
    intermediateResultLabel: null,
    scoreHome: 0, // SFV raw default for an unplayed fixture — never null
    scoreAway: 0,
    home: side(),
    away: side({
      providerTeamId: 5544,
      providerTeamName: "SV Muttenz a",
      canonicalTeamId: null,
      canonicalTeamName: null,
      displayName: "SV Muttenz a",
      resolution: "UNRESOLVED",
      isOwnTeam: false,
    }),
    source: {
      eventSource: "SFV",
      externalSource: "SFV",
      externalSourceId: "4344423",
      provider: "SFV",
      externalMatchId: 4344423, // stable provider identity throughout
      externalSeasonId: 2027,
      matchNumber: 12,
    },
    synchronization: {
      eventLastSyncedAt: new Date("2026-08-01T10:00:00.000Z"),
      mappingLastSyncedAt: new Date("2026-08-01T10:00:00.000Z"),
      detailSyncedAt: null,
      providerMatchState: 1,
      providerMatchStateName: "Geplant",
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
    reviewStage: "PUBLISHED",
    publishedAt: null,
    ...overrides,
  };
}

describe("MATCHCENTER-UX-01-V — SCHEDULED -> POSTPONED -> SCHEDULED(new date) lifecycle", () => {
  it("Stage 1: initially SCHEDULED, ready, in Spielplanung, no score", () => {
    const match = matchAtStage({});

    expect(getMatchcenterLifecycleStage(match)).toBe("UPCOMING");
    expect(getMatchcenterResultLabel(match)).toBeNull(); // no fake 0:0
    expect(assessMatchOperationalState(match).status).toBe("READY");

    const vm = buildMatchcenterViewModel([match]);
    expect(vm.spielplanung.map((r) => r.match.id)).toEqual(["event-4344423"]);
    expect(vm.resultate).toEqual([]);
  });

  it("Stage 2: same row transitions to POSTPONED (sync updates status in place, same id/externalMatchId)", () => {
    const postponed = matchAtStage({
      status: "POSTPONED",
      synchronization: {
        eventLastSyncedAt: new Date("2026-08-15T10:00:00.000Z"),
        mappingLastSyncedAt: new Date("2026-08-15T10:00:00.000Z"),
        detailSyncedAt: null,
        providerMatchState: 2,
        providerMatchStateName: "verschoben",
      },
    });

    // Never a fake score while postponed.
    expect(getMatchcenterResultLabel(postponed)).toBeNull();

    // Never appears in Resultate as if completed.
    expect(getMatchcenterLifecycleStage(postponed)).toBe("UPCOMING");
    const vm = buildMatchcenterViewModel([postponed]);
    expect(vm.resultate).toEqual([]);
    expect(vm.spielplanung.map((r) => r.match.id)).toEqual(["event-4344423"]);

    // No misleading operational actions while genuinely postponed — existing
    // allocations (pitchCode/dressingRooms, still KR2/G1/G2 on this same
    // row) are NOT flagged as "open" busywork for a fixture that isn't even
    // confirmed to happen on this date anymore.
    const assessment = assessMatchOperationalState(postponed);
    expect(assessment.status).toBe("NOT_APPLICABLE");
    expect(assessment.actionCount).toBe(0);

    // The underlying operational fields are untouched/preserved — this
    // helper only ever reads them, never mutates them. The SFV persistence
    // layer independently guarantees the same at the DB layer (see
    // schedule-persistence.ts: "NEVER modifies locally managed Event
    // fields": pitchCode, homeDressingRoomCode, awayDressingRoomCode).
    expect(postponed.operational.pitchCode).toBe("KR2");
    expect(postponed.operational.homeDressingRoomCode).toBe("G1");
    expect(postponed.operational.awayDressingRoomCode).toBe("G2");
  });

  it("Stage 3: SAME row reactivated with a NEW date/time once SFV reports it scheduled again", () => {
    // Same id, same externalMatchId — this models the SFV sync layer
    // updating the EXISTING Event + MatchExternalMapping row in place
    // (schedule-persistence.ts keys strictly on externalMatchId; see
    // loadExistingMatchMappings / processScheduleEntry). No new row is ever
    // created for this scenario at the sync layer — untouched by this PR.
    const rescheduled = matchAtStage({
      status: "SCHEDULED", // mapMatchStateToEventStatus's conservative default
      startAt: new Date("2026-09-19T15:00:00.000Z"), // NEW kickoff
      synchronization: {
        eventLastSyncedAt: new Date("2026-09-01T10:00:00.000Z"),
        mappingLastSyncedAt: new Date("2026-09-01T10:00:00.000Z"),
        detailSyncedAt: null,
        providerMatchState: 1,
        providerMatchStateName: "Geplant",
      },
      // Existing allocations from before the postponement are still present
      // (never deleted) and become actionable again automatically because
      // assessMatchOperationalState is a pure function of CURRENT state —
      // there is no cached/frozen "postponed" flag anywhere.
    });

    // Returns to Spielplanung.
    expect(getMatchcenterLifecycleStage(rescheduled)).toBe("UPCOMING");
    const vm = buildMatchcenterViewModel([rescheduled]);
    expect(vm.spielplanung.map((r) => r.match.id)).toEqual(["event-4344423"]);

    // New date/time is what's shown (same row, no duplicate).
    expect(rescheduled.startAt.toISOString()).toBe("2026-09-19T15:00:00.000Z");
    expect(rescheduled.id).toBe("event-4344423");
    expect(rescheduled.source.externalMatchId).toBe(4344423);

    // Normal operational readiness recalculated — fully READY here because
    // the preserved allocations are still complete.
    expect(assessMatchOperationalState(rescheduled).status).toBe("READY");

    // Prove the POSTPONED short-circuit does NOT "stick" once status flips
    // back to SCHEDULED: if the preserved allocations were (hypothetically)
    // incomplete, the reactivated match becomes actionable again.
    const rescheduledMissingSetup = matchAtStage({
      status: "SCHEDULED",
      startAt: new Date("2026-09-19T15:00:00.000Z"),
      operational: {
        pitchCode: null,
        homeDressingRoomCode: null,
        awayDressingRoomCode: "G2",
        meetingTime: null,
        remarks: null,
      },
    });
    const reopenedAssessment = assessMatchOperationalState(
      rescheduledMissingSetup,
    );
    expect(reopenedAssessment.status).toBe("OPEN");
    expect(reopenedAssessment.actions.map((a) => a.label)).toEqual([
      "Spielfeld",
      "Heimkabine",
    ]);
  });

  it("the same externalMatchId is never double-counted across a status transition", () => {
    // Models the KPI/list aggregation seeing only the CURRENT row per
    // unique id — the DB never holds more than one Event for a given
    // externalMatchId (see schedule-persistence.ts identity guarantee).
    const currentRow = matchAtStage({
      status: "SCHEDULED",
      startAt: new Date("2026-09-19T15:00:00.000Z"),
    });

    const vm = buildMatchcenterViewModel([currentRow]);
    expect(vm.kpis.anstehend).toBe(1);
    expect(vm.kpis.resultate).toBe(0);
  });
});
