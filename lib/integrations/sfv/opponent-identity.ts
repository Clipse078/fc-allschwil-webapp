/**
 * lib/integrations/sfv/opponent-identity.ts
 *
 * Opponent Identity Resolver — first narrow aggregation-layer component above
 * the raw SFV clients.
 *
 * Responsibilities:
 *   - Accept schedule or ranking data already fetched from the SFV API.
 *   - Identify which team is an FC Allschwil own team and which is an opponent
 *     using only stable numeric identifiers (teamId).
 *   - Fetch and attach the opponent's picture via fetchTeamPicture.
 *   - Return a typed OpponentIdentity.
 *
 * Contract invariants:
 *   - Own-team identity is derived exclusively from a supplied set of team IDs
 *     (produced by fetchTeamList). No hard-coded IDs. No database access.
 *   - Identity decisions are made using numeric IDs only. Team names are copied
 *     only after numeric resolution — they are never used for identity decisions.
 *   - Ambiguous cases are explicit and never silently guessed.
 *   - No data is persisted. No images are decoded beyond what TeamPictureResponse
 *     already provides.
 *
 * Picture enrichment behaviour (documented for test coverage):
 *   - 204 / null  → picture: null  (no picture on file — valid state)
 *   - 404         → propagate SFV_NOT_FOUND (team identity may itself be invalid)
 *   - auth / timeout / server errors → propagate unchanged
 */

import {
  fetchTeamPicture,
  type ClubScheduleEntry,
  type ClubRankingEntry,
  type TeamPictureResponse,
} from "./client";

// ── Public types ────────────────────────────────────────────────────────────────

/**
 * Which side of a schedule match the opponent occupied.
 * null for ranking rows (no match side concept applies).
 */
export type OpponentSide = "teamA" | "teamB";

/**
 * Resolved opponent identity with optional picture enrichment.
 *
 * source    — which raw SFV data type produced this record.
 * side      — opponent's side in the schedule match; null for ranking rows.
 * ownTeamId — the numeric ID of the FC Allschwil own team on the same row.
 */
export type OpponentIdentity = {
  source: "schedule" | "ranking";
  teamId: number;
  teamName: string | null;
  side: OpponentSide | null;
  ownTeamId: number;
  picture: TeamPictureResponse | null;
};

/**
 * Discriminated result from pure schedule resolution (no network calls).
 *
 * resolved    — exactly one side belongs to ownTeamIds; fields are populated.
 * both-own    — both sides belong to ownTeamIds; cannot determine opponent.
 * no-own-team — neither side belongs to ownTeamIds; cannot determine own team.
 * invalid     — IDs are missing, non-positive integers, or identical (making
 *               resolution invalid); reason field describes the specific problem.
 */
export type ScheduleResolutionResult =
  | {
      outcome: "resolved";
      opponentTeamId: number;
      opponentTeamName: string | null;
      opponentSide: OpponentSide;
      ownTeamId: number;
    }
  | { outcome: "both-own" }
  | { outcome: "no-own-team" }
  | { outcome: "invalid"; reason: string };

/**
 * Discriminated result from pure ranking resolution (no network calls).
 *
 * opponent — the row belongs to a non-own team; fields populated.
 * own-team — the row belongs to an own team; no opponent identity to return.
 * invalid  — teamId is missing or not a positive integer.
 */
export type RankingResolutionResult =
  | { outcome: "opponent"; opponentTeamId: number; opponentTeamName: string | null }
  | { outcome: "own-team"; ownTeamId: number }
  | { outcome: "invalid"; reason: string };

// ── Own-team ID normalization ────────────────────────────────────────────────────

/**
 * Normalises an iterable of own-team numeric IDs into a ReadonlySet<number>.
 *
 * Rules:
 *   - Duplicate IDs are silently deduplicated (harmless).
 *   - Non-integer values (NaN, Infinity, 1.5, …) throw TypeError.
 *   - Zero or negative IDs throw TypeError.
 *   - No hard-coded IDs.
 *
 * Callers must supply IDs derived from fetchTeamList.
 *
 * @throws {TypeError} if any ID is not a positive integer.
 */
