/**
 * Tests for lib/tournaments/resource-allocation-service.ts
 *
 * Proves TOURNAMENTCENTER-01B requirements:
 *   9. Home tournament supports multiple pitch/hall resources.
 *   14. Archived/invalid resources cannot be newly allocated.
 *
 * All external dependencies (Prisma) are mocked. No DB access.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    event: { findFirst: vi.fn() },
    facilityResource: { findFirst: vi.fn() },
    tournamentResourceAllocation: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      aggregate: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/db/prisma";
import {
  listTournamentResourceAllocations,
  addTournamentResourceAllocation,
  removeTournamentResourceAllocation,
} from "../resource-allocation-service";
import {
  TournamentNotFoundError,
  TournamentResourceAllocationNotFoundError,
  TournamentResourceAllocationResourceNotFoundError,
  TournamentResourceAllocationArchivedResourceError,
  TournamentResourceAllocationArchivedFacilityError,
  TournamentResourceAllocationDuplicateError,
} from "../errors";

const TENANT_A = "tenant-a";
const TOURNAMENT_ID = "tournament-01";

function allocationRow(id: string, facilityResourceId: string, code: string) {
  return {
    id,
    eventId: TOURNAMENT_ID,
    notes: null,
    displayOrder: 0,
    facilityResource: {
      id: facilityResourceId,
      code,
      name: code,
      type: "FULL_PITCH",
      facilityId: "facility-1",
      facility: { name: "Sportanlage" },
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.event.findFirst).mockResolvedValue({ id: TOURNAMENT_ID } as never);
  vi.mocked(prisma.tournamentResourceAllocation.aggregate).mockResolvedValue({
    _max: { displayOrder: null },
  } as never);
});

describe("addTournamentResourceAllocation", () => {
  it("allocates an active, non-archived resource", async () => {
    vi.mocked(prisma.facilityResource.findFirst).mockResolvedValue({
      id: "fr-kr2",
      status: "ACTIVE",
      facility: { id: "facility-1", status: "ACTIVE" },
    } as never);
    vi.mocked(prisma.tournamentResourceAllocation.create).mockResolvedValue(
      allocationRow("alloc-1", "fr-kr2", "KR2") as never,
    );

    const result = await addTournamentResourceAllocation(TENANT_A, TOURNAMENT_ID, {
      facilityResourceId: "fr-kr2",
    });

    expect(result.facilityResourceId).toBe("fr-kr2");
  });

  // ── Multiple pitch/hall resources (requirement 9) ──────────────────────────

  it("supports allocating multiple pitch/hall resources to the same HOME tournament", async () => {
    vi.mocked(prisma.facilityResource.findFirst).mockResolvedValue({
      id: "fr-kr2",
      status: "ACTIVE",
      facility: { id: "facility-1", status: "ACTIVE" },
    } as never);
    vi.mocked(prisma.tournamentResourceAllocation.create)
      .mockResolvedValueOnce(allocationRow("alloc-1", "fr-kr2", "KR2") as never)
      .mockResolvedValueOnce(allocationRow("alloc-2", "fr-kr3a", "KR3 A") as never)
      .mockResolvedValueOnce(allocationRow("alloc-3", "fr-kr3b", "KR3 B") as never);

    const r1 = await addTournamentResourceAllocation(TENANT_A, TOURNAMENT_ID, { facilityResourceId: "fr-kr2" });
    const r2 = await addTournamentResourceAllocation(TENANT_A, TOURNAMENT_ID, { facilityResourceId: "fr-kr3a" });
    const r3 = await addTournamentResourceAllocation(TENANT_A, TOURNAMENT_ID, { facilityResourceId: "fr-kr3b" });

    expect([r1.id, r2.id, r3.id]).toEqual(["alloc-1", "alloc-2", "alloc-3"]);
    expect(prisma.tournamentResourceAllocation.create).toHaveBeenCalledTimes(3);
  });

  // ── Archived/invalid resource guards (requirement 14) ──────────────────────

  it("throws TournamentResourceAllocationResourceNotFoundError for an unknown/cross-tenant resource", async () => {
    vi.mocked(prisma.facilityResource.findFirst).mockResolvedValue(null as never);

    await expect(
      addTournamentResourceAllocation(TENANT_A, TOURNAMENT_ID, { facilityResourceId: "fr-unknown" }),
    ).rejects.toThrow(TournamentResourceAllocationResourceNotFoundError);
    expect(prisma.tournamentResourceAllocation.create).not.toHaveBeenCalled();
  });

  it("throws TournamentResourceAllocationArchivedResourceError for an archived resource", async () => {
    vi.mocked(prisma.facilityResource.findFirst).mockResolvedValue({
      id: "fr-kr2",
      status: "ARCHIVED",
      facility: { id: "facility-1", status: "ACTIVE" },
    } as never);

    await expect(
      addTournamentResourceAllocation(TENANT_A, TOURNAMENT_ID, { facilityResourceId: "fr-kr2" }),
    ).rejects.toThrow(TournamentResourceAllocationArchivedResourceError);
    expect(prisma.tournamentResourceAllocation.create).not.toHaveBeenCalled();
  });

  it("throws TournamentResourceAllocationArchivedFacilityError for a resource in an archived facility", async () => {
    vi.mocked(prisma.facilityResource.findFirst).mockResolvedValue({
      id: "fr-kr2",
      status: "ACTIVE",
      facility: { id: "facility-1", status: "ARCHIVED" },
    } as never);

    await expect(
      addTournamentResourceAllocation(TENANT_A, TOURNAMENT_ID, { facilityResourceId: "fr-kr2" }),
    ).rejects.toThrow(TournamentResourceAllocationArchivedFacilityError);
    expect(prisma.tournamentResourceAllocation.create).not.toHaveBeenCalled();
  });

  it("maps a unique-constraint violation to TournamentResourceAllocationDuplicateError", async () => {
    vi.mocked(prisma.facilityResource.findFirst).mockResolvedValue({
      id: "fr-kr2",
      status: "ACTIVE",
      facility: { id: "facility-1", status: "ACTIVE" },
    } as never);
    vi.mocked(prisma.tournamentResourceAllocation.create).mockRejectedValue(
      new Error("Unique constraint failed"),
    );

    await expect(
      addTournamentResourceAllocation(TENANT_A, TOURNAMENT_ID, { facilityResourceId: "fr-kr2" }),
    ).rejects.toThrow(TournamentResourceAllocationDuplicateError);
  });

  it("throws TournamentNotFoundError for a cross-tenant tournament", async () => {
    vi.mocked(prisma.event.findFirst).mockResolvedValue(null as never);

    await expect(
      addTournamentResourceAllocation(TENANT_A, TOURNAMENT_ID, { facilityResourceId: "fr-kr2" }),
    ).rejects.toThrow(TournamentNotFoundError);
  });
});

describe("removeTournamentResourceAllocation", () => {
  it("removes an existing allocation", async () => {
    vi.mocked(prisma.tournamentResourceAllocation.findFirst).mockResolvedValue(
      allocationRow("alloc-1", "fr-kr2", "KR2") as never,
    );
    vi.mocked(prisma.tournamentResourceAllocation.delete).mockResolvedValue({} as never);

    await removeTournamentResourceAllocation(TENANT_A, "alloc-1");

    expect(prisma.tournamentResourceAllocation.delete).toHaveBeenCalledWith({ where: { id: "alloc-1" } });
  });

  it("throws TournamentResourceAllocationNotFoundError for a cross-tenant allocation", async () => {
    vi.mocked(prisma.tournamentResourceAllocation.findFirst).mockResolvedValue(null as never);

    await expect(removeTournamentResourceAllocation(TENANT_A, "alloc-1")).rejects.toThrow(
      TournamentResourceAllocationNotFoundError,
    );
  });
});

describe("listTournamentResourceAllocations", () => {
  it("lists multiple allocations ordered by displayOrder", async () => {
    vi.mocked(prisma.tournamentResourceAllocation.findMany).mockResolvedValue([
      allocationRow("alloc-1", "fr-kr2", "KR2"),
      allocationRow("alloc-2", "fr-kr3a", "KR3 A"),
    ] as never);

    const result = await listTournamentResourceAllocations(TENANT_A, TOURNAMENT_ID);
    expect(result).toHaveLength(2);
  });
});
