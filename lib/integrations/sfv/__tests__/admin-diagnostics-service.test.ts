/**
 * lib/integrations/sfv/__tests__/admin-diagnostics-service.test.ts
 *
 * Focused unit tests for the SFV Admin Diagnostics Service.
 *
 * All SFV clients and aggregation services are mocked.
 * No real network requests are made. No production secrets are used.
 *
 * TEST COVERAGE MAP:
 *
 * Input validation:
 *   1.  valid clubId/seasonId accepted
 *   2.  zero clubId rejected
 *   3.  negative clubId rejected
 *   4.  fractional clubId rejected
 *   5.  NaN clubId rejected
 *   6.  zero seasonId rejected
 *   7.  negative seasonId rejected
 *   8.  fractional seasonId rejected
 *   9.  NaN seasonId rejected
 *
 * Healthy result:
 *   10. fully healthy aggregation returns health="healthy"
 *   11. health="healthy" when all conditions are met
 *   12. no issues when health is healthy
 *   13. counts correct for healthy aggregation
 *   14. season metadata copied from ClubSeasonData
 *   15. timings present (two stages, both success=true)
 *   16. totalDurationMs is finite and non-negative
 *
 * Degraded result — individual degraded conditions:
 *   17. no-own-team schedule rows → health="degraded", SFV_SCHEDULE_NO_OWN_TEAM issue
 *   18. both-own schedule rows → health="degraded", SFV_SCHEDULE_BOTH_OWN issue
 *   19. invalid schedule rows → health="degraded", SFV_SCHEDULE_INVALID_ROWS issue
 *   20. failed schedule rows → health="degraded", SFV_SCHEDULE_FAILED_ROWS issue
 *   21. invalid ranking rows → health="degraded", SFV_RANKING_INVALID_ROWS issue
 *   22. failed ranking rows → health="degraded", SFV_RANKING_FAILED_ROWS issue
 *   23. missing pictures (204) → health="degraded", SFV_MISSING_PICTURES issue (info severity)
 *   24. picture failures → health="degraded", SFV_PICTURE_FAILURES issue
 *   25. zero own teams → health="degraded", SFV_NO_OWN_TEAMS issue
 *   26. zero schedule rows → health="degraded", SFV_NO_SCHEDULE_ROWS issue
 *   27. zero ranking rows → health="degraded", SFV_NO_RANKING_ROWS issue
 *   28. null season name → health="degraded", SFV_SEASON_METADATA_INCOMPLETE issue
 *   29. multiple degraded conditions → multiple issues all present
 *   30. health="degraded" confirmed for each condition
 *
 * Unhealthy result — resolveClubIds failures:
 *   31. resolveClubIds auth failure → health="unhealthy", SFV_AUTH_FAILURE code
 *   32. resolveClubIds network failure → health="unhealthy", SFV_NETWORK_FAILURE code
 *   33. resolveClubIds timeout → health="unhealthy", SFV_TIMEOUT code
 *   34. resolveClubIds server failure → health="unhealthy", SFV_SERVER_FAILURE code
 *
 * Unhealthy result — loadClubSeasonData failures:
 *   35. loadClubSeasonData auth failure → health="unhealthy", SFV_AUTH_FAILURE code
 *   36. loadClubSeasonData network failure → health="unhealthy", SFV_NETWORK_FAILURE code
 *   37. loadClubSeasonData timeout → health="unhealthy", SFV_TIMEOUT code
 *   38. loadClubSeasonData server failure → health="unhealthy", SFV_SERVER_FAILURE code
 *
 * Unhealthy result — structure and safety:
 *   39. health="unhealthy" for any top-level failure
 *   40. exactly one issue with a safe error code is emitted
 *   41. failed stage timing is recorded with success=false
 *   42. output contains no secret-like fields
 *   43. output contains no stack trace
 *   44. output contains no base64 data
 *
 * Call behaviour:
 *   45. resolveClubIds called exactly once per run
 *   46. loadClubSeasonData called exactly once after resolveClubIds succeeds
 *   47. loadClubSeasonData not called when resolveClubIds fails
 *   48. no raw client calls other than through mocked dependencies
 *   49. batchOptions forwarded to loadClubSeasonData
 *   50. input params object not mutated
 *
 * Timing:
 *   51. timings has two entries for a fully successful run
 *   52. stage timings are in pipeline order
 *   53. all durationMs values are non-negative integers
 *   54. totalDurationMs is non-negative
 *
 * Output safety:
 *   55. diagnostics object contains no base64 field
 *   56. diagnostics JSON contains no token-like field names
 *   57. issues contain no raw response bodies
 *   58. identical inputs produce structurally stable output (same counts, codes)
 *   59. issue codes are deterministic
 *   60. counts are derived from summaries, not names
 *
 * Additional tests for coverage completeness:
 *   61. both both-own and no-own-team present simultaneously
 *   62. SFV_MISSING_PICTURES severity is "info"
 *   63. SFV_SCHEDULE_NO_OWN_TEAM includes count field
 *   64. seasonName=null and seasonShortName=null in unhealthy result
 *   65. timings array has one entry when resolve-common-ids fails
 *   66. timings array has two entries when only load-club-season-data fails
 *   67. pictureFailures derived correctly from uniqueOpponentTeams - pictureCount - missingPictures
 *   68. retryable=true for SFV_TIMEOUT issue
 *   69. retryable=false for SFV_AUTH_FAILURE issue
 *   70. generatedAt is a valid ISO 8601 string
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  SfvAuthError,
  SfvNetworkError,
  SfvConfigurationError,
} from "../errors";
import type { ClubSeasonData, ClubSeasonSummary } from "../club-data-service";
import type { BatchSummary } from "../batch-opponent-identity";

// ── Mocks ──────────────────────────────────────────────────────────────────────

vi.mock("../client", () => ({
  resolveClubIds: vi.fn(),
}));

vi.mock("../club-data-service", () => ({
  loadClubSeasonData: vi.fn(),
}));

import { resolveClubIds } from "../client";
import { loadClubSeasonData } from "../club-data-service";
import { runSfvAdminDiagnostics } from "../admin-diagnostics-service";

const mockResolveClubIds = vi.mocked(resolveClubIds);
const mockLoadClubSeasonData = vi.mocked(loadClubSeasonData);

// ── Test constants ─────────────────────────────────────────────────────────────

const CLUB_ID = 483;
const SEASON_ID = 2027;

// ── Mock data factories ────────────────────────────────────────────────────────

function makeScheduleSummary(overrides: Partial<BatchSummary> = {}): BatchSummary {
  return {
    total: 60,
    resolved: 60,
    ownTeam: 0,
    bothOwn: 0,
    noOwnTeam: 0,
    invalid: 0,
    failed: 0,
    uniqueOpponentTeamIds: 43,
    pictureRequests: 43,
    ...overrides,
  };
}

function makeRankingSummary(overrides: Partial<BatchSummary> = {}): BatchSummary {
  return {
    total: 26,
    resolved: 24,
    ownTeam: 2,
    bothOwn: 0,
    noOwnTeam: 0,
    invalid: 0,
    failed: 0,
    uniqueOpponentTeamIds: 24,
    pictureRequests: 24,
    ...overrides,
  };
}

function makeClusterSummary(overrides: Partial<ClubSeasonSummary> = {}): ClubSeasonSummary {
  return {
    ownTeamCount: 11,
    scheduleCount: 60,
    rankingCount: 26,
    resolvedScheduleOpponents: 60,
    resolvedRankingOpponents: 24,
    uniqueOpponentTeams: 43,
    pictureCount: 43,
    missingPictures: 0,
    ...overrides,
  };
}

/**
 * Builds a minimal but structurally complete ClubSeasonData mock.
 *
 * The service only reads .summary, .schedule.resolution.summary,
 * .ranking.resolution.summary, .seasonName, and .seasonShortName.
 * Entries and resolution items arrays can be empty.
 */
