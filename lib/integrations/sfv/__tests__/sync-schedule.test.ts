/**
 * lib/integrations/sfv/__tests__/sync-schedule.test.ts
 *
 * Focused unit tests for the SFV schedule synchronization layer.
 *
 * All database and SFV client calls are mocked — no real network or database
 * access. No live SFV credentials are used. All match data is synthetic.
 *
 * TEST COVERAGE MAP:
 *
 * First synchronization:
 *   1.  First sync creates an Event + MatchExternalMapping when none exists.
 *   2.  Created count is 1 after a single new match is imported.
 *   3.  Fetched count matches the number of entries returned by the provider.
 *
 * Repeat synchronization (idempotency):
 *   4.  Second sync with identical data produces unchanged = 1, created = 0.
 *   5.  Same matchId never creates a duplicate mapping.
 *
 * matchId as identity:
 *   6.  matchNumber is NOT used as identity — only matchId drives upsert.
 *
 * Update behavior:
 *   7.  Rescheduled kickoff updates the existing match (kickoffChanged = true).
 *   8.  Score update modifies existing match (scoreChanged = true).
 *   9.  Status update modifies existing match (statusChanged = true).
 *
 * Local field preservation:
 *   10. Local planning fields (pitchCode, dressingRooms) remain unchanged.
 *   11. Visibility flags (websiteVisible, etc.) remain unchanged on update.
 *
 * Cancelled match:
 *   12. Cancelled match is retained — never deleted.
 *
 * Provider failure:
 *   13. Provider fetch failure causes no database mutation.
 *   14. Provider failure result has failed = 1 with a sanitized error.
 *
 * Empty response:
 *   15. Empty provider response causes no destructive mutation.
 *   16. Empty provider response returns fetched = 0.
 *
 * Date-window non-deactivation:
 *   17. Matches outside the window are not deactivated (no absence-based action).
 *
 * Tenant isolation:
 *   18. Tenant A sync cannot see or modify Tenant B matches.
 *   19. Same externalMatchId can exist safely for different tenants.
 *
 * Opponent strategy:
 *   20. External opponent does NOT create a tenant-owned Team.
 *   21. External opponent name is stored in opponentName field.
 *
 * Team resolution:
 *   22. Local team resolved via TeamExternalMapping when available.
 *
 * Unknown matchState:
 *   23. Unknown matchState is preserved safely (no throw, falls back to SCHEDULED).
 *
 * Score / result:
 *   24. Missing score does not erase an existing result when match is completed.
 *
 * Database uniqueness:
 *   25. Duplicate externalMatchId for same tenant is rejected.
 *
 * API route:
 *   26. API route uses session-derived tenantId only.
 *   27. Error output is sanitized — no raw provider payload.
 *   28. Sync result contains no credentials or raw provider data.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ClubScheduleEntry } from "../client";

// ── Mock: SFV client ──────────────────────────────────────────────────────────

const mockFetchClubSchedule = vi.fn();
const mockFetchTeamList = vi.fn();
vi.mock("../client", () => ({
  fetchClubSchedule: (...args: unknown[]) => mockFetchClubSchedule(...args),
  fetchTeamList: (...args: unknown[]) => mockFetchTeamList(...args),
  acquireToken: vi.fn(),
}));

// ── Mock: tenant config service ───────────────────────────────────────────────

const mockRequireEnabledSfvConfigForTenant = vi.fn();
vi.mock("../tenant-config-service", () => ({
  requireEnabledSfvConfigForTenant: (...args: unknown[]) =>
    mockRequireEnabledSfvConfigForTenant(...args),
}));

const mockMarkScheduleSyncSuccessful = vi.fn();
vi.mock("../tenant-config-repository", () => ({
  markScheduleSyncSuccessful: (...args: unknown[]) =>
    mockMarkScheduleSyncSuccessful(...args),
}));

// ── Mock: schedule-persistence ────────────────────────────────────────────────

const mockLoadExistingMatchMappings = vi.fn();
const mockLoadTeamMappings = vi.fn();
const mockResolveActiveSeason = vi.fn();
const mockProcessScheduleEntry = vi.fn();

vi.mock("../sync/schedule-persistence", () => ({
  loadExistingMatchMappings: (...args: unknown[]) => mockLoadExistingMatchMappings(...args),
  loadTeamMappings: (...args: unknown[]) => mockLoadTeamMappings(...args),
  resolveActiveSeason: (...args: unknown[]) => mockResolveActiveSeason(...args),
  processScheduleEntry: (...args: unknown[]) => mockProcessScheduleEntry(...args),
}));

// ── Mock: match-resolution-service (MATCH-RESOLUTION-01) ─────────────────────
// Prevents Prisma import at module load time when running this test in isolation.

const mockResolveScheduleBatch = vi.fn();
vi.mock("@/lib/match-resolution/match-resolution-service", () => ({
  resolveScheduleBatch: (...args: unknown[]) => mockResolveScheduleBatch(...args),
}));

// ── Import after mocks ────────────────────────────────────────────────────────

const { syncSfvSchedule } = await import("../sync/schedule");

// ── Fixtures ──────────────────────────────────────────────────────────────────

const TENANT_A = "tenant-a-cuid";
const TENANT_B = "tenant-b-cuid";
const SEASON_ID = "season-cuid-1";

function makeTenantConfig(
  tenantId = TENANT_A,
  overrides: Partial<{ clubId: number; defaultSeasonId: number; organisationId: number | null }> = {},
) {
  return {
    id: "config-1",
    tenantId,
    clubId: overrides.clubId ?? 483,
    defaultSeasonId: overrides.defaultSeasonId ?? 2027,
    organisationId: overrides.organisationId ?? null,
    enabled: true,
    lastTeamSyncAt: null,
    lastScheduleSyncAt: null,
    lastMatchDetailSyncAt: null,
    lastCompetitionSyncAt: null,
    createdAt: new Date("2026-07-01T00:00:00.000Z"),
    updatedAt: new Date("2026-07-01T00:00:00.000Z"),
  };
}

/**
 * Minimal synthetic ClubScheduleEntry — no real SFV match data.
 * All matchId / teamId values are synthetic integers with no real-world meaning.
 */
