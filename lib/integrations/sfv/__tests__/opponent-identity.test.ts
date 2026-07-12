/**
 * lib/integrations/sfv/__tests__/opponent-identity.test.ts
 *
 * Focused unit tests for the Opponent Identity Resolver.
 *
 * All tests are pure or use mocked fetchTeamPicture.
 * No real network requests are made. No production secrets are used.
 *
 * RESOLVER CONTRACT UNDER TEST:
 *
 *   normalizeOwnTeamIds:
 *     - Accepts Iterable<number> (array, Set, generator, etc.)
 *     - Deduplicates silently
 *     - Rejects non-integers, zero, and negative values with TypeError
 *
 *   resolveScheduleOpponent (pure):
 *     - Uses only teamAId / teamBId for identity decisions
 *     - Copies teamNameA / teamNameB only after numeric resolution
 *     - Returns discriminated outcome: "resolved" | "both-own" | "no-own-team" | "invalid"
 *     - Identical IDs → "invalid"
 *     - Missing/non-positive integer IDs → "invalid"
 *
 *   resolveRankingOpponent (pure):
 *     - Uses only teamId for identity decisions
 *     - Returns discriminated outcome: "opponent" | "own-team" | "invalid"
 *     - Missing/non-positive integer teamId → "invalid"
 *
 *   resolveScheduleOpponentIdentity (async):
 *     - Calls fetchTeamPicture exactly once after successful numeric resolution
 *     - Throws SfvOpponentResolutionError for ambiguous / invalid rows
 *     - Does not call fetchTeamPicture for ambiguous / invalid rows
 *     - Propagates picture 404 (SFV_NOT_FOUND) without swallowing
 *     - Propagates auth / timeout / server errors unchanged
 *     - null picture preserved as picture: null
 *     - Does not mutate the entry or the own-team ID set
 *
 *   resolveRankingOpponentIdentity (async):
 *     - Returns null for own-team rows (no picture fetch)
 *     - Calls fetchTeamPicture exactly once for opponent rows
 *     - Throws SfvOpponentResolutionError for invalid rows
 *     - Propagates all fetchTeamPicture errors unchanged
 *     - Does not mutate the entry or the own-team ID set
 *
 * PICTURE ENRICHMENT BEHAVIOUR (documented here for traceability):
 *   204 / null  → picture: null  (no picture on file — valid state)
 *   404         → propagate SFV_NOT_FOUND (team identity may itself be invalid)
 *   auth / timeout / server → propagate unchanged
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  normalizeOwnTeamIds,
  resolveScheduleOpponent,
  resolveRankingOpponent,
  resolveScheduleOpponentIdentity,
  resolveRankingOpponentIdentity,
  SfvOpponentResolutionError,
} from "../opponent-identity";
import { SfvAuthError, SfvNetworkError } from "../errors";
import type { ClubScheduleEntry, ClubRankingEntry, TeamPictureResponse } from "../client";

// ── Mocking fetchTeamPicture ─────────────────────────────────────────────────────

vi.mock("../client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../client")>();
  return {
    ...actual,
    fetchTeamPicture: vi.fn(),
  };
});

import { fetchTeamPicture } from "../client";
const mockFetchTeamPicture = vi.mocked(fetchTeamPicture);

// ── Synthetic test data ──────────────────────────────────────────────────────────

/** Own team IDs — representative numeric set, no hard-coded production values. */
const OWN_TEAM_ID_A = 10001;
const OWN_TEAM_ID_B = 10002;
const OPPONENT_TEAM_ID = 20001;
const ANOTHER_OPPONENT_ID = 20002;

const OWN_TEAM_IDS: ReadonlySet<number> = new Set([OWN_TEAM_ID_A, OWN_TEAM_ID_B]);

/** Minimal valid ClubScheduleEntry — own team is teamA. */
function makeScheduleEntry(
  overrides: Partial<ClubScheduleEntry> = {},
): ClubScheduleEntry {
  return {
    matchId: 100001,
    matchNumber: 1,
    matchDate: "2026-09-05T15:00:00",
    groupId: null,
    cupId: null,
    groupName: null,
    roundNbr: 1,
    playgroundId: 5001,
    stadiumPlaygroundName: "Sportanlage Brühl",
    isUnkownPlayground: false,
    leagueId: 301,
    leagueNumber: 4,
    leagueName: "4. Liga",
    divisionId: 401,
    divisionName: "Gruppe 1",
    organisationId: 1,
    organisationName: "SFV",
    matchType: 1,
    matchTypeName: "Meisterschaft",
    matchState: 0,
    matchStateName: "Geplant",
    playDay: 1,
    playDayName: "1. Spieltag",
    seasonId: 2027,
    seasonName: "2026/2027",
    scoreTeamA: 0,
    scoreTeamB: 0,
    teamAId: OWN_TEAM_ID_A,
    teamNameA: "FC Allschwil 1",
    teamBId: OPPONENT_TEAM_ID,
    teamNameB: "FC Opponent",
    ...overrides,
  };
}

