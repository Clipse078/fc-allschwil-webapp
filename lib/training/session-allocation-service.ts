/**
 * lib/training/session-allocation-service.ts
 *
 * TRAININGCENTER-02 — occurrence-level resource allocation overrides
 * (TrainingSessionAllocation). Mirrors training-allocation-service.ts
 * exactly, but scoped to a single canonical TrainingSession occurrence
 * instead of the recurring TrainingSeries.
 *
 * Architecture:
 *   TrainingSession → TrainingSessionAllocation → FacilityResource
 *
 * Canonical principle — "override by presence, per allocation group":
 *   - A TrainingSession has NO override rows by default — every occurrence
 *     simply inherits its TrainingSeries' allocations (see
 *     lib/training/operational-state.ts and view-model.ts, which resolve
 *     the effective allocation summary as override ?? series-level, per
 *     allocation group: Spielfeld/Halle and Garderobe are independent).
 *   - The moment ANY override row exists for a given allocation group on
 *     this occurrence, that group's series-level default is superseded for
 *     THIS occurrence only — other groups (and every other occurrence of
 *     the same series) are completely unaffected.
 *   - Removing every override row for a group reverts that group back to
 *     the TrainingSeries default — there is no separate "reset" mutation
 *     needed; deleting is the reset.
 *
 * Security invariants:
 *   - tenantId always comes from a trusted session context — never from input.
 *   - All DB queries are scoped by tenantId.
 *   - Tenant A cannot read or modify Tenant B's session allocation overrides.
 */

import { prisma } from "@/lib/db/prisma";
import type { TrainingSessionAllocationDto, CreateTrainingSessionAllocationInput } from "./types";
import type { TrainingAllocationSummary } from "./operational-state";
import {
  TrainingSessionAllocationNotFoundError,
  TrainingSessionAllocationDuplicateError,
  TrainingSessionAllocationArchivedResourceError,
  TrainingSessionAllocationArchivedFacilityError,
  TrainingSessionAllocationResourceNotFoundError,
  TrainingSessionAllocationTenantMismatchError,
  TrainingSessionNotFoundError,
} from "./errors";

// ── Row type for Prisma include ───────────────────────────────────────────────

