/**
 * lib/match-results/types.ts
 *
 * Canonical match result types.
 *
 * These types are provider-neutral. No provider-specific identifiers,
 * enums or field names appear here. Providers map their own state to
 * MatchStatus before calling into this module.
 *
 * Architecture invariants:
 *   - MatchStatus is the only status vocabulary exposed outside this module.
 *   - EventStatus is an internal persistence detail and must not leak.
 *   - MatchResult is the single source-of-truth DTO for downstream consumers
 *     (Website, Infoboard, Standings, Team pages).
 *   - providerState / providerStateLabel are stored for audit/debugging only.
 *     Consumers MUST use MatchStatus, not providerState, for logic.
 */

// ── Canonical status ───────────────────────────────────────────────────────

/**
 * Provider-neutral canonical match status.
 *
 * Maps 1:1 onto EventStatus values (see resolveCanonicalStatus /
 * toEventStatus in match-result-service.ts). The mapping layer is the
 * only place EventStatus appears.
 */
export type MatchStatus =
  | "SCHEDULED"
  | "LIVE"
  | "FINISHED"
  | "POSTPONED"
  | "CANCELLED"
  | "ABANDONED"
  | "FORFEITED";

export const MATCH_STATUS_VALUES: readonly MatchStatus[] = [
  "SCHEDULED",
  "LIVE",
  "FINISHED",
  "POSTPONED",
  "CANCELLED",
  "ABANDONED",
  "FORFEITED",
] as const;

/** True if a match has reached a terminal state (no further score changes). */
export function isTerminalStatus(status: MatchStatus): boolean {
  return (
    status === "FINISHED" ||
    status === "CANCELLED" ||
    status === "ABANDONED" ||
    status === "FORFEITED"
  );
}

/** True if a match can have a meaningful score. */
export function isScoreableStatus(status: MatchStatus): boolean {
  return (
    status === "LIVE" ||
    status === "FINISHED" ||
    status === "ABANDONED" ||
    status === "FORFEITED"
  );
}

// ── Canonical result DTO ───────────────────────────────────────────────────

/**
 * Canonical match result.
 *
 * This is the single result object emitted by getMatchResult() and
 * consumed by Website, Infoboard, Standings (future) and Team pages.
 *
 * All provider-specific detail is in providerState / providerStateLabel,
 * which consumers must treat as opaque display-only values.
 */
export interface MatchResult {
  /** Canonical event identifier (Event.id). */
  matchId: string;
  /** Owning tenant. */
  tenantId: string;
  /** Home team goals. Null when the match has not been played. */
  homeGoals: number | null;
  /** Away team goals. Null when the match has not been played. */
  awayGoals: number | null;
  /** Canonical status — never a provider-specific value. */
  status: MatchStatus;
  /** Scheduled kick-off time (Event.startAt). */
  playedAt: Date;
  /** Last result-relevant update (MatchExternalMapping.lastSyncedAt or Event.updatedAt). */
  lastUpdated: Date;
  /** Provider that owns this mapping, e.g. "SFV". Null for manually-entered events. */
  provider: string | null;
  /** Raw provider match-state integer. Opaque — for display/audit only. */
  providerState: number | null;
  /** Human-readable provider state label. Opaque — for display/audit only. */
  providerStateLabel: string | null;
  /** Non-blocking validation warnings generated during the last update. */
  warnings: string[];
}

// ── Input types ────────────────────────────────────────────────────────────

/**
 * Input for a single canonical result update.
 *
 * Comes from a provider adapter after translating provider-specific
 * fields into canonical values. Never arrives directly from a provider
 * client without going through an adapter.
 */
export interface UpdateMatchResultInput {
  /** Canonical event identifier. */
  matchId: string;
  /** Owning tenant — MUST match the event's tenantId. */
  tenantId: string;
  /** Provider identifier, e.g. "SFV". */
  provider: string;
  /** Canonical home goals. Null when not yet played. */
  homeGoals?: number | null;
  /** Canonical away goals. Null when not yet played. */
  awayGoals?: number | null;
  /** Canonical match status. */
  status?: MatchStatus;
  /** Raw provider state integer — preserved for audit, not used for logic. */
  providerState?: number | null;
  /** Provider state label — preserved for audit, not used for logic. */
  providerStateLabel?: string | null;
}

