/**
 * scripts/__tests__/team-sfv-mapping-01-fca-reconciliation.test.ts
 *
 * TEAM-SFV-MAPPING-01 — Tests for the pure classification/fix-plan logic in
 * the FC Allschwil SFV mapping reconciliation script. No database access —
 * these exercise `classifySplitIdentityGroups` and `buildFixPlan` directly
 * against fixture data.
 *
 * TEST COVERAGE MAP:
 *   H-01  hasDependentData is false for an all-zero counts object
 *   H-02  hasDependentData is true when any single count is non-zero
 *
 *   C-01  A single teamId per externalTeamId is not a split (no group emitted)
 *   C-02  Two distinct teamIds for the same externalTeamId form a SPLIT_IDENTITY group
 *   C-03  The earliest-created team is chosen as the survivor
 *   C-04  A group is SAFE when every non-survivor team has zero dependent data
 *   C-05  A group is AMBIGUOUS when a non-survivor team has dependent data (e.g. a TeamSeason)
 *   C-06  AMBIGUOUS reason names the offending team and its dependent counts
 *   C-07  Multiple independent split groups are each classified independently
 *   C-08  Classification is deterministic and idempotent (same input → same output)
 *
 *   P-01  buildFixPlan produces a repoint list excluding the survivor's own mapping rows
 *   P-02  buildFixPlan produces a deactivate list excluding the survivor team
 *   P-03  buildFixPlan routes AMBIGUOUS groups to ambiguousGroups, not safeFixes
 *   P-04  buildFixPlan produces zero fixes when there are no split groups
 */

import { describe, it, expect } from "vitest";
import {
  hasDependentData,
  classifySplitIdentityGroups,
  buildFixPlan,
  type MappingRow,
  type TeamRow,
  type TeamDependentCounts,
} from "../team-sfv-mapping-01-fca-reconciliation";

// ---------------------------------------------------------------------------
// Fixture builders
// ---------------------------------------------------------------------------

function zeroCounts(overrides: Partial<TeamDependentCounts> = {}): TeamDependentCounts {
  return {
    teamSeasons: 0,
    events: 0,
    eventImportRuns: 0,
    homeMatchMappings: 0,
    awayMatchMappings: 0,
    ...overrides,
  };
}

function makeTeam(overrides: Partial<TeamRow> & { id: string }): TeamRow {
  return {
    name: `Team ${overrides.id}`,
    slug: `sfv-${overrides.id}`,
    isActive: true,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    dependentCounts: zeroCounts(),
    ...overrides,
  };
}

