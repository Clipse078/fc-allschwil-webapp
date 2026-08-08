/**
 * scripts/__tests__/team-sfv-mapping-03-fca-identity-inventory.test.ts
 *
 * TEAM-SFV-MAPPING-03 — Tests for the pure identity classification and
 * match-resolution correlation logic in the FCA canonical-team identity
 * inventory script. No database access.
 *
 * TEST COVERAGE MAP:
 *   O-01  buildExternalTeamIdOwnership maps one externalTeamId to one team
 *   O-02  buildExternalTeamIdOwnership maps one externalTeamId to multiple
 *         teams when genuinely split
 *   O-03  buildExternalTeamIdOwnership keeps distinct externalTeamIds
 *         separate even when both belong to the same team
 *
 *   C-01  LEGITIMATE_DISTINCT_TEAM for a unique externalTeamId, single
 *         season, generic display name ("FC Allschwil") — name is NOT
 *         used as evidence
 *   C-02  Two teams both named "FC Allschwil D2" with DIFFERENT
 *         externalTeamIds are BOTH classified LEGITIMATE_DISTINCT_TEAM
 *         (never inferred as duplicates from the shared name)
 *   C-03  HISTORICAL_CROSS_SEASON_SAME_TEAM when one team's single
 *         externalTeamId spans multiple seasons
 *   C-04  DUPLICATE_CANONICAL_IDENTITY when two DIFFERENT canonical teams
 *         share the same externalTeamId (name-independent)
 *   C-05  DUPLICATE_CANONICAL_IDENTITY reason/recommendation never
 *         proposes an automatic merge
 *   C-06  UNRESOLVED_INSUFFICIENT_EVIDENCE when a team has zero mappings
 *   C-07  UNRESOLVED_INSUFFICIENT_EVIDENCE when mappings exist only for a
 *         non-current season (no current-season row to evaluate)
 *   C-08  Classification is deterministic and idempotent
 *
 *   M-01  computeMatchResolutionStats counts a match resolved to the
 *         expected team
 *   M-02  computeMatchResolutionStats counts a match still unresolved
 *         (null teamId column)
 *   M-03  computeMatchResolutionStats counts a match mismatched (resolved
 *         to a DIFFERENT team than expected)
 *   M-04  computeMatchResolutionStats only counts matches actually
 *         referencing the given externalTeamId (home or away)
 *   M-05  summarizeMatchcenterResolution reports NO CURRENT-SEASON MATCHES
 *         for a null/empty stats object
 *   M-06  summarizeMatchcenterResolution prioritizes MISMATCHED over
 *         UNRESOLVED when both are present
 *
 *   S-01  summarizeInventory counts rows by classification
 *   S-02  summarizeInventory flags exact "FC Allschwil" names for human
 *         review only (does not affect classification)
 */

import { describe, it, expect } from "vitest";
import {
  buildExternalTeamIdOwnership,
  classifyCanonicalTeamIdentity,
  computeMatchResolutionStats,
  summarizeMatchcenterResolution,
  summarizeInventory,
  type CanonicalTeamFact,
  type TeamMappingFact,
} from "../team-sfv-mapping-03-fca-identity-inventory";

// ---------------------------------------------------------------------------
// Fixture builders
// ---------------------------------------------------------------------------

function makeMapping(overrides: Partial<TeamMappingFact> & { externalTeamId: number }): TeamMappingFact {
  return {
    externalSeasonId: 2027,
    providerIsActive: true,
    providerTeamName: "FC Allschwil",
    providerLeagueName: "3. Liga, Gruppe 1",
    lastSyncedAt: new Date("2027-07-01T00:00:00.000Z"),
    ...overrides,
  };
}