/** Minimal valid ClubRankingEntry — opponent row by default. */
function makeRankingEntry(
  overrides: Partial<ClubRankingEntry> = {},
): ClubRankingEntry {
  return {
    leagueId: 301,
    leagueNumber: 4,
    leagueName: "4. Liga",
    divisionId: 401,
    divisionName: "Gruppe 1",
    groupId: 501,
    groupName: "Gruppe A",
    teamName: "FC Opponent",
    clubNumber: 999,
    position: 3,
    matches: 5,
    wins: 3,
    draws: 1,
    losses: 1,
    penaltyPoints: 0,
    goalsFor: 10,
    goalsAgainst: 5,
    points: 10,
    teamId: OPPONENT_TEAM_ID,
    ...overrides,
  };
}

/** Minimal valid TeamPictureResponse. */
const SYNTHETIC_PICTURE: TeamPictureResponse = {
  base64: "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  contentType: "application/json; charset=utf-8",
  contentLength: null,
  etag: null,
  lastModified: null,
  cacheControl: null,
};

// ── Lifecycle ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  mockFetchTeamPicture.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

// ════════════════════════════════════════════════════════════════════════════════
// 1. Own-team set validation
// ════════════════════════════════════════════════════════════════════════════════

describe("normalizeOwnTeamIds", () => {
  // Test 1: valid array
  it("accepts a valid number array and returns a Set containing all IDs", () => {
    const result = normalizeOwnTeamIds([OWN_TEAM_ID_A, OWN_TEAM_ID_B]);
    expect(result).toBeInstanceOf(Set);
    expect(result.has(OWN_TEAM_ID_A)).toBe(true);
    expect(result.has(OWN_TEAM_ID_B)).toBe(true);
    expect(result.size).toBe(2);
  });

  // Test 2: valid Set
  it("accepts a Set<number> as Iterable and returns a Set with same contents", () => {
    const input = new Set([OWN_TEAM_ID_A, OWN_TEAM_ID_B]);
    const result = normalizeOwnTeamIds(input);
    expect(result.has(OWN_TEAM_ID_A)).toBe(true);
    expect(result.has(OWN_TEAM_ID_B)).toBe(true);
    expect(result.size).toBe(2);
  });

  // Test 3: duplicate IDs are deduplicated silently
  it("deduplicates duplicate IDs without error", () => {
    const result = normalizeOwnTeamIds([OWN_TEAM_ID_A, OWN_TEAM_ID_A, OWN_TEAM_ID_B]);
    expect(result.size).toBe(2);
    expect(result.has(OWN_TEAM_ID_A)).toBe(true);
    expect(result.has(OWN_TEAM_ID_B)).toBe(true);
  });

  // Test 4: empty set is valid
  it("accepts an empty iterable and returns an empty Set", () => {
    const result = normalizeOwnTeamIds([]);
    expect(result).toBeInstanceOf(Set);
    expect(result.size).toBe(0);
  });

  // Test 5: non-integer ID throws
  it("throws TypeError for a non-integer ID (1.5)", () => {
    expect(() => normalizeOwnTeamIds([1.5])).toThrow(TypeError);
  });

  // Test 6: zero ID throws
  it("throws TypeError for ID === 0", () => {
    expect(() => normalizeOwnTeamIds([0])).toThrow(TypeError);
  });

  // Test 7: negative ID throws
  it("throws TypeError for a negative ID", () => {
    expect(() => normalizeOwnTeamIds([-1])).toThrow(TypeError);
  });
});

// ════════════════════════════════════════════════════════════════════════════════
// 2–3. Schedule pure resolution
// ════════════════════════════════════════════════════════════════════════════════

