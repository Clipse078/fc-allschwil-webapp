/**
 * lib/training/__tests__/session-allocation-service.test.ts
 *
 * Regression tests for lib/training/session-allocation-service.ts
 * (TRAININGCENTER-02 occurrence-level allocation overrides).
 *
 * Mirrors training-allocation-service.test.ts's coverage, scoped to a
 * single TrainingSession instead of a TrainingSeries.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    trainingSession: {
      findFirst: vi.fn(),
    },
    facilityResource: {
      findFirst: vi.fn(),
    },
    trainingSessionAllocation: {
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
  createTrainingSessionAllocation,
  deleteTrainingSessionAllocation,
  listAllocationsByTrainingSession,
  getTrainingSessionAllocation,
  listSessionAllocationSummaryByTenant,
} from "../session-allocation-service";
import {
  TrainingSessionNotFoundError,
  TrainingSessionAllocationNotFoundError,
  TrainingSessionAllocationDuplicateError,
  TrainingSessionAllocationArchivedResourceError,
  TrainingSessionAllocationArchivedFacilityError,
  TrainingSessionAllocationResourceNotFoundError,
  TrainingSessionAllocationTenantMismatchError,
} from "../errors";

const TENANT_A = "tenant-a";
const TENANT_B = "tenant-b";
const SESSION_ID = "sess-01";
const RESOURCE_ID = "resource-01";
const ALLOCATION_ID = "alloc-01";

function makeAllocationRow(overrides: Record<string, unknown> = {}) {
  return {
    id: ALLOCATION_ID,
    tenantId: TENANT_A,
    trainingSessionId: SESSION_ID,
    facilityResourceId: RESOURCE_ID,
    notes: null,
    displayOrder: 0,
    createdAt: new Date("2026-08-01T00:00:00.000Z"),
    updatedAt: new Date("2026-08-01T00:00:00.000Z"),
    facilityResource: {
      name: "Hauptplatz A",
      code: "A",
      type: "FULL_PITCH",
      facilityId: "facility-1",
      facility: { name: "Sportanlage Bruderholz" },
    },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("A. createTrainingSessionAllocation", () => {
  it("A1: creates an override allocation for a SCHEDULED session", async () => {
    vi.mocked(prisma.trainingSession.findFirst).mockResolvedValue({
      id: SESSION_ID,
      tenantId: TENANT_A,
    } as never);
    vi.mocked(prisma.facilityResource.findFirst).mockResolvedValue({
      id: RESOURCE_ID,
      tenantId: TENANT_A,
      status: "ACTIVE",
      facility: { id: "facility-1", status: "ACTIVE" },
    } as never);
    vi.mocked(prisma.trainingSessionAllocation.aggregate).mockResolvedValue({
      _max: { displayOrder: null },
    } as never);
    vi.mocked(prisma.trainingSessionAllocation.create).mockResolvedValue(makeAllocationRow() as never);

    const result = await createTrainingSessionAllocation(TENANT_A, {
      trainingSessionId: SESSION_ID,
      facilityResourceId: RESOURCE_ID,
    });

    expect(result.trainingSessionId).toBe(SESSION_ID);
    expect(result.facilityResourceId).toBe(RESOURCE_ID);
    expect(prisma.trainingSessionAllocation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tenantId: TENANT_A, trainingSessionId: SESSION_ID, facilityResourceId: RESOURCE_ID }),
      }),
    );
  });

  it("A2: session not found (or cross-tenant)", async () => {
    vi.mocked(prisma.trainingSession.findFirst).mockResolvedValue(null);

    await expect(
      createTrainingSessionAllocation(TENANT_A, { trainingSessionId: SESSION_ID, facilityResourceId: RESOURCE_ID }),
    ).rejects.toThrow(TrainingSessionNotFoundError);
  });

  it("A3: resource not found", async () => {
    vi.mocked(prisma.trainingSession.findFirst).mockResolvedValue({ id: SESSION_ID, tenantId: TENANT_A } as never);
    vi.mocked(prisma.facilityResource.findFirst).mockResolvedValue(null);

    await expect(
      createTrainingSessionAllocation(TENANT_A, { trainingSessionId: SESSION_ID, facilityResourceId: RESOURCE_ID }),
    ).rejects.toThrow(TrainingSessionAllocationResourceNotFoundError);
  });

  it("A4: archived resource rejected — archived resources cannot be newly assigned", async () => {
    vi.mocked(prisma.trainingSession.findFirst).mockResolvedValue({ id: SESSION_ID, tenantId: TENANT_A } as never);
    vi.mocked(prisma.facilityResource.findFirst).mockResolvedValue({
      id: RESOURCE_ID,
      tenantId: TENANT_A,
      status: "ARCHIVED",
      facility: { id: "facility-1", status: "ACTIVE" },
    } as never);

    await expect(
      createTrainingSessionAllocation(TENANT_A, { trainingSessionId: SESSION_ID, facilityResourceId: RESOURCE_ID }),
    ).rejects.toThrow(TrainingSessionAllocationArchivedResourceError);
  });

  it("A5: archived parent facility rejected", async () => {
    vi.mocked(prisma.trainingSession.findFirst).mockResolvedValue({ id: SESSION_ID, tenantId: TENANT_A } as never);
    vi.mocked(prisma.facilityResource.findFirst).mockResolvedValue({
      id: RESOURCE_ID,
      tenantId: TENANT_A,
      status: "ACTIVE",
      facility: { id: "facility-1", status: "ARCHIVED" },
    } as never);

    await expect(
      createTrainingSessionAllocation(TENANT_A, { trainingSessionId: SESSION_ID, facilityResourceId: RESOURCE_ID }),
    ).rejects.toThrow(TrainingSessionAllocationArchivedFacilityError);
  });

  it("A6: duplicate allocation rejected (prevent duplicate allocations)", async () => {
    vi.mocked(prisma.trainingSession.findFirst).mockResolvedValue({ id: SESSION_ID, tenantId: TENANT_A } as never);
    vi.mocked(prisma.facilityResource.findFirst).mockResolvedValue({
      id: RESOURCE_ID,
      tenantId: TENANT_A,
      status: "ACTIVE",
      facility: { id: "facility-1", status: "ACTIVE" },
    } as never);
    vi.mocked(prisma.trainingSessionAllocation.aggregate).mockResolvedValue({
      _max: { displayOrder: 0 },
    } as never);
    vi.mocked(prisma.trainingSessionAllocation.create).mockRejectedValue(
      new Error("Unique constraint failed on the fields: (`trainingSessionId`,`facilityResourceId`)"),
    );

    await expect(
      createTrainingSessionAllocation(TENANT_A, { trainingSessionId: SESSION_ID, facilityResourceId: RESOURCE_ID }),
    ).rejects.toThrow(TrainingSessionAllocationDuplicateError);
  });

  it("A7: tenant isolation — resource belongs to a different tenant is rejected", async () => {
    vi.mocked(prisma.trainingSession.findFirst).mockResolvedValue({ id: SESSION_ID, tenantId: TENANT_A } as never);
    // facilityResource.findFirst is itself tenant-scoped in the query, but
    // guard against a hypothetical mismatch defensively too.
    vi.mocked(prisma.facilityResource.findFirst).mockResolvedValue({
      id: RESOURCE_ID,
      tenantId: TENANT_B,
      status: "ACTIVE",
      facility: { id: "facility-1", status: "ACTIVE" },
    } as never);

    await expect(
      createTrainingSessionAllocation(TENANT_A, { trainingSessionId: SESSION_ID, facilityResourceId: RESOURCE_ID }),
    ).rejects.toThrow(TrainingSessionAllocationTenantMismatchError);
  });
});

describe("B. deleteTrainingSessionAllocation", () => {
  it("B1: deletes an existing override", async () => {
    vi.mocked(prisma.trainingSessionAllocation.findFirst).mockResolvedValue(makeAllocationRow() as never);
    vi.mocked(prisma.trainingSessionAllocation.delete).mockResolvedValue({} as never);

    await deleteTrainingSessionAllocation(TENANT_A, ALLOCATION_ID);

    expect(prisma.trainingSessionAllocation.delete).toHaveBeenCalledWith({ where: { id: ALLOCATION_ID } });
  });

  it("B2: not found (or cross-tenant)", async () => {
    vi.mocked(prisma.trainingSessionAllocation.findFirst).mockResolvedValue(null);

    await expect(deleteTrainingSessionAllocation(TENANT_A, ALLOCATION_ID)).rejects.toThrow(
      TrainingSessionAllocationNotFoundError,
    );
  });

  it("B3: tenant isolation — a cross-tenant allocation id is treated as not found", async () => {
    vi.mocked(prisma.trainingSessionAllocation.findFirst).mockResolvedValue(null);

    await expect(deleteTrainingSessionAllocation(TENANT_B, ALLOCATION_ID)).rejects.toThrow(
      TrainingSessionAllocationNotFoundError,
    );
    expect(prisma.trainingSessionAllocation.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: ALLOCATION_ID, tenantId: TENANT_B } }),
    );
  });
});

describe("C. listAllocationsByTrainingSession / getTrainingSessionAllocation", () => {
  it("C1: returns overrides ordered by displayOrder", async () => {
    vi.mocked(prisma.trainingSession.findFirst).mockResolvedValue({ id: SESSION_ID } as never);
    vi.mocked(prisma.trainingSessionAllocation.findMany).mockResolvedValue([makeAllocationRow()] as never);

    const result = await listAllocationsByTrainingSession(TENANT_A, SESSION_ID);
    expect(result).toHaveLength(1);
    expect(result[0].facilityResourceId).toBe(RESOURCE_ID);
  });

  it("C2: session not found", async () => {
    vi.mocked(prisma.trainingSession.findFirst).mockResolvedValue(null);

    await expect(listAllocationsByTrainingSession(TENANT_A, SESSION_ID)).rejects.toThrow(
      TrainingSessionNotFoundError,
    );
  });

  it("C3: getTrainingSessionAllocation returns by id", async () => {
    vi.mocked(prisma.trainingSessionAllocation.findFirst).mockResolvedValue(makeAllocationRow() as never);

    const result = await getTrainingSessionAllocation(TENANT_A, ALLOCATION_ID);
    expect(result.id).toBe(ALLOCATION_ID);
  });
});

describe("D. listSessionAllocationSummaryByTenant", () => {
  it("D1: aggregates pitch/dressing-room coverage per session, only for sessions with overrides", async () => {
    vi.mocked(prisma.trainingSessionAllocation.findMany).mockResolvedValue([
      { trainingSessionId: "s1", facilityResource: { type: "FULL_PITCH" } },
      { trainingSessionId: "s1", facilityResource: { type: "DRESSING_ROOM" } },
      { trainingSessionId: "s2", facilityResource: { type: "HALF_PITCH" } },
    ] as never);

    const summary = await listSessionAllocationSummaryByTenant(TENANT_A);

    expect(summary.get("s1")).toEqual({ hasPitchAllocation: true, hasDressingRoomAllocation: true });
    expect(summary.get("s2")).toEqual({ hasPitchAllocation: true, hasDressingRoomAllocation: false });
    expect(summary.has("s3")).toBe(false);
  });

  it("D2: returns an empty map when no session has any override", async () => {
    vi.mocked(prisma.trainingSessionAllocation.findMany).mockResolvedValue([] as never);

    const summary = await listSessionAllocationSummaryByTenant(TENANT_A);
    expect(summary.size).toBe(0);
  });
});
