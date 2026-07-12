/**
 * lib/integrations/sfv/sync-repository-interfaces.ts
 *
 * Typed interfaces for SFV sync data repositories.
 *
 * THIS FILE IS ARCHITECTURE-ONLY.
 * It defines the contracts that concrete repository implementations must satisfy.
 * No implementation exists here. No Prisma calls are made.
 *
 * Design principles:
 *   - Each interface covers exactly one entity type.
 *   - All methods are keyed on tenantId for isolation.
 *   - Upsert methods return SfvUpsertResult<T> to enable create/update counting.
 *   - Soft-delete methods return SfvSoftDeleteResult with affected row count.
 *   - No method ever hard-deletes a cached entity row.
 *   - DB errors propagate to callers — no swallowing.
 *
 * Separation of concerns:
 *   Repository: raw persistence (upsert, findMany, softDelete, count)
 *   Service:    orchestration and business rules
 *   SyncEngine: pipeline coordination (fetch → upsert → softDelete → audit)
 *
 * Each interface is in its own export section below.
 */

import type {
  SfvCachedTeam,
  SfvCachedTeamInput,
  SfvCachedMatch,
  SfvCachedMatchInput,
  SfvCachedRanking,
  SfvCachedRankingInput,
  SfvCachedTeamPicture,
  SfvCachedTeamPictureInput,
  SfvSyncRun,
  SfvSyncRunCreateInput,
  SfvSyncRunCompleteInput,
  SfvSyncError,
  SfvSyncErrorCreateInput,
  SfvUpsertResult,
  SfvSoftDeleteResult,
  SfvSyncStatus,
} from "./sync-types";

// ── Query helpers ─────────────────────────────────────────────────────────────

/** Common filter for season-scoped entity queries. */
export type SfvSeasonFilter = {
  tenantId: string;
  sfvSeasonId: number;
  /** When true, excludes soft-deleted rows. Defaults to true. */
  excludeDeleted?: boolean;
};

/** Filter for retrieving sync run history. */
export type SfvSyncRunFilter = {
  tenantId: string;
  sfvSeasonId?: number;
  status?: SfvSyncStatus;
  /** ISO 8601 lower bound for startedAt. */
  startedAfter?: Date;
  limit?: number;
  offset?: number;
};

// ── ISfvTeamRepository ────────────────────────────────────────────────────────

/**
 * Repository contract for SfvCachedTeam persistence.
 *
 * Upsert key: (tenantId, sfvTeamId, sfvSeasonId)
 */
export interface ISfvTeamRepository {
  /**
   * Upserts a single team record.
   *
   * On conflict (same tenantId + sfvTeamId + sfvSeasonId):
   *   - Updates all mutable fields.
   *   - Increments syncVersion.
   *   - Resets isDeleted = false, deletedAt = null.
   *   - Returns action = "updated".
   *
   * On no conflict: creates a new row, returns action = "created".
   */
  upsertTeam(input: SfvCachedTeamInput): Promise<SfvUpsertResult<SfvCachedTeam>>;

  /**
   * Retrieves all non-deleted (or all, when excludeDeleted = false) team rows
   * for the given tenant and season.
   */
  findTeamsBySeasonAndTenant(filter: SfvSeasonFilter): Promise<SfvCachedTeam[]>;

  /**
   * Returns a single team row by its upsert key, or null when not found.
   * Returns the row regardless of isDeleted state.
   */
  findTeam(tenantId: string, sfvTeamId: number, sfvSeasonId: number): Promise<SfvCachedTeam | null>;

  /**
   * Soft-deletes all team rows for the given tenant+season whose sfvTeamId
   * is NOT in presentIds.
   *
   * Used after the upsert loop to mark teams that disappeared from the SFV
   * API response as deleted. Returns the count of rows soft-deleted.
   *
   * Never hard-deletes rows. No-op when all current rows are in presentIds.
   */
  softDeleteAbsentTeams(
    tenantId: string,
    sfvSeasonId: number,
    presentIds: number[],
  ): Promise<SfvSoftDeleteResult>;

  /**
   * Returns the count of active (non-deleted) teams for the given tenant+season.
   */
  countActiveTeams(tenantId: string, sfvSeasonId: number): Promise<number>;
}

// ── ISfvMatchRepository ───────────────────────────────────────────────────────

/**
 * Repository contract for SfvCachedMatch persistence.
 *
 * Upsert key: (tenantId, sfvMatchId)
 * Note: sfvMatchId is globally unique in SFV, not season-scoped.
 */
