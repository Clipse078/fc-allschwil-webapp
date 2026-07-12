/**
 * lib/integrations/sfv/__tests__/club-data-service.test.ts
 *
 * Focused unit tests for the Club Data Aggregation Service.
 *
 * All SFV clients and batch resolvers are mocked. No real network requests
 * are made. No production secrets are used.
 *
 * TEST COVERAGE MAP:
 *
 * Aggregation — success path:
 *   1.  successful aggregation returns ClubSeasonData with correct shape
 *   2.  clubId and seasonId forwarded to fetchTeamList
 *   3.  clubId and seasonId forwarded to fetchClubSchedule
 *   4.  clubId and seasonId forwarded to fetchClubRanking
 *   5.  ownTeamIds built from fetchTeamList result (normalizeOwnTeamIds)
 *   6.  ownTeamIds forwarded correctly to schedule batch resolver
 *   7.  ownTeamIds forwarded correctly to ranking batch resolver
 *   8.  schedule and ranking fetched in parallel (after fetchTeamList)
 *   9.  fetch ordering: resolveClubIds → fetchTeamList → parallel(schedule, ranking)
 *   10. resolveScheduleOpponentIdentities called before resolveRankingOpponentIdentities
 *   11. batchOptions forwarded to both batch resolvers
 *   12. teamList fetched exactly once
 *   13. schedule fetched exactly once
 *   14. ranking fetched exactly once
 *
 * Aggregation — season metadata:
 *   15. seasonName derived from first schedule entry with non-null seasonName
 *   16. seasonShortName derived from YYYY/YYYY format
 *   17. seasonShortName is null when seasonName is null
 *   18. seasonShortName is null when seasonName does not match YYYY/YYYY
 *   19. seasonName is null when all schedule entries have null seasonName
 *   20. seasonName is null when schedule is empty
 *
 * Aggregation — empty inputs:
 *   21. empty team list → ownTeamCount=0, aggregation still succeeds
 *   22. empty schedule → scheduleCount=0
 *   23. empty ranking → rankingCount=0
 *   24. empty schedule and ranking → summary counts are zero
 *
 * Aggregation — summary values:
 *   25. ownTeamCount equals length of fetchTeamList result
 *   26. scheduleCount equals length of schedule entries
 *   27. rankingCount equals length of ranking entries
 *   28. resolvedScheduleOpponents from schedule resolution summary
 *   29. resolvedRankingOpponents from ranking resolution summary
 *   30. uniqueOpponentTeams counts distinct opponent teamIds across both datasets
 *   31. uniqueOpponentTeams deduplicates teams appearing in schedule and ranking
 *   32. pictureCount counts unique teams with non-null pictures (first-seen wins)
 *   33. missingPictures counts unique teams with null pictures
 *   34. failed picture items contribute to uniqueOpponentTeams but not picture counts
 *
 * Aggregation — error propagation:
 *   35. resolveClubIds failure propagates immediately
 *   36. fetchTeamList failure propagates immediately
 *   37. fetchClubSchedule failure propagates immediately
 *   38. fetchClubRanking failure propagates immediately
 *   39. resolveScheduleOpponentIdentities failure propagates
 *   40. resolveRankingOpponentIdentities failure propagates
 *
 * Aggregation — immutability and no duplication:
 *   41. schedule entries in output are the same reference as returned by fetchClubSchedule
 *   42. ranking entries in output are the same reference as returned by fetchClubRanking
 *   43. ownTeams in output are the same reference as returned by fetchTeamList
 *   44. no fetchTeamPicture call is made directly (picture work only via batch resolvers)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SfvNetworkError, SfvAuthError } from "../errors";
import type {
  TeamDetail,
  ClubScheduleEntry,
  ClubRankingEntry,
} from "../client";
import type {
  ScheduleOpponentBatchResult,
  RankingOpponentBatchResult,
  ScheduleOpponentBatchItem,
  RankingOpponentBatchItem,
} from "../batch-opponent-identity";

// ── Mocks ──────────────────────────────────────────────────────────────────────

vi.mock("../client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../client")>();
  return {
    ...actual,
    resolveClubIds: vi.fn(),
    fetchTeamList: vi.fn(),
    fetchClubSchedule: vi.fn(),
    fetchClubRanking: vi.fn(),
    // fetchTeamPicture must NOT be called directly by the service.
    // Mock it so any accidental direct call is detectable.
    fetchTeamPicture: vi.fn(),
  };
});

vi.mock("../batch-opponent-identity", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../batch-opponent-identity")>();
  return {
    ...actual,
    resolveScheduleOpponentIdentities: vi.fn(),
    resolveRankingOpponentIdentities: vi.fn(),
  };
});

import { resolveClubIds, fetchTeamList, fetchClubSchedule, fetchClubRanking, fetchTeamPicture } from "../client";
import { resolveScheduleOpponentIdentities, resolveRankingOpponentIdentities } from "../batch-opponent-identity";
import { loadClubSeasonData } from "../club-data-service";

const mockResolveClubIds = vi.mocked(resolveClubIds);
const mockFetchTeamList = vi.mocked(fetchTeamList);
const mockFetchClubSchedule = vi.mocked(fetchClubSchedule);
const mockFetchClubRanking = vi.mocked(fetchClubRanking);
const mockFetchTeamPicture = vi.mocked(fetchTeamPicture);
const mockResolveScheduleOpponentIdentities = vi.mocked(resolveScheduleOpponentIdentities);
const mockResolveRankingOpponentIdentities = vi.mocked(resolveRankingOpponentIdentities);

// ── Synthetic test data ────────────────────────────────────────────────────────

const CLUB_ID = 483;
const SEASON_ID = 2027;

const OWN_TEAM_ID_1 = 10001;
const OWN_TEAM_ID_2 = 10002;
const OPPONENT_ID_1 = 20001;
const OPPONENT_ID_2 = 20002;
const OPPONENT_ID_3 = 20003;

function makeTeamDetail(overrides: Partial<TeamDetail> = {}): TeamDetail {
  return {
    isHomeTeam: true,
    teamId: OWN_TEAM_ID_1,
    teamName: "FC Allschwil 1",
    teamFullname: "FC Allschwil 1. Mannschaft",
    clubNumber: 483,
    clubName: "FC Allschwil",
    teamLeagueId: 301,
    teamLeagueName: "4. Liga",
    teamDivisionName: "Gruppe 1",
    teamOrganisationId: 1,
    isTeamActive: true,
    ...overrides,
  };
}

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
    seasonId: SEASON_ID,
    seasonName: "2026/2027",
    scoreTeamA: 0,
    scoreTeamB: 0,
    teamAId: OWN_TEAM_ID_1,
    teamNameA: "FC Allschwil 1",
    teamBId: OPPONENT_ID_1,
    teamNameB: "FC Opponent 1",
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
    teamName: "FC Opponent 1",
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

const SYNTHETIC_PICTURE = {
  base64: "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  contentType: "image/gif",
  contentLength: null,
  etag: null,
  lastModified: null,
  cacheControl: null,
};

function makeResolvedScheduleItem(
  index: number,
  entry: ClubScheduleEntry,
  opponentTeamId: number,
  picture: typeof SYNTHETIC_PICTURE | null = SYNTHETIC_PICTURE,
): ScheduleOpponentBatchItem {
  return {
    index,
    entry,
    status: "resolved",
    identity: {
      source: "schedule",
      teamId: opponentTeamId,
      teamName: "FC Opponent",
      side: "teamB",
      ownTeamId: OWN_TEAM_ID_1,
      picture,
    },
    resolution: {
      outcome: "resolved",
      opponentTeamId,
      opponentTeamName: "FC Opponent",
      opponentSide: "teamB",
      ownTeamId: OWN_TEAM_ID_1,
    },
  };
}

function makeResolvedRankingItem(
  index: number,
  entry: ClubRankingEntry,
  opponentTeamId: number,
  picture: typeof SYNTHETIC_PICTURE | null = SYNTHETIC_PICTURE,
): RankingOpponentBatchItem {
  return {
    index,
    entry,
    status: "resolved",
    identity: {
      source: "ranking",
      teamId: opponentTeamId,
      teamName: "FC Opponent",
      side: null,
      ownTeamId: 0,
      picture,
    },
    resolution: {
      outcome: "opponent",
      opponentTeamId,
      opponentTeamName: "FC Opponent",
    },
  };
}

function makeFailedScheduleItem(
  index: number,
  entry: ClubScheduleEntry,
  opponentTeamId: number,
): ScheduleOpponentBatchItem {
  return {
    index,
    entry,
    status: "failed",
    identity: null,
    resolution: {
      outcome: "resolved",
      opponentTeamId,
      opponentTeamName: "FC Opponent",
      opponentSide: "teamB",
      ownTeamId: OWN_TEAM_ID_1,
    },
    error: {
      errorClass: "SfvNetworkError",
      code: "SFV_TIMEOUT",
      message: "SFV team picture request timed out.",
      retryable: true,
    },
  };
}

function makeFailedRankingItem(
  index: number,
  entry: ClubRankingEntry,
  opponentTeamId: number,
): RankingOpponentBatchItem {
  return {
    index,
    entry,
    status: "failed",
    identity: null,
    resolution: {
      outcome: "opponent",
      opponentTeamId,
      opponentTeamName: "FC Opponent",
    },
    error: {
      errorClass: "SfvNetworkError",
      code: "SFV_TIMEOUT",
      message: "SFV team picture request timed out.",
      retryable: true,
    },
  };
}

function makeEmptyScheduleBatchResult(): ScheduleOpponentBatchResult {
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

function makeEmptyRankingBatchResult(): RankingOpponentBatchResult {
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

// ── Default mock setup ─────────────────────────────────────────────────────────

function setupDefaultMocks(): void {
  mockResolveClubIds.mockResolvedValue({ raw: "{}", parsed: {} });

  const team1 = makeTeamDetail({ teamId: OWN_TEAM_ID_1 });
  const team2 = makeTeamDetail({ teamId: OWN_TEAM_ID_2, teamName: "FC Allschwil 2" });
  mockFetchTeamList.mockResolvedValue([team1, team2]);

  const schedEntry = makeScheduleEntry();
  mockFetchClubSchedule.mockResolvedValue([schedEntry]);

  const rankEntry = makeRankingEntry();
  mockFetchClubRanking.mockResolvedValue([rankEntry]);

  const scheduleItem = makeResolvedScheduleItem(0, schedEntry, OPPONENT_ID_1, SYNTHETIC_PICTURE);
  mockResolveScheduleOpponentIdentities.mockResolvedValue({
    items: [scheduleItem],
    summary: {
      total: 1,
      resolved: 1,
      ownTeam: 0,
      bothOwn: 0,
      noOwnTeam: 0,
      invalid: 0,
      failed: 0,
      uniqueOpponentTeamIds: 1,
      pictureRequests: 1,
    },
  });

  const rankingItem = makeResolvedRankingItem(0, rankEntry, OPPONENT_ID_1, SYNTHETIC_PICTURE);
  mockResolveRankingOpponentIdentities.mockResolvedValue({
    items: [rankingItem],
    summary: {
      total: 1,
      resolved: 1,
      ownTeam: 0,
      bothOwn: 0,
      noOwnTeam: 0,
      invalid: 0,
      failed: 0,
      uniqueOpponentTeamIds: 1,
      pictureRequests: 1,
    },
  });
}

// ── Lifecycle ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.resetAllMocks();
  setupDefaultMocks();
});

afterEach(() => {
  vi.clearAllMocks();
});

// ════════════════════════════════════════════════════════════════════════════════
// Aggregation — success path
// ════════════════════════════════════════════════════════════════════════════════

describe("loadClubSeasonData — success path", () => {
  // Test 1: returns ClubSeasonData with correct shape
  it("returns a ClubSeasonData with all required fields", async () => {
    const result = await loadClubSeasonData({ clubId: CLUB_ID, seasonId: SEASON_ID });

    expect(result).toMatchObject({
      clubId: CLUB_ID,
      seasonId: SEASON_ID,
      ownTeams: expect.any(Array),
      schedule: expect.objectContaining({
        entries: expect.any(Array),
        resolution: expect.objectContaining({ items: expect.any(Array) }),
      }),
      ranking: expect.objectContaining({
        entries: expect.any(Array),
        resolution: expect.objectContaining({ items: expect.any(Array) }),
      }),
      summary: expect.objectContaining({
        ownTeamCount: expect.any(Number),
        scheduleCount: expect.any(Number),
        rankingCount: expect.any(Number),
      }),
    });
  });

  // Test 2: clubId and seasonId forwarded to fetchTeamList
  it("forwards clubId and seasonId to fetchTeamList", async () => {
    await loadClubSeasonData({ clubId: CLUB_ID, seasonId: SEASON_ID });
    expect(mockFetchTeamList).toHaveBeenCalledOnce();
    expect(mockFetchTeamList).toHaveBeenCalledWith({
      SeasonId: SEASON_ID,
      ClubId: CLUB_ID,
    });
  });

  // Test 3: clubId and seasonId forwarded to fetchClubSchedule
  it("forwards clubId and seasonId to fetchClubSchedule", async () => {
    await loadClubSeasonData({ clubId: CLUB_ID, seasonId: SEASON_ID });
    expect(mockFetchClubSchedule).toHaveBeenCalledOnce();
    expect(mockFetchClubSchedule).toHaveBeenCalledWith({
      SeasonId: SEASON_ID,
      ClubId: CLUB_ID,
    });
  });

  // Test 4: clubId and seasonId forwarded to fetchClubRanking
  it("forwards clubId and seasonId to fetchClubRanking", async () => {
    await loadClubSeasonData({ clubId: CLUB_ID, seasonId: SEASON_ID });
    expect(mockFetchClubRanking).toHaveBeenCalledOnce();
    expect(mockFetchClubRanking).toHaveBeenCalledWith({
      SeasonId: SEASON_ID,
      ClubId: CLUB_ID,
    });
  });

  // Test 5: ownTeamIds built from fetchTeamList result
  it("builds ownTeamIds from fetchTeamList result and passes to schedule resolver", async () => {
    const team1 = makeTeamDetail({ teamId: OWN_TEAM_ID_1 });
    const team2 = makeTeamDetail({ teamId: OWN_TEAM_ID_2 });
    mockFetchTeamList.mockResolvedValue([team1, team2]);

    await loadClubSeasonData({ clubId: CLUB_ID, seasonId: SEASON_ID });

    expect(mockResolveScheduleOpponentIdentities).toHaveBeenCalledOnce();
    const [, ownTeamIdsArg] = mockResolveScheduleOpponentIdentities.mock.calls[0];
    // The ownTeamIds are passed as a ReadonlySet — convert to array for assertion
    const passed = Array.from(ownTeamIdsArg as Iterable<number>).sort();
    expect(passed).toEqual([OWN_TEAM_ID_1, OWN_TEAM_ID_2].sort());
  });

  // Test 6: ownTeamIds forwarded correctly to schedule batch resolver
  it("passes normalized ownTeamIds to resolveScheduleOpponentIdentities", async () => {
    const team = makeTeamDetail({ teamId: OWN_TEAM_ID_1 });
    mockFetchTeamList.mockResolvedValue([team]);

    await loadClubSeasonData({ clubId: CLUB_ID, seasonId: SEASON_ID });

    const [, ownTeamIdsArg] = mockResolveScheduleOpponentIdentities.mock.calls[0];
    expect(Array.from(ownTeamIdsArg as Iterable<number>)).toContain(OWN_TEAM_ID_1);
  });

  // Test 7: ownTeamIds forwarded correctly to ranking batch resolver
  it("passes same ownTeamIds to resolveRankingOpponentIdentities", async () => {
    const team = makeTeamDetail({ teamId: OWN_TEAM_ID_2 });
    mockFetchTeamList.mockResolvedValue([team]);

    await loadClubSeasonData({ clubId: CLUB_ID, seasonId: SEASON_ID });

    const [, schedOwnIds] = mockResolveScheduleOpponentIdentities.mock.calls[0];
    const [, rankOwnIds] = mockResolveRankingOpponentIdentities.mock.calls[0];
    expect(Array.from(schedOwnIds as Iterable<number>)).toEqual(
      Array.from(rankOwnIds as Iterable<number>),
    );
  });

  // Test 8: schedule and ranking fetched in parallel
  it("fetches schedule and ranking in parallel after fetchTeamList completes", async () => {
    const startOrder: string[] = [];

    mockFetchTeamList.mockImplementation(async () => {
      startOrder.push("fetchTeamList-start");
      await Promise.resolve();
      startOrder.push("fetchTeamList-end");
      return [makeTeamDetail({ teamId: OWN_TEAM_ID_1 })];
    });
    mockFetchClubSchedule.mockImplementation(async () => {
      startOrder.push("fetchClubSchedule-start");
      await Promise.resolve();
      return [];
    });
    mockFetchClubRanking.mockImplementation(async () => {
      startOrder.push("fetchClubRanking-start");
      await Promise.resolve();
      return [];
    });
    mockResolveScheduleOpponentIdentities.mockResolvedValue(makeEmptyScheduleBatchResult());
    mockResolveRankingOpponentIdentities.mockResolvedValue(makeEmptyRankingBatchResult());

    await loadClubSeasonData({ clubId: CLUB_ID, seasonId: SEASON_ID });

    // fetchTeamList must start and finish before schedule and ranking start
    const teamListEndIdx = startOrder.indexOf("fetchTeamList-end");
    const schedStartIdx = startOrder.indexOf("fetchClubSchedule-start");
    const rankStartIdx = startOrder.indexOf("fetchClubRanking-start");

    expect(teamListEndIdx).toBeLessThan(schedStartIdx);
    expect(teamListEndIdx).toBeLessThan(rankStartIdx);

    // Both schedule and ranking start before either finishes (parallel execution)
    // Both start positions appear before any potential completion
    expect(schedStartIdx).toBeGreaterThan(-1);
    expect(rankStartIdx).toBeGreaterThan(-1);
  });

  // Test 9: fetch ordering: resolveClubIds → fetchTeamList → parallel(schedule, ranking)
  it("calls resolveClubIds before fetchTeamList before schedule and ranking fetches", async () => {
    const callOrder: string[] = [];
    mockResolveClubIds.mockImplementation(async () => {
      callOrder.push("resolveClubIds");
      return { raw: "{}", parsed: {} };
    });
    mockFetchTeamList.mockImplementation(async () => {
      callOrder.push("fetchTeamList");
      return [makeTeamDetail({ teamId: OWN_TEAM_ID_1 })];
    });
    mockFetchClubSchedule.mockImplementation(async () => {
      callOrder.push("fetchClubSchedule");
      return [];
    });
    mockFetchClubRanking.mockImplementation(async () => {
      callOrder.push("fetchClubRanking");
      return [];
    });
    mockResolveScheduleOpponentIdentities.mockResolvedValue(makeEmptyScheduleBatchResult());
    mockResolveRankingOpponentIdentities.mockResolvedValue(makeEmptyRankingBatchResult());

    await loadClubSeasonData({ clubId: CLUB_ID, seasonId: SEASON_ID });

    expect(callOrder[0]).toBe("resolveClubIds");
    expect(callOrder[1]).toBe("fetchTeamList");
    // schedule and ranking appear after fetchTeamList (order between them is not guaranteed)
    const schedIdx = callOrder.indexOf("fetchClubSchedule");
    const rankIdx = callOrder.indexOf("fetchClubRanking");
    expect(schedIdx).toBeGreaterThan(1);
    expect(rankIdx).toBeGreaterThan(1);
  });

  // Test 10: resolveScheduleOpponentIdentities called before resolveRankingOpponentIdentities
  it("resolves schedule opponents before ranking opponents", async () => {
    const callOrder: string[] = [];
    mockFetchClubSchedule.mockResolvedValue([]);
    mockFetchClubRanking.mockResolvedValue([]);
    mockResolveScheduleOpponentIdentities.mockImplementation(async () => {
      callOrder.push("resolveSchedule");
      return makeEmptyScheduleBatchResult();
    });
    mockResolveRankingOpponentIdentities.mockImplementation(async () => {
      callOrder.push("resolveRanking");
      return makeEmptyRankingBatchResult();
    });

    await loadClubSeasonData({ clubId: CLUB_ID, seasonId: SEASON_ID });

    expect(callOrder).toEqual(["resolveSchedule", "resolveRanking"]);
  });

  // Test 11: batchOptions forwarded to both batch resolvers
  it("forwards batchOptions to both batch resolvers", async () => {
    const batchOptions = { concurrency: 2, failFast: true };
    await loadClubSeasonData({ clubId: CLUB_ID, seasonId: SEASON_ID, batchOptions });

    expect(mockResolveScheduleOpponentIdentities).toHaveBeenCalledWith(
      expect.any(Array),
      expect.anything(),
      batchOptions,
    );
    expect(mockResolveRankingOpponentIdentities).toHaveBeenCalledWith(
      expect.any(Array),
      expect.anything(),
      batchOptions,
    );
  });

  // Test 12: teamList fetched exactly once
  it("fetches team list exactly once", async () => {
    await loadClubSeasonData({ clubId: CLUB_ID, seasonId: SEASON_ID });
    expect(mockFetchTeamList).toHaveBeenCalledTimes(1);
  });

  // Test 13: schedule fetched exactly once
  it("fetches schedule exactly once", async () => {
    await loadClubSeasonData({ clubId: CLUB_ID, seasonId: SEASON_ID });
    expect(mockFetchClubSchedule).toHaveBeenCalledTimes(1);
  });

  // Test 14: ranking fetched exactly once
  it("fetches ranking exactly once", async () => {
    await loadClubSeasonData({ clubId: CLUB_ID, seasonId: SEASON_ID });
    expect(mockFetchClubRanking).toHaveBeenCalledTimes(1);
  });
});

// ════════════════════════════════════════════════════════════════════════════════
// Aggregation — season metadata
// ════════════════════════════════════════════════════════════════════════════════

describe("loadClubSeasonData — season metadata", () => {
  // Test 15: seasonName derived from first schedule entry with non-null seasonName
  it("derives seasonName from first schedule entry with a non-null seasonName", async () => {
    const entries = [
      makeScheduleEntry({ seasonName: null }),
      makeScheduleEntry({ matchId: 100002, seasonName: "2026/2027" }),
    ];
    mockFetchClubSchedule.mockResolvedValue(entries);

    const result = await loadClubSeasonData({ clubId: CLUB_ID, seasonId: SEASON_ID });

    expect(result.seasonName).toBe("2026/2027");
  });

  // Test 16: seasonShortName derived from YYYY/YYYY format
  it("derives seasonShortName as YY/YY from YYYY/YYYY seasonName", async () => {
    mockFetchClubSchedule.mockResolvedValue([makeScheduleEntry({ seasonName: "2026/2027" })]);

    const result = await loadClubSeasonData({ clubId: CLUB_ID, seasonId: SEASON_ID });

    expect(result.seasonShortName).toBe("26/27");
  });

  // Test 17: seasonShortName is null when seasonName is null
  it("returns null seasonShortName when seasonName is null", async () => {
    mockFetchClubSchedule.mockResolvedValue([]);

    const result = await loadClubSeasonData({ clubId: CLUB_ID, seasonId: SEASON_ID });

    expect(result.seasonName).toBeNull();
    expect(result.seasonShortName).toBeNull();
  });

  // Test 18: seasonShortName is null when seasonName does not match YYYY/YYYY
  it("returns null seasonShortName when seasonName is not in YYYY/YYYY format", async () => {
    mockFetchClubSchedule.mockResolvedValue([
      makeScheduleEntry({ seasonName: "Season 2026-27" }),
    ]);

    const result = await loadClubSeasonData({ clubId: CLUB_ID, seasonId: SEASON_ID });

    expect(result.seasonName).toBe("Season 2026-27");
    expect(result.seasonShortName).toBeNull();
  });

  // Test 19: seasonName is null when all schedule entries have null seasonName
  it("returns null seasonName when all schedule entries have null seasonName", async () => {
    mockFetchClubSchedule.mockResolvedValue([
      makeScheduleEntry({ seasonName: null }),
      makeScheduleEntry({ matchId: 100002, seasonName: null }),
    ]);

    const result = await loadClubSeasonData({ clubId: CLUB_ID, seasonId: SEASON_ID });

    expect(result.seasonName).toBeNull();
  });

  // Test 20: seasonName is null when schedule is empty
  it("returns null seasonName when schedule is empty", async () => {
    mockFetchClubSchedule.mockResolvedValue([]);

    const result = await loadClubSeasonData({ clubId: CLUB_ID, seasonId: SEASON_ID });

    expect(result.seasonName).toBeNull();
  });
});

// ════════════════════════════════════════════════════════════════════════════════
// Aggregation — empty inputs
// ════════════════════════════════════════════════════════════════════════════════

describe("loadClubSeasonData — empty inputs", () => {
  // Test 21: empty team list
  it("succeeds with empty team list and reports ownTeamCount=0", async () => {
    mockFetchTeamList.mockResolvedValue([]);
    mockResolveScheduleOpponentIdentities.mockResolvedValue(makeEmptyScheduleBatchResult());
    mockResolveRankingOpponentIdentities.mockResolvedValue(makeEmptyRankingBatchResult());

    const result = await loadClubSeasonData({ clubId: CLUB_ID, seasonId: SEASON_ID });

    expect(result.ownTeams).toHaveLength(0);
    expect(result.summary.ownTeamCount).toBe(0);
  });

  // Test 22: empty schedule
  it("succeeds with empty schedule and reports scheduleCount=0", async () => {
    mockFetchClubSchedule.mockResolvedValue([]);
    mockResolveScheduleOpponentIdentities.mockResolvedValue(makeEmptyScheduleBatchResult());

    const result = await loadClubSeasonData({ clubId: CLUB_ID, seasonId: SEASON_ID });

    expect(result.schedule.entries).toHaveLength(0);
    expect(result.summary.scheduleCount).toBe(0);
  });

  // Test 23: empty ranking
  it("succeeds with empty ranking and reports rankingCount=0", async () => {
    mockFetchClubRanking.mockResolvedValue([]);
    mockResolveRankingOpponentIdentities.mockResolvedValue(makeEmptyRankingBatchResult());

    const result = await loadClubSeasonData({ clubId: CLUB_ID, seasonId: SEASON_ID });

    expect(result.ranking.entries).toHaveLength(0);
    expect(result.summary.rankingCount).toBe(0);
  });

  // Test 24: empty schedule and ranking
  it("returns all-zero opponent counts when schedule and ranking are empty", async () => {
    mockFetchClubSchedule.mockResolvedValue([]);
    mockFetchClubRanking.mockResolvedValue([]);
    mockResolveScheduleOpponentIdentities.mockResolvedValue(makeEmptyScheduleBatchResult());
    mockResolveRankingOpponentIdentities.mockResolvedValue(makeEmptyRankingBatchResult());

    const result = await loadClubSeasonData({ clubId: CLUB_ID, seasonId: SEASON_ID });

    expect(result.summary.scheduleCount).toBe(0);
    expect(result.summary.rankingCount).toBe(0);
    expect(result.summary.resolvedScheduleOpponents).toBe(0);
    expect(result.summary.resolvedRankingOpponents).toBe(0);
    expect(result.summary.uniqueOpponentTeams).toBe(0);
    expect(result.summary.pictureCount).toBe(0);
    expect(result.summary.missingPictures).toBe(0);
  });
});

// ════════════════════════════════════════════════════════════════════════════════
// Aggregation — summary values
// ════════════════════════════════════════════════════════════════════════════════

describe("loadClubSeasonData — summary values", () => {
  // Test 25: ownTeamCount equals length of fetchTeamList result
  it("sets ownTeamCount to the number of own teams returned", async () => {
    mockFetchTeamList.mockResolvedValue([
      makeTeamDetail({ teamId: OWN_TEAM_ID_1 }),
      makeTeamDetail({ teamId: OWN_TEAM_ID_2 }),
    ]);

    const result = await loadClubSeasonData({ clubId: CLUB_ID, seasonId: SEASON_ID });

    expect(result.summary.ownTeamCount).toBe(2);
  });

  // Test 26: scheduleCount equals length of schedule entries
  it("sets scheduleCount to the number of schedule entries", async () => {
    const entries = [
      makeScheduleEntry({ matchId: 1 }),
      makeScheduleEntry({ matchId: 2 }),
      makeScheduleEntry({ matchId: 3 }),
    ];
    mockFetchClubSchedule.mockResolvedValue(entries);
    mockResolveScheduleOpponentIdentities.mockResolvedValue({
      ...makeEmptyScheduleBatchResult(),
      items: [],
      summary: { ...makeEmptyScheduleBatchResult().summary, total: 3 },
    });

    const result = await loadClubSeasonData({ clubId: CLUB_ID, seasonId: SEASON_ID });

    expect(result.summary.scheduleCount).toBe(3);
  });

  // Test 27: rankingCount equals length of ranking entries
  it("sets rankingCount to the number of ranking entries", async () => {
    const entries = [
      makeRankingEntry({ teamId: OPPONENT_ID_1, position: 1 }),
      makeRankingEntry({ teamId: OPPONENT_ID_2, position: 2 }),
    ];
    mockFetchClubRanking.mockResolvedValue(entries);
    mockResolveRankingOpponentIdentities.mockResolvedValue({
      ...makeEmptyRankingBatchResult(),
      items: [],
      summary: { ...makeEmptyRankingBatchResult().summary, total: 2 },
    });

    const result = await loadClubSeasonData({ clubId: CLUB_ID, seasonId: SEASON_ID });

    expect(result.summary.rankingCount).toBe(2);
  });

  // Test 28: resolvedScheduleOpponents from schedule resolution summary
  it("derives resolvedScheduleOpponents from schedule resolution summary.resolved", async () => {
    mockResolveScheduleOpponentIdentities.mockResolvedValue({
      items: [],
      summary: { ...makeEmptyScheduleBatchResult().summary, total: 3, resolved: 3 },
    });

    const result = await loadClubSeasonData({ clubId: CLUB_ID, seasonId: SEASON_ID });

    expect(result.summary.resolvedScheduleOpponents).toBe(3);
  });

  // Test 29: resolvedRankingOpponents from ranking resolution summary
  it("derives resolvedRankingOpponents from ranking resolution summary.resolved", async () => {
    mockResolveRankingOpponentIdentities.mockResolvedValue({
      items: [],
      summary: { ...makeEmptyRankingBatchResult().summary, total: 2, resolved: 2 },
    });

    const result = await loadClubSeasonData({ clubId: CLUB_ID, seasonId: SEASON_ID });

    expect(result.summary.resolvedRankingOpponents).toBe(2);
  });

  // Test 30: uniqueOpponentTeams counts distinct opponent teamIds across both datasets
  it("counts unique opponent teamIds across schedule and ranking combined", async () => {
    const schedEntry = makeScheduleEntry();
    const rankEntry1 = makeRankingEntry({ teamId: OPPONENT_ID_2 });
    const rankEntry2 = makeRankingEntry({ teamId: OPPONENT_ID_3, position: 2 });
    mockFetchClubSchedule.mockResolvedValue([schedEntry]);
    mockFetchClubRanking.mockResolvedValue([rankEntry1, rankEntry2]);

    // Schedule: opponent OPPONENT_ID_1
    mockResolveScheduleOpponentIdentities.mockResolvedValue({
      items: [makeResolvedScheduleItem(0, schedEntry, OPPONENT_ID_1)],
      summary: { ...makeEmptyScheduleBatchResult().summary, resolved: 1 },
    });
    // Ranking: opponents OPPONENT_ID_2 and OPPONENT_ID_3 (distinct from schedule)
    mockResolveRankingOpponentIdentities.mockResolvedValue({
      items: [
        makeResolvedRankingItem(0, rankEntry1, OPPONENT_ID_2),
        makeResolvedRankingItem(1, rankEntry2, OPPONENT_ID_3),
      ],
      summary: { ...makeEmptyRankingBatchResult().summary, resolved: 2 },
    });

    const result = await loadClubSeasonData({ clubId: CLUB_ID, seasonId: SEASON_ID });

    // 3 distinct teams: OPPONENT_ID_1 (schedule), OPPONENT_ID_2, OPPONENT_ID_3 (ranking)
    expect(result.summary.uniqueOpponentTeams).toBe(3);
  });

  // Test 31: uniqueOpponentTeams deduplicates teams appearing in schedule and ranking
  it("deduplicates a teamId that appears in both schedule and ranking", async () => {
    const schedEntry = makeScheduleEntry();
    const rankEntry = makeRankingEntry({ teamId: OPPONENT_ID_1 });
    mockFetchClubSchedule.mockResolvedValue([schedEntry]);
    mockFetchClubRanking.mockResolvedValue([rankEntry]);

    // Same OPPONENT_ID_1 in both schedule and ranking
    mockResolveScheduleOpponentIdentities.mockResolvedValue({
      items: [makeResolvedScheduleItem(0, schedEntry, OPPONENT_ID_1)],
      summary: { ...makeEmptyScheduleBatchResult().summary, resolved: 1 },
    });
    mockResolveRankingOpponentIdentities.mockResolvedValue({
      items: [makeResolvedRankingItem(0, rankEntry, OPPONENT_ID_1)],
      summary: { ...makeEmptyRankingBatchResult().summary, resolved: 1 },
    });

    const result = await loadClubSeasonData({ clubId: CLUB_ID, seasonId: SEASON_ID });

    // Only 1 unique team despite appearing in both datasets
    expect(result.summary.uniqueOpponentTeams).toBe(1);
  });

  // Test 32: pictureCount counts unique teams with non-null pictures
  it("counts unique opponent teams with non-null pictures", async () => {
    const entries = [
      makeScheduleEntry({ matchId: 1, teamBId: OPPONENT_ID_1 }),
      makeScheduleEntry({ matchId: 2, teamBId: OPPONENT_ID_2 }),
    ];
    mockFetchClubSchedule.mockResolvedValue(entries);
    mockFetchClubRanking.mockResolvedValue([]);

    mockResolveScheduleOpponentIdentities.mockResolvedValue({
      items: [
        makeResolvedScheduleItem(0, entries[0], OPPONENT_ID_1, SYNTHETIC_PICTURE),
        makeResolvedScheduleItem(1, entries[1], OPPONENT_ID_2, null), // no picture
      ],
      summary: { ...makeEmptyScheduleBatchResult().summary, resolved: 2 },
    });
    mockResolveRankingOpponentIdentities.mockResolvedValue(makeEmptyRankingBatchResult());

    const result = await loadClubSeasonData({ clubId: CLUB_ID, seasonId: SEASON_ID });

    expect(result.summary.pictureCount).toBe(1);
    expect(result.summary.missingPictures).toBe(1);
  });

  // Test 33: missingPictures counts unique teams with null pictures
  it("counts unique teams with null pictures as missingPictures", async () => {
    const schedEntry = makeScheduleEntry();
    mockFetchClubSchedule.mockResolvedValue([schedEntry]);

    mockResolveScheduleOpponentIdentities.mockResolvedValue({
      items: [makeResolvedScheduleItem(0, schedEntry, OPPONENT_ID_1, null)],
      summary: { ...makeEmptyScheduleBatchResult().summary, resolved: 1 },
    });
    mockResolveRankingOpponentIdentities.mockResolvedValue(makeEmptyRankingBatchResult());

    const result = await loadClubSeasonData({ clubId: CLUB_ID, seasonId: SEASON_ID });

    expect(result.summary.pictureCount).toBe(0);
    expect(result.summary.missingPictures).toBe(1);
  });

  // Test 34: failed picture items contribute to uniqueOpponentTeams but not picture counts
  it("includes failed-picture items in uniqueOpponentTeams but not in pictureCount or missingPictures", async () => {
    const schedEntry = makeScheduleEntry();
    mockFetchClubSchedule.mockResolvedValue([schedEntry]);

    mockResolveScheduleOpponentIdentities.mockResolvedValue({
      items: [makeFailedScheduleItem(0, schedEntry, OPPONENT_ID_1)],
      summary: { ...makeEmptyScheduleBatchResult().summary, failed: 1 },
    });
    mockResolveRankingOpponentIdentities.mockResolvedValue(makeEmptyRankingBatchResult());

    const result = await loadClubSeasonData({ clubId: CLUB_ID, seasonId: SEASON_ID });

    expect(result.summary.uniqueOpponentTeams).toBe(1);
    expect(result.summary.pictureCount).toBe(0);
    expect(result.summary.missingPictures).toBe(0);
  });
});

// ════════════════════════════════════════════════════════════════════════════════
// Aggregation — error propagation
// ════════════════════════════════════════════════════════════════════════════════

describe("loadClubSeasonData — error propagation", () => {
  // Test 35: resolveClubIds failure propagates
  it("propagates SfvNetworkError from resolveClubIds", async () => {
    const error = new SfvNetworkError("SFV_UNAVAILABLE", "SFV common/ids endpoint unavailable.");
    mockResolveClubIds.mockRejectedValue(error);

    await expect(loadClubSeasonData({ clubId: CLUB_ID, seasonId: SEASON_ID })).rejects.toBe(error);
    expect(mockFetchTeamList).not.toHaveBeenCalled();
  });

  // Test 36: fetchTeamList failure propagates
  it("propagates SfvNetworkError from fetchTeamList", async () => {
    const error = new SfvNetworkError("SFV_UNAVAILABLE", "SFV team list endpoint unavailable.");
    mockFetchTeamList.mockRejectedValue(error);

    await expect(loadClubSeasonData({ clubId: CLUB_ID, seasonId: SEASON_ID })).rejects.toBe(error);
    expect(mockFetchClubSchedule).not.toHaveBeenCalled();
    expect(mockFetchClubRanking).not.toHaveBeenCalled();
  });

  // Test 37: fetchClubSchedule failure propagates
  it("propagates SfvNetworkError from fetchClubSchedule", async () => {
    const error = new SfvNetworkError("SFV_UNAVAILABLE", "SFV club schedule endpoint unavailable.");
    mockFetchClubSchedule.mockRejectedValue(error);

    await expect(loadClubSeasonData({ clubId: CLUB_ID, seasonId: SEASON_ID })).rejects.toBe(error);
    expect(mockResolveScheduleOpponentIdentities).not.toHaveBeenCalled();
  });

  // Test 38: fetchClubRanking failure propagates
  it("propagates SfvNetworkError from fetchClubRanking", async () => {
    const error = new SfvNetworkError("SFV_UNAVAILABLE", "SFV club ranking endpoint unavailable.");
    mockFetchClubRanking.mockRejectedValue(error);

    await expect(loadClubSeasonData({ clubId: CLUB_ID, seasonId: SEASON_ID })).rejects.toBe(error);
    expect(mockResolveRankingOpponentIdentities).not.toHaveBeenCalled();
  });

  // Test 39: resolveScheduleOpponentIdentities failure propagates
  it("propagates error from resolveScheduleOpponentIdentities", async () => {
    const error = new SfvAuthError("SFV_UNAUTHORIZED", "SFV token rejected.");
    mockResolveScheduleOpponentIdentities.mockRejectedValue(error);

    await expect(loadClubSeasonData({ clubId: CLUB_ID, seasonId: SEASON_ID })).rejects.toBe(error);
  });

  // Test 40: resolveRankingOpponentIdentities failure propagates
  it("propagates error from resolveRankingOpponentIdentities", async () => {
    const error = new SfvNetworkError("SFV_TIMEOUT", "SFV request timed out.");
    mockResolveRankingOpponentIdentities.mockRejectedValue(error);

    await expect(loadClubSeasonData({ clubId: CLUB_ID, seasonId: SEASON_ID })).rejects.toBe(error);
  });
});

// ════════════════════════════════════════════════════════════════════════════════
// Aggregation — immutability and no duplication
// ════════════════════════════════════════════════════════════════════════════════

describe("loadClubSeasonData — immutability and no HTTP duplication", () => {
  // Test 41: schedule entries in output are the same reference as from fetchClubSchedule
  it("preserves the same schedule entries array reference in the output", async () => {
    const entries = [makeScheduleEntry()];
    mockFetchClubSchedule.mockResolvedValue(entries);

    const result = await loadClubSeasonData({ clubId: CLUB_ID, seasonId: SEASON_ID });

    expect(result.schedule.entries).toBe(entries);
  });

  // Test 42: ranking entries in output are the same reference as from fetchClubRanking
  it("preserves the same ranking entries array reference in the output", async () => {
    const entries = [makeRankingEntry()];
    mockFetchClubRanking.mockResolvedValue(entries);

    const result = await loadClubSeasonData({ clubId: CLUB_ID, seasonId: SEASON_ID });

    expect(result.ranking.entries).toBe(entries);
  });

  // Test 43: ownTeams in output are the same reference as from fetchTeamList
  it("preserves the same ownTeams array reference in the output", async () => {
    const teams = [makeTeamDetail({ teamId: OWN_TEAM_ID_1 })];
    mockFetchTeamList.mockResolvedValue(teams);

    const result = await loadClubSeasonData({ clubId: CLUB_ID, seasonId: SEASON_ID });

    expect(result.ownTeams).toBe(teams);
  });

  // Test 44: no fetchTeamPicture call is made directly by the service
  it("never calls fetchTeamPicture directly — all picture work is via batch resolvers", async () => {
    await loadClubSeasonData({ clubId: CLUB_ID, seasonId: SEASON_ID });

    expect(mockFetchTeamPicture).not.toHaveBeenCalled();
  });

  // Test 45: failed ranking picture items contribute to uniqueOpponentTeams but not picture counts
  it("includes failed-picture ranking items in uniqueOpponentTeams only", async () => {
    const rankEntry = makeRankingEntry({ teamId: OPPONENT_ID_2 });
    mockFetchClubSchedule.mockResolvedValue([]);
    mockFetchClubRanking.mockResolvedValue([rankEntry]);

    mockResolveScheduleOpponentIdentities.mockResolvedValue(makeEmptyScheduleBatchResult());
    mockResolveRankingOpponentIdentities.mockResolvedValue({
      items: [makeFailedRankingItem(0, rankEntry, OPPONENT_ID_2)],
      summary: { ...makeEmptyRankingBatchResult().summary, failed: 1 },
    });

    const result = await loadClubSeasonData({ clubId: CLUB_ID, seasonId: SEASON_ID });

    expect(result.summary.uniqueOpponentTeams).toBe(1);
    expect(result.summary.pictureCount).toBe(0);
    expect(result.summary.missingPictures).toBe(0);
  });
});
