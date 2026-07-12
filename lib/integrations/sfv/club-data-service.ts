/**
 * lib/integrations/sfv/club-data-service.ts
 *
 * Club Data Aggregation Service — stateless, request-scoped.
 *
 * Composes the existing SFV raw clients and batch resolvers into one
 * typed ClubSeasonData aggregate. Every consumer gets a single call
 * instead of orchestrating several SFV endpoints independently.
 *
 * Architecture invariants:
 *   - No HTTP logic is duplicated from client.ts.
 *   - No data is persisted; no cache survives after the function returns.
 *   - No database access, no background jobs, no synchronization.
 *   - All SFV errors propagate unchanged; none are swallowed.
 *   - Identity decisions are made using numeric IDs only.
 *   - base64 picture content is never surfaced in summaries or error messages.
 *
 * Data flow:
 *   resolveClubIds()                          (validates connectivity)
 *   ↓
 *   fetchTeamList()                           (own teams for this season)
 *   ↓
 *   normalizeOwnTeamIds()                     (validated ReadonlySet)
 *   ↓
 *   fetchClubSchedule() ║ fetchClubRanking()  (parallel)
 *   ↓
 *   resolveScheduleOpponentIdentities()       (batch — sequential)
 *   ↓
 *   resolveRankingOpponentIdentities()        (batch — sequential)
 *   ↓
 *   ClubSeasonData
 */

import {
  resolveClubIds,
  fetchTeamList,
  fetchClubSchedule,
  fetchClubRanking,
  type TeamDetail,
  type ClubScheduleEntry,
  type ClubRankingEntry,
} from "./client";
import { normalizeOwnTeamIds } from "./opponent-identity";
import {
  resolveScheduleOpponentIdentities,
  resolveRankingOpponentIdentities,
  type ScheduleOpponentBatchResult,
  type RankingOpponentBatchResult,
  type BatchOpponentIdentityOptions,
} from "./batch-opponent-identity";

// ── Public types ──────────────────────────────────────────────────────────────

/**
 * Enriched schedule data: raw SFV entries paired with their opponent
 * identity resolution results.
 */
export type ClubScheduleData = {
  /** Raw schedule entries exactly as returned by GET /api/club/schedule. */
  entries: readonly ClubScheduleEntry[];
  /** Batch opponent identity resolution for every schedule entry. */
  resolution: ScheduleOpponentBatchResult;
};

/**
 * Enriched ranking data: raw SFV entries paired with their opponent
 * identity resolution results.
 */
export type ClubRankingData = {
  /** Raw ranking entries exactly as returned by GET /api/club/ranking. */
  entries: readonly ClubRankingEntry[];
  /** Batch opponent identity resolution for every ranking entry. */
  resolution: RankingOpponentBatchResult;
};

/**
 * Aggregate summary of one club season load.
 *
 * All counts are derived from numeric IDs and resolution outcomes.
 * Names are never used for counting decisions.
 *
 * uniqueOpponentTeams — distinct opponent teamIds across schedule and ranking
 *                       combined (includes resolved and failed picture items).
 * pictureCount        — unique opponent teams with a non-null picture (i.e.
 *                       the SFV API returned a picture, first-seen result wins
 *                       when the same team appears in both datasets).
 * missingPictures     — unique opponent teams where the SFV API returned no
 *                       picture (204 / null) — a valid state, not a failure.
 */
export type ClubSeasonSummary = {
  ownTeamCount: number;
  scheduleCount: number;
  rankingCount: number;
  resolvedScheduleOpponents: number;
  resolvedRankingOpponents: number;
  uniqueOpponentTeams: number;
  pictureCount: number;
  missingPictures: number;
};

/**
 * Complete in-memory season model for one club and season.
 *
 * seasonName      — derived from the first schedule entry that provides one;
 *                   null when the schedule is empty or entries carry no name.
 * seasonShortName — compact form of seasonName (e.g. "2026/2027" → "26/27");
 *                   null when the name cannot be parsed.
 */
export type ClubSeasonData = {
  clubId: number;
  seasonId: number;
  seasonName: string | null;
  seasonShortName: string | null;
  /** All own teams for this club and season, in SFV API order. */
  ownTeams: readonly TeamDetail[];
  schedule: ClubScheduleData;
  ranking: ClubRankingData;
  summary: ClubSeasonSummary;
};

/**
 * Parameters accepted by loadClubSeasonData.
 */
export type LoadClubSeasonDataParams = {
  /** Numeric club identifier (e.g. 483 for FC Allschwil). */
  clubId: number;
  /** Numeric season identifier (e.g. 2027 for the 2026/2027 season). */
  seasonId: number;
  /**
   * Batch resolver options forwarded to both schedule and ranking resolution.
   * Defaults: concurrency=4, failFast=false.
   */
  batchOptions?: BatchOpponentIdentityOptions;
};

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Derives a short season label from the full SFV season name.
 * "2026/2027" → "26/27". Returns null when the name does not match the
 * expected YYYY/YYYY pattern.
 */
function deriveSeasonShortName(seasonName: string | null): string | null {
  if (!seasonName) return null;
  const match = /^(\d{4})\/(\d{4})$/.exec(seasonName.trim());
  if (!match) return null;
  return `${match[1].slice(2)}/${match[2].slice(2)}`;
}

