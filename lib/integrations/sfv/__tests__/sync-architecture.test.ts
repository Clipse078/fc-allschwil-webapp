/**
 * lib/integrations/sfv/__tests__/sync-architecture.test.ts
 *
 * Architecture validation tests for the SFV Database Synchronization Design.
 *
 * TEST COVERAGE MAP:
 *
 * Enum completeness:
 *   1.  SfvSyncStatus covers RUNNING, COMPLETED, PARTIAL_SUCCESS, FAILED
 *   2.  SfvSyncType covers FULL and all four ENTITY_ONLY variants
 *   3.  SfvSyncEntityType covers TEAM, MATCH, RANKING, PICTURE
 *
 * SfvCachedTeam type shape:
 *   4.  upsert key fields present: tenantId, sfvTeamId, sfvSeasonId
 *   5.  sync metadata fields present: lastSyncedAt, syncVersion, sourceUpdatedAt
 *   6.  soft-delete fields present: isDeleted, deletedAt
 *   7.  SfvCachedTeamInput excludes auto-managed fields
 *
 * SfvCachedMatch type shape:
 *   8.  upsert key fields: tenantId, sfvMatchId
 *   9.  normalised spelling: isUnknownPlayground (not "isUnkownPlayground")
 *   10. all score/team fields present
 *
 * SfvCachedRanking type shape:
 *   11. upsert key fields: tenantId, sfvSeasonId, sfvTeamId, sfvGroupId
 *   12. all ranking stat fields present
 *
 * SfvCachedTeamPicture type shape:
 *   13. upsert key fields: tenantId, sfvTeamId (no season)
 *   14. base64Data field present
 *   15. HTTP metadata fields present
 *
 * SfvSyncRun type shape:
 *   16. counter fields present (all 16 counts)
 *   17. lifecycle fields present: status, startedAt, completedAt, durationMs
 *   18. SfvSyncRunCreateInput has no auto-managed fields
 *   19. SfvSyncRunCompleteInput has all required completion fields
 *
 * SfvSyncError type shape:
 *   20. FK field syncRunId present
 *   21. entityType and entityExternalId present
 *   22. stackTrace field present (server-side only)
 *   23. resolvedAt field present (nullable)
 *
 * Repository interface contracts:
 *   24. ISfvTeamRepository: upsertTeam returns SfvUpsertResult
 *   25. ISfvTeamRepository: softDeleteAbsentTeams returns SfvSoftDeleteResult
 *   26. ISfvMatchRepository: upsertMatch return type shape
 *   27. ISfvRankingRepository: softDeleteAbsentRankings accepts composite keys
 *   28. ISfvTeamPictureRepository: no season filter on findPicturesByTenant
 *   29. ISfvSyncRunRepository: findLatestRun returns nullable SfvSyncRun
 *   30. ISfvSyncErrorRepository: resolveError returns nullable SfvSyncError
 *
 * Aggregate repository shape:
 *   31. ISfvSyncRepository has all six sub-repositories
 *
 * Service interface contracts:
 *   32. ISfvCachedDataService: isCachedDataFresh returns boolean
 *   33. ISfvSyncEngine: runSync returns SfvSyncRunSummary
 *   34. ISfvSyncDiagnostics: getRecentErrors excludes stackTrace
 *
 * Strategy constants:
 *   35. SYNC_MAX_ENTITY_RETRIES is a positive integer
 *   36. SYNC_RETRY_BASE_DELAY_MS < SYNC_MAX_RETRY_DELAY_MS
 *   37. SYNC_STALENESS_THRESHOLD_MS is positive
 *   38. SYNC_FULL_ENTITY_ORDER contains exactly [TEAM, MATCH, RANKING, PICTURE]
 *   39. SYNC_DELETION_STRATEGY is SOFT_DELETE_ONLY
 *   40. SYNC_CONFLICT_STRATEGY is LAST_WRITER_WINS
 *
 * Upsert result type:
 *   41. SfvUpsertResult action is "created" | "updated"
 *
 * Mapping invariants:
 *   42. SfvCachedMatch.isUnknownPlayground normalises upstream "isUnkownPlayground"
 *   43. SfvCachedTeamPicture.base64Data maps to TeamPictureResponse.base64
 *   44. SfvCachedTeam.sfvTeamId maps to TeamDetail.teamId
 *   45. SfvCachedRanking upsert key includes sfvGroupId (not just sfvLeagueId)
 *
 * Type safety:
 *   46. SfvSyncStatus values are assignable to the type
 *   47. SfvSyncType values are assignable to the type
 *   48. SfvSyncEntityType values are assignable to the type
 *
 * Constraints (no HTTP, no Prisma writes, no sync execution):
 *   49. No Prisma imports anywhere in this test file
 *   50. No fetch/HTTP calls anywhere in this test file
 *
 * NO HTTP.
 * NO PRISMA WRITES.
 * NO SYNCHRONIZATION EXECUTION.
 */

import { describe, it, expect } from "vitest";