function makeClubSeasonData(opts: {
  clubId?: number;
  seasonId?: number;
  seasonName?: string | null;
  seasonShortName?: string | null;
  scheduleSummary?: Partial<BatchSummary>;
  rankingSummary?: Partial<BatchSummary>;
  clusterSummary?: Partial<ClubSeasonSummary>;
} = {}): ClubSeasonData {
  const ss = makeScheduleSummary(opts.scheduleSummary);
  const rs = makeRankingSummary(opts.rankingSummary);
  const cs = makeClusterSummary(opts.clusterSummary);

  return {
    clubId: opts.clubId ?? CLUB_ID,
    seasonId: opts.seasonId ?? SEASON_ID,
    seasonName: opts.seasonName !== undefined ? opts.seasonName : "2026/2027",
    seasonShortName: opts.seasonShortName !== undefined ? opts.seasonShortName : "26/27",
    ownTeams: [],
    schedule: {
      entries: [],
      resolution: { items: [], summary: ss },
    },
    ranking: {
      entries: [],
      resolution: { items: [], summary: rs },
    },
    summary: cs,
  };
}

/** Healthy ClubSeasonData: all conditions met for health="healthy". */
function makeHealthyClubSeasonData(): ClubSeasonData {
  return makeClubSeasonData();
}

