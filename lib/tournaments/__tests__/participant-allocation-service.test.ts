/**
 * Tests for lib/tournaments/participant-allocation-service.ts
 *
 * Proves TOURNAMENTCENTER-01B requirements:
 *   10. Dressing room is assignable independently per participant.
 *   11. Allowed dressing-room sharing behaves correctly.
 *   14. Archived/invalid resources cannot be newly allocated.
 *
 * All external dependencies (Prisma) are mocked. No DB access.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    tournamentParticipant: { findFirst: vi.fn() },
    facilityResource: { findFirst: vi.fn() },
    tournamentParticipantAllocation: {
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
  listParticipantDressingRoomAllocations,
  addParticipantDressingRoomAllocation,
  removeParticipantDressingRoomAllocation,
} from "../participant-allocation-service";
import {
  TournamentParticipantNotFoundError,
  TournamentParticipantAllocationNotFoundError,
  TournamentParticipantAllocationResourceNotFoundError,
  TournamentParticipantAllocationArchivedResourceError,
  TournamentParticipantAllocationArchivedFacilityError,
  TournamentParticipantAllocationDuplicateError,
} from "../errors";

const TENANT_A = "tenant-a";

function allocationRow(id: string, tournamentParticipantId: string, facilityResourceId: string, code: string) {
  return {
    id,
    tournamentParticipantId,
    notes: null,
    displayOrder: 0,
    facilityResource: {
      id: facilityResourceId,
      code,
      name: code,
      type: "DRESSING_ROOM",
      facilityId: "facility-1",
      facility: { name: "Garderoben" },
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.tournamentParticipant.findFirst).mockResolvedValue({ id: "participant-1" } as never);
  vi.mocked(prisma.tournamentParticipantAllocation.aggregate).mockResolvedValue({
    _max: { displayOrder: null },
  } as never);
  vi.mocked(prisma.facilityResource.findFirst).mockResolvedValue({
    id: "fr-e1",
    status: "ACTIVE",
    facility: { id: "facility-1", status: "ACTIVE" },
  } as never);
});

describe("addParticipantDressingRoomAllocation", () => {
  it("allocates a dressing room to a single participant", async () => {
    vi.mocked(prisma.tournamentParticipantAllocation.create).mockResolvedValue(
      allocationRow("alloc-1", "participant-1", "fr-e1", "E1") as never,
    );

    const result = await addParticipantDressingRoomAllocation(TENANT_A, "participant-1", {
      facilityResourceId: "fr-e1",
    });

    expect(result.facilityResourceCode).toBe("E1");
  });

  // ── Independent per-participant assignment (requirement 10) ───────────────

  it("allows different participants to be assigned different dressing rooms independently", async () => {
    vi.mocked(prisma.tournamentParticipantAllocation.create)
      .mockResolvedValueOnce(allocationRow("alloc-1", "participant-1", "fr-e1", "E1") as never)
      .mockResolvedValueOnce(allocationRow("alloc-2", "participant-2", "fr-e2", "E2") as never);

    const r1 = await addParticipantDressingRoomAllocation(TENANT_A, "participant-1", {
      facilityResourceId: "fr-e1",
    });
    const r2 = await addParticipantDressingRoomAllocation(TENANT_A, "participant-2", {
      facilityResourceId: "fr-e2",
    });

    expect(r1.facilityResourceCode).toBe("E1");
    expect(r2.facilityResourceCode).toBe("E2");
  });

  // ── Allowed dressing-room sharing (requirement 11) ─────────────────────────

  it("allows two different participants to share the same dressing room", async () => {
    vi.mocked(prisma.tournamentParticipantAllocation.create)
      .mockResolvedValueOnce(allocationRow("alloc-1", "participant-1", "fr-shared", "E1") as never)
      .mockResolvedValueOnce(allocationRow("alloc-2", "participant-2", "fr-shared", "E1") as never);

    const r1 = await addParticipantDressingRoomAllocation(TENANT_A, "participant-1", {
      facilityResourceId: "fr-shared",
    });
    const r2 = await addParticipantDressingRoomAllocation(TENANT_A, "participant-2", {
      facilityResourceId: "fr-shared",
    });

    expect(r1.facilityResourceId).toBe(r2.facilityResourceId);
    expect(r1.id).not.toBe(r2.id);
  });

  it("still rejects assigning the SAME resource twice to the SAME participant (duplicate)", async () => {
    vi.mocked(prisma.tournamentParticipantAllocation.create).mockRejectedValue(
      new Error("Unique constraint failed"),
    );

    await expect(
      addParticipantDressingRoomAllocation(TENANT_A, "participant-1", { facilityResourceId: "fr-e1" }),
    ).rejects.toThrow(TournamentParticipantAllocationDuplicateError);
  });

  // ── Archived/invalid resource guards (requirement 14) ──────────────────────

  it("throws TournamentParticipantAllocationResourceNotFoundError for an unknown resource", async () => {
    vi.mocked(prisma.facilityResource.findFirst).mockResolvedValue(null as never);

    await expect(
      addParticipantDressingRoomAllocation(TENANT_A, "participant-1", { facilityResourceId: "fr-unknown" }),
    ).rejects.toThrow(TournamentParticipantAllocationResourceNotFoundError);
  });

  it("throws TournamentParticipantAllocationArchivedResourceError for an archived resource", async () => {
    vi.mocked(prisma.facilityResource.findFirst).mockResolvedValue({
      id: "fr-e1",
      status: "ARCHIVED",
      facility: { id: "facility-1", status: "ACTIVE" },
    } as never);

    await expect(
      addParticipantDressingRoomAllocation(TENANT_A, "participant-1", { facilityResourceId: "fr-e1" }),
    ).rejects.toThrow(TournamentParticipantAllocationArchivedResourceError);
  });

  it("throws TournamentParticipantAllocationArchivedFacilityError for a resource in an archived facility", async () => {
    vi.mocked(prisma.facilityResource.findFirst).mockResolvedValue({
      id: "fr-e1",
      status: "ACTIVE",
      facility: { id: "facility-1", status: "ARCHIVED" },
    } as never);

    await expect(
      addParticipantDressingRoomAllocation(TENANT_A, "participant-1", { facilityResourceId: "fr-e1" }),
    ).rejects.toThrow(TournamentParticipantAllocationArchivedFacilityError);
  });

  it("throws TournamentParticipantNotFoundError for a cross-tenant participant", async () => {
    vi.mocked(prisma.tournamentParticipant.findFirst).mockResolvedValue(null as never);

    await expect(
      addParticipantDressingRoomAllocation(TENANT_A, "participant-1", { facilityResourceId: "fr-e1" }),
    ).rejects.toThrow(TournamentParticipantNotFoundError);
  });
});

describe("removeParticipantDressingRoomAllocation", () => {
  it("removes an existing allocation", async () => {
    vi.mocked(prisma.tournamentParticipantAllocation.findFirst).mockResolvedValue(
      allocationRow("alloc-1", "participant-1", "fr-e1", "E1") as never,
    );
    vi.mocked(prisma.tournamentParticipantAllocation.delete).mockResolvedValue({} as never);

    await removeParticipantDressingRoomAllocation(TENANT_A, "alloc-1");

    expect(prisma.tournamentParticipantAllocation.delete).toHaveBeenCalledWith({ where: { id: "alloc-1" } });
  });

  it("throws TournamentParticipantAllocationNotFoundError for a cross-tenant allocation", async () => {
    vi.mocked(prisma.tournamentParticipantAllocation.findFirst).mockResolvedValue(null as never);

    await expect(removeParticipantDressingRoomAllocation(TENANT_A, "alloc-1")).rejects.toThrow(
      TournamentParticipantAllocationNotFoundError,
    );
  });
});

describe("listParticipantDressingRoomAllocations", () => {
  it("lists allocations for a single participant", async () => {
    vi.mocked(prisma.tournamentParticipantAllocation.findMany).mockResolvedValue([
      allocationRow("alloc-1", "participant-1", "fr-e1", "E1"),
    ] as never);

    const result = await listParticipantDressingRoomAllocations(TENANT_A, "participant-1");
    expect(result).toHaveLength(1);
  });
});
