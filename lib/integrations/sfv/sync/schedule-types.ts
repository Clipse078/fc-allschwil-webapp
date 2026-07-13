/**
 * lib/integrations/sfv/sync/schedule-types.ts
 *
 * Shared types for the SFV schedule (match fixture) synchronization layer.
 *
 * These types define the boundary between the provider (SFV / ClubCorner),
 * the synchronization engine, and the persistence layer.
 *
 * Security invariants:
 *   - No credentials, tokens, or raw provider payloads in any result type.
 *   - Errors are actionable and sanitized — no stack traces, no secret values.
 *   - tenantId always originates from a trusted session context.
 */

import type { SyncErrorEntry } from "./types";

// ── Sync result ────────────────────────────────────────────────────────────────

/**
 * Structured result returned by a schedule synchronization run.
 *
 * All counts are non-negative integers. Duration is in milliseconds.
 * Errors are sanitized — no credentials or provider payloads.
 *
 * This type is serializable to JSON and safe to return from API routes.
 */
export type SfvScheduleSyncResult = {
  /** ISO 8601 timestamp when synchronization started. */
  startedAt: string;
  /** ISO 8601 timestamp when synchronization finished. */
  finishedAt: string;
  /** Elapsed time in milliseconds (finishedAt − startedAt). */
  durationMs: number;
  /** Tenant that owns the synchronized data. */
  tenantId: string;
  /** External provider identifier, always "SFV" for this module. */
  source: string;
  /** SFV clubId used for the schedule request. */
  clubId: number;
  /** SFV seasonId used for the schedule request. */
  seasonId: number;
  /** ISO 8601 date of the start of the synchronization window. */
  dateFrom: string;
  /** ISO 8601 date of the end of the synchronization window. */
  dateTo: string;
  /** Number of schedule entries fetched from the provider. */
  fetched: number;
  /** Number of new matches created (no prior mapping existed). */
  created: number;
  /** Number of existing matches updated with changed provider data. */
  updated: number;
  /** Number of records with no detectable change — skipped. */
  unchanged: number;
  /** Number of individual match records that failed to persist. */
  failed: number;
  /**
   * Number of matches whose score changed (scoreHome or scoreAway updated).
   * Subset of updated.
   */
  scoresUpdated: number;
  /**
   * Number of matches whose kickoff time changed (Event.startAt updated).
   * Subset of updated.
   */
  kickoffChanges: number;
  /**
   * Number of matches whose provider match state changed.
   * Subset of updated.
   */
  statusChanges: number;
  /**
   * Number of schedule entries where neither home nor away team could be
   * resolved to a local TeamExternalMapping. The match is still created but
   * the Event.teamId will be null.
   */
  unresolvedTeams: number;
  /** Sanitized per-match error entries. Empty when failed === 0. */
  errors: SyncErrorEntry[];
};

// ── Internal sync context ──────────────────────────────────────────────────────

/**
 * Immutable context passed through all schedule synchronization steps.
 *
 * Established once from the trusted session + tenant config at the start of
 * a sync run. Never derived from provider responses or caller-supplied input.
 */
export type SfvScheduleSyncContext = {
  tenantId: string;
  clubId: number;
  seasonId: number;
  /** Optional organisation filter forwarded to the schedule request. */
  organisationId: number | null;
  /** ISO 8601 start of the sync window (inclusive). */
  dateFrom: string;
  /** ISO 8601 end of the sync window (inclusive). */
  dateTo: string;
  /** Timestamp captured at sync start — used as lastSyncedAt in persistence. */
  syncedAt: Date;
};

// ── Schedule sync window defaults ──────────────────────────────────────────────

/**
 * Default synchronization window constants.
 *
 * The endpoint has no updatedSince filter so we use a rolling date range.
 * Configurable per tenant in future slices via TenantSfvConfig extensions.
 *
 * Past: 30 days before today (to capture recent results).
 * Future: 90 days after today (to capture upcoming fixtures).
 *
 * Maximum window: 365 days total (hard safety limit).
 * Minimum window: 1 day (prevents accidental zero-range calls).
 */
export const SCHEDULE_WINDOW_PAST_DAYS = 30;
export const SCHEDULE_WINDOW_FUTURE_DAYS = 90;
export const SCHEDULE_WINDOW_MAX_DAYS = 365;
export const SCHEDULE_WINDOW_MIN_DAYS = 1;