/**
 * Input for batch result updates.
 *
 * All items MUST belong to the same tenant.
 */
export interface BatchUpdateResultsInput {
  /** Owning tenant — scopes all items. */
  tenantId: string;
  /** Provider identifier — applies to all items. */
  provider: string;
  /** Individual match updates. */
  updates: Omit<UpdateMatchResultInput, "tenantId" | "provider">[];
}

/** Outcome of a single item in a batch update. */
export interface BatchUpdateResultItem {
  matchId: string;
  outcome: "updated" | "unchanged" | "failed";
  warnings: string[];
  error?: string;
}

/** Aggregated result returned by batchUpdateResults(). */
export interface BatchUpdateResultsOutput {
  tenantId: string;
  provider: string;
  processed: number;
  updated: number;
  unchanged: number;
  failed: number;
  items: BatchUpdateResultItem[];
}

// ── Status mapping ─────────────────────────────────────────────────────────

/**
 * EventStatus values as a plain-string union to avoid importing from
 * @prisma/client inside this module. The mapping layer converts between
 * the DB enum and the canonical MatchStatus.
 */
export type EventStatusValue =
  | "DRAFT"
  | "SCHEDULED"
  | "LIVE"
  | "COMPLETED"
  | "CANCELLED"
  | "POSTPONED"
  | "ARCHIVED"
  | "ABANDONED"
  | "FORFEITED";

/**
 * Convert a raw EventStatus string to the canonical MatchStatus.
 *
 * ARCHIVED throws so callers can surface a structured MATCH_ARCHIVED error
 * before calling this function; this overload returns "SCHEDULED" as a safe
 * fallback for DRAFT/ARCHIVED if somehow they slip through.
 *
 * Exported here (not in match-result-service) so queries.ts can use it
 * without creating a circular dependency.
 */
export function resolveCanonicalStatus(rawStatus: string): MatchStatus {
  switch (rawStatus as EventStatusValue) {
    case "DRAFT":
    case "SCHEDULED":
      return "SCHEDULED";
    case "LIVE":
      return "LIVE";
    case "COMPLETED":
      return "FINISHED";
    case "CANCELLED":
      return "CANCELLED";
    case "POSTPONED":
      return "POSTPONED";
    case "ABANDONED":
      return "ABANDONED";
    case "FORFEITED":
      return "FORFEITED";
    case "ARCHIVED":
    default:
      return "SCHEDULED";
  }
}

/**
 * Convert a canonical MatchStatus to the EventStatus string for persistence.
 *
 * Exported here (not in match-result-service) to break circular imports.
 */
export function toEventStatus(status: MatchStatus): EventStatusValue {
  switch (status) {
    case "SCHEDULED":
      return "SCHEDULED";
    case "LIVE":
      return "LIVE";
    case "FINISHED":
      return "COMPLETED";
    case "CANCELLED":
      return "CANCELLED";
    case "POSTPONED":
      return "POSTPONED";
    case "ABANDONED":
      return "ABANDONED";
    case "FORFEITED":
      return "FORFEITED";
  }
}

/**
 * Build the canonical result label string from scores.
 * Returns null when the match has no score yet.
 */
export function buildResultLabel(
  homeGoals: number | null,
  awayGoals: number | null,
): string | null {
  if (homeGoals === null || awayGoals === null) {
    return null;
  }

  return `${homeGoals}:${awayGoals}`;
}

// ── Publish types ──────────────────────────────────────────────────────────

/**
 * Input for publishMatchResult().
 *
 * Publishing writes the canonical score display label (resultLabel) onto
 * the Event so that Website, Infoboard and Team pages can render a
 * pre-formatted score string without re-computing it.
 */
export interface PublishMatchResultInput {
  matchId: string;
  tenantId: string;
  provider: string;
}
