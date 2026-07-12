/**
 * lib/integrations/sfv/sync-service-interfaces.ts
 *
 * Typed interfaces for the SFV sync service layer and future sync engine.
 *
 * THIS FILE IS ARCHITECTURE-ONLY.
 * It defines the contracts that the future sync engine implementation will satisfy.
 * No implementation exists here. No Prisma calls are made. No SFV requests are made.
 *
 * Layer responsibilities:
 *
 *   ISfvSyncRepository  (sync-repository-interfaces.ts)
 *     Raw persistence: upsert, findMany, softDelete, count, audit append.
 *
 *   ISfvCachedDataService  (this file)
 *     Read-path service: access cached SFV data from the DB.
 *     Used by website/public APIs as an alternative to live SFV requests.
 *
 *   ISfvSyncEngine  (this file)
 *     Future synchronization pipeline: fetch → upsert → soft-delete → audit.
 *     NOT YET IMPLEMENTED — defined here as an architecture contract only.
 *
 *   ISfvSyncScheduler  (this file)
 *     Future scheduler: orchestrates repeated engine invocations.
 *     NOT YET IMPLEMENTED.
 */

import type {
  SfvCachedTeam,
  SfvCachedMatch,
  SfvCachedRanking,
  SfvCachedTeamPicture,
  SfvSyncRun,
  SfvSyncError,
  SfvSyncStatus,
  SfvSyncType,
  SfvSyncEntityType,
} from "./sync-types";

// ── Read-path service types ────────────────────────────────────────────────────

/** Options for reading cached SFV data, scoped to a tenant and season. */
export type SfvCachedDataReadOptions = {
  tenantId: string;
  sfvSeasonId: number;
  /** When true, includes soft-deleted rows. Defaults to false. */
  includeDeleted?: boolean;
};

/** Options for reading cached team pictures (not season-scoped). */
export type SfvPictureReadOptions = {
  tenantId: string;
  /** When true, includes soft-deleted rows. Defaults to false. */
  includeDeleted?: boolean;
};

// ── ISfvCachedDataService ────────────────────────────────────────────────────

/**
 * Read-path service for accessing cached SFV data persisted by the sync engine.
 *
 * Consumers (website APIs, public endpoints) should prefer this service over
 * live SFV API calls for read operations, provided a recent sync has run.
 *
 * All methods are read-only. No writes, no SFV API calls.
 * All queries are scoped by tenantId for isolation.
 */
export interface ISfvCachedDataService {
  /**
   * Returns cached teams for the given tenant and season.
   * Excludes soft-deleted rows by default.
   */
  getCachedTeams(options: SfvCachedDataReadOptions): Promise<SfvCachedTeam[]>;

  /**
   * Returns cached matches for the given tenant and season.
   * Excludes soft-deleted rows by default.
   */
  getCachedMatches(options: SfvCachedDataReadOptions): Promise<SfvCachedMatch[]>;

  /**
   * Returns cached ranking entries for the given tenant and season.
   * Excludes soft-deleted rows by default.
   */
  getCachedRankings(options: SfvCachedDataReadOptions): Promise<SfvCachedRanking[]>;

  /**
   * Returns cached team pictures for the given tenant.
   * Not season-scoped — pictures are tenant-wide.
   * Excludes soft-deleted rows by default.
   */
  getCachedPictures(options: SfvPictureReadOptions): Promise<SfvCachedTeamPicture[]>;

  /**
   * Returns the cached picture for a specific team, or null when not found.
   *
   * SECURITY: base64Data in the returned record must not be logged.
   */
  getCachedPictureForTeam(
    tenantId: string,
    sfvTeamId: number,
  ): Promise<SfvCachedTeamPicture | null>;

  /**
   * Returns the most recent successfully completed sync run for the given
   * tenant and season, or null when no completed run exists.
   *
   * Used to determine data freshness and whether a re-sync is needed.
   */
  getLastCompletedSyncRun(
    tenantId: string,
    sfvSeasonId: number,
  ): Promise<SfvSyncRun | null>;

  /**
   * Returns true when cached data for the given tenant+season is fresh.
   *
   * Data is considered fresh when a completed sync run exists whose
   * completedAt timestamp is more recent than the staleness threshold
   * defined by SYNC_STALENESS_THRESHOLD_MS.
   *
   * Returns false when no completed run exists or the last run is stale.
   */
  isCachedDataFresh(tenantId: string, sfvSeasonId: number): Promise<boolean>;
}

// ── Engine input/output types ─────────────────────────────────────────────────

/** Input to trigger a single synchronization run. */
export type SfvSyncRunRequest = {
  tenantId: string;
  sfvSeasonId: number;
  syncType: SfvSyncType;
  /** Free-form initiator string. Convention: "system:cron", "manual:<userId>". */
  triggeredBy: string | null;
};

/** Summary returned after a sync run completes (successfully or partially). */
export type SfvSyncRunSummary = {
  runId: string;
  tenantId: string;
  sfvSeasonId: number;
  syncType: SfvSyncType;
  status: SfvSyncStatus;
  startedAt: Date;
  completedAt: Date;
  durationMs: number;
  /** Total counts of entities processed in this run. */
  processed: {
    teams: number;
    matches: number;
    rankings: number;
    pictures: number;
  };
  /** Counts of new rows created (INSERT path of upsert). */
  created: {
    teams: number;
    matches: number;
    rankings: number;
    pictures: number;
  };
  /** Counts of rows updated (UPDATE path of upsert). */
  updated: {
    teams: number;
    matches: number;
    rankings: number;
    pictures: number;
  };
  /** Counts of rows soft-deleted (absent from current SFV response). */
  deleted: {
    teams: number;
    matches: number;
    rankings: number;
    pictures: number;
  };
  errorCount: number;
  /** Errors encountered during the run. Empty when errorCount = 0. */
  errors: SfvSyncRunError[];
};