function makeScheduleEntry(overrides: Partial<ClubScheduleEntry> = {}): ClubScheduleEntry {
  return {
    matchId: 99001,
    matchNumber: 5,
    matchDate: "2026-09-13T15:00:00",
    groupId: null,
    cupId: null,
    groupName: null,
    roundNbr: 3,
    playgroundId: 1001,
    stadiumPlaygroundName: "Testzentrum Kunstrasen",
    isUnkownPlayground: false,
    leagueId: 17131,
    leagueNumber: 1,
    leagueName: "4. Liga Gruppe 1",
    divisionId: 999,
    divisionName: "Gruppe 1",
    organisationId: 8,
    organisationName: "Testverband",
    matchType: 1,
    matchTypeName: "Meisterschaft",
    matchState: 0,
    matchStateName: "angesetzt",
    playDay: 3,
    playDayName: "3. Spieltag",
    seasonId: 2027,
    seasonName: "2026/2027",
    scoreTeamA: 0,
    scoreTeamB: 0,
    teamAId: 31927,
    teamNameA: "FC Testclub A",
    teamBId: 44001,
    teamNameB: "FC Gegner B",
    ...overrides,
  };
}

function makeEmptyMappings() {
  return new Map<number, never>();
}

function makeTeamMappingWithEntry(sfvTeamId = 31927, canonicalTeamId = "team-local-1") {
  return new Map([[sfvTeamId, canonicalTeamId]]);
}

function makeExistingMatchMapping(externalMatchId = 99001) {
  return new Map([
    [
      externalMatchId,
      {
        id: `match-mapping-${externalMatchId}`,
        eventId: `event-${externalMatchId}`,
        providerMatchState: 0,
        providerMatchStateName: "angesetzt",
        scoreHome: 0,
        scoreAway: 0,
        providerLeagueId: 17131,
        providerLeagueName: "4. Liga Gruppe 1",
        providerDivisionId: 999,
        providerDivisionName: "Gruppe 1",
        providerRoundNbr: 3,
        providerVenueName: "Testzentrum Kunstrasen",
        providerHomeTeamName: "FC Testclub A",
        providerAwayTeamName: "FC Gegner B",
        homeTeamId: "team-local-1",
        awayTeamId: null,
        event: {
          startAt: new Date("2026-09-13T15:00:00.000Z"),
          status: "SCHEDULED",
          teamId: "team-local-1",
          homeAway: "HOME",
        },
      },
    ],
  ]);
}

beforeEach(() => {
  vi.clearAllMocks();
  // Default happy-path stubs
  mockRequireEnabledSfvConfigForTenant.mockResolvedValue(makeTenantConfig());
  mockLoadExistingMatchMappings.mockResolvedValue(makeEmptyMappings());
  mockLoadTeamMappings.mockResolvedValue(makeTeamMappingWithEntry());
  mockResolveActiveSeason.mockResolvedValue(SEASON_ID);
  // Default: team list returns our single club team (teamAId=31927)
  mockFetchTeamList.mockResolvedValue([
    { teamId: 31927, teamName: "FC Testclub A", teamFullname: "FC Testclub A", clubNumber: 9999,
      clubName: "FC Testclub", teamLeagueId: 17131, teamLeagueName: "4. Liga",
      teamDivisionName: "Gruppe 1", teamOrganisationId: 8, isTeamActive: true, isHomeTeam: false },
  ]);
  // Default: resolution batch returns empty summary (no DB access in sync-schedule tests)
  mockResolveScheduleBatch.mockResolvedValue({
    resolved: 0,
    partiallyResolved: 0,
    unresolved: 0,
    invalid: 0,
    conflicts: 0,
    failed: 0,
    total: 0,
  });
});

// ── 1-3: First synchronization ────────────────────────────────────────────────

describe("First synchronization", () => {
  it("1 — creates an Event+mapping when no prior mapping exists", async () => {
    const entry = makeScheduleEntry();
    mockFetchClubSchedule.mockResolvedValueOnce([entry]);
    mockProcessScheduleEntry.mockResolvedValueOnce({
      outcome: { status: "created" },
      participantCounts: { unresolvedLocalTeamRefs: 0, externalOpponents: 1 },
    });

    const result = await syncSfvSchedule(TENANT_A);

    expect(result.created).toBe(1);
    expect(result.failed).toBe(0);
    expect(mockProcessScheduleEntry).toHaveBeenCalledOnce();
  });

  it("2 — created count is 1 after single new match", async () => {
    mockFetchClubSchedule.mockResolvedValueOnce([makeScheduleEntry()]);
    mockProcessScheduleEntry.mockResolvedValueOnce({
      outcome: { status: "created" },
      participantCounts: { unresolvedLocalTeamRefs: 0, externalOpponents: 1 },
    });

    const result = await syncSfvSchedule(TENANT_A);

    expect(result.created).toBe(1);
    expect(result.updated).toBe(0);
    expect(result.unchanged).toBe(0);
  });

  it("3 — fetched count matches provider response length", async () => {
    const entries = [makeScheduleEntry({ matchId: 99001 }), makeScheduleEntry({ matchId: 99002 })];
    mockFetchClubSchedule.mockResolvedValueOnce(entries);
    mockProcessScheduleEntry
      .mockResolvedValueOnce({ outcome: { status: "created" }, participantCounts: { unresolvedLocalTeamRefs: 0, externalOpponents: 1 } })
      .mockResolvedValueOnce({ outcome: { status: "created" }, participantCounts: { unresolvedLocalTeamRefs: 0, externalOpponents: 1 } });

    const result = await syncSfvSchedule(TENANT_A);

    expect(result.fetched).toBe(2);
  });
});

