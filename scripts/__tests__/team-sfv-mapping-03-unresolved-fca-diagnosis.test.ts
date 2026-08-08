/**
 * scripts/__tests__/team-sfv-mapping-03-unresolved-fca-diagnosis.test.ts
 *
 * TEAM-SFV-MAPPING-03 — Tests for the pure diagnosis logic in the unresolved
 * FCA match diagnosis script. No database access — these exercise
 * `resolveFcaSide`, `diagnoseSide`, `buildDiagnosisRow`, and
 * `summarizeDiagnosis` directly against fixture data.
 *
 * TEST COVERAGE MAP:
 *   F-01  resolveFcaSide identifies HOME side from Event.homeAway="HOME"
 *   F-02  resolveFcaSide identifies AWAY side from Event.homeAway="AWAY"
 *   F-03  resolveFcaSide accepts legacy "H"/"A" homeAway values
 *   F-04  resolveFcaSide returns null for missing/unrecognized homeAway
 *         (never falls back to inferring from a team name)
 *
 *   D-01  diagnoseSide returns NO_MAPPING_ANY_SEASON when history is empty
 *   D-02  diagnoseSide returns MAPPING_OTHER_SEASON_ONLY when only a prior
 *         season has a mapping row
 *   D-03  diagnoseSide returns MAPPING_CURRENT_SEASON_INACTIVE when the
 *         current-season row exists but providerIsActive=false
 *   D-04  diagnoseSide returns MAPPING_CURRENT_SEASON_ACTIVE_STALE_MATCH
 *         when a valid active current-season mapping exists
 *   D-05  diagnoseSide returns AMBIGUOUS_MULTIPLE_CANONICAL_TEAMS when two
 *         distinct canonical teamIds are active for the current season
 *   D-06  diagnoseSide prefers the most-recently-synced row across multiple
 *         non-current seasons
 *   D-07  diagnoseSide is deterministic and idempotent
 *
 *   B-01  buildDiagnosisRow returns UNKNOWN_HOMEAWAY when homeAway can't be
 *         resolved (never infers the FCA side from a name in that case)
 *   B-02  buildDiagnosisRow reports NO_MAPPING_ANY_SEASON for a genuinely
 *         never-synced provider teamId
 *   B-03  buildDiagnosisRow carries through the resolved canonical Team name
 *         and TeamSeason flag when provided
 *
 *   S-01  summarizeDiagnosis counts rows by root cause
 *   S-02  summarizeDiagnosis counts rows by FCA side
 *   S-03  summarizeDiagnosis collects distinct affected provider teamIds
 *   S-04  summarizeDiagnosis on an empty list is all-zero
 */

import { describe, it, expect } from "vitest";
import {
  resolveFcaSide,
  diagnoseSide,
  buildDiagnosisRow,
  summarizeDiagnosis,
  type UnresolvedMatchRow,
  type MappingHistoryRow,
} from "../team-sfv-mapping-03-unresolved-fca-diagnosis";

// ---------------------------------------------------------------------------
// Fixture builders
// ---------------------------------------------------------------------------

function makeMatch(overrides: Partial<UnresolvedMatchRow> = {}): UnresolvedMatchRow {
  return {
    eventId: "event-1",
    startAt: new Date("2026-09-06T13:00:00.000Z"),
    competitionLabel: "3. Liga, Gruppe 1",
    externalMatchId: 900001,
    externalSeasonId: 2027,
    providerHomeTeamId: 31927,
    providerAwayTeamId: 44210,
    providerHomeTeamName: "FC Allschwil B1",
    providerAwayTeamName: "FC Concordia Basel B1",
    homeTeamId: null,
    awayTeamId: null,
    homeAway: "HOME",
    ...overrides,
  };
}

