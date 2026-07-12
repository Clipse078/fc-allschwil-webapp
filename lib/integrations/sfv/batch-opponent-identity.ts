/**
 * lib/integrations/sfv/batch-opponent-identity.ts
 *
 * Batch Opponent Identity Resolver — stateless batch layer above the
 * single-entry resolver.
 *
 * Responsibilities:
 *   - Accept complete schedule or ranking collections.
 *   - Resolve opponent identities numerically by delegating to the single-entry
 *     pure functions (resolveScheduleOpponent / resolveRankingOpponent).
 *   - Deduplicate fetchTeamPicture requests by opponent teamId within one batch.
 *   - Limit picture-fetch concurrency to a configurable maximum (default: 4).
 *   - Preserve input order and source indices in all results.
 *   - Return an explicit result for every input row.
 *   - Represent picture failures as per-item structured errors (resilient mode)
 *     or propagate them immediately (failFast mode).
 *
 * Contract invariants:
 *   - No cache survives beyond one batch function invocation.
 *   - No database access, no persistence, no process-wide state.
 *   - Numeric-only identity decisions — team names are never used for matching.
 *   - Input entries and ownTeamIds Iterables are never mutated.
 *   - base64 picture content is never included in summaries or error diagnostics.
 *   - No HTTP logic is duplicated from client.ts; all picture fetching goes
 *     through fetchTeamPicture from the raw client layer.
 */

import {
  fetchTeamPicture,
  type ClubScheduleEntry,
  type ClubRankingEntry,
  type TeamPictureResponse,
} from "./client";
import { SfvError, type SfvErrorCode, isRetryableSfvError } from "./errors";
import {
  normalizeOwnTeamIds,
  resolveScheduleOpponent,
  resolveRankingOpponent,
  type ScheduleResolutionResult,
  type RankingResolutionResult,
  type OpponentIdentity,
} from "./opponent-identity";

// ── Options ────────────────────────────────────────────────────────────────────

/**
 * Options accepted by both batch resolver functions.
 */
export type BatchOpponentIdentityOptions = {
  /**
   * Maximum number of concurrent fetchTeamPicture calls within one batch.
   * Must be a positive integer. Default: 4.
   */
  concurrency?: number;
  /**
   * When true, the batch rejects immediately on the first picture fetch failure.
   * When false (default), failures are captured per-item as status "failed".
   */
  failFast?: boolean;
};

// ── Status ─────────────────────────────────────────────────────────────────────

/**
 * Discriminated status for each batch item.
 *
 * resolved    — opponent resolved and picture fetch attempted (picture may be null).
 * own-team    — row belongs to an own team (ranking only; no opponent, no picture).
 * both-own    — both schedule sides belong to own-team IDs (ambiguous; no picture).
 * no-own-team — neither schedule side belongs to own-team IDs (ambiguous; no picture).
 * invalid     — row IDs are missing, non-positive, or otherwise invalid; no picture.
 * failed      — numeric resolution succeeded but picture fetch threw an error.
 */
export type BatchItemStatus =
  | "resolved"
  | "own-team"
  | "both-own"
  | "no-own-team"
  | "invalid"
  | "failed";

// ── Safe error representation ──────────────────────────────────────────────────

/**
 * Safe, structured representation of a picture-fetch failure.
 *
 * Excludes credentials, tokens, full request URLs, raw response bodies, and
 * base64 content. Safe to embed in batch result types for downstream consumers.
 */
export type SafePictureError = {
  /** Error class name (e.g. "SfvNetworkError", "SfvAuthError"). */
  errorClass: string;
  /** Semantic error code from the SFV integration, or "UNKNOWN" for non-SFV errors. */
  code: SfvErrorCode | "UNKNOWN";
  /** Safe error message (never contains credentials or raw API payloads). */
  message: string;
  /** Whether retrying this request may succeed. */
  retryable: boolean;
};

// ── Schedule batch types ───────────────────────────────────────────────────────

