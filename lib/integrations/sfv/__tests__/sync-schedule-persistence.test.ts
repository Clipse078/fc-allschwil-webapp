/**
 * lib/integrations/sfv/__tests__/sync-schedule-persistence.test.ts
 *
 * Unit tests for the SFV schedule persistence layer.
 *
 * Verifies that:
 *   - New events are created with homeAway = "HOME" or "AWAY" (never "H" or "A").
 *   - Updates write homeAway = "HOME" or "AWAY".
 *   - Existing "H"/"A" rows are detected as changed and corrected.
 *   - Canonical "HOME"/"AWAY" rows are idempotent (no spurious update).
 *   - infoboardVisible and other local fields are never overwritten.
 *   - The homeAway-only change triggers an update with no other field changing.
 *
 * All Prisma calls are mocked — no real database access.
 *
 * TEST COVERAGE MAP:
 *
 * Create path:
 *   C1. New home match persists homeAway = "HOME".
 *   C2. New away match persists homeAway = "AWAY".
 *   C3. "H" is never written on create.
 *   C4. "A" is never written on create.
 *   C5. websiteVisible defaults to true for home match (PUB-02).
 *   C6. websiteVisible defaults to true for away match (PUB-02).
 *   C7. infoboardVisible defaults to true for home match (PUB-02).
 *   C8. infoboardVisible defaults to false for away match (PUB-02).
 *
 * Update path:
 *   U1. Updated home match writes homeAway = "HOME".
 *   U2. Updated away match writes homeAway = "AWAY".
 *   U3. "H" is never written on update.
 *   U4. "A" is never written on update.
 *   U5. SFV resync does NOT overwrite websiteVisible (PUB-01).
 *   U6. SFV resync does NOT overwrite infoboardVisible (PUB-01).
 *   U7. SFV resync does NOT overwrite homepageVisible (PUB-01).
 *   U8. SFV resync does NOT overwrite pitchCode or dressingRoom codes (PUB-01).
 *
 * Change detection + correction:
 *   D1. Existing homeAway="H" with incoming "HOME" → hasAnyChange=true (triggers update).
 *   D2. Existing homeAway="A" with incoming "AWAY" → hasAnyChange=true (triggers update).
 *   D3. Existing homeAway="HOME" with incoming "HOME" → idempotent (no change).
 *   D4. Existing homeAway="AWAY" with incoming "AWAY" → idempotent (no change).
 *   D5. homeAway-only difference is sufficient to trigger an update.
 *   D6. No update when all synchronized values already match.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ClubScheduleEntry } from "../client";

// ── Mock Prisma ───────────────────────────────────────────────────────────────

const mockEventCreate = vi.fn();
const mockEventUpdate = vi.fn();
const mockMappingCreate = vi.fn();
const mockMappingUpdate = vi.fn();
const mockTransaction = vi.fn();
const mockTombstoneFindMany = vi.fn();

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    $transaction: (fn: (tx: unknown) => Promise<unknown>) => mockTransaction(fn),
    sfvMatchDeletionTombstone: {
      findMany: (...args: unknown[]) => mockTombstoneFindMany(...args),
    },
  },
}));

// ── Import under test ─────────────────────────────────────────────────────────

const {
  createMatchWithMapping,
  updateMatchRecord,
  loadTombstonedExternalMatchIds,
  processScheduleEntry,
} = await import("../sync/schedule-persistence");

const {
  detectChanges,
  buildMappingFields,
} = await import("../sync/schedule-mapper");

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeEntry(overrides: Partial<ClubScheduleEntry> = {}): ClubScheduleEntry {
  return {
    matchId: 99001,
    matchNumber: 1,
    matchDate: "2026-09-13T15:00:00",
    groupId: null,
    cupId: null,
    groupName: null,
    roundNbr: 3,
    playgroundId: 1001,
    stadiumPlaygroundName: "Testzentrum",
    isUnkownPlayground: false,
    leagueId: 17131,
    leagueNumber: 1,
    leagueName: "4. Liga",
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
    teamNameA: "FC Local A",
    teamBId: 44001,
    teamNameB: "FC Opponent B",
    ...overrides,
  };
}

function makeContext() {
  return {
    tenantId: "tenant-test",
    clubId: 483,
    seasonId: 2027,
    organisationId: null,
    dateFrom: "2026-06-13",
    dateTo: "2026-10-11",
    syncedAt: new Date("2026-07-13T10:00:00.000Z"),
  };
}

function makeExistingMappingSnapshot(overrides: Partial<{
  providerMatchState: number | null;
  providerMatchStateName: string | null;
  scoreHome: number | null;
  scoreAway: number | null;
  providerLeagueId: number | null;
  providerLeagueName: string | null;
  providerDivisionId: number | null;
  providerDivisionName: string | null;
  providerRoundNbr: number | null;
  providerVenueName: string | null;
  providerHomeTeamName: string | null;
  providerAwayTeamName: string | null;
  homeTeamId: string | null;
  awayTeamId: string | null;
}> = {}) {
  return {
    providerMatchState: 0,
    providerMatchStateName: "angesetzt",
    scoreHome: 0,
    scoreAway: 0,
    providerLeagueId: 17131,
    providerLeagueName: "4. Liga",
    providerDivisionId: 999,
    providerDivisionName: "Gruppe 1",
    providerRoundNbr: 3,
    providerVenueName: "Testzentrum",
    providerHomeTeamName: "FC Local A",
    providerAwayTeamName: "FC Opponent B",
    homeTeamId: "team-1" as string | null,
    awayTeamId: null as string | null,
    ...overrides,
  };
}

function makeExistingEventSnapshot(homeAway: string | null, overrides: Partial<{
  startAt: Date;
  status: string;
  teamId: string | null;
}> = {}) {
  return {
    startAt: new Date("2026-09-13T15:00:00.000Z"),
    status: "SCHEDULED",
    teamId: "team-1" as string | null,
    homeAway,
    ...overrides,
  };
}

// ── Setup transaction mock ────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
    const tx = {
      event: { create: mockEventCreate, update: mockEventUpdate },
      matchExternalMapping: { create: mockMappingCreate, update: mockMappingUpdate },
    };
    mockEventCreate.mockResolvedValue({ id: "new-event-id" });
    mockEventUpdate.mockResolvedValue({});
    mockMappingCreate.mockResolvedValue({});
    mockMappingUpdate.mockResolvedValue({});
    return fn(tx);
  });
  mockTombstoneFindMany.mockResolvedValue([]);
});

// ── C1–C5: Create path ────────────────────────────────────────────────────────

describe("createMatchWithMapping — homeAway", () => {
  it("C1: new home match persists homeAway='HOME'", async () => {
    const result = await createMatchWithMapping(
      makeEntry(),
      makeContext(),
      "season-1",
      "team-1",
      "FC Opponent B",
      true, // isHome
      "team-1",
      null,
    );

    expect(result.status).toBe("created");
    expect(mockEventCreate).toHaveBeenCalledOnce();
    const createData = mockEventCreate.mock.calls[0][0].data;
    expect(createData.homeAway).toBe("HOME");
  });

  it("C2: new away match persists homeAway='AWAY'", async () => {
    const result = await createMatchWithMapping(
      makeEntry(),
      makeContext(),
      "season-1",
      "team-1",
      "FC Local A",
      false, // isHome=false → AWAY
      null,
      "team-1",
    );

    expect(result.status).toBe("created");
    const createData = mockEventCreate.mock.calls[0][0].data;
    expect(createData.homeAway).toBe("AWAY");
  });

  it("C3: 'H' is never written on create", async () => {
    await createMatchWithMapping(
      makeEntry(),
      makeContext(),
      "season-1",
      "team-1",
      "FC Opponent B",
      true,
      "team-1",
      null,
    );
    const createData = mockEventCreate.mock.calls[0][0].data;
    expect(createData.homeAway).not.toBe("H");
  });

  it("C4: 'A' is never written on create", async () => {
    await createMatchWithMapping(
      makeEntry(),
      makeContext(),
      "season-1",
      "team-1",
      "FC Local A",
      false,
      null,
      "team-1",
    );
    const createData = mockEventCreate.mock.calls[0][0].data;
    expect(createData.homeAway).not.toBe("A");
  });

  it("C5: websiteVisible defaults to true for home match (PUB-02)", async () => {
    await createMatchWithMapping(
      makeEntry(),
      makeContext(),
      "season-1",
      "team-1",
      "FC Opponent B",
      true, // isHome
      "team-1",
      null,
    );
    const createData = mockEventCreate.mock.calls[0][0].data;
    expect(createData.websiteVisible).toBe(true);
  });

  it("C6: websiteVisible defaults to true for away match (PUB-02)", async () => {
    await createMatchWithMapping(
      makeEntry(),
      makeContext(),
      "season-1",
      null,
      "FC Allschwil",
      false, // isHome → away match
      null,
      "team-1",
    );
    const createData = mockEventCreate.mock.calls[0][0].data;
    expect(createData.websiteVisible).toBe(true);
  });

  it("C7: infoboardVisible defaults to true for home match (PUB-02)", async () => {
    await createMatchWithMapping(
      makeEntry(),
      makeContext(),
      "season-1",
      "team-1",
      "FC Opponent B",
      true, // isHome
      "team-1",
      null,
    );
    const createData = mockEventCreate.mock.calls[0][0].data;
    expect(createData.infoboardVisible).toBe(true);
  });

  it("C8: infoboardVisible defaults to false for away match (PUB-02)", async () => {
    await createMatchWithMapping(
      makeEntry(),
      makeContext(),
      "season-1",
      null,
      "FC Allschwil",
      false, // isHome → away match
      null,
      "team-1",
    );
    const createData = mockEventCreate.mock.calls[0][0].data;
    expect(createData.infoboardVisible).toBe(false);
  });
});

// ── U1–U4: Update path ────────────────────────────────────────────────────────

describe("updateMatchRecord — homeAway", () => {
  it("U1: updated home match writes homeAway='HOME'", async () => {
    const result = await updateMatchRecord(
      "mapping-1",
      "event-1",
      makeEntry(),
      makeContext(),
      "FC Opponent B",
      "team-1",
      null,
      "team-1",
      true, // isHome
    );

    expect(result.status).toBe("updated");
    const updateData = mockEventUpdate.mock.calls[0][0].data;
    expect(updateData.homeAway).toBe("HOME");
  });

  it("U2: updated away match writes homeAway='AWAY'", async () => {
    const result = await updateMatchRecord(
      "mapping-1",
      "event-1",
      makeEntry(),
      makeContext(),
      "FC Local A",
      null,
      "team-1",
      "team-1",
      false, // isHome=false → AWAY
    );

    expect(result.status).toBe("updated");
    const updateData = mockEventUpdate.mock.calls[0][0].data;
    expect(updateData.homeAway).toBe("AWAY");
  });

  it("U3: 'H' is never written on update", async () => {
    await updateMatchRecord(
      "mapping-1",
      "event-1",
      makeEntry(),
      makeContext(),
      "FC Opponent B",
      "team-1",
      null,
      "team-1",
      true,
    );
    const updateData = mockEventUpdate.mock.calls[0][0].data;
    expect(updateData.homeAway).not.toBe("H");
  });

  it("U4: 'A' is never written on update", async () => {
    await updateMatchRecord(
      "mapping-1",
      "event-1",
      makeEntry(),
      makeContext(),
      "FC Local A",
      null,
      "team-1",
      "team-1",
      false,
    );
    const updateData = mockEventUpdate.mock.calls[0][0].data;
    expect(updateData.homeAway).not.toBe("A");
  });

  it("heals explicit NOT_PLAYED from COMPLETED to SCHEDULED and clears resultLabel", async () => {
    await updateMatchRecord(
      "mapping-1",
      "event-1",
      makeEntry({ matchStateName: "noch nicht ausgetragen", scoreTeamA: 0, scoreTeamB: 0 }),
      makeContext(),
      "FC Opponent B",
      "team-1",
      null,
      "team-1",
      true,
      null,
      null,
      "COMPLETED",
    );

    expect(mockEventUpdate.mock.calls[0][0].data).toEqual(
      expect.objectContaining({
        status: "SCHEDULED",
        resultLabel: null,
      }),
    );
  });

  it("heals SFV Nullwertung from COMPLETED to SCHEDULED, preserves raw 0:0 scores", async () => {
    await updateMatchRecord(
      "mapping-1",
      "event-1",
      makeEntry({
        matchId: 4361827,
        matchStateName: "Null zu Null - Null Punkte",
        scoreTeamA: 0,
        scoreTeamB: 0,
      }),
      makeContext(),
      "US Olympia 1963 rot",
      "team-1",
      null,
      "team-1",
      true,
      null,
      null,
      "COMPLETED",
    );

    expect(mockEventUpdate.mock.calls[0][0].data).toEqual(
      expect.objectContaining({
        status: "SCHEDULED",
        resultLabel: null,
      }),
    );
    expect(mockMappingUpdate.mock.calls[0][0].data).toEqual(
      expect.objectContaining({
        scoreHome: 0,
        scoreAway: 0,
        providerMatchStateName: "Null zu Null - Null Punkte",
      }),
    );
  });

  it("protects genuine COMPLETED status when provider disposition is UNKNOWN", async () => {
    await updateMatchRecord(
      "mapping-1",
      "event-1",
      makeEntry({ matchStateName: "unbekannt", scoreTeamA: 2, scoreTeamB: 1 }),
      makeContext(),
      "FC Opponent B",
      "team-1",
      null,
      "team-1",
      true,
      null,
      null,
      "COMPLETED",
    );

    expect(mockEventUpdate.mock.calls[0][0].data).toEqual(
      expect.objectContaining({
        status: "COMPLETED",
        resultLabel: "2:1",
      }),
    );
  });

  // ── U5–U8: PUB-01 — SFV resync must NOT overwrite manually managed fields ──
  //
  // When the admin sets websiteVisible=true and a subsequent SFV schedule sync
  // runs, the update must NOT reset websiteVisible to false or touch ANY
  // locally managed field. Only the SFV-owned fields listed in updateMatchRecord
  // may appear in the Prisma update data.

  it("U5: SFV resync does NOT overwrite websiteVisible (PUB-01 mandatory)", async () => {
    await updateMatchRecord(
      "mapping-1",
      "event-1",
      makeEntry(),
      makeContext(),
      "FC Concordia Basel",
      null,
      "team-1",
      "team-1",
      false, // isHome=false → AWAY (the test match scenario)
    );
    const updateData = mockEventUpdate.mock.calls[0][0].data;
    // websiteVisible must NOT appear in the update payload at all
    expect(updateData).not.toHaveProperty("websiteVisible");
  });

  it("U6: SFV resync does NOT overwrite infoboardVisible (PUB-01 mandatory)", async () => {
    await updateMatchRecord(
      "mapping-1",
      "event-1",
      makeEntry(),
      makeContext(),
      "FC Concordia Basel",
      null,
      "team-1",
      "team-1",
      false,
    );
    const updateData = mockEventUpdate.mock.calls[0][0].data;
    expect(updateData).not.toHaveProperty("infoboardVisible");
  });

  it("U7: SFV resync does NOT overwrite homepageVisible (PUB-01 mandatory)", async () => {
    await updateMatchRecord(
      "mapping-1",
      "event-1",
      makeEntry(),
      makeContext(),
      "FC Concordia Basel",
      null,
      "team-1",
      "team-1",
      false,
    );
    const updateData = mockEventUpdate.mock.calls[0][0].data;
    expect(updateData).not.toHaveProperty("homepageVisible");
  });

  it("U8: SFV resync does NOT overwrite pitchCode or dressingRoom codes (PUB-01 mandatory)", async () => {
    await updateMatchRecord(
      "mapping-1",
      "event-1",
      makeEntry(),
      makeContext(),
      "FC Concordia Basel",
      null,
      "team-1",
      "team-1",
      false,
    );
    const updateData = mockEventUpdate.mock.calls[0][0].data;
    expect(updateData).not.toHaveProperty("pitchCode");
    expect(updateData).not.toHaveProperty("homeDressingRoomCode");
    expect(updateData).not.toHaveProperty("awayDressingRoomCode");
    expect(updateData).not.toHaveProperty("wochenplanVisible");
    expect(updateData).not.toHaveProperty("trainingsplanVisible");
    expect(updateData).not.toHaveProperty("teamPageVisible");
    expect(updateData).not.toHaveProperty("remarks");
    expect(updateData).not.toHaveProperty("sortOrder");
  });
});

// ── D1–D6: Change detection + homeAway correction ────────────────────────────

describe("detectChanges — homeAway correction", () => {
  it("D1: existing 'H' → incoming 'HOME' triggers update (legacy correction)", () => {
    const result = detectChanges(
      makeExistingMappingSnapshot(),
      makeExistingEventSnapshot("H"),
      buildMappingFields(makeEntry(), makeContext(), "team-1", null),
      new Date("2026-09-13T15:00:00.000Z"),
      "SCHEDULED",
      "team-1",
      "HOME",
    );
    expect(result.hasAnyChange).toBe(true);
  });

  it("D2: existing 'A' → incoming 'AWAY' triggers update (legacy correction)", () => {
    const result = detectChanges(
      makeExistingMappingSnapshot({ homeTeamId: null, awayTeamId: "team-1" }),
      makeExistingEventSnapshot("A", { teamId: "team-1" }),
      buildMappingFields(makeEntry(), makeContext(), null, "team-1"),
      new Date("2026-09-13T15:00:00.000Z"),
      "SCHEDULED",
      "team-1",
      "AWAY",
    );
    expect(result.hasAnyChange).toBe(true);
  });

  it("D3: existing 'HOME' with incoming 'HOME' → idempotent (no change)", () => {
    const result = detectChanges(
      makeExistingMappingSnapshot(),
      makeExistingEventSnapshot("HOME"),
      buildMappingFields(makeEntry(), makeContext(), "team-1", null),
      new Date("2026-09-13T15:00:00.000Z"),
      "SCHEDULED",
      "team-1",
      "HOME",
    );
    expect(result.hasAnyChange).toBe(false);
  });

  it("D4: existing 'AWAY' with incoming 'AWAY' → idempotent (no change)", () => {
    const result = detectChanges(
      makeExistingMappingSnapshot({ homeTeamId: null, awayTeamId: "team-1" }),
      makeExistingEventSnapshot("AWAY", { teamId: "team-1" }),
      buildMappingFields(makeEntry(), makeContext(), null, "team-1"),
      new Date("2026-09-13T15:00:00.000Z"),
      "SCHEDULED",
      "team-1",
      "AWAY",
    );
    expect(result.hasAnyChange).toBe(false);
  });

  it("D5: homeAway-only difference is sufficient to trigger an update", () => {
    // All other fields identical; only homeAway differs
    const result = detectChanges(
      makeExistingMappingSnapshot(),
      makeExistingEventSnapshot("H"), // legacy value
      buildMappingFields(makeEntry(), makeContext(), "team-1", null),
      new Date("2026-09-13T15:00:00.000Z"),
      "SCHEDULED",
      "team-1",
      "HOME",
    );
    expect(result.hasAnyChange).toBe(true);
  });

  it("D6: no update when all synchronized values already match", () => {
    const result = detectChanges(
      makeExistingMappingSnapshot(),
      makeExistingEventSnapshot("HOME"),
      buildMappingFields(makeEntry(), makeContext(), "team-1", null),
      new Date("2026-09-13T15:00:00.000Z"),
      "SCHEDULED",
      "team-1",
      "HOME",
    );
    expect(result.hasAnyChange).toBe(false);
    expect(result.scoreChanged).toBe(false);
    expect(result.kickoffChanged).toBe(false);
    expect(result.statusChanged).toBe(false);
  });
});

// ── ADMIN-DELETE-02A-C1: SFV deletion-suppression (tombstone) ───────────────

describe("loadTombstonedExternalMatchIds", () => {
  it("T1: returns a Set of externalMatchId values for this tenant/provider", async () => {
    mockTombstoneFindMany.mockResolvedValueOnce([
      { externalMatchId: 99001 },
      { externalMatchId: 99002 },
    ]);

    const ids = await loadTombstonedExternalMatchIds("tenant-test", "SFV");

    expect(ids.has(99001)).toBe(true);
    expect(ids.has(99002)).toBe(true);
    expect(ids.has(1)).toBe(false);
    expect(mockTombstoneFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: "tenant-test", provider: "SFV" } }),
    );
  });

  it("T2: returns an empty Set when no match has ever been tombstoned", async () => {
    mockTombstoneFindMany.mockResolvedValueOnce([]);

    const ids = await loadTombstonedExternalMatchIds("tenant-test", "SFV");

    expect(ids.size).toBe(0);
  });
});

describe("processScheduleEntry — ADMIN-DELETE-02A-C1 tombstone suppression", () => {
  it("T3: a tombstoned fixture with no prior mapping is suppressed — never (re)created", async () => {
    const result = await processScheduleEntry(
      makeEntry({ matchId: 99001 }),
      makeContext(),
      "season-1",
      new Map(), // no existing mapping — this is exactly the post-delete state
      new Map([[31927, "team-1"]]),
      new Set([31927]),
      undefined,
      new Set([99001]), // tombstoned
    );

    expect(result.outcome).toEqual({ status: "suppressed" });
    expect(mockEventCreate).not.toHaveBeenCalled();
    expect(mockMappingCreate).not.toHaveBeenCalled();
  });

  it("T4: a non-tombstoned fixture with no prior mapping is still created normally", async () => {
    const result = await processScheduleEntry(
      makeEntry({ matchId: 12345 }),
      makeContext(),
      "season-1",
      new Map(),
      new Map([[31927, "team-1"]]),
      new Set([31927]),
      undefined,
      new Set([99001]), // a different match is tombstoned
    );

    expect(result.outcome.status).toBe("created");
    expect(mockEventCreate).toHaveBeenCalledOnce();
  });

  it("T5: defaults to an empty tombstone set when none is supplied (backward compatible)", async () => {
    const result = await processScheduleEntry(
      makeEntry({ matchId: 99001 }),
      makeContext(),
      "season-1",
      new Map(),
      new Map([[31927, "team-1"]]),
      new Set([31927]),
    );

    expect(result.outcome.status).toBe("created");
  });

  it("T6: an EXISTING mapping is still updated/reconciled normally even if the matchId also carries a stale tombstone row", async () => {
    // Defensive: a tombstone should only ever suppress a CREATE for an
    // absent mapping. If a mapping somehow exists again (e.g. a manual
    // re-import), normal update/unchanged handling still applies.
    const existing = new Map([
      [
        99001,
        {
          id: "mapping-1",
          eventId: "event-1",
          providerMatchState: 0,
          providerMatchStateName: "angesetzt",
          scoreHome: 0,
          scoreAway: 0,
          providerLeagueId: 17131,
          providerLeagueName: "4. Liga",
          providerDivisionId: 999,
          providerDivisionName: "Gruppe 1",
          providerRoundNbr: 3,
          providerVenueName: "Testzentrum",
          providerHomeTeamName: "FC Local A",
          providerAwayTeamName: "FC Opponent B",
          homeTeamId: "team-1",
          awayTeamId: null,
          homeExternalTeamId: null,
          awayExternalTeamId: null,
          event: {
            startAt: new Date("2026-09-13T15:00:00.000Z"),
            status: "SCHEDULED",
            teamId: "team-1",
            homeAway: "HOME",
          },
        },
      ],
    ]);

    const result = await processScheduleEntry(
      makeEntry({ matchId: 99001 }),
      makeContext(),
      "season-1",
      existing,
      new Map([[31927, "team-1"]]),
      new Set([31927]),
      undefined,
      new Set([99001]),
    );

    // Never suppressed and never a create — a tombstone only ever gates the
    // CREATE branch for an absent mapping.
    expect(result.outcome.status).not.toBe("suppressed");
    expect(mockEventCreate).not.toHaveBeenCalled();
  });
});

describe("processScheduleEntry — lifecycle self-healing", () => {
  it("normal schedule sync heals a poisoned COMPLETED NOT_PLAYED event", async () => {
    const providerStateName = "noch nicht ausgetragen";
    const existing = new Map([
      [
        99001,
        {
          id: "mapping-1",
          eventId: "event-1",
          ...makeExistingMappingSnapshot({
            providerMatchStateName: providerStateName,
          }),
          homeExternalTeamId: null,
          awayExternalTeamId: null,
          event: makeExistingEventSnapshot("HOME", {
            startAt: new Date("2026-09-13T13:00:00.000Z"),
            status: "COMPLETED",
          }),
        },
      ],
    ]);

    const result = await processScheduleEntry(
      makeEntry({ matchStateName: providerStateName }),
      makeContext(),
      "season-1",
      existing,
      new Map([[31927, "team-1"]]),
      new Set([31927]),
    );

    expect(result.outcome).toEqual({
      status: "updated",
      scoreChanged: false,
      kickoffChanged: false,
      statusChanged: true,
    });
    expect(mockEventUpdate.mock.calls[0][0].data).toEqual(
      expect.objectContaining({
        status: "SCHEDULED",
        resultLabel: null,
      }),
    );
  });

  it("heals match 4361827 class SFV Nullwertung from COMPLETED during schedule sync", async () => {
    const providerStateName = "Null zu Null - Null Punkte";
    const existing = new Map([
      [
        4361827,
        {
          id: "mapping-4361827",
          eventId: "event-4361827",
          ...makeExistingMappingSnapshot({
            providerMatchStateName: providerStateName,
            scoreHome: 0,
            scoreAway: 0,
          }),
          homeExternalTeamId: null,
          awayExternalTeamId: null,
          event: makeExistingEventSnapshot("HOME", {
            startAt: new Date("2026-10-25T13:00:00.000Z"),
            status: "COMPLETED",
          }),
        },
      ],
    ]);

    const result = await processScheduleEntry(
      makeEntry({
        matchId: 4361827,
        matchDate: "2026-10-25T15:00:00",
        matchStateName: providerStateName,
        scoreTeamA: 0,
        scoreTeamB: 0,
        teamNameA: "US Olympia 1963 rot",
        teamNameB: "FC Allschwil Junioren D-9 D1",
      }),
      makeContext(),
      "season-1",
      existing,
      new Map([[31927, "team-1"]]),
      new Set([31927]),
    );

    expect(result.outcome.status).toBe("updated");
    expect(mockEventUpdate.mock.calls[0][0].data).toEqual(
      expect.objectContaining({
        status: "SCHEDULED",
        resultLabel: null,
      }),
    );
    expect(mockMappingUpdate.mock.calls[0][0].data).toEqual(
      expect.objectContaining({
        scoreHome: 0,
        scoreAway: 0,
        providerMatchStateName: providerStateName,
      }),
    );
  });
});