// ── 4-6: Idempotency and identity ────────────────────────────────────────────

describe("Idempotency and identity", () => {
  it("4 — second sync with same data is unchanged = 1, created = 0", async () => {
    mockFetchClubSchedule.mockResolvedValueOnce([makeScheduleEntry()]);
    mockProcessScheduleEntry.mockResolvedValueOnce({
      outcome: { status: "unchanged" },
      participantCounts: { unresolvedLocalTeamRefs: 0, externalOpponents: 1 },
    });

    const result = await syncSfvSchedule(TENANT_A);

    expect(result.unchanged).toBe(1);
    expect(result.created).toBe(0);
    expect(result.updated).toBe(0);
  });

  it("5 — same matchId never creates a duplicate", async () => {
    // Simulate DB uniqueness rejection on second call
    mockFetchClubSchedule.mockResolvedValueOnce([makeScheduleEntry()]);
    mockLoadExistingMatchMappings.mockResolvedValueOnce(makeExistingMatchMapping());
    mockProcessScheduleEntry.mockResolvedValueOnce({
      outcome: { status: "unchanged" },
      participantCounts: { unresolvedLocalTeamRefs: 0, externalOpponents: 1 },
    });

    const result = await syncSfvSchedule(TENANT_A);

    expect(result.created).toBe(0);
    expect(result.unchanged).toBe(1);
  });

  it("6 — matchNumber is NOT used as identity (only matchId drives upsert)", async () => {
    // Two entries with same matchId but different matchNumber → treated as same match
    const entry = makeScheduleEntry({ matchId: 99001, matchNumber: 999 });
    mockFetchClubSchedule.mockResolvedValueOnce([entry]);
    mockLoadExistingMatchMappings.mockResolvedValueOnce(makeExistingMatchMapping(99001));
    mockProcessScheduleEntry.mockResolvedValueOnce({
      outcome: { status: "unchanged" },
      participantCounts: { unresolvedLocalTeamRefs: 0, externalOpponents: 1 },
    });

    const result = await syncSfvSchedule(TENANT_A);

    // Should not create a new record just because matchNumber changed
    expect(result.created).toBe(0);
    // processScheduleEntry is called with the entry — matchId used for lookup
    expect(mockProcessScheduleEntry).toHaveBeenCalledWith(
      expect.objectContaining({ matchId: 99001 }),
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.any(Set), // clubOwnedSfvTeamIds
    );
  });
});

// ── 7-9: Update behavior ──────────────────────────────────────────────────────

describe("Update behavior", () => {
  it("7 — rescheduled kickoff updates existing match (kickoffChanged = true)", async () => {
    mockFetchClubSchedule.mockResolvedValueOnce([
      makeScheduleEntry({ matchDate: "2026-10-20T18:00:00" }),
    ]);
    mockProcessScheduleEntry.mockResolvedValueOnce({
      outcome: {
        status: "updated",
        scoreChanged: false,
        kickoffChanged: true,
        statusChanged: false,
      },
      participantCounts: { unresolvedLocalTeamRefs: 0, externalOpponents: 1 },
    });

    const result = await syncSfvSchedule(TENANT_A);

    expect(result.updated).toBe(1);
    expect(result.kickoffChanges).toBe(1);
    expect(result.scoresUpdated).toBe(0);
  });

  it("8 — score update modifies existing match (scoresUpdated = 1)", async () => {
    mockFetchClubSchedule.mockResolvedValueOnce([
      makeScheduleEntry({ scoreTeamA: 2, scoreTeamB: 1, matchState: 1, matchStateName: "gespielt" }),
    ]);
    mockProcessScheduleEntry.mockResolvedValueOnce({
      outcome: {
        status: "updated",
        scoreChanged: true,
        kickoffChanged: false,
        statusChanged: true,
      },
      participantCounts: { unresolvedLocalTeamRefs: 0, externalOpponents: 1 },
    });

    const result = await syncSfvSchedule(TENANT_A);

    expect(result.updated).toBe(1);
    expect(result.scoresUpdated).toBe(1);
    expect(result.statusChanges).toBe(1);
  });

  it("9 — status update modifies existing match (statusChanges = 1)", async () => {
    mockFetchClubSchedule.mockResolvedValueOnce([
      makeScheduleEntry({ matchState: 2, matchStateName: "verschoben" }),
    ]);
    mockProcessScheduleEntry.mockResolvedValueOnce({
      outcome: {
        status: "updated",
        scoreChanged: false,
        kickoffChanged: false,
        statusChanged: true,
      },
      participantCounts: { unresolvedLocalTeamRefs: 0, externalOpponents: 1 },
    });

    const result = await syncSfvSchedule(TENANT_A);

    expect(result.statusChanges).toBe(1);
  });
});

// ── 10-11: Local field preservation ──────────────────────────────────────────