describe("resolveScheduleOpponent", () => {
  // Test 8: teamA own, teamB opponent
  it("returns resolved with opponentSide=teamB when teamA is own", () => {
    const entry = makeScheduleEntry({
      teamAId: OWN_TEAM_ID_A,
      teamBId: OPPONENT_TEAM_ID,
    });
    const result = resolveScheduleOpponent(entry, OWN_TEAM_IDS);
    expect(result.outcome).toBe("resolved");
    if (result.outcome === "resolved") {
      expect(result.opponentSide).toBe("teamB");
    }
  });

  // Test 9: teamB own, teamA opponent
  it("returns resolved with opponentSide=teamA when teamB is own", () => {
    const entry = makeScheduleEntry({
      teamAId: OPPONENT_TEAM_ID,
      teamBId: OWN_TEAM_ID_A,
      teamNameA: "FC Opponent",
      teamNameB: "FC Allschwil 1",
    });
    const result = resolveScheduleOpponent(entry, OWN_TEAM_IDS);
    expect(result.outcome).toBe("resolved");
    if (result.outcome === "resolved") {
      expect(result.opponentSide).toBe("teamA");
    }
  });

  // Test 10: correct opponent side in resolved result
  it("sets opponentSide to the side that is NOT the own team", () => {
    const entryA = makeScheduleEntry({ teamAId: OWN_TEAM_ID_A, teamBId: OPPONENT_TEAM_ID });
    const entryB = makeScheduleEntry({ teamAId: OPPONENT_TEAM_ID, teamBId: OWN_TEAM_ID_A });
    const resultA = resolveScheduleOpponent(entryA, OWN_TEAM_IDS);
    const resultB = resolveScheduleOpponent(entryB, OWN_TEAM_IDS);
    expect(resultA.outcome === "resolved" && resultA.opponentSide).toBe("teamB");
    expect(resultB.outcome === "resolved" && resultB.opponentSide).toBe("teamA");
  });

  // Test 11: correct own teamId
  it("sets ownTeamId to the correct own-team numeric ID", () => {
    const entry = makeScheduleEntry({ teamAId: OWN_TEAM_ID_A, teamBId: OPPONENT_TEAM_ID });
    const result = resolveScheduleOpponent(entry, OWN_TEAM_IDS);
    expect(result.outcome === "resolved" && result.ownTeamId).toBe(OWN_TEAM_ID_A);
  });

  // Test 12: correct opponent teamId
  it("sets opponentTeamId to the numeric ID of the non-own side", () => {
    const entry = makeScheduleEntry({ teamAId: OWN_TEAM_ID_A, teamBId: OPPONENT_TEAM_ID });
    const result = resolveScheduleOpponent(entry, OWN_TEAM_IDS);
    expect(result.outcome === "resolved" && result.opponentTeamId).toBe(OPPONENT_TEAM_ID);
  });

  // Test 13: correct opponent teamName copied from selected side
  it("copies opponentTeamName from teamNameB when teamA is own", () => {
    const entry = makeScheduleEntry({
      teamAId: OWN_TEAM_ID_A,
      teamNameA: "FC Allschwil 1",
      teamBId: OPPONENT_TEAM_ID,
      teamNameB: "FC Opponent",
    });
    const result = resolveScheduleOpponent(entry, OWN_TEAM_IDS);
    expect(result.outcome === "resolved" && result.opponentTeamName).toBe("FC Opponent");
  });

  it("copies opponentTeamName from teamNameA when teamB is own", () => {
    const entry = makeScheduleEntry({
      teamAId: OPPONENT_TEAM_ID,
      teamNameA: "FC Opponent",
      teamBId: OWN_TEAM_ID_A,
      teamNameB: "FC Allschwil 1",
    });
    const result = resolveScheduleOpponent(entry, OWN_TEAM_IDS);
    expect(result.outcome === "resolved" && result.opponentTeamName).toBe("FC Opponent");
  });

  // Test 14: nullable opponent name is preserved
  it("preserves null opponentTeamName when the source name field is null", () => {
    const entry = makeScheduleEntry({
      teamAId: OWN_TEAM_ID_A,
      teamBId: OPPONENT_TEAM_ID,
      teamNameB: null,
    });
    const result = resolveScheduleOpponent(entry, OWN_TEAM_IDS);
    expect(result.outcome === "resolved" && result.opponentTeamName).toBeNull();
  });

  // Test 15: both teams own → both-own
  it("returns both-own when both teamAId and teamBId are in ownTeamIds", () => {
    const entry = makeScheduleEntry({
      teamAId: OWN_TEAM_ID_A,
      teamBId: OWN_TEAM_ID_B,
    });
    const result = resolveScheduleOpponent(entry, OWN_TEAM_IDS);
    expect(result.outcome).toBe("both-own");
  });

  // Test 16: neither team own → no-own-team
  it("returns no-own-team when neither teamAId nor teamBId is in ownTeamIds", () => {
    const entry = makeScheduleEntry({
      teamAId: OPPONENT_TEAM_ID,
      teamBId: ANOTHER_OPPONENT_ID,
    });
    const result = resolveScheduleOpponent(entry, OWN_TEAM_IDS);
    expect(result.outcome).toBe("no-own-team");
  });

  // Test 17: identical team IDs → invalid
  it("returns invalid when teamAId === teamBId", () => {
    const entry = makeScheduleEntry({
      teamAId: OWN_TEAM_ID_A,
      teamBId: OWN_TEAM_ID_A,
    });
    const result = resolveScheduleOpponent(entry, OWN_TEAM_IDS);
    expect(result.outcome).toBe("invalid");
  });

  // Test 18: invalid teamAId
  it("returns invalid when teamAId is zero", () => {
    const entry = makeScheduleEntry({ teamAId: 0 });
    const result = resolveScheduleOpponent(entry, OWN_TEAM_IDS);
    expect(result.outcome).toBe("invalid");
  });

  it("returns invalid when teamAId is negative", () => {
    const entry = makeScheduleEntry({ teamAId: -1 });
    const result = resolveScheduleOpponent(entry, OWN_TEAM_IDS);
    expect(result.outcome).toBe("invalid");
  });

  it("returns invalid when teamAId is a non-integer float", () => {
    const entry = makeScheduleEntry({ teamAId: 1.5 });
    const result = resolveScheduleOpponent(entry, OWN_TEAM_IDS);
    expect(result.outcome).toBe("invalid");
  });

  // Test 19: invalid teamBId
  it("returns invalid when teamBId is zero", () => {
    const entry = makeScheduleEntry({ teamAId: OWN_TEAM_ID_A, teamBId: 0 });
    const result = resolveScheduleOpponent(entry, OWN_TEAM_IDS);
    expect(result.outcome).toBe("invalid");
  });

  it("returns invalid when teamBId is negative", () => {
    const entry = makeScheduleEntry({ teamAId: OWN_TEAM_ID_A, teamBId: -5 });
    const result = resolveScheduleOpponent(entry, OWN_TEAM_IDS);
    expect(result.outcome).toBe("invalid");
  });

  it("returns invalid when teamBId is a non-integer float", () => {
    const entry = makeScheduleEntry({ teamAId: OWN_TEAM_ID_A, teamBId: 99.9 });
    const result = resolveScheduleOpponent(entry, OWN_TEAM_IDS);
    expect(result.outcome).toBe("invalid");
  });

  // Test 20: no name-based fallback — distinct names on both sides, resolution tracks numeric ID
  it("uses numeric ID for identity — does not use team name to determine own side", () => {
    // teamA name looks like an opponent name; teamB name looks like own club;
    // but only IDs matter — teamBId is in OWN_TEAM_IDS so teamB is own.
    const entry = makeScheduleEntry({
      teamAId: OPPONENT_TEAM_ID,
      teamNameA: "FC Allschwil 3 (looks like own)",
      teamBId: OWN_TEAM_ID_A,
      teamNameB: "FC Random Opponent (looks like opponent)",
    });
    const result = resolveScheduleOpponent(entry, OWN_TEAM_IDS);
    expect(result.outcome).toBe("resolved");
    if (result.outcome === "resolved") {
      // opponent is teamA (numeric ID not in own set), despite name hinting otherwise
      expect(result.opponentSide).toBe("teamA");
      expect(result.opponentTeamId).toBe(OPPONENT_TEAM_ID);
      expect(result.opponentTeamName).toBe("FC Allschwil 3 (looks like own)");
      expect(result.ownTeamId).toBe(OWN_TEAM_ID_A);
    }
  });
});