/**
 * Result for one schedule entry within a batch resolution call.
 *
 * index      — position of the entry in the original input array (0-based).
 * entry      — original input entry (not mutated).
 * status     — discriminated outcome.
 * identity   — populated when status is "resolved"; null otherwise.
 * resolution — pure numeric resolution result (always present).
 * error      — populated when status is "failed" with safe failure details.
 */
export type ScheduleOpponentBatchItem = {
  index: number;
  entry: ClubScheduleEntry;
  status: BatchItemStatus;
  identity: OpponentIdentity | null;
  resolution: ScheduleResolutionResult;
  error?: SafePictureError;
};

export type ScheduleOpponentBatchResult = {
  items: ScheduleOpponentBatchItem[];
  summary: BatchSummary;
};

// ── Ranking batch types ────────────────────────────────────────────────────────

/**
 * Result for one ranking entry within a batch resolution call.
 *
 * index      — position of the entry in the original input array (0-based).
 * entry      — original input entry (not mutated).
 * status     — discriminated outcome.
 * identity   — populated when status is "resolved"; null otherwise.
 * resolution — pure numeric resolution result (always present).
 * error      — populated when status is "failed" with safe failure details.
 */
export type RankingOpponentBatchItem = {
  index: number;
  entry: ClubRankingEntry;
  status: BatchItemStatus;
  identity: OpponentIdentity | null;
  resolution: RankingResolutionResult;
  error?: SafePictureError;
};

export type RankingOpponentBatchResult = {
  items: RankingOpponentBatchItem[];
  summary: BatchSummary;
};

// ── Summary ────────────────────────────────────────────────────────────────────

/**
 * Aggregate counts summarising one batch resolution call.
 *
 * All counts are derived from numeric IDs and resolution outcomes —
 * never from names.
 */
export type BatchSummary = {
  total: number;
  resolved: number;
  ownTeam: number;
  bothOwn: number;
  noOwnTeam: number;
  invalid: number;
  failed: number;
  /** Number of distinct opponent teamIds that required a picture request. */
  uniqueOpponentTeamIds: number;
  /**
   * Actual number of fetchTeamPicture calls made.
   * Equals uniqueOpponentTeamIds because deduplication ensures one call per ID.
   */
  pictureRequests: number;
};

// ── Internal: option resolution and validation ─────────────────────────────────

const DEFAULT_CONCURRENCY = 4;

function resolveOptions(options?: BatchOpponentIdentityOptions): {
  concurrency: number;
  failFast: boolean;
} {
  const concurrency = options?.concurrency ?? DEFAULT_CONCURRENCY;
  const failFast = options?.failFast ?? false;

  if (
    typeof concurrency !== "number" ||
    !Number.isFinite(concurrency) ||
    !Number.isInteger(concurrency) ||
    concurrency <= 0
  ) {
    throw new TypeError(
      `BatchOpponentIdentityOptions.concurrency must be a positive integer; received ${String(concurrency)}.`,
    );
  }

  return { concurrency, failFast };
}

// ── Internal: bounded concurrency ─────────────────────────────────────────────

/**
 * Runs an array of async tasks with at most `concurrency` in-flight at once.
 *
 * Guarantees:
 *   - Result order matches task order (input[i] → results[i]).
 *   - At most `concurrency` tasks are executing concurrently at any time.
 *   - No process-wide state; all state is local to this invocation.
 *   - No work continues after the returned Promise settles.
 *
 * Implementation: creates min(concurrency, tasks.length) worker coroutines.
 * Each worker claims the next unstarted task via a shared cursor.
 * This is safe in the JavaScript single-threaded model because cursor
 * access and increment happen synchronously between awaits.
 */
async function runWithBoundedConcurrency<T>(
  tasks: ReadonlyArray<() => Promise<T>>,
  concurrency: number,
): Promise<T[]> {
  if (tasks.length === 0) return [];

  const results: T[] = new Array(tasks.length);
  let cursor = 0;

  async function worker(): Promise<void> {
    while (cursor < tasks.length) {
      const idx = cursor++;
      results[idx] = await tasks[idx]();
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, tasks.length) }, () => worker()),
  );

  return results;
}

// ── Internal: safe picture error capture ──────────────────────────────────────

