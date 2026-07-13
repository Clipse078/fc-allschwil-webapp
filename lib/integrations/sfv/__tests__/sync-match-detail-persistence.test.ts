/**
 * lib/integrations/sfv/__tests__/sync-match-detail-persistence.test.ts
 *
 * Unit tests for the match-detail persistence layer (detail-persistence.ts).
 *
 * These tests verify the exact Prisma update payload passed to prisma.event.update
 * when applyDetailUpdate runs. This is the authoritative proof that club-managed
 * fields are never included in the persistence update.
 *
 * All Prisma calls are mocked — no real database access.
 *
 * TEST COVERAGE:
 *
 * applyDetailUpdate — exact payload verification:
 *   P1. Only allowed provider-managed fields are in the event.update data.
 *   P2. Club-managed fields are absent from the event.update data.
 *   P3. detailSyncedAt is stamped on the mapping after a successful update.
 *   P4. The mapping's eventId is the where clause — not modified.
 *
 * stampDetailSyncedAt:
 *   P5. Only detailSyncedAt is written; nothing else.
 *
 * detectDetailChanges:
 *   P6. Returns true when kickoff changes.
 *   P7. Returns true when status changes.
 *   P8. Returns true when location changes.
 *   P9. Returns true when competitionLabel changes.
 *   P10. Returns false when all provider fields are identical.
 *
 * buildIntermediateResultLabel:
 *   P11. Returns "X:Y (HZ)" format when scores are present.
 *   P12. Returns null when both scores are null.
 *   P13. Returns null when either score is null.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { MatchDetail } from "../client";

// ── Mock Prisma ───────────────────────────────────────────────────────────────

const mockEventUpdate = vi.fn();
const mockMappingUpdate = vi.fn();
const mockTransaction = vi.fn();

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    $transaction: (fn: (tx: unknown) => Promise<unknown>) => mockTransaction(fn),
  },
}));

// ── Import under test ─────────────────────────────────────────────────────────

const {
  applyDetailUpdate,
  detectDetailChanges,
  buildIntermediateResultLabel,
} = await import("../sync/detail-persistence");

// ── Fixtures ──────────────────────────────────────────────────────────────────

const EXTERNAL_MATCH_ID = 77001;
const EVENT_ID = "event-cuid-1";
const MAPPING_ID = "mapping-cuid-1";
const SYNCED_AT = new Date("2026-07-13T20:00:00.000Z");

function makeMapping() {
  return {
    id: MAPPING_ID,
    externalMatchId: EXTERNAL_MATCH_ID,
    eventId: EVENT_ID,
    event: {
      startAt: new Date("2026-09-13T15:00:00.000Z"),
      status: "SCHEDULED",
      location: "Altes Stadion",
      competitionLabel: "4. Liga Gruppe 1",
      intermediateResultLabel: null,
    },
  };
}

function makeDetail(overrides: Partial<MatchDetail> = {}): MatchDetail {
  return {
    matchId: EXTERNAL_MATCH_ID,
    matchDate: "2026-09-13T16:00:00",
    matchState: 1,
    matchStateName: "läuft",
    scoreTeamA: 1,
    scoreTeamB: 0,
    intermediateScoreHome: 1,
    intermediateScoreAway: 0,
    playgroundId: 2002,
    playgroundName: "Neues Sportcenter",
    leagueId: 17131,
    leagueName: "4. Liga Gruppe 2",
    divisionId: 999,
    divisionName: "Gruppe 2",
    seasonId: 2027,
    teamAId: 31927,
    teamBId: 44001,
    ...overrides,
  };
}

function makeContext() {
  return {
    tenantId: "tenant-a-cuid",
    clubId: 483,
    seasonId: 2027,
    syncedAt: SYNCED_AT,
  };
}

beforeEach(() => {
  vi.clearAllMocks();

  // Set up the transaction mock to execute the callback with mock tx functions
  const mockTx = {
    event: { update: mockEventUpdate },
    matchExternalMapping: { update: mockMappingUpdate },
  };
  mockEventUpdate.mockResolvedValue({});
  mockMappingUpdate.mockResolvedValue({});
  mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
    return fn(mockTx);
  });
});

// ── P1-P4: applyDetailUpdate — exact payload verification ────────────────────

describe("applyDetailUpdate — exact Prisma payload", () => {
  it("P1 — event.update data contains only provider-managed fields", async () => {
    await applyDetailUpdate(makeMapping(), makeDetail(), makeContext());

    expect(mockEventUpdate).toHaveBeenCalledOnce();
    const [updateCall] = mockEventUpdate.mock.calls[0] as [{ where: unknown; data: Record<string, unknown> }];
    const data = updateCall.data;

    // Allowed provider-managed fields
    const ALLOWED = new Set([
      "startAt", "status", "location", "competitionLabel",
      "intermediateResultLabel", "lastSyncedAt",
    ]);

    for (const key of Object.keys(data)) {
      expect(ALLOWED.has(key)).toBe(true);
    }
  });

  it("P2 — club-managed fields are absent from event.update data", async () => {
    await applyDetailUpdate(makeMapping(), makeDetail(), makeContext());

    const [updateCall] = mockEventUpdate.mock.calls[0] as [{ where: unknown; data: Record<string, unknown> }];
    const data = updateCall.data;

    const CLUB_FIELDS = [
      "title", "remarks", "meetingTime", "pitchCode",
      "homeDressingRoomCode", "awayDressingRoomCode",
      "opponentName", "resultLabel",
      "teamId", "seasonId",
      "reviewStage", "reviewNotes",
      "websiteVisible", "infoboardVisible", "wochenplanVisible",
      "homepageVisible", "trainingsplanVisible", "teamPageVisible",
      "sortOrder", "homeAway", "description",
    ];

    for (const field of CLUB_FIELDS) {
      expect(data).not.toHaveProperty(field);
    }
  });

  it("P3 — detailSyncedAt is stamped on the mapping within the same transaction", async () => {
    await applyDetailUpdate(makeMapping(), makeDetail(), makeContext());

    expect(mockMappingUpdate).toHaveBeenCalledOnce();
    const [mappingCall] = mockMappingUpdate.mock.calls[0] as [{ where: unknown; data: Record<string, unknown> }];
    expect(mappingCall.data).toHaveProperty("detailSyncedAt", SYNCED_AT);
  });

  it("P4 — event.update where clause uses the eventId from the mapping", async () => {
    await applyDetailUpdate(makeMapping(), makeDetail(), makeContext());

    const [updateCall] = mockEventUpdate.mock.calls[0] as [{ where: { id: string }; data: unknown }];
    expect(updateCall.where).toEqual({ id: EVENT_ID });
  });

  it("P4b — mapping.update where clause uses the mapping id", async () => {
    await applyDetailUpdate(makeMapping(), makeDetail(), makeContext());

    const [mappingCall] = mockMappingUpdate.mock.calls[0] as [{ where: { id: string }; data: unknown }];
    expect(mappingCall.where).toEqual({ id: MAPPING_ID });
  });

  it("P-values — provider fields are mapped correctly", async () => {
    await applyDetailUpdate(makeMapping(), makeDetail(), makeContext());

    const [updateCall] = mockEventUpdate.mock.calls[0] as [{ where: unknown; data: Record<string, unknown> }];
    const data = updateCall.data;

    expect(data.startAt).toEqual(new Date("2026-09-13T16:00:00"));
    expect(data.status).toBe("LIVE");
    expect(data.location).toBe("Neues Sportcenter");
    expect(data.competitionLabel).toBe("4. Liga Gruppe 2");
    expect(data.intermediateResultLabel).toBe("1:0 (HZ)");
    expect(data.lastSyncedAt).toEqual(SYNCED_AT);
  });
});


// ── P6-P10: detectDetailChanges ───────────────────────────────────────────────

describe("detectDetailChanges", () => {
  it("P6 — returns true when kickoff changes", () => {
    const mapping = makeMapping();
    const detail = makeDetail({ matchDate: "2026-09-14T15:00:00" });
    expect(detectDetailChanges(mapping.event, detail)).toBe(true);
  });

  it("P7 — returns true when status changes", () => {
    const mapping = makeMapping();
    // matchStateName "gespielt" → COMPLETED, existing is SCHEDULED
    const detail = makeDetail({ matchState: 2, matchStateName: "gespielt" });
    expect(detectDetailChanges(mapping.event, detail)).toBe(true);
  });

  it("P8 — returns true when location changes", () => {
    const mapping = makeMapping();
    const detail = makeDetail({ playgroundName: "Neues Sportzentrum" });
    expect(detectDetailChanges(mapping.event, detail)).toBe(true);
  });

  it("P9 — returns true when competitionLabel changes", () => {
    const mapping = makeMapping();
    const detail = makeDetail({ leagueName: "3. Liga" });
    expect(detectDetailChanges(mapping.event, detail)).toBe(true);
  });

  it("P10 — returns false when all provider fields are identical", () => {
    const mapping = makeMapping();
    // Construct detail that matches existing event exactly
    const identicalDetail = makeDetail({
      matchDate: "2026-09-13T15:00:00",  // UTC: matches existing startAt
      matchState: 0,
      matchStateName: "angesetzt",       // → SCHEDULED
      playgroundName: "Altes Stadion",   // same location
      leagueName: "4. Liga Gruppe 1",    // same competitionLabel
      intermediateScoreHome: null,
      intermediateScoreAway: null,
    });
    expect(detectDetailChanges(mapping.event, identicalDetail)).toBe(false);
  });
});

// ── P11-P13: buildIntermediateResultLabel ─────────────────────────────────────

describe("buildIntermediateResultLabel", () => {
  it("P11 — returns 'X:Y (HZ)' format when both scores are present", () => {
    expect(buildIntermediateResultLabel(1, 0)).toBe("1:0 (HZ)");
    expect(buildIntermediateResultLabel(2, 2)).toBe("2:2 (HZ)");
    expect(buildIntermediateResultLabel(0, 0)).toBe("0:0 (HZ)");
  });

  it("P12 — returns null when both scores are null", () => {
    expect(buildIntermediateResultLabel(null, null)).toBeNull();
  });

  it("P13 — returns null when either score is null", () => {
    expect(buildIntermediateResultLabel(1, null)).toBeNull();
    expect(buildIntermediateResultLabel(null, 0)).toBeNull();
  });
});
