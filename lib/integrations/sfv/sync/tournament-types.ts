/**
 * lib/integrations/sfv/sync/tournament-types.ts
 *
 * Shared types for the SFV tournament synchronization surface.
 *
 * IMPORTANT — read before extending this module:
 * See `./tournament-sync.ts` for the full investigation summary. In short:
 * the official SFV Club API Interface (OpenAPI v26.6.15.2) exposes no
 * structured resource for planned tournaments (an entity with participating
 * teams, organiser, venue, category — distinct from a two-team match), and
 * the only human-facing source (the FVNWS match center website) explicitly
 * blocks automated access. `SfvTournamentSyncResult` is therefore shaped as
 * a diagnostic result: all counts are always zero and `blocked` is always
 * `true` in this release. The shape mirrors `SfvScheduleSyncResult` /
 * `SfvCompetitionSyncResult` so that a future real implementation (once SFV
 * ships a structured endpoint or grants authorized access) is a drop-in
 * replacement with no call-site changes beyond removing `blocked: true`.
 *
 * Security invariants:
 *   - No credentials, tokens, or raw provider payloads in any result type.
 *   - tenantId always originates from a trusted session context.
 */

import type { SyncErrorEntry } from "./types";

// ── Sync result ────────────────────────────────────────────────────────────────

/**
 * Structured result returned by a tournament synchronization run.
 *
 * All counts are non-negative integers and always `0` in this release —
 * see the module documentation in `tournament-sync.ts` for why. `blocked`
 * is always `true` until a reliable structured provider source exists.
 *
 * This type is serializable to JSON and safe to return from API routes.
 */
export type SfvTournamentSyncResult = {
  /** ISO 8601 timestamp when the run started. */
  startedAt: string;
  /** ISO 8601 timestamp when the run finished. */
  finishedAt: string;
  /** Elapsed time in milliseconds (finishedAt − startedAt). */
  durationMs: number;
  /** Tenant that requested the synchronization. */
  tenantId: string;
  /** External provider identifier, always "SFV" for this module. */
  source: string;
  /** SFV clubId resolved from the tenant's SFV configuration. */
  clubId: number;
  /** SFV seasonId resolved from the tenant's SFV configuration. */
  seasonId: number;
  /** Number of tournament records fetched from the provider. Always 0. */
  fetched: number;
  /** Number of new tournaments created. Always 0. */
  created: number;
  /** Number of existing tournaments updated. Always 0. */
  updated: number;
  /** Number of tournaments with no detectable change. Always 0. */
  unchanged: number;
  /** Number of tournament records that failed to persist. Always 0 — this run never writes. */
  failed: number;
  /**
   * True when no reliable structured provider source is available and the
   * run could not attempt an import. Always `true` in this release.
   */
  blocked: boolean;
  /**
   * Sanitized diagnostic entries explaining why zero tournaments were
   * imported. Always contains at least one entry when `blocked` is `true`.
   */
  warnings: SyncErrorEntry[];
  /** Human-readable next step for administrators. Never contains credentials. */
  recommendedAction: string;
  /** Sanitized per-record error entries. Always empty in this release (no writes attempted). */
  errors: SyncErrorEntry[];
};