function capturePictureError(error: unknown): SafePictureError {
  if (error instanceof SfvError) {
    return {
      errorClass: error.name,
      code: error.code,
      message: error.message,
      retryable: isRetryableSfvError(error.code),
    };
  }
  if (error instanceof Error) {
    return {
      errorClass: error.name,
      code: "UNKNOWN",
      message: error.message,
      retryable: false,
    };
  }
  return {
    errorClass: "UnknownError",
    code: "UNKNOWN",
    message: "An unknown error occurred during picture fetch.",
    retryable: false,
  };
}

// ── Internal: picture outcome type ────────────────────────────────────────────

type PictureOutcome =
  | { ok: true; picture: TeamPictureResponse | null }
  | { ok: false; error: SafePictureError };

// ── Internal: fetch pictures for a deduplicated list of team IDs ───────────────

/**
 * Fetches pictures for a deduplicated list of opponent teamIds using bounded
 * concurrency.
 *
 * Each teamId in the input list triggers exactly one fetchTeamPicture call.
 * The caller must supply only unique IDs (deduplication is the caller's
 * responsibility at the batch level).
 *
 * In resilient mode (failFast=false), errors are captured per-team as
 * PictureOutcome { ok: false }.
 * In failFast mode, the first error rejects the entire batch.
 *
 * Returns a Map from teamId → PictureOutcome.
 */
async function fetchPicturesForTeams(
  teamIds: ReadonlyArray<number>,
  concurrency: number,
  failFast: boolean,
): Promise<Map<number, PictureOutcome>> {
  if (teamIds.length === 0) return new Map();

  const tasks: Array<() => Promise<{ teamId: number; outcome: PictureOutcome }>> =
    teamIds.map((teamId) => {
      if (failFast) {
        return async () => {
          const picture = await fetchTeamPicture(teamId);
          return { teamId, outcome: { ok: true as const, picture } };
        };
      }
      return async () => {
        try {
          const picture = await fetchTeamPicture(teamId);
          return { teamId, outcome: { ok: true as const, picture } };
        } catch (err) {
          return { teamId, outcome: { ok: false as const, error: capturePictureError(err) } };
        }
      };
    });

  const fetched = await runWithBoundedConcurrency(tasks, concurrency);

  const map = new Map<number, PictureOutcome>();
  for (const { teamId, outcome } of fetched) {
    map.set(teamId, outcome);
  }
  return map;
}

// ── Internal: collect unique opponent IDs in input order ───────────────────────

function collectUniqueOpponentIds(
  resolutions: ReadonlyArray<ScheduleResolutionResult | RankingResolutionResult>,
): number[] {
  const seen = new Set<number>();
  const ids: number[] = [];
  for (const resolution of resolutions) {
    const opponentId =
      resolution.outcome === "resolved"
        ? resolution.opponentTeamId
        : resolution.outcome === "opponent"
          ? resolution.opponentTeamId
          : undefined;
    if (opponentId !== undefined && !seen.has(opponentId)) {
      seen.add(opponentId);
      ids.push(opponentId);
    }
  }
  return ids;
}

// ── Internal: summary builders ─────────────────────────────────────────────────

function buildScheduleSummary(
  items: ReadonlyArray<ScheduleOpponentBatchItem>,
  uniqueOpponentTeamIds: number,
): BatchSummary {
  let resolved = 0;
  let bothOwn = 0;
  let noOwnTeam = 0;
  let invalid = 0;
  let failed = 0;

  for (const item of items) {
    switch (item.status) {
      case "resolved":
        resolved++;
        break;
      case "both-own":
        bothOwn++;
        break;
      case "no-own-team":
        noOwnTeam++;
        break;
      case "invalid":
        invalid++;
        break;
      case "failed":
        failed++;
        break;
    }
  }

  return {
    total: items.length,
    resolved,
    ownTeam: 0,
    bothOwn,
    noOwnTeam,
    invalid,
    failed,
    uniqueOpponentTeamIds,
    pictureRequests: uniqueOpponentTeamIds,
  };
}

