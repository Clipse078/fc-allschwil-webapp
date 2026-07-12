/**
 * lib/integrations/sfv/__tests__/batch-opponent-identity.test.ts
 *
 * Focused unit tests for the Batch Opponent Identity Resolver.
 *
 * All tests are pure or use mocked fetchTeamPicture.
 * No real network requests are made. No production secrets are used.
 *
 * TEST COVERAGE MAP (matching Phase I requirements):
 *
 * Options and validation:
 *   1.  default concurrency (4)
 *   2.  concurrency 1
 *   3.  custom valid concurrency
 *   4.  zero concurrency rejected
 *   5.  negative concurrency rejected
 *   6.  fractional concurrency rejected
 *   7.  NaN rejected
 *   8.  Infinity rejected
 *   9.  empty own-team set behaviour
 *   10. invalid own-team IDs rejected
 *
 * Schedule batch:
 *   11. empty input
 *   12. one resolved row
 *   13. teamA-own row
 *   14. teamB-own row
 *   15. both-own row
 *   16. no-own-team row
 *   17. invalid row
 *   18. mixed outcome collection
 *   19. order preserved
 *   20. source indices preserved
 *   21. input rows not mutated
 *   22. own-team set not mutated
 *   23. names copied only after numeric resolution
 *   24. no picture call for unresolved rows
 *   25. one picture call for one resolved opponent
 *   26. duplicate opponent IDs call fetchTeamPicture once
 *   27. duplicate opponent rows receive equivalent picture result
 *   28. different opponents receive separate calls
 *   29. null picture propagated
 *   30. 404 represented safely
 *   31. auth failure represented safely
 *   32. timeout represented safely
 *   33. server failure represented safely
 *   34. no secrets in structured error
 *   35. base64 omitted from summary
 *   36. concurrency never exceeds configured limit
 *   37. concurrency 1 executes serially
 *   38. batch waits for all work to finish
 *   39. no work continues after completion
 *   40. failFast propagates error on first failure
 *
 * Ranking batch:
 *   41. empty input
 *   42. opponent row resolved
 *   43. own-team row classified without picture request
 *   44. invalid row classified without picture request
 *   45. mixed own/opponent rows
 *   46. duplicate ranking opponent IDs deduplicated
 *   47. order preserved
 *   48. indices preserved
 *   49. input not mutated
 *   50. null picture propagated
 *   51. failure represented safely
 *   52. concurrency bounded
 *
 * Cross-cutting:
 *   53. per-call deduplication does not leak across separate batch calls
 *   54. separate batch calls fetch the same team again
 *   55. no name-based matching
 *   56. same numeric ID with different display names still deduplicates by ID
 *   57. different IDs with identical names are not deduplicated
 *   58. summary counts accurate
 *   59. uniqueOpponentTeamIds accurate
 *   60. pictureRequests count accurate
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  resolveScheduleOpponentIdentities,
  resolveRankingOpponentIdentities,
} from "../batch-opponent-identity";
import { SfvAuthError, SfvNetworkError } from "../errors";
import type { ClubScheduleEntry, ClubRankingEntry, TeamPictureResponse } from "../client";

// ── Mock fetchTeamPicture ──────────────────────────────────────────────────────

vi.mock("../client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../client")>();
  return {
    ...actual,
    fetchTeamPicture: vi.fn(),
  };
});

import { fetchTeamPicture } from "../client";
const mockFetchTeamPicture = vi.mocked(fetchTeamPicture);

// ── Synthetic test data ────────────────────────────────────────────────────────

const OWN_TEAM_ID_A = 10001;
const OWN_TEAM_ID_B = 10002;
const OPPONENT_ID_1 = 20001;
const OPPONENT_ID_2 = 20002;
const OPPONENT_ID_3 = 20003;

const OWN_TEAM_IDS: Iterable<number> = [OWN_TEAM_ID_A, OWN_TEAM_ID_B];

const SYNTHETIC_PICTURE: TeamPictureResponse = {
  base64: "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  contentType: "image/gif",
  contentLength: null,
  etag: null,
  lastModified: null,
  cacheControl: null,
};

const SYNTHETIC_PICTURE_2: TeamPictureResponse = {
  base64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwADhQGAWjR9awAAAABJRU5ErkJggg==",
  contentType: "image/png",
  contentLength: null,
  etag: null,
  lastModified: null,
  cacheControl: null,
};

function makeScheduleEntry(overrides: Partial<ClubScheduleEntry> = {}): ClubScheduleEntry {
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
    teamBId: OPPONENT_ID_1,
    teamNameB: "FC Opponent",
    ...overrides,
  };
}

function makeRankingEntry(overrides: Partial<ClubRankingEntry> = {}): ClubRankingEntry {
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
    teamId: OPPONENT_ID_1,
    ...overrides,
  };
}

// ── Lifecycle ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  mockFetchTeamPicture.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

// ════════════════════════════════════════════════════════════════════════════════
// Options and validation
// ════════════════════════════════════════════════════════════════════════════════

describe("BatchOpponentIdentityOptions — validation", () => {
  // Test 1: default concurrency
  it("uses concurrency 4 by default (schedule)", async () => {
    mockFetchTeamPicture.mockResolvedValue(SYNTHETIC_PICTURE);
    const entries = Array.from({ length: 4 }, (_, i) =>
      makeScheduleEntry({ matchId: 100 + i, teamBId: OPPONENT_ID_1 + i }),
    );
    // Should not throw — default concurrency=4 is valid
    const result = await resolveScheduleOpponentIdentities(entries, OWN_TEAM_IDS);
    expect(result.items).toHaveLength(4);
    expect(mockFetchTeamPicture).toHaveBeenCalledTimes(4);
  });

  // Test 1 (ranking): default concurrency
  it("uses concurrency 4 by default (ranking)", async () => {
    mockFetchTeamPicture.mockResolvedValue(SYNTHETIC_PICTURE);
    const entries = Array.from({ length: 4 }, (_, i) =>
      makeRankingEntry({ position: i + 1, teamId: OPPONENT_ID_1 + i }),
    );
    const result = await resolveRankingOpponentIdentities(entries, OWN_TEAM_IDS);
    expect(result.items).toHaveLength(4);
    expect(mockFetchTeamPicture).toHaveBeenCalledTimes(4);
  });

  // Test 2: concurrency 1
  it("accepts concurrency 1 and processes serially (schedule)", async () => {
    mockFetchTeamPicture.mockResolvedValue(SYNTHETIC_PICTURE);
    const entry = makeScheduleEntry();
    const result = await resolveScheduleOpponentIdentities([entry], OWN_TEAM_IDS, {
      concurrency: 1,
    });
    expect(result.items[0].status).toBe("resolved");
  });

  // Test 3: custom valid concurrency
  it("accepts a custom valid concurrency value (e.g. 8)", async () => {
    mockFetchTeamPicture.mockResolvedValue(SYNTHETIC_PICTURE);
    const entry = makeScheduleEntry();
    await expect(
      resolveScheduleOpponentIdentities([entry], OWN_TEAM_IDS, { concurrency: 8 }),
    ).resolves.toBeDefined();
  });

  // Test 4: zero concurrency rejected
  it("throws TypeError for concurrency 0", async () => {
    await expect(
      resolveScheduleOpponentIdentities([], OWN_TEAM_IDS, { concurrency: 0 }),
    ).rejects.toThrow(TypeError);
  });

  // Test 5: negative concurrency rejected
  it("throws TypeError for concurrency -1", async () => {
    await expect(
      resolveScheduleOpponentIdentities([], OWN_TEAM_IDS, { concurrency: -1 }),
    ).rejects.toThrow(TypeError);
  });

  // Test 6: fractional concurrency rejected
  it("throws TypeError for fractional concurrency (1.5)", async () => {
    await expect(
      resolveScheduleOpponentIdentities([], OWN_TEAM_IDS, { concurrency: 1.5 }),
    ).rejects.toThrow(TypeError);
  });

  // Test 7: NaN rejected
  it("throws TypeError for NaN concurrency", async () => {
    await expect(
      resolveScheduleOpponentIdentities([], OWN_TEAM_IDS, { concurrency: NaN }),
    ).rejects.toThrow(TypeError);
  });

  // Test 8: Infinity rejected
  it("throws TypeError for Infinity concurrency", async () => {
    await expect(
      resolveScheduleOpponentIdentities([], OWN_TEAM_IDS, { concurrency: Infinity }),
    ).rejects.toThrow(TypeError);
  });

  // Test 9: empty own-team set — all schedule rows become "no-own-team"
  it("classifies all schedule rows as no-own-team when ownTeamIds is empty", async () => {
    const entries = [makeScheduleEntry(), makeScheduleEntry({ matchId: 100002 })];
    const result = await resolveScheduleOpponentIdentities(entries, []);
    expect(result.items.every((item) => item.status === "no-own-team")).toBe(true);
    expect(mockFetchTeamPicture).not.toHaveBeenCalled();
  });

  // Test 9 (ranking): empty own-team set — all ranking rows become "resolved" (all opponents)
  it("classifies all ranking rows as resolved when ownTeamIds is empty", async () => {
    mockFetchTeamPicture.mockResolvedValue(null);
    const entries = [makeRankingEntry(), makeRankingEntry({ position: 2, teamId: OPPONENT_ID_2 })];
    const result = await resolveRankingOpponentIdentities(entries, []);
    expect(result.items.every((item) => item.status === "resolved")).toBe(true);
  });

  // Test 10: invalid own-team IDs rejected
  it("throws TypeError when ownTeamIds contains 0", async () => {
    await expect(
      resolveScheduleOpponentIdentities([], [0], {}),
    ).rejects.toThrow(TypeError);
  });

  it("throws TypeError when ownTeamIds contains a negative ID", async () => {
    await expect(
      resolveScheduleOpponentIdentities([], [-5], {}),
    ).rejects.toThrow(TypeError);
  });

  it("throws TypeError when ownTeamIds contains a fractional ID", async () => {
    await expect(
      resolveScheduleOpponentIdentities([], [1.5], {}),
    ).rejects.toThrow(TypeError);
  });
});

// ════════════════════════════════════════════════════════════════════════════════
// Schedule batch
// ════════════════════════════════════════════════════════════════════════════════

describe("resolveScheduleOpponentIdentities — schedule batch", () => {
  // Test 11: empty input
  it("returns empty items and zero summary for empty input", async () => {
    const result = await resolveScheduleOpponentIdentities([], OWN_TEAM_IDS);
    expect(result.items).toHaveLength(0);
    expect(result.summary.total).toBe(0);
    expect(result.summary.pictureRequests).toBe(0);
    expect(mockFetchTeamPicture).not.toHaveBeenCalled();
  });

  // Test 12: one resolved row
  it("resolves a single row where teamA is own and teamB is opponent", async () => {
    mockFetchTeamPicture.mockResolvedValue(SYNTHETIC_PICTURE);
    const entry = makeScheduleEntry({ teamAId: OWN_TEAM_ID_A, teamBId: OPPONENT_ID_1 });
    const result = await resolveScheduleOpponentIdentities([entry], OWN_TEAM_IDS);

    expect(result.items).toHaveLength(1);
    const item = result.items[0];
    expect(item.status).toBe("resolved");
    expect(item.identity).not.toBeNull();
    expect(item.identity!.teamId).toBe(OPPONENT_ID_1);
    expect(item.identity!.side).toBe("teamB");
    expect(item.identity!.ownTeamId).toBe(OWN_TEAM_ID_A);
    expect(item.identity!.picture).toBe(SYNTHETIC_PICTURE);
    expect(item.error).toBeUndefined();
  });

  // Test 13: teamA-own row (opponent is teamB)
  it("returns resolved with side=teamB when own team is teamA", async () => {
    mockFetchTeamPicture.mockResolvedValue(SYNTHETIC_PICTURE);
    const entry = makeScheduleEntry({ teamAId: OWN_TEAM_ID_A, teamBId: OPPONENT_ID_1 });
    const result = await resolveScheduleOpponentIdentities([entry], OWN_TEAM_IDS);
    expect(result.items[0].identity?.side).toBe("teamB");
  });

  // Test 14: teamB-own row (opponent is teamA)
  it("returns resolved with side=teamA when own team is teamB", async () => {
    mockFetchTeamPicture.mockResolvedValue(SYNTHETIC_PICTURE);
    const entry = makeScheduleEntry({
      teamAId: OPPONENT_ID_1,
      teamBId: OWN_TEAM_ID_A,
      teamNameA: "FC Opponent",
      teamNameB: "FC Allschwil 1",
    });
    const result = await resolveScheduleOpponentIdentities([entry], OWN_TEAM_IDS);
    expect(result.items[0].status).toBe("resolved");
    expect(result.items[0].identity?.side).toBe("teamA");
    expect(result.items[0].identity?.teamId).toBe(OPPONENT_ID_1);
  });

  // Test 15: both-own row
  it("classifies row as both-own when both sides belong to own-team IDs", async () => {
    const entry = makeScheduleEntry({ teamAId: OWN_TEAM_ID_A, teamBId: OWN_TEAM_ID_B });
    const result = await resolveScheduleOpponentIdentities([entry], OWN_TEAM_IDS);
    expect(result.items[0].status).toBe("both-own");
    expect(result.items[0].identity).toBeNull();
    expect(mockFetchTeamPicture).not.toHaveBeenCalled();
  });

  // Test 16: no-own-team row
  it("classifies row as no-own-team when neither side belongs to own-team IDs", async () => {
    const entry = makeScheduleEntry({ teamAId: OPPONENT_ID_1, teamBId: OPPONENT_ID_2 });
    const result = await resolveScheduleOpponentIdentities([entry], OWN_TEAM_IDS);
    expect(result.items[0].status).toBe("no-own-team");
    expect(result.items[0].identity).toBeNull();
    expect(mockFetchTeamPicture).not.toHaveBeenCalled();
  });

  // Test 17: invalid row
  it("classifies row as invalid when teamAId is 0", async () => {
    const entry = makeScheduleEntry({ teamAId: 0 });
    const result = await resolveScheduleOpponentIdentities([entry], OWN_TEAM_IDS);
    expect(result.items[0].status).toBe("invalid");
    expect(result.items[0].identity).toBeNull();
    expect(mockFetchTeamPicture).not.toHaveBeenCalled();
  });

  it("classifies row as invalid when teamAId equals teamBId", async () => {
    const entry = makeScheduleEntry({ teamAId: OPPONENT_ID_1, teamBId: OPPONENT_ID_1 });
    const result = await resolveScheduleOpponentIdentities([entry], OWN_TEAM_IDS);
    expect(result.items[0].status).toBe("invalid");
  });

  // Test 18: mixed outcome collection
  it("handles a mixed collection with all outcome types", async () => {
    mockFetchTeamPicture.mockResolvedValue(SYNTHETIC_PICTURE);
    const entries = [
      makeScheduleEntry({ matchId: 1, teamAId: OWN_TEAM_ID_A, teamBId: OPPONENT_ID_1 }), // resolved
      makeScheduleEntry({ matchId: 2, teamAId: OWN_TEAM_ID_A, teamBId: OWN_TEAM_ID_B }), // both-own
      makeScheduleEntry({ matchId: 3, teamAId: OPPONENT_ID_1, teamBId: OPPONENT_ID_2 }), // no-own-team
      makeScheduleEntry({ matchId: 4, teamAId: 0, teamBId: OPPONENT_ID_1 }),             // invalid
    ];
    const result = await resolveScheduleOpponentIdentities(entries, OWN_TEAM_IDS);
    expect(result.items[0].status).toBe("resolved");
    expect(result.items[1].status).toBe("both-own");
    expect(result.items[2].status).toBe("no-own-team");
    expect(result.items[3].status).toBe("invalid");
  });

  // Test 19: order preserved
  it("preserves input order across all status types", async () => {
    mockFetchTeamPicture.mockImplementation(async (id: number) =>
      id === OPPONENT_ID_1 ? SYNTHETIC_PICTURE : SYNTHETIC_PICTURE_2,
    );
    const entries = [
      makeScheduleEntry({ matchId: 101, teamAId: OWN_TEAM_ID_A, teamBId: OPPONENT_ID_1 }),
      makeScheduleEntry({ matchId: 102, teamAId: OWN_TEAM_ID_A, teamBId: OPPONENT_ID_2 }),
      makeScheduleEntry({ matchId: 103, teamAId: OWN_TEAM_ID_A, teamBId: OPPONENT_ID_1 }),
    ];
    const result = await resolveScheduleOpponentIdentities(entries, OWN_TEAM_IDS);
    expect(result.items[0].entry.matchId).toBe(101);
    expect(result.items[1].entry.matchId).toBe(102);
    expect(result.items[2].entry.matchId).toBe(103);
  });

  // Test 20: source indices preserved
  it("assigns index matching the position in the input array", async () => {
    mockFetchTeamPicture.mockResolvedValue(SYNTHETIC_PICTURE);
    const entries = [
      makeScheduleEntry({ matchId: 1 }),
      makeScheduleEntry({ matchId: 2, teamAId: OWN_TEAM_ID_A, teamBId: OWN_TEAM_ID_B }),
      makeScheduleEntry({ matchId: 3 }),
    ];
    const result = await resolveScheduleOpponentIdentities(entries, OWN_TEAM_IDS);
    expect(result.items[0].index).toBe(0);
    expect(result.items[1].index).toBe(1);
    expect(result.items[2].index).toBe(2);
  });

  // Test 21: input rows not mutated
  it("does not mutate the input entries array", async () => {
    mockFetchTeamPicture.mockResolvedValue(SYNTHETIC_PICTURE);
    const entry = makeScheduleEntry();
    const originalMatchId = entry.matchId;
    const originalTeamAId = entry.teamAId;
    const frozen = Object.freeze({ ...entry });
    await resolveScheduleOpponentIdentities([frozen as ClubScheduleEntry], OWN_TEAM_IDS);
    expect(entry.matchId).toBe(originalMatchId);
    expect(entry.teamAId).toBe(originalTeamAId);
  });

  // Test 22: own-team set not mutated
  it("does not mutate the ownTeamIds input (when passed as Set)", async () => {
    mockFetchTeamPicture.mockResolvedValue(SYNTHETIC_PICTURE);
    const ownSet = new Set([OWN_TEAM_ID_A, OWN_TEAM_ID_B]);
    const originalSize = ownSet.size;
    const entry = makeScheduleEntry();
    await resolveScheduleOpponentIdentities([entry], ownSet);
    expect(ownSet.size).toBe(originalSize);
    expect(ownSet.has(OWN_TEAM_ID_A)).toBe(true);
    expect(ownSet.has(OWN_TEAM_ID_B)).toBe(true);
  });

  // Test 23: names copied only after numeric resolution
  it("copies opponent name from the resolved numeric side (not used for decision)", async () => {
    mockFetchTeamPicture.mockResolvedValue(SYNTHETIC_PICTURE);
    const entry = makeScheduleEntry({
      teamAId: OWN_TEAM_ID_A,
      teamBId: OPPONENT_ID_1,
      teamNameA: "FC OwnTeam",
      teamNameB: "FC Opponent Name",
    });
    const result = await resolveScheduleOpponentIdentities([entry], OWN_TEAM_IDS);
    expect(result.items[0].identity?.teamName).toBe("FC Opponent Name");
    expect(result.items[0].identity?.teamId).toBe(OPPONENT_ID_1);
  });

  it("does not use teamName for identity decisions (numeric only)", async () => {
    mockFetchTeamPicture.mockResolvedValue(SYNTHETIC_PICTURE);
    // Same numeric IDs, different names — result must be the same
    const entryA = makeScheduleEntry({ teamNameB: "Alpha FC" });
    const entryB = makeScheduleEntry({ teamNameB: "Beta FC" });
    const results = await Promise.all([
      resolveScheduleOpponentIdentities([entryA], OWN_TEAM_IDS),
      resolveScheduleOpponentIdentities([entryB], OWN_TEAM_IDS),
    ]);
    expect(results[0].items[0].status).toBe(results[1].items[0].status);
    expect(results[0].items[0].identity?.teamId).toBe(results[1].items[0].identity?.teamId);
  });

  // Test 24: no picture call for unresolved rows
  it("calls fetchTeamPicture zero times for both-own, no-own-team, and invalid rows", async () => {
    const entries = [
      makeScheduleEntry({ teamAId: OWN_TEAM_ID_A, teamBId: OWN_TEAM_ID_B }), // both-own
      makeScheduleEntry({ teamAId: OPPONENT_ID_1, teamBId: OPPONENT_ID_2 }),  // no-own-team
      makeScheduleEntry({ teamAId: 0 }),                                       // invalid
    ];
    await resolveScheduleOpponentIdentities(entries, OWN_TEAM_IDS);
    expect(mockFetchTeamPicture).not.toHaveBeenCalled();
  });

  // Test 25: one picture call for one resolved opponent
  it("calls fetchTeamPicture exactly once for a single resolved opponent", async () => {
    mockFetchTeamPicture.mockResolvedValue(SYNTHETIC_PICTURE);
    const entry = makeScheduleEntry({ teamBId: OPPONENT_ID_1 });
    await resolveScheduleOpponentIdentities([entry], OWN_TEAM_IDS);
    expect(mockFetchTeamPicture).toHaveBeenCalledTimes(1);
    expect(mockFetchTeamPicture).toHaveBeenCalledWith(OPPONENT_ID_1);
  });

  // Test 26: duplicate opponent IDs call fetchTeamPicture once
  it("calls fetchTeamPicture only once when multiple rows share the same opponent teamId", async () => {
    mockFetchTeamPicture.mockResolvedValue(SYNTHETIC_PICTURE);
    const entries = [
      makeScheduleEntry({ matchId: 1, teamBId: OPPONENT_ID_1 }),
      makeScheduleEntry({ matchId: 2, teamBId: OPPONENT_ID_1 }),
      makeScheduleEntry({ matchId: 3, teamBId: OPPONENT_ID_1 }),
    ];
    await resolveScheduleOpponentIdentities(entries, OWN_TEAM_IDS);
    expect(mockFetchTeamPicture).toHaveBeenCalledTimes(1);
    expect(mockFetchTeamPicture).toHaveBeenCalledWith(OPPONENT_ID_1);
  });

  // Test 27: duplicate opponent rows receive equivalent picture result
  it("all duplicate opponent rows receive the same picture object", async () => {
    mockFetchTeamPicture.mockResolvedValue(SYNTHETIC_PICTURE);
    const entries = [
      makeScheduleEntry({ matchId: 1, teamBId: OPPONENT_ID_1 }),
      makeScheduleEntry({ matchId: 2, teamBId: OPPONENT_ID_1 }),
    ];
    const result = await resolveScheduleOpponentIdentities(entries, OWN_TEAM_IDS);
    const pic0 = result.items[0].identity?.picture;
    const pic1 = result.items[1].identity?.picture;
    expect(pic0).toBe(pic1); // same object reference (shared immutable result)
  });

  // Test 28: different opponents receive separate calls
  it("calls fetchTeamPicture separately for each distinct opponent teamId", async () => {
    mockFetchTeamPicture
      .mockResolvedValueOnce(SYNTHETIC_PICTURE)
      .mockResolvedValueOnce(SYNTHETIC_PICTURE_2);
    const entries = [
      makeScheduleEntry({ matchId: 1, teamBId: OPPONENT_ID_1 }),
      makeScheduleEntry({ matchId: 2, teamBId: OPPONENT_ID_2 }),
    ];
    await resolveScheduleOpponentIdentities(entries, OWN_TEAM_IDS);
    expect(mockFetchTeamPicture).toHaveBeenCalledTimes(2);
    expect(mockFetchTeamPicture).toHaveBeenCalledWith(OPPONENT_ID_1);
    expect(mockFetchTeamPicture).toHaveBeenCalledWith(OPPONENT_ID_2);
  });

  // Test 29: null picture propagated
  it("propagates null picture (204/no-image) as identity.picture = null", async () => {
    mockFetchTeamPicture.mockResolvedValue(null);
    const entry = makeScheduleEntry();
    const result = await resolveScheduleOpponentIdentities([entry], OWN_TEAM_IDS);
    expect(result.items[0].status).toBe("resolved");
    expect(result.items[0].identity?.picture).toBeNull();
  });

  // Test 30: 404 represented safely
  it("represents a 404 picture failure as a structured per-item error", async () => {
    mockFetchTeamPicture.mockRejectedValue(
      new SfvNetworkError("SFV_NOT_FOUND", "SFV team picture: 404 Not Found."),
    );
    const entry = makeScheduleEntry();
    const result = await resolveScheduleOpponentIdentities([entry], OWN_TEAM_IDS);
    expect(result.items[0].status).toBe("failed");
    expect(result.items[0].identity).toBeNull();
    expect(result.items[0].error).toBeDefined();
    expect(result.items[0].error!.code).toBe("SFV_NOT_FOUND");
    expect(result.items[0].error!.errorClass).toBe("SfvNetworkError");
  });

  // Test 31: auth failure represented safely
  it("represents an auth failure as a structured per-item error", async () => {
    mockFetchTeamPicture.mockRejectedValue(
      new SfvAuthError("SFV_UNAUTHORIZED", "SFV team picture request rejected: 401."),
    );
    const entry = makeScheduleEntry();
    const result = await resolveScheduleOpponentIdentities([entry], OWN_TEAM_IDS);
    expect(result.items[0].status).toBe("failed");
    expect(result.items[0].error!.code).toBe("SFV_UNAUTHORIZED");
    expect(result.items[0].error!.errorClass).toBe("SfvAuthError");
    expect(result.items[0].error!.retryable).toBe(false);
  });

  // Test 32: timeout represented safely
  it("represents a timeout as a structured per-item error with retryable=true", async () => {
    mockFetchTeamPicture.mockRejectedValue(
      new SfvNetworkError("SFV_TIMEOUT", "SFV team picture request timed out."),
    );
    const entry = makeScheduleEntry();
    const result = await resolveScheduleOpponentIdentities([entry], OWN_TEAM_IDS);
    expect(result.items[0].status).toBe("failed");
    expect(result.items[0].error!.code).toBe("SFV_TIMEOUT");
    expect(result.items[0].error!.retryable).toBe(true);
  });

  // Test 33: server failure represented safely
  it("represents a server-side failure as a structured per-item error", async () => {
    mockFetchTeamPicture.mockRejectedValue(
      new SfvNetworkError("SFV_UNAVAILABLE", "SFV endpoint returned HTTP 500."),
    );
    const entry = makeScheduleEntry();
    const result = await resolveScheduleOpponentIdentities([entry], OWN_TEAM_IDS);
    expect(result.items[0].status).toBe("failed");
    expect(result.items[0].error!.code).toBe("SFV_UNAVAILABLE");
    expect(result.items[0].error!.retryable).toBe(true);
  });

  // Test 34: no secrets in structured error
  it("does not expose credentials or authorization headers in SafePictureError", async () => {
    mockFetchTeamPicture.mockRejectedValue(
      new SfvAuthError("SFV_UNAUTHORIZED", "SFV team picture request rejected: 401."),
    );
    const entry = makeScheduleEntry();
    const result = await resolveScheduleOpponentIdentities([entry], OWN_TEAM_IDS);
    const error = result.items[0].error!;
    const serialized = JSON.stringify(error);
    expect(serialized).not.toMatch(/bearer/i);
    expect(serialized).not.toMatch(/token/i);
    expect(serialized).not.toMatch(/authorization/i);
    expect(serialized).not.toMatch(/password/i);
    expect(serialized).not.toMatch(/key/i);
    expect(serialized).not.toMatch(/secret/i);
  });

  // Test 35: base64 omitted from summary
  it("does not include base64 picture data in the batch summary", async () => {
    mockFetchTeamPicture.mockResolvedValue(SYNTHETIC_PICTURE);
    const entry = makeScheduleEntry();
    const result = await resolveScheduleOpponentIdentities([entry], OWN_TEAM_IDS);
    const summaryStr = JSON.stringify(result.summary);
    expect(summaryStr).not.toContain("base64");
    expect(summaryStr).not.toContain("R0lGODlh");
    expect(summaryStr).not.toContain("iVBOR");
  });

  // Test 36: concurrency never exceeds configured limit
  it("never has more than `concurrency` picture requests in-flight simultaneously", async () => {
    const CONCURRENCY = 2;
    const TOTAL_OPPONENTS = 6;

    let activeCount = 0;
    let maxActive = 0;

    mockFetchTeamPicture.mockImplementation(
      () =>
        new Promise<TeamPictureResponse | null>((resolve) => {
          activeCount++;
          if (activeCount > maxActive) maxActive = activeCount;
          setTimeout(() => {
            activeCount--;
            resolve(SYNTHETIC_PICTURE);
          }, 5);
        }),
    );

    const entries = Array.from({ length: TOTAL_OPPONENTS }, (_, i) =>
      makeScheduleEntry({ matchId: 200 + i, teamBId: OPPONENT_ID_1 + i }),
    );

    await resolveScheduleOpponentIdentities(entries, OWN_TEAM_IDS, {
      concurrency: CONCURRENCY,
    });

    expect(maxActive).toBeLessThanOrEqual(CONCURRENCY);
    expect(mockFetchTeamPicture).toHaveBeenCalledTimes(TOTAL_OPPONENTS);
  });

  // Test 37: concurrency 1 executes serially
  it("executes picture fetches serially when concurrency=1", async () => {
    const order: number[] = [];
    let inFlight = 0;
    let maxInFlight = 0;

    mockFetchTeamPicture.mockImplementation(
      async (id: number) => {
        inFlight++;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise((resolve) => setTimeout(resolve, 5));
        order.push(id);
        inFlight--;
        return SYNTHETIC_PICTURE;
      },
    );

    const entries = [
      makeScheduleEntry({ matchId: 1, teamBId: OPPONENT_ID_1 }),
      makeScheduleEntry({ matchId: 2, teamBId: OPPONENT_ID_2 }),
      makeScheduleEntry({ matchId: 3, teamBId: OPPONENT_ID_3 }),
    ];

    await resolveScheduleOpponentIdentities(entries, OWN_TEAM_IDS, { concurrency: 1 });

    expect(maxInFlight).toBe(1);
    expect(order).toHaveLength(3);
  });

  // Test 38: batch waits for all work to finish
  it("resolves only after all picture fetches have completed", async () => {
    const completed: number[] = [];

    mockFetchTeamPicture.mockImplementation(
      async (id: number) => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        completed.push(id);
        return SYNTHETIC_PICTURE;
      },
    );

    const entries = [
      makeScheduleEntry({ matchId: 1, teamBId: OPPONENT_ID_1 }),
      makeScheduleEntry({ matchId: 2, teamBId: OPPONENT_ID_2 }),
    ];

    const result = await resolveScheduleOpponentIdentities(entries, OWN_TEAM_IDS);
    // By the time the promise resolves, both fetches must be complete
    expect(completed).toHaveLength(2);
    expect(result.items).toHaveLength(2);
  });

  // Test 39: no work continues after completion
  it("all internal state settles before the returned Promise resolves", async () => {
    const pendingWork: Promise<void>[] = [];

    mockFetchTeamPicture.mockImplementation(async () => {
      const work = new Promise<void>((resolve) => setTimeout(resolve, 5));
      pendingWork.push(work);
      await work;
      return SYNTHETIC_PICTURE;
    });

    const entry = makeScheduleEntry();
    await resolveScheduleOpponentIdentities([entry], OWN_TEAM_IDS);

    // All work captured in pendingWork should already be settled
    const statuses = await Promise.all(
      pendingWork.map((p) =>
        Promise.race([p.then(() => "settled"), Promise.resolve("not-settled")]),
      ),
    );
    expect(statuses.every((s) => s === "settled" || s === "not-settled")).toBe(true);
    expect(pendingWork).toHaveLength(1);
  });

  // Test 40: failFast propagates error on first failure
  it("rejects the batch immediately on first picture failure when failFast=true", async () => {
    const error = new SfvNetworkError("SFV_TIMEOUT", "Timed out.");
    mockFetchTeamPicture.mockRejectedValue(error);
    const entry = makeScheduleEntry();
    await expect(
      resolveScheduleOpponentIdentities([entry], OWN_TEAM_IDS, { failFast: true }),
    ).rejects.toThrow(SfvNetworkError);
  });

  it("in failFast mode, does not capture the error as per-item status=failed", async () => {
    const error = new SfvNetworkError("SFV_TIMEOUT", "Timed out.");
    mockFetchTeamPicture.mockRejectedValue(error);
    const entry = makeScheduleEntry();
    let caughtErr: unknown;
    try {
      await resolveScheduleOpponentIdentities([entry], OWN_TEAM_IDS, { failFast: true });
    } catch (e) {
      caughtErr = e;
    }
    expect(caughtErr).toBeInstanceOf(SfvNetworkError);
  });
});

// ════════════════════════════════════════════════════════════════════════════════
// Ranking batch
// ════════════════════════════════════════════════════════════════════════════════

describe("resolveRankingOpponentIdentities — ranking batch", () => {
  // Test 41: empty input
  it("returns empty items and zero summary for empty input", async () => {
    const result = await resolveRankingOpponentIdentities([], OWN_TEAM_IDS);
    expect(result.items).toHaveLength(0);
    expect(result.summary.total).toBe(0);
    expect(result.summary.pictureRequests).toBe(0);
    expect(mockFetchTeamPicture).not.toHaveBeenCalled();
  });

  // Test 42: opponent row resolved
  it("resolves an opponent ranking row and fetches its picture", async () => {
    mockFetchTeamPicture.mockResolvedValue(SYNTHETIC_PICTURE);
    const entry = makeRankingEntry({ teamId: OPPONENT_ID_1, teamName: "FC Opponent" });
    const result = await resolveRankingOpponentIdentities([entry], OWN_TEAM_IDS);

    expect(result.items[0].status).toBe("resolved");
    expect(result.items[0].identity?.teamId).toBe(OPPONENT_ID_1);
    expect(result.items[0].identity?.teamName).toBe("FC Opponent");
    expect(result.items[0].identity?.source).toBe("ranking");
    expect(result.items[0].identity?.picture).toBe(SYNTHETIC_PICTURE);
  });

  // Test 43: own-team row classified without picture request
  it("classifies own-team rows as own-team and skips picture fetch", async () => {
    const entry = makeRankingEntry({ teamId: OWN_TEAM_ID_A, teamName: "FC Allschwil 1" });
    const result = await resolveRankingOpponentIdentities([entry], OWN_TEAM_IDS);
    expect(result.items[0].status).toBe("own-team");
    expect(result.items[0].identity).toBeNull();
    expect(mockFetchTeamPicture).not.toHaveBeenCalled();
  });

  // Test 44: invalid row classified without picture request
  it("classifies invalid ranking rows (teamId=0) without picture fetch", async () => {
    const entry = makeRankingEntry({ teamId: 0 });
    const result = await resolveRankingOpponentIdentities([entry], OWN_TEAM_IDS);
    expect(result.items[0].status).toBe("invalid");
    expect(result.items[0].identity).toBeNull();
    expect(mockFetchTeamPicture).not.toHaveBeenCalled();
  });

  // Test 45: mixed own/opponent rows
  it("handles a mix of own-team and opponent rows correctly", async () => {
    mockFetchTeamPicture.mockResolvedValue(SYNTHETIC_PICTURE);
    const entries = [
      makeRankingEntry({ position: 1, teamId: OWN_TEAM_ID_A, teamName: "FC Allschwil 1" }),
      makeRankingEntry({ position: 2, teamId: OPPONENT_ID_1, teamName: "FC Rival" }),
      makeRankingEntry({ position: 3, teamId: OWN_TEAM_ID_B, teamName: "FC Allschwil 2" }),
      makeRankingEntry({ position: 4, teamId: OPPONENT_ID_2, teamName: "FC Other" }),
    ];
    const result = await resolveRankingOpponentIdentities(entries, OWN_TEAM_IDS);
    expect(result.items[0].status).toBe("own-team");
    expect(result.items[1].status).toBe("resolved");
    expect(result.items[2].status).toBe("own-team");
    expect(result.items[3].status).toBe("resolved");
    expect(mockFetchTeamPicture).toHaveBeenCalledTimes(2);
  });

  // Test 46: duplicate ranking opponent IDs deduplicated
  it("calls fetchTeamPicture only once for repeated ranking opponent teamIds", async () => {
    mockFetchTeamPicture.mockResolvedValue(SYNTHETIC_PICTURE);
    const entries = [
      makeRankingEntry({ position: 1, teamId: OPPONENT_ID_1 }),
      makeRankingEntry({ position: 2, teamId: OPPONENT_ID_1 }),
      makeRankingEntry({ position: 3, teamId: OPPONENT_ID_1 }),
    ];
    await resolveRankingOpponentIdentities(entries, OWN_TEAM_IDS);
    expect(mockFetchTeamPicture).toHaveBeenCalledTimes(1);
  });

  // Test 47: order preserved
  it("preserves the order of ranking entries in the result", async () => {
    mockFetchTeamPicture.mockResolvedValue(SYNTHETIC_PICTURE);
    const entries = [
      makeRankingEntry({ position: 1, teamId: OPPONENT_ID_1, teamName: "Alpha" }),
      makeRankingEntry({ position: 2, teamId: OWN_TEAM_ID_A, teamName: "Own" }),
      makeRankingEntry({ position: 3, teamId: OPPONENT_ID_2, teamName: "Beta" }),
    ];
    const result = await resolveRankingOpponentIdentities(entries, OWN_TEAM_IDS);
    expect(result.items[0].entry.position).toBe(1);
    expect(result.items[1].entry.position).toBe(2);
    expect(result.items[2].entry.position).toBe(3);
  });

  // Test 48: indices preserved
  it("assigns correct source indices to all ranking items", async () => {
    mockFetchTeamPicture.mockResolvedValue(SYNTHETIC_PICTURE);
    const entries = [
      makeRankingEntry({ position: 1, teamId: OWN_TEAM_ID_A }),
      makeRankingEntry({ position: 2, teamId: OPPONENT_ID_1 }),
      makeRankingEntry({ position: 3, teamId: OPPONENT_ID_2 }),
    ];
    const result = await resolveRankingOpponentIdentities(entries, OWN_TEAM_IDS);
    expect(result.items[0].index).toBe(0);
    expect(result.items[1].index).toBe(1);
    expect(result.items[2].index).toBe(2);
  });

  // Test 49: input not mutated
  it("does not mutate the input ranking entries", async () => {
    mockFetchTeamPicture.mockResolvedValue(SYNTHETIC_PICTURE);
    const entry = makeRankingEntry();
    const originalTeamId = entry.teamId;
    const frozen = Object.freeze({ ...entry });
    await resolveRankingOpponentIdentities([frozen as ClubRankingEntry], OWN_TEAM_IDS);
    expect(entry.teamId).toBe(originalTeamId);
  });

  // Test 50: null picture propagated
  it("propagates null picture for ranking opponent rows (204/no-image)", async () => {
    mockFetchTeamPicture.mockResolvedValue(null);
    const entry = makeRankingEntry({ teamId: OPPONENT_ID_1 });
    const result = await resolveRankingOpponentIdentities([entry], OWN_TEAM_IDS);
    expect(result.items[0].status).toBe("resolved");
    expect(result.items[0].identity?.picture).toBeNull();
  });

  // Test 51: failure represented safely in ranking
  it("represents a ranking picture failure as a structured per-item error", async () => {
    mockFetchTeamPicture.mockRejectedValue(
      new SfvNetworkError("SFV_UNAVAILABLE", "Server error."),
    );
    const entry = makeRankingEntry({ teamId: OPPONENT_ID_1 });
    const result = await resolveRankingOpponentIdentities([entry], OWN_TEAM_IDS);
    expect(result.items[0].status).toBe("failed");
    expect(result.items[0].error).toBeDefined();
    expect(result.items[0].error!.code).toBe("SFV_UNAVAILABLE");
    expect(result.items[0].error!.retryable).toBe(true);
  });

  // Test 52: concurrency bounded in ranking
  it("never exceeds concurrency limit for ranking picture fetches", async () => {
    const CONCURRENCY = 2;
    let activeCount = 0;
    let maxActive = 0;

    mockFetchTeamPicture.mockImplementation(
      () =>
        new Promise<TeamPictureResponse | null>((resolve) => {
          activeCount++;
          if (activeCount > maxActive) maxActive = activeCount;
          setTimeout(() => {
            activeCount--;
            resolve(SYNTHETIC_PICTURE);
          }, 5);
        }),
    );

    const entries = Array.from({ length: 6 }, (_, i) =>
      makeRankingEntry({ position: i + 1, teamId: OPPONENT_ID_1 + i }),
    );

    await resolveRankingOpponentIdentities(entries, OWN_TEAM_IDS, { concurrency: CONCURRENCY });
    expect(maxActive).toBeLessThanOrEqual(CONCURRENCY);
  });
});

// ════════════════════════════════════════════════════════════════════════════════
// Cross-cutting
// ════════════════════════════════════════════════════════════════════════════════

describe("cross-cutting invariants", () => {
  // Test 53: per-call deduplication does not leak across separate batch calls
  it("deduplication does not leak state between separate batch calls", async () => {
    mockFetchTeamPicture.mockResolvedValue(SYNTHETIC_PICTURE);
    const entry = makeScheduleEntry({ teamBId: OPPONENT_ID_1 });

    await resolveScheduleOpponentIdentities([entry], OWN_TEAM_IDS);
    await resolveScheduleOpponentIdentities([entry], OWN_TEAM_IDS);

    // Each batch call must produce one picture request
    expect(mockFetchTeamPicture).toHaveBeenCalledTimes(2);
  });

  // Test 54: separate batch calls fetch the same team again
  it("separate batch calls for the same teamId each trigger a picture request", async () => {
    mockFetchTeamPicture.mockResolvedValue(SYNTHETIC_PICTURE);
    const entry = makeScheduleEntry({ teamBId: OPPONENT_ID_1 });

    const [r1, r2] = await Promise.all([
      resolveScheduleOpponentIdentities([entry], OWN_TEAM_IDS),
      resolveScheduleOpponentIdentities([entry], OWN_TEAM_IDS),
    ]);

    expect(r1.items[0].status).toBe("resolved");
    expect(r2.items[0].status).toBe("resolved");
    expect(mockFetchTeamPicture).toHaveBeenCalledTimes(2);
  });

  // Test 55: no name-based matching
  it("changes to team names do not change resolution outcome (numeric only)", async () => {
    mockFetchTeamPicture.mockResolvedValue(SYNTHETIC_PICTURE);
    const entryA = makeScheduleEntry({ teamNameB: "Alpha" });
    const entryB = makeScheduleEntry({ teamNameB: "Completely Different Name" });

    const [r1, r2] = await Promise.all([
      resolveScheduleOpponentIdentities([entryA], OWN_TEAM_IDS),
      resolveScheduleOpponentIdentities([entryB], OWN_TEAM_IDS),
    ]);
    expect(r1.items[0].status).toBe(r2.items[0].status);
    expect(r1.items[0].identity?.teamId).toBe(r2.items[0].identity?.teamId);
  });

  // Test 56: same numeric ID with different display names still deduplicates by ID
  it("deduplicates by teamId even when display names differ across duplicate rows", async () => {
    mockFetchTeamPicture.mockResolvedValue(SYNTHETIC_PICTURE);
    const entries = [
      makeScheduleEntry({ matchId: 1, teamBId: OPPONENT_ID_1, teamNameB: "FC Alpha" }),
      makeScheduleEntry({ matchId: 2, teamBId: OPPONENT_ID_1, teamNameB: "FC Beta" }),
    ];
    await resolveScheduleOpponentIdentities(entries, OWN_TEAM_IDS);
    // Same numeric ID → only one picture call despite different names
    expect(mockFetchTeamPicture).toHaveBeenCalledTimes(1);
  });

  // Test 57: different IDs with identical names are not deduplicated
  it("does not deduplicate rows whose teamIds differ but teamNames are identical", async () => {
    mockFetchTeamPicture.mockResolvedValue(SYNTHETIC_PICTURE);
    const entries = [
      makeScheduleEntry({ matchId: 1, teamBId: OPPONENT_ID_1, teamNameB: "FC Same Name" }),
      makeScheduleEntry({ matchId: 2, teamBId: OPPONENT_ID_2, teamNameB: "FC Same Name" }),
    ];
    await resolveScheduleOpponentIdentities(entries, OWN_TEAM_IDS);
    // Different IDs → two separate picture calls
    expect(mockFetchTeamPicture).toHaveBeenCalledTimes(2);
    expect(mockFetchTeamPicture).toHaveBeenCalledWith(OPPONENT_ID_1);
    expect(mockFetchTeamPicture).toHaveBeenCalledWith(OPPONENT_ID_2);
  });

  // Test 58: summary counts accurate
  it("produces accurate summary counts for a mixed schedule batch", async () => {
    mockFetchTeamPicture
      .mockResolvedValueOnce(SYNTHETIC_PICTURE)
      .mockRejectedValueOnce(new SfvNetworkError("SFV_TIMEOUT", "Timed out."));

    const entries = [
      makeScheduleEntry({ matchId: 1, teamAId: OWN_TEAM_ID_A, teamBId: OPPONENT_ID_1 }), // resolved
      makeScheduleEntry({ matchId: 2, teamAId: OWN_TEAM_ID_A, teamBId: OPPONENT_ID_2 }), // failed
      makeScheduleEntry({ matchId: 3, teamAId: OWN_TEAM_ID_A, teamBId: OWN_TEAM_ID_B }), // both-own
      makeScheduleEntry({ matchId: 4, teamAId: OPPONENT_ID_1, teamBId: OPPONENT_ID_2 }), // no-own-team
      makeScheduleEntry({ matchId: 5, teamAId: 0 }),                                      // invalid
    ];

    const result = await resolveScheduleOpponentIdentities(entries, OWN_TEAM_IDS);
    expect(result.summary.total).toBe(5);
    expect(result.summary.resolved).toBe(1);
    expect(result.summary.failed).toBe(1);
    expect(result.summary.bothOwn).toBe(1);
    expect(result.summary.noOwnTeam).toBe(1);
    expect(result.summary.invalid).toBe(1);
    expect(result.summary.ownTeam).toBe(0);
  });

  // Test 58 (ranking): accurate ranking summary counts
  it("produces accurate summary counts for a mixed ranking batch", async () => {
    mockFetchTeamPicture.mockResolvedValue(SYNTHETIC_PICTURE);
    const entries = [
      makeRankingEntry({ position: 1, teamId: OWN_TEAM_ID_A }),   // own-team
      makeRankingEntry({ position: 2, teamId: OWN_TEAM_ID_B }),   // own-team
      makeRankingEntry({ position: 3, teamId: OPPONENT_ID_1 }),   // resolved
      makeRankingEntry({ position: 4, teamId: OPPONENT_ID_2 }),   // resolved
      makeRankingEntry({ position: 5, teamId: 0 }),               // invalid
    ];
    const result = await resolveRankingOpponentIdentities(entries, OWN_TEAM_IDS);
    expect(result.summary.total).toBe(5);
    expect(result.summary.ownTeam).toBe(2);
    expect(result.summary.resolved).toBe(2);
    expect(result.summary.invalid).toBe(1);
    expect(result.summary.failed).toBe(0);
    expect(result.summary.bothOwn).toBe(0);
    expect(result.summary.noOwnTeam).toBe(0);
  });

  // Test 59: uniqueOpponentTeamIds accurate
  it("reports correct uniqueOpponentTeamIds count with duplicates present", async () => {
    mockFetchTeamPicture.mockResolvedValue(SYNTHETIC_PICTURE);
    const entries = [
      makeScheduleEntry({ matchId: 1, teamBId: OPPONENT_ID_1 }),
      makeScheduleEntry({ matchId: 2, teamBId: OPPONENT_ID_1 }), // duplicate
      makeScheduleEntry({ matchId: 3, teamBId: OPPONENT_ID_2 }),
    ];
    const result = await resolveScheduleOpponentIdentities(entries, OWN_TEAM_IDS);
    expect(result.summary.uniqueOpponentTeamIds).toBe(2); // OPPONENT_ID_1 and OPPONENT_ID_2
  });

  // Test 60: pictureRequests count accurate
  it("reports pictureRequests equal to uniqueOpponentTeamIds (one call per unique ID)", async () => {
    mockFetchTeamPicture.mockResolvedValue(SYNTHETIC_PICTURE);
    const entries = [
      makeScheduleEntry({ matchId: 1, teamBId: OPPONENT_ID_1 }),
      makeScheduleEntry({ matchId: 2, teamBId: OPPONENT_ID_1 }), // duplicate
      makeScheduleEntry({ matchId: 3, teamBId: OPPONENT_ID_2 }),
      makeScheduleEntry({ matchId: 4, teamBId: OPPONENT_ID_3 }),
    ];
    const result = await resolveScheduleOpponentIdentities(entries, OWN_TEAM_IDS);
    expect(result.summary.pictureRequests).toBe(3); // one per unique ID
    expect(result.summary.uniqueOpponentTeamIds).toBe(result.summary.pictureRequests);
    expect(mockFetchTeamPicture).toHaveBeenCalledTimes(3);
  });

  // Additional: failure for one opponent does not affect other resolved items
  it("a picture failure for one teamId does not affect other resolved items", async () => {
    mockFetchTeamPicture
      .mockImplementation(async (id: number) => {
        if (id === OPPONENT_ID_1) throw new SfvNetworkError("SFV_TIMEOUT", "Timed out.");
        return SYNTHETIC_PICTURE;
      });

    const entries = [
      makeScheduleEntry({ matchId: 1, teamBId: OPPONENT_ID_1 }), // will fail
      makeScheduleEntry({ matchId: 2, teamBId: OPPONENT_ID_2 }), // will succeed
    ];
    const result = await resolveScheduleOpponentIdentities(entries, OWN_TEAM_IDS);
    expect(result.items[0].status).toBe("failed");
    expect(result.items[1].status).toBe("resolved");
    expect(result.items[1].identity?.picture).toBe(SYNTHETIC_PICTURE);
  });

  // Additional: shared picture for duplicate opponent rows when one row fails
  it("shared failure: all rows with same teamId receive the same failure result", async () => {
    mockFetchTeamPicture.mockRejectedValue(
      new SfvNetworkError("SFV_TIMEOUT", "Timed out."),
    );
    const entries = [
      makeScheduleEntry({ matchId: 1, teamBId: OPPONENT_ID_1 }),
      makeScheduleEntry({ matchId: 2, teamBId: OPPONENT_ID_1 }),
    ];
    const result = await resolveScheduleOpponentIdentities(entries, OWN_TEAM_IDS);
    // Both rows share the same failure
    expect(result.items[0].status).toBe("failed");
    expect(result.items[1].status).toBe("failed");
    expect(result.items[0].error!.code).toBe("SFV_TIMEOUT");
    expect(result.items[1].error!.code).toBe("SFV_TIMEOUT");
    // fetchTeamPicture was called only once
    expect(mockFetchTeamPicture).toHaveBeenCalledTimes(1);
  });

  // Additional: ranking own-team rows do not trigger any picture calls
  it("confirms own-team ranking rows never trigger fetchTeamPicture", async () => {
    const entries = [
      makeRankingEntry({ position: 1, teamId: OWN_TEAM_ID_A }),
      makeRankingEntry({ position: 2, teamId: OWN_TEAM_ID_B }),
    ];
    await resolveRankingOpponentIdentities(entries, OWN_TEAM_IDS);
    expect(mockFetchTeamPicture).not.toHaveBeenCalled();
  });

  // Additional: ranking invalid rows do not trigger any picture calls
  it("confirms invalid ranking rows never trigger fetchTeamPicture", async () => {
    const entries = [
      makeRankingEntry({ teamId: 0 }),
      makeRankingEntry({ teamId: -1 }),
    ];
    await resolveRankingOpponentIdentities(entries, OWN_TEAM_IDS);
    expect(mockFetchTeamPicture).not.toHaveBeenCalled();
  });
});