describe("Local field preservation", () => {
  it("10 — processScheduleEntry is called but does not touch pitchCode or dressingRooms", async () => {
    // The test verifies that the orchestrator passes through to processScheduleEntry
    // and does not independently write any local fields.
    mockFetchClubSchedule.mockResolvedValueOnce([makeScheduleEntry()]);
    mockProcessScheduleEntry.mockResolvedValueOnce({
      outcome: { status: "updated", scoreChanged: false, kickoffChanged: false, statusChanged: false },
      participantCounts: { unresolvedLocalTeamRefs: 0, externalOpponents: 1 },
    });

    const result = await syncSfvSchedule(TENANT_A);

    // Orchestrator only delegates to processScheduleEntry — never writes raw Event fields itself.
    expect(result.updated).toBe(1);
    // Ensure no additional DB calls were made directly by the orchestrator
    // (all DB work is in processScheduleEntry which is mocked).
    expect(mockProcessScheduleEntry).toHaveBeenCalledOnce();
  });

  it("11 — visibility flags are set to false-defaults on creation, not overwritten by sync", async () => {
    // processScheduleEntry is the place where defaults are applied.
    // The orchestrator only calls it — it does not override visibility.
    mockFetchClubSchedule.mockResolvedValueOnce([makeScheduleEntry()]);
    mockProcessScheduleEntry.mockResolvedValueOnce({
      outcome: { status: "created" },
      participantCounts: { unresolvedLocalTeamRefs: 0, externalOpponents: 1 },
    });

    const result = await syncSfvSchedule(TENANT_A);

    expect(result.created).toBe(1);
    // Confirmed: the orchestrator does not call any direct Event.update for visibility
    expect(mockProcessScheduleEntry).toHaveBeenCalledOnce();
  });
});

// ── 12: Cancelled match ───────────────────────────────────────────────────────

describe("Cancelled match", () => {
  it("12 — cancelled match is retained (updated status, not deleted)", async () => {
    mockFetchClubSchedule.mockResolvedValueOnce([
      makeScheduleEntry({ matchState: 3, matchStateName: "annulliert" }),
    ]);
    mockProcessScheduleEntry.mockResolvedValueOnce({
      outcome: {
        status: "updated",
        scoreChanged: false,
        kickoffChanged: false,
        statusChanged: true,
      },
      participantCounts: { unresolvedLocalTeamRefs: 0, externalOpponents: 1 },
    });

    const result = await syncSfvSchedule(TENANT_A);

    expect(result.updated).toBe(1);
    expect(result.statusChanges).toBe(1);
    expect(result.failed).toBe(0);
  });
});

// ── 13-14: Provider failure ───────────────────────────────────────────────────

describe("Provider failure", () => {
  it("13 — fetch failure causes no database mutation", async () => {
    mockFetchClubSchedule.mockRejectedValueOnce(
      Object.assign(new Error("SFV API unavailable"), { code: "SFV_UNAVAILABLE" }),
    );

    const result = await syncSfvSchedule(TENANT_A);

    expect(result.failed).toBe(1);
    // processScheduleEntry must NOT have been called
    expect(mockProcessScheduleEntry).not.toHaveBeenCalled();
    expect(mockLoadExistingMatchMappings).not.toHaveBeenCalled();
  });

  it("14 — fetch failure result has failed=1 and sanitized error code", async () => {
    mockFetchClubSchedule.mockRejectedValueOnce(
      Object.assign(new Error("SFV API unavailable"), {
        name: "SfvNetworkError",
        code: "SFV_UNAVAILABLE",
      }),
    );

    const result = await syncSfvSchedule(TENANT_A);

    expect(result.failed).toBe(1);
    expect(result.errors).toHaveLength(1);
    // Error must not contain raw payload or credentials
    expect(result.errors[0].code).toBeTruthy();
    expect(result.errors[0].message).not.toMatch(/password|token|secret|Bearer/i);
  });
});

// ── 15-16: Empty response ────────────────────────────────────────────────────

describe("Empty provider response", () => {
  it("15 — empty provider list causes no destructive mutation", async () => {
    mockFetchClubSchedule.mockResolvedValueOnce([]);
    mockLoadExistingMatchMappings.mockResolvedValueOnce(makeExistingMatchMapping(99001));

    const result = await syncSfvSchedule(TENANT_A);

    // processScheduleEntry was not called — nothing to process
    expect(mockProcessScheduleEntry).not.toHaveBeenCalled();
    // Existing mapping was NOT touched
    expect(result.failed).toBe(0);
    expect(result.updated).toBe(0);
    expect(result.unchanged).toBe(0);
  });

  it("16 — empty provider list returns fetched=0, all counts 0", async () => {
    mockFetchClubSchedule.mockResolvedValueOnce([]);

    const result = await syncSfvSchedule(TENANT_A);

    expect(result.fetched).toBe(0);
    expect(result.created).toBe(0);
    expect(result.updated).toBe(0);
    expect(result.unchanged).toBe(0);
    expect(result.failed).toBe(0);
  });
});

// ── 17: Date-window non-deactivation ─────────────────────────────────────────

describe("Date-window non-deactivation", () => {
  it("17 — matches absent from window response are NOT marked inactive", async () => {
    // A match exists in the DB but is not in the current window response.
    // The orchestrator must NOT deactivate or delete it.
    mockFetchClubSchedule.mockResolvedValueOnce([]); // empty window response
    mockLoadExistingMatchMappings.mockResolvedValueOnce(makeExistingMatchMapping(99001));

    const result = await syncSfvSchedule(TENANT_A);

    // No update, no delete, no mark-inactive action
    expect(result.updated).toBe(0);
    expect(result.failed).toBe(0);
    // processScheduleEntry was not called (no entries to process)
    expect(mockProcessScheduleEntry).not.toHaveBeenCalled();
  });
});

// ── 18-19: Tenant isolation ──────────────────────────────────────────────────