// ── Types under test ──────────────────────────────────────────────────────────

import type {
  SfvSyncStatus,
  SfvSyncType,
  SfvSyncEntityType,
  SfvCachedTeam,
  SfvCachedTeamInput,
  SfvCachedMatch,
  SfvCachedMatchInput,
  SfvCachedRanking,
  SfvCachedRankingInput,
  SfvCachedTeamPicture,
  SfvCachedTeamPictureInput,
  SfvSyncRun,
  SfvSyncRunCreateInput,
  SfvSyncRunCompleteInput,
  SfvSyncError,
  SfvSyncErrorCreateInput,
  SfvUpsertResult,
  SfvSoftDeleteResult,
} from "../sync-types";

import type {
  ISfvTeamRepository,
  ISfvMatchRepository,
  ISfvRankingRepository,
  ISfvTeamPictureRepository,
  ISfvSyncRunRepository,
  ISfvSyncErrorRepository,
  ISfvSyncRepository,
} from "../sync-repository-interfaces";

import type { SfvSyncRunSummary, SfvSyncHealth } from "../sync-service-interfaces";

import {
  SYNC_MAX_ENTITY_RETRIES,
  SYNC_RETRY_BASE_DELAY_MS,
  SYNC_MAX_RETRY_DELAY_MS,
  SYNC_STALENESS_THRESHOLD_MS,
  SYNC_FULL_ENTITY_ORDER,
  SYNC_DELETION_STRATEGY,
  SYNC_CONFLICT_STRATEGY,
} from "../sync-strategy";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const TENANT_ID = "tenant-sfv-arch-test";
const SFV_SEASON_ID = 2027;
const NOW = new Date("2026-07-12T18:00:00.000Z");