function makeTeam(overrides: Partial<CanonicalTeamFact> & { id: string }): CanonicalTeamFact {
  return {
    name: "FC Allschwil",
    slug: `fca-${overrides.id}`,
    category: "AKTIVE",
    isActive: true,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    mappings: [],
    teamSeasons: [],
    homeMatchCount: 0,
    awayMatchCount: 0,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// buildExternalTeamIdOwnership
// ---------------------------------------------------------------------------

describe("buildExternalTeamIdOwnership", () => {
  it("O-01 — maps one externalTeamId to one team", () => {
    const teams = [makeTeam({ id: "team-1", mappings: [makeMapping({ externalTeamId: 10001 })] })];

    const ownership = buildExternalTeamIdOwnership(teams);

    expect(ownership.get(10001)).toEqual(new Set(["team-1"]));
  });

  it("O-02 — maps one externalTeamId to multiple teams when genuinely split", () => {
    const teams = [
      makeTeam({ id: "team-1", mappings: [makeMapping({ externalTeamId: 30003, externalSeasonId: 2026 })] }),
      makeTeam({ id: "team-2", mappings: [makeMapping({ externalTeamId: 30003, externalSeasonId: 2027 })] }),
    ];

    const ownership = buildExternalTeamIdOwnership(teams);

    expect(ownership.get(30003)).toEqual(new Set(["team-1", "team-2"]));
  });

  it("O-03 — keeps distinct externalTeamIds separate even within the same team", () => {
    const teams = [
      makeTeam({
        id: "team-1",
        mappings: [makeMapping({ externalTeamId: 40004 }), makeMapping({ externalTeamId: 40005 })],
      }),
    ];

    const ownership = buildExternalTeamIdOwnership(teams);

    expect(ownership.get(40004)).toEqual(new Set(["team-1"]));
    expect(ownership.get(40005)).toEqual(new Set(["team-1"]));
  });
});

// ---------------------------------------------------------------------------
// classifyCanonicalTeamIdentity
// ---------------------------------------------------------------------------

describe("classifyCanonicalTeamIdentity", () => {
  it("C-01 — LEGITIMATE_DISTINCT_TEAM for a unique externalTeamId with a generic name", () => {
    const team = makeTeam({
      id: "team-aktive",
      name: "FC Allschwil",
      category: "AKTIVE",
      mappings: [makeMapping({ externalTeamId: 10001, externalSeasonId: 2027 })],
    });
    const ownership = buildExternalTeamIdOwnership([team]);

    const row = classifyCanonicalTeamIdentity(team, ownership, 2027);

    expect(row.classification).toBe("LEGITIMATE_DISTINCT_TEAM");
    expect(row.sharesExternalTeamIdWithOtherCanonicalTeam).toBe(false);
    expect(row.reason).toContain("not, by itself, evidence of duplication");
  });

  it("C-02 — two teams named identically with DIFFERENT externalTeamIds are both LEGITIMATE_DISTINCT_TEAM", () => {
    const teamD2a = makeTeam({
      id: "team-d2-a",
      name: "FC Allschwil D2",
      mappings: [makeMapping({ externalTeamId: 40004, externalSeasonId: 2027 })],
    });
    const teamD2b = makeTeam({
      id: "team-d2-b",
      name: "FC Allschwil D2",
      mappings: [makeMapping({ externalTeamId: 40005, externalSeasonId: 2027 })],
    });
    const ownership = buildExternalTeamIdOwnership([teamD2a, teamD2b]);

    const rowA = classifyCanonicalTeamIdentity(teamD2a, ownership, 2027);
    const rowB = classifyCanonicalTeamIdentity(teamD2b, ownership, 2027);

    expect(rowA.classification).toBe("LEGITIMATE_DISTINCT_TEAM");
    expect(rowB.classification).toBe("LEGITIMATE_DISTINCT_TEAM");
    expect(rowA.sharesExternalTeamIdWithOtherCanonicalTeam).toBe(false);
    expect(rowB.sharesExternalTeamIdWithOtherCanonicalTeam).toBe(false);
  });

  it("C-03 — HISTORICAL_CROSS_SEASON_SAME_TEAM when one externalTeamId spans multiple seasons for one team", () => {
    const team = makeTeam({
      id: "team-d1",
      name: "FC Allschwil D1",
      mappings: [
        makeMapping({ externalTeamId: 30003, externalSeasonId: 2026 }),
        makeMapping({ externalTeamId: 30003, externalSeasonId: 2027 }),
      ],
    });
    const ownership = buildExternalTeamIdOwnership([team]);

    const row = classifyCanonicalTeamIdentity(team, ownership, 2027);

    expect(row.classification).toBe("HISTORICAL_CROSS_SEASON_SAME_TEAM");
    expect(row.recommendedAction).toContain("None required");
  });

  it("C-04 — DUPLICATE_CANONICAL_IDENTITY when two different canonical teams share one externalTeamId", () => {
    const teamA = makeTeam({
      id: "team-d1-old",
      name: "FC Allschwil D1",
      mappings: [makeMapping({ externalTeamId: 30003, externalSeasonId: 2026 })],
    });
    const teamB = makeTeam({
      id: "team-d1-new",
      name: "FC Allschwil D1",
      mappings: [makeMapping({ externalTeamId: 30003, externalSeasonId: 2027 })],
    });
    const ownership = buildExternalTeamIdOwnership([teamA, teamB]);

    const rowA = classifyCanonicalTeamIdentity(teamA, ownership, 2027);
    const rowB = classifyCanonicalTeamIdentity(teamB, ownership, 2027);

    expect(rowA.classification).toBe("DUPLICATE_CANONICAL_IDENTITY");
    expect(rowB.classification).toBe("DUPLICATE_CANONICAL_IDENTITY");
    expect(rowA.otherCanonicalTeamIdsSharingExternalTeamId).toEqual(["team-d1-new"]);
    expect(rowB.otherCanonicalTeamIdsSharingExternalTeamId).toEqual(["team-d1-old"]);
  });

  it("C-05 — DUPLICATE_CANONICAL_IDENTITY never proposes an automatic merge", () => {
    const teamA = makeTeam({
      id: "team-x",
      mappings: [makeMapping({ externalTeamId: 30003, externalSeasonId: 2026 })],
    });
    const teamB = makeTeam({
      id: "team-y",
      mappings: [makeMapping({ externalTeamId: 30003, externalSeasonId: 2027 })],
    });
    const ownership = buildExternalTeamIdOwnership([teamA, teamB]);

    const row = classifyCanonicalTeamIdentity(teamA, ownership, 2027);

    expect(row.recommendedAction.toLowerCase()).not.toContain("auto-merge this");
    expect(row.recommendedAction).toContain("MANUAL REVIEW REQUIRED");
    expect(row.recommendedAction).toContain("Do not auto-merge");
  });

  it("C-06 — UNRESOLVED_INSUFFICIENT_EVIDENCE when a team has zero mappings", () => {
    const team = makeTeam({ id: "team-orphan", mappings: [] });
    const ownership = buildExternalTeamIdOwnership([team]);

    const row = classifyCanonicalTeamIdentity(team, ownership, 2027);

    expect(row.classification).toBe("UNRESOLVED_INSUFFICIENT_EVIDENCE");
    expect(row.recommendedAction).toContain("Do not merge, delete, or archive");
  });

  it("C-07 — UNRESOLVED_INSUFFICIENT_EVIDENCE when mapping exists only for a non-current season", () => {
    const team = makeTeam({
      id: "team-stale-season",
      mappings: [makeMapping({ externalTeamId: 55666, externalSeasonId: 2025 })],
    });
    const ownership = buildExternalTeamIdOwnership([team]);

    const row = classifyCanonicalTeamIdentity(team, ownership, 2027);

    expect(row.classification).toBe("UNRESOLVED_INSUFFICIENT_EVIDENCE");
    expect(row.currentSeasonMapping).toBeNull();
  });

  it("C-08 — deterministic and idempotent", () => {
    const team = makeTeam({
      id: "team-stable",
      mappings: [makeMapping({ externalTeamId: 10001, externalSeasonId: 2027 })],
    });
    const ownership = buildExternalTeamIdOwnership([team]);

    const run1 = classifyCanonicalTeamIdentity(team, ownership, 2027);
    const run2 = classifyCanonicalTeamIdentity(team, ownership, 2027);

    expect(run1).toEqual(run2);
  });
});

// ---------------------------------------------------------------------------
// computeMatchResolutionStats
// ---------------------------------------------------------------------------

describe("computeMatchResolutionStats", () => {
  it("M-01 — counts a match resolved to the expected team", () => {
    const matches = [
      { providerHomeTeamId: 10001, providerAwayTeamId: 99999, homeTeamId: "team-1", awayTeamId: null },
    ];

    const stats = computeMatchResolutionStats("team-1", matches, 10001);

    expect(stats).toEqual({ totalMatches: 1, resolvedCount: 1, unresolvedCount: 0, mismatchedCount: 0 });
  });

  it("M-02 — counts a match still unresolved (null teamId column)", () => {
    const matches = [
      { providerHomeTeamId: 10001, providerAwayTeamId: 99999, homeTeamId: null, awayTeamId: null },
    ];

    const stats = computeMatchResolutionStats("team-1", matches, 10001);

    expect(stats).toEqual({ totalMatches: 1, resolvedCount: 0, unresolvedCount: 1, mismatchedCount: 0 });
  });

  it("M-03 — counts a match mismatched (resolved to a DIFFERENT team)", () => {
    const matches = [
      { providerHomeTeamId: 10001, providerAwayTeamId: 99999, homeTeamId: "some-other-team", awayTeamId: null },
    ];

    const stats = computeMatchResolutionStats("team-1", matches, 10001);

    expect(stats).toEqual({ totalMatches: 1, resolvedCount: 0, unresolvedCount: 0, mismatchedCount: 1 });
  });

  it("M-04 — only counts matches actually referencing the given externalTeamId", () => {
    const matches = [
      { providerHomeTeamId: 99999, providerAwayTeamId: 88888, homeTeamId: null, awayTeamId: null },
      { providerHomeTeamId: 10001, providerAwayTeamId: 99999, homeTeamId: "team-1", awayTeamId: null },
      { providerHomeTeamId: 77777, providerAwayTeamId: 10001, homeTeamId: null, awayTeamId: "team-1" },
    ];

    const stats = computeMatchResolutionStats("team-1", matches, 10001);

    expect(stats.totalMatches).toBe(2);
    expect(stats.resolvedCount).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// summarizeMatchcenterResolution
// ---------------------------------------------------------------------------

describe("summarizeMatchcenterResolution", () => {
  it("M-05 — reports NO CURRENT-SEASON MATCHES for null or zero-total stats", () => {
    expect(summarizeMatchcenterResolution(null)).toBe("NO CURRENT-SEASON MATCHES");
    expect(
      summarizeMatchcenterResolution({ totalMatches: 0, resolvedCount: 0, unresolvedCount: 0, mismatchedCount: 0 }),
    ).toBe("NO CURRENT-SEASON MATCHES");
  });

  it("M-06 — prioritizes MISMATCHED over UNRESOLVED when both are present", () => {
    const summary = summarizeMatchcenterResolution({
      totalMatches: 3,
      resolvedCount: 1,
      unresolvedCount: 1,
      mismatchedCount: 1,
    });

    expect(summary).toContain("MISMATCHED");
  });
});

// ---------------------------------------------------------------------------
// summarizeInventory
// ---------------------------------------------------------------------------

describe("summarizeInventory", () => {
  it("S-01 — counts rows by classification", () => {
    const teamA = makeTeam({ id: "a", mappings: [makeMapping({ externalTeamId: 1, externalSeasonId: 2027 })] });
    const teamB = makeTeam({ id: "b", mappings: [] });
    const ownership = buildExternalTeamIdOwnership([teamA, teamB]);

    const rows = [
      classifyCanonicalTeamIdentity(teamA, ownership, 2027),
      classifyCanonicalTeamIdentity(teamB, ownership, 2027),
    ];

    const summary = summarizeInventory(rows);

    expect(summary.byClassification.LEGITIMATE_DISTINCT_TEAM).toBe(1);
    expect(summary.byClassification.UNRESOLVED_INSUFFICIENT_EVIDENCE).toBe(1);
  });

  it("S-02 — flags exact 'FC Allschwil' names for human review only (does not affect classification)", () => {
    const team = makeTeam({
      id: "generic-team",
      name: "FC Allschwil",
      mappings: [makeMapping({ externalTeamId: 1, externalSeasonId: 2027 })],
    });
    const ownership = buildExternalTeamIdOwnership([team]);
    const row = classifyCanonicalTeamIdentity(team, ownership, 2027);

    const summary = summarizeInventory([row]);

    expect(summary.genericNameCandidates).toEqual(["generic-team"]);
    expect(row.classification).toBe("LEGITIMATE_DISTINCT_TEAM");
  });
});