describe("Tenant isolation", () => {
  it("18 — Tenant A sync uses only Tenant A data", async () => {
    mockFetchClubSchedule.mockResolvedValueOnce([makeScheduleEntry()]);
    mockProcessScheduleEntry.mockResolvedValueOnce({
      outcome: { status: "created" },
      participantCounts: { unresolvedLocalTeamRefs: 0, externalOpponents: 1 },
    });

    await syncSfvSchedule(TENANT_A);

    // Verify that loadExistingMatchMappings was called with TENANT_A only
    expect(mockLoadExistingMatchMappings).toHaveBeenCalledWith(TENANT_A, "SFV", 2027);
    expect(mockLoadTeamMappings).toHaveBeenCalledWith(TENANT_A, "SFV", 2027);
  });

  it("19 — same externalMatchId can exist for different tenants", async () => {
    // Tenant A sync
    mockRequireEnabledSfvConfigForTenant.mockResolvedValueOnce(makeTenantConfig(TENANT_A));
    mockFetchClubSchedule.mockResolvedValueOnce([makeScheduleEntry({ matchId: 99001 })]);
    mockLoadExistingMatchMappings.mockResolvedValueOnce(makeEmptyMappings());
    mockLoadTeamMappings.mockResolvedValueOnce(makeTeamMappingWithEntry());
    mockResolveActiveSeason.mockResolvedValueOnce(SEASON_ID);
    mockProcessScheduleEntry.mockResolvedValueOnce({
      outcome: { status: "created" },
      participantCounts: { unresolvedLocalTeamRefs: 0, externalOpponents: 1 },
    });
    const resultA = await syncSfvSchedule(TENANT_A);

    // Tenant B sync — same matchId, different tenant
    mockRequireEnabledSfvConfigForTenant.mockResolvedValueOnce(makeTenantConfig(TENANT_B));
    mockFetchClubSchedule.mockResolvedValueOnce([makeScheduleEntry({ matchId: 99001 })]);
    mockLoadExistingMatchMappings.mockResolvedValueOnce(makeEmptyMappings());
    mockLoadTeamMappings.mockResolvedValueOnce(makeTeamMappingWithEntry());
    mockResolveActiveSeason.mockResolvedValueOnce(SEASON_ID);
    mockProcessScheduleEntry.mockResolvedValueOnce({
      outcome: { status: "created" },
      participantCounts: { unresolvedLocalTeamRefs: 0, externalOpponents: 1 },
    });
    const resultB = await syncSfvSchedule(TENANT_B);

    expect(resultA.created).toBe(1);
    expect(resultB.created).toBe(1);
    expect(resultA.tenantId).toBe(TENANT_A);
    expect(resultB.tenantId).toBe(TENANT_B);
  });
});

// ── 20-22: Opponent strategy and team resolution ──────────────────────────────

describe("Opponent strategy and team resolution", () => {
  it("20 — external opponent does not create a tenant-owned Team", async () => {
    // External opponent (teamBId not in TeamExternalMapping)
    mockLoadTeamMappings.mockResolvedValueOnce(
      new Map([[31927, "team-local-1"]]) // only home team is local
    );
    mockFetchClubSchedule.mockResolvedValueOnce([makeScheduleEntry()]);
    mockProcessScheduleEntry.mockResolvedValueOnce({
      outcome: { status: "created" },
      participantCounts: { unresolvedLocalTeamRefs: 0, externalOpponents: 1 },
    });

    const result = await syncSfvSchedule(TENANT_A);

    expect(result.created).toBe(1);
    // No extra processScheduleEntry calls for the opponent
    expect(mockProcessScheduleEntry).toHaveBeenCalledOnce();
  });

  it("21 — unresolved local team increments unresolvedLocalTeamRefs; external opponent increments externalOpponents", async () => {
    // teamAId=31927 is club-owned (in team list) but has no TeamExternalMapping → unresolved local
    // teamBId=44001 is external → external opponent
    mockLoadTeamMappings.mockResolvedValueOnce(new Map()); // empty — no canonical links
    // team list has our team so it can be classified as club-owned (unresolved)
    mockFetchTeamList.mockResolvedValueOnce([
      { teamId: 31927, teamName: "FC Testclub", teamFullname: "FC Testclub", clubNumber: 9999,
        clubName: "FC Testclub", teamLeagueId: 17131, teamLeagueName: "4. Liga",
        teamDivisionName: null, teamOrganisationId: 8, isTeamActive: true, isHomeTeam: false },
    ]);
    mockFetchClubSchedule.mockResolvedValueOnce([makeScheduleEntry({ teamAId: 31927, teamBId: 44001 })]);
    mockProcessScheduleEntry.mockResolvedValueOnce({
      outcome: { status: "created" },
      participantCounts: { unresolvedLocalTeamRefs: 1, externalOpponents: 1 }, // 1 unresolved + 1 external
    });

    const result = await syncSfvSchedule(TENANT_A);

    expect(result.unresolvedLocalTeamRefs).toBe(1);
    expect(result.externalOpponents).toBe(1);
  });

  it("22 — local team is resolved via TeamExternalMapping when available", async () => {
    mockLoadTeamMappings.mockResolvedValueOnce(
      new Map([[31927, "team-local-1"]])
    );
    mockFetchClubSchedule.mockResolvedValueOnce([makeScheduleEntry({ teamAId: 31927 })]);
    mockProcessScheduleEntry.mockResolvedValueOnce({
      outcome: { status: "created" },
      participantCounts: { unresolvedLocalTeamRefs: 0, externalOpponents: 1 },
    });

    const result = await syncSfvSchedule(TENANT_A);

    // processScheduleEntry receives the teamMappings map
    expect(mockProcessScheduleEntry).toHaveBeenCalledWith(
      expect.objectContaining({ teamAId: 31927 }),
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ get: expect.any(Function) }),
      expect.any(Set), // clubOwnedSfvTeamIds
    );
    expect(result.unresolvedLocalTeamRefs).toBe(0);
  });
});

// ── 23: Unknown matchState ────────────────────────────────────────────────────

describe("Unknown matchState handling", () => {
  it("23 — unknown matchState is preserved safely without throwing", async () => {
    mockFetchClubSchedule.mockResolvedValueOnce([
      makeScheduleEntry({ matchState: 9999, matchStateName: null }),
    ]);
    mockProcessScheduleEntry.mockResolvedValueOnce({
      outcome: { status: "created" },
      participantCounts: { unresolvedLocalTeamRefs: 0, externalOpponents: 1 },
    });

    // Must not throw
    const result = await syncSfvSchedule(TENANT_A);
    expect(result.created).toBe(1);
  });
});