export function normalizeOwnTeamIds(input: Iterable<number>): ReadonlySet<number> {
  const result = new Set<number>();
  for (const id of input) {
    if (!Number.isInteger(id) || id <= 0) {
      throw new TypeError(
        `Own-team ID must be a positive integer; received ${id}.`,
      );
    }
    result.add(id);
  }
  return result;
}

// ── Pure schedule resolution ─────────────────────────────────────────────────────

/**
 * Resolves the opponent from a schedule entry using only numeric team IDs.
 *
 * Validation order:
 *   1. teamAId and teamBId must be positive integers.
 *   2. Identical IDs are flagged as invalid (a team cannot play itself).
 *   3. Membership check against ownTeamIds.
 *   4. Ambiguity checks (both-own / no-own-team).
 *
 * Team names are copied only after numeric resolution — never used for decisions.
 *
 * The entry is not mutated.
 */
export function resolveScheduleOpponent(
  entry: ClubScheduleEntry,
  ownTeamIds: ReadonlySet<number>,
): ScheduleResolutionResult {
  const { teamAId, teamBId, teamNameA, teamNameB } = entry;

  if (!Number.isInteger(teamAId) || teamAId <= 0) {
    return { outcome: "invalid", reason: `teamAId is not a positive integer: ${teamAId}.` };
  }
  if (!Number.isInteger(teamBId) || teamBId <= 0) {
    return { outcome: "invalid", reason: `teamBId is not a positive integer: ${teamBId}.` };
  }
  if (teamAId === teamBId) {
    return {
      outcome: "invalid",
      reason: `teamAId and teamBId are identical (${teamAId}); cannot resolve opponent.`,
    };
  }

  const teamAIsOwn = ownTeamIds.has(teamAId);
  const teamBIsOwn = ownTeamIds.has(teamBId);

  if (teamAIsOwn && teamBIsOwn) {
    return { outcome: "both-own" };
  }

  if (!teamAIsOwn && !teamBIsOwn) {
    return { outcome: "no-own-team" };
  }

  if (teamAIsOwn) {
    return {
      outcome: "resolved",
      opponentTeamId: teamBId,
      opponentTeamName: teamNameB,
      opponentSide: "teamB",
      ownTeamId: teamAId,
    };
  }

  return {
    outcome: "resolved",
    opponentTeamId: teamAId,
    opponentTeamName: teamNameA,
    opponentSide: "teamA",
    ownTeamId: teamBId,
  };
}

// ── Pure ranking resolution ──────────────────────────────────────────────────────

/**
 * Resolves whether a ranking entry belongs to an own team or an opponent
 * using only the numeric teamId.
 *
 * Team name is copied only after numeric resolution — never used for decisions.
 *
 * The entry is not mutated.
 */
export function resolveRankingOpponent(
  entry: ClubRankingEntry,
  ownTeamIds: ReadonlySet<number>,
): RankingResolutionResult {
  const { teamId, teamName } = entry;

  if (!Number.isInteger(teamId) || teamId <= 0) {
    return { outcome: "invalid", reason: `teamId is not a positive integer: ${teamId}.` };
  }

  if (ownTeamIds.has(teamId)) {
    return { outcome: "own-team", ownTeamId: teamId };
  }

  return { outcome: "opponent", opponentTeamId: teamId, opponentTeamName: teamName };
}

// ── Async picture enrichment ─────────────────────────────────────────────────────

