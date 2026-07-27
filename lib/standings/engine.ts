/**
 * lib/standings/engine.ts
 *
 * Core standings calculation engine for SportClubEvo.
 *
 * STANDINGS-01: This module is the heart of the canonical standings system.
 * It is 100% provider-neutral — it operates only on CanonicalMatchResult
 * and TeamSeason data. It never reads provider payloads or SFV structures.
 *
 * All functions in this module are pure (no side effects, no I/O).
 * They can be tested in isolation without a database or provider adapter.
 *
 * Architecture invariants:
 *   - No imports from lib/integrations, lib/matchcenter, or any SFV module.
 *   - No Prisma imports.
 *   - No HTTP imports.
 *   - Input: CanonicalMatchResult[].
 *   - Output: StandingTable.
 *
 * Future extensibility:
 *   - Bonus points: implement a BonusPointModel and pass it in.
 *   - Deductions: post-process the StandingTable rows.
 *   - Multi-stage / group stages: call buildStandingTable() per stage.
 *   - Playoffs: layer a separate engine over the table.
 *   - Manual adjustments: adjust rows after buildStandingTable() returns.
 */

import type {
  CanonicalMatchResult,
  IPointModel,
  StandingRow,
  StandingTable,
  CanonicalMatchStatus,
} from "./types";
import { STANDINGS_ELIGIBLE_STATUSES } from "./types";
import { StandingsError } from "./errors";
import { defaultPointModel, resolveOutcomes } from "./point-model";

// ── Team registry ───────────────────────────────────────────────────────────

/**
 * Minimal team descriptor required by the engine.
 * Resolved from TeamSeason — never from provider identifiers.
 */
export interface TeamDescriptor {
  teamSeasonId: string;
  teamName: string;
  competitionId: string;
}

// ── Mutable accumulator ─────────────────────────────────────────────────────

interface TeamAccumulator {
  teamSeasonId: string;
  teamName: string;
  competitionId: string;
  played: number;
  won: number;
  draw: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
}

function createAccumulator(team: TeamDescriptor): TeamAccumulator {
  return {
    teamSeasonId: team.teamSeasonId,
    teamName: team.teamName,
    competitionId: team.competitionId,
    played: 0,
    won: 0,
    draw: 0,
    lost: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    points: 0,
  };
}

// ── Validation ──────────────────────────────────────────────────────────────

/**
 * Validates a set of CanonicalMatchResult records before calculation.
 *
 * Detects:
 *   - Duplicate match IDs
 *   - Negative or non-integer scores
 *   - Cross-tenant matches (home and away in different tenants)
 *   - Teams not in the provided team registry
 *
 * @throws StandingsError on the first critical violation.
 * @returns a list of non-critical warnings (e.g. unresolved teams).
 */
export function validateMatchResults(
  results: CanonicalMatchResult[],
  teamRegistry: Map<string, TeamDescriptor>,
  tenantId: string,
): string[] {
  const warnings: string[] = [];
  const seenMatchIds = new Set<string>();

  for (const result of results) {
    // Duplicate check
    if (seenMatchIds.has(result.matchId)) {
      throw new StandingsError(
        "DUPLICATE_MATCH",
        `Duplicate matchId detected: ${result.matchId}`,
      );
    }
    seenMatchIds.add(result.matchId);

    // Cross-tenant check
    if (result.tenantId !== tenantId) {
      throw new StandingsError(
        "CROSS_TENANT_MATCH",
        `Match ${result.matchId} belongs to tenant ${result.tenantId}, expected ${tenantId}`,
      );
    }

    // Score validation
    if (
      !Number.isInteger(result.scoreHome) ||
      result.scoreHome < 0 ||
      !Number.isInteger(result.scoreAway) ||
      result.scoreAway < 0
    ) {
      throw new StandingsError(
        "INVALID_SCORE",
        `Match ${result.matchId} has invalid score: ${result.scoreHome}:${result.scoreAway}`,
      );
    }

    // Team registry check (warn but don't throw — partial tables are allowed)
    if (!teamRegistry.has(result.homeTeamSeasonId)) {
      warnings.push(
        `Match ${result.matchId}: homeTeamSeasonId ${result.homeTeamSeasonId} not in team registry`,
      );
    }
    if (!teamRegistry.has(result.awayTeamSeasonId)) {
      warnings.push(
        `Match ${result.matchId}: awayTeamSeasonId ${result.awayTeamSeasonId} not in team registry`,
      );
    }
  }

  return warnings;
}

// ── Status filter ───────────────────────────────────────────────────────────

/**
 * Returns true if a match result should be included in standings.
 *
 * By default only FINISHED matches count. Pass a custom eligibleStatuses set
 * to support competition rules that award points for FORFEITED / ABANDONED.
 */
export function isEligibleForStandings(
  status: CanonicalMatchStatus,
  eligibleStatuses: ReadonlySet<CanonicalMatchStatus> = STANDINGS_ELIGIBLE_STATUSES,
): boolean {
  return eligibleStatuses.has(status);
}

// ── Core accumulation ───────────────────────────────────────────────────────

/**
 * Accumulates match results into per-team statistics.
 *
 * Only matches whose status is in eligibleStatuses are counted.
 * Matches where either team is absent from teamRegistry are skipped.
 *
 * @param results     - Canonical match results (pre-validated).
 * @param teamRegistry - Map of teamSeasonId → TeamDescriptor for this competition.
 * @param pointModel  - Point allocation model.
 * @param eligibleStatuses - Which statuses contribute to standings.
 * @returns Map of teamSeasonId → TeamAccumulator.
 */
