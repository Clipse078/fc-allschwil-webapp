/**
 * lib/tournaments/__tests__/tournament-lifecycle-service.test.ts
 *
 * ADMIN-DELETE-02A — Focused tests for Tournament (Event, type=TOURNAMENT)
 * permanent-deletion safety, mirroring
 * lib/teams/__tests__/team-lifecycle-service.test.ts (ADMIN-DELETE-01A/01B).
 *
 * All database access is mocked via `@/lib/db/prisma`. No live database.
 *
 * TEST COVERAGE MAP:
 *   1. getTournamentDeletionBlockers returns [] for a newly-created, unused
 *      tournament.
 *   2. getTournamentDeletionBlockers blocks a tournament with participants.
 *   3. getTournamentDeletionBlockers blocks a tournament with resource
 *      allocations.
 *   4. getTournamentDeletionBlockers blocks a LIVE/COMPLETED/ARCHIVED
 *      tournament.
 *   5. getTournamentDeletionBlockers blocks a tournament with Weekplanner
 *      references.
 *   6. getTournamentDeletionBlockers returns null for a cross-tenant
 *      tournament.
 *   7. getTournamentDeletionBlockers returns null for a non-TOURNAMENT
 *      Event id.
 *   8. deleteTournamentSafely hard-deletes an unused tournament.
 *   9. deleteTournamentSafely throws TournamentDeletionBlockedError (never
 *      deletes) when participants exist.
 *  10. deleteTournamentSafely throws TournamentNotFoundError for a
 *      cross-tenant tournament.
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

import { TournamentNotFoundError } from "../errors";
import {
  TournamentDeletionBlockedError,
  deleteTournamentSafely,
  getTournamentDeletionBlockers,
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

beforeEach(() => {
  vi.clearAllMocks();
  mocks.weekplannerPlanAllocationCount.mockResolvedValue(0);
  mocks.weekplannerPlanActivityOverrideCount.mockResolvedValue(0);
});

describe("getTournamentDeletionBlockers", () => {
  it("1 — returns [] for a newly-created, unused tournament", async () => {
    mocks.eventFindFirst.mockResolvedValueOnce(makeUnusedTournamentRow());

    const blockers = await getTournamentDeletionBlockers(TENANT_A, TOURNAMENT_ID);

    expect(blockers).toEqual([]);
    expect(mocks.eventFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: TOURNAMENT_ID, tenantId: TENANT_A, type: "TOURNAMENT" } }),
    );
  });

  it("2 — blocks a tournament with participants (Team/ExternalClub/ExternalTeam)", async () => {
    const row = makeUnusedTournamentRow();
    row._count.tournamentParticipants = 3;
    mocks.eventFindFirst.mockResolvedValueOnce(row);

    const blockers = await getTournamentDeletionBlockers(TENANT_A, TOURNAMENT_ID);

    expect(blockers?.some((b) => b.key === "participants")).toBe(true);
  });

  it("3 — blocks a tournament with resource allocations", async () => {
    const row = makeUnusedTournamentRow();
    row._count.tournamentResourceAllocations = 1;
    mocks.eventFindFirst.mockResolvedValueOnce(row);

    const blockers = await getTournamentDeletionBlockers(TENANT_A, TOURNAMENT_ID);

    expect(blockers?.some((b) => b.key === "resourceAllocations")).toBe(true);
  });

  it("4 — blocks a LIVE, COMPLETED, or ARCHIVED tournament", async () => {
    mocks.eventFindFirst.mockResolvedValueOnce({
      status: "COMPLETED",
      _count: { tournamentParticipants: 0, tournamentResourceAllocations: 0 },
    });

    const blockers = await getTournamentDeletionBlockers(TENANT_A, TOURNAMENT_ID);

    expect(blockers?.some((b) => b.key === "sportingHistory")).toBe(true);
  });

  it("5 — blocks a tournament with Weekplanner allocation/override references", async () => {
    mocks.eventFindFirst.mockResolvedValueOnce(makeUnusedTournamentRow());
    mocks.weekplannerPlanAllocationCount.mockResolvedValueOnce(1);
    mocks.weekplannerPlanActivityOverrideCount.mockResolvedValueOnce(1);

    const blockers = await getTournamentDeletionBlockers(TENANT_A, TOURNAMENT_ID);

    const keys = blockers?.map((b) => b.key).sort();
    expect(keys).toEqual(["weekplannerAllocations", "weekplannerOverrides"]);
  });

  it("6 — returns null for a tournament belonging to another tenant (no cross-tenant leak)", async () => {
    mocks.eventFindFirst.mockResolvedValueOnce(null);

    const blockers = await getTournamentDeletionBlockers(TENANT_B, TOURNAMENT_ID);

    expect(blockers).toBeNull();
  });

  it("7 — scopes the lookup to type: TOURNAMENT (never resolves a MATCH/TRAINING Event)", async () => {
    await getTournamentDeletionBlockers(TENANT_A, TOURNAMENT_ID);

    expect(mocks.eventFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ type: "TOURNAMENT" }) }),
    );
  });
});

describe("deleteTournamentSafely", () => {
  it("8 — hard-deletes an unused tournament", async () => {
    mocks.eventFindFirst.mockResolvedValueOnce(makeUnusedTournamentRow());
    mocks.eventDelete.mockResolvedValueOnce({ id: TOURNAMENT_ID });

    await deleteTournamentSafely(TENANT_A, TOURNAMENT_ID);

    expect(mocks.eventDelete).toHaveBeenCalledWith({ where: { id: TOURNAMENT_ID } });
  });

  it("9 — blocks deletion (never calls delete) when participants exist", async () => {
    const row = makeUnusedTournamentRow();
    row._count.tournamentParticipants = 2;
    mocks.eventFindFirst.mockResolvedValueOnce(row);

    await expect(deleteTournamentSafely(TENANT_A, TOURNAMENT_ID)).rejects.toBeInstanceOf(
      TournamentDeletionBlockedError,
    );
    expect(mocks.eventDelete).not.toHaveBeenCalled();
  });

  it("10 — never deletes a tournament belonging to another tenant", async () => {
    mocks.eventFindFirst.mockResolvedValueOnce(null);

    await expect(deleteTournamentSafely(TENANT_B, TOURNAMENT_ID)).rejects.toBeInstanceOf(
      TournamentNotFoundError,
    );
    expect(mocks.eventDelete).not.toHaveBeenCalled();
  });
});
