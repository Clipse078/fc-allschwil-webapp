/**
 * lib/training/__tests__/training-lifecycle-service.test.ts
 *
 * ADMIN-DELETE-02A — Focused tests for TrainingSeries permanent-deletion
 * safety, mirroring lib/teams/__tests__/team-lifecycle-service.test.ts
 * (ADMIN-DELETE-01A/01B).
 *
 * All database access is mocked via `@/lib/db/prisma`. No live database.
 *
 * TEST COVERAGE MAP:
 *   1. getTrainingSeriesDeletionBlockers returns [] for an unused series
 *      (no sessions/allocations/plan assignments).
 *   2. getTrainingSeriesDeletionBlockers reports sessions/allocations/
 *      planAssignments dependencies when present.
 *   3. getTrainingSeriesDeletionBlockers returns null for a cross-tenant
 *      series (never leaks existence).
 *   4. deleteTrainingSeriesSafely hard-deletes an unused series.
 *   5. deleteTrainingSeriesSafely throws TrainingSeriesDeletionBlockedError
 *      (never deletes) when history exists.
 *   6. deleteTrainingSeriesSafely throws TrainingSeriesNotFoundError for a
 *      cross-tenant series (never deletes).
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  trainingSeriesFindFirst: vi.fn(),
  trainingSeriesDelete: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    trainingSeries: {
      findFirst: (...args: unknown[]) => mocks.trainingSeriesFindFirst(...args),
      delete: (...args: unknown[]) => mocks.trainingSeriesDelete(...args),
    },
  },
}));

import { TrainingSeriesNotFoundError } from "../errors";
import {
  TrainingSeriesDeletionBlockedError,
  deleteTrainingSeriesSafely,
  getTrainingSeriesDeletionBlockers,
} from "../training-lifecycle-service";

const TENANT_A = "tenant-a";
const TENANT_B = "tenant-b";
const SERIES_ID = "series-01";

function makeUnusedSeriesRow() {
  return {
    _count: {
      sessions: 0,
      allocations: 0,
      planAssignments: 0,
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getTrainingSeriesDeletionBlockers", () => {
  it("1 — returns [] for an unused series (no sessions/allocations/plan assignments)", async () => {
    mocks.trainingSeriesFindFirst.mockResolvedValueOnce(makeUnusedSeriesRow());

    const blockers = await getTrainingSeriesDeletionBlockers(TENANT_A, SERIES_ID);

    expect(blockers).toEqual([]);
    expect(mocks.trainingSeriesFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: SERIES_ID, tenantId: TENANT_A } }),
    );
  });

  it("2 — reports sessions, allocations, and planAssignments dependencies when present", async () => {
    const row = makeUnusedSeriesRow();
    row._count.sessions = 12;
    row._count.allocations = 1;
    row._count.planAssignments = 1;
    mocks.trainingSeriesFindFirst.mockResolvedValueOnce(row);

    const blockers = await getTrainingSeriesDeletionBlockers(TENANT_A, SERIES_ID);

    const keys = blockers?.map((b) => b.key).sort();
    expect(keys).toEqual(["allocations", "planAssignments", "sessions"]);
  });

  it("3 — returns null for a series belonging to another tenant (no cross-tenant leak)", async () => {
    mocks.trainingSeriesFindFirst.mockResolvedValueOnce(null);

    const blockers = await getTrainingSeriesDeletionBlockers(TENANT_B, SERIES_ID);

    expect(blockers).toBeNull();
  });
});

describe("deleteTrainingSeriesSafely", () => {
  it("4 — hard-deletes an unused series", async () => {
    mocks.trainingSeriesFindFirst.mockResolvedValueOnce(makeUnusedSeriesRow());
    mocks.trainingSeriesDelete.mockResolvedValueOnce({ id: SERIES_ID });

    await deleteTrainingSeriesSafely(TENANT_A, SERIES_ID);

    expect(mocks.trainingSeriesDelete).toHaveBeenCalledWith({ where: { id: SERIES_ID } });
  });

  it("5 — blocks deletion (never calls delete) when generated sessions exist", async () => {
    const row = makeUnusedSeriesRow();
    row._count.sessions = 5;
    mocks.trainingSeriesFindFirst.mockResolvedValueOnce(row);

    await expect(deleteTrainingSeriesSafely(TENANT_A, SERIES_ID)).rejects.toBeInstanceOf(
      TrainingSeriesDeletionBlockedError,
    );
    expect(mocks.trainingSeriesDelete).not.toHaveBeenCalled();
  });

  it("6 — never deletes a series belonging to another tenant", async () => {
    mocks.trainingSeriesFindFirst.mockResolvedValueOnce(null);

    await expect(deleteTrainingSeriesSafely(TENANT_B, SERIES_ID)).rejects.toBeInstanceOf(
      TrainingSeriesNotFoundError,
    );
    expect(mocks.trainingSeriesDelete).not.toHaveBeenCalled();
  });
});
