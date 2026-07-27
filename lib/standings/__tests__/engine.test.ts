/**
 * Tests for lib/standings/engine.ts
 *
 * Covers the pure calculation layer — no database, no providers.
 *
 * Test scenarios:
 *   A. Empty competition
 *   B. Single match
 *   C. Multiple matches
 *   D. Draws
 *   E. Goal difference tiebreaker
 *   F. Goals scored tiebreaker
 *   G. Alphabetical tiebreaker
 *   H. Duplicate match detection
 *   I. Cross-tenant match detection
 *   J. Invalid score detection
 *   K. Missing team (not in registry) — match skipped, no error
 *   L. Non-FINISHED statuses excluded
 *   M. Multiple teams zero-seeded
 *   N. Provider neutrality (engine has no provider types)
 *   O. Custom point model
 */

import { describe, it, expect } from "vitest";

import {
  buildStandingTable,
  extractTeamRow,
  validateMatchResults,
  isEligibleForStandings,
  type TeamDescriptor,
} from "../engine";
import type { CanonicalMatchResult } from "../types";
import { StandingsError } from "../errors";
import { DefaultPointModel } from "../point-model";

// ── Fixtures ─────────────────────────────────────────────────────────────────

const TENANT = "tenant-a";
const COMPETITION = "comp-1";

function makeTeam(id: string, name: string): TeamDescriptor {
  return { teamSeasonId: id, teamName: name, competitionId: COMPETITION };
}

function makeRegistry(...teams: TeamDescriptor[]): Map<string, TeamDescriptor> {
  return new Map(teams.map((t) => [t.teamSeasonId, t]));
}

function makeResult(
  overrides: Partial<CanonicalMatchResult> & {
    matchId: string;
    homeTeamSeasonId: string;
    awayTeamSeasonId: string;
    scoreHome: number;
    scoreAway: number;
  },
): CanonicalMatchResult {
  return {
    tenantId: TENANT,
    competitionId: COMPETITION,
    status: "FINISHED",
    playedAt: new Date("2026-08-01T15:00:00Z"),
    ...overrides,
  };
}

// ── A. Empty competition ──────────────────────────────────────────────────────

describe("A. Empty competition", () => {
  it("returns empty rows when no teams are enrolled", () => {
    const table = buildStandingTable(COMPETITION, TENANT, [], new Map());
    expect(table.rows).toHaveLength(0);
    expect(table.matchCount).toBe(0);
    expect(table.lastUpdatedAt).toBeNull();
  });

  it("returns zero-stats rows when teams enrolled but no matches", () => {
    const registry = makeRegistry(
      makeTeam("ts-1", "FC Alpha"),
      makeTeam("ts-2", "FC Beta"),
    );
    const table = buildStandingTable(COMPETITION, TENANT, [], registry);
    expect(table.rows).toHaveLength(2);
    expect(table.rows.every((r) => r.played === 0)).toBe(true);
    expect(table.rows.every((r) => r.points === 0)).toBe(true);
  });
});

// ── B. Single match ───────────────────────────────────────────────────────────

describe("B. Single match", () => {
  const registry = makeRegistry(
    makeTeam("ts-1", "FC Alpha"),
    makeTeam("ts-2", "FC Beta"),
  );

  it("awards 3 points to the winner", () => {
    const result = makeResult({
      matchId: "m-1",
      homeTeamSeasonId: "ts-1",
      awayTeamSeasonId: "ts-2",
      scoreHome: 2,
      scoreAway: 1,
    });

    const table = buildStandingTable(COMPETITION, TENANT, [result], registry);
    const winner = table.rows.find((r) => r.teamSeasonId === "ts-1")!;
    const loser = table.rows.find((r) => r.teamSeasonId === "ts-2")!;

    expect(winner.points).toBe(3);
    expect(winner.won).toBe(1);
    expect(winner.played).toBe(1);
    expect(loser.points).toBe(0);
    expect(loser.lost).toBe(1);
    expect(loser.played).toBe(1);
  });

  it("sets correct goals for and against", () => {
    const result = makeResult({
      matchId: "m-1",
      homeTeamSeasonId: "ts-1",
      awayTeamSeasonId: "ts-2",
      scoreHome: 3,
      scoreAway: 1,
    });

    const table = buildStandingTable(COMPETITION, TENANT, [result], registry);
    const home = table.rows.find((r) => r.teamSeasonId === "ts-1")!;
    const away = table.rows.find((r) => r.teamSeasonId === "ts-2")!;

    expect(home.goalsFor).toBe(3);
    expect(home.goalsAgainst).toBe(1);
    expect(home.goalDifference).toBe(2);
    expect(away.goalsFor).toBe(1);
    expect(away.goalsAgainst).toBe(3);
    expect(away.goalDifference).toBe(-2);
  });

  it("places winner at position 1", () => {
    const result = makeResult({
      matchId: "m-1",
      homeTeamSeasonId: "ts-1",
      awayTeamSeasonId: "ts-2",
      scoreHome: 1,
      scoreAway: 0,
    });
    const table = buildStandingTable(COMPETITION, TENANT, [result], registry);
    expect(table.rows[0].teamSeasonId).toBe("ts-1");
    expect(table.rows[0].position).toBe(1);
    expect(table.rows[1].position).toBe(2);
  });
});

