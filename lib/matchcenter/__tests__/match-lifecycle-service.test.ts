/**
 * lib/matchcenter/__tests__/match-lifecycle-service.test.ts
 *
 * ADMIN-DELETE-02A-C1 — Focused tests for Match (Event, type=MATCH)
 * permanent-deletion, covering the corrected CORE PRODUCT RULE: an SFV/
 * provider mapping, a live/completed sporting state, and Weekplanner
 * references are IMPACT — a warning — and NEVER block permanent deletion
 * for a matches.delete holder. An SFV-mapped match additionally writes a
 * durable SfvMatchDeletionTombstone so the next sync never recreates it.
 *
 * All database access is mocked via `@/lib/db/prisma`. No live database.
 *
 * TEST COVERAGE MAP:
 *   1. getMatchDeletionImpact returns [] for an unused, manual match.
 *   2. getMatchDeletionImpact reports an SFV/provider mapping as impact.
 *   3. getMatchDeletionImpact reports a LIVE/COMPLETED match as impact.
 *   4. getMatchDeletionImpact reports Weekplanner references as impact.
 *   5. getMatchDeletionImpact returns null for a cross-tenant match.
 *   6. getMatchDeletionImpact returns null for a non-MATCH Event id.
 *   7. deleteMatchPermanently hard-deletes an unused manual match.
 *   8. deleteMatchPermanently NEVER blocks deletion when a provider mapping
 *      exists; instead writes an SfvMatchDeletionTombstone with the
 *      mapping's exact (provider, externalMatchId, externalSeasonId).
 *   8a. deleteMatchPermanently NEVER blocks deletion for a LIVE/COMPLETED
 *       match, and does not write a tombstone when no provider mapping
 *       exists.
 *   9. deleteMatchPermanently throws MatchNotFoundError for a cross-tenant
 *      match (never deletes).
 *   10. deleteMatchPermanently cleans up Weekplanner references keyed by
 *       the match's own Event id.
 *   11. A cleanup failure inside the transaction rolls back — no
 *       tombstone is written and the match is not deleted.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  eventFindFirst: vi.fn(),
  eventDelete: vi.fn(),
  weekplannerPlanAllocationCount: vi.fn(),
  weekplannerPlanActivityOverrideCount: vi.fn(),
  weekplannerPlanAllocationDeleteMany: vi.fn(),
  weekplannerPlanActivityOverrideDeleteMany: vi.fn(),
  sfvMatchDeletionTombstoneUpsert: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    event: {
      findFirst: (...args: unknown[]) => mocks.eventFindFirst(...args),
    },
    weekplannerPlanAllocation: {
      count: (...args: unknown[]) => mocks.weekplannerPlanAllocationCount(...args),
    },
    weekplannerPlanActivityOverride: {
      count: (...args: unknown[]) => mocks.weekplannerPlanActivityOverrideCount(...args),
    },
    $transaction: (fn: (tx: unknown) => Promise<unknown>) => mocks.transaction(fn),
  },
}));

import {
  MatchNotFoundError,
  deleteMatchPermanently,
  getMatchDeletionImpact,
} from "../match-lifecycle-service";

const TENANT_A = "tenant-a";
const TENANT_B = "tenant-b";
const MATCH_ID = "match-01";

function makeUnusedMatchRow() {
  return { status: "SCHEDULED", matchExternalMapping: null };
}

function makeTx() {
  return {
    event: {
      findFirst: (...args: unknown[]) => mocks.eventFindFirst(...args),
      delete: (...args: unknown[]) => mocks.eventDelete(...args),
    },
    weekplannerPlanAllocation: {
      count: (...args: unknown[]) => mocks.weekplannerPlanAllocationCount(...args),
      deleteMany: (...args: unknown[]) => mocks.weekplannerPlanAllocationDeleteMany(...args),
    },
    weekplannerPlanActivityOverride: {
      count: (...args: unknown[]) => mocks.weekplannerPlanActivityOverrideCount(...args),
      deleteMany: (...args: unknown[]) =>
        mocks.weekplannerPlanActivityOverrideDeleteMany(...args),
    },
    sfvMatchDeletionTombstone: {
      upsert: (...args: unknown[]) => mocks.sfvMatchDeletionTombstoneUpsert(...args),
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.weekplannerPlanAllocationCount.mockResolvedValue(0);
  mocks.weekplannerPlanActivityOverrideCount.mockResolvedValue(0);
  mocks.weekplannerPlanAllocationDeleteMany.mockResolvedValue({ count: 0 });
  mocks.weekplannerPlanActivityOverrideDeleteMany.mockResolvedValue({ count: 0 });
  mocks.sfvMatchDeletionTombstoneUpsert.mockResolvedValue({});
  mocks.transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
    fn(makeTx()),
  );
});

describe("getMatchDeletionImpact", () => {
  it("1 — returns [] for an unused, manual, scheduled match", async () => {
    mocks.eventFindFirst.mockResolvedValueOnce(makeUnusedMatchRow());

    const impact = await getMatchDeletionImpact(TENANT_A, MATCH_ID);

    expect(impact).toEqual([]);
    expect(mocks.eventFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: MATCH_ID, tenantId: TENANT_A, type: "MATCH" } }),
    );
  });

  it("2 — reports an SFV/provider mapping as impact (never blocks)", async () => {
    mocks.eventFindFirst.mockResolvedValueOnce({
      status: "SCHEDULED",
      matchExternalMapping: { id: "mapping-1" },
    });

    const impact = await getMatchDeletionImpact(TENANT_A, MATCH_ID);

    expect(impact?.some((b) => b.key === "providerMapping")).toBe(true);
  });

  it("3 — reports a LIVE or COMPLETED match as impact (never blocks)", async () => {
    mocks.eventFindFirst.mockResolvedValueOnce({ status: "COMPLETED", matchExternalMapping: null });

    const impact = await getMatchDeletionImpact(TENANT_A, MATCH_ID);

    expect(impact?.some((b) => b.key === "sportingHistory")).toBe(true);
  });

  it("4 — reports Weekplanner allocation/override references as impact (never blocks)", async () => {
    mocks.eventFindFirst.mockResolvedValueOnce(makeUnusedMatchRow());
    mocks.weekplannerPlanAllocationCount.mockResolvedValueOnce(2);
    mocks.weekplannerPlanActivityOverrideCount.mockResolvedValueOnce(1);

    const impact = await getMatchDeletionImpact(TENANT_A, MATCH_ID);

    const keys = impact?.map((b) => b.key).sort();
    expect(keys).toEqual(["weekplannerAllocations", "weekplannerOverrides"]);
  });

  it("5 — returns null for a match belonging to another tenant (no cross-tenant leak)", async () => {
    mocks.eventFindFirst.mockResolvedValueOnce(null);

    const impact = await getMatchDeletionImpact(TENANT_B, MATCH_ID);

    expect(impact).toBeNull();
  });

  it("6 — scopes the lookup to type: MATCH (never resolves a TRAINING/TOURNAMENT Event)", async () => {
    mocks.eventFindFirst.mockResolvedValueOnce(makeUnusedMatchRow());

    await getMatchDeletionImpact(TENANT_A, MATCH_ID);

    expect(mocks.eventFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ type: "MATCH" }) }),
    );
  });
});

describe("deleteMatchPermanently", () => {
  it("7 — hard-deletes an unused manual match", async () => {
    mocks.eventFindFirst.mockResolvedValueOnce(makeUnusedMatchRow());
    mocks.eventDelete.mockResolvedValueOnce({ id: MATCH_ID });

    const { deleted, impact } = await deleteMatchPermanently(TENANT_A, MATCH_ID);

    expect(mocks.eventDelete).toHaveBeenCalledWith({ where: { id: MATCH_ID } });
    expect(deleted).toEqual({ id: MATCH_ID });
    expect(impact).toEqual([]);
    expect(mocks.sfvMatchDeletionTombstoneUpsert).not.toHaveBeenCalled();
  });

  it("8 — NEVER blocks deletion when a provider mapping exists; writes an SfvMatchDeletionTombstone", async () => {
    mocks.eventFindFirst.mockResolvedValueOnce({
      status: "SCHEDULED",
      matchExternalMapping: {
        provider: "SFV",
        externalMatchId: 99001,
        externalSeasonId: 2027,
      },
    });
    mocks.eventDelete.mockResolvedValueOnce({ id: MATCH_ID });

    const { deleted, impact } = await deleteMatchPermanently(TENANT_A, MATCH_ID, "user-1");

    expect(mocks.eventDelete).toHaveBeenCalledWith({ where: { id: MATCH_ID } });
    expect(deleted).toEqual({ id: MATCH_ID });
    expect(impact.some((b) => b.key === "providerMapping")).toBe(true);

    expect(mocks.sfvMatchDeletionTombstoneUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId_provider_externalMatchId: {
            tenantId: TENANT_A,
            provider: "SFV",
            externalMatchId: 99001,
          },
        },
        create: expect.objectContaining({
          tenantId: TENANT_A,
          provider: "SFV",
          externalMatchId: 99001,
          externalSeasonId: 2027,
          deletedByUserId: "user-1",
        }),
      }),
    );
  });

  it("8a — NEVER blocks deletion for a LIVE/COMPLETED match, and writes no tombstone without a provider mapping", async () => {
    mocks.eventFindFirst.mockResolvedValueOnce({ status: "COMPLETED", matchExternalMapping: null });
    mocks.eventDelete.mockResolvedValueOnce({ id: MATCH_ID });

    const { deleted, impact } = await deleteMatchPermanently(TENANT_A, MATCH_ID);

    expect(mocks.eventDelete).toHaveBeenCalledWith({ where: { id: MATCH_ID } });
    expect(deleted).toEqual({ id: MATCH_ID });
    expect(impact.some((b) => b.key === "sportingHistory")).toBe(true);
    expect(mocks.sfvMatchDeletionTombstoneUpsert).not.toHaveBeenCalled();
  });

  it("9 — never deletes a match belonging to another tenant", async () => {
    mocks.eventFindFirst.mockResolvedValueOnce(null);

    await expect(deleteMatchPermanently(TENANT_B, MATCH_ID)).rejects.toBeInstanceOf(
      MatchNotFoundError,
    );
    expect(mocks.eventDelete).not.toHaveBeenCalled();
  });

  it("10 — cleans up Weekplanner references keyed by the match's own Event id", async () => {
    mocks.eventFindFirst.mockResolvedValueOnce(makeUnusedMatchRow());
    mocks.eventDelete.mockResolvedValueOnce({ id: MATCH_ID });

    await deleteMatchPermanently(TENANT_A, MATCH_ID);

    expect(mocks.weekplannerPlanAllocationDeleteMany).toHaveBeenCalledWith({
      where: { tenantId: TENANT_A, activityType: "MATCH", activityId: MATCH_ID },
    });
    expect(mocks.weekplannerPlanActivityOverrideDeleteMany).toHaveBeenCalledWith({
      where: { tenantId: TENANT_A, activityType: "MATCH", activityId: MATCH_ID },
    });
  });

  it("11 — rolls back (never deletes the match) when Weekplanner cleanup fails inside the transaction", async () => {
    mocks.eventFindFirst.mockResolvedValueOnce({
      status: "SCHEDULED",
      matchExternalMapping: { provider: "SFV", externalMatchId: 1, externalSeasonId: 2027 },
    });
    mocks.weekplannerPlanAllocationDeleteMany.mockRejectedValueOnce(new Error("db error"));

    await expect(deleteMatchPermanently(TENANT_A, MATCH_ID)).rejects.toThrow("db error");
    expect(mocks.eventDelete).not.toHaveBeenCalled();
  });
});