export interface ISfvMatchRepository {
  /**
   * Upserts a single match record.
   *
   * On conflict (same tenantId + sfvMatchId):
   *   - Updates all mutable fields including scores and match state.
   *   - Increments syncVersion.
   *   - Resets isDeleted = false, deletedAt = null.
   *   - Returns action = "updated".
   *
   * On no conflict: creates, returns action = "created".
   */
  upsertMatch(input: SfvCachedMatchInput): Promise<SfvUpsertResult<SfvCachedMatch>>;

  /**
   * Retrieves all non-deleted (or all) match rows for the given tenant+season.
   */
  findMatchesBySeasonAndTenant(filter: SfvSeasonFilter): Promise<SfvCachedMatch[]>;

  /**
   * Returns a single match row by upsert key, or null when not found.
   */
  findMatch(tenantId: string, sfvMatchId: number): Promise<SfvCachedMatch | null>;

  /**
   * Soft-deletes all match rows for the given tenant+season whose sfvMatchId
   * is NOT in presentIds.
   *
   * Queries are scoped to the sfvSeasonId to avoid cross-season interference.
   * Returns the count of rows soft-deleted.
   */
  softDeleteAbsentMatches(
    tenantId: string,
    sfvSeasonId: number,
    presentIds: number[],
  ): Promise<SfvSoftDeleteResult>;

  /** Returns the count of active (non-deleted) matches for the given tenant+season. */
  countActiveMatches(tenantId: string, sfvSeasonId: number): Promise<number>;
}

// ── ISfvRankingRepository ─────────────────────────────────────────────────────

/**
 * Repository contract for SfvCachedRanking persistence.
 *
 * Upsert key: (tenantId, sfvSeasonId, sfvTeamId, sfvGroupId)
 */
export interface ISfvRankingRepository {
  /**
   * Upserts a single ranking entry.
   *
   * On conflict (same tenantId + sfvSeasonId + sfvTeamId + sfvGroupId):
   *   - Updates position, score fields, and all mutable columns.
   *   - Increments syncVersion.
   *   - Resets isDeleted = false, deletedAt = null.
   *   - Returns action = "updated".
   *
   * On no conflict: creates, returns action = "created".
   */
  upsertRanking(input: SfvCachedRankingInput): Promise<SfvUpsertResult<SfvCachedRanking>>;

  /**
   * Retrieves all non-deleted (or all) ranking rows for the given tenant+season.
   * Results are ordered by leagueId, divisionId, groupId, position ascending.
   */
  findRankingsBySeasonAndTenant(filter: SfvSeasonFilter): Promise<SfvCachedRanking[]>;

  /**
   * Returns a single ranking row by upsert key, or null when not found.
   */
  findRanking(
    tenantId: string,
    sfvSeasonId: number,
    sfvTeamId: number,
    sfvGroupId: number,
  ): Promise<SfvCachedRanking | null>;

  /**
   * Soft-deletes all ranking rows for the given tenant+season whose
   * composite key (sfvTeamId + sfvGroupId) is NOT in presentKeys.
   *
   * presentKeys: array of { sfvTeamId, sfvGroupId } pairs present in the
   * latest SFV response.
   */
  softDeleteAbsentRankings(
    tenantId: string,
    sfvSeasonId: number,
    presentKeys: ReadonlyArray<{ sfvTeamId: number; sfvGroupId: number }>,
  ): Promise<SfvSoftDeleteResult>;

  /** Returns the count of active (non-deleted) ranking rows for the given tenant+season. */
  countActiveRankings(tenantId: string, sfvSeasonId: number): Promise<number>;
}

// ── ISfvTeamPictureRepository ─────────────────────────────────────────────────

/**
 * Repository contract for SfvCachedTeamPicture persistence.
 *
 * Upsert key: (tenantId, sfvTeamId)
 * Pictures are NOT season-scoped.
 *
 * SECURITY: base64Data in inputs and outputs must never be logged.
 */
export interface ISfvTeamPictureRepository {
  /**
   * Upserts a single team picture record.
   *
   * On conflict (same tenantId + sfvTeamId):
   *   - Updates base64Data and all metadata fields.
   *   - Increments syncVersion.
   *   - Resets isDeleted = false, deletedAt = null.
   *   - Returns action = "updated".
   *
   * On no conflict: creates, returns action = "created".
   */
  upsertPicture(
    input: SfvCachedTeamPictureInput,
  ): Promise<SfvUpsertResult<SfvCachedTeamPicture>>;

