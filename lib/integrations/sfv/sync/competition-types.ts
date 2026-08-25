/**
 * lib/integrations/sfv/sync/competition-types.ts
 *
 * Types for SFV competition synchronization.
 *
 * SFV exposes competition/league data via the TeamDetail (team list) response.
 * Each team belongs to a league (teamLeagueId / teamLeagueName) and a division
 * (teamDivisionName). We extract unique competitions from the team list response
 * to build canonical Competition records.
 *
 * Security invariants:
 *   - No credentials, tokens, or raw provider payloads in any result type.
 *   - tenantId always originates from a trusted session context.
 */

import type { SyncErrorEntry } from "./types";

// ── Sync context ───────────────────────────────────────────────────────────────

/**
 * Immutable context passed through all competition sync steps.
 *
 * Established once from the trusted session + tenant config at the start of a
 * competition sync run.
 */
export type SfvCompetitionSyncContext = {
  tenantId: string;
  clubId: number;
  seasonId: number;
  organisationId: number | null;
  syncedAt: Date;
};

// ── Extracted competition identity ─────────────────────────────────────────────

/**
 * A competition extracted from SFV TeamDetail records.
 *
 * Multiple TeamDetail rows may reference the same league; deduplication is
 * performed by the extractor before persistence.
 */
export type ExtractedSfvCompetition = {
  externalCompetitionId: number;
  externalSeasonId: number;
  officialName: string;
  groupName: string | null;
};

// ── Sync result ────────────────────────────────────────────────────────────────

/**
 * Structured result returned by a competition synchronization run.
 *
 * Serializable to JSON. Safe to return from API routes.
 */
export type SfvCompetitionSyncResult = {
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  tenantId: string;
  source: string;
  clubId: number;
  seasonId: number;
  fetched: number;
  created: number;
  updated: number;
  unchanged: number;
  archived: number;
  failed: number;
  errors: SyncErrorEntry[];
  /** TeamSeasonCompetition rows linked during this sync run. */
  teamSeasonCompetitionsLinked: number;
  /** Teams skipped (no mapping, unresolved TeamSeason, or missing Competition). */
  teamSeasonCompetitionsSkipped: number;
  /** TeamSeasonCompetition link failures. */
  teamSeasonCompetitionLinkFailed: number;
};