function accumulateResults(
  results: CanonicalMatchResult[],
  teamRegistry: Map<string, TeamDescriptor>,
  pointModel: IPointModel,
  eligibleStatuses: ReadonlySet<CanonicalMatchStatus>,
): Map<string, TeamAccumulator> {
  const accumulators = new Map<string, TeamAccumulator>();

  // Seed all registered teams with zero stats (even teams with no matches)
  for (const [teamSeasonId, descriptor] of teamRegistry) {
    accumulators.set(teamSeasonId, createAccumulator(descriptor));
  }

  for (const result of results) {
    if (!isEligibleForStandings(result.status, eligibleStatuses)) {
      continue;
    }

    const homeAcc = accumulators.get(result.homeTeamSeasonId);
    const awayAcc = accumulators.get(result.awayTeamSeasonId);

    // Skip matches where either team is not in the registry
    if (!homeAcc || !awayAcc) {
      continue;
    }

    const { home: homeOutcome, away: awayOutcome } = resolveOutcomes(
      result.scoreHome,
      result.scoreAway,
    );

    // Home team
    homeAcc.played += 1;
    homeAcc.goalsFor += result.scoreHome;
    homeAcc.goalsAgainst += result.scoreAway;
    homeAcc.points += pointModel.pointsFor(homeOutcome);
    if (homeOutcome === "WIN") homeAcc.won += 1;
    else if (homeOutcome === "DRAW") homeAcc.draw += 1;
    else homeAcc.lost += 1;

    // Away team
    awayAcc.played += 1;
    awayAcc.goalsFor += result.scoreAway;
    awayAcc.goalsAgainst += result.scoreHome;
    awayAcc.points += pointModel.pointsFor(awayOutcome);
    if (awayOutcome === "WIN") awayAcc.won += 1;
    else if (awayOutcome === "DRAW") awayAcc.draw += 1;
    else awayAcc.lost += 1;
  }

  return accumulators;
}

// ── Sorting ─────────────────────────────────────────────────────────────────

/**
 * Default sort order (per task spec):
 *   1. Points (desc)
 *   2. Goal Difference (desc)
 *   3. Goals For (desc)
 *   4. Team Name (asc, alphabetical tiebreaker)
 *
 * Federation-specific tiebreakers (head-to-head, away goals, etc.)
 * are NOT implemented in this slice. They can be layered on top via
 * a custom comparator passed to sortStandingRows().
 */
function defaultComparator(a: TeamAccumulator, b: TeamAccumulator): number {
  // 1. Points descending
  if (b.points !== a.points) return b.points - a.points;
  // 2. Goal difference descending
  const gdA = a.goalsFor - a.goalsAgainst;
  const gdB = b.goalsFor - b.goalsAgainst;
  if (gdB !== gdA) return gdB - gdA;
  // 3. Goals for descending
  if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
  // 4. Team name ascending
  return a.teamName.localeCompare(b.teamName);
}

// ── Public engine API ───────────────────────────────────────────────────────

/**
 * Builds a complete StandingTable from canonical match results.
 *
 * This is the primary entry point for the engine. The service layer calls
 * this after fetching results from the database.
 *
 * @param competitionId     - Canonical competition identifier.
 * @param tenantId          - Owning tenant identifier.
 * @param results           - Canonical match results for this competition.
 * @param teamRegistry      - All teams enrolled in this competition.
 * @param pointModel        - Point model to use (default: 3/1/0).
 * @param eligibleStatuses  - Which match statuses count (default: FINISHED only).
 */
export function buildStandingTable(
  competitionId: string,
  tenantId: string,
  results: CanonicalMatchResult[],
  teamRegistry: Map<string, TeamDescriptor>,
  pointModel: IPointModel = defaultPointModel,
  eligibleStatuses: ReadonlySet<CanonicalMatchStatus> = STANDINGS_ELIGIBLE_STATUSES,
): StandingTable {
  validateMatchResults(results, teamRegistry, tenantId);

  const accumulators = accumulateResults(
    results,
    teamRegistry,
    pointModel,
    eligibleStatuses,
  );

  const sorted = Array.from(accumulators.values()).sort(defaultComparator);

  const rows: StandingRow[] = sorted.map((acc, index) => ({
    position: index + 1,
    teamSeasonId: acc.teamSeasonId,
    teamName: acc.teamName,
    competitionId: acc.competitionId,
    played: acc.played,
    won: acc.won,
    draw: acc.draw,
    lost: acc.lost,
    goalsFor: acc.goalsFor,
    goalsAgainst: acc.goalsAgainst,
    goalDifference: acc.goalsFor - acc.goalsAgainst,
    points: acc.points,
  }));

  // Determine last match date
  const eligibleDates = results
    .filter((r) => isEligibleForStandings(r.status, eligibleStatuses))
    .map((r) => r.playedAt.getTime());

  const lastUpdatedAt =
    eligibleDates.length > 0
      ? new Date(Math.max(...eligibleDates))
      : null;

  const matchCount = results.filter((r) =>
    isEligibleForStandings(r.status, eligibleStatuses),
  ).length;

  return {
    competitionId,
    tenantId,
    rows,
    lastUpdatedAt,
    matchCount,
  };
}

/**
 * Extracts a single team's StandingRow from a completed StandingTable.
 *
 * Returns null when the team is not present in the table.
 */
export function extractTeamRow(
  table: StandingTable,
  teamSeasonId: string,
): StandingRow | null {
  return table.rows.find((row) => row.teamSeasonId === teamSeasonId) ?? null;
}
