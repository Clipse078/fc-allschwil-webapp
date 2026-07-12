/**
 * lib/integrations/sfv/sync-strategy.ts
 *
 * SFV Database Synchronization Strategy — Design Documentation
 *
 * THIS FILE IS ARCHITECTURE-ONLY.
 * It defines strategy constants, enums, and documented types used by the
 * future sync engine. It contains NO synchronization implementation.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * OVERVIEW
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * The SFV synchronization architecture persists data from the SFV ClubCorner
 * API into six PostgreSQL tables (see prisma/schema.prisma). The design
 * supports safe repeated execution without creating duplicates.
 *
 * Data flow (future engine — not yet implemented):
 *
 *   SFV API
 *     ↓  fetchTeamList / fetchClubSchedule / fetchClubRanking / fetchTeamPicture
 *   Download
 *     ↓  raw SFV objects
 *   Map to Input types
 *     ↓  SfvCachedTeamInput / SfvCachedMatchInput / etc.
 *   Upsert
 *     ↓  INSERT ... ON CONFLICT DO UPDATE SET ... (Prisma upsert)
 *   Soft-Delete Absent Rows
 *     ↓  UPDATE ... SET isDeleted = true WHERE NOT IN (current sfvIds)
 *   Audit
 *     ↓  SfvSyncRun + SfvSyncError
 *   Summary
 *     ↓  SfvSyncRun.status = COMPLETED
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 1. UPSERT STRATEGY
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Each entity type has a stable upsert key that guarantees idempotency:
 *
 *   SfvCachedTeam:        (tenantId, sfvTeamId, sfvSeasonId)
 *   SfvCachedMatch:       (tenantId, sfvMatchId)
 *   SfvCachedRanking:     (tenantId, sfvSeasonId, sfvTeamId, sfvGroupId)
 *   SfvCachedTeamPicture: (tenantId, sfvTeamId)
 *
 * The sync engine calls repository.upsert(input) for each incoming entity.
 * Prisma executes: INSERT ... ON CONFLICT (unique_key) DO UPDATE SET ... = EXCLUDED.*
 *
 * On each upsert the repository:
 *   1. Increments syncVersion (ensures idempotency checks remain valid).
 *   2. Sets lastSyncedAt to the run's wall-clock start time.
 *   3. Clears isDeleted = false, deletedAt = null if the row was previously deleted.
 *   4. Returns SfvUpsertResult<T> with action = "created" | "updated".
 *
 * Safe repeated execution: running the upsert loop N times with the same
 * upstream data produces the same database state as running it once.
 * syncVersion advances on each pass (not idempotent at the value level, but
 * idempotent at the data level). This is intentional — syncVersion is a
 * "touched at" counter, not a "changed at" counter.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 2. DELETION STRATEGY
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Hard DELETEs are prohibited. All removal is soft-delete only.
 *
 * Algorithm (per entity type, per tenant+season):
 *   1. Collect the set of sfvIds returned by the SFV API in this run.
 *   2. Query the DB for all non-deleted rows for this (tenantId, sfvSeasonId).
 *   3. For rows whose sfvId is NOT in the current SFV response:
 *      UPDATE ... SET isDeleted = true, deletedAt = now() WHERE id IN (...)
 *
 * This is implemented as a batch soft-delete after the upsert loop completes.
 * The repository exposes: softDeleteAbsentTeams(tenantId, sfvSeasonId, presentIds[])
 *
 * For SfvCachedTeamPicture (not season-scoped), the absent-set query uses
 * all non-deleted rows for tenantId (no sfvSeasonId filter).
 *
 * Restoration: if a soft-deleted entity re-appears in a future sync response,
 * the upsert reactivates it (isDeleted = false, deletedAt = null, syncVersion++).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 3. CONFLICT STRATEGY
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Conflict type: concurrent sync runs for the same tenant+season.
 *
 * Resolution: last-writer-wins via Prisma upsert (optimistic).
 * The unique constraint guarantees at-most-one row per upsert key. Two concurrent
 * runs both executing upsert on the same row will result in the later transaction
 * committing its values. syncVersion will reflect the higher count of the two.
 *
 * The sync engine should prevent concurrent runs at the application layer
 * (e.g. advisory lock, status check: reject RUNNING → RUNNING for same tenant+season).
 * The DB constraint is the safety net; the application lock is the primary guard.
 *
 * Conflict type: SFV API returns stale data.
 *
 * Resolution: accepted. The SFV API is the authoritative source. If the API
 * returns stale data (e.g. a result not yet updated), the sync writes it as-is
 * and the next run will correct it. No local version wins over remote.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 4. AUDIT STRATEGY
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Every sync run produces exactly one SfvSyncRun record.
 * Every per-entity error produces exactly one SfvSyncError record.
 *
 * SfvSyncRun lifecycle:
 *   1. Created at run start: { status: RUNNING, startedAt: now() }
 *   2. Updated at run end:   { status: COMPLETED|FAILED|PARTIAL_SUCCESS,
 *                              completedAt, durationMs, all counters }
 *
 * SfvSyncError records are appended during the run. They are never updated
 * (except resolvedAt by an operator). retryCount is incremented by the engine
 * when a retry for the same entity is attempted.
 *
 * Neither SfvSyncRun nor SfvSyncError rows are ever hard-deleted.
 * They form a permanent immutable audit trail.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 5. RETRY STRATEGY
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Per-entity retry:
 *   The sync engine retries individual entity fetches/upserts up to
 *   SYNC_MAX_ENTITY_RETRIES times before recording a SfvSyncError.
 *   SFV_RETRY_ELIGIBLE_PHASES identifies which phases are retryable.
 *
 * Run-level retry:
 *   Failed runs (status = FAILED) are re-triggered by the scheduler.
 *   Partial-success runs (status = PARTIAL_SUCCESS) are retried with the
 *   same syncType to converge on a fully-consistent state.
 *
 * Authentication retry:
 *   On SFV_UNAUTHORIZED, the token cache is evicted and re-acquisition is
 *   attempted once per request (handled by client.ts, not the sync engine).
 *
 * Exponential backoff:
 *   Retry delays follow: SYNC_RETRY_BASE_DELAY_MS * 2^attempt
 *   Maximum delay is capped at SYNC_MAX_RETRY_DELAY_MS.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 6. VERSIONING STRATEGY
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * syncVersion is a per-row monotonic counter.
 *
 * Purpose:
 *   - Enables idempotency: a consumer can compare syncVersion to detect
 *     whether a row changed since it last read it.
 *   - Enables change-feed queries: WHERE syncVersion > :lastSeenVersion
 *     gives all rows touched since a given sync pass.
 *   - Enables conflict detection in future multi-source scenarios.
 *
 * The repository increments syncVersion atomically during each upsert.
 * Initial value is 1. Values are never reset (even across soft-delete cycles).
 *
 * lastSyncedAt is the wall-clock timestamp of the run that last touched the row.
 * It enables expiry checks: rows not synced within a staleness threshold can
 * be identified and re-fetched.
 *
 * sourceUpdatedAt is the SFV-side update timestamp when available.
 * Currently null for all entity types (SFV API does not return this).
 * Reserved for future conditional-GET optimisation (e.g. If-Modified-Since).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 7. RELATIONSHIP UPDATE STRATEGY
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * No foreign keys between cached entity tables.
 * Teams, matches, rankings, and pictures reference each other via sfvTeamId
 * (integer). These are denormalised by design — the SFV API is the source
 * of truth, not our DB relations.
 *
 * Rationale:
 *   - SFV entities may arrive out-of-order (e.g. a picture before its team).
 *   - Foreign-key enforcement would require strict ordering or deferred commits.
 *   - All join queries can be done in the application layer using sfvTeamId.
 *
 * Tenant relation (tenantId → Tenant.id):
 *   All six sync tables have a hard FK to Tenant with CASCADE DELETE.
 *   Deleting a tenant hard-deletes all its cached SFV data.
 *   This is intentional — tenant data isolation is an absolute invariant.
 *
 * SfvSyncRun → SfvSyncError: hard FK with CASCADE DELETE.
 *   If a sync run record is ever deleted (future retention policy), its errors
 *   are also deleted. The cascade is defensive — sync runs are never deleted
 *   under normal operation.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * STRATEGY CONSTANTS
 * ─────────────────────────────────────────────────────────────────────────────
 */