/**
 * Resolves the opponent identity from a schedule entry, then fetches the
 * opponent team's picture via fetchTeamPicture.
 *
 * Throws if resolution is ambiguous or invalid; callers must handle all
 * ScheduleResolutionResult outcomes before calling this function, or inspect
 * the thrown error type.
 *
 * Picture enrichment behaviour:
 *   - 204 / null picture → identity.picture = null
 *   - 404 (SFV_NOT_FOUND) → propagated (team identity may be invalid)
 *   - auth / timeout / server errors → propagated unchanged
 *
 * fetchTeamPicture is called exactly once for successfully resolved opponents.
 * It is never called for ambiguous or invalid rows.
 *
 * The entry is not mutated.
 *
 * @throws {SfvOpponentResolutionError} if resolution outcome is not "resolved".
 * @throws {SfvError} subclass on picture fetch failure.
 */
export async function resolveScheduleOpponentIdentity(
  entry: ClubScheduleEntry,
  ownTeamIds: ReadonlySet<number>,
): Promise<OpponentIdentity> {
  const resolution = resolveScheduleOpponent(entry, ownTeamIds);

  if (resolution.outcome !== "resolved") {
    throw new SfvOpponentResolutionError(resolution);
  }

  const picture = await fetchTeamPicture(resolution.opponentTeamId);

  return {
    source: "schedule",
    teamId: resolution.opponentTeamId,
    teamName: resolution.opponentTeamName,
    side: resolution.opponentSide,
    ownTeamId: resolution.ownTeamId,
    picture,
  };
}

/**
 * Resolves the opponent identity from a ranking entry, then fetches the
 * opponent team's picture via fetchTeamPicture.
 *
 * Returns null for own-team rows (no opponent identity, no picture fetch).
 *
 * Picture enrichment behaviour:
 *   - 204 / null picture → identity.picture = null
 *   - 404 (SFV_NOT_FOUND) → propagated (team identity may be invalid)
 *   - auth / timeout / server errors → propagated unchanged
 *
 * fetchTeamPicture is called exactly once for opponent rows.
 * It is never called for own-team rows.
 *
 * The entry is not mutated.
 *
 * @throws {SfvOpponentResolutionError} if resolution outcome is "invalid".
 * @throws {SfvError} subclass on picture fetch failure.
 */
export async function resolveRankingOpponentIdentity(
  entry: ClubRankingEntry,
  ownTeamIds: ReadonlySet<number>,
): Promise<OpponentIdentity | null> {
  const resolution = resolveRankingOpponent(entry, ownTeamIds);

  if (resolution.outcome === "own-team") {
    return null;
  }

  if (resolution.outcome === "invalid") {
    throw new SfvOpponentResolutionError(resolution);
  }

  const picture = await fetchTeamPicture(resolution.opponentTeamId);

  return {
    source: "ranking",
    teamId: resolution.opponentTeamId,
    teamName: resolution.opponentTeamName,
    side: null,
    ownTeamId: 0,
    picture,
  };
}

// ── Domain error ─────────────────────────────────────────────────────────────────

/**
 * Thrown when an opponent cannot be resolved due to ambiguity or invalid input.
 * Carries the full discriminated resolution result for structured handling.
 */
export class SfvOpponentResolutionError extends Error {
  public readonly resolution:
    | Exclude<ScheduleResolutionResult, { outcome: "resolved" }>
    | Extract<RankingResolutionResult, { outcome: "invalid" }>;

  constructor(
    resolution:
      | Exclude<ScheduleResolutionResult, { outcome: "resolved" }>
      | Extract<RankingResolutionResult, { outcome: "invalid" }>,
  ) {
    const message = buildResolutionErrorMessage(resolution);
    super(message);
    this.name = "SfvOpponentResolutionError";
    this.resolution = resolution;
  }
}

function buildResolutionErrorMessage(
  resolution:
    | Exclude<ScheduleResolutionResult, { outcome: "resolved" }>
    | Extract<RankingResolutionResult, { outcome: "invalid" }>,
): string {
  switch (resolution.outcome) {
    case "both-own":
      return "Cannot resolve opponent: both schedule teams belong to own-team IDs.";
    case "no-own-team":
      return "Cannot resolve opponent: neither schedule team belongs to own-team IDs.";
    case "invalid":
      return `Cannot resolve opponent: ${resolution.reason}`;
  }
}