// ════════════════════════════════════════════════════════════════════════════════
// 4–6. Ranking pure resolution
// ════════════════════════════════════════════════════════════════════════════════

describe("resolveRankingOpponent", () => {
  // Test 21: opponent ranking row
  it("returns opponent result for a non-own teamId", () => {
    const entry = makeRankingEntry({ teamId: OPPONENT_TEAM_ID });
    const result = resolveRankingOpponent(entry, OWN_TEAM_IDS);
    expect(result.outcome).toBe("opponent");
  });

  // Test 22: own-team ranking row
  it("returns own-team result for a teamId in ownTeamIds", () => {
    const entry = makeRankingEntry({ teamId: OWN_TEAM_ID_A });
    const result = resolveRankingOpponent(entry, OWN_TEAM_IDS);
    expect(result.outcome).toBe("own-team");
  });

  // Test 23: correct teamId in opponent result
  it("sets opponentTeamId to the numeric teamId from the entry", () => {
    const entry = makeRankingEntry({ teamId: OPPONENT_TEAM_ID });
    const result = resolveRankingOpponent(entry, OWN_TEAM_IDS);
    expect(result.outcome === "opponent" && result.opponentTeamId).toBe(OPPONENT_TEAM_ID);
  });

  // Test 24: correct teamName in opponent result
  it("copies opponentTeamName from entry.teamName for opponent rows", () => {
    const entry = makeRankingEntry({ teamId: OPPONENT_TEAM_ID, teamName: "FC Opponent" });
    const result = resolveRankingOpponent(entry, OWN_TEAM_IDS);
    expect(result.outcome === "opponent" && result.opponentTeamName).toBe("FC Opponent");
  });

  // Test 25: nullable ranking team name is preserved
  it("preserves null opponentTeamName when entry.teamName is null", () => {
    const entry = makeRankingEntry({ teamId: OPPONENT_TEAM_ID, teamName: null });
    const result = resolveRankingOpponent(entry, OWN_TEAM_IDS);
    expect(result.outcome === "opponent" && result.opponentTeamName).toBeNull();
  });

  // Test 26: invalid ranking teamId
  it("returns invalid when teamId is zero", () => {
    const entry = makeRankingEntry({ teamId: 0 });
    const result = resolveRankingOpponent(entry, OWN_TEAM_IDS);
    expect(result.outcome).toBe("invalid");
  });

  it("returns invalid when teamId is negative", () => {
    const entry = makeRankingEntry({ teamId: -1 });
    const result = resolveRankingOpponent(entry, OWN_TEAM_IDS);
    expect(result.outcome).toBe("invalid");
  });

  it("returns invalid when teamId is a non-integer float", () => {
    const entry = makeRankingEntry({ teamId: 7.7 });
    const result = resolveRankingOpponent(entry, OWN_TEAM_IDS);
    expect(result.outcome).toBe("invalid");
  });

  // Test 27: no name-based fallback — own-team detection uses numeric ID only
  it("uses numeric ID for own-team detection — does not use teamName", () => {
    // teamName looks like an FC Allschwil own name but teamId is not in ownTeamIds
    const entry = makeRankingEntry({
      teamId: OPPONENT_TEAM_ID,
      teamName: "FC Allschwil 1 (looks like own)",
    });
    const result = resolveRankingOpponent(entry, OWN_TEAM_IDS);
    // Despite name hint, numeric ID determines this is an opponent
    expect(result.outcome).toBe("opponent");
    if (result.outcome === "opponent") {
      expect(result.opponentTeamId).toBe(OPPONENT_TEAM_ID);
    }
  });
});

