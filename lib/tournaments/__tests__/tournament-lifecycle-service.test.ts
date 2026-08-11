/**
 * lib/tournaments/__tests__/tournament-lifecycle-service.test.ts
 *
 * ADMIN-DELETE-02A-C1 — Focused tests for Tournament (Event, type=TOURNAMENT)
 * permanent-deletion, covering the corrected CORE PRODUCT RULE:
 * participants, resource allocations, sporting history, and Weekplanner
 * references are IMPACT — a warning — and NEVER block permanent deletion
 * for a tournaments.delete holder.
 *
 * All database access is mocked via `@/lib/db/prisma`. No live database.
 *
 * TEST COVERAGE MAP:
 *   1. getTournamentDeletionImpact returns [] for a newly-created, unused
 *      tournament.
 *   2. getTournamentDeletionImpact reports participants as impact.
 *   3. getTournamentDeletionImpact reports resource allocations as impact.
 *   4. getTournamentDeletionImpact reports a LIVE/COMPLETED/ARCHIVED
 *      tournament as impact.
 *   5. getTournamentDeletionImpact reports Weekplanner references as
 *      impact.
 *   6. getTournamentDeletionImpact returns null for a cross-tenant
 *      tournament.
 *   7. getTournamentDeletionImpact returns null for a non-TOURNAMENT
 *      Event id.
 *   8. deleteTournamentPermanently hard-deletes an unused tournament.
 *   9. deleteTournamentPermanently NEVER blocks deletion when participants
 *      exist — reports the impact and deletes anyway.
 *   10. deleteTournamentPermanently throws TournamentNotFoundError for a
 *       cross-tenant tournament (never deletes).
 *   11. deleteTournamentPermanently cleans up Weekplanner references keyed
 *       by the tournament's own Event id.
 *   12. A cleanup failure inside the transaction rolls back — the
 *       tournament is not deleted.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  eventFindFirst: vi.fn(),
  eventDelete: vi.fn(),
  weekplannerPlanAllocationCount: vi.fn(),
  weekplannerPlanActivityOverrideCount: vi.fn(),
  weekplannerPlanAllocationDeleteMany: vi.fn(),
  weekplannerPlanActivityOverrideDeleteMany: vi.fn(),
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

import { TournamentNotFoundError } from "../errors";
import {
  deleteTournamentPermanently,
  getTournamentDeletionImpact,
} from "../tournament-lifecycle-service";

const TENANT_A = "tenant-a";
const TENANT_B = "tenant-b";
const TOURNAMENT_ID = "tournament-01";

function makeUnusedTournamentRow() {
  return {
    status: "SCHEDULED",
    _count: {
      tournamentParticipants: 0,
      tournamentResourceAllocations: 0,
    },
  };
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
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.weekplannerPlanAllocationCount.mockResolvedValue(0);
  mocks.weekplannerPlanActivityOverrideCount.mockResolvedValue(0);
  mocks.weekplannerPlanAllocationDeleteMany.mockResolvedValue({ count: 0 });
  mocks.weekplannerPlanActivityOverrideDeleteMany.mockResolvedValue({ count: 0 });
  mocks.transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
    fn(makeTx()),
  );
});

describe("getTournamentDeletionImpact", () => {
  it("1 — returns [] for a newly-created, unused tournament", async () => {
    mocks.eventFindFirst.mockResolvedValueOnce(makeUnusedTournamentRow());

    const impact = await getTournamentDeletionImpact(TENANT_A, TOURNAMENT_ID);

    expect(impact).toEqual([]);
    expect(mocks.eventFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: TOURNAMENT_ID, tenantId: TENANT_A, type: "TOURNAMENT" } }),
    );
  });

  it("2 — reports participants (Team/ExternalClub/ExternalTeam) as impact (never blocks)", async () => {
    const row = makeUnusedTournamentRow();
    row._count.tournamentParticipants = 3;
    mocks.eventFindFirst.mockResolvedValueOnce(row);

    const impact = await getTournamentDeletionImpact(TENANT_A, TOURNAMENT_ID);

    expect(impact?.some((b) => b.key === "participants")).toBe(true);
  });

  it("3 — reports resource allocations as impact (never blocks)", async () => {
    const row = makeUnusedTournamentRow();
    row._count.tournamentResourceAllocations = 1;
    mocks.eventFindFirst.mockResolvedValueOnce(row);

    const impact = await getTournamentDeletionImpact(TENANT_A, TOURNAMENT_ID);

    expect(impact?.some((b) => b.key === "resourceAllocations")).toBe(true);
  });

  it("4 — reports a LIVE, COMPLETED, or ARCHIVED tournament as impact (never blocks)", async () => {
    mocks.eventFindFirst.mockResolvedValueOnce({
      status: "COMPLETED",
      _count: { tournamentParticipants: 0, tournamentResourceAllocations: 0 },
    });

    const impact = await getTournamentDeletionImpact(TENANT_A, TOURNAMENT_ID);

    expect(impact?.some((b) => b.key === "sportingHistory")).toBe(true);
  });

  it("5 — reports Weekplanner allocation/override references as impact (never blocks)", async () => {
    mocks.eventFindFirst.mockResolvedValueOnce(makeUnusedTournamentRow());
    mocks.weekplannerPlanAllocationCount.mockResolvedValueOnce(1);
    mocks.weekplannerPlanActivityOverrideCount.mockResolvedValueOnce(1);

    const impact = await getTournamentDeletionImpact(TENANT_A, TOURNAMENT_ID);

    const keys = impact?.map((b) => b.key).sort();
    expect(keys).toEqual(["weekplannerAllocations", "weekplannerOverrides"]);
  });

  it("6 — returns null for a tournament belonging to another tenant (no cross-tenant leak)", async () => {
    mocks.eventFindFirst.mockResolvedValueOnce(null);

    const impact = await getTournamentDeletionImpact(TENANT_B, TOURNAMENT_ID);

    expect(impact).toBeNull();
  });

  it("7 — scopes the lookup to type: TOURNAMENT (never resolves a MATCH/TRAINING Event)", async () => {
    mocks.eventFindFirst.mockResolvedValueOnce(makeUnusedTournamentRow());

    await getTournamentDeletionImpact(TENANT_A, TOURNAMENT_ID);

    expect(mocks.eventFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ type: "TOURNAMENT" }) }),
    );
  });
});

describe("deleteTournamentPermanently", () => {
  it("8 — hard-deletes an unused tournament", async () => {
    mocks.eventFindFirst.mockResolvedValueOnce(makeUnusedTournamentRow());
    mocks.eventDelete.mockResolvedValueOnce({ id: TOURNAMENT_ID });

    const { deleted, impact } = await deleteTournamentPermanently(TENANT_A, TOURNAMENT_ID);

    expect(mocks.eventDelete).toHaveBeenCalledWith({ where: { id: TOURNAMENT_ID } });
    expect(deleted).toEqual({ id: TOURNAMENT_ID });
    expect(impact).toEqual([]);
  });

  it("9 — NEVER blocks deletion when participants exist — reports impact and deletes anyway", async () => {
    const row = makeUnusedTournamentRow();
    row._count.tournamentParticipants = 4;
    mocks.eventFindFirst.mockResolvedValueOnce(row);
    mocks.eventDelete.mockResolvedValueOnce({ id: TOURNAMENT_ID });

    const { deleted, impact } = await deleteTournamentPermanently(TENANT_A, TOURNAMENT_ID);

    expect(mocks.eventDelete).toHaveBeenCalledWith({ where: { id: TOURNAMENT_ID } });
    expect(deleted).toEqual({ id: TOURNAMENT_ID });
    expect(impact.find((b) => b.key === "participants")?.count).toBe(4);
  });

  it("10 — never deletes a tournament belonging to another tenant", async () => {
    mocks.eventFindFirst.mockResolvedValueOnce(null);

    await expect(deleteTournamentPermanently(TENANT_B, TOURNAMENT_ID)).rejects.toBeInstanceOf(
      TournamentNotFoundError,
    );
    expect(mocks.eventDelete).not.toHaveBeenCalled();
  });

  it("11 — cleans up Weekplanner references keyed by the tournament's own Event id", async () => {
    mocks.eventFindFirst.mockResolvedValueOnce(makeUnusedTournamentRow());
    mocks.eventDelete.mockResolvedValueOnce({ id: TOURNAMENT_ID });

    await deleteTournamentPermanently(TENANT_A, TOURNAMENT_ID);

    expect(mocks.weekplannerPlanAllocationDeleteMany).toHaveBeenCalledWith({
      where: { tenantId: TENANT_A, activityType: "TOURNAMENT", activityId: TOURNAMENT_ID },
    });
    expect(mocks.weekplannerPlanActivityOverrideDeleteMany).toHaveBeenCalledWith({
      where: { tenantId: TENANT_A, activityType: "TOURNAMENT", activityId: TOURNAMENT_ID },
    });
  });

  it("12 — rolls back (never deletes) when Weekplanner cleanup fails inside the transaction", async () => {
    mocks.eventFindFirst.mockResolvedValueOnce(makeUnusedTournamentRow());
    mocks.weekplannerPlanAllocationDeleteMany.mockRejectedValueOnce(new Error("db error"));

    await expect(deleteTournamentPermanently(TENANT_A, TOURNAMENT_ID)).rejects.toThrow(
      "db error",
    );
    expect(mocks.eventDelete).not.toHaveBeenCalled();
  });
});
