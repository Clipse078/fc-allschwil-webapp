/**
 * lib/integrations/sfv/sync-types.ts
 *
 * TypeScript types for the SFV Database Synchronization Design.
 *
 * These types mirror the six Prisma sync models exactly:
 *   SfvCachedTeam, SfvCachedMatch, SfvCachedRanking,
 *   SfvCachedTeamPicture, SfvSyncRun, SfvSyncError
 *
 * They are defined here (not derived from Prisma's generated types) so that
 * repository interfaces, service layers, and tests can import them without
 * a compile-time dependency on the Prisma generated client.
 *
 * Naming conventions:
 *   - Domain read types (from DB): SfvCached*, SfvSyncRun, SfvSyncError
 *   - Input types (for upsert): *Input suffix
 *   - Enums: SfvSync* prefix
 *
 * Architecture invariants:
 *   - Every type carries tenantId for isolation.
 *   - Every type carries syncVersion and lastSyncedAt for synchronization.
 *   - Soft-delete fields (isDeleted, deletedAt) are present on all cached entities.
 *   - No credential values, bearer tokens, or environment variables are stored here.
 */

// ── Enums ────────────────────────────────────────────────────────────────────

/**
 * Status of a synchronization run.
 * Mirrors the SfvSyncStatus Prisma enum.
 */
export type SfvSyncStatus = "RUNNING" | "COMPLETED" | "PARTIAL_SUCCESS" | "FAILED";

/**
 * Type of entities included in a synchronization run.
 * FULL covers all entity types.
 * Mirrors the SfvSyncType Prisma enum.
 */
export type SfvSyncType =
  | "FULL"
  | "TEAMS_ONLY"
  | "MATCHES_ONLY"
  | "RANKINGS_ONLY"
  | "PICTURES_ONLY";

/**
 * Entity type discriminator used in SfvSyncError.
 * Mirrors the SfvSyncEntityType Prisma enum.
 */
export type SfvSyncEntityType = "TEAM" | "MATCH" | "RANKING" | "PICTURE";

// ── SfvCachedTeam ─────────────────────────────────────────────────────────────

/**
 * A persisted team record from GET /api/team/list (TeamDetail).
 *
 * Upsert key: (tenantId, sfvTeamId, sfvSeasonId)
 * A team is season-specific: the same physical team (same sfvTeamId) may be
 * in a different league or division each season.
 */