type SessionAllocationRow = {
  id: string;
  tenantId: string;
  trainingSessionId: string;
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

const sessionAllocationInclude = {
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

function allocationToDto(row: SessionAllocationRow): TrainingSessionAllocationDto {
  return {
    id: row.id,
    tenantId: row.tenantId,
    trainingSessionId: row.trainingSessionId,
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

async function requireSessionAllocation(
  tenantId: string,
  allocationId: string,
): Promise<SessionAllocationRow> {
  const allocation = await prisma.trainingSessionAllocation.findFirst({
    where: { id: allocationId, tenantId },
    include: sessionAllocationInclude,
  });
  if (!allocation) throw new TrainingSessionAllocationNotFoundError(allocationId);
  return allocation as unknown as SessionAllocationRow;
}

async function requireSession(tenantId: string, trainingSessionId: string): Promise<void> {
  const session = await prisma.trainingSession.findFirst({
    where: { id: trainingSessionId, tenantId },
    select: { id: true },
  });
  if (!session) throw new TrainingSessionNotFoundError(trainingSessionId);
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Creates a new occurrence-level allocation override.
 *
 * Validates:
 *   - TrainingSession must belong to the tenant.
 *   - FacilityResource must belong to the tenant.
 *   - FacilityResource must not be archived (nor its parent Facility).
 *   - No duplicate override for the same (session, resource) pair.
 */
export async function createTrainingSessionAllocation(
  tenantId: string,
  input: CreateTrainingSessionAllocationInput,
): Promise<TrainingSessionAllocationDto> {
  const { trainingSessionId, facilityResourceId, notes, displayOrder } = input;

  const session = await prisma.trainingSession.findFirst({
    where: { id: trainingSessionId, tenantId },
    select: { id: true, tenantId: true },
  });
  if (!session) throw new TrainingSessionNotFoundError(trainingSessionId);

  const resource = await prisma.facilityResource.findFirst({
    where: { id: facilityResourceId, tenantId },
    select: {
      id: true,
      tenantId: true,
      status: true,
      facility: { select: { id: true, status: true } },
    },
  });
  if (!resource) throw new TrainingSessionAllocationResourceNotFoundError(facilityResourceId);

  // Cross-tenant guard (belt-and-suspenders; tenantId scoping above makes this implicit)
  if (session.tenantId !== resource.tenantId) {
    throw new TrainingSessionAllocationTenantMismatchError();
  }

  if (resource.status === "ARCHIVED") {
    throw new TrainingSessionAllocationArchivedResourceError(facilityResourceId);
  }

  if (resource.facility.status === "ARCHIVED") {
    throw new TrainingSessionAllocationArchivedFacilityError(resource.facility.id);
  }

  let order = displayOrder;
  if (order === undefined) {
    const maxRow = await prisma.trainingSessionAllocation.aggregate({
      where: { trainingSessionId },
      _max: { displayOrder: true },
    });
    order = (maxRow._max.displayOrder ?? -1) + 1;
  }

  try {
    const allocation = await prisma.trainingSessionAllocation.create({
      data: {
        tenantId,
        trainingSessionId,
        facilityResourceId,
        notes: notes ?? null,
        displayOrder: order,
      },
      include: sessionAllocationInclude,
    });

    return allocationToDto(allocation as unknown as SessionAllocationRow);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("Unique constraint")) {
      throw new TrainingSessionAllocationDuplicateError(trainingSessionId, facilityResourceId);
    }
    throw err;
  }
}

/**
 * Deletes an occurrence-level allocation override. When this removes the
 * last override row for an allocation group, that group reverts to the
 * TrainingSeries default for this occurrence — no separate reset needed.
 */
export async function deleteTrainingSessionAllocation(
  tenantId: string,
  allocationId: string,
): Promise<void> {
  await requireSessionAllocation(tenantId, allocationId);
  await prisma.trainingSessionAllocation.delete({ where: { id: allocationId } });
}

/**
 * Lists all occurrence-level allocation overrides for a given
 * TrainingSession, ordered by displayOrder. Empty when the occurrence has
 * no overrides (i.e. it fully inherits its series' allocations).
 */
export async function listAllocationsByTrainingSession(
  tenantId: string,
  trainingSessionId: string,
): Promise<TrainingSessionAllocationDto[]> {
  await requireSession(tenantId, trainingSessionId);

  const allocations = await prisma.trainingSessionAllocation.findMany({
    where: { tenantId, trainingSessionId },
    include: sessionAllocationInclude,
    orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
  });

  return allocations.map((a) => allocationToDto(a as unknown as SessionAllocationRow));
}

/** Retrieves a single occurrence-level allocation override by id. */
export async function getTrainingSessionAllocation(
  tenantId: string,
  allocationId: string,
): Promise<TrainingSessionAllocationDto> {
  return allocationToDto(await requireSessionAllocation(tenantId, allocationId));
}

/**
 * TRAININGCENTER-02: builds a tenant-wide lookup of each TrainingSession's
 * OVERRIDE allocation coverage — whether it has at least one occurrence-level
 * pitch/resource override and at least one occurrence-level dressing-room
 * override. Used by buildTrainingCenterViewModel() (view-model.ts) to
 * resolve the effective per-session allocation summary as
 * (session override) OR (series-level default), independently per
 * allocation group.
 *
 * Sessions with zero override rows are simply absent from the returned
 * map — callers treat a missing entry as "no override; fall back to the
 * series-level summary entirely" (both fields default to false, which is a
 * no-op under OR).
 */
export async function listSessionAllocationSummaryByTenant(
  tenantId: string,
): Promise<Map<string, TrainingAllocationSummary>> {
  const rows = await prisma.trainingSessionAllocation.findMany({
    where: { tenantId },
    select: {
      trainingSessionId: true,
      facilityResource: { select: { type: true } },
    },
  });

  const summary = new Map<string, TrainingAllocationSummary>();
  for (const row of rows) {
    const entry = summary.get(row.trainingSessionId) ?? {
      hasPitchAllocation: false,
      hasDressingRoomAllocation: false,
    };
    if (row.facilityResource.type === "FULL_PITCH" || row.facilityResource.type === "HALF_PITCH") {
      entry.hasPitchAllocation = true;
    }
    if (row.facilityResource.type === "DRESSING_ROOM") {
      entry.hasDressingRoomAllocation = true;
    }
    summary.set(row.trainingSessionId, entry);
  }
  return summary;
}
