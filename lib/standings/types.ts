/**
 * lib/standings/types.ts
 *
 * Canonical type definitions for the SportClubEvo standings engine.
 *
 * STANDINGS-01: Establishes the provider-neutral contract for all standings
 * calculations. The engine consumes only CanonicalMatchResult — it never reads
 * provider payloads, SFV structures, or any integration-specific data.
 *
 * Architecture invariants:
 *   - No provider-specific types here.
 *   - No Prisma types here.
 *   - All input to the engine is expressed as CanonicalMatchResult.
 *   - All output is expressed as StandingRow / StandingTable.
 */

// ── Canonical match status ──────────────────────────────────────────────────

/**
 * Canonical match lifecycle status, independent of any provider.
 *
 * FINISHED   — match has been played and a final score is available.
 * LIVE       — match is currently in progress.
 * SCHEDULED  — match is confirmed but not yet played.
 * POSTPONED  — match has been deferred to a later date.
 * CANCELLED  — match has been permanently cancelled.
 * ABANDONED  — match was started but not completed (no official result).
 * FORFEITED  — one team forfeited; points may apply under competition rules.
 *
 * Only FINISHED matches are counted in the default standings calculation.
 * FORFEITED and ABANDONED are excluded by default but the architecture
 * supports competition-specific rules that may award points for these statuses.
 */
export type CanonicalMatchStatus =
  | "FINISHED"
  | "LIVE"
  | "SCHEDULED"
  | "POSTPONED"
  | "CANCELLED"
  | "ABANDONED"
  | "FORFEITED";

// ── Canonical match result ──────────────────────────────────────────────────

/**
 * The single input type consumed by the standings engine.
 *
 * This is the canonical representation of a completed (or special-status) match.
 * It is produced by the match result layer (MATCH-RESULTS-01) and consumed by
 * the standings engine. The engine never interacts with provider payloads.
 *
 * Both homeTeamSeasonId and awayTeamSeasonId MUST be resolved to canonical
 * TeamSeason identifiers. Unresolved matches are never passed to the engine.
 */
export interface CanonicalMatchResult {
  /** Canonical Event identifier. */
  matchId: string;
  /** Owning tenant identifier. */
  tenantId: string;
  /** Canonical Competition identifier this match belongs to. */
  competitionId: string;
  /** Canonical TeamSeason identifier for the home team. */
  homeTeamSeasonId: string;
  /** Canonical TeamSeason identifier for the away team. */
  awayTeamSeasonId: string;
  /** Final score for the home team. Must be a non-negative integer. */
  scoreHome: number;
  /** Final score for the away team. Must be a non-negative integer. */
  scoreAway: number;
  /** Canonical match status at the time this result was produced. */
  status: CanonicalMatchStatus;
  /** The date/time the match was played. */
  playedAt: Date;
}

// ── Standing row ────────────────────────────────────────────────────────────

/**
 * A single team's row in a standings table.
 *
 * This is the canonical DTO exposed by the engine and the public API.
 * It contains only calculated fields — no provider identifiers.
 */
export interface StandingRow {
  /** 1-based position after sorting. */
  position: number;
  /** Canonical TeamSeason identifier. */
  teamSeasonId: string;
  /** Display name for the team in this season. */
  teamName: string;
  /** Canonical Competition identifier. */
  competitionId: string;
  /** Total matches played. */
  played: number;
  /** Matches won. */
  won: number;
  /** Matches drawn. */
  draw: number;
  /** Matches lost. */
  lost: number;
  /** Total goals scored. */
  goalsFor: number;
  /** Total goals conceded. */
  goalsAgainst: number;
  /** goalsFor − goalsAgainst. */
  goalDifference: number;
  /** Accumulated points according to the active point model. */
  points: number;
}

/**
 * A complete standings table for one competition.
 */
export interface StandingTable {
  competitionId: string;
  tenantId: string;
  rows: StandingRow[];
  /** ISO timestamp of the last FINISHED match included in this table. */
  lastUpdatedAt: Date | null;
  /** Total number of FINISHED matches that contributed to this table. */
  matchCount: number;
}

// ── Point model ─────────────────────────────────────────────────────────────

/**
 * Outcome of a single match from one team's perspective.
 */
export type MatchOutcome = "WIN" | "DRAW" | "LOSS";

/**
 * Point model interface.
 *
 * Implement this interface to support different sports or competition-specific
 * point rules. The engine calls pointsFor() once per resolved match per team.
 *
 * Implementors:
 *   - DefaultPointModel: Win=3, Draw=1, Loss=0 (canonical default).
 *   - Future: BonusPointModel, DeductionModel, etc.
 */
export interface IPointModel {
  /**
   * Returns the number of points awarded for the given outcome.
   * Must return a non-negative integer.
   */
  pointsFor(outcome: MatchOutcome): number;
}

// ── Service input types ─────────────────────────────────────────────────────

/**
 * Input for calculating standings for a single competition.
 */
export interface CalculateCompetitionStandingsInput {
  tenantId: string;
  competitionId: string;
  pointModel?: IPointModel;
}

/**
 * Input for calculating a single team's row in a competition.
 */
export interface CalculateTeamStandingInput {
  tenantId: string;
  competitionId: string;
  teamSeasonId: string;
  pointModel?: IPointModel;
}

/**
 * Input for calculating standings across all competitions for a tenant.
 */
export interface CalculateTenantStandingsInput {
  tenantId: string;
  pointModel?: IPointModel;
}

/**
 * Result of a tenant-wide standings calculation.
 * One StandingTable per competition.
 */
export interface TenantStandingsResult {
  tenantId: string;
  tables: StandingTable[];
}

// ── Statuses eligible for standings ────────────────────────────────────────

/**
 * The canonical set of match statuses that contribute to standings by default.
 *
 * Only FINISHED matches count. The engine's filter function uses this set.
 * Future competition rules may extend this (e.g. to include FORFEITED).
 */
export const STANDINGS_ELIGIBLE_STATUSES: ReadonlySet<CanonicalMatchStatus> =
  new Set<CanonicalMatchStatus>(["FINISHED"]);