export type SfvCachedTeam = {
  id: string;
  tenantId: string;
  /** SFV teamId from TeamDetail.teamId */
  sfvTeamId: number;
  /** SFV seasonId from the SeasonId query parameter */
  sfvSeasonId: number;
  isHomeTeam: boolean;
  teamName: string | null;
  teamFullname: string | null;
  clubNumber: number;
  clubName: string | null;
  teamLeagueId: number;
  teamLeagueName: string | null;
  teamDivisionName: string | null;
  teamOrganisationId: number;
  isTeamActive: boolean;
  /** true when the team was absent from the latest sync for this season. */
  isDeleted: boolean;
  deletedAt: Date | null;
  /** Wall-clock timestamp of the last sync that touched this row. */
  lastSyncedAt: Date;
  /** Monotonically increasing counter for idempotency and conflict detection. */
  syncVersion: number;
  /** Reserved: SFV API does not provide source-side updatedAt for teams. */
  sourceUpdatedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * Input shape for creating or upserting a SfvCachedTeam row.
 * Excludes auto-managed fields: id, createdAt, updatedAt.
 * syncVersion is managed by the repository (incremented on each upsert).
 */
export type SfvCachedTeamInput = {
  tenantId: string;
  sfvTeamId: number;
  sfvSeasonId: number;
  isHomeTeam: boolean;
  teamName: string | null;
  teamFullname: string | null;
  clubNumber: number;
  clubName: string | null;
  teamLeagueId: number;
  teamLeagueName: string | null;
  teamDivisionName: string | null;
  teamOrganisationId: number;
  isTeamActive: boolean;
  lastSyncedAt: Date;
  sourceUpdatedAt: Date | null;
};

// ── SfvCachedMatch ────────────────────────────────────────────────────────────

/**
 * A persisted match record from GET /api/club/schedule (ClubScheduleEntry).
 *
 * Upsert key: (tenantId, sfvMatchId)
 * SFV matchIds are globally unique within SFV (not scoped by season or club).
 *
 * Note: isUnknownPlayground normalises the upstream API typo
 * "isUnkownPlayground" (single 'n') to standard spelling.
 */
export type SfvCachedMatch = {
  id: string;
  tenantId: string;
  /** SFV matchId from ClubScheduleEntry.matchId. Globally unique in SFV. */
  sfvMatchId: number;
  /** SFV seasonId from ClubScheduleEntry.seasonId */
  sfvSeasonId: number;
  matchNumber: number;
  matchDate: Date;
  groupId: number | null;
  cupId: number | null;
  groupName: string | null;
  roundNbr: number;
  playgroundId: number;
  stadiumPlaygroundName: string | null;
  /** Normalised spelling of the SFV upstream typo "isUnkownPlayground". */
  isUnknownPlayground: boolean;
  leagueId: number;
  leagueNumber: number;
  leagueName: string | null;
  divisionId: number;
  divisionName: string | null;
  organisationId: number;
  organisationName: string | null;
  matchType: number;
  matchTypeName: string | null;
  matchState: number;
  matchStateName: string | null;
  playDay: number;
  playDayName: string | null;
  seasonName: string | null;
  scoreTeamA: number;
  scoreTeamB: number;
  teamAId: number;
  teamNameA: string | null;
  teamBId: number;
  teamNameB: string | null;
  isDeleted: boolean;
  deletedAt: Date | null;
  lastSyncedAt: Date;
  syncVersion: number;
  /** Reserved: SFV API does not provide match-level updatedAt. */
  sourceUpdatedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * Input shape for creating or upserting a SfvCachedMatch row.
 */
export type SfvCachedMatchInput = {
  tenantId: string;
  sfvMatchId: number;
  sfvSeasonId: number;
  matchNumber: number;
  matchDate: Date;
  groupId: number | null;
  cupId: number | null;
  groupName: string | null;
  roundNbr: number;
  playgroundId: number;
  stadiumPlaygroundName: string | null;
  isUnknownPlayground: boolean;
  leagueId: number;
  leagueNumber: number;
  leagueName: string | null;
  divisionId: number;
  divisionName: string | null;
  organisationId: number;
  organisationName: string | null;
  matchType: number;
  matchTypeName: string | null;
  matchState: number;
  matchStateName: string | null;
  playDay: number;
  playDayName: string | null;
  seasonName: string | null;
  scoreTeamA: number;
  scoreTeamB: number;
  teamAId: number;
  teamNameA: string | null;
  teamBId: number;
  teamNameB: string | null;
  lastSyncedAt: Date;
  sourceUpdatedAt: Date | null;
};

// ── SfvCachedRanking ──────────────────────────────────────────────────────────

/**
 * A persisted ranking entry from GET /api/club/ranking (ClubRankingEntry).
 *
 * Upsert key: (tenantId, sfvSeasonId, sfvTeamId, sfvGroupId)
 * A team appears exactly once per group per season in the ranking table.
 * sfvGroupId is the discriminating component below division and league.
 */
export type SfvCachedRanking = {
  id: string;
  tenantId: string;
  sfvSeasonId: number;
  /** SFV teamId from ClubRankingEntry.teamId */
  sfvTeamId: number;
  sfvLeagueId: number;
  sfvDivisionId: number;
  sfvGroupId: number;
  leagueNumber: number;
  leagueName: string | null;
  divisionName: string | null;
  groupName: string | null;
  teamName: string | null;
  clubNumber: number;
  position: number;
  matches: number;
  wins: number;
  draws: number;
  losses: number;
  penaltyPoints: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
  isDeleted: boolean;
  deletedAt: Date | null;
  lastSyncedAt: Date;
  syncVersion: number;
  /** Reserved: SFV API does not provide ranking-level updatedAt. */
  sourceUpdatedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * Input shape for creating or upserting a SfvCachedRanking row.
 */
export type SfvCachedRankingInput = {
  tenantId: string;
  sfvSeasonId: number;
  sfvTeamId: number;
  sfvLeagueId: number;
  sfvDivisionId: number;
  sfvGroupId: number;
  leagueNumber: number;
  leagueName: string | null;
  divisionName: string | null;
  groupName: string | null;
  teamName: string | null;
  clubNumber: number;
  position: number;
  matches: number;
  wins: number;
  draws: number;
  losses: number;
  penaltyPoints: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
  lastSyncedAt: Date;
  sourceUpdatedAt: Date | null;
};

// ── SfvCachedTeamPicture ──────────────────────────────────────────────────────

/**
 * A persisted team picture from GET /api/team/picture/{teamId} (TeamPictureResponse).
 *
 * Upsert key: (tenantId, sfvTeamId)
 * Team pictures are NOT season-specific. One picture per team per tenant.
 *
 * SECURITY: base64Data contains raw image data as returned by the SFV API.
 * Never log this field. Never expose it in error messages or API diagnostics.
 */
export type SfvCachedTeamPicture = {
  id: string;
  tenantId: string;
  sfvTeamId: number;
  /**
   * Raw base64 string from the SFV API response.
   * Decodes to a GIF in production. Never log this value.
   */
  base64Data: string;
  contentType: string;
  contentLength: number | null;
  etag: string | null;
  lastModified: string | null;
  cacheControl: string | null;
  isDeleted: boolean;
  deletedAt: Date | null;
  lastSyncedAt: Date;
  syncVersion: number;
  /**
   * Last-Modified header parsed as DateTime, or null when absent.
   * Usually null for SFV team pictures (production observation).
   */
  sourceUpdatedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * Input shape for creating or upserting a SfvCachedTeamPicture row.
 *
 * SECURITY: base64Data must only travel over trusted internal paths.
 */
export type SfvCachedTeamPictureInput = {
  tenantId: string;
  sfvTeamId: number;
  base64Data: string;
  contentType: string;
  contentLength: number | null;
  etag: string | null;
  lastModified: string | null;
  cacheControl: string | null;
  lastSyncedAt: Date;
  sourceUpdatedAt: Date | null;
};

// ── SfvSyncRun ────────────────────────────────────────────────────────────────

/**
 * Audit record for a single synchronization run.
 * Append-only — never hard-deleted.
 *
 * One row per run: created at start (status=RUNNING) and updated on completion.
 * All counter fields reflect the final delta for the run.
 */
export type SfvSyncRun = {
  id: string;
  tenantId: string;
  sfvSeasonId: number;
  syncType: SfvSyncType;
  status: SfvSyncStatus;
  /** Free-form initiator. Convention: "system:cron", "manual:<userId>". */
  triggeredBy: string | null;
  startedAt: Date;
  completedAt: Date | null;
  /** Duration in milliseconds from startedAt to completedAt. Null while running. */
  durationMs: number | null;
  teamsProcessed: number;
  matchesProcessed: number;
  rankingsProcessed: number;
  picturesProcessed: number;
  teamsCreated: number;
  matchesCreated: number;
  rankingsCreated: number;
  picturesCreated: number;
  teamsUpdated: number;
  matchesUpdated: number;
  rankingsUpdated: number;
  picturesUpdated: number;
  teamsDeleted: number;
  matchesDeleted: number;
  rankingsDeleted: number;
  picturesDeleted: number;
  errorCount: number;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * Input shape for creating a new SfvSyncRun row (at run start).
 */
export type SfvSyncRunCreateInput = {
  tenantId: string;
  sfvSeasonId: number;
  syncType: SfvSyncType;
  triggeredBy: string | null;
  startedAt: Date;
};

/**
 * Input shape for updating a SfvSyncRun row (at run completion or failure).
 * All counter fields are provided in aggregate.
 */
export type SfvSyncRunCompleteInput = {
  status: SfvSyncStatus;
  completedAt: Date;
  durationMs: number;
  teamsProcessed: number;
  matchesProcessed: number;
  rankingsProcessed: number;
  picturesProcessed: number;
  teamsCreated: number;
  matchesCreated: number;
  rankingsCreated: number;
  picturesCreated: number;
  teamsUpdated: number;
  matchesUpdated: number;
  rankingsUpdated: number;
  picturesUpdated: number;
  teamsDeleted: number;
  matchesDeleted: number;
  rankingsDeleted: number;
  picturesDeleted: number;
  errorCount: number;
};

// ── SfvSyncError ──────────────────────────────────────────────────────────────

/**
 * A per-entity error record within a synchronization run.
 * Append-only — never hard-deleted.
 *
 * One row per entity that raised an error during a sync run.
 *
 * SECURITY: stackTrace is server-side only. Never expose in API responses.
 */
export type SfvSyncError = {
  id: string;
  tenantId: string;
  syncRunId: string;
  entityType: SfvSyncEntityType;
  /**
   * Human-readable external identifier.
   * Convention: "teamId:<n>", "matchId:<n>",
   * "rankingKey:<tenantId>:<seasonId>:<teamId>:<groupId>"
   */
  entityExternalId: string | null;
  /** Named phase in the sync pipeline. Convention: "fetch", "parse", "upsert", "soft-delete". */
  phase: string;
  /** Structured error code matching SfvErrorCode or internal codes. */
  errorCode: string;
  errorMessage: string;
  /** Server-side stack trace. Never expose in API responses. */
  stackTrace: string | null;
  retryCount: number;
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * Input shape for appending a SfvSyncError row during a sync run.
 *
 * SECURITY: stackTrace must not be forwarded to the browser or external services.
 */
export type SfvSyncErrorCreateInput = {
  tenantId: string;
  syncRunId: string;
  entityType: SfvSyncEntityType;
  entityExternalId: string | null;
  phase: string;
  errorCode: string;
  errorMessage: string;
  stackTrace: string | null;
};

// ── Upsert result ─────────────────────────────────────────────────────────────

/**
 * Result returned by repository upsert operations.
 * Callers can use `action` to count creates vs. updates for sync run statistics.
 */
export type SfvUpsertResult<T> = {
  record: T;
  action: "created" | "updated";
};

// ── Soft-delete batch result ───────────────────────────────────────────────────

/**
 * Result returned by soft-delete batch operations.
 * `count` is the number of rows soft-deleted in this operation.
 */
export type SfvSoftDeleteResult = {
  count: number;
};