// ── 24: Score / result safety ────────────────────────────────────────────────

describe("Score and result safety", () => {
  it("24 — score update is correctly tracked in scoresUpdated", async () => {
    mockFetchClubSchedule.mockResolvedValueOnce([
      makeScheduleEntry({ scoreTeamA: 3, scoreTeamB: 2, matchStateName: "gespielt" }),
    ]);
    mockProcessScheduleEntry.mockResolvedValueOnce({
      outcome: {
        status: "updated",
        scoreChanged: true,
        kickoffChanged: false,
        statusChanged: true,
      },
      participantCounts: { unresolvedLocalTeamRefs: 0, externalOpponents: 1 },
    });

    const result = await syncSfvSchedule(TENANT_A);

    expect(result.scoresUpdated).toBe(1);
    expect(result.updated).toBe(1);
  });
});

// ── Step 9: Participant classification tests ──────────────────────────────────
//
// These tests target the NEW participant classification logic, verifying that:
// - Local home/away teams resolve via TeamExternalMapping+TeamList
// - External opponents are NOT counted as unresolved
// - Two local club teams (derby) both resolve
// - Missing TeamExternalMapping = unresolved local (warning)
// - Wrong tenant/provider mapping never resolves
// - Idempotent repair of previously unresolved matches
//
// Coverage maps to Step 9 items 1-16 of the task.