function buildRankingSummary(
  items: ReadonlyArray<RankingOpponentBatchItem>,
  uniqueOpponentTeamIds: number,
): BatchSummary {
  let resolved = 0;
  let ownTeam = 0;
  let invalid = 0;
  let failed = 0;

  for (const item of items) {
    switch (item.status) {
      case "resolved":
        resolved++;
        break;
      case "own-team":
        ownTeam++;
        break;
      case "invalid":
        invalid++;
        break;
      case "failed":
        failed++;
        break;
    }
  }

  return {
    total: items.length,
    resolved,
    ownTeam,
    bothOwn: 0,
    noOwnTeam: 0,
    invalid,
    failed,
    uniqueOpponentTeamIds,
    pictureRequests: uniqueOpponentTeamIds,
  };
}

// ── Schedule batch resolver ────────────────────────────────────────────────────

/**
 * Resolves opponent identities for a complete schedule collection.
 *
 * Algorithm:
 *   1. Validate options and normalize ownTeamIds once.
 *   2. Run pure numeric resolution for every entry (no network calls).
 *   3. Collect unique resolved opponent teamIds in first-seen order.
 *   4. Fetch pictures with bounded concurrency (one call per unique teamId).
 *   5. Assemble per-item results, preserving input order.
 *   6. Return the result collection with a summary.
 *
 * Guarantees:
 *   - Items are returned in the same order as the input entries array.
 *   - Each entry produces exactly one result item (index matches input position).
 *   - Input entries and ownTeamIds are not mutated.
 *   - No picture is fetched for rows with status "both-own", "no-own-team",
 *     or "invalid".
 *   - Duplicate opponent teamIds produce only one fetchTeamPicture call;
 *     all rows sharing a teamId receive the same PictureOutcome.
 *   - No deduplication state survives after this call returns.
 *
 * @param entries     Complete schedule entries (not mutated).
 * @param ownTeamIds  Iterable of own-team numeric IDs (not mutated).
 * @param options     Batch options. Concurrency default: 4.
 *
 * @throws {TypeError} if ownTeamIds contains non-positive-integer IDs.
 * @throws {TypeError} if options.concurrency is not a positive integer.
 * @throws {SfvError}  subclass propagated when failFast=true and a picture fetch fails.
 */
export async function resolveScheduleOpponentIdentities(
  entries: readonly ClubScheduleEntry[],
  ownTeamIds: Iterable<number>,
  options?: BatchOpponentIdentityOptions,
): Promise<ScheduleOpponentBatchResult> {
  const { concurrency, failFast } = resolveOptions(options);
  const ownSet = normalizeOwnTeamIds(ownTeamIds);

  if (entries.length === 0) {
    return {
      items: [],
      summary: {
        total: 0,
        resolved: 0,
        ownTeam: 0,
        bothOwn: 0,
        noOwnTeam: 0,
        invalid: 0,
        failed: 0,
        uniqueOpponentTeamIds: 0,
        pictureRequests: 0,
      },
    };
  }

  // Pure resolution pass — no network calls
  const resolutions: ScheduleResolutionResult[] = entries.map((entry) =>
    resolveScheduleOpponent(entry, ownSet),
  );

  // Collect unique resolved opponent teamIds in input order
  const uniqueOpponentIds = collectUniqueOpponentIds(resolutions);

  // Fetch pictures with bounded concurrency and per-call deduplication
  const pictureMap = await fetchPicturesForTeams(uniqueOpponentIds, concurrency, failFast);

  // Assemble result items in input order
  const items: ScheduleOpponentBatchItem[] = entries.map((entry, index) => {
    const resolution = resolutions[index];

    if (resolution.outcome === "resolved") {
      const outcome = pictureMap.get(resolution.opponentTeamId)!;
      if (outcome.ok) {
        return {
          index,
          entry,
          status: "resolved" as const,
          identity: {
            source: "schedule" as const,
            teamId: resolution.opponentTeamId,
            teamName: resolution.opponentTeamName,
            side: resolution.opponentSide,
            ownTeamId: resolution.ownTeamId,
            picture: outcome.picture,
          },
          resolution,
        };
      }
      return {
        index,
        entry,
        status: "failed" as const,
        identity: null,
        resolution,
        error: outcome.error,
      };
    }

    // "both-own" | "no-own-team" | "invalid" — no picture attempted
    return {
      index,
      entry,
      status: resolution.outcome satisfies "both-own" | "no-own-team" | "invalid",
      identity: null,
      resolution,
    };
  });

  const summary = buildScheduleSummary(items, uniqueOpponentIds.length);
  return { items, summary };
}

