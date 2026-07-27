/**
 * lib/training/training-allocation-service.ts
 *
 * Domain service for canonical Training Resource Allocations (TRAINING-ALLOCATIONS-01).
 *
 * Manages which FacilityResources are allocated to a canonical TrainingSeries.
 *
 * Architecture:
 *   TrainingSeries → TrainingAllocation → FacilityResource
 *
 * Canonical principles:
 *   - One TrainingSeries may hold many allocations (one per FacilityResource).
 *   - Everything works through the canonical FacilityResource — no type-specific logic.
 *   - Archived FacilityResources cannot receive new allocations.
 *   - Duplicate allocation of the same resource to the same series is rejected.
 *   - No weekplanner, infoboard, or website publication at this layer.
 *
 * Security invariants:
 *   - tenantId always comes from a trusted session context — never from input.
 *   - All DB queries are scoped by tenantId.
 *   - Tenant A cannot read or modify Tenant B's allocations.
 */

import { prisma } from "@/lib/db/prisma";
import type {
  TrainingAllocationDto,
  CreateTrainingAllocationInput,
  UpdateTrainingAllocationInput,
  ListTrainingAllocationsFilter,
} from "./types";
import {
  TrainingAllocationNotFoundError,
  TrainingAllocationDuplicateError,
  TrainingAllocationArchivedResourceError,
  TrainingAllocationResourceNotFoundError,
  TrainingAllocationTenantMismatchError,
  TrainingSeriesNotFoundError,
} from "./errors";

// ── Row type for Prisma include ───────────────────────────────────────────────

type AllocationRow = {
  id: string;
  tenantId: string;
  trainingSeriesId: string;
  facilityResourceId: string;
  notes: string | null;
  displayOrder: number;
  createdAt: Date;
  updatedAt: Date;
  facilityResource: {
    name: string;
    code: string;
    type: string;
    facilityId: string;
    facility: { name: string };
  };
};

const allocationInclude = {
  facilityResource: {
    select: {
      name: true,
      code: true,
      type: true,
      facilityId: true,
      facility: { select: { name: true } },
    },
  },
} as const;

// ── DTO mapper ────────────────────────────────────────────────────────────────