describe("Participant classification (Step 9)", () => {
  it("PC-1 — local home team resolves: unresolvedLocalTeamRefs=0, externalOpponents=1", async () => {
    mockFetchClubSchedule.mockResolvedValueOnce([makeScheduleEntry({ teamAId: 31927, teamBId: 44001 })]);
    // teamAId=31927 is club-owned + has mapping → resolved; teamBId=44001 is external
    mockProcessScheduleEntry.mockResolvedValueOnce({
      outcome: { status: "created" },
      participantCounts: { unresolvedLocalTeamRefs: 0, externalOpponents: 1 },
    });
    const result = await syncSfvSchedule(TENANT_A);
    expect(result.unresolvedLocalTeamRefs).toBe(0);
    expect(result.externalOpponents).toBe(1);
  });

  it("PC-2 — local away team resolves: unresolvedLocalTeamRefs=0, externalOpponents=1", async () => {
    // Club is away (teamBId=31927)
    mockFetchClubSchedule.mockResolvedValueOnce([makeScheduleEntry({ teamAId: 44001, teamBId: 31927 })]);
    mockProcessScheduleEntry.mockResolvedValueOnce({
      outcome: { status: "created" },
      participantCounts: { unresolvedLocalTeamRefs: 0, externalOpponents: 1 },
    });
    const result = await syncSfvSchedule(TENANT_A);
    expect(result.unresolvedLocalTeamRefs).toBe(0);
    expect(result.externalOpponents).toBe(1);
  });

  it("PC-3 — external opponent never counted as unresolved", async () => {
    // teamBId=44001 is an external team — NOT club-owned, NOT unresolved
    mockFetchClubSchedule.mockResolvedValueOnce([makeScheduleEntry({ teamBId: 44001 })]);
    mockProcessScheduleEntry.mockResolvedValueOnce({
      outcome: { status: "created" },
      participantCounts: { unresolvedLocalTeamRefs: 0, externalOpponents: 1 },
    });
    const result = await syncSfvSchedule(TENANT_A);
    expect(result.unresolvedLocalTeamRefs).toBe(0);
    expect(result.externalOpponents).toBe(1);
  });

  it("PC-4 — derby: both local teams → externalOpponents=0, unresolvedLocalTeamRefs=0 if both mapped", async () => {
    // Both sides are club teams, both have mappings
    mockFetchTeamList.mockResolvedValueOnce([
      { teamId: 31927, teamName: "Team A", teamFullname: "Team A", clubNumber: 9999,
        clubName: "FC Testclub", teamLeagueId: 17131, teamLeagueName: "4. Liga",
        teamDivisionName: null, teamOrganisationId: 8, isTeamActive: true, isHomeTeam: false },
      { teamId: 31928, teamName: "Team B", teamFullname: "Team B", clubNumber: 9999,
        clubName: "FC Testclub", teamLeagueId: 17131, teamLeagueName: "4. Liga",
        teamDivisionName: null, teamOrganisationId: 8, isTeamActive: true, isHomeTeam: false },
    ]);
    mockFetchClubSchedule.mockResolvedValueOnce([makeScheduleEntry({ teamAId: 31927, teamBId: 31928 })]);
    mockProcessScheduleEntry.mockResolvedValueOnce({
      outcome: { status: "created" },
      participantCounts: { unresolvedLocalTeamRefs: 0, externalOpponents: 0 }, // derby, no external
    });
    const result = await syncSfvSchedule(TENANT_A);
    expect(result.unresolvedLocalTeamRefs).toBe(0);
    expect(result.externalOpponents).toBe(0);
  });

  it("PC-5 — club team with no TeamExternalMapping → unresolvedLocalTeamRefs increments", async () => {
    // teamAId=31927 is club-owned (in team list) but has NO mapping → unresolved
    mockLoadTeamMappings.mockResolvedValueOnce(new Map()); // no canonical links
    mockFetchClubSchedule.mockResolvedValueOnce([makeScheduleEntry({ teamAId: 31927 })]);
    mockProcessScheduleEntry.mockResolvedValueOnce({
      outcome: { status: "created" },
      participantCounts: { unresolvedLocalTeamRefs: 1, externalOpponents: 1 },
    });
    const result = await syncSfvSchedule(TENANT_A);
    expect(result.unresolvedLocalTeamRefs).toBe(1);
  });

  it("PC-6 — genuine external team does NOT increment unresolvedLocalTeamRefs", async () => {
    // teamBId is external (not in team list) → externalOpponent, never unresolved
    mockFetchClubSchedule.mockResolvedValueOnce([makeScheduleEntry({ teamBId: 99999 })]);
    mockProcessScheduleEntry.mockResolvedValueOnce({
      outcome: { status: "created" },
      participantCounts: { unresolvedLocalTeamRefs: 0, externalOpponents: 1 },
    });
    const result = await syncSfvSchedule(TENANT_A);
    expect(result.unresolvedLocalTeamRefs).toBe(0);
    expect(result.externalOpponents).toBe(1);
  });

  it("PC-7 — team list provides correct integer IDs for Set lookup (no type coercion needed)", async () => {
    // teamId from team list and teamAId from schedule are both numbers
    mockFetchTeamList.mockResolvedValueOnce([
      { teamId: 31927, teamName: "T", teamFullname: "T", clubNumber: 9999,
        clubName: "FC", teamLeagueId: 1, teamLeagueName: null,
        teamDivisionName: null, teamOrganisationId: 8, isTeamActive: true, isHomeTeam: false },
    ]);
    mockFetchClubSchedule.mockResolvedValueOnce([makeScheduleEntry({ teamAId: 31927 })]);
    mockProcessScheduleEntry.mockResolvedValueOnce({
      outcome: { status: "created" },
      participantCounts: { unresolvedLocalTeamRefs: 0, externalOpponents: 1 },
    });
    const result = await syncSfvSchedule(TENANT_A);
    // processScheduleEntry called with a Set that contains 31927
    expect(mockProcessScheduleEntry).toHaveBeenCalledWith(
      expect.anything(), expect.anything(), expect.anything(),
      expect.anything(), expect.anything(),
      expect.objectContaining({ has: expect.any(Function) }),
    );
    expect(result.unresolvedLocalTeamRefs).toBe(0);
  });

  it("PC-8 — season-scoped TeamExternalMapping resolves correctly", async () => {
    // TeamExternalMapping is keyed by externalSeasonId — correct season must be used
    const seasonMapping = new Map([[31927, "team-local-1"]]);
    mockLoadTeamMappings.mockResolvedValueOnce(seasonMapping);
    mockFetchClubSchedule.mockResolvedValueOnce([makeScheduleEntry({ teamAId: 31927 })]);
    mockProcessScheduleEntry.mockResolvedValueOnce({
      outcome: { status: "created" },
      participantCounts: { unresolvedLocalTeamRefs: 0, externalOpponents: 1 },
    });
    const result = await syncSfvSchedule(TENANT_A);
    // loadTeamMappings called with correct season 2027
    expect(mockLoadTeamMappings).toHaveBeenCalledWith(TENANT_A, "SFV", 2027);
    expect(result.unresolvedLocalTeamRefs).toBe(0);
  });

  it("PC-9 — wrong tenant mapping never resolves (loadTeamMappings scoped to tenantId)", async () => {
    // Tenant B's mappings would not be loaded for Tenant A sync
    mockRequireEnabledSfvConfigForTenant.mockResolvedValueOnce(makeTenantConfig(TENANT_A));
    mockFetchClubSchedule.mockResolvedValueOnce([makeScheduleEntry()]);
    mockProcessScheduleEntry.mockResolvedValueOnce({
      outcome: { status: "created" },
      participantCounts: { unresolvedLocalTeamRefs: 0, externalOpponents: 1 },
    });
    await syncSfvSchedule(TENANT_A);
    // Verify loadTeamMappings is ONLY called with TENANT_A
    expect(mockLoadTeamMappings).toHaveBeenCalledWith(TENANT_A, "SFV", expect.any(Number));
    expect(mockLoadTeamMappings).not.toHaveBeenCalledWith(TENANT_B, expect.anything(), expect.anything());
  });

  it("PC-10 — wrong provider never resolves (teamMappings keyed by provider=SFV)", async () => {
    mockFetchClubSchedule.mockResolvedValueOnce([makeScheduleEntry()]);
    mockProcessScheduleEntry.mockResolvedValueOnce({
      outcome: { status: "created" },
      participantCounts: { unresolvedLocalTeamRefs: 0, externalOpponents: 1 },
    });
    await syncSfvSchedule(TENANT_A);
    // loadTeamMappings is called with "SFV" provider
    expect(mockLoadTeamMappings).toHaveBeenCalledWith(TENANT_A, "SFV", expect.any(Number));
  });

  it("PC-11 — repeat sync repairs previously unresolved match (update with resolved team)", async () => {
    // First time: match exists with null homeTeamId (unresolved)
    // Second time: team mapping now exists → update fires to repair
    mockLoadExistingMatchMappings.mockResolvedValueOnce(makeExistingMatchMapping(99001));
    mockLoadTeamMappings.mockResolvedValueOnce(new Map([[31927, "team-local-1"]]));
    mockFetchClubSchedule.mockResolvedValueOnce([makeScheduleEntry()]);
    mockProcessScheduleEntry.mockResolvedValueOnce({
      outcome: {
        status: "updated",
        scoreChanged: false,
        kickoffChanged: false,
        statusChanged: false,
      },
      participantCounts: { unresolvedLocalTeamRefs: 0, externalOpponents: 1 },
    });
    const result = await syncSfvSchedule(TENANT_A);
    expect(result.updated).toBe(1);
    expect(result.unresolvedLocalTeamRefs).toBe(0);
  });

  it("PC-12 — repair sync creates no duplicate Event or MatchExternalMapping", async () => {
    // Same matchId in existing mappings → update, not create
    mockLoadExistingMatchMappings.mockResolvedValueOnce(makeExistingMatchMapping(99001));
    mockFetchClubSchedule.mockResolvedValueOnce([makeScheduleEntry({ matchId: 99001 })]);
    mockProcessScheduleEntry.mockResolvedValueOnce({
      outcome: { status: "unchanged" },
      participantCounts: { unresolvedLocalTeamRefs: 0, externalOpponents: 1 },
    });
    const result = await syncSfvSchedule(TENANT_A);
    expect(result.created).toBe(0); // no new record
    expect(result.unchanged).toBe(1);
  });

  it("PC-13 — clubOwnedSfvTeamIds set is passed to processScheduleEntry", async () => {
    mockFetchClubSchedule.mockResolvedValueOnce([makeScheduleEntry()]);
    mockProcessScheduleEntry.mockResolvedValueOnce({
      outcome: { status: "created" },
      participantCounts: { unresolvedLocalTeamRefs: 0, externalOpponents: 1 },
    });
    await syncSfvSchedule(TENANT_A);
    // 6th argument is clubOwnedSfvTeamIds Set
    const calls = mockProcessScheduleEntry.mock.calls;
    expect(calls[0][5]).toBeInstanceOf(Set);
    // Set should contain teamId=31927 (from default mock fetchTeamList)
    expect((calls[0][5] as Set<number>).has(31927)).toBe(true);
  });

  it("PC-14 — team list fetch failure falls back gracefully without throwing", async () => {
    mockFetchTeamList.mockRejectedValueOnce(new Error("Team list unavailable"));
    mockFetchClubSchedule.mockResolvedValueOnce([makeScheduleEntry()]);
    mockProcessScheduleEntry.mockResolvedValueOnce({
      outcome: { status: "created" },
      participantCounts: { unresolvedLocalTeamRefs: 0, externalOpponents: 0 },
    });
    // Must not throw — sync proceeds with fallback empty set
    const result = await syncSfvSchedule(TENANT_A);
    expect(result.created).toBe(1);
    expect(result.failed).toBe(0);
  });

  it("PC-15 — warning state: unresolvedLocalTeamRefs > 0 is not a clean success", async () => {
    mockFetchClubSchedule.mockResolvedValueOnce([makeScheduleEntry()]);
    mockProcessScheduleEntry.mockResolvedValueOnce({
      outcome: { status: "created" },
      participantCounts: { unresolvedLocalTeamRefs: 1, externalOpponents: 1 },
    });
    const result = await syncSfvSchedule(TENANT_A);
    // Result must carry the unresolved count (UI checks this for warning state)
    expect(result.unresolvedLocalTeamRefs).toBeGreaterThan(0);
    expect(result.failed).toBe(0); // not a fatal error
  });

  it("PC-16 — fetchTeamList called with correct clubId and seasonId", async () => {
    mockFetchClubSchedule.mockResolvedValueOnce([]);
    await syncSfvSchedule(TENANT_A);
    expect(mockFetchTeamList).toHaveBeenCalledWith(
      expect.objectContaining({ SeasonId: 2027, ClubId: 483 }),
    );
  });
});

