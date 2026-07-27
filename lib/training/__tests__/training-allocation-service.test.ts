/**
 * lib/training/__tests__/training-allocation-service.test.ts
 *
 * Regression tests for lib/training/training-allocation-service.ts
 * (TRAINING-ALLOCATIONS-01).
 *
 * Coverage:
 *   A. createTrainingAllocation
 *       A1. successful create
 *       A2. auto-increment displayOrder
 *       A3. explicit displayOrder
 *       A4. notes preserved
 *       A5. series not found
 *       A6. resource not found
 *       A7. archived resource rejected
 *       A8. duplicate allocation rejected
 *       A9. tenant isolation — series belongs to different tenant
 *       A10. tenant isolation — resource belongs to different tenant
 *       A11. multiple resources per training (multi-allocation)
 *
 *   B. updateTrainingAllocation
 *       B1. update notes
 *       B2. update displayOrder
 *       B3. allocation not found
 *       B4. cross-tenant update rejected
 *
 *   C. deleteTrainingAllocation
 *       C1. successful delete
 *       C2. allocation not found
 *       C3. cross-tenant delete rejected
 *
 *   D. listAllocationsByTrainingSeries
 *       D1. returns empty list when no allocations
 *       D2. returns ordered allocations
 *       D3. series not found
 *       D4. tenant isolation
 *
 *   E. listAllocationsByFacilityResource
 *       E1. returns allocations for a resource
 *       E2. resource not found
 *       E3. tenant isolation
 *
 *   F. getTrainingAllocation
 *       F1. returns allocation by id
 *       F2. not found
 *       F3. cross-tenant rejected
 *
 *   G. ordering — allocations ordered by displayOrder then createdAt
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

// ── Mock Prisma ───────────────────────────────────────────────────────────────

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    trainingSeries: {
      findFirst: vi.fn(),
    },
    facilityResource: {
      findFirst: vi.fn(),
    },
    trainingAllocation: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      aggregate: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/db/prisma";
import {
  createTrainingAllocation,
  updateTrainingAllocation,
  deleteTrainingAllocation,
  listAllocationsByTrainingSeries,
  listAllocationsByFacilityResource,
  getTrainingAllocation,
} from "../training-allocation-service";
import {
  TrainingSeriesNotFoundError,
  TrainingAllocationNotFoundError,
  TrainingAllocationDuplicateError,
  TrainingAllocationArchivedResourceError,
  TrainingAllocationResourceNotFoundError,
} from "../errors";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const TENANT_A = "tenant-a";
const TENANT_B = "tenant-b";
const SERIES_ID = "series-01";
const SERIES_ID_2 = "series-02";
const RESOURCE_ID = "resource-01";
const RESOURCE_ID_2 = "resource-02";
const FACILITY_ID = "facility-01";
const ALLOCATION_ID = "allocation-01";
const ALLOCATION_ID_2 = "allocation-02";

function makeSeriesRow(overrides: Record<string, unknown> = {}) {
  return {
    id: SERIES_ID,
    tenantId: TENANT_A,
    ...overrides,
  };
}

function makeResourceRow(overrides: Record<string, unknown> = {}) {
  return {
    id: RESOURCE_ID,
    tenantId: TENANT_A,
    status: "ACTIVE",
    ...overrides,
  };
}

function makeAllocationRow(overrides: Record<string, unknown> = {}) {
  return {
    id: ALLOCATION_ID,
    tenantId: TENANT_A,
    trainingSeriesId: SERIES_ID,
    facilityResourceId: RESOURCE_ID,
    notes: null,
    displayOrder: 0,
    createdAt: new Date("2026-07-27T10:00:00Z"),
    updatedAt: new Date("2026-07-27T10:00:00Z"),
    facilityResource: {
      name: "Pitch A Full",
      code: "PITCH_A_FULL",
      type: "FULL_PITCH",
      facilityId: FACILITY_ID,
      facility: { name: "Sportanlage Brüel" },
    },
    ...overrides,
  };
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();

  vi.mocked(prisma.trainingSeries.findFirst).mockResolvedValue(makeSeriesRow() as never);
  vi.mocked(prisma.facilityResource.findFirst).mockResolvedValue(makeResourceRow() as never);
  vi.mocked(prisma.trainingAllocation.findFirst).mockResolvedValue(makeAllocationRow() as never);
  vi.mocked(prisma.trainingAllocation.findMany).mockResolvedValue([]);
  vi.mocked(prisma.trainingAllocation.create).mockResolvedValue(makeAllocationRow() as never);
  vi.mocked(prisma.trainingAllocation.update).mockResolvedValue(makeAllocationRow() as never);
  vi.mocked(prisma.trainingAllocation.delete).mockResolvedValue({} as never);
  vi.mocked(prisma.trainingAllocation.aggregate).mockResolvedValue({ _max: { displayOrder: null } } as never);
});

// ── A. createTrainingAllocation ───────────────────────────────────────────────

describe("A. createTrainingAllocation", () => {
  it("A1. creates an allocation and returns a DTO", async () => {
    const result = await createTrainingAllocation(TENANT_A, {
      trainingSeriesId: SERIES_ID,
      facilityResourceId: RESOURCE_ID,
    });

    expect(result.id).toBe(ALLOCATION_ID);
    expect(result.tenantId).toBe(TENANT_A);
    expect(result.trainingSeriesId).toBe(SERIES_ID);
    expect(result.facilityResourceId).toBe(RESOURCE_ID);
    expect(result.facilityResourceName).toBe("Pitch A Full");
    expect(result.facilityResourceCode).toBe("PITCH_A_FULL");
    expect(result.facilityResourceType).toBe("FULL_PITCH");
    expect(result.facilityName).toBe("Sportanlage Brüel");
    expect(prisma.trainingAllocation.create).toHaveBeenCalledTimes(1);
  });

  it("A2. auto-increments displayOrder when not supplied (no existing allocations)", async () => {
    vi.mocked(prisma.trainingAllocation.aggregate).mockResolvedValue({
      _max: { displayOrder: null },
    } as never);

    await createTrainingAllocation(TENANT_A, {
      trainingSeriesId: SERIES_ID,
      facilityResourceId: RESOURCE_ID,
    });

    expect(prisma.trainingAllocation.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ displayOrder: 0 }) }),
    );
  });

  it("A3. uses next displayOrder after existing allocations", async () => {
    vi.mocked(prisma.trainingAllocation.aggregate).mockResolvedValue({
      _max: { displayOrder: 4 },
    } as never);

    await createTrainingAllocation(TENANT_A, {
      trainingSeriesId: SERIES_ID,
      facilityResourceId: RESOURCE_ID,
    });

    expect(prisma.trainingAllocation.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ displayOrder: 5 }) }),
    );
  });

  it("A3b. respects explicit displayOrder when provided", async () => {
    await createTrainingAllocation(TENANT_A, {
      trainingSeriesId: SERIES_ID,
      facilityResourceId: RESOURCE_ID,
      displayOrder: 99,
    });

    expect(prisma.trainingAllocation.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ displayOrder: 99 }) }),
    );
  });

  it("A4. persists notes when provided", async () => {
    await createTrainingAllocation(TENANT_A, {
      trainingSeriesId: SERIES_ID,
      facilityResourceId: RESOURCE_ID,
      notes: "shared with U9",
    });

    expect(prisma.trainingAllocation.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ notes: "shared with U9" }) }),
    );
  });

  it("A5. throws TrainingSeriesNotFoundError when series not found", async () => {
    vi.mocked(prisma.trainingSeries.findFirst).mockResolvedValue(null);

    await expect(
      createTrainingAllocation(TENANT_A, {
        trainingSeriesId: SERIES_ID,
        facilityResourceId: RESOURCE_ID,
      }),
    ).rejects.toThrow(TrainingSeriesNotFoundError);

    expect(prisma.trainingAllocation.create).not.toHaveBeenCalled();
  });

  it("A6. throws TrainingAllocationResourceNotFoundError when resource not found", async () => {
    vi.mocked(prisma.facilityResource.findFirst).mockResolvedValue(null);

    await expect(
      createTrainingAllocation(TENANT_A, {
        trainingSeriesId: SERIES_ID,
        facilityResourceId: RESOURCE_ID,
      }),
    ).rejects.toThrow(TrainingAllocationResourceNotFoundError);

    expect(prisma.trainingAllocation.create).not.toHaveBeenCalled();
  });

  it("A7. throws TrainingAllocationArchivedResourceError for archived resource", async () => {
    vi.mocked(prisma.facilityResource.findFirst).mockResolvedValue(
      makeResourceRow({ status: "ARCHIVED" }) as never,
    );

    await expect(
      createTrainingAllocation(TENANT_A, {
        trainingSeriesId: SERIES_ID,
        facilityResourceId: RESOURCE_ID,
      }),
    ).rejects.toThrow(TrainingAllocationArchivedResourceError);

    expect(prisma.trainingAllocation.create).not.toHaveBeenCalled();
  });

  it("A8. throws TrainingAllocationDuplicateError on unique constraint violation", async () => {
    vi.mocked(prisma.trainingAllocation.create).mockRejectedValue(
      new Error("Unique constraint failed on the fields: (`trainingSeriesId`,`facilityResourceId`)"),
    );

    await expect(
      createTrainingAllocation(TENANT_A, {
        trainingSeriesId: SERIES_ID,
        facilityResourceId: RESOURCE_ID,
      }),
    ).rejects.toThrow(TrainingAllocationDuplicateError);
  });

  it("A9. rejects allocation when series belongs to a different tenant", async () => {
    vi.mocked(prisma.trainingSeries.findFirst).mockResolvedValue(null);

    await expect(
      createTrainingAllocation(TENANT_B, {
        trainingSeriesId: SERIES_ID,
        facilityResourceId: RESOURCE_ID,
      }),
    ).rejects.toThrow(TrainingSeriesNotFoundError);
  });

  it("A10. rejects allocation when resource belongs to a different tenant", async () => {
    vi.mocked(prisma.facilityResource.findFirst).mockResolvedValue(null);

    await expect(
      createTrainingAllocation(TENANT_B, {
        trainingSeriesId: SERIES_ID,
        facilityResourceId: RESOURCE_ID,
      }),
    ).rejects.toThrow(TrainingAllocationResourceNotFoundError);
  });

  it("A11. supports multiple resource allocations for the same training (multi-allocation)", async () => {
    // First allocation (FULL_PITCH)
    vi.mocked(prisma.trainingAllocation.create)
      .mockResolvedValueOnce(
        makeAllocationRow({
          id: ALLOCATION_ID,
          facilityResourceId: RESOURCE_ID,
          displayOrder: 0,
          facilityResource: {
            name: "Half Pitch A West",
            code: "HP_A_WEST",
            type: "HALF_PITCH",
            facilityId: FACILITY_ID,
            facility: { name: "Sportanlage Brüel" },
          },
        }) as never,
      )
      .mockResolvedValueOnce(
        makeAllocationRow({
          id: ALLOCATION_ID_2,
          facilityResourceId: RESOURCE_ID_2,
          displayOrder: 1,
          facilityResource: {
            name: "Half Pitch A East",
            code: "HP_A_EAST",
            type: "HALF_PITCH",
            facilityId: FACILITY_ID,
            facility: { name: "Sportanlage Brüel" },
          },
        }) as never,
      );

    const first = await createTrainingAllocation(TENANT_A, {
      trainingSeriesId: SERIES_ID,
      facilityResourceId: RESOURCE_ID,
    });
    const second = await createTrainingAllocation(TENANT_A, {
      trainingSeriesId: SERIES_ID,
      facilityResourceId: RESOURCE_ID_2,
    });

    expect(first.facilityResourceCode).toBe("HP_A_WEST");
    expect(second.facilityResourceCode).toBe("HP_A_EAST");
    expect(prisma.trainingAllocation.create).toHaveBeenCalledTimes(2);
  });
});

// ── B. updateTrainingAllocation ───────────────────────────────────────────────

describe("B. updateTrainingAllocation", () => {
  it("B1. updates notes", async () => {
    vi.mocked(prisma.trainingAllocation.update).mockResolvedValue(
      makeAllocationRow({ notes: "updated note" }) as never,
    );

    const result = await updateTrainingAllocation(TENANT_A, ALLOCATION_ID, {
      notes: "updated note",
    });

    expect(result.notes).toBe("updated note");
    expect(prisma.trainingAllocation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ notes: "updated note" }),
      }),
    );
  });

  it("B2. updates displayOrder", async () => {
    vi.mocked(prisma.trainingAllocation.update).mockResolvedValue(
      makeAllocationRow({ displayOrder: 5 }) as never,
    );

    const result = await updateTrainingAllocation(TENANT_A, ALLOCATION_ID, {
      displayOrder: 5,
    });

    expect(result.displayOrder).toBe(5);
    expect(prisma.trainingAllocation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ displayOrder: 5 }),
      }),
    );
  });

  it("B3. throws TrainingAllocationNotFoundError when allocation not found", async () => {
    vi.mocked(prisma.trainingAllocation.findFirst).mockResolvedValue(null);

    await expect(
      updateTrainingAllocation(TENANT_A, ALLOCATION_ID, { notes: "x" }),
    ).rejects.toThrow(TrainingAllocationNotFoundError);

    expect(prisma.trainingAllocation.update).not.toHaveBeenCalled();
  });

  it("B4. cross-tenant update rejected (findFirst scoped by tenantId)", async () => {
    vi.mocked(prisma.trainingAllocation.findFirst).mockResolvedValue(null);

    await expect(
      updateTrainingAllocation(TENANT_B, ALLOCATION_ID, { notes: "x" }),
    ).rejects.toThrow(TrainingAllocationNotFoundError);
  });
});

// ── C. deleteTrainingAllocation ───────────────────────────────────────────────

describe("C. deleteTrainingAllocation", () => {
  it("C1. deletes an existing allocation", async () => {
    await deleteTrainingAllocation(TENANT_A, ALLOCATION_ID);

    expect(prisma.trainingAllocation.delete).toHaveBeenCalledWith({
      where: { id: ALLOCATION_ID },
    });
  });

  it("C2. throws TrainingAllocationNotFoundError when allocation not found", async () => {
    vi.mocked(prisma.trainingAllocation.findFirst).mockResolvedValue(null);

    await expect(deleteTrainingAllocation(TENANT_A, ALLOCATION_ID)).rejects.toThrow(
      TrainingAllocationNotFoundError,
    );

    expect(prisma.trainingAllocation.delete).not.toHaveBeenCalled();
  });

  it("C3. cross-tenant delete rejected", async () => {
    vi.mocked(prisma.trainingAllocation.findFirst).mockResolvedValue(null);

    await expect(
      deleteTrainingAllocation(TENANT_B, ALLOCATION_ID),
    ).rejects.toThrow(TrainingAllocationNotFoundError);
  });
});

// ── D. listAllocationsByTrainingSeries ────────────────────────────────────────

describe("D. listAllocationsByTrainingSeries", () => {
  it("D1. returns empty array when no allocations exist", async () => {
    vi.mocked(prisma.trainingAllocation.findMany).mockResolvedValue([]);

    const result = await listAllocationsByTrainingSeries(TENANT_A, SERIES_ID);

    expect(result).toEqual([]);
    expect(prisma.trainingAllocation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: TENANT_A, trainingSeriesId: SERIES_ID }),
      }),
    );
  });

  it("D2. returns allocations ordered by displayOrder asc then createdAt asc", async () => {
    vi.mocked(prisma.trainingAllocation.findMany).mockResolvedValue([
      makeAllocationRow({ id: "alloc-1", displayOrder: 0 }),
      makeAllocationRow({ id: "alloc-2", displayOrder: 1 }),
      makeAllocationRow({ id: "alloc-3", displayOrder: 2 }),
    ] as never);

    const result = await listAllocationsByTrainingSeries(TENANT_A, SERIES_ID);

    expect(result).toHaveLength(3);
    expect(prisma.trainingAllocation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
      }),
    );
  });

  it("D3. throws TrainingSeriesNotFoundError when series not found", async () => {
    vi.mocked(prisma.trainingSeries.findFirst).mockResolvedValue(null);

    await expect(
      listAllocationsByTrainingSeries(TENANT_A, SERIES_ID),
    ).rejects.toThrow(TrainingSeriesNotFoundError);

    expect(prisma.trainingAllocation.findMany).not.toHaveBeenCalled();
  });

  it("D4. tenant isolation — returns error for cross-tenant series access", async () => {
    vi.mocked(prisma.trainingSeries.findFirst).mockResolvedValue(null);

    await expect(
      listAllocationsByTrainingSeries(TENANT_B, SERIES_ID),
    ).rejects.toThrow(TrainingSeriesNotFoundError);
  });
});

// ── E. listAllocationsByFacilityResource ─────────────────────────────────────

describe("E. listAllocationsByFacilityResource", () => {
  it("E1. returns all allocations for a facility resource", async () => {
    vi.mocked(prisma.trainingAllocation.findMany).mockResolvedValue([
      makeAllocationRow({ trainingSeriesId: SERIES_ID }),
      makeAllocationRow({ id: ALLOCATION_ID_2, trainingSeriesId: SERIES_ID_2 }),
    ] as never);

    const result = await listAllocationsByFacilityResource(TENANT_A, RESOURCE_ID);

    expect(result).toHaveLength(2);
    expect(prisma.trainingAllocation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: TENANT_A, facilityResourceId: RESOURCE_ID }),
      }),
    );
  });

  it("E2. throws TrainingAllocationResourceNotFoundError when resource not found", async () => {
    vi.mocked(prisma.facilityResource.findFirst).mockResolvedValue(null);

    await expect(
      listAllocationsByFacilityResource(TENANT_A, RESOURCE_ID),
    ).rejects.toThrow(TrainingAllocationResourceNotFoundError);

    expect(prisma.trainingAllocation.findMany).not.toHaveBeenCalled();
  });

  it("E3. tenant isolation — cross-tenant resource returns error", async () => {
    vi.mocked(prisma.facilityResource.findFirst).mockResolvedValue(null);

    await expect(
      listAllocationsByFacilityResource(TENANT_B, RESOURCE_ID),
    ).rejects.toThrow(TrainingAllocationResourceNotFoundError);
  });
});

// ── F. getTrainingAllocation ──────────────────────────────────────────────────

describe("F. getTrainingAllocation", () => {
  it("F1. returns the allocation DTO", async () => {
    const result = await getTrainingAllocation(TENANT_A, ALLOCATION_ID);

    expect(result.id).toBe(ALLOCATION_ID);
    expect(result.facilityResourceType).toBe("FULL_PITCH");
    expect(result.createdAt).toMatch(/^\d{4}-/);
  });

  it("F2. throws TrainingAllocationNotFoundError when not found", async () => {
    vi.mocked(prisma.trainingAllocation.findFirst).mockResolvedValue(null);

    await expect(getTrainingAllocation(TENANT_A, ALLOCATION_ID)).rejects.toThrow(
      TrainingAllocationNotFoundError,
    );
  });

  it("F3. cross-tenant access is rejected", async () => {
    vi.mocked(prisma.trainingAllocation.findFirst).mockResolvedValue(null);

    await expect(getTrainingAllocation(TENANT_B, ALLOCATION_ID)).rejects.toThrow(
      TrainingAllocationNotFoundError,
    );
  });
});

// ── G. ordering ───────────────────────────────────────────────────────────────

describe("G. ordering", () => {
  it("G1. list by training series queries with displayOrder asc then createdAt asc", async () => {
    await listAllocationsByTrainingSeries(TENANT_A, SERIES_ID);

    expect(prisma.trainingAllocation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
      }),
    );
  });

  it("G2. list by resource queries with displayOrder asc then createdAt asc", async () => {
    await listAllocationsByFacilityResource(TENANT_A, RESOURCE_ID);

    expect(prisma.trainingAllocation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
      }),
    );
  });
});