// ── Ranking batch resolver ─────────────────────────────────────────────────────

/**
 * Resolves opponent identities for a complete ranking collection.
 *
 * Algorithm:
 *   1. Validate options and normalize ownTeamIds once.
 *   2. Run pure numeric resolution for every entry (no network calls).
 *   3. Collect unique resolved opponent teamIds in first-seen order.
 *   4. Fetch pictures with bounded concurrency (one call per unique teamId).
 *   5. Assemble per-item results, preserving input order.
 *   6. Return the result collection with a summary.
 *
 * Guarantees:
 *   - Own-team rows receive status "own-team" and no picture is fetched.
 *   - Invalid rows receive status "invalid" and no picture is fetched.
 *   - Opponent rows with the same teamId share one picture request.
 *   - Input entries and ownTeamIds are not mutated.
 *   - No deduplication state survives after this call returns.
 *
 * @param entries     Complete ranking entries (not mutated).
 * @param ownTeamIds  Iterable of own-team numeric IDs (not mutated).
 * @param options     Batch options. Concurrency default: 4.
 *
 * @throws {TypeError} if ownTeamIds contains non-positive-integer IDs.
 * @throws {TypeError} if options.concurrency is not a positive integer.
 * @throws {SfvError}  subclass propagated when failFast=true and a picture fetch fails.
 */
export async function resolveRankingOpponentIdentities(
  entries: readonly ClubRankingEntry[],
  ownTeamIds: Iterable<number>,
  options?: BatchOpponentIdentityOptions,
): Promise<RankingOpponentBatchResult> {
  const { concurrency, failFast } = resolveOptions(options);
  const ownSet = normalizeOwnTeamIds(ownTeamIds);

  if (entries.length === 0) {
    return {
      items: [],
      summary: {
        total: 0,
        resolved: 0,
        ownTeam: 0,
        bothOwn: 0,
        noOwnTeam: 0,
        invalid: 0,
        failed: 0,
        uniqueOpponentTeamIds: 0,
        pictureRequests: 0,
      },
    };
  }

  // Pure resolution pass — no network calls
  const resolutions: RankingResolutionResult[] = entries.map((entry) =>
    resolveRankingOpponent(entry, ownSet),
  );

  // Collect unique resolved opponent teamIds in input order
  const uniqueOpponentIds = collectUniqueOpponentIds(resolutions);

  // Fetch pictures with bounded concurrency and per-call deduplication
  const pictureMap = await fetchPicturesForTeams(uniqueOpponentIds, concurrency, failFast);

  // Assemble result items in input order
  const items: RankingOpponentBatchItem[] = entries.map((entry, index) => {
    const resolution = resolutions[index];

    if (resolution.outcome === "opponent") {
      const outcome = pictureMap.get(resolution.opponentTeamId)!;
      if (outcome.ok) {
        return {
          index,
          entry,
          status: "resolved" as const,
          identity: {
            source: "ranking" as const,
            teamId: resolution.opponentTeamId,
            teamName: resolution.opponentTeamName,
            side: null,
            ownTeamId: 0,
            picture: outcome.picture,
          },
          resolution,
        };
      }
      return {
        index,
        entry,
        status: "failed" as const,
        identity: null,
        resolution,
        error: outcome.error,
      };
    }

    if (resolution.outcome === "own-team") {
      return {
        index,
        entry,
        status: "own-team" as const,
        identity: null,
        resolution,
      };
    }

    // "invalid"
    return {
      index,
      entry,
      status: "invalid" as const,
      identity: null,
      resolution,
    };
  });

  const summary = buildRankingSummary(items, uniqueOpponentIds.length);
  return { items, summary };
}