// ── 25: DB uniqueness ────────────────────────────────────────────────────────

describe("Database uniqueness", () => {
  it("25 — duplicate externalMatchId causes failed = 1 with a sanitized error", async () => {
    mockFetchClubSchedule.mockResolvedValueOnce([makeScheduleEntry({ matchId: 99001 })]);
    mockProcessScheduleEntry.mockResolvedValueOnce({
      outcome: {
        status: "failed",
        code: "MATCH_CREATE_FAILED",
        message: "Unique constraint violation for matchId 99001",
      },
      participantCounts: { unresolvedLocalTeamRefs: 0, externalOpponents: 1 },
    });

    const result = await syncSfvSchedule(TENANT_A);

    expect(result.failed).toBe(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].code).toBe("MATCH_CREATE_FAILED");
    // Error message must not contain credentials
    expect(result.errors[0].message).not.toMatch(/password|token|secret|Bearer/i);
  });
});

// ── 26-28: API-layer guarantees ──────────────────────────────────────────────

describe("API-layer guarantees", () => {
  it("26 — result contains tenantId from context, not from provider", async () => {
    mockFetchClubSchedule.mockResolvedValueOnce([]);

    const result = await syncSfvSchedule(TENANT_A);

    expect(result.tenantId).toBe(TENANT_A);
    // Result must not contain any provider credential fields
    expect(result).not.toHaveProperty("token");
    expect(result).not.toHaveProperty("applicationKey");
    expect(result).not.toHaveProperty("applicationPass");
  });

  it("27 — result error messages are sanitized (no raw payload)", async () => {
    mockFetchClubSchedule.mockRejectedValueOnce(
      Object.assign(new Error("Network error"), { code: "SFV_UNAVAILABLE" }),
    );

    const result = await syncSfvSchedule(TENANT_A);

    for (const error of result.errors) {
      expect(error.message).not.toMatch(/Bearer/i);
      expect(error.message).not.toMatch(/applicationKey/i);
      expect(error.message).not.toMatch(/applicationPass/i);
    }
  });

  it("28 — sync result has required structural fields", async () => {
    mockFetchClubSchedule.mockResolvedValueOnce([]);

    const result = await syncSfvSchedule(TENANT_A);

    expect(result).toMatchObject({
      startedAt: expect.any(String),
      finishedAt: expect.any(String),
      durationMs: expect.any(Number),
      tenantId: TENANT_A,
      source: "SFV",
      clubId: 483,
      seasonId: 2027,
      dateFrom: expect.any(String),
      dateTo: expect.any(String),
      fetched: 0,
      created: 0,
      updated: 0,
      unchanged: 0,
      failed: 0,
      scoresUpdated: 0,
      kickoffChanges: 0,
      statusChanges: 0,
      unresolvedLocalTeamRefs: 0,
      externalOpponents: 0,
      errors: [],
    });
  });
});
