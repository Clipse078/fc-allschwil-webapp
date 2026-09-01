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
import { PUBLIC_CACHE_DOMAINS } from "@/lib/website/public-cache-tags";
import { scheduleTenantPublicWebsiteCacheNotificationByTenantId } from "@/lib/website/public-cache-notification";
import type {
  TrainingAllocationDto,
  CreateTrainingAllocationInput,
  UpdateTrainingAllocationInput,
  ListTrainingAllocationsFilter,
} from "./types";
import type { TrainingAllocationSummary } from "./operational-state";
import {
  TrainingAllocationNotFoundError,
  TrainingAllocationDuplicateError,
  TrainingAllocationArchivedResourceError,
  TrainingAllocationArchivedFacilityError,
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

  // Verify resource exists, including parent facility for archive checks
  const resource = await prisma.facilityResource.findFirst({
    where: { id: facilityResourceId, tenantId },
    select: {
      id: true,
      tenantId: true,
      status: true,
      facility: { select: { id: true, status: true } },
    },
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

  // Archived parent facility — resources in archived facilities cannot receive new allocations
  if (resource.facility.status === "ARCHIVED") {
    throw new TrainingAllocationArchivedFacilityError(resource.facility.id);
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

    void scheduleTenantPublicWebsiteCacheNotificationByTenantId(tenantId, [
      PUBLIC_CACHE_DOMAINS.WEEKPLAN,
    ]);

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

  void scheduleTenantPublicWebsiteCacheNotificationByTenantId(tenantId, [
    PUBLIC_CACHE_DOMAINS.WEEKPLAN,
  ]);

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
  void scheduleTenantPublicWebsiteCacheNotificationByTenantId(tenantId, [
    PUBLIC_CACHE_DOMAINS.WEEKPLAN,
  ]);
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
 * TRAININGCENTER-01: builds a tenant-wide lookup of each TrainingSeries'
 * allocation coverage — whether it has at least one pitch/resource
 * allocation (FULL_PITCH/HALF_PITCH) and at least one dressing-room
 * allocation (DRESSING_ROOM). Used by the Month/Week/Day operational views
 * (lib/training/operational-state.ts) to assess open actions without an
 * N+1 query per session — allocation is series-level, so one row per
 * TrainingSeries with any allocations covers every one of its occurrences.
 *
 * Series with zero allocations at all are simply absent from the returned
 * map; callers treat a missing entry as "nothing allocated" (see
 * assessTrainingOperationalState()'s `allocationSummary ?? { ... false }`
 * fallback).
 */
export async function listAllocationSummaryByTenant(
  tenantId: string,
): Promise<Map<string, TrainingAllocationSummary>> {
  const rows = await prisma.trainingAllocation.findMany({
    where: { tenantId },
    select: {
      trainingSeriesId: true,
      facilityResource: { select: { type: true } },
    },
  });

  const summary = new Map<string, TrainingAllocationSummary>();
  for (const row of rows) {
    const entry = summary.get(row.trainingSeriesId) ?? {
      hasPitchAllocation: false,
      hasDressingRoomAllocation: false,
    };
    if (row.facilityResource.type === "FULL_PITCH" || row.facilityResource.type === "HALF_PITCH") {
      entry.hasPitchAllocation = true;
    }
    if (row.facilityResource.type === "DRESSING_ROOM") {
      entry.hasDressingRoomAllocation = true;
    }
    summary.set(row.trainingSeriesId, entry);
  }
  return summary;
}

/**
 * TRAINING-SERIES-PREMIUM-01: tenant-wide allocation lookup keyed by
 * TrainingSeries id — used by the weekday cockpit to show pitch and
 * dressing room without N+1 queries per series.
 */
export async function listAllocationsGroupedBySeries(
  tenantId: string,
): Promise<Map<string, TrainingAllocationDto[]>> {
  const allocations = await listTrainingAllocations(tenantId);
  const grouped = new Map<string, TrainingAllocationDto[]>();

  for (const allocation of allocations) {
    const bucket = grouped.get(allocation.trainingSeriesId) ?? [];
    bucket.push(allocation);
    grouped.set(allocation.trainingSeriesId, bucket);
  }

  return grouped;
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