// ════════════════════════════════════════════════════════════════════════════════
// 7. Picture enrichment — resolveScheduleOpponentIdentity
// ════════════════════════════════════════════════════════════════════════════════

describe("resolveScheduleOpponentIdentity", () => {
  // Test 28: fetchTeamPicture called once for resolved schedule opponent
  it("calls fetchTeamPicture exactly once for a resolved schedule entry", async () => {
    mockFetchTeamPicture.mockResolvedValueOnce(SYNTHETIC_PICTURE);
    const entry = makeScheduleEntry();
    await resolveScheduleOpponentIdentity(entry, OWN_TEAM_IDS);
    expect(mockFetchTeamPicture).toHaveBeenCalledTimes(1);
  });

  // Test 29: fetchTeamPicture called with exact opponent teamId
  it("calls fetchTeamPicture with the opponent numeric teamId", async () => {
    mockFetchTeamPicture.mockResolvedValueOnce(SYNTHETIC_PICTURE);
    const entry = makeScheduleEntry({ teamAId: OWN_TEAM_ID_A, teamBId: OPPONENT_TEAM_ID });
    await resolveScheduleOpponentIdentity(entry, OWN_TEAM_IDS);
    expect(mockFetchTeamPicture).toHaveBeenCalledWith(OPPONENT_TEAM_ID);
  });

  // Test 30: returned TeamPictureResponse is preserved exactly
  it("returns the TeamPictureResponse from fetchTeamPicture unchanged", async () => {
    mockFetchTeamPicture.mockResolvedValueOnce(SYNTHETIC_PICTURE);
    const entry = makeScheduleEntry();
    const identity = await resolveScheduleOpponentIdentity(entry, OWN_TEAM_IDS);
    expect(identity.picture).toBe(SYNTHETIC_PICTURE);
  });

  // Test 31: null picture preserved
  it("sets picture: null when fetchTeamPicture returns null (204 no content)", async () => {
    mockFetchTeamPicture.mockResolvedValueOnce(null);
    const entry = makeScheduleEntry();
    const identity = await resolveScheduleOpponentIdentity(entry, OWN_TEAM_IDS);
    expect(identity.picture).toBeNull();
  });

  // Test 32: picture 404 propagates SFV_NOT_FOUND
  it("propagates SFV_NOT_FOUND when fetchTeamPicture throws for 404", async () => {
    const pictureNotFound = new SfvNetworkError(
      "SFV_NOT_FOUND",
      "SFV team picture: resource not found (404).",
    );
    mockFetchTeamPicture.mockRejectedValueOnce(pictureNotFound);
    const entry = makeScheduleEntry();
    await expect(resolveScheduleOpponentIdentity(entry, OWN_TEAM_IDS)).rejects.toBe(
      pictureNotFound,
    );
  });

  // Test 33: auth error propagation
  it("propagates SfvAuthError from fetchTeamPicture unchanged", async () => {
    const authError = new SfvAuthError("SFV_UNAUTHORIZED", "401 Unauthorized.");
    mockFetchTeamPicture.mockRejectedValueOnce(authError);
    const entry = makeScheduleEntry();
    await expect(resolveScheduleOpponentIdentity(entry, OWN_TEAM_IDS)).rejects.toBe(authError);
  });

  // Test 34: timeout propagation
  it("propagates SFV_TIMEOUT from fetchTeamPicture unchanged", async () => {
    const timeoutError = new SfvNetworkError("SFV_TIMEOUT", "Request timed out.");
    mockFetchTeamPicture.mockRejectedValueOnce(timeoutError);
    const entry = makeScheduleEntry();
    await expect(resolveScheduleOpponentIdentity(entry, OWN_TEAM_IDS)).rejects.toBe(timeoutError);
  });

  // Test 35: server error propagation
  it("propagates SFV_UNAVAILABLE from fetchTeamPicture unchanged", async () => {
    const serverError = new SfvNetworkError("SFV_UNAVAILABLE", "Server error.");
    mockFetchTeamPicture.mockRejectedValueOnce(serverError);
    const entry = makeScheduleEntry();
    await expect(resolveScheduleOpponentIdentity(entry, OWN_TEAM_IDS)).rejects.toBe(serverError);
  });

  // Test 36: no picture fetch for ambiguous schedule row (both-own)
  it("throws SfvOpponentResolutionError without calling fetchTeamPicture for both-own", async () => {
    const entry = makeScheduleEntry({ teamAId: OWN_TEAM_ID_A, teamBId: OWN_TEAM_ID_B });
    await expect(resolveScheduleOpponentIdentity(entry, OWN_TEAM_IDS)).rejects.toBeInstanceOf(
      SfvOpponentResolutionError,
    );
    expect(mockFetchTeamPicture).not.toHaveBeenCalled();
  });

  it("throws SfvOpponentResolutionError without calling fetchTeamPicture for no-own-team", async () => {
    const entry = makeScheduleEntry({
      teamAId: OPPONENT_TEAM_ID,
      teamBId: ANOTHER_OPPONENT_ID,
    });
    await expect(resolveScheduleOpponentIdentity(entry, OWN_TEAM_IDS)).rejects.toBeInstanceOf(
      SfvOpponentResolutionError,
    );
    expect(mockFetchTeamPicture).not.toHaveBeenCalled();
  });

  it("throws SfvOpponentResolutionError without calling fetchTeamPicture for invalid IDs", async () => {
    const entry = makeScheduleEntry({ teamAId: 0 });
    await expect(resolveScheduleOpponentIdentity(entry, OWN_TEAM_IDS)).rejects.toBeInstanceOf(
      SfvOpponentResolutionError,
    );
    expect(mockFetchTeamPicture).not.toHaveBeenCalled();
  });

  // Test 37 (tested above for ranking — covered below in ranking section)

  // Test 38: exactly one picture call for one resolved entry
  it("calls fetchTeamPicture exactly once — no extra calls", async () => {
    mockFetchTeamPicture.mockResolvedValueOnce(SYNTHETIC_PICTURE);
    const entry = makeScheduleEntry();
    await resolveScheduleOpponentIdentity(entry, OWN_TEAM_IDS);
    expect(mockFetchTeamPicture).toHaveBeenCalledTimes(1);
  });

  // source and side fields
  it("sets source to 'schedule'", async () => {
    mockFetchTeamPicture.mockResolvedValueOnce(SYNTHETIC_PICTURE);
    const entry = makeScheduleEntry({ teamAId: OWN_TEAM_ID_A, teamBId: OPPONENT_TEAM_ID });
    const identity = await resolveScheduleOpponentIdentity(entry, OWN_TEAM_IDS);
    expect(identity.source).toBe("schedule");
  });

  it("sets side to the opponent's schedule side", async () => {
    mockFetchTeamPicture.mockResolvedValueOnce(SYNTHETIC_PICTURE);
    const entry = makeScheduleEntry({ teamAId: OWN_TEAM_ID_A, teamBId: OPPONENT_TEAM_ID });
    const identity = await resolveScheduleOpponentIdentity(entry, OWN_TEAM_IDS);
    expect(identity.side).toBe("teamB");
  });

  it("sets correct ownTeamId", async () => {
    mockFetchTeamPicture.mockResolvedValueOnce(SYNTHETIC_PICTURE);
    const entry = makeScheduleEntry({ teamAId: OWN_TEAM_ID_A, teamBId: OPPONENT_TEAM_ID });
    const identity = await resolveScheduleOpponentIdentity(entry, OWN_TEAM_IDS);
    expect(identity.ownTeamId).toBe(OWN_TEAM_ID_A);
  });

  it("sets correct teamId (opponent)", async () => {
    mockFetchTeamPicture.mockResolvedValueOnce(SYNTHETIC_PICTURE);
    const entry = makeScheduleEntry({ teamAId: OWN_TEAM_ID_A, teamBId: OPPONENT_TEAM_ID });
    const identity = await resolveScheduleOpponentIdentity(entry, OWN_TEAM_IDS);
    expect(identity.teamId).toBe(OPPONENT_TEAM_ID);
  });

  // SfvOpponentResolutionError carries the resolution
  it("SfvOpponentResolutionError carries the resolution outcome for both-own", async () => {
    const entry = makeScheduleEntry({ teamAId: OWN_TEAM_ID_A, teamBId: OWN_TEAM_ID_B });
    const error = await resolveScheduleOpponentIdentity(entry, OWN_TEAM_IDS).catch((e) => e);
    expect(error).toBeInstanceOf(SfvOpponentResolutionError);
    expect((error as SfvOpponentResolutionError).resolution.outcome).toBe("both-own");
  });

  it("SfvOpponentResolutionError carries the resolution outcome for no-own-team", async () => {
    const entry = makeScheduleEntry({
      teamAId: OPPONENT_TEAM_ID,
      teamBId: ANOTHER_OPPONENT_ID,
    });
    const error = await resolveScheduleOpponentIdentity(entry, OWN_TEAM_IDS).catch((e) => e);
    expect(error).toBeInstanceOf(SfvOpponentResolutionError);
    expect((error as SfvOpponentResolutionError).resolution.outcome).toBe("no-own-team");
  });
});