// ── C. Multiple matches ───────────────────────────────────────────────────────

describe("C. Multiple matches", () => {
  const registry = makeRegistry(
    makeTeam("ts-1", "FC Alpha"),
    makeTeam("ts-2", "FC Beta"),
    makeTeam("ts-3", "FC Gamma"),
  );

  it("accumulates results across multiple matches", () => {
    const results: CanonicalMatchResult[] = [
      makeResult({ matchId: "m-1", homeTeamSeasonId: "ts-1", awayTeamSeasonId: "ts-2", scoreHome: 2, scoreAway: 1 }),
      makeResult({ matchId: "m-2", homeTeamSeasonId: "ts-1", awayTeamSeasonId: "ts-3", scoreHome: 3, scoreAway: 0 }),
      makeResult({ matchId: "m-3", homeTeamSeasonId: "ts-2", awayTeamSeasonId: "ts-3", scoreHome: 1, scoreAway: 1 }),
    ];

    const table = buildStandingTable(COMPETITION, TENANT, results, registry);
    const alpha = table.rows.find((r) => r.teamSeasonId === "ts-1")!;
    const beta = table.rows.find((r) => r.teamSeasonId === "ts-2")!;
    const gamma = table.rows.find((r) => r.teamSeasonId === "ts-3")!;

    expect(alpha.played).toBe(2);
    expect(alpha.won).toBe(2);
    expect(alpha.points).toBe(6);

    expect(beta.played).toBe(2);
    expect(beta.won).toBe(0);
    expect(beta.draw).toBe(1);
    expect(beta.lost).toBe(1);
    expect(beta.points).toBe(1);

    expect(gamma.played).toBe(2);
    expect(gamma.draw).toBe(1);
    expect(gamma.lost).toBe(1);
    expect(gamma.points).toBe(1);
  });

  it("sets matchCount correctly", () => {
    const results: CanonicalMatchResult[] = [
      makeResult({ matchId: "m-1", homeTeamSeasonId: "ts-1", awayTeamSeasonId: "ts-2", scoreHome: 1, scoreAway: 0 }),
      makeResult({ matchId: "m-2", homeTeamSeasonId: "ts-2", awayTeamSeasonId: "ts-3", scoreHome: 2, scoreAway: 2 }),
    ];
    const table = buildStandingTable(COMPETITION, TENANT, results, registry);
    expect(table.matchCount).toBe(2);
  });
});

// ── D. Draws ──────────────────────────────────────────────────────────────────

describe("D. Draws", () => {
  const registry = makeRegistry(
    makeTeam("ts-1", "FC Alpha"),
    makeTeam("ts-2", "FC Beta"),
  );

  it("awards 1 point to each team in a draw", () => {
    const result = makeResult({
      matchId: "m-1",
      homeTeamSeasonId: "ts-1",
      awayTeamSeasonId: "ts-2",
      scoreHome: 1,
      scoreAway: 1,
    });
    const table = buildStandingTable(COMPETITION, TENANT, [result], registry);
    expect(table.rows[0].points).toBe(1);
    expect(table.rows[1].points).toBe(1);
    expect(table.rows[0].draw).toBe(1);
    expect(table.rows[1].draw).toBe(1);
    expect(table.rows[0].won).toBe(0);
    expect(table.rows[0].lost).toBe(0);
  });

  it("handles 0-0 draw correctly", () => {
    const result = makeResult({
      matchId: "m-1",
      homeTeamSeasonId: "ts-1",
      awayTeamSeasonId: "ts-2",
      scoreHome: 0,
      scoreAway: 0,
    });
    const table = buildStandingTable(COMPETITION, TENANT, [result], registry);
    const r1 = table.rows.find((r) => r.teamSeasonId === "ts-1")!;
    expect(r1.draw).toBe(1);
    expect(r1.goalsFor).toBe(0);
    expect(r1.goalDifference).toBe(0);
  });
});

