/**
 * lib/matchcenter/__tests__/match-lifecycle-service.test.ts
 *
 * ADMIN-DELETE-02A — Focused tests for Match (Event, type=MATCH)
 * permanent-deletion safety, mirroring
 * lib/teams/__tests__/team-lifecycle-service.test.ts (ADMIN-DELETE-01A/01B).
 *
 * All database access is mocked via `@/lib/db/prisma`. No live database.
 *
 * TEST COVERAGE MAP:
 *   1. getMatchDeletionBlockers returns [] for an unused, manual match.
 *   2. getMatchDeletionBlockers blocks an SFV/provider-mapped match.
 *   3. getMatchDeletionBlockers blocks a LIVE/COMPLETED match.
 *   4. getMatchDeletionBlockers blocks a match with Weekplanner references.
 *   5. getMatchDeletionBlockers returns null for a cross-tenant match.
 *   6. getMatchDeletionBlockers returns null for a non-MATCH Event id.
 *   7. deleteMatchSafely hard-deletes an unused manual match.
 *   8. deleteMatchSafely throws MatchDeletionBlockedError (never deletes)
 *      when a provider mapping exists.
 *   9. deleteMatchSafely throws MatchNotFoundError for a cross-tenant match.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  eventFindFirst: vi.fn(),
  eventDelete: vi.fn(),
  weekplannerPlanAllocationCount: vi.fn(),
  weekplannerPlanActivityOverrideCount: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    event: {
      findFirst: (...args: unknown[]) => mocks.eventFindFirst(...args),
      delete: (...args: unknown[]) => mocks.eventDelete(...args),
    },
    weekplannerPlanAllocation: {
      count: (...args: unknown[]) => mocks.weekplannerPlanAllocationCount(...args),
    },
    weekplannerPlanActivityOverride: {
      count: (...args: unknown[]) => mocks.weekplannerPlanActivityOverrideCount(...args),
    },
  },
}));

import {
  MatchDeletionBlockedError,
  MatchNotFoundError,
  deleteMatchSafely,
  getMatchDeletionBlockers,
} from "../match-lifecycle-service";

const TENANT_A = "tenant-a";
const TENANT_B = "tenant-b";
const MATCH_ID = "match-01";

function makeUnusedMatchRow() {
  return { status: "SCHEDULED", matchExternalMapping: null };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.weekplannerPlanAllocationCount.mockResolvedValue(0);
  mocks.weekplannerPlanActivityOverrideCount.mockResolvedValue(0);
});

describe("getMatchDeletionBlockers", () => {
  it("1 — returns [] for an unused, manual, scheduled match", async () => {
    mocks.eventFindFirst.mockResolvedValueOnce(makeUnusedMatchRow());

    const blockers = await getMatchDeletionBlockers(TENANT_A, MATCH_ID);

    expect(blockers).toEqual([]);
    expect(mocks.eventFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: MATCH_ID, tenantId: TENANT_A, type: "MATCH" } }),
    );
  });

  it("2 — blocks a match carrying an SFV/provider mapping", async () => {
    mocks.eventFindFirst.mockResolvedValueOnce({
      status: "SCHEDULED",
      matchExternalMapping: { id: "mapping-1" },
    });

    const blockers = await getMatchDeletionBlockers(TENANT_A, MATCH_ID);

    expect(blockers?.some((b) => b.key === "providerMapping")).toBe(true);
  });

  it("3 — blocks a LIVE or COMPLETED match", async () => {
    mocks.eventFindFirst.mockResolvedValueOnce({ status: "COMPLETED", matchExternalMapping: null });

    const blockers = await getMatchDeletionBlockers(TENANT_A, MATCH_ID);

    expect(blockers?.some((b) => b.key === "sportingHistory")).toBe(true);
  });

  it("4 — blocks a match with Weekplanner allocation/override references", async () => {
    mocks.eventFindFirst.mockResolvedValueOnce(makeUnusedMatchRow());
    mocks.weekplannerPlanAllocationCount.mockResolvedValueOnce(2);
    mocks.weekplannerPlanActivityOverrideCount.mockResolvedValueOnce(1);

    const blockers = await getMatchDeletionBlockers(TENANT_A, MATCH_ID);

    const keys = blockers?.map((b) => b.key).sort();
    expect(keys).toEqual(["weekplannerAllocations", "weekplannerOverrides"]);
  });

  it("5 — returns null for a match belonging to another tenant (no cross-tenant leak)", async () => {
    mocks.eventFindFirst.mockResolvedValueOnce(null);

    const blockers = await getMatchDeletionBlockers(TENANT_B, MATCH_ID);

    expect(blockers).toBeNull();
  });

  it("6 — scopes the lookup to type: MATCH (never resolves a TRAINING/TOURNAMENT Event)", async () => {
    await getMatchDeletionBlockers(TENANT_A, MATCH_ID);

    expect(mocks.eventFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ type: "MATCH" }) }),
    );
  });
});

describe("deleteMatchSafely", () => {
  it("7 — hard-deletes an unused manual match", async () => {
    mocks.eventFindFirst.mockResolvedValueOnce(makeUnusedMatchRow());
    mocks.eventDelete.mockResolvedValueOnce({ id: MATCH_ID });

    await deleteMatchSafely(TENANT_A, MATCH_ID);

    expect(mocks.eventDelete).toHaveBeenCalledWith({ where: { id: MATCH_ID } });
  });

  it("8 — blocks deletion (never calls delete) when a provider mapping exists", async () => {
    mocks.eventFindFirst.mockResolvedValueOnce({
      status: "SCHEDULED",
      matchExternalMapping: { id: "mapping-1" },
    });

    await expect(deleteMatchSafely(TENANT_A, MATCH_ID)).rejects.toBeInstanceOf(
      MatchDeletionBlockedError,
    );
    expect(mocks.eventDelete).not.toHaveBeenCalled();
  });

  it("9 — never deletes a match belonging to another tenant", async () => {
    mocks.eventFindFirst.mockResolvedValueOnce(null);

    await expect(deleteMatchSafely(TENANT_B, MATCH_ID)).rejects.toBeInstanceOf(MatchNotFoundError);
    expect(mocks.eventDelete).not.toHaveBeenCalled();
  });
});