/**
 * Builds the ClubSeasonSummary from resolved schedule and ranking data.
 *
 * uniqueOpponentTeams is the union of all resolved and failed opponent teamIds
 * across both datasets.
 *
 * pictureCount and missingPictures count distinct opponent teams (not rows).
 * When the same team appears in both schedule and ranking resolution, the first
 * result encountered (schedule order) determines its picture classification.
 */
function buildSummary(
  ownTeams: readonly TeamDetail[],
  schedule: ClubScheduleData,
  ranking: ClubRankingData,
): ClubSeasonSummary {
  const uniqueOpponentTeamIds = new Set<number>();
  /** teamId → true (has picture) | false (picture is null — valid, no error). */
  const pictureStatusByTeamId = new Map<number, boolean>();

  for (const item of schedule.resolution.items) {
    if (item.status === "resolved" && item.identity !== null) {
      uniqueOpponentTeamIds.add(item.identity.teamId);
      if (!pictureStatusByTeamId.has(item.identity.teamId)) {
        pictureStatusByTeamId.set(item.identity.teamId, item.identity.picture !== null);
      }
    } else if (item.status === "failed" && item.resolution.outcome === "resolved") {
      uniqueOpponentTeamIds.add(item.resolution.opponentTeamId);
    }
  }

  for (const item of ranking.resolution.items) {
    if (item.status === "resolved" && item.identity !== null) {
      uniqueOpponentTeamIds.add(item.identity.teamId);
      if (!pictureStatusByTeamId.has(item.identity.teamId)) {
        pictureStatusByTeamId.set(item.identity.teamId, item.identity.picture !== null);
      }
    } else if (item.status === "failed" && item.resolution.outcome === "opponent") {
      uniqueOpponentTeamIds.add(item.resolution.opponentTeamId);
    }
  }

  let pictureCount = 0;
  let missingPictures = 0;
  for (const hasPicture of pictureStatusByTeamId.values()) {
    if (hasPicture) pictureCount++;
    else missingPictures++;
  }

  return {
    ownTeamCount: ownTeams.length,
    scheduleCount: schedule.entries.length,
    rankingCount: ranking.entries.length,
    resolvedScheduleOpponents: schedule.resolution.summary.resolved,
    resolvedRankingOpponents: ranking.resolution.summary.resolved,
    uniqueOpponentTeams: uniqueOpponentTeamIds.size,
    pictureCount,
    missingPictures,
  };
}

// ── Public service function ───────────────────────────────────────────────────

/**
 * Loads a complete in-memory season model for one club and season.
 *
 * Calls the SFV API in the following order:
 *   1. resolveClubIds()             — connectivity + club validation
 *   2. fetchTeamList()              — own teams for this season
 *   3. [fetchClubSchedule(),        — parallel
 *       fetchClubRanking()]
 *   4. resolveScheduleOpponentIdentities()  — batch, sequential
 *   5. resolveRankingOpponentIdentities()   — batch, sequential
 *
 * Picture fetches are deduplicated per batch call by the batch resolver.
 * No picture fetch logic is duplicated here.
 *
 * All SFV errors propagate unchanged. No errors are swallowed.
 * No data is persisted. No cache survives after this call returns.
 *
 * @throws {SfvConfigurationError} if SFV environment variables are missing or invalid.
 * @throws {SfvAuthError}          if authentication fails.
 * @throws {SfvNetworkError}       if any SFV endpoint is unreachable or returns an error.
 * @throws {TypeError}             if any own-team ID from fetchTeamList is not a positive integer.
 */
export async function loadClubSeasonData(
  params: LoadClubSeasonDataParams,
): Promise<ClubSeasonData> {
  const { clubId, seasonId, batchOptions } = params;

  // Step 1: Validate connectivity and club existence.
  await resolveClubIds();

  // Step 2: Fetch own teams for this club and season.
  const ownTeams = await fetchTeamList({ SeasonId: seasonId, ClubId: clubId });

  // Step 3: Normalize own team IDs once — reused by both batch resolvers.
  const ownTeamIds = normalizeOwnTeamIds(ownTeams.map((t) => t.teamId));

  // Step 4: Fetch schedule and ranking in parallel — both are independent of each other.
  const [scheduleEntries, rankingEntries] = await Promise.all([
    fetchClubSchedule({ SeasonId: seasonId, ClubId: clubId }),
    fetchClubRanking({ SeasonId: seasonId, ClubId: clubId }),
  ]);

  // Step 5: Resolve schedule opponent identities (includes picture fetch).
  const scheduleResolution = await resolveScheduleOpponentIdentities(
    scheduleEntries,
    ownTeamIds,
    batchOptions,
  );

  // Step 6: Resolve ranking opponent identities (includes picture fetch).
  const rankingResolution = await resolveRankingOpponentIdentities(
    rankingEntries,
    ownTeamIds,
    batchOptions,
  );

  // Step 7: Assemble the aggregate.
  const scheduleData: ClubScheduleData = {
    entries: scheduleEntries,
    resolution: scheduleResolution,
  };
  const rankingData: ClubRankingData = {
    entries: rankingEntries,
    resolution: rankingResolution,
  };

  const seasonName =
    scheduleEntries.find((e) => e.seasonName !== null)?.seasonName ?? null;

  const summary = buildSummary(ownTeams, scheduleData, rankingData);

  return {
    clubId,
    seasonId,
    seasonName,
    seasonShortName: deriveSeasonShortName(seasonName),
    ownTeams,
    schedule: scheduleData,
    ranking: rankingData,
    summary,
  };
}