// ════════════════════════════════════════════════════════════════════════════════
// 8. Picture enrichment — resolveRankingOpponentIdentity
// ════════════════════════════════════════════════════════════════════════════════

describe("resolveRankingOpponentIdentity", () => {
  // Test 37: no picture fetch for own ranking row
  it("returns null for an own-team ranking row without calling fetchTeamPicture", async () => {
    const entry = makeRankingEntry({ teamId: OWN_TEAM_ID_A });
    const result = await resolveRankingOpponentIdentity(entry, OWN_TEAM_IDS);
    expect(result).toBeNull();
    expect(mockFetchTeamPicture).not.toHaveBeenCalled();
  });

  it("calls fetchTeamPicture once for an opponent ranking row", async () => {
    mockFetchTeamPicture.mockResolvedValueOnce(SYNTHETIC_PICTURE);
    const entry = makeRankingEntry({ teamId: OPPONENT_TEAM_ID });
    await resolveRankingOpponentIdentity(entry, OWN_TEAM_IDS);
    expect(mockFetchTeamPicture).toHaveBeenCalledTimes(1);
    expect(mockFetchTeamPicture).toHaveBeenCalledWith(OPPONENT_TEAM_ID);
  });

  it("throws SfvOpponentResolutionError for an invalid ranking entry without calling fetchTeamPicture", async () => {
    const entry = makeRankingEntry({ teamId: 0 });
    await expect(resolveRankingOpponentIdentity(entry, OWN_TEAM_IDS)).rejects.toBeInstanceOf(
      SfvOpponentResolutionError,
    );
    expect(mockFetchTeamPicture).not.toHaveBeenCalled();
  });

  it("sets source to 'ranking' for opponent rows", async () => {
    mockFetchTeamPicture.mockResolvedValueOnce(SYNTHETIC_PICTURE);
    const entry = makeRankingEntry({ teamId: OPPONENT_TEAM_ID });
    const identity = await resolveRankingOpponentIdentity(entry, OWN_TEAM_IDS);
    expect(identity?.source).toBe("ranking");
  });

  it("sets side to null for ranking rows", async () => {
    mockFetchTeamPicture.mockResolvedValueOnce(SYNTHETIC_PICTURE);
    const entry = makeRankingEntry({ teamId: OPPONENT_TEAM_ID });
    const identity = await resolveRankingOpponentIdentity(entry, OWN_TEAM_IDS);
    expect(identity?.side).toBeNull();
  });

  it("sets correct teamId for opponent rows", async () => {
    mockFetchTeamPicture.mockResolvedValueOnce(SYNTHETIC_PICTURE);
    const entry = makeRankingEntry({ teamId: OPPONENT_TEAM_ID });
    const identity = await resolveRankingOpponentIdentity(entry, OWN_TEAM_IDS);
    expect(identity?.teamId).toBe(OPPONENT_TEAM_ID);
  });

  it("preserves null picture when fetchTeamPicture returns null", async () => {
    mockFetchTeamPicture.mockResolvedValueOnce(null);
    const entry = makeRankingEntry({ teamId: OPPONENT_TEAM_ID });
    const identity = await resolveRankingOpponentIdentity(entry, OWN_TEAM_IDS);
    expect(identity?.picture).toBeNull();
  });

  it("propagates SfvAuthError from fetchTeamPicture", async () => {
    const authError = new SfvAuthError("SFV_UNAUTHORIZED", "401.");
    mockFetchTeamPicture.mockRejectedValueOnce(authError);
    const entry = makeRankingEntry({ teamId: OPPONENT_TEAM_ID });
    await expect(resolveRankingOpponentIdentity(entry, OWN_TEAM_IDS)).rejects.toBe(authError);
  });

  it("propagates SFV_NOT_FOUND from fetchTeamPicture", async () => {
    const notFound = new SfvNetworkError("SFV_NOT_FOUND", "404.");
    mockFetchTeamPicture.mockRejectedValueOnce(notFound);
    const entry = makeRankingEntry({ teamId: OPPONENT_TEAM_ID });
    await expect(resolveRankingOpponentIdentity(entry, OWN_TEAM_IDS)).rejects.toBe(notFound);
  });

  it("propagates SFV_TIMEOUT from fetchTeamPicture", async () => {
    const timeoutError = new SfvNetworkError("SFV_TIMEOUT", "Timed out.");
    mockFetchTeamPicture.mockRejectedValueOnce(timeoutError);
    const entry = makeRankingEntry({ teamId: OPPONENT_TEAM_ID });
    await expect(resolveRankingOpponentIdentity(entry, OWN_TEAM_IDS)).rejects.toBe(timeoutError);
  });

  it("propagates SFV_UNAVAILABLE from fetchTeamPicture", async () => {
    const serverError = new SfvNetworkError("SFV_UNAVAILABLE", "Server error.");
    mockFetchTeamPicture.mockRejectedValueOnce(serverError);
    const entry = makeRankingEntry({ teamId: OPPONENT_TEAM_ID });
    await expect(resolveRankingOpponentIdentity(entry, OWN_TEAM_IDS)).rejects.toBe(serverError);
  });
});