  /**
   * Returns all non-deleted (or all) picture rows for the given tenant.
   * No season filter — pictures are not season-scoped.
   */
  findPicturesByTenant(
    tenantId: string,
    excludeDeleted?: boolean,
  ): Promise<SfvCachedTeamPicture[]>;

  /**
   * Returns a single picture row by upsert key, or null when not found.
   */
  findPicture(tenantId: string, sfvTeamId: number): Promise<SfvCachedTeamPicture | null>;

  /**
   * Soft-deletes all picture rows for the given tenant whose sfvTeamId
   * is NOT in presentIds.
   *
   * Called after all team IDs for the current sync scope are processed.
   */
  softDeleteAbsentPictures(
    tenantId: string,
    presentIds: number[],
  ): Promise<SfvSoftDeleteResult>;

  /** Returns the count of active (non-deleted) pictures for the given tenant. */
  countActivePictures(tenantId: string): Promise<number>;
}

// ── ISfvSyncRunRepository ─────────────────────────────────────────────────────

/**
 * Repository contract for SfvSyncRun audit records.
 *
 * Append-only: rows are created at run start, updated at run end.
 * No soft-delete. No hard-delete.
 */
export interface ISfvSyncRunRepository {
  /**
   * Creates a new SfvSyncRun row at the start of a sync run.
   * Returns the created run (including auto-assigned id).
   */
  createRun(input: SfvSyncRunCreateInput): Promise<SfvSyncRun>;

  /**
   * Updates a SfvSyncRun row at the end of a sync run.
   *
   * Writes status, completedAt, durationMs, and all counter fields.
   * Returns the updated run.
   * Throws when the run id does not exist.
   */
  completeRun(runId: string, input: SfvSyncRunCompleteInput): Promise<SfvSyncRun>;

  /**
   * Returns a single SfvSyncRun by id, or null when not found.
   */
  findRun(runId: string): Promise<SfvSyncRun | null>;

  /**
   * Returns SfvSyncRun rows matching the filter, ordered by startedAt descending.
   */
  findRuns(filter: SfvSyncRunFilter): Promise<SfvSyncRun[]>;

  /**
   * Returns the most recent SfvSyncRun for the given tenant+season,
   * or null when no runs exist.
   */
  findLatestRun(tenantId: string, sfvSeasonId: number): Promise<SfvSyncRun | null>;
}

// ── ISfvSyncErrorRepository ───────────────────────────────────────────────────

/**
 * Repository contract for SfvSyncError per-entity error records.
 *
 * Append-only during a run. resolvedAt may be set post-run by operators.
 * No hard-delete.
 *
 * SECURITY: stackTrace in SfvSyncError must never be forwarded to the browser.
 */
export interface ISfvSyncErrorRepository {
  /**
   * Appends a single error record for the given sync run.
   * Returns the created error row.
   */
  appendError(input: SfvSyncErrorCreateInput): Promise<SfvSyncError>;

  /**
   * Returns all error rows for the given sync run, ordered by createdAt ascending.
   */
  findErrorsByRunId(syncRunId: string): Promise<SfvSyncError[]>;

  /**
   * Returns unresolved error rows for the given tenant, most recent first.
   * "Unresolved" means resolvedAt IS NULL.
   */
  findUnresolvedErrors(tenantId: string, limit?: number): Promise<SfvSyncError[]>;

  /**
   * Marks an error row as resolved by setting resolvedAt = now().
   * Returns the updated row, or null when the id does not exist.
   */
  resolveError(errorId: string): Promise<SfvSyncError | null>;

  /**
   * Returns the count of unresolved errors for the given tenant.
   */
  countUnresolvedErrors(tenantId: string): Promise<number>;
}

// ── Aggregate repository ───────────────────────────────────────────────────────

/**
 * Single-entry-point interface combining all six SFV sync repositories.
 *
 * The concrete implementation may use a single Prisma client instance across
 * all sub-repositories to enable transactional coordination (Prisma interactive
 * transactions) without exposing the client to callers.
 *
 * Usage:
 *   const repo: ISfvSyncRepository = new SfvSyncRepository(prisma);
 *   await repo.teams.upsertTeam(input);
 *   await repo.runs.createRun(runInput);
 */
export interface ISfvSyncRepository {
  readonly teams: ISfvTeamRepository;
  readonly matches: ISfvMatchRepository;
  readonly rankings: ISfvRankingRepository;
  readonly pictures: ISfvTeamPictureRepository;
  readonly runs: ISfvSyncRunRepository;
  readonly errors: ISfvSyncErrorRepository;
}