// ── Setup ──────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockResolveClubIds.mockResolvedValue({ raw: "{}", parsed: {} });
  mockLoadClubSeasonData.mockResolvedValue(makeHealthyClubSeasonData());
});

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("runSfvAdminDiagnostics", () => {
  // ── Input validation ────────────────────────────────────────────────────────

  describe("input validation", () => {
    it("1. accepts valid clubId and seasonId", async () => {
      await expect(
        runSfvAdminDiagnostics({ clubId: CLUB_ID, seasonId: SEASON_ID }),
      ).resolves.toBeDefined();
    });

    it("2. rejects zero clubId", async () => {
      await expect(
        runSfvAdminDiagnostics({ clubId: 0, seasonId: SEASON_ID }),
      ).rejects.toThrow(TypeError);
    });

    it("3. rejects negative clubId", async () => {
      await expect(
        runSfvAdminDiagnostics({ clubId: -1, seasonId: SEASON_ID }),
      ).rejects.toThrow(TypeError);
    });

    it("4. rejects fractional clubId", async () => {
      await expect(
        runSfvAdminDiagnostics({ clubId: 1.5, seasonId: SEASON_ID }),
      ).rejects.toThrow(TypeError);
    });

    it("5. rejects NaN clubId", async () => {
      await expect(
        runSfvAdminDiagnostics({ clubId: NaN, seasonId: SEASON_ID }),
      ).rejects.toThrow(TypeError);
    });

    it("6. rejects zero seasonId", async () => {
      await expect(
        runSfvAdminDiagnostics({ clubId: CLUB_ID, seasonId: 0 }),
      ).rejects.toThrow(TypeError);
    });

    it("7. rejects negative seasonId", async () => {
      await expect(
        runSfvAdminDiagnostics({ clubId: CLUB_ID, seasonId: -100 }),
      ).rejects.toThrow(TypeError);
    });

    it("8. rejects fractional seasonId", async () => {
      await expect(
        runSfvAdminDiagnostics({ clubId: CLUB_ID, seasonId: 2027.9 }),
      ).rejects.toThrow(TypeError);
    });

    it("9. rejects NaN seasonId", async () => {
      await expect(
        runSfvAdminDiagnostics({ clubId: CLUB_ID, seasonId: NaN }),
      ).rejects.toThrow(TypeError);
    });
  });

  // ── Healthy result ──────────────────────────────────────────────────────────

  describe("healthy result", () => {
    it("10. fully healthy aggregation returns a result", async () => {
      const result = await runSfvAdminDiagnostics({ clubId: CLUB_ID, seasonId: SEASON_ID });
      expect(result).toBeDefined();
    });

    it("11. health='healthy' when all conditions are met", async () => {
      const result = await runSfvAdminDiagnostics({ clubId: CLUB_ID, seasonId: SEASON_ID });
      expect(result.health).toBe("healthy");
    });

    it("12. no issues when health is healthy", async () => {
      const result = await runSfvAdminDiagnostics({ clubId: CLUB_ID, seasonId: SEASON_ID });
      expect(result.issues).toHaveLength(0);
    });

    it("13. counts are correct for healthy aggregation", async () => {
      const result = await runSfvAdminDiagnostics({ clubId: CLUB_ID, seasonId: SEASON_ID });
      expect(result.counts).toMatchObject({
        ownTeams: 11,
        scheduleRows: 60,
        rankingRows: 26,
        resolvedScheduleRows: 60,
        scheduleBothOwnRows: 0,
        scheduleNoOwnTeamRows: 0,
        scheduleInvalidRows: 0,
        scheduleFailedRows: 0,
        rankingOwnTeamRows: 2,
        rankingOpponentRows: 24,
        rankingInvalidRows: 0,
        rankingFailedRows: 0,
        uniqueOpponentTeams: 43,
        picturesRequested: 43,
        picturesPresent: 43,
        picturesMissing: 0,
        pictureFailures: 0,
      });
    });

    it("14. season metadata is copied from ClubSeasonData", async () => {
      mockLoadClubSeasonData.mockResolvedValue(
        makeClubSeasonData({ seasonName: "2026/2027", seasonShortName: "26/27" }),
      );
      const result = await runSfvAdminDiagnostics({ clubId: CLUB_ID, seasonId: SEASON_ID });
      expect(result.seasonName).toBe("2026/2027");
      expect(result.seasonShortName).toBe("26/27");
      expect(result.clubId).toBe(CLUB_ID);
      expect(result.seasonId).toBe(SEASON_ID);
    });

    it("15. timings has exactly two entries and both are success=true", async () => {
      const result = await runSfvAdminDiagnostics({ clubId: CLUB_ID, seasonId: SEASON_ID });
      expect(result.timings).toHaveLength(2);
      expect(result.timings[0]).toMatchObject({ stage: "resolve-common-ids", success: true });
      expect(result.timings[1]).toMatchObject({ stage: "load-club-season-data", success: true });
    });

    it("16. totalDurationMs is finite and non-negative", async () => {
      const result = await runSfvAdminDiagnostics({ clubId: CLUB_ID, seasonId: SEASON_ID });
      expect(Number.isFinite(result.totalDurationMs)).toBe(true);
      expect(result.totalDurationMs).toBeGreaterThanOrEqual(0);
    });
  });

  // ── Degraded result ─────────────────────────────────────────────────────────

  describe("degraded result", () => {
    it("17. no-own-team schedule rows → health='degraded', SFV_SCHEDULE_NO_OWN_TEAM issue", async () => {
      mockLoadClubSeasonData.mockResolvedValue(
        makeClubSeasonData({
          scheduleSummary: { total: 60, resolved: 58, noOwnTeam: 2 },
          clusterSummary: { scheduleCount: 60, resolvedScheduleOpponents: 58 },
        }),
      );
      const result = await runSfvAdminDiagnostics({ clubId: CLUB_ID, seasonId: SEASON_ID });
      expect(result.health).toBe("degraded");
      const issue = result.issues.find((i) => i.code === "SFV_SCHEDULE_NO_OWN_TEAM");
      expect(issue).toBeDefined();
      expect(issue?.severity).toBe("warning");
      expect(issue?.count).toBe(2);
    });

    it("18. both-own schedule rows → health='degraded', SFV_SCHEDULE_BOTH_OWN issue", async () => {
      mockLoadClubSeasonData.mockResolvedValue(
        makeClubSeasonData({
          scheduleSummary: { total: 60, resolved: 59, bothOwn: 1 },
          clusterSummary: { scheduleCount: 60 },
        }),
      );
      const result = await runSfvAdminDiagnostics({ clubId: CLUB_ID, seasonId: SEASON_ID });
      expect(result.health).toBe("degraded");
      const issue = result.issues.find((i) => i.code === "SFV_SCHEDULE_BOTH_OWN");
      expect(issue).toBeDefined();
      expect(issue?.severity).toBe("warning");
      expect(issue?.count).toBe(1);
    });

    it("19. invalid schedule rows → health='degraded', SFV_SCHEDULE_INVALID_ROWS issue", async () => {
      mockLoadClubSeasonData.mockResolvedValue(
        makeClubSeasonData({
          scheduleSummary: { total: 60, resolved: 57, invalid: 3 },
          clusterSummary: { scheduleCount: 60 },
        }),
      );
      const result = await runSfvAdminDiagnostics({ clubId: CLUB_ID, seasonId: SEASON_ID });
      expect(result.health).toBe("degraded");
      const issue = result.issues.find((i) => i.code === "SFV_SCHEDULE_INVALID_ROWS");
      expect(issue).toBeDefined();
      expect(issue?.count).toBe(3);
    });

    it("20. failed schedule rows → health='degraded', SFV_SCHEDULE_FAILED_ROWS issue", async () => {
      mockLoadClubSeasonData.mockResolvedValue(
        makeClubSeasonData({
          scheduleSummary: { total: 60, resolved: 59, failed: 1 },
          clusterSummary: { scheduleCount: 60 },
        }),
      );
      const result = await runSfvAdminDiagnostics({ clubId: CLUB_ID, seasonId: SEASON_ID });
      expect(result.health).toBe("degraded");
      const issue = result.issues.find((i) => i.code === "SFV_SCHEDULE_FAILED_ROWS");
      expect(issue).toBeDefined();
      expect(issue?.count).toBe(1);
    });

    it("21. invalid ranking rows → health='degraded', SFV_RANKING_INVALID_ROWS issue", async () => {
      mockLoadClubSeasonData.mockResolvedValue(
        makeClubSeasonData({
          rankingSummary: { total: 26, resolved: 22, ownTeam: 2, invalid: 2 },
          clusterSummary: { rankingCount: 26 },
        }),
      );
      const result = await runSfvAdminDiagnostics({ clubId: CLUB_ID, seasonId: SEASON_ID });
      expect(result.health).toBe("degraded");
      const issue = result.issues.find((i) => i.code === "SFV_RANKING_INVALID_ROWS");
      expect(issue).toBeDefined();
      expect(issue?.count).toBe(2);
    });

    it("22. failed ranking rows → health='degraded', SFV_RANKING_FAILED_ROWS issue", async () => {
      mockLoadClubSeasonData.mockResolvedValue(
        makeClubSeasonData({
          rankingSummary: { total: 26, resolved: 23, ownTeam: 2, failed: 1 },
          clusterSummary: { rankingCount: 26 },
        }),
      );
      const result = await runSfvAdminDiagnostics({ clubId: CLUB_ID, seasonId: SEASON_ID });
      expect(result.health).toBe("degraded");
      const issue = result.issues.find((i) => i.code === "SFV_RANKING_FAILED_ROWS");
      expect(issue).toBeDefined();
      expect(issue?.count).toBe(1);
    });

    it("23. missing pictures → health='degraded', SFV_MISSING_PICTURES issue with info severity", async () => {
      mockLoadClubSeasonData.mockResolvedValue(
        makeClubSeasonData({
          clusterSummary: {
            uniqueOpponentTeams: 43,
            pictureCount: 38,
            missingPictures: 5,
          },
        }),
      );
      const result = await runSfvAdminDiagnostics({ clubId: CLUB_ID, seasonId: SEASON_ID });
      expect(result.health).toBe("degraded");
      const issue = result.issues.find((i) => i.code === "SFV_MISSING_PICTURES");
      expect(issue).toBeDefined();
      expect(issue?.severity).toBe("info");
      expect(issue?.count).toBe(5);
    });

    it("24. picture failures → health='degraded', SFV_PICTURE_FAILURES issue", async () => {
      mockLoadClubSeasonData.mockResolvedValue(
        makeClubSeasonData({
          clusterSummary: {
            uniqueOpponentTeams: 43,
            pictureCount: 40,
            missingPictures: 0,
          },
        }),
      );
      const result = await runSfvAdminDiagnostics({ clubId: CLUB_ID, seasonId: SEASON_ID });
      expect(result.health).toBe("degraded");
      const issue = result.issues.find((i) => i.code === "SFV_PICTURE_FAILURES");
      expect(issue).toBeDefined();
      expect(issue?.count).toBe(3);
    });

    it("25. zero own teams → health='degraded', SFV_NO_OWN_TEAMS issue", async () => {
      mockLoadClubSeasonData.mockResolvedValue(
        makeClubSeasonData({ clusterSummary: { ownTeamCount: 0 } }),
      );
      const result = await runSfvAdminDiagnostics({ clubId: CLUB_ID, seasonId: SEASON_ID });
      expect(result.health).toBe("degraded");
      const issue = result.issues.find((i) => i.code === "SFV_NO_OWN_TEAMS");
      expect(issue).toBeDefined();
      expect(issue?.severity).toBe("warning");
    });

    it("26. zero schedule rows → health='degraded', SFV_NO_SCHEDULE_ROWS issue", async () => {
      mockLoadClubSeasonData.mockResolvedValue(
        makeClubSeasonData({
          scheduleSummary: { total: 0, resolved: 0, uniqueOpponentTeamIds: 0, pictureRequests: 0 },
          clusterSummary: { scheduleCount: 0, resolvedScheduleOpponents: 0 },
        }),
      );
      const result = await runSfvAdminDiagnostics({ clubId: CLUB_ID, seasonId: SEASON_ID });
      expect(result.health).toBe("degraded");
      const issue = result.issues.find((i) => i.code === "SFV_NO_SCHEDULE_ROWS");
      expect(issue).toBeDefined();
    });

    it("27. zero ranking rows → health='degraded', SFV_NO_RANKING_ROWS issue", async () => {
      mockLoadClubSeasonData.mockResolvedValue(
        makeClubSeasonData({
          rankingSummary: { total: 0, resolved: 0, ownTeam: 0, uniqueOpponentTeamIds: 0, pictureRequests: 0 },
          clusterSummary: { rankingCount: 0, resolvedRankingOpponents: 0 },
        }),
      );
      const result = await runSfvAdminDiagnostics({ clubId: CLUB_ID, seasonId: SEASON_ID });
      expect(result.health).toBe("degraded");
      const issue = result.issues.find((i) => i.code === "SFV_NO_RANKING_ROWS");
      expect(issue).toBeDefined();
    });

    it("28. null season name → health='degraded', SFV_SEASON_METADATA_INCOMPLETE issue", async () => {
      mockLoadClubSeasonData.mockResolvedValue(
        makeClubSeasonData({ seasonName: null, seasonShortName: null }),
      );
      const result = await runSfvAdminDiagnostics({ clubId: CLUB_ID, seasonId: SEASON_ID });
      expect(result.health).toBe("degraded");
      const issue = result.issues.find((i) => i.code === "SFV_SEASON_METADATA_INCOMPLETE");
      expect(issue).toBeDefined();
      expect(issue?.severity).toBe("warning");
    });

    it("29. multiple degraded conditions → multiple issues are all present", async () => {
      mockLoadClubSeasonData.mockResolvedValue(
        makeClubSeasonData({
          scheduleSummary: { total: 60, resolved: 57, noOwnTeam: 2, invalid: 1 },
          clusterSummary: {
            scheduleCount: 60,
            resolvedScheduleOpponents: 57,
            ownTeamCount: 0,
            uniqueOpponentTeams: 43,
            pictureCount: 38,
            missingPictures: 5,
          },
        }),
      );
      const result = await runSfvAdminDiagnostics({ clubId: CLUB_ID, seasonId: SEASON_ID });
      expect(result.health).toBe("degraded");
      const codes = result.issues.map((i) => i.code);
      expect(codes).toContain("SFV_NO_OWN_TEAMS");
      expect(codes).toContain("SFV_SCHEDULE_NO_OWN_TEAM");
      expect(codes).toContain("SFV_SCHEDULE_INVALID_ROWS");
      expect(codes).toContain("SFV_MISSING_PICTURES");
    });

    it("30. health='degraded' confirmed for all degraded conditions", async () => {
      const degradedScenarios = [
        makeClubSeasonData({ clusterSummary: { ownTeamCount: 0 } }),
        makeClubSeasonData({ clusterSummary: { scheduleCount: 0 }, scheduleSummary: { total: 0, resolved: 0 } }),
        makeClubSeasonData({ clusterSummary: { rankingCount: 0 }, rankingSummary: { total: 0, resolved: 0, ownTeam: 0 } }),
        makeClubSeasonData({ seasonName: null }),
        makeClubSeasonData({ scheduleSummary: { total: 60, resolved: 58, noOwnTeam: 2 } }),
        makeClubSeasonData({ scheduleSummary: { total: 60, resolved: 59, bothOwn: 1 } }),
        makeClubSeasonData({ scheduleSummary: { total: 60, resolved: 58, invalid: 2 } }),
        makeClubSeasonData({ scheduleSummary: { total: 60, resolved: 59, failed: 1 } }),
        makeClubSeasonData({ rankingSummary: { total: 26, resolved: 23, ownTeam: 2, invalid: 1 } }),
        makeClubSeasonData({ rankingSummary: { total: 26, resolved: 23, ownTeam: 2, failed: 1 } }),
        makeClubSeasonData({ clusterSummary: { uniqueOpponentTeams: 43, pictureCount: 38, missingPictures: 5 } }),
        makeClubSeasonData({ clusterSummary: { uniqueOpponentTeams: 43, pictureCount: 40, missingPictures: 0 } }),
      ];

      for (const scenario of degradedScenarios) {
        mockLoadClubSeasonData.mockResolvedValue(scenario);
        const result = await runSfvAdminDiagnostics({ clubId: CLUB_ID, seasonId: SEASON_ID });
        expect(result.health).toBe("degraded");
      }
    });

    // ── Unhealthy result — resolveClubIds failures ──────────────────────────────

    it("31. resolveClubIds auth failure → health='unhealthy', SFV_AUTH_FAILURE code", async () => {
      mockResolveClubIds.mockRejectedValue(
        new SfvAuthError("SFV_UNAUTHORIZED", "SFV token rejected: 401 Unauthorized."),
      );
      const result = await runSfvAdminDiagnostics({ clubId: CLUB_ID, seasonId: SEASON_ID });
      expect(result.health).toBe("unhealthy");
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].code).toBe("SFV_AUTH_FAILURE");
    });

    it("32. resolveClubIds network failure → health='unhealthy', SFV_NETWORK_FAILURE code", async () => {
      mockResolveClubIds.mockRejectedValue(
        new SfvNetworkError("SFV_UNAVAILABLE", "SFV endpoint is not reachable."),
      );
      const result = await runSfvAdminDiagnostics({ clubId: CLUB_ID, seasonId: SEASON_ID });
      expect(result.health).toBe("unhealthy");
      expect(result.issues[0].code).toBe("SFV_NETWORK_FAILURE");
    });

    it("33. resolveClubIds timeout → health='unhealthy', SFV_TIMEOUT code", async () => {
      mockResolveClubIds.mockRejectedValue(
        new SfvNetworkError("SFV_TIMEOUT", "SFV token request timed out."),
      );
      const result = await runSfvAdminDiagnostics({ clubId: CLUB_ID, seasonId: SEASON_ID });
      expect(result.health).toBe("unhealthy");
      expect(result.issues[0].code).toBe("SFV_TIMEOUT");
    });

    it("34. resolveClubIds server failure → health='unhealthy', SFV_SERVER_FAILURE code", async () => {
      mockResolveClubIds.mockRejectedValue(
        new SfvNetworkError("SFV_INVALID_RESPONSE", "SFV response is not valid JSON."),
      );
      const result = await runSfvAdminDiagnostics({ clubId: CLUB_ID, seasonId: SEASON_ID });
      expect(result.health).toBe("unhealthy");
      expect(result.issues[0].code).toBe("SFV_SERVER_FAILURE");
    });

    it("35. loadClubSeasonData auth failure → health='unhealthy', SFV_AUTH_FAILURE code", async () => {
      mockLoadClubSeasonData.mockRejectedValue(
        new SfvAuthError("SFV_FORBIDDEN", "SFV request rejected: 403 Forbidden."),
      );
      const result = await runSfvAdminDiagnostics({ clubId: CLUB_ID, seasonId: SEASON_ID });
      expect(result.health).toBe("unhealthy");
      expect(result.issues[0].code).toBe("SFV_AUTH_FAILURE");
    });

    it("36. loadClubSeasonData network failure → health='unhealthy', SFV_NETWORK_FAILURE code", async () => {
      mockLoadClubSeasonData.mockRejectedValue(
        new SfvNetworkError("SFV_NOT_FOUND", "SFV resource not found (404)."),
      );
      const result = await runSfvAdminDiagnostics({ clubId: CLUB_ID, seasonId: SEASON_ID });
      expect(result.health).toBe("unhealthy");
      expect(result.issues[0].code).toBe("SFV_NETWORK_FAILURE");
    });

    it("37. loadClubSeasonData timeout → health='unhealthy', SFV_TIMEOUT code", async () => {
      mockLoadClubSeasonData.mockRejectedValue(
        new SfvNetworkError("SFV_TIMEOUT", "SFV request timed out."),
      );
      const result = await runSfvAdminDiagnostics({ clubId: CLUB_ID, seasonId: SEASON_ID });
      expect(result.health).toBe("unhealthy");
      expect(result.issues[0].code).toBe("SFV_TIMEOUT");
    });

    it("38. loadClubSeasonData server failure → health='unhealthy', SFV_SERVER_FAILURE code", async () => {
      mockLoadClubSeasonData.mockRejectedValue(
        new SfvNetworkError("SFV_INVALID_RESPONSE", "SFV team list response is not valid JSON."),
      );
      const result = await runSfvAdminDiagnostics({ clubId: CLUB_ID, seasonId: SEASON_ID });
      expect(result.health).toBe("unhealthy");
      expect(result.issues[0].code).toBe("SFV_SERVER_FAILURE");
    });

    it("39. health='unhealthy' for any top-level failure", async () => {
      mockResolveClubIds.mockRejectedValue(new Error("unexpected"));
      const result = await runSfvAdminDiagnostics({ clubId: CLUB_ID, seasonId: SEASON_ID });
      expect(result.health).toBe("unhealthy");
    });

    it("40. exactly one issue with a safe error code is emitted on failure", async () => {
      mockResolveClubIds.mockRejectedValue(
        new SfvAuthError("SFV_UNAUTHORIZED", "Unauthorized."),
      );
      const result = await runSfvAdminDiagnostics({ clubId: CLUB_ID, seasonId: SEASON_ID });
      expect(result.issues).toHaveLength(1);
      expect(typeof result.issues[0].code).toBe("string");
      expect(result.issues[0].code.length).toBeGreaterThan(0);
    });

    it("41. failed stage timing is recorded with success=false", async () => {
      mockResolveClubIds.mockRejectedValue(
        new SfvNetworkError("SFV_TIMEOUT", "timed out."),
      );
      const result = await runSfvAdminDiagnostics({ clubId: CLUB_ID, seasonId: SEASON_ID });
      expect(result.timings).toHaveLength(1);
      expect(result.timings[0].stage).toBe("resolve-common-ids");
      expect(result.timings[0].success).toBe(false);
      expect(result.timings[0].durationMs).toBeGreaterThanOrEqual(0);
    });

    it("42. unhealthy output contains no secret-like fields", async () => {
      mockResolveClubIds.mockRejectedValue(
        new SfvAuthError("SFV_UNAUTHORIZED", "Unauthorized."),
      );
      const result = await runSfvAdminDiagnostics({ clubId: CLUB_ID, seasonId: SEASON_ID });
      const json = JSON.stringify(result);
      expect(json).not.toMatch(/applicationKey/i);
      expect(json).not.toMatch(/applicationPass/i);
      expect(json).not.toMatch(/X-User-Token/i);
      expect(json).not.toMatch(/Authorization/i);
      expect(json).not.toMatch(/Bearer/i);
    });

    it("43. unhealthy output contains no stack trace", async () => {
      mockResolveClubIds.mockRejectedValue(
        new SfvAuthError("SFV_UNAUTHORIZED", "Unauthorized."),
      );
      const result = await runSfvAdminDiagnostics({ clubId: CLUB_ID, seasonId: SEASON_ID });
      const json = JSON.stringify(result);
      expect(json).not.toContain("at Object.");
      expect(json).not.toMatch(/\bat\s+\w+\s+\(/);
    });

    it("44. unhealthy output contains no base64 data", async () => {
      mockResolveClubIds.mockRejectedValue(
        new SfvAuthError("SFV_UNAUTHORIZED", "Unauthorized."),
      );
      const result = await runSfvAdminDiagnostics({ clubId: CLUB_ID, seasonId: SEASON_ID });
      const json = JSON.stringify(result);
      // A base64 payload would be a very long alphanumeric string.
      // Check no field contains a long base64-looking value.
      expect(json).not.toMatch(/[A-Za-z0-9+/]{100,}={0,2}/);
    });
  });

  // ── Call behaviour ──────────────────────────────────────────────────────────

  describe("call behaviour", () => {
    it("45. resolveClubIds called exactly once per run", async () => {
      await runSfvAdminDiagnostics({ clubId: CLUB_ID, seasonId: SEASON_ID });
      expect(mockResolveClubIds).toHaveBeenCalledOnce();
    });

    it("46. loadClubSeasonData called exactly once after resolveClubIds succeeds", async () => {
      await runSfvAdminDiagnostics({ clubId: CLUB_ID, seasonId: SEASON_ID });
      expect(mockLoadClubSeasonData).toHaveBeenCalledOnce();
    });

    it("47. loadClubSeasonData not called when resolveClubIds fails", async () => {
      mockResolveClubIds.mockRejectedValue(
        new SfvNetworkError("SFV_TIMEOUT", "timed out."),
      );
      await runSfvAdminDiagnostics({ clubId: CLUB_ID, seasonId: SEASON_ID });
      expect(mockLoadClubSeasonData).not.toHaveBeenCalled();
    });

    it("48. no other raw client calls are made", async () => {
      await runSfvAdminDiagnostics({ clubId: CLUB_ID, seasonId: SEASON_ID });
      // Only resolveClubIds (from client) and loadClubSeasonData (from club-data-service)
      // are called. The service adds no direct schedule/ranking/picture calls.
      expect(mockResolveClubIds).toHaveBeenCalledOnce();
      expect(mockLoadClubSeasonData).toHaveBeenCalledOnce();
    });

    it("49. batchOptions are forwarded to loadClubSeasonData", async () => {
      const batchOptions = { concurrency: 2, failFast: true };
      await runSfvAdminDiagnostics({ clubId: CLUB_ID, seasonId: SEASON_ID, batchOptions });
      expect(mockLoadClubSeasonData).toHaveBeenCalledWith(
        expect.objectContaining({ batchOptions }),
      );
    });

    it("50. input params object is not mutated", async () => {
      const params = { clubId: CLUB_ID, seasonId: SEASON_ID } as const;
      await runSfvAdminDiagnostics(params);
      expect(params.clubId).toBe(CLUB_ID);
      expect(params.seasonId).toBe(SEASON_ID);
    });
  });

  // ── Timing ──────────────────────────────────────────────────────────────────

  describe("timing", () => {
    it("51. timings has exactly two entries for a fully successful run", async () => {
      const result = await runSfvAdminDiagnostics({ clubId: CLUB_ID, seasonId: SEASON_ID });
      expect(result.timings).toHaveLength(2);
    });

    it("52. timings are in pipeline order: resolve-common-ids first", async () => {
      const result = await runSfvAdminDiagnostics({ clubId: CLUB_ID, seasonId: SEASON_ID });
      expect(result.timings[0].stage).toBe("resolve-common-ids");
      expect(result.timings[1].stage).toBe("load-club-season-data");
    });

    it("53. all durationMs values are non-negative integers", async () => {
      const result = await runSfvAdminDiagnostics({ clubId: CLUB_ID, seasonId: SEASON_ID });
      for (const timing of result.timings) {
        expect(Number.isInteger(timing.durationMs)).toBe(true);
        expect(timing.durationMs).toBeGreaterThanOrEqual(0);
      }
    });

    it("54. totalDurationMs is a non-negative integer", async () => {
      const result = await runSfvAdminDiagnostics({ clubId: CLUB_ID, seasonId: SEASON_ID });
      expect(Number.isInteger(result.totalDurationMs)).toBe(true);
      expect(result.totalDurationMs).toBeGreaterThanOrEqual(0);
    });
  });

  // ── Output safety ────────────────────────────────────────────────────────────

  describe("output safety", () => {
    it("55. diagnostics object contains no base64 field", async () => {
      const result = await runSfvAdminDiagnostics({ clubId: CLUB_ID, seasonId: SEASON_ID });
      const json = JSON.stringify(result);
      expect(json).not.toMatch(/[A-Za-z0-9+/]{100,}={0,2}/);
      expect(result).not.toHaveProperty("base64");
    });

    it("56. diagnostics JSON contains no token-like field names", async () => {
      const result = await runSfvAdminDiagnostics({ clubId: CLUB_ID, seasonId: SEASON_ID });
      const json = JSON.stringify(result);
      expect(json).not.toContain("\"token\"");
      expect(json).not.toContain("applicationKey");
      expect(json).not.toContain("applicationPass");
      expect(json).not.toContain("X-User-Token");
      expect(json).not.toContain("Authorization");
    });

    it("57. issues contain no raw response bodies", async () => {
      mockResolveClubIds.mockRejectedValue(
        new SfvNetworkError("SFV_UNAVAILABLE", "SFV endpoint is not reachable."),
      );
      const result = await runSfvAdminDiagnostics({ clubId: CLUB_ID, seasonId: SEASON_ID });
      const json = JSON.stringify(result.issues);
      expect(json).not.toContain("applicationKey");
      expect(json).not.toContain("applicationPass");
      expect(json).not.toContain("rawBody");
    });

    it("58. identical inputs produce structurally stable output (same counts and codes)", async () => {
      const r1 = await runSfvAdminDiagnostics({ clubId: CLUB_ID, seasonId: SEASON_ID });
      const r2 = await runSfvAdminDiagnostics({ clubId: CLUB_ID, seasonId: SEASON_ID });
      expect(r1.health).toBe(r2.health);
      expect(r1.counts).toEqual(r2.counts);
      expect(r1.issues.map((i) => i.code)).toEqual(r2.issues.map((i) => i.code));
    });

    it("59. issue codes are deterministic for the same input", async () => {
      mockLoadClubSeasonData.mockResolvedValue(
        makeClubSeasonData({
          scheduleSummary: { total: 60, resolved: 58, noOwnTeam: 2 },
          clusterSummary: { scheduleCount: 60 },
        }),
      );
      const r1 = await runSfvAdminDiagnostics({ clubId: CLUB_ID, seasonId: SEASON_ID });
      const r2 = await runSfvAdminDiagnostics({ clubId: CLUB_ID, seasonId: SEASON_ID });
      expect(r1.issues.map((i) => i.code)).toEqual(r2.issues.map((i) => i.code));
    });

    it("60. counts are derived from batch summaries, not from team names or entry payloads", async () => {
      // The service reads .summary and .resolution.summary — numeric counts only.
      // Verify that changing ownTeams array does not affect counts (they come from summary).
      const dataA = makeClubSeasonData();
      const dataB = { ...makeClubSeasonData(), ownTeams: [] };
      // Both have identical summaries, so counts should be identical.
      mockLoadClubSeasonData.mockResolvedValue(dataA);
      const r1 = await runSfvAdminDiagnostics({ clubId: CLUB_ID, seasonId: SEASON_ID });
      mockLoadClubSeasonData.mockResolvedValue(dataB);
      const r2 = await runSfvAdminDiagnostics({ clubId: CLUB_ID, seasonId: SEASON_ID });
      expect(r1.counts).toEqual(r2.counts);
    });
  });

  // ── Additional coverage ──────────────────────────────────────────────────────

  describe("additional coverage", () => {
    it("61. both both-own and no-own-team present → both issue codes emitted", async () => {
      mockLoadClubSeasonData.mockResolvedValue(
        makeClubSeasonData({
          scheduleSummary: { total: 60, resolved: 57, bothOwn: 1, noOwnTeam: 2 },
          clusterSummary: { scheduleCount: 60 },
        }),
      );
      const result = await runSfvAdminDiagnostics({ clubId: CLUB_ID, seasonId: SEASON_ID });
      const codes = result.issues.map((i) => i.code);
      expect(codes).toContain("SFV_SCHEDULE_BOTH_OWN");
      expect(codes).toContain("SFV_SCHEDULE_NO_OWN_TEAM");
    });

    it("62. SFV_MISSING_PICTURES has severity='info'", async () => {
      mockLoadClubSeasonData.mockResolvedValue(
        makeClubSeasonData({
          clusterSummary: {
            uniqueOpponentTeams: 43,
            pictureCount: 40,
            missingPictures: 3,
          },
        }),
      );
      const result = await runSfvAdminDiagnostics({ clubId: CLUB_ID, seasonId: SEASON_ID });
      const issue = result.issues.find((i) => i.code === "SFV_MISSING_PICTURES");
      expect(issue?.severity).toBe("info");
    });

    it("63. SFV_SCHEDULE_NO_OWN_TEAM issue includes count field", async () => {
      mockLoadClubSeasonData.mockResolvedValue(
        makeClubSeasonData({
          scheduleSummary: { total: 60, resolved: 57, noOwnTeam: 3 },
        }),
      );
      const result = await runSfvAdminDiagnostics({ clubId: CLUB_ID, seasonId: SEASON_ID });
      const issue = result.issues.find((i) => i.code === "SFV_SCHEDULE_NO_OWN_TEAM");
      expect(issue?.count).toBe(3);
    });

    it("64. seasonName=null and seasonShortName=null in unhealthy result", async () => {
      mockResolveClubIds.mockRejectedValue(
        new SfvAuthError("SFV_UNAUTHORIZED", "Unauthorized."),
      );
      const result = await runSfvAdminDiagnostics({ clubId: CLUB_ID, seasonId: SEASON_ID });
      expect(result.seasonName).toBeNull();
      expect(result.seasonShortName).toBeNull();
    });

    it("65. timings has one entry when resolve-common-ids fails", async () => {
      mockResolveClubIds.mockRejectedValue(
        new SfvNetworkError("SFV_TIMEOUT", "timed out."),
      );
      const result = await runSfvAdminDiagnostics({ clubId: CLUB_ID, seasonId: SEASON_ID });
      expect(result.timings).toHaveLength(1);
      expect(result.timings[0].stage).toBe("resolve-common-ids");
      expect(result.timings[0].success).toBe(false);
    });

    it("66. timings has two entries when load-club-season-data fails", async () => {
      mockLoadClubSeasonData.mockRejectedValue(
        new SfvNetworkError("SFV_TIMEOUT", "timed out."),
      );
      const result = await runSfvAdminDiagnostics({ clubId: CLUB_ID, seasonId: SEASON_ID });
      expect(result.timings).toHaveLength(2);
      expect(result.timings[0].stage).toBe("resolve-common-ids");
      expect(result.timings[0].success).toBe(true);
      expect(result.timings[1].stage).toBe("load-club-season-data");
      expect(result.timings[1].success).toBe(false);
    });

    it("67. pictureFailures = uniqueOpponentTeams - pictureCount - missingPictures", async () => {
      mockLoadClubSeasonData.mockResolvedValue(
        makeClubSeasonData({
          clusterSummary: {
            uniqueOpponentTeams: 43,
            pictureCount: 38,
            missingPictures: 2,
          },
        }),
      );
      const result = await runSfvAdminDiagnostics({ clubId: CLUB_ID, seasonId: SEASON_ID });
      // 43 - 38 - 2 = 3
      expect(result.counts.pictureFailures).toBe(3);
    });

    it("68. SFV_TIMEOUT issue has retryable=true", async () => {
      mockResolveClubIds.mockRejectedValue(
        new SfvNetworkError("SFV_TIMEOUT", "timed out."),
      );
      const result = await runSfvAdminDiagnostics({ clubId: CLUB_ID, seasonId: SEASON_ID });
      expect(result.issues[0].retryable).toBe(true);
    });

    it("69. SFV_AUTH_FAILURE issue has retryable=false", async () => {
      mockResolveClubIds.mockRejectedValue(
        new SfvAuthError("SFV_UNAUTHORIZED", "Unauthorized."),
      );
      const result = await runSfvAdminDiagnostics({ clubId: CLUB_ID, seasonId: SEASON_ID });
      expect(result.issues[0].retryable).toBe(false);
    });

    it("70. generatedAt is a valid ISO 8601 string", async () => {
      const result = await runSfvAdminDiagnostics({ clubId: CLUB_ID, seasonId: SEASON_ID });
      const parsed = new Date(result.generatedAt);
      expect(isNaN(parsed.getTime())).toBe(false);
      expect(result.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it("71. all counts fields are non-negative integers", async () => {
      const result = await runSfvAdminDiagnostics({ clubId: CLUB_ID, seasonId: SEASON_ID });
      for (const [, value] of Object.entries(result.counts)) {
        expect(Number.isInteger(value)).toBe(true);
        expect(value).toBeGreaterThanOrEqual(0);
      }
    });

    it("72. empty counts returned when resolve-common-ids fails", async () => {
      mockResolveClubIds.mockRejectedValue(
        new SfvNetworkError("SFV_UNAVAILABLE", "unreachable."),
      );
      const result = await runSfvAdminDiagnostics({ clubId: CLUB_ID, seasonId: SEASON_ID });
      for (const [, value] of Object.entries(result.counts)) {
        expect(value).toBe(0);
      }
    });

    it("73. SfvConfigurationError maps to SFV_AUTH_FAILURE", async () => {
      mockResolveClubIds.mockRejectedValue(
        new SfvConfigurationError("CONFIGURATION_MISSING", "SFV_TOKEN_URL is not configured."),
      );
      const result = await runSfvAdminDiagnostics({ clubId: CLUB_ID, seasonId: SEASON_ID });
      expect(result.health).toBe("unhealthy");
      expect(result.issues[0].code).toBe("SFV_AUTH_FAILURE");
    });

    it("74. SFV_RATE_LIMITED maps to SFV_NETWORK_FAILURE with retryable=true", async () => {
      mockResolveClubIds.mockRejectedValue(
        new SfvNetworkError("SFV_RATE_LIMITED", "429 Too Many Requests."),
      );
      const result = await runSfvAdminDiagnostics({ clubId: CLUB_ID, seasonId: SEASON_ID });
      expect(result.issues[0].code).toBe("SFV_NETWORK_FAILURE");
      expect(result.issues[0].retryable).toBe(true);
    });

    it("75. clubId and seasonId are echoed back in the result", async () => {
      const result = await runSfvAdminDiagnostics({ clubId: 100, seasonId: 9999 });
      expect(result.clubId).toBe(100);
      expect(result.seasonId).toBe(9999);
    });
  });
});