// ════════════════════════════════════════════════════════════════════════════════
// 9. Input immutability
// ════════════════════════════════════════════════════════════════════════════════

describe("Input immutability", () => {
  // Test 39: schedule entry not mutated
  it("does not mutate the schedule entry", () => {
    const entry = makeScheduleEntry();
    const snapshot = { ...entry };
    resolveScheduleOpponent(entry, OWN_TEAM_IDS);
    expect(entry).toEqual(snapshot);
  });

  // Test 40: ranking entry not mutated
  it("does not mutate the ranking entry", () => {
    const entry = makeRankingEntry();
    const snapshot = { ...entry };
    resolveRankingOpponent(entry, OWN_TEAM_IDS);
    expect(entry).toEqual(snapshot);
  });

  // Test 41: own-team ID input set is not mutated
  it("does not mutate the own-team ID set", () => {
    const ownIds = new Set([OWN_TEAM_ID_A, OWN_TEAM_ID_B]);
    const snapshotSize = ownIds.size;
    resolveScheduleOpponent(makeScheduleEntry(), ownIds);
    resolveRankingOpponent(makeRankingEntry(), ownIds);
    expect(ownIds.size).toBe(snapshotSize);
    expect(ownIds.has(OWN_TEAM_ID_A)).toBe(true);
    expect(ownIds.has(OWN_TEAM_ID_B)).toBe(true);
  });
});