// ── E. Goal difference tiebreaker ────────────────────────────────────────────

describe("E. Goal difference tiebreaker", () => {
  it("sorts by goal difference when points are equal", () => {
    const registry = makeRegistry(
      makeTeam("ts-1", "FC Alpha"),
      makeTeam("ts-2", "FC Beta"),
      makeTeam("ts-3", "FC Gamma"),
    );
    const results: CanonicalMatchResult[] = [
      // ts-1 beats ts-3 by 3 goals
      makeResult({ matchId: "m-1", homeTeamSeasonId: "ts-1", awayTeamSeasonId: "ts-3", scoreHome: 3, scoreAway: 0 }),
      // ts-2 beats ts-3 by 1 goal
      makeResult({ matchId: "m-2", homeTeamSeasonId: "ts-2", awayTeamSeasonId: "ts-3", scoreHome: 1, scoreAway: 0 }),
    ];
    const table = buildStandingTable(COMPETITION, TENANT, results, registry);
    // ts-1 and ts-2 both have 3 points, but ts-1 has GD=3 vs ts-2 GD=1
    expect(table.rows[0].teamSeasonId).toBe("ts-1");
    expect(table.rows[1].teamSeasonId).toBe("ts-2");
  });
});

// ── F. Goals scored tiebreaker ────────────────────────────────────────────────

describe("F. Goals scored tiebreaker", () => {
  it("sorts by goals for when points and GD are equal", () => {
    const registry = makeRegistry(
      makeTeam("ts-1", "FC Alpha"),
      makeTeam("ts-2", "FC Beta"),
      makeTeam("ts-3", "FC Gamma"),
      makeTeam("ts-4", "FC Delta"),
    );
    const results: CanonicalMatchResult[] = [
      // ts-1: +2 GD from 3-1
      makeResult({ matchId: "m-1", homeTeamSeasonId: "ts-1", awayTeamSeasonId: "ts-3", scoreHome: 3, scoreAway: 1 }),
      // ts-2: +2 GD from 2-0 (same GD, fewer GF)
      makeResult({ matchId: "m-2", homeTeamSeasonId: "ts-2", awayTeamSeasonId: "ts-4", scoreHome: 2, scoreAway: 0 }),
    ];
    const table = buildStandingTable(COMPETITION, TENANT, results, registry);
    // ts-1 and ts-2 both have 3 pts, GD=2 each, but ts-1 scored 3 vs ts-2 scored 2
    const pos1 = table.rows.find((r) => r.teamSeasonId === "ts-1")!;
    const pos2 = table.rows.find((r) => r.teamSeasonId === "ts-2")!;
    expect(pos1.position).toBeLessThan(pos2.position);
  });
});

// ── G. Alphabetical tiebreaker ────────────────────────────────────────────────

describe("G. Alphabetical tiebreaker", () => {
  it("sorts alphabetically when all stats are equal", () => {
    const registry = makeRegistry(
      makeTeam("ts-1", "Zeta FC"),
      makeTeam("ts-2", "Alpha FC"),
    );
    // Both teams with no matches — all zero
    const table = buildStandingTable(COMPETITION, TENANT, [], registry);
    expect(table.rows[0].teamName).toBe("Alpha FC");
    expect(table.rows[1].teamName).toBe("Zeta FC");
  });
});

// ── H. Duplicate match detection ─────────────────────────────────────────────

