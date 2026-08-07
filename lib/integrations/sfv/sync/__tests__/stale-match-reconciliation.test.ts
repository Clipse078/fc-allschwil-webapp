/**
 * lib/integrations/sfv/sync/__tests__/stale-match-reconciliation.test.ts
 *
 * TEAM-SFV-MAPPING-04 — Focused unit tests for the pure classification logic
 * and the write-safety guarantees of the stale-match reconciliation module.
 *
 * All Prisma access is mocked here — no real database connection. See
 * scripts/__tests__/team-sfv-mapping-04-stale-match-reconciliation.integration.test.ts
 * for the companion suite that exercises the same guarantees against a real,
 * disposable, local Postgres database (tenant/season/active scoping is
 * enforced by a real unique constraint there).
 *
 * TEST COVERAGE MAP:
 *   1.  Stale HOME reference is classified "repairable".
 *   2.  Stale AWAY reference is classified "repairable".
 *   3.  Already-correct (non-null, matching) reference is "already_correct".
 *   4.  Opponent side with no tenant mapping is "unmapped" (untouched).
 *   8.  Non-null value disagreeing with the mapping is "conflict" /
 *       row-level "ambiguous" — never silently changed.
 *   9.  applyRepairableEntries only ever issues a guarded update (WHERE ...
 *       id AND homeTeamId/awayTeamId IS NULL) — re-running against a
 *       "already_correct" classification writes nothing (idempotency at the
 *       write layer, independent of the DB-level test in the integration
 *       suite).
 *   10. Team is never touched by this module (no delegate exists for it).
 *   11. TeamExternalMapping is never written by this module (only read via
 *       loadTeamMappings, which is exercised in schedule-persistence tests).
 *   12. planStaleMatchReconciliation performs zero prisma writes.
 *   13. Importing this module performs no prisma calls and no top-level
 *       execution — it is entirely side-effect-free until an exported
 *       function is explicitly invoked.
 *   Aggregate report: counts/affected-ids are computed correctly across a
 *       mixed batch of repairable / ambiguous / already-correct / unmapped
 *       rows.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock Prisma ────────────────────────────────────────────────────────────────

const mockFindMany = vi.fn();
const mockUpdateMany = vi.fn();

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    matchExternalMapping: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
      updateMany: (...args: unknown[]) => mockUpdateMany(...args),
    },
  },
}));

// ── Mock schedule-persistence's loadTeamMappings (already unit-tested there) ──

const mockLoadTeamMappings = vi.fn();
vi.mock("../schedule-persistence", () => ({
  loadTeamMappings: (...args: unknown[]) => mockLoadTeamMappings(...args),
}));

import type { StaleMatchCandidateRow } from "../stale-match-reconciliation";

const {
  buildMatchReconciliationEntry,
  buildStaleMatchReconciliationReport,
  applyRepairableEntries,
  planStaleMatchReconciliation,
  executeStaleMatchReconciliation,
  loadStaleMatchCandidates,
} = await import("../stale-match-reconciliation");

// Captured immediately after the dynamic import above resolves — BEFORE any
// `beforeEach(() => vi.clearAllMocks())` has a chance to run and hide
// evidence of an import-time side effect. This is what makes test 13
// meaningful (a `vi.clearAllMocks()` in `beforeEach` would otherwise erase
// exactly the evidence being asserted).
const callCountsImmediatelyAfterImport = {
  findMany: mockFindMany.mock.calls.length,
  updateMany: mockUpdateMany.mock.calls.length,
  loadTeamMappings: mockLoadTeamMappings.mock.calls.length,
};

// ── Fixtures ──────────────────────────────────────────────────────────────────

const TENANT_ID = "tenant-fca";
const SEASON_ID = 2027;

function makeRow(overrides: Partial<StaleMatchCandidateRow> = {}): StaleMatchCandidateRow {
  return {
    id: "mapping-1",
    eventId: "event-1",
    externalMatchId: 900001,
    externalSeasonId: SEASON_ID,
    providerHomeTeamId: 31924,
    providerAwayTeamId: 44001,
    homeTeamId: null,
    awayTeamId: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ── 13: import side-effect safety ─────────────────────────────────────────────

describe("module import safety", () => {
  it("13 — importing the module performs no database calls", () => {
    expect(callCountsImmediatelyAfterImport).toEqual({
      findMany: 0,
      updateMany: 0,
      loadTeamMappings: 0,
    });
  });
});

// ── Pure classification: buildMatchReconciliationEntry ────────────────────────

describe("buildMatchReconciliationEntry", () => {
  it("1 — a null homeTeamId with an active mapping is classified repairable", () => {
    const row = makeRow({ homeTeamId: null, providerHomeTeamId: 31924 });
    const entry = buildMatchReconciliationEntry(row, new Map([[31924, "team-canonical"]]));

    expect(entry.home).toEqual({
      status: "repairable",
      side: "home",
      providerTeamId: 31924,
      canonicalTeamId: "team-canonical",
    });
    expect(entry.classification).toBe("repairable");
  });

  it("2 — a null awayTeamId with an active mapping is classified repairable", () => {
    const row = makeRow({ awayTeamId: null, providerAwayTeamId: 31925 });
    const entry = buildMatchReconciliationEntry(row, new Map([[31925, "team-canonical-away"]]));

    expect(entry.away).toEqual({
      status: "repairable",
      side: "away",
      providerTeamId: 31925,
      canonicalTeamId: "team-canonical-away",
    });
    expect(entry.classification).toBe("repairable");
  });

  it("3 — a non-null homeTeamId matching the mapping is already_correct (never rewritten)", () => {
    const row = makeRow({ homeTeamId: "team-canonical", providerHomeTeamId: 31924 });
    const entry = buildMatchReconciliationEntry(row, new Map([[31924, "team-canonical"]]));

    expect(entry.home).toEqual({
      status: "already_correct",
      side: "home",
      providerTeamId: 31924,
      canonicalTeamId: "team-canonical",
    });
  });

  it("4 — an external opponent side (no mapping at all) is unmapped, never treated as an error", () => {
    const row = makeRow({ awayTeamId: null, providerAwayTeamId: 44001 });
    const entry = buildMatchReconciliationEntry(row, new Map());

    expect(entry.away).toEqual({ status: "unmapped", side: "away", providerTeamId: 44001 });
    expect(entry.classification).toBe("already_correct");
  });

  it("8 — a non-null value disagreeing with the mapping is a conflict, and the row is ambiguous", () => {
    const row = makeRow({ homeTeamId: "team-wrong", providerHomeTeamId: 31924 });
    const entry = buildMatchReconciliationEntry(row, new Map([[31924, "team-right"]]));

    expect(entry.home).toEqual({
      status: "conflict",
      side: "home",
      providerTeamId: 31924,
      existingTeamId: "team-wrong",
      candidateTeamId: "team-right",
    });
    expect(entry.classification).toBe("ambiguous");
  });

  it("ambiguous classification takes priority even when the other side is repairable", () => {
    const row = makeRow({
      homeTeamId: "team-wrong",
      providerHomeTeamId: 31924,
      awayTeamId: null,
      providerAwayTeamId: 31925,
    });
    const entry = buildMatchReconciliationEntry(
      row,
      new Map([
        [31924, "team-right"],
        [31925, "team-away-canonical"],
      ]),
    );

    expect(entry.home.status).toBe("conflict");
    expect(entry.away.status).toBe("repairable");
    expect(entry.classification).toBe("ambiguous");
  });
});

// ── Aggregate report ───────────────────────────────────────────────────────────

describe("buildStaleMatchReconciliationReport", () => {
  it("tallies repairable / ambiguous / already_correct rows and affected ids correctly", () => {
    const rows: StaleMatchCandidateRow[] = [
      makeRow({ id: "m-repair", externalMatchId: 1, homeTeamId: null, providerHomeTeamId: 100, awayTeamId: "team-y", providerAwayTeamId: 200 }),
      makeRow({ id: "m-ambiguous", externalMatchId: 2, homeTeamId: "team-wrong", providerHomeTeamId: 300, awayTeamId: "team-y", providerAwayTeamId: 200 }),
      makeRow({ id: "m-correct", externalMatchId: 3, homeTeamId: "team-x", providerHomeTeamId: 100, awayTeamId: "team-y", providerAwayTeamId: 200 }),
      makeRow({ id: "m-unmapped-opponent", externalMatchId: 4, homeTeamId: "team-x", providerHomeTeamId: 100, awayTeamId: null, providerAwayTeamId: 44002 }),
    ];

    const teamMappings = new Map([
      [100, "team-x"],
      [200, "team-y"],
      [300, "team-right"],
    ]);

    const report = buildStaleMatchReconciliationReport(TENANT_ID, "SFV", SEASON_ID, rows, teamMappings);

    expect(report.totalScanned).toBe(4);
    expect(report.staleRowsFound).toBe(2); // m-repair and m-unmapped-opponent have a null side
    expect(report.repairableRows).toBe(1);
    expect(report.ambiguousRows).toBe(1);
    expect(report.alreadyCorrectRows).toBe(2); // m-correct and m-unmapped-opponent
    expect(report.affectedMatchIds).toEqual([1, 2]);
    expect(report.affectedExternalTeamIds).toEqual([100, 300]);
  });

  it("an empty candidate set produces an all-zero report", () => {
    const report = buildStaleMatchReconciliationReport(TENANT_ID, "SFV", SEASON_ID, [], new Map());

    expect(report.totalScanned).toBe(0);
    expect(report.staleRowsFound).toBe(0);
    expect(report.repairableRows).toBe(0);
    expect(report.ambiguousRows).toBe(0);
    expect(report.alreadyCorrectRows).toBe(0);
    expect(report.affectedExternalTeamIds).toEqual([]);
    expect(report.affectedMatchIds).toEqual([]);
  });
});

// ── applyRepairableEntries: write-safety + idempotency ────────────────────────

describe("applyRepairableEntries", () => {
  it("issues a guarded updateMany scoped to id + the specific null field for a repairable HOME side", async () => {
    mockUpdateMany.mockResolvedValueOnce({ count: 1 });

    const entry = buildMatchReconciliationEntry(
      makeRow({ id: "m-1", eventId: "e-1", externalMatchId: 42, homeTeamId: null, providerHomeTeamId: 31924, awayTeamId: "team-away", providerAwayTeamId: 200 }),
      new Map([[31924, "team-home"], [200, "team-away"]]),
    );

    const { applied } = await applyRepairableEntries([entry]);

    expect(mockUpdateMany).toHaveBeenCalledTimes(1);
    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: { id: "m-1", homeTeamId: null },
      data: { homeTeamId: "team-home" },
    });
    expect(applied).toEqual([
      {
        mappingId: "m-1",
        eventId: "e-1",
        externalMatchId: 42,
        side: "home",
        providerTeamId: 31924,
        previousTeamId: null,
        newTeamId: "team-home",
      },
    ]);
  });

  it("never issues a write for an ambiguous (conflict) or already_correct entry", async () => {
    const ambiguous = buildMatchReconciliationEntry(
      makeRow({ id: "m-ambiguous", homeTeamId: "team-wrong", providerHomeTeamId: 31924 }),
      new Map([[31924, "team-right"]]),
    );
    const correct = buildMatchReconciliationEntry(
      makeRow({ id: "m-correct", homeTeamId: "team-x", providerHomeTeamId: 31924, awayTeamId: "team-y", providerAwayTeamId: 200 }),
      new Map([[31924, "team-x"], [200, "team-y"]]),
    );

    const { applied } = await applyRepairableEntries([ambiguous, correct]);

    expect(mockUpdateMany).not.toHaveBeenCalled();
    expect(applied).toEqual([]);
  });

  it("9 — idempotent at the write layer: when updateMany affects 0 rows (already non-null), nothing is reported applied", async () => {
    mockUpdateMany.mockResolvedValueOnce({ count: 0 });

    const entry = buildMatchReconciliationEntry(
      makeRow({ id: "m-race", homeTeamId: null, providerHomeTeamId: 31924 }),
      new Map([[31924, "team-home"]]),
    );

    const { applied } = await applyRepairableEntries([entry]);

    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: { id: "m-race", homeTeamId: null },
      data: { homeTeamId: "team-home" },
    });
    expect(applied).toEqual([]);
  });

  it("10/11 — never calls any Team or TeamExternalMapping delegate (no such mocks exist to call)", async () => {
    mockUpdateMany.mockResolvedValue({ count: 1 });

    const entry = buildMatchReconciliationEntry(
      makeRow({ id: "m-1", homeTeamId: null, providerHomeTeamId: 31924 }),
      new Map([[31924, "team-home"]]),
    );

    await applyRepairableEntries([entry]);

    // The mocked `@/lib/db/prisma` module exposes ONLY matchExternalMapping —
    // if this module ever attempted to reach `prisma.team` or
    // `prisma.teamExternalMapping`, the call would throw (property does not
    // exist on the mock), which would fail this test.
    expect(mockUpdateMany).toHaveBeenCalledTimes(1);
  });
});

// ── planStaleMatchReconciliation: zero-writes dry-run ─────────────────────────

describe("planStaleMatchReconciliation", () => {
  it("12 — never calls updateMany, even when repairable/ambiguous rows are present", async () => {
    mockFindMany.mockResolvedValueOnce([
      makeRow({ id: "m-repair", homeTeamId: null, providerHomeTeamId: 31924 }),
      makeRow({ id: "m-ambiguous", homeTeamId: "team-wrong", providerHomeTeamId: 31925 }),
    ]);
    mockLoadTeamMappings.mockResolvedValueOnce(
      new Map([
        [31924, "team-home"],
        [31925, "team-right"],
      ]),
    );

    const report = await planStaleMatchReconciliation(TENANT_ID, SEASON_ID, "SFV");

    expect(report.repairableRows).toBe(1);
    expect(report.ambiguousRows).toBe(1);
    expect(mockUpdateMany).not.toHaveBeenCalled();
    expect(mockFindMany).toHaveBeenCalledWith({
      where: { tenantId: TENANT_ID, provider: "SFV", externalSeasonId: SEASON_ID },
      select: expect.objectContaining({
        id: true,
        providerHomeTeamId: true,
        providerAwayTeamId: true,
        homeTeamId: true,
        awayTeamId: true,
      }),
    });
    expect(mockLoadTeamMappings).toHaveBeenCalledWith(TENANT_ID, "SFV", SEASON_ID);
  });
});

// ── executeStaleMatchReconciliation: end-to-end wiring ────────────────────────

describe("executeStaleMatchReconciliation", () => {
  it("plans, then applies only the repairable subset, and reports skippedAmbiguousRows", async () => {
    mockFindMany.mockResolvedValueOnce([
      makeRow({ id: "m-repair", eventId: "e-1", externalMatchId: 1, homeTeamId: null, providerHomeTeamId: 31924, awayTeamId: "t-y", providerAwayTeamId: 200 }),
      makeRow({ id: "m-ambiguous", eventId: "e-2", externalMatchId: 2, homeTeamId: "team-wrong", providerHomeTeamId: 31925, awayTeamId: "t-y", providerAwayTeamId: 200 }),
    ]);
    mockLoadTeamMappings.mockResolvedValueOnce(
      new Map([
        [31924, "team-home"],
        [31925, "team-right"],
        [200, "t-y"],
      ]),
    );
    mockUpdateMany.mockResolvedValueOnce({ count: 1 });

    const result = await executeStaleMatchReconciliation(TENANT_ID, SEASON_ID, "SFV");

    expect(result.rowsScanned).toBe(2);
    expect(result.rowsRepaired).toBe(1);
    expect(result.sidesRepaired).toBe(1);
    expect(result.skippedAmbiguousRows).toBe(1);
    expect(mockUpdateMany).toHaveBeenCalledTimes(1);
    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: { id: "m-repair", homeTeamId: null },
      data: { homeTeamId: "team-home" },
    });
  });
});

// ── loadStaleMatchCandidates ───────────────────────────────────────────────────

describe("loadStaleMatchCandidates", () => {
  it("queries with the exact tenant/provider/season scoping — no date-window filter", async () => {
    mockFindMany.mockResolvedValueOnce([]);

    await loadStaleMatchCandidates(TENANT_ID, "SFV", SEASON_ID);

    const call = mockFindMany.mock.calls[0][0] as { where: Record<string, unknown> };
    expect(call.where).toEqual({ tenantId: TENANT_ID, provider: "SFV", externalSeasonId: SEASON_ID });
    expect(call.where).not.toHaveProperty("event");
  });
});