// ════════════════════════════════════════════════════════════════════════════════
// 10. Type and result stability
// ════════════════════════════════════════════════════════════════════════════════

describe("Type and result stability", () => {
  // Test 42: discriminated result is explicit and stable
  it("resolveScheduleOpponent returns a stable discriminated result type", () => {
    const resolved = resolveScheduleOpponent(makeScheduleEntry(), OWN_TEAM_IDS);
    expect(typeof resolved.outcome).toBe("string");
    // TypeScript narrows the outcome — verify runtime value is one of the expected literals
    expect(["resolved", "both-own", "no-own-team", "invalid"]).toContain(resolved.outcome);
  });

  it("resolveRankingOpponent returns a stable discriminated result type", () => {
    const result = resolveRankingOpponent(makeRankingEntry(), OWN_TEAM_IDS);
    expect(["opponent", "own-team", "invalid"]).toContain(result.outcome);
  });

  // Test 43: source field is correct
  it("resolveScheduleOpponentIdentity sets source: 'schedule'", async () => {
    mockFetchTeamPicture.mockResolvedValueOnce(SYNTHETIC_PICTURE);
    const identity = await resolveScheduleOpponentIdentity(makeScheduleEntry(), OWN_TEAM_IDS);
    expect(identity.source).toBe("schedule");
  });

  it("resolveRankingOpponentIdentity sets source: 'ranking'", async () => {
    mockFetchTeamPicture.mockResolvedValueOnce(SYNTHETIC_PICTURE);
    const identity = await resolveRankingOpponentIdentity(
      makeRankingEntry({ teamId: OPPONENT_TEAM_ID }),
      OWN_TEAM_IDS,
    );
    expect(identity?.source).toBe("ranking");
  });

  // Test 44: side is null for ranking rows
  it("ranking identity always has side: null", async () => {
    mockFetchTeamPicture.mockResolvedValueOnce(SYNTHETIC_PICTURE);
    const identity = await resolveRankingOpponentIdentity(
      makeRankingEntry({ teamId: OPPONENT_TEAM_ID }),
      OWN_TEAM_IDS,
    );
    expect(identity?.side).toBeNull();
  });

  // SfvOpponentResolutionError is a proper Error subclass
  it("SfvOpponentResolutionError is an instance of Error", async () => {
    const entry = makeScheduleEntry({ teamAId: OWN_TEAM_ID_A, teamBId: OWN_TEAM_ID_B });
    const error = await resolveScheduleOpponentIdentity(entry, OWN_TEAM_IDS).catch((e) => e);
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(SfvOpponentResolutionError);
    expect((error as SfvOpponentResolutionError).name).toBe("SfvOpponentResolutionError");
  });

  it("SfvOpponentResolutionError has a non-empty message", async () => {
    const entry = makeScheduleEntry({ teamAId: OWN_TEAM_ID_A, teamBId: OWN_TEAM_ID_B });
    const error = await resolveScheduleOpponentIdentity(entry, OWN_TEAM_IDS).catch((e) => e);
    expect(typeof (error as Error).message).toBe("string");
    expect((error as Error).message.length).toBeGreaterThan(0);
  });
});