describe("H. Duplicate match detection", () => {
  it("throws DUPLICATE_MATCH when the same matchId appears twice", () => {
    const registry = makeRegistry(
      makeTeam("ts-1", "FC Alpha"),
      makeTeam("ts-2", "FC Beta"),
    );
    const results: CanonicalMatchResult[] = [
      makeResult({ matchId: "m-1", homeTeamSeasonId: "ts-1", awayTeamSeasonId: "ts-2", scoreHome: 1, scoreAway: 0 }),
      makeResult({ matchId: "m-1", homeTeamSeasonId: "ts-1", awayTeamSeasonId: "ts-2", scoreHome: 1, scoreAway: 0 }),
    ];
    let caught: unknown;
    try {
      buildStandingTable(COMPETITION, TENANT, results, registry);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(StandingsError);
    expect((caught as StandingsError).code).toBe("DUPLICATE_MATCH");
  });

  it("throws StandingsError with code DUPLICATE_MATCH", () => {
    const registry = makeRegistry(makeTeam("ts-1", "FC Alpha"), makeTeam("ts-2", "FC Beta"));
    const results = [
      makeResult({ matchId: "dup", homeTeamSeasonId: "ts-1", awayTeamSeasonId: "ts-2", scoreHome: 1, scoreAway: 0 }),
      makeResult({ matchId: "dup", homeTeamSeasonId: "ts-1", awayTeamSeasonId: "ts-2", scoreHome: 2, scoreAway: 0 }),
    ];
    let caught: unknown;
    try {
      buildStandingTable(COMPETITION, TENANT, results, registry);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(StandingsError);
    expect((caught as StandingsError).code).toBe("DUPLICATE_MATCH");
  });
});

// ── I. Cross-tenant match detection ──────────────────────────────────────────

describe("I. Cross-tenant match detection", () => {
  it("throws CROSS_TENANT_MATCH when a result has a different tenantId", () => {
    const registry = makeRegistry(
      makeTeam("ts-1", "FC Alpha"),
      makeTeam("ts-2", "FC Beta"),
    );
    const result = makeResult({
      matchId: "m-1",
      homeTeamSeasonId: "ts-1",
      awayTeamSeasonId: "ts-2",
      scoreHome: 1,
      scoreAway: 0,
      tenantId: "tenant-b", // different tenant
    });
    expect(() =>
      buildStandingTable(COMPETITION, TENANT, [result], registry),
    ).toThrow(StandingsError);
    let caught: unknown;
    try {
      buildStandingTable(COMPETITION, TENANT, [result], registry);
    } catch (e) {
      caught = e;
    }
    expect((caught as StandingsError).code).toBe("CROSS_TENANT_MATCH");
  });
});

// ── J. Invalid score detection ────────────────────────────────────────────────

describe("J. Invalid score detection", () => {
  const registry = makeRegistry(
    makeTeam("ts-1", "FC Alpha"),
    makeTeam("ts-2", "FC Beta"),
  );

  it("throws INVALID_SCORE for negative scoreHome", () => {
    const result = makeResult({
      matchId: "m-1",
      homeTeamSeasonId: "ts-1",
      awayTeamSeasonId: "ts-2",
      scoreHome: -1,
      scoreAway: 2,
    });
    let caught: unknown;
    try {
      buildStandingTable(COMPETITION, TENANT, [result], registry);
    } catch (e) {
      caught = e;
    }
    expect((caught as StandingsError).code).toBe("INVALID_SCORE");
  });

  it("throws INVALID_SCORE for non-integer score", () => {
    const result = makeResult({
      matchId: "m-1",
      homeTeamSeasonId: "ts-1",
      awayTeamSeasonId: "ts-2",
      scoreHome: 1.5,
      scoreAway: 1,
    });
    let caught: unknown;
    try {
      buildStandingTable(COMPETITION, TENANT, [result], registry);
    } catch (e) {
      caught = e;
    }
    expect((caught as StandingsError).code).toBe("INVALID_SCORE");
  });
});

// ── K. Missing team (not in registry) ────────────────────────────────────────

describe("K. Missing team (not in registry)", () => {
  it("skips matches where either team is absent from the registry", () => {
    const registry = makeRegistry(makeTeam("ts-1", "FC Alpha"));
    // ts-2 is not in the registry
    const result = makeResult({
      matchId: "m-1",
      homeTeamSeasonId: "ts-1",
      awayTeamSeasonId: "ts-unknown",
      scoreHome: 2,
      scoreAway: 0,
    });
    const table = buildStandingTable(COMPETITION, TENANT, [result], registry);
    // Match is skipped — ts-1 should have 0 played
    const alpha = table.rows.find((r) => r.teamSeasonId === "ts-1")!;
    expect(alpha.played).toBe(0);
  });
});

// ── L. Non-FINISHED statuses excluded ────────────────────────────────────────

describe("L. Non-FINISHED statuses excluded", () => {
  const registry = makeRegistry(
    makeTeam("ts-1", "FC Alpha"),
    makeTeam("ts-2", "FC Beta"),
  );

  for (const status of ["LIVE", "SCHEDULED", "POSTPONED", "CANCELLED", "ABANDONED", "FORFEITED"] as const) {
    it(`excludes ${status} matches`, () => {
      const result = makeResult({
        matchId: "m-1",
        homeTeamSeasonId: "ts-1",
        awayTeamSeasonId: "ts-2",
        scoreHome: 2,
        scoreAway: 1,
        status,
      });
      const table = buildStandingTable(COMPETITION, TENANT, [result], registry);
      expect(table.rows.every((r) => r.played === 0)).toBe(true);
      expect(table.matchCount).toBe(0);
    });
  }

  it("includes FINISHED matches", () => {
    const result = makeResult({
      matchId: "m-1",
      homeTeamSeasonId: "ts-1",
      awayTeamSeasonId: "ts-2",
      scoreHome: 2,
      scoreAway: 1,
      status: "FINISHED",
    });
    const table = buildStandingTable(COMPETITION, TENANT, [result], registry);
    expect(table.matchCount).toBe(1);
  });
});

// ── M. Multiple competitions ──────────────────────────────────────────────────

describe("M. Multiple competitions", () => {
  it("each competition is calculated independently", () => {
    const comp1 = "comp-1";
    const comp2 = "comp-2";

    const registry1 = new Map([
      ["ts-1", { teamSeasonId: "ts-1", teamName: "FC Alpha", competitionId: comp1 }],
      ["ts-2", { teamSeasonId: "ts-2", teamName: "FC Beta", competitionId: comp1 }],
    ]);
    const registry2 = new Map([
      ["ts-3", { teamSeasonId: "ts-3", teamName: "FC Gamma", competitionId: comp2 }],
      ["ts-4", { teamSeasonId: "ts-4", teamName: "FC Delta", competitionId: comp2 }],
    ]);

    const results1: CanonicalMatchResult[] = [
      makeResult({ matchId: "m-1", homeTeamSeasonId: "ts-1", awayTeamSeasonId: "ts-2", scoreHome: 2, scoreAway: 0, competitionId: comp1 }),
    ];
    const results2: CanonicalMatchResult[] = [
      makeResult({ matchId: "m-2", homeTeamSeasonId: "ts-3", awayTeamSeasonId: "ts-4", scoreHome: 1, scoreAway: 1, competitionId: comp2 }),
    ];

    const table1 = buildStandingTable(comp1, TENANT, results1, registry1);
    const table2 = buildStandingTable(comp2, TENANT, results2, registry2);

    expect(table1.rows[0].teamSeasonId).toBe("ts-1");
    expect(table1.rows[0].points).toBe(3);
    expect(table2.rows[0].draw).toBe(1);
    expect(table2.rows[0].points).toBe(1);
  });
});

// ── N. Provider neutrality ────────────────────────────────────────────────────

describe("N. Provider neutrality", () => {
  it("engine has no provider-specific fields in its output", () => {
    const registry = makeRegistry(makeTeam("ts-1", "FC Alpha"), makeTeam("ts-2", "FC Beta"));
    const result = makeResult({
      matchId: "m-1",
      homeTeamSeasonId: "ts-1",
      awayTeamSeasonId: "ts-2",
      scoreHome: 1,
      scoreAway: 0,
    });
    const table = buildStandingTable(COMPETITION, TENANT, [result], registry);
    const row = table.rows[0];

    // No provider fields in StandingRow
    expect("providerTeamId" in row).toBe(false);
    expect("externalTeamId" in row).toBe(false);
    expect("provider" in row).toBe(false);
    expect("sfvTeamId" in row).toBe(false);
  });
});

// ── O. Custom point model ─────────────────────────────────────────────────────

describe("O. Custom point model", () => {
  it("supports a custom two-points-for-a-win model", () => {
    const registry = makeRegistry(
      makeTeam("ts-1", "FC Alpha"),
      makeTeam("ts-2", "FC Beta"),
    );
    const twoPointModel = new DefaultPointModel();
    // Override by creating an inline implementation
    const customModel = {
      pointsFor: (outcome: "WIN" | "DRAW" | "LOSS") => {
        if (outcome === "WIN") return 2;
        if (outcome === "DRAW") return 1;
        return 0;
      },
    };
    const result = makeResult({
      matchId: "m-1",
      homeTeamSeasonId: "ts-1",
      awayTeamSeasonId: "ts-2",
      scoreHome: 2,
      scoreAway: 1,
    });
    const table = buildStandingTable(COMPETITION, TENANT, [result], registry, customModel);
    const winner = table.rows.find((r) => r.teamSeasonId === "ts-1")!;
    expect(winner.points).toBe(2); // custom model gives 2 for a win
  });
});

// ── P. isEligibleForStandings ─────────────────────────────────────────────────

describe("P. isEligibleForStandings", () => {
  it("returns true for FINISHED", () => {
    expect(isEligibleForStandings("FINISHED")).toBe(true);
  });

  it("returns false for all other statuses", () => {
    for (const s of ["LIVE", "SCHEDULED", "POSTPONED", "CANCELLED", "ABANDONED", "FORFEITED"] as const) {
      expect(isEligibleForStandings(s)).toBe(false);
    }
  });

  it("supports custom eligibility set (e.g. including FORFEITED)", () => {
    const customSet = new Set(["FINISHED", "FORFEITED"] as const);
    expect(isEligibleForStandings("FORFEITED", customSet)).toBe(true);
    expect(isEligibleForStandings("ABANDONED", customSet)).toBe(false);
  });
});

// ── Q. extractTeamRow ─────────────────────────────────────────────────────────

describe("Q. extractTeamRow", () => {
  it("returns the correct row for a team in the table", () => {
    const registry = makeRegistry(makeTeam("ts-1", "FC Alpha"), makeTeam("ts-2", "FC Beta"));
    const result = makeResult({
      matchId: "m-1",
      homeTeamSeasonId: "ts-1",
      awayTeamSeasonId: "ts-2",
      scoreHome: 1,
      scoreAway: 0,
    });
    const table = buildStandingTable(COMPETITION, TENANT, [result], registry);
    const row = extractTeamRow(table, "ts-1");
    expect(row).not.toBeNull();
    expect(row!.won).toBe(1);
  });

  it("returns null for a team not in the table", () => {
    const registry = makeRegistry(makeTeam("ts-1", "FC Alpha"));
    const table = buildStandingTable(COMPETITION, TENANT, [], registry);
    expect(extractTeamRow(table, "ts-unknown")).toBeNull();
  });
});

// ── R. lastUpdatedAt ──────────────────────────────────────────────────────────

describe("R. lastUpdatedAt", () => {
  it("is null when there are no FINISHED matches", () => {
    const registry = makeRegistry(makeTeam("ts-1", "FC Alpha"), makeTeam("ts-2", "FC Beta"));
    const table = buildStandingTable(COMPETITION, TENANT, [], registry);
    expect(table.lastUpdatedAt).toBeNull();
  });

  it("is the date of the latest FINISHED match", () => {
    const registry = makeRegistry(makeTeam("ts-1", "FC Alpha"), makeTeam("ts-2", "FC Beta"));
    const results: CanonicalMatchResult[] = [
      makeResult({ matchId: "m-1", homeTeamSeasonId: "ts-1", awayTeamSeasonId: "ts-2", scoreHome: 1, scoreAway: 0, playedAt: new Date("2026-08-01") }),
      makeResult({ matchId: "m-2", homeTeamSeasonId: "ts-2", awayTeamSeasonId: "ts-1", scoreHome: 0, scoreAway: 2, playedAt: new Date("2026-09-15") }),
    ];
    const table = buildStandingTable(COMPETITION, TENANT, results, registry);
    expect(table.lastUpdatedAt?.toISOString().startsWith("2026-09-15")).toBe(true);
  });
});
