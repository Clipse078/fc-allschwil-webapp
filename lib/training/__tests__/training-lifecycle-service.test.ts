/**
 * lib/training/__tests__/training-lifecycle-service.test.ts
 *
 * ADMIN-DELETE-02A-C1 — Focused tests for TrainingSeries permanent-deletion,
 * covering the corrected CORE PRODUCT RULE: dependencies (generated
 * sessions, facility allocations, plan assignments) are IMPACT — a warning
 * — and NEVER block permanent deletion for a trainings.delete holder.
 *
 * All database access is mocked via `@/lib/db/prisma`. No live database.
 *
 * TEST COVERAGE MAP:
 *   1. getTrainingSeriesDeletionImpact returns [] for an unused series.
 *   2. getTrainingSeriesDeletionImpact reports sessions/allocations/
 *      planAssignments impact when present (never as an error).
 *   3. getTrainingSeriesDeletionImpact returns null for a cross-tenant
 *      series (never leaks existence).
 *   4. deleteTrainingSeriesPermanently hard-deletes an unused series inside
 *      a transaction.
 *   5. deleteTrainingSeriesPermanently permanently deletes a series WITH
 *      generated sessions/allocations/planAssignments — never blocked —
 *      and cleans up Weekplanner references keyed by session id first.
 *   6. deleteTrainingSeriesPermanently throws TrainingSeriesNotFoundError
 *      (never deletes) for a cross-tenant series.
 *   7. A cleanup failure inside the transaction rolls back — the series is
 *      not deleted.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  trainingSeriesFindFirst: vi.fn(),
  trainingSeriesDelete: vi.fn(),
  weekplannerPlanAllocationDeleteMany: vi.fn(),
  weekplannerPlanActivityOverrideDeleteMany: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    trainingSeries: {
      findFirst: (...args: unknown[]) => mocks.trainingSeriesFindFirst(...args),
    },
    $transaction: (fn: (tx: unknown) => Promise<unknown>) => mocks.transaction(fn),
  },
}));

import { TrainingSeriesNotFoundError } from "../errors";
import {
  deleteTrainingSeriesPermanently,
  getTrainingSeriesDeletionImpact,
} from "../training-lifecycle-service";

const TENANT_A = "tenant-a";
const TENANT_B = "tenant-b";
const SERIES_ID = "series-01";

function makeUnusedSeriesRow() {
  return {
    id: SERIES_ID,
    sessions: [] as { id: string }[],
    _count: {
      sessions: 0,
      allocations: 0,
      planAssignments: 0,
    },
  };
}

function makeTx() {
  return {
    trainingSeries: {
      findFirst: (...args: unknown[]) => mocks.trainingSeriesFindFirst(...args),
      delete: (...args: unknown[]) => mocks.trainingSeriesDelete(...args),
    },
    weekplannerPlanAllocation: {
      deleteMany: (...args: unknown[]) => mocks.weekplannerPlanAllocationDeleteMany(...args),
    },
    weekplannerPlanActivityOverride: {
      deleteMany: (...args: unknown[]) =>
        mocks.weekplannerPlanActivityOverrideDeleteMany(...args),
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
    fn(makeTx()),
  );
  mocks.weekplannerPlanAllocationDeleteMany.mockResolvedValue({ count: 0 });
  mocks.weekplannerPlanActivityOverrideDeleteMany.mockResolvedValue({ count: 0 });
});

describe("getTrainingSeriesDeletionImpact", () => {
  it("1 — returns [] for an unused series (no sessions/allocations/plan assignments)", async () => {
    mocks.trainingSeriesFindFirst.mockResolvedValueOnce(makeUnusedSeriesRow());

    const impact = await getTrainingSeriesDeletionImpact(TENANT_A, SERIES_ID);

    expect(impact).toEqual([]);
    expect(mocks.trainingSeriesFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: SERIES_ID, tenantId: TENANT_A } }),
    );
  });

  it("2 — reports sessions, allocations, and planAssignments as impact (informational only)", async () => {
    const row = makeUnusedSeriesRow();
    row._count.sessions = 12;
    row._count.allocations = 1;
    row._count.planAssignments = 1;
    mocks.trainingSeriesFindFirst.mockResolvedValueOnce(row);

    const impact = await getTrainingSeriesDeletionImpact(TENANT_A, SERIES_ID);

    const keys = impact?.map((b) => b.key).sort();
    expect(keys).toEqual(["allocations", "planAssignments", "sessions"]);
  });

  it("3 — returns null for a series belonging to another tenant (no cross-tenant leak)", async () => {
    mocks.trainingSeriesFindFirst.mockResolvedValueOnce(null);

    const impact = await getTrainingSeriesDeletionImpact(TENANT_B, SERIES_ID);

    expect(impact).toBeNull();
  });
});

describe("deleteTrainingSeriesPermanently", () => {
  it("4 — hard-deletes an unused series inside a transaction", async () => {
    mocks.trainingSeriesFindFirst.mockResolvedValueOnce(makeUnusedSeriesRow());
    mocks.trainingSeriesDelete.mockResolvedValueOnce({ id: SERIES_ID });

    const { deleted, impact } = await deleteTrainingSeriesPermanently(TENANT_A, SERIES_ID);

    expect(mocks.transaction).toHaveBeenCalledOnce();
    expect(mocks.trainingSeriesDelete).toHaveBeenCalledWith({ where: { id: SERIES_ID } });
    expect(deleted).toEqual({ id: SERIES_ID });
    expect(impact).toEqual([]);
  });

  it("5 — NEVER blocks deletion when generated sessions/allocations/planAssignments exist; cleans up Weekplanner refs by session id first", async () => {
    const row = makeUnusedSeriesRow();
    row.sessions = [{ id: "session-1" }, { id: "session-2" }];
    row._count.sessions = 8;
    row._count.allocations = 2;
    row._count.planAssignments = 1;
    mocks.trainingSeriesFindFirst.mockResolvedValueOnce(row);
    mocks.trainingSeriesDelete.mockResolvedValueOnce({ id: SERIES_ID });

    const { deleted, impact } = await deleteTrainingSeriesPermanently(TENANT_A, SERIES_ID);

    // Never blocked — delete is always called once impact is computed.
    expect(mocks.trainingSeriesDelete).toHaveBeenCalledWith({ where: { id: SERIES_ID } });
    expect(deleted).toEqual({ id: SERIES_ID });

    // Impact is reported (for the audit log / caller), not thrown as an error.
    const keys = impact.map((b) => b.key).sort();
    expect(keys).toEqual(["allocations", "planAssignments", "sessions"]);
    expect(impact.find((b) => b.key === "sessions")?.count).toBe(8);

    // Weekplanner references keyed by TrainingSession id are cleaned up.
    expect(mocks.weekplannerPlanAllocationDeleteMany).toHaveBeenCalledWith({
      where: {
        tenantId: TENANT_A,
        activityType: "TRAINING",
        activityId: { in: ["session-1", "session-2"] },
      },
    });
    expect(mocks.weekplannerPlanActivityOverrideDeleteMany).toHaveBeenCalledWith({
      where: {
        tenantId: TENANT_A,
        activityType: "TRAINING",
        activityId: { in: ["session-1", "session-2"] },
      },
    });
  });

  it("5a — skips Weekplanner cleanup when there are no generated sessions", async () => {
    mocks.trainingSeriesFindFirst.mockResolvedValueOnce(makeUnusedSeriesRow());
    mocks.trainingSeriesDelete.mockResolvedValueOnce({ id: SERIES_ID });

    await deleteTrainingSeriesPermanently(TENANT_A, SERIES_ID);

    expect(mocks.weekplannerPlanAllocationDeleteMany).not.toHaveBeenCalled();
    expect(mocks.weekplannerPlanActivityOverrideDeleteMany).not.toHaveBeenCalled();
  });

  it("6 — never deletes a series belonging to another tenant", async () => {
    mocks.trainingSeriesFindFirst.mockResolvedValueOnce(null);

    await expect(deleteTrainingSeriesPermanently(TENANT_B, SERIES_ID)).rejects.toBeInstanceOf(
      TrainingSeriesNotFoundError,
    );
    expect(mocks.trainingSeriesDelete).not.toHaveBeenCalled();
  });

  it("7 — rolls back (never deletes) when Weekplanner cleanup fails inside the transaction", async () => {
    const row = makeUnusedSeriesRow();
    row.sessions = [{ id: "session-1" }];
    row._count.sessions = 1;
    mocks.trainingSeriesFindFirst.mockResolvedValueOnce(row);
    mocks.weekplannerPlanAllocationDeleteMany.mockRejectedValueOnce(new Error("db error"));
    mocks.transaction.mockImplementationOnce(async (fn: (tx: unknown) => Promise<unknown>) => {
      // Mirrors real Prisma $transaction: a thrown error inside the callback
      // propagates out and no partial write is considered committed.
      return fn(makeTx());
    });

    await expect(deleteTrainingSeriesPermanently(TENANT_A, SERIES_ID)).rejects.toThrow(
      "db error",
    );
    expect(mocks.trainingSeriesDelete).not.toHaveBeenCalled();
  });
});