function makeMappingHistoryRow(overrides: Partial<MappingHistoryRow> & { teamId: string }): MappingHistoryRow {
  return {
    id: `mapping-${overrides.teamId}`,
    externalSeasonId: 2027,
    providerIsActive: true,
    lastSyncedAt: new Date("2027-07-01T00:00:00.000Z"),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// resolveFcaSide
// ---------------------------------------------------------------------------

describe("resolveFcaSide", () => {
  it("F-01 — identifies HOME side from homeAway='HOME'", () => {
    const side = resolveFcaSide(makeMatch({ homeAway: "HOME" }));
    expect(side).toEqual({
      side: "HOME",
      providerTeamId: 31927,
      providerTeamName: "FC Allschwil B1",
      canonicalTeamId: null,
    });
  });

  it("F-02 — identifies AWAY side from homeAway='AWAY'", () => {
    const side = resolveFcaSide(makeMatch({ homeAway: "AWAY", awayTeamId: "team-away-canonical" }));
    expect(side).toEqual({
      side: "AWAY",
      providerTeamId: 44210,
      providerTeamName: "FC Concordia Basel B1",
      canonicalTeamId: "team-away-canonical",
    });
  });

  it("F-03 — accepts legacy 'H'/'A' homeAway values", () => {
    expect(resolveFcaSide(makeMatch({ homeAway: "H" }))?.side).toBe("HOME");
    expect(resolveFcaSide(makeMatch({ homeAway: "A" }))?.side).toBe("AWAY");
  });

  it("F-04 — returns null for missing/unrecognized homeAway (never infers from a name)", () => {
    expect(resolveFcaSide(makeMatch({ homeAway: null }))).toBeNull();
    expect(resolveFcaSide(makeMatch({ homeAway: "" }))).toBeNull();
    expect(resolveFcaSide(makeMatch({ homeAway: "SIDEWAYS" }))).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// diagnoseSide
// ---------------------------------------------------------------------------

describe("diagnoseSide", () => {
  it("D-01 — NO_MAPPING_ANY_SEASON when history is empty", () => {
    const result = diagnoseSide(2027, []);
    expect(result.rootCause).toBe("NO_MAPPING_ANY_SEASON");
    expect(result.canonicalTeamId).toBeNull();
    expect(result.mappingSeasonsFound).toEqual([]);
  });

  it("D-02 — MAPPING_OTHER_SEASON_ONLY when only a prior season has a mapping", () => {
    const history = [
      makeMappingHistoryRow({
        teamId: "team-2026",
        externalSeasonId: 2026,
        lastSyncedAt: new Date("2026-07-01T00:00:00.000Z"),
      }),
    ];

    const result = diagnoseSide(2027, history);

    expect(result.rootCause).toBe("MAPPING_OTHER_SEASON_ONLY");
    expect(result.canonicalTeamId).toBe("team-2026");
    expect(result.mappingSeasonsFound).toEqual([2026]);
    expect(result.mappingActiveInCurrentSeason).toBeNull();
  });

  it("D-03 — MAPPING_CURRENT_SEASON_INACTIVE when current-season row is inactive", () => {
    const history = [
      makeMappingHistoryRow({ teamId: "team-x", externalSeasonId: 2027, providerIsActive: false }),
    ];

    const result = diagnoseSide(2027, history);

    expect(result.rootCause).toBe("MAPPING_CURRENT_SEASON_INACTIVE");
    expect(result.canonicalTeamId).toBe("team-x");
    expect(result.mappingActiveInCurrentSeason).toBe(false);
  });

  it("D-04 — MAPPING_CURRENT_SEASON_ACTIVE_STALE_MATCH when a valid active mapping exists", () => {
    const history = [
      makeMappingHistoryRow({ teamId: "team-x", externalSeasonId: 2027, providerIsActive: true }),
    ];

    const result = diagnoseSide(2027, history);

    expect(result.rootCause).toBe("MAPPING_CURRENT_SEASON_ACTIVE_STALE_MATCH");
    expect(result.canonicalTeamId).toBe("team-x");
    expect(result.mappingActiveInCurrentSeason).toBe(true);
    expect(result.reason).toContain("team-x");
  });

  it("D-05 — AMBIGUOUS_MULTIPLE_CANONICAL_TEAMS when two distinct active current-season teamIds exist", () => {
    const history = [
      makeMappingHistoryRow({ teamId: "team-a", externalSeasonId: 2027, providerIsActive: true }),
      makeMappingHistoryRow({ teamId: "team-b", externalSeasonId: 2027, providerIsActive: true }),
    ];

    const result = diagnoseSide(2027, history);

    expect(result.rootCause).toBe("AMBIGUOUS_MULTIPLE_CANONICAL_TEAMS");
    expect(result.canonicalTeamId).toBeNull();
  });

  it("D-06 — prefers the most-recently-synced row across multiple non-current seasons", () => {
    const history = [
      makeMappingHistoryRow({
        teamId: "team-2025",
        externalSeasonId: 2025,
        lastSyncedAt: new Date("2025-07-01T00:00:00.000Z"),
      }),
      makeMappingHistoryRow({
        teamId: "team-2026",
        externalSeasonId: 2026,
        lastSyncedAt: new Date("2026-07-01T00:00:00.000Z"),
      }),
    ];

    const result = diagnoseSide(2027, history);

    expect(result.rootCause).toBe("MAPPING_OTHER_SEASON_ONLY");
    expect(result.canonicalTeamId).toBe("team-2026");
    expect(result.mappingSeasonsFound).toEqual([2025, 2026]);
  });

  it("D-07 — deterministic and idempotent", () => {
    const history = [makeMappingHistoryRow({ teamId: "team-x", externalSeasonId: 2027 })];
    expect(diagnoseSide(2027, history)).toEqual(diagnoseSide(2027, history));
  });
});

// ---------------------------------------------------------------------------
// buildDiagnosisRow
// ---------------------------------------------------------------------------

describe("buildDiagnosisRow", () => {
  it("B-01 — UNKNOWN_HOMEAWAY when homeAway can't be resolved (never infers from a name)", () => {
    const row = buildDiagnosisRow(makeMatch({ homeAway: null }), 2027, [], null, null);

    expect(row.rootCause).toBe("UNKNOWN_HOMEAWAY");
    expect(row.fcaSide).toBe("UNKNOWN");
    expect(row.fcaProviderTeamId).toBeNull();
  });

  it("B-02 — reports NO_MAPPING_ANY_SEASON for a genuinely never-synced provider teamId", () => {
    const row = buildDiagnosisRow(makeMatch({ homeAway: "HOME" }), 2027, [], null, null);

    expect(row.rootCause).toBe("NO_MAPPING_ANY_SEASON");
    expect(row.fcaSide).toBe("HOME");
    expect(row.fcaProviderTeamId).toBe(31927);
    expect(row.mappingExists).toBe(false);
    expect(row.matchcenterResolution).toBe("UNRESOLVED");
  });

  it("B-03 — carries through resolved canonical Team name and TeamSeason flag", () => {
    const history = [makeMappingHistoryRow({ teamId: "team-x", externalSeasonId: 2027, providerIsActive: true })];

    const row = buildDiagnosisRow(
      makeMatch({ homeAway: "HOME" }),
      2027,
      history,
      "FC Allschwil B1",
      true,
    );

    expect(row.canonicalTeamId).toBe("team-x");
    expect(row.canonicalTeamName).toBe("FC Allschwil B1");
    expect(row.hasTeamSeasonForActiveSeason).toBe(true);
    expect(row.rootCause).toBe("MAPPING_CURRENT_SEASON_ACTIVE_STALE_MATCH");
  });
});

// ---------------------------------------------------------------------------
// summarizeDiagnosis
// ---------------------------------------------------------------------------

describe("summarizeDiagnosis", () => {
  it("S-01 — counts rows by root cause", () => {
    const rows = [
      buildDiagnosisRow(makeMatch({ homeAway: "HOME" }), 2027, [], null, null),
      buildDiagnosisRow(makeMatch({ homeAway: "HOME", externalMatchId: 2 }), 2027, [], null, null),
      buildDiagnosisRow(
        makeMatch({ homeAway: "HOME", externalMatchId: 3 }),
        2027,
        [makeMappingHistoryRow({ teamId: "team-x", externalSeasonId: 2027 })],
        null,
        null,
      ),
    ];

    const summary = summarizeDiagnosis(rows);

    expect(summary.totalUnresolved).toBe(3);
    expect(summary.byRootCause.NO_MAPPING_ANY_SEASON).toBe(2);
    expect(summary.byRootCause.MAPPING_CURRENT_SEASON_ACTIVE_STALE_MATCH).toBe(1);
  });

  it("S-02 — counts rows by FCA side", () => {
    const rows = [
      buildDiagnosisRow(makeMatch({ homeAway: "HOME" }), 2027, [], null, null),
      buildDiagnosisRow(makeMatch({ homeAway: "AWAY", externalMatchId: 2 }), 2027, [], null, null),
    ];

    const summary = summarizeDiagnosis(rows);

    expect(summary.byFcaSide.HOME).toBe(1);
    expect(summary.byFcaSide.AWAY).toBe(1);
  });

  it("S-03 — collects distinct affected provider teamIds", () => {
    const rows = [
      buildDiagnosisRow(makeMatch({ homeAway: "HOME", providerHomeTeamId: 111 }), 2027, [], null, null),
      buildDiagnosisRow(
        makeMatch({ homeAway: "HOME", providerHomeTeamId: 111, externalMatchId: 2 }),
        2027,
        [],
        null,
        null,
      ),
      buildDiagnosisRow(
        makeMatch({ homeAway: "HOME", providerHomeTeamId: 222, externalMatchId: 3 }),
        2027,
        [],
        null,
        null,
      ),
    ];

    const summary = summarizeDiagnosis(rows);

    expect(summary.distinctAffectedProviderTeamIds).toEqual([111, 222]);
  });

  it("S-04 — all-zero on an empty list", () => {
    const summary = summarizeDiagnosis([]);

    expect(summary.totalUnresolved).toBe(0);
    expect(summary.byRootCause).toEqual({});
    expect(summary.byFcaSide).toEqual({});
    expect(summary.distinctAffectedProviderTeamIds).toEqual([]);
  });
});
