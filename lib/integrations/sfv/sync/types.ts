/**
 * lib/integrations/sfv/sync/types.ts
 *
 * Shared types for the SFV team synchronization layer.
 *
 * These types define the boundary between the provider (SFV / ClubCorner),
 * the synchronization engine, and the persistence layer. They are provider-
 * agnostic at the top level so that the pattern can be extended to other
 * providers without redesign.
 *
 * Security invariants:
 *   - No credentials, tokens, or raw provider payloads in any result type.
 *   - Errors are actionable and sanitized — no stack traces, no secret values.
 *   - tenantId always originates from a trusted session context.
 */

// ── Sync result ────────────────────────────────────────────────────────────────

/**
 * Actionable, sanitized error entry in a sync result.
 *
 * Contains only information safe to log and display to admins.
 * Never includes credentials, raw provider payloads, or stack traces.
 */
export type SyncErrorEntry = {
  /** Stable machine-readable code for the error category. */
  code: string;
  /** Human-readable description of the failure — safe to display. */
  message: string;
  /** Optional: external provider team ID associated with the failure. */
  externalTeamId?: number;
};

/**
 * Structured result returned by a team synchronization run.
 *
 * All counts are non-negative integers. Duration is in milliseconds.
 * Errors are sanitized — no credentials or provider payloads.
 *
 * This type is serializable to JSON and safe to return from API routes.
 */
export type SfvTeamSyncResult = {
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
  /** SFV clubId used for the team list request. */
  clubId: number;
  /** SFV seasonId used for the team list request. */
  seasonId: number;
  /** Number of team records fetched from the provider. */
  fetched: number;
  /** Number of new teams created (no prior mapping existed for any season). */
  created: number;
  /**
   * Number of teams relinked to their EXISTING canonical Team from a prior
   * season (TEAM-SFV-MAPPING-01 season carryover) — only a new
   * TeamExternalMapping row was created, never a new Team. A non-zero value
   * here is expected and healthy whenever the tenant's configured SFV season
   * advances; it is what prevents duplicate "FC Allschwil"-style Team rows.
   */
  relinked: number;
  /** Number of existing mappings updated with changed provider data. */
  updated: number;
  /** Number of records with no detectable change — skipped. */
  unchanged: number;
  /**
   * Number of existing mappings marked as provider-inactive.
   *
   * Only non-zero when the full provider list was received successfully and
   * a mapping's external team was absent from the response.
   */
  markedInactive: number;
  /** Number of individual team records that failed to persist. */
  failed: number;
  /** Sanitized per-team error entries. Empty when failed === 0. */
  errors: SyncErrorEntry[];
};

// ── Internal sync context ──────────────────────────────────────────────────────

/**
 * Immutable context passed through all synchronization steps.
 *
 * Established once from the trusted session + tenant config at the start of
 * a sync run. Never derived from provider responses or caller-supplied input.
 */
export type SfvTeamSyncContext = {
  tenantId: string;
  clubId: number;
  seasonId: number;
  /** Optional organisation filter forwarded to the team list request. */
  organisationId: number | null;
  /** Timestamp captured at sync start — used as lastSyncedAt in persistence. */
  syncedAt: Date;
};