/** Abbreviated error record within a run summary. */
export type SfvSyncRunError = {
  errorId: string;
  entityType: SfvSyncEntityType;
  entityExternalId: string | null;
  phase: string;
  errorCode: string;
  errorMessage: string;
};

// ── ISfvSyncEngine ─────────────────────────────────────────────────────────────

/**
 * Future synchronization engine contract.
 *
 * NOT YET IMPLEMENTED.
 *
 * The engine fetches data from the SFV API, maps it to DB input types,
 * calls repository upsert/softDelete methods, records audit data, and
 * returns a run summary.
 *
 * A concrete implementation will:
 *   1. Create a SfvSyncRun row (status = RUNNING).
 *   2. Fetch each entity type from the SFV API (order per SYNC_FULL_ENTITY_ORDER).
 *   3. Map raw SFV types to *Input types.
 *   4. Call repository.upsert() for each entity, accumulating counters.
 *   5. Call repository.softDeleteAbsent*() to mark removed entities.
 *   6. Append SfvSyncError rows for any failures.
 *   7. Complete the SfvSyncRun row (status = COMPLETED | FAILED | PARTIAL_SUCCESS).
 *   8. Return a SfvSyncRunSummary.
 *
 * Security invariants:
 *   - The engine never surfaces token values or credential material.
 *   - Stack traces in SfvSyncError rows are never returned to callers.
 *   - base64Data for team pictures is never logged.
 */
export interface ISfvSyncEngine {
  /**
   * Executes a synchronization run for the given tenant and season.
   *
   * Safe to call repeatedly: idempotent at the data level (duplicate data
   * is ignored via upsert; absent rows are soft-deleted, not duplicated).
   *
   * Throws only for fatal setup errors (e.g. no SFV config for tenant,
   * another run already RUNNING for the same tenant+season). Per-entity
   * errors are captured as SfvSyncError rows and reflected in the summary.
   */
  runSync(request: SfvSyncRunRequest): Promise<SfvSyncRunSummary>;

  /**
   * Returns the current status of a sync run by id.
   * Returns null when no run with that id exists.
   */
  getRunStatus(runId: string): Promise<SfvSyncRun | null>;

  /**
   * Returns the most recent sync run for the given tenant+season.
   * Returns null when no runs exist.
   */
  getLastRun(tenantId: string, sfvSeasonId: number): Promise<SfvSyncRun | null>;
}

// ── ISfvSyncScheduler ──────────────────────────────────────────────────────────

/**
 * Future scheduler contract for the SFV sync engine.
 *
 * NOT YET IMPLEMENTED.
 *
 * The scheduler determines when to trigger a sync run based on:
 *   - Cron expressions (e.g. "every 30 minutes during match season")
 *   - Data staleness (last run older than SYNC_STALENESS_THRESHOLD_MS)
 *   - Manual trigger (admin API or cron-like job)
 *
 * It delegates execution to ISfvSyncEngine.runSync() and handles:
 *   - Preventing duplicate concurrent runs for the same tenant+season.
 *   - Back-off after SYNC_MAX_CONSECUTIVE_FAILURES consecutive failures.
 *   - Run history pruning (future retention policy).
 */
export interface ISfvSyncScheduler {
  /**
   * Triggers an immediate sync run for the given tenant and season.
   * Resolves with the run summary when complete.
   *
   * Returns an error if another run is already RUNNING for the same scope.
   */
  triggerSync(request: SfvSyncRunRequest): Promise<SfvSyncRunSummary>;

  /**
   * Returns whether a sync run is currently active for the given tenant+season.
   */
  isSyncActive(tenantId: string, sfvSeasonId: number): Promise<boolean>;
}

// ── Sync health types ──────────────────────────────────────────────────────────

/**
 * Health snapshot for the sync system for a given tenant.
 *
 * Suitable for inclusion in admin diagnostics.
 * SECURITY: never include token values or base64Data.
 */
export type SfvSyncHealth = {
  tenantId: string;
  sfvSeasonId: number;
  isFresh: boolean;
  lastRunStatus: SfvSyncStatus | null;
  lastRunAt: Date | null;
  lastRunDurationMs: number | null;
  unresolvedErrorCount: number;
  activeTeamCount: number;
  activeMatchCount: number;
  activeRankingCount: number;
  activePictureCount: number;
};

/**
 * Read-only diagnostics interface for the sync system.
 *
 * Used by the admin diagnostics service to surface sync health without
 * triggering or modifying any sync state.
 */
export interface ISfvSyncDiagnostics {
  /**
   * Returns a health snapshot for the sync system for the given tenant+season.
   * Returns null when no SFV config exists for the tenant.
   */
  getSyncHealth(tenantId: string, sfvSeasonId: number): Promise<SfvSyncHealth | null>;

  /**
   * Returns the most recent SfvSyncError rows for a given tenant.
   * Excludes stackTrace for safety (caller should strip it before returning to UI).
   */
  getRecentErrors(tenantId: string, limit: number): Promise<Omit<SfvSyncError, "stackTrace">[]>;
}