function makeMapping(overrides: Partial<MappingRow> & { teamId: string; externalTeamId: number }): MappingRow {
  return {
    id: `mapping-${overrides.teamId}-${overrides.externalTeamId}`,
    externalSeasonId: 2027,
    providerTeamName: "FC Allschwil",
    providerIsActive: true,
    lastSyncedAt: new Date("2027-07-01T00:00:00.000Z"),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// hasDependentData
// ---------------------------------------------------------------------------

describe("hasDependentData", () => {
  it("H-01 — false for an all-zero counts object", () => {
    expect(hasDependentData(zeroCounts())).toBe(false);
  });

  it("H-02 — true when any single count is non-zero", () => {
    expect(hasDependentData(zeroCounts({ teamSeasons: 1 }))).toBe(true);
    expect(hasDependentData(zeroCounts({ events: 1 }))).toBe(true);
    expect(hasDependentData(zeroCounts({ eventImportRuns: 1 }))).toBe(true);
    expect(hasDependentData(zeroCounts({ homeMatchMappings: 1 }))).toBe(true);
    expect(hasDependentData(zeroCounts({ awayMatchMappings: 1 }))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// classifySplitIdentityGroups
// ---------------------------------------------------------------------------

describe("classifySplitIdentityGroups", () => {
  it("C-01 — a single teamId per externalTeamId is not a split", () => {
    const mappings = [makeMapping({ teamId: "team-1", externalTeamId: 31927 })];
    const teams = new Map([["team-1", makeTeam({ id: "team-1" })]]);

    const groups = classifySplitIdentityGroups(mappings, teams);

    expect(groups).toHaveLength(0);
  });

  it("C-02 — two distinct teamIds for the same externalTeamId form a group", () => {
    const mappings = [
      makeMapping({ teamId: "team-2026", externalTeamId: 31927, externalSeasonId: 2026 }),
      makeMapping({ teamId: "team-2027", externalTeamId: 31927, externalSeasonId: 2027 }),
    ];
    const teams = new Map([
      ["team-2026", makeTeam({ id: "team-2026", createdAt: new Date("2026-07-01T00:00:00.000Z") })],
      ["team-2027", makeTeam({ id: "team-2027", createdAt: new Date("2027-07-01T00:00:00.000Z") })],
    ]);

    const groups = classifySplitIdentityGroups(mappings, teams);

    expect(groups).toHaveLength(1);
    expect(groups[0].externalTeamId).toBe(31927);
    expect(groups[0].teamIds.sort()).toEqual(["team-2026", "team-2027"]);
  });

  it("C-03 — the earliest-created team is chosen as the survivor", () => {
    const mappings = [
      makeMapping({ teamId: "team-newer", externalTeamId: 31927, externalSeasonId: 2027 }),
      makeMapping({ teamId: "team-older", externalTeamId: 31927, externalSeasonId: 2026 }),
    ];
    const teams = new Map([
      ["team-newer", makeTeam({ id: "team-newer", createdAt: new Date("2027-07-01T00:00:00.000Z") })],
      ["team-older", makeTeam({ id: "team-older", createdAt: new Date("2026-07-01T00:00:00.000Z") })],
    ]);

    const groups = classifySplitIdentityGroups(mappings, teams);

    expect(groups[0].survivorTeamId).toBe("team-older");
  });

  it("C-04 — SAFE when every non-survivor team has zero dependent data", () => {
    const mappings = [
      makeMapping({ teamId: "team-older", externalTeamId: 31927, externalSeasonId: 2026 }),
      makeMapping({ teamId: "team-newer", externalTeamId: 31927, externalSeasonId: 2027 }),
    ];
    const teams = new Map([
      ["team-older", makeTeam({ id: "team-older", createdAt: new Date("2026-07-01T00:00:00.000Z") })],
      ["team-newer", makeTeam({ id: "team-newer", createdAt: new Date("2027-07-01T00:00:00.000Z") })],
    ]);

    const groups = classifySplitIdentityGroups(mappings, teams);

    expect(groups[0].classification).toBe("SAFE");
  });

  it("C-05 — AMBIGUOUS when a non-survivor team has dependent data", () => {
    const mappings = [
      makeMapping({ teamId: "team-older", externalTeamId: 31927, externalSeasonId: 2026 }),
      makeMapping({ teamId: "team-newer", externalTeamId: 31927, externalSeasonId: 2027 }),
    ];
    const teams = new Map([
      ["team-older", makeTeam({ id: "team-older", createdAt: new Date("2026-07-01T00:00:00.000Z") })],
      [
        "team-newer",
        makeTeam({
          id: "team-newer",
          createdAt: new Date("2027-07-01T00:00:00.000Z"),
          dependentCounts: zeroCounts({ teamSeasons: 1 }),
        }),
      ],
    ]);

    const groups = classifySplitIdentityGroups(mappings, teams);

    expect(groups[0].classification).toBe("AMBIGUOUS");
  });

  it("C-06 — AMBIGUOUS reason names the offending team and its dependent counts", () => {
    const mappings = [
      makeMapping({ teamId: "team-older", externalTeamId: 31927, externalSeasonId: 2026 }),
      makeMapping({ teamId: "team-newer", externalTeamId: 31927, externalSeasonId: 2027 }),
    ];
    const teams = new Map([
      ["team-older", makeTeam({ id: "team-older", createdAt: new Date("2026-07-01T00:00:00.000Z") })],
      [
        "team-newer",
        makeTeam({
          id: "team-newer",
          name: "FC Allschwil C1 (duplicate)",
          createdAt: new Date("2027-07-01T00:00:00.000Z"),
          dependentCounts: zeroCounts({ events: 3 }),
        }),
      ],
    ]);

    const groups = classifySplitIdentityGroups(mappings, teams);

    expect(groups[0].reason).toContain("team-newer");
    expect(groups[0].reason).toContain("events=3");
  });

  it("C-07 — multiple independent split groups are each classified independently", () => {
    const mappings = [
      makeMapping({ teamId: "c1-2026", externalTeamId: 111, externalSeasonId: 2026 }),
      makeMapping({ teamId: "c1-2027", externalTeamId: 111, externalSeasonId: 2027 }),
      makeMapping({ teamId: "b1-2026", externalTeamId: 222, externalSeasonId: 2026 }),
      makeMapping({ teamId: "b1-2027", externalTeamId: 222, externalSeasonId: 2027 }),
    ];
    const teams = new Map([
      ["c1-2026", makeTeam({ id: "c1-2026", createdAt: new Date("2026-01-01T00:00:00.000Z") })],
      ["c1-2027", makeTeam({ id: "c1-2027", createdAt: new Date("2027-01-01T00:00:00.000Z") })],
      ["b1-2026", makeTeam({ id: "b1-2026", createdAt: new Date("2026-01-01T00:00:00.000Z") })],
      [
        "b1-2027",
        makeTeam({
          id: "b1-2027",
          createdAt: new Date("2027-01-01T00:00:00.000Z"),
          dependentCounts: zeroCounts({ homeMatchMappings: 2 }),
        }),
      ],
    ]);

    const groups = classifySplitIdentityGroups(mappings, teams);

    expect(groups).toHaveLength(2);
    const g111 = groups.find((g) => g.externalTeamId === 111);
    const g222 = groups.find((g) => g.externalTeamId === 222);
    expect(g111?.classification).toBe("SAFE");
    expect(g222?.classification).toBe("AMBIGUOUS");
  });

  it("C-08 — classification is deterministic and idempotent", () => {
    const mappings = [
      makeMapping({ teamId: "team-older", externalTeamId: 31927, externalSeasonId: 2026 }),
      makeMapping({ teamId: "team-newer", externalTeamId: 31927, externalSeasonId: 2027 }),
    ];
    const teams = new Map([
      ["team-older", makeTeam({ id: "team-older", createdAt: new Date("2026-07-01T00:00:00.000Z") })],
      ["team-newer", makeTeam({ id: "team-newer", createdAt: new Date("2027-07-01T00:00:00.000Z") })],
    ]);

    const run1 = classifySplitIdentityGroups(mappings, teams);
    const run2 = classifySplitIdentityGroups(mappings, teams);

    expect(run1).toEqual(run2);
  });
});

// ---------------------------------------------------------------------------
// buildFixPlan
// ---------------------------------------------------------------------------

describe("buildFixPlan", () => {
  it("P-01 — repoint list excludes the survivor's own mapping row", () => {
    const groups = classifySplitIdentityGroups(
      [
        makeMapping({ id: "m-older", teamId: "team-older", externalTeamId: 31927, externalSeasonId: 2026 }),
        makeMapping({ id: "m-newer", teamId: "team-newer", externalTeamId: 31927, externalSeasonId: 2027 }),
      ],
      new Map([
        ["team-older", makeTeam({ id: "team-older", createdAt: new Date("2026-07-01T00:00:00.000Z") })],
        ["team-newer", makeTeam({ id: "team-newer", createdAt: new Date("2027-07-01T00:00:00.000Z") })],
      ]),
    );

    const plan = buildFixPlan(groups);

    expect(plan.safeFixes).toHaveLength(1);
    expect(plan.safeFixes[0].mappingIdsToRepoint).toEqual(["m-newer"]);
  });

  it("P-02 — deactivate list excludes the survivor team", () => {
    const groups = classifySplitIdentityGroups(
      [
        makeMapping({ teamId: "team-older", externalTeamId: 31927, externalSeasonId: 2026 }),
        makeMapping({ teamId: "team-newer", externalTeamId: 31927, externalSeasonId: 2027 }),
      ],
      new Map([
        ["team-older", makeTeam({ id: "team-older", createdAt: new Date("2026-07-01T00:00:00.000Z") })],
        ["team-newer", makeTeam({ id: "team-newer", createdAt: new Date("2027-07-01T00:00:00.000Z") })],
      ]),
    );

    const plan = buildFixPlan(groups);

    expect(plan.safeFixes[0].teamIdsToDeactivate).toEqual(["team-newer"]);
    expect(plan.safeFixes[0].survivorTeamId).toBe("team-older");
  });

  it("P-03 — AMBIGUOUS groups are routed to ambiguousGroups, never safeFixes", () => {
    const groups = classifySplitIdentityGroups(
      [
        makeMapping({ teamId: "team-older", externalTeamId: 31927, externalSeasonId: 2026 }),
        makeMapping({ teamId: "team-newer", externalTeamId: 31927, externalSeasonId: 2027 }),
      ],
      new Map([
        ["team-older", makeTeam({ id: "team-older", createdAt: new Date("2026-07-01T00:00:00.000Z") })],
        [
          "team-newer",
          makeTeam({
            id: "team-newer",
            createdAt: new Date("2027-07-01T00:00:00.000Z"),
            dependentCounts: zeroCounts({ teamSeasons: 1 }),
          }),
        ],
      ]),
    );

    const plan = buildFixPlan(groups);

    expect(plan.safeFixes).toHaveLength(0);
    expect(plan.ambiguousGroups).toHaveLength(1);
    expect(plan.ambiguousGroups[0].externalTeamId).toBe(31927);
  });

  it("P-04 — zero fixes when there are no split groups", () => {
    const plan = buildFixPlan([]);

    expect(plan.safeFixes).toHaveLength(0);
    expect(plan.ambiguousGroups).toHaveLength(0);
  });
});