/** Maximum retry attempts per entity before recording a SfvSyncError. */
export const SYNC_MAX_ENTITY_RETRIES = 2;

/** Base delay (ms) for exponential retry backoff. */
export const SYNC_RETRY_BASE_DELAY_MS = 500;

/** Maximum delay (ms) cap for exponential retry backoff. */
export const SYNC_MAX_RETRY_DELAY_MS = 5_000;

/**
 * Staleness threshold in milliseconds.
 * A cached row is considered stale when lastSyncedAt is older than this value.
 * Used by the future sync engine to decide which entities need re-fetching.
 */
export const SYNC_STALENESS_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Phases within the sync pipeline that are eligible for per-entity retry.
 * "upsert" and "soft-delete" are DB operations; transient DB errors are retryable.
 * "parse" is not retryable — bad data from SFV will not improve on retry.
 */
export const SYNC_RETRY_ELIGIBLE_PHASES: readonly string[] = [
  "fetch",
  "upsert",
  "soft-delete",
  "picture-download",
] as const;

/**
 * Maximum number of consecutive FAILED runs for the same tenant+season
 * before the sync scheduler backs off to a longer interval.
 */
export const SYNC_MAX_CONSECUTIVE_FAILURES = 3;

/**
 * Entity types that participate in a FULL sync, in execution order.
 * Order matters: teams must be available before pictures are fetched,
 * because the team picture fetch needs a list of teamIds.
 */
export const SYNC_FULL_ENTITY_ORDER = [
  "TEAM",
  "MATCH",
  "RANKING",
  "PICTURE",
] as const satisfies readonly string[];

// ── Conflict strategy constants ────────────────────────────────────────────────

/**
 * When two concurrent sync runs attempt to upsert the same entity:
 * last-writer-wins (Prisma upsert resolves via DB transaction serialisation).
 * The sync engine should prevent this at the application layer.
 */
export const SYNC_CONFLICT_STRATEGY = "LAST_WRITER_WINS" as const;

/**
 * Deletion uses soft-delete only. Hard deletes are never performed by the
 * sync engine. The constraint is enforced here for documentation purposes.
 */
export const SYNC_DELETION_STRATEGY = "SOFT_DELETE_ONLY" as const;

/**
 * The SFV API is the single authoritative source for all cached data.
 * Local overrides are not supported. All conflicts resolve to SFV-source data.
 */
export const SYNC_SOURCE_OF_TRUTH = "SFV_API" as const;

// ── Type exports for sync engine configuration ─────────────────────────────────

/** Typed strategy constants for the future sync engine. */
export type SyncConflictStrategy = typeof SYNC_CONFLICT_STRATEGY;
export type SyncDeletionStrategy = typeof SYNC_DELETION_STRATEGY;
export type SyncSourceOfTruth = typeof SYNC_SOURCE_OF_TRUTH;

/** The ordered list of entity types for a full sync. */
export type SyncEntityOrder = (typeof SYNC_FULL_ENTITY_ORDER)[number];