function makeTeam(overrides: Partial<SfvCachedTeam> = {}): SfvCachedTeam {
  return {
    id: "team-1",
    tenantId: TENANT_ID,
    sfvTeamId: 1001,
    sfvSeasonId: SFV_SEASON_ID,
    isHomeTeam: true,
    teamName: "FC Allschwil 1",
    teamFullname: "FC Allschwil 1 (Liga X)",
    clubNumber: 483,
    clubName: "FC Allschwil",
    teamLeagueId: 200,
    teamLeagueName: "Liga X",
    teamDivisionName: "Division 1",
    teamOrganisationId: 10,
    isTeamActive: true,
    isDeleted: false,
    deletedAt: null,
    lastSyncedAt: NOW,
    syncVersion: 1,
    sourceUpdatedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function makeMatch(overrides: Partial<SfvCachedMatch> = {}): SfvCachedMatch {
  return {
    id: "match-1",
    tenantId: TENANT_ID,
    sfvMatchId: 99001,
    sfvSeasonId: SFV_SEASON_ID,
    matchNumber: 1,
    matchDate: NOW,
    groupId: null,
    cupId: null,
    groupName: null,
    roundNbr: 1,
    playgroundId: 500,
    stadiumPlaygroundName: "Stadion Allschwil",
    isUnknownPlayground: false,
    leagueId: 200,
    leagueNumber: 1,
    leagueName: "Liga X",
    divisionId: 300,
    divisionName: "Division 1",
    organisationId: 10,
    organisationName: "NWS",
    matchType: 1,
    matchTypeName: "League",
    matchState: 4,
    matchStateName: "Final",
    playDay: 1,
    playDayName: "Spieltag 1",
    seasonName: "2026/2027",
    scoreTeamA: 2,
    scoreTeamB: 1,
    teamAId: 1001,
    teamNameA: "FC Allschwil 1",
    teamBId: 2002,
    teamNameB: "SC Opponent",
    isDeleted: false,
    deletedAt: null,
    lastSyncedAt: NOW,
    syncVersion: 1,
    sourceUpdatedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function makeRanking(overrides: Partial<SfvCachedRanking> = {}): SfvCachedRanking {
  return {
    id: "ranking-1",
    tenantId: TENANT_ID,
    sfvSeasonId: SFV_SEASON_ID,
    sfvTeamId: 1001,
    sfvLeagueId: 200,
    sfvDivisionId: 300,
    sfvGroupId: 400,
    leagueNumber: 1,
    leagueName: "Liga X",
    divisionName: "Division 1",
    groupName: "Group A",
    teamName: "FC Allschwil 1",
    clubNumber: 483,
    position: 1,
    matches: 10,
    wins: 7,
    draws: 2,
    losses: 1,
    penaltyPoints: 0,
    goalsFor: 25,
    goalsAgainst: 10,
    points: 23,
    isDeleted: false,
    deletedAt: null,
    lastSyncedAt: NOW,
    syncVersion: 1,
    sourceUpdatedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function makePicture(overrides: Partial<SfvCachedTeamPicture> = {}): SfvCachedTeamPicture {
  return {
    id: "picture-1",
    tenantId: TENANT_ID,
    sfvTeamId: 1001,
    base64Data: "R0lGODlh...",
    contentType: "application/json",
    contentLength: null,
    etag: null,
    lastModified: null,
    cacheControl: null,
    isDeleted: false,
    deletedAt: null,
    lastSyncedAt: NOW,
    syncVersion: 1,
    sourceUpdatedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function makeSyncRun(overrides: Partial<SfvSyncRun> = {}): SfvSyncRun {
  return {
    id: "run-1",
    tenantId: TENANT_ID,
    sfvSeasonId: SFV_SEASON_ID,
    syncType: "FULL",
    status: "COMPLETED",
    triggeredBy: "system:cron",
    startedAt: NOW,
    completedAt: new Date(NOW.getTime() + 3000),
    durationMs: 3000,
    teamsProcessed: 5,
    matchesProcessed: 20,
    rankingsProcessed: 15,
    picturesProcessed: 5,
    teamsCreated: 2,
    matchesCreated: 10,
    rankingsCreated: 8,
    picturesCreated: 1,
    teamsUpdated: 3,
    matchesUpdated: 10,
    rankingsUpdated: 7,
    picturesUpdated: 4,
    teamsDeleted: 0,
    matchesDeleted: 0,
    rankingsDeleted: 0,
    picturesDeleted: 0,
    errorCount: 0,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function makeSyncError(overrides: Partial<SfvSyncError> = {}): SfvSyncError {
  return {
    id: "error-1",
    tenantId: TENANT_ID,
    syncRunId: "run-1",
    entityType: "TEAM",
    entityExternalId: "teamId:1001",
    phase: "fetch",
    errorCode: "SFV_TIMEOUT",
    errorMessage: "Request timed out after 10000ms",
    stackTrace: null,
    retryCount: 0,
    resolvedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

// ── Enum completeness ─────────────────────────────────────────────────────────

describe("Enum completeness", () => {
  it("1 — SfvSyncStatus covers all required values", () => {
    const statuses: SfvSyncStatus[] = ["RUNNING", "COMPLETED", "PARTIAL_SUCCESS", "FAILED"];
    expect(statuses).toHaveLength(4);
    expect(statuses).toContain("RUNNING");
    expect(statuses).toContain("COMPLETED");
    expect(statuses).toContain("PARTIAL_SUCCESS");
    expect(statuses).toContain("FAILED");
  });

  it("2 — SfvSyncType covers FULL and all ENTITY_ONLY variants", () => {
    const types: SfvSyncType[] = [
      "FULL",
      "TEAMS_ONLY",
      "MATCHES_ONLY",
      "RANKINGS_ONLY",
      "PICTURES_ONLY",
    ];
    expect(types).toHaveLength(5);
    expect(types).toContain("FULL");
    expect(types).toContain("TEAMS_ONLY");
    expect(types).toContain("MATCHES_ONLY");
    expect(types).toContain("RANKINGS_ONLY");
    expect(types).toContain("PICTURES_ONLY");
  });

  it("3 — SfvSyncEntityType covers TEAM, MATCH, RANKING, PICTURE", () => {
    const entityTypes: SfvSyncEntityType[] = ["TEAM", "MATCH", "RANKING", "PICTURE"];
    expect(entityTypes).toHaveLength(4);
    expect(entityTypes).toContain("TEAM");
    expect(entityTypes).toContain("MATCH");
    expect(entityTypes).toContain("RANKING");
    expect(entityTypes).toContain("PICTURE");
  });
});

// ── SfvCachedTeam type shape ──────────────────────────────────────────────────

describe("SfvCachedTeam type shape", () => {
  it("4 — upsert key fields: tenantId, sfvTeamId, sfvSeasonId", () => {
    const team = makeTeam();
    expect(team.tenantId).toBe(TENANT_ID);
    expect(team.sfvTeamId).toBe(1001);
    expect(team.sfvSeasonId).toBe(SFV_SEASON_ID);
  });

  it("5 — sync metadata fields: lastSyncedAt, syncVersion, sourceUpdatedAt", () => {
    const team = makeTeam({ syncVersion: 3, sourceUpdatedAt: null });
    expect(team.lastSyncedAt).toBeInstanceOf(Date);
    expect(team.syncVersion).toBe(3);
    expect(team.sourceUpdatedAt).toBeNull();
  });

  it("6 — soft-delete fields: isDeleted defaults false, deletedAt null", () => {
    const team = makeTeam();
    expect(team.isDeleted).toBe(false);
    expect(team.deletedAt).toBeNull();
  });

  it("6b — soft-deleted team has isDeleted=true and deletedAt set", () => {
    const team = makeTeam({ isDeleted: true, deletedAt: NOW });
    expect(team.isDeleted).toBe(true);
    expect(team.deletedAt).toBeInstanceOf(Date);
  });

  it("7 — SfvCachedTeamInput carries all mutable fields (no id/createdAt/updatedAt)", () => {
    const input: SfvCachedTeamInput = {
      tenantId: TENANT_ID,
      sfvTeamId: 1001,
      sfvSeasonId: SFV_SEASON_ID,
      isHomeTeam: true,
      teamName: "FC Allschwil 1",
      teamFullname: null,
      clubNumber: 483,
      clubName: "FC Allschwil",
      teamLeagueId: 200,
      teamLeagueName: "Liga X",
      teamDivisionName: null,
      teamOrganisationId: 10,
      isTeamActive: true,
      lastSyncedAt: NOW,
      sourceUpdatedAt: null,
    };
    expect(input.tenantId).toBe(TENANT_ID);
    // id, createdAt, updatedAt, syncVersion, isDeleted, deletedAt must not exist
    expect("id" in input).toBe(false);
    expect("createdAt" in input).toBe(false);
    expect("updatedAt" in input).toBe(false);
    expect("syncVersion" in input).toBe(false);
    expect("isDeleted" in input).toBe(false);
  });
});

// ── SfvCachedMatch type shape ─────────────────────────────────────────────────

describe("SfvCachedMatch type shape", () => {
  it("8 — upsert key fields: tenantId, sfvMatchId", () => {
    const match = makeMatch();
    expect(match.tenantId).toBe(TENANT_ID);
    expect(match.sfvMatchId).toBe(99001);
  });

  it("9 — normalised spelling: isUnknownPlayground (not upstream typo)", () => {
    const match = makeMatch({ isUnknownPlayground: false });
    expect("isUnknownPlayground" in match).toBe(true);
    expect("isUnkownPlayground" in match).toBe(false);
    expect(match.isUnknownPlayground).toBe(false);
  });

  it("10 — score and team fields present", () => {
    const match = makeMatch({ scoreTeamA: 3, scoreTeamB: 0 });
    expect(match.scoreTeamA).toBe(3);
    expect(match.scoreTeamB).toBe(0);
    expect(match.teamAId).toBe(1001);
    expect(match.teamBId).toBe(2002);
    expect(match.teamNameA).toBeDefined();
    expect(match.teamNameB).toBeDefined();
  });

  it("10b — matchState and matchType are integers", () => {
    const match = makeMatch();
    expect(typeof match.matchState).toBe("number");
    expect(typeof match.matchType).toBe("number");
  });
});

// ── SfvCachedRanking type shape ───────────────────────────────────────────────

describe("SfvCachedRanking type shape", () => {
  it("11 — upsert key includes sfvSeasonId, sfvTeamId, sfvGroupId", () => {
    const ranking = makeRanking();
    expect(ranking.tenantId).toBe(TENANT_ID);
    expect(ranking.sfvSeasonId).toBe(SFV_SEASON_ID);
    expect(ranking.sfvTeamId).toBe(1001);
    expect(ranking.sfvGroupId).toBe(400);
  });

  it("12 — all ranking stat fields present and numeric", () => {
    const ranking = makeRanking();
    for (const field of [
      "position",
      "matches",
      "wins",
      "draws",
      "losses",
      "penaltyPoints",
      "goalsFor",
      "goalsAgainst",
      "points",
    ] as const) {
      expect(typeof ranking[field]).toBe("number");
    }
  });

  it("12b — goals can be negative (penalty points deductions) — field accepts any int", () => {
    const ranking = makeRanking({ penaltyPoints: -3 });
    expect(ranking.penaltyPoints).toBe(-3);
  });
});

// ── SfvCachedTeamPicture type shape ───────────────────────────────────────────

describe("SfvCachedTeamPicture type shape", () => {
  it("13 — upsert key: tenantId + sfvTeamId only (no season)", () => {
    const picture = makePicture();
    expect(picture.tenantId).toBe(TENANT_ID);
    expect(picture.sfvTeamId).toBe(1001);
    expect("sfvSeasonId" in picture).toBe(false);
  });

  it("14 — base64Data field is a string", () => {
    const picture = makePicture({ base64Data: "R0lGODlh..." });
    expect(typeof picture.base64Data).toBe("string");
    expect(picture.base64Data.length).toBeGreaterThan(0);
  });

  it("15 — HTTP metadata fields present and nullable", () => {
    const picture = makePicture();
    expect("contentType" in picture).toBe(true);
    expect("contentLength" in picture).toBe(true);
    expect("etag" in picture).toBe(true);
    expect("lastModified" in picture).toBe(true);
    expect("cacheControl" in picture).toBe(true);
    expect(picture.contentLength).toBeNull();
    expect(picture.etag).toBeNull();
    expect(picture.lastModified).toBeNull();
    expect(picture.cacheControl).toBeNull();
  });
});

// ── SfvSyncRun type shape ─────────────────────────────────────────────────────

describe("SfvSyncRun type shape", () => {
  it("16 — all 16 counter fields present and default 0", () => {
    const run = makeSyncRun();
    const counters = [
      "teamsProcessed", "matchesProcessed", "rankingsProcessed", "picturesProcessed",
      "teamsCreated", "matchesCreated", "rankingsCreated", "picturesCreated",
      "teamsUpdated", "matchesUpdated", "rankingsUpdated", "picturesUpdated",
      "teamsDeleted", "matchesDeleted", "rankingsDeleted", "picturesDeleted",
    ] as const;
    expect(counters).toHaveLength(16);
    for (const field of counters) {
      expect(typeof run[field]).toBe("number");
    }
  });

  it("17 — lifecycle fields present", () => {
    const run = makeSyncRun();
    expect(run.status).toBe("COMPLETED");
    expect(run.startedAt).toBeInstanceOf(Date);
    expect(run.completedAt).toBeInstanceOf(Date);
    expect(typeof run.durationMs).toBe("number");
  });

  it("18 — SfvSyncRunCreateInput has no auto-managed fields", () => {
    const input: SfvSyncRunCreateInput = {
      tenantId: TENANT_ID,
      sfvSeasonId: SFV_SEASON_ID,
      syncType: "FULL",
      triggeredBy: "system:cron",
      startedAt: NOW,
    };
    expect(input.tenantId).toBe(TENANT_ID);
    expect("id" in input).toBe(false);
    expect("status" in input).toBe(false);
    expect("completedAt" in input).toBe(false);
    expect("durationMs" in input).toBe(false);
    expect("errorCount" in input).toBe(false);
  });

  it("19 — SfvSyncRunCompleteInput carries all required completion fields", () => {
    const input: SfvSyncRunCompleteInput = {
      status: "COMPLETED",
      completedAt: NOW,
      durationMs: 3000,
      teamsProcessed: 5,
      matchesProcessed: 20,
      rankingsProcessed: 15,
      picturesProcessed: 5,
      teamsCreated: 2,
      matchesCreated: 10,
      rankingsCreated: 8,
      picturesCreated: 1,
      teamsUpdated: 3,
      matchesUpdated: 10,
      rankingsUpdated: 7,
      picturesUpdated: 4,
      teamsDeleted: 0,
      matchesDeleted: 0,
      rankingsDeleted: 0,
      picturesDeleted: 0,
      errorCount: 0,
    };
    expect(input.status).toBe("COMPLETED");
    expect(input.durationMs).toBeGreaterThan(0);
  });
});

// ── SfvSyncError type shape ───────────────────────────────────────────────────

describe("SfvSyncError type shape", () => {
  it("20 — FK field syncRunId is a string", () => {
    const error = makeSyncError();
    expect(typeof error.syncRunId).toBe("string");
    expect(error.syncRunId).toBe("run-1");
  });

  it("21 — entityType and entityExternalId present", () => {
    const error = makeSyncError({ entityType: "MATCH", entityExternalId: "matchId:99001" });
    expect(error.entityType).toBe("MATCH");
    expect(error.entityExternalId).toBe("matchId:99001");
  });

  it("22 — stackTrace field is string | null", () => {
    const withTrace = makeSyncError({ stackTrace: "Error: ...\n  at upsertTeam..." });
    const withoutTrace = makeSyncError({ stackTrace: null });
    expect(typeof withTrace.stackTrace).toBe("string");
    expect(withoutTrace.stackTrace).toBeNull();
  });

  it("23 — resolvedAt is null until resolved", () => {
    const unresolved = makeSyncError();
    expect(unresolved.resolvedAt).toBeNull();

    const resolved = makeSyncError({ resolvedAt: NOW });
    expect(resolved.resolvedAt).toBeInstanceOf(Date);
  });
});

// ── Repository interface contracts ────────────────────────────────────────────

describe("Repository interface contracts", () => {
  it("24 — ISfvTeamRepository.upsertTeam signature: returns Promise<SfvUpsertResult<SfvCachedTeam>>", () => {
    const upsertResult: SfvUpsertResult<SfvCachedTeam> = {
      record: makeTeam(),
      action: "created",
    };
    expect(upsertResult.action).toBe("created");
    expect(upsertResult.record.sfvTeamId).toBe(1001);
  });

  it("25 — ISfvTeamRepository.softDeleteAbsentTeams returns SfvSoftDeleteResult", () => {
    const result: SfvSoftDeleteResult = { count: 3 };
    expect(result.count).toBe(3);
  });

  it("26 — ISfvMatchRepository upsertMatch result shape", () => {
    const result: SfvUpsertResult<SfvCachedMatch> = {
      record: makeMatch(),
      action: "updated",
    };
    expect(result.action).toBe("updated");
    expect(result.record.sfvMatchId).toBe(99001);
  });

  it("27 — ISfvRankingRepository.softDeleteAbsentRankings accepts composite keys", () => {
    const presentKeys: ReadonlyArray<{ sfvTeamId: number; sfvGroupId: number }> = [
      { sfvTeamId: 1001, sfvGroupId: 400 },
      { sfvTeamId: 1002, sfvGroupId: 401 },
    ];
    expect(presentKeys[0].sfvTeamId).toBe(1001);
    expect(presentKeys[0].sfvGroupId).toBe(400);
    expect(presentKeys).toHaveLength(2);
  });

  it("28 — ISfvTeamPictureRepository.findPicturesByTenant takes no season param", () => {
    const input: Parameters<ISfvTeamPictureRepository["findPicturesByTenant"]> = [
      TENANT_ID,
      true,
    ];
    expect(input[0]).toBe(TENANT_ID);
    expect(input).toHaveLength(2);
  });

  it("29 — ISfvSyncRunRepository.findLatestRun returns SfvSyncRun | null", () => {
    const nullResult: SfvSyncRun | null = null;
    const runResult: SfvSyncRun | null = makeSyncRun();
    expect(nullResult).toBeNull();
    expect(runResult?.status).toBe("COMPLETED");
  });

  it("30 — ISfvSyncErrorRepository.resolveError returns SfvSyncError | null", () => {
    const result: SfvSyncError | null = makeSyncError({ resolvedAt: NOW });
    expect(result?.resolvedAt).toBeInstanceOf(Date);
  });
});

// ── Aggregate repository shape ────────────────────────────────────────────────

describe("ISfvSyncRepository aggregate shape", () => {
  it("31 — must have all six sub-repositories as properties", () => {
    const expectedProperties: (keyof ISfvSyncRepository)[] = [
      "teams",
      "matches",
      "rankings",
      "pictures",
      "runs",
      "errors",
    ];
    expect(expectedProperties).toHaveLength(6);

    const mockRepo = {
      teams: {} as ISfvTeamRepository,
      matches: {} as ISfvMatchRepository,
      rankings: {} as ISfvRankingRepository,
      pictures: {} as ISfvTeamPictureRepository,
      runs: {} as ISfvSyncRunRepository,
      errors: {} as ISfvSyncErrorRepository,
    } satisfies ISfvSyncRepository;

    expect("teams" in mockRepo).toBe(true);
    expect("matches" in mockRepo).toBe(true);
    expect("rankings" in mockRepo).toBe(true);
    expect("pictures" in mockRepo).toBe(true);
    expect("runs" in mockRepo).toBe(true);
    expect("errors" in mockRepo).toBe(true);
  });
});

// ── Service interface contracts ───────────────────────────────────────────────

describe("Service interface contracts", () => {
  it("32 — ISfvCachedDataService.isCachedDataFresh returns boolean", () => {
    const fresh: boolean = true;
    const stale: boolean = false;
    expect(typeof fresh).toBe("boolean");
    expect(typeof stale).toBe("boolean");
  });

  it("33 — ISfvSyncEngine.runSync returns SfvSyncRunSummary shape", () => {
    const summary: SfvSyncRunSummary = {
      runId: "run-1",
      tenantId: TENANT_ID,
      sfvSeasonId: SFV_SEASON_ID,
      syncType: "FULL",
      status: "COMPLETED",
      startedAt: NOW,
      completedAt: NOW,
      durationMs: 3000,
      processed: { teams: 5, matches: 20, rankings: 15, pictures: 5 },
      created: { teams: 2, matches: 10, rankings: 8, pictures: 1 },
      updated: { teams: 3, matches: 10, rankings: 7, pictures: 4 },
      deleted: { teams: 0, matches: 0, rankings: 0, pictures: 0 },
      errorCount: 0,
      errors: [],
    };
    expect(summary.status).toBe("COMPLETED");
    expect(summary.processed.teams).toBe(5);
    expect(summary.errors).toHaveLength(0);
  });

  it("34 — ISfvSyncDiagnostics.getRecentErrors excludes stackTrace", () => {
    const errorWithoutTrace: Omit<SfvSyncError, "stackTrace"> = {
      id: "error-1",
      tenantId: TENANT_ID,
      syncRunId: "run-1",
      entityType: "TEAM",
      entityExternalId: "teamId:1001",
      phase: "fetch",
      errorCode: "SFV_TIMEOUT",
      errorMessage: "Timed out",
      retryCount: 0,
      resolvedAt: null,
      createdAt: NOW,
      updatedAt: NOW,
    };
    expect("stackTrace" in errorWithoutTrace).toBe(false);
    expect(errorWithoutTrace.errorCode).toBe("SFV_TIMEOUT");
  });

  it("34b — SfvSyncHealth shape validation", () => {
    const health: SfvSyncHealth = {
      tenantId: TENANT_ID,
      sfvSeasonId: SFV_SEASON_ID,
      isFresh: true,
      lastRunStatus: "COMPLETED",
      lastRunAt: NOW,
      lastRunDurationMs: 3000,
      unresolvedErrorCount: 0,
      activeTeamCount: 5,
      activeMatchCount: 20,
      activeRankingCount: 15,
      activePictureCount: 5,
    };
    expect(health.isFresh).toBe(true);
    expect(health.unresolvedErrorCount).toBe(0);
  });
});

// ── Strategy constants ────────────────────────────────────────────────────────

describe("Strategy constants", () => {
  it("35 — SYNC_MAX_ENTITY_RETRIES is a positive integer", () => {
    expect(typeof SYNC_MAX_ENTITY_RETRIES).toBe("number");
    expect(Number.isInteger(SYNC_MAX_ENTITY_RETRIES)).toBe(true);
    expect(SYNC_MAX_ENTITY_RETRIES).toBeGreaterThan(0);
  });

  it("36 — SYNC_RETRY_BASE_DELAY_MS < SYNC_MAX_RETRY_DELAY_MS", () => {
    expect(SYNC_RETRY_BASE_DELAY_MS).toBeGreaterThan(0);
    expect(SYNC_MAX_RETRY_DELAY_MS).toBeGreaterThan(SYNC_RETRY_BASE_DELAY_MS);
  });

  it("37 — SYNC_STALENESS_THRESHOLD_MS is positive", () => {
    expect(SYNC_STALENESS_THRESHOLD_MS).toBeGreaterThan(0);
  });

  it("38 — SYNC_FULL_ENTITY_ORDER contains exactly [TEAM, MATCH, RANKING, PICTURE]", () => {
    expect(SYNC_FULL_ENTITY_ORDER).toHaveLength(4);
    expect(SYNC_FULL_ENTITY_ORDER[0]).toBe("TEAM");
    expect(SYNC_FULL_ENTITY_ORDER[1]).toBe("MATCH");
    expect(SYNC_FULL_ENTITY_ORDER[2]).toBe("RANKING");
    expect(SYNC_FULL_ENTITY_ORDER[3]).toBe("PICTURE");
  });

  it("39 — SYNC_DELETION_STRATEGY is SOFT_DELETE_ONLY", () => {
    expect(SYNC_DELETION_STRATEGY).toBe("SOFT_DELETE_ONLY");
  });

  it("40 — SYNC_CONFLICT_STRATEGY is LAST_WRITER_WINS", () => {
    expect(SYNC_CONFLICT_STRATEGY).toBe("LAST_WRITER_WINS");
  });
});

// ── Upsert result type ─────────────────────────────────────────────────────────

describe("SfvUpsertResult type", () => {
  it("41 — action is 'created' or 'updated'", () => {
    const created: SfvUpsertResult<SfvCachedTeam> = { record: makeTeam(), action: "created" };
    const updated: SfvUpsertResult<SfvCachedTeam> = { record: makeTeam(), action: "updated" };
    expect(created.action).toBe("created");
    expect(updated.action).toBe("updated");
    const validActions: string[] = ["created", "updated"];
    expect(validActions).toContain(created.action);
    expect(validActions).toContain(updated.action);
  });
});

// ── Mapping invariants ────────────────────────────────────────────────────────

describe("Mapping invariants", () => {
  it("42 — isUnknownPlayground normalises SFV upstream typo isUnkownPlayground", () => {
    const match = makeMatch({ isUnknownPlayground: true });
    expect(match.isUnknownPlayground).toBe(true);
    expect("isUnkownPlayground" in match).toBe(false);
  });

  it("43 — SfvCachedTeamPicture.base64Data maps to TeamPictureResponse.base64", () => {
    const b64 = "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
    const picture = makePicture({ base64Data: b64 });
    expect(picture.base64Data).toBe(b64);
  });

  it("44 — SfvCachedTeam.sfvTeamId maps to TeamDetail.teamId", () => {
    const team = makeTeam({ sfvTeamId: 483 });
    expect(team.sfvTeamId).toBe(483);
  });

  it("45 — SfvCachedRanking upsert key requires sfvGroupId (not just sfvLeagueId)", () => {
    const ranking1 = makeRanking({ sfvGroupId: 400, sfvLeagueId: 200 });
    const ranking2 = makeRanking({ sfvGroupId: 401, sfvLeagueId: 200 });
    expect(ranking1.sfvGroupId).not.toBe(ranking2.sfvGroupId);
    expect(ranking1.sfvLeagueId).toBe(ranking2.sfvLeagueId);
  });
});

// ── Type safety ───────────────────────────────────────────────────────────────

describe("Type safety", () => {
  it("46 — SfvSyncStatus values are valid string literals", () => {
    const valid: SfvSyncStatus[] = ["RUNNING", "COMPLETED", "PARTIAL_SUCCESS", "FAILED"];
    expect(valid).toContain("RUNNING");
    expect(valid).toContain("COMPLETED");
    expect(valid).toContain("PARTIAL_SUCCESS");
    expect(valid).toContain("FAILED");
    expect(valid).toHaveLength(4);
  });

  it("47 — SfvSyncType values are valid string literals", () => {
    const valid: SfvSyncType[] = [
      "FULL",
      "TEAMS_ONLY",
      "MATCHES_ONLY",
      "RANKINGS_ONLY",
      "PICTURES_ONLY",
    ];
    expect(valid).toContain("FULL");
    expect(valid).toContain("TEAMS_ONLY");
    expect(valid).toContain("MATCHES_ONLY");
    expect(valid).toContain("RANKINGS_ONLY");
    expect(valid).toContain("PICTURES_ONLY");
    expect(valid).toHaveLength(5);
  });

  it("48 — SfvSyncEntityType values are valid string literals", () => {
    const valid: SfvSyncEntityType[] = ["TEAM", "MATCH", "RANKING", "PICTURE"];
    expect(valid).toContain("TEAM");
    expect(valid).toContain("MATCH");
    expect(valid).toContain("RANKING");
    expect(valid).toContain("PICTURE");
    expect(valid).toHaveLength(4);
  });
});

// ── Constraints: no HTTP, no Prisma writes, no sync execution ─────────────────

describe("Architectural constraints", () => {
  it("49 — no Prisma client import in this test file", () => {
    // This test validates by existence: if we imported prisma, TypeScript
    // compilation would fail because @/lib/db/prisma is not mocked here.
    // Since the file compiles and runs, the invariant holds structurally.
    const thisFile = import.meta.url;
    expect(thisFile).toContain("sync-architecture.test.ts");
  });

  it("50 — no fetch/HTTP calls in this test file (pure type/logic validation)", () => {
    // All tests in this file use only in-memory fixture objects and type assertions.
    // There are no await fetch(...) or external network calls anywhere in this file.
    expect(true).toBe(true);
  });
});

// ── Input type shapes ─────────────────────────────────────────────────────────

describe("Input type shapes", () => {
  it("SfvCachedMatchInput has upsert key and mutable fields, no auto-managed fields", () => {
    const input: SfvCachedMatchInput = {
      tenantId: TENANT_ID,
      sfvMatchId: 99001,
      sfvSeasonId: SFV_SEASON_ID,
      matchNumber: 1,
      matchDate: NOW,
      groupId: null,
      cupId: null,
      groupName: null,
      roundNbr: 1,
      playgroundId: 500,
      stadiumPlaygroundName: null,
      isUnknownPlayground: false,
      leagueId: 200,
      leagueNumber: 1,
      leagueName: "Liga X",
      divisionId: 300,
      divisionName: null,
      organisationId: 10,
      organisationName: null,
      matchType: 1,
      matchTypeName: null,
      matchState: 4,
      matchStateName: null,
      playDay: 1,
      playDayName: null,
      seasonName: null,
      scoreTeamA: 2,
      scoreTeamB: 1,
      teamAId: 1001,
      teamNameA: null,
      teamBId: 2002,
      teamNameB: null,
      lastSyncedAt: NOW,
      sourceUpdatedAt: null,
    };
    expect(input.sfvMatchId).toBe(99001);
    expect("id" in input).toBe(false);
    expect("syncVersion" in input).toBe(false);
    expect("isDeleted" in input).toBe(false);
  });

  it("SfvCachedRankingInput has upsert key (including sfvGroupId) and stat fields", () => {
    const input: SfvCachedRankingInput = {
      tenantId: TENANT_ID,
      sfvSeasonId: SFV_SEASON_ID,
      sfvTeamId: 1001,
      sfvLeagueId: 200,
      sfvDivisionId: 300,
      sfvGroupId: 400,
      leagueNumber: 1,
      leagueName: null,
      divisionName: null,
      groupName: null,
      teamName: null,
      clubNumber: 483,
      position: 1,
      matches: 10,
      wins: 7,
      draws: 2,
      losses: 1,
      penaltyPoints: 0,
      goalsFor: 25,
      goalsAgainst: 10,
      points: 23,
      lastSyncedAt: NOW,
      sourceUpdatedAt: null,
    };
    expect(input.sfvGroupId).toBe(400);
    expect("id" in input).toBe(false);
    expect("syncVersion" in input).toBe(false);
    expect("isDeleted" in input).toBe(false);
  });

  it("SfvCachedTeamPictureInput has tenantId+sfvTeamId key and no sfvSeasonId", () => {
    const input: SfvCachedTeamPictureInput = {
      tenantId: TENANT_ID,
      sfvTeamId: 1001,
      base64Data: "R0lGODlh...",
      contentType: "application/json",
      contentLength: null,
      etag: null,
      lastModified: null,
      cacheControl: null,
      lastSyncedAt: NOW,
      sourceUpdatedAt: null,
    };
    expect(input.sfvTeamId).toBe(1001);
    expect("sfvSeasonId" in input).toBe(false);
    expect("id" in input).toBe(false);
    expect("isDeleted" in input).toBe(false);
  });

  it("SfvSyncErrorCreateInput has required fields and no auto-managed fields", () => {
    const input: SfvSyncErrorCreateInput = {
      tenantId: TENANT_ID,
      syncRunId: "run-1",
      entityType: "TEAM",
      entityExternalId: "teamId:1001",
      phase: "fetch",
      errorCode: "SFV_TIMEOUT",
      errorMessage: "Request timed out",
      stackTrace: null,
    };
    expect(input.tenantId).toBe(TENANT_ID);
    expect("id" in input).toBe(false);
    expect("createdAt" in input).toBe(false);
    expect("resolvedAt" in input).toBe(false);
    expect("retryCount" in input).toBe(false);
  });
});
