/**
 * lib/integrations/sfv/sync/detail-types.ts
 *
 * Shared types for the SFV match-detail synchronization layer (Slice 3C).
 *
 * Match-detail synchronization is a per-match enrichment pass that fetches
 * richer data from GET /api/match/{matchId} and updates a limited set of
 * provider-owned Event fields. It NEVER creates Events and NEVER modifies
 * club-managed fields.
 *
 * Architecture invariants:
 *   - Detail sync only operates on Events that already exist via a
 *     MatchExternalMapping (created by schedule sync, Slice 3B).
 *   - Club-managed fields are never touched: title, remarks, meetingTime,
 *     pitchCode, homeDressingRoomCode, awayDressingRoomCode, reviewStage,
 *     visibility flags, seasonId, teamId, opponentName, resultLabel.
 *   - Provider-managed fields updated: startAt, location, competitionLabel,
 *     status, intermediateResultLabel (mapped from intermediate scores).
 *   - detailSyncedAt on MatchExternalMapping is updated on every successful run.
 *
 * Security invariants:
 *   - No credentials, tokens, or raw provider payloads in any result type.
 *   - Errors are actionable and sanitized — no stack traces, no secret values.
 *   - tenantId always originates from a trusted session context.
 */

import type { SyncErrorEntry } from "./types";

// ── Sync result ────────────────────────────────────────────────────────────────

/**
 * Structured result returned by a match-detail synchronization run.
 *
 * All counts are non-negative integers. Duration is in milliseconds.
 * Errors are sanitized — no credentials or provider payloads.
 *
 * This type is serializable to JSON and safe to return from API routes.
 */
export type SfvDetailSyncResult = {
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
  /** Number of mappings processed (detail fetched). */
  processed: number;
  /** Number of Events whose provider-managed fields were updated. */
  updated: number;
  /** Number of Events with no detectable change — skipped. */
  unchanged: number;
  /** Number of individual match-detail fetches or persistence operations that failed. */
  failed: number;
  /** Sanitized per-match error entries. Empty when failed === 0. */
  errors: SyncErrorEntry[];
};

// ── Internal sync context ──────────────────────────────────────────────────────

/**
 * Immutable context passed through all match-detail synchronization steps.
 *
 * Established once from the trusted session + tenant config at the start of
 * a sync run. Never derived from provider responses or caller-supplied input.
 */
export type SfvDetailSyncContext = {
  tenantId: string;
  clubId: number;
  seasonId: number;
  /** Timestamp captured at sync start — used as detailSyncedAt in persistence. */
  syncedAt: Date;
};