function allocationToDto(row: AllocationRow): TrainingAllocationDto {
  return {
    id: row.id,
    tenantId: row.tenantId,
    trainingSeriesId: row.trainingSeriesId,
    facilityResourceId: row.facilityResourceId,
    facilityResourceName: row.facilityResource.name,
    facilityResourceCode: row.facilityResource.code,
    facilityResourceType: row.facilityResource.type,
    facilityId: row.facilityResource.facilityId,
    facilityName: row.facilityResource.facility.name,
    notes: row.notes,
    displayOrder: row.displayOrder,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// ── Private helpers ───────────────────────────────────────────────────────────

async function requireAllocation(
  tenantId: string,
  allocationId: string,
): Promise<AllocationRow> {
  const allocation = await prisma.trainingAllocation.findFirst({
    where: { id: allocationId, tenantId },
    include: allocationInclude,
  });
  if (!allocation) throw new TrainingAllocationNotFoundError(allocationId);
  return allocation as unknown as AllocationRow;
}

async function requireSeries(tenantId: string, seriesId: string): Promise<void> {
  const series = await prisma.trainingSeries.findFirst({
    where: { id: seriesId, tenantId },
    select: { id: true },
  });
  if (!series) throw new TrainingSeriesNotFoundError(seriesId);
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Creates a new training resource allocation.
 *
 * Validates:
 *   - TrainingSeries must belong to the tenant.
 *   - FacilityResource must belong to the tenant.
 *   - FacilityResource must not be archived.
 *   - No duplicate allocation for the same (series, resource) pair.
 */
export async function createTrainingAllocation(
  tenantId: string,
  input: CreateTrainingAllocationInput,
): Promise<TrainingAllocationDto> {
  const { trainingSeriesId, facilityResourceId, notes, displayOrder } = input;

  // Verify series exists for this tenant
  const series = await prisma.trainingSeries.findFirst({
    where: { id: trainingSeriesId, tenantId },
    select: { id: true, tenantId: true },
  });
  if (!series) throw new TrainingSeriesNotFoundError(trainingSeriesId);

  // Verify resource exists and get its status
  const resource = await prisma.facilityResource.findFirst({
    where: { id: facilityResourceId, tenantId },
    select: { id: true, tenantId: true, status: true },
  });
  if (!resource) throw new TrainingAllocationResourceNotFoundError(facilityResourceId);

  // Cross-tenant guard (belt-and-suspenders; tenantId scoping above makes this implicit)
  if (series.tenantId !== resource.tenantId) {
    throw new TrainingAllocationTenantMismatchError();
  }

  // Archived resources cannot receive new allocations
  if (resource.status === "ARCHIVED") {
    throw new TrainingAllocationArchivedResourceError(facilityResourceId);
  }

  // Determine next displayOrder when not supplied
  let order = displayOrder;
  if (order === undefined) {
    const maxRow = await prisma.trainingAllocation.aggregate({
      where: { trainingSeriesId },
      _max: { displayOrder: true },
    });
    order = (maxRow._max.displayOrder ?? -1) + 1;
  }

  try {
    const allocation = await prisma.trainingAllocation.create({
      data: {
        tenantId,
        trainingSeriesId,
        facilityResourceId,
        notes: notes ?? null,
        displayOrder: order,
      },
      include: allocationInclude,
    });

    return allocationToDto(allocation as unknown as AllocationRow);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("Unique constraint")) {
      throw new TrainingAllocationDuplicateError(trainingSeriesId, facilityResourceId);
    }
    throw err;
  }
}

/**
 * Updates mutable fields (notes, displayOrder) of an existing allocation.
 */
export async function updateTrainingAllocation(
  tenantId: string,
  allocationId: string,
  input: UpdateTrainingAllocationInput,
): Promise<TrainingAllocationDto> {
  await requireAllocation(tenantId, allocationId);

  const data: { notes?: string | null; displayOrder?: number } = {};
  if (input.notes !== undefined) data.notes = input.notes;
  if (input.displayOrder !== undefined) data.displayOrder = input.displayOrder;

  const allocation = await prisma.trainingAllocation.update({
    where: { id: allocationId },
    data,
    include: allocationInclude,
  });

  return allocationToDto(allocation as unknown as AllocationRow);
}

/**
 * Deletes an allocation.
 */
export async function deleteTrainingAllocation(
  tenantId: string,
  allocationId: string,
): Promise<void> {
  await requireAllocation(tenantId, allocationId);
  await prisma.trainingAllocation.delete({ where: { id: allocationId } });
}

/**
 * Lists all allocations for a given training series, ordered by displayOrder.
 */
export async function listAllocationsByTrainingSeries(
  tenantId: string,
  trainingSeriesId: string,
): Promise<TrainingAllocationDto[]> {
  await requireSeries(tenantId, trainingSeriesId);

  const allocations = await prisma.trainingAllocation.findMany({
    where: { tenantId, trainingSeriesId },
    include: allocationInclude,
    orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
  });

  return allocations.map((a) => allocationToDto(a as unknown as AllocationRow));
}

/**
 * Lists all allocations for a given facility resource, ordered by displayOrder.
 */
export async function listAllocationsByFacilityResource(
  tenantId: string,
  facilityResourceId: string,
): Promise<TrainingAllocationDto[]> {
  // Verify resource belongs to this tenant
  const resource = await prisma.facilityResource.findFirst({
    where: { id: facilityResourceId, tenantId },
    select: { id: true },
  });
  if (!resource) throw new TrainingAllocationResourceNotFoundError(facilityResourceId);

  const allocations = await prisma.trainingAllocation.findMany({
    where: { tenantId, facilityResourceId },
    include: allocationInclude,
    orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
  });

  return allocations.map((a) => allocationToDto(a as unknown as AllocationRow));
}

/**
 * Retrieves a single allocation by id.
 */
export async function getTrainingAllocation(
  tenantId: string,
  allocationId: string,
): Promise<TrainingAllocationDto> {
  return allocationToDto(await requireAllocation(tenantId, allocationId));
}

/**
 * Generic list with optional filters.
 */
export async function listTrainingAllocations(
  tenantId: string,
  filter: ListTrainingAllocationsFilter = {},
): Promise<TrainingAllocationDto[]> {
  const { trainingSeriesId, facilityResourceId } = filter;

  const allocations = await prisma.trainingAllocation.findMany({
    where: {
      tenantId,
      ...(trainingSeriesId ? { trainingSeriesId } : {}),
      ...(facilityResourceId ? { facilityResourceId } : {}),
    },
    include: allocationInclude,
    orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
  });

  return allocations.map((a) => allocationToDto(a as unknown as AllocationRow));
}
