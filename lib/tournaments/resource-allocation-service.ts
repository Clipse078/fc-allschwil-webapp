/**
 * lib/tournaments/resource-allocation-service.ts
 *
 * TOURNAMENTCENTER-01B — tournament-level Spielfeld/Halle allocation domain
 * service. Mirrors lib/training/training-allocation-service.ts verbatim,
 * scoped to a Tournament (Event, type=TOURNAMENT) instead of a
 * TrainingSeries — same canonical FacilityResource, same archived-resource
 * and duplicate-allocation guards, same allocation pattern.
 *
 * Architecture:
 *   Event (TOURNAMENT) → TournamentResourceAllocation → FacilityResource
 *
 * Canonical principles:
 *   - A tournament may hold many allocations (one per FacilityResource) —
 *     PRODUCT REQUIREMENT: "A home tournament may use MORE THAN ONE
 *     pitch/hall resource."
 *   - Archived FacilityResources cannot receive new allocations.
 *   - Duplicate allocation of the same resource to the same tournament is rejected.
 *
 * Security invariants:
 *   - tenantId always comes from a trusted session context — never from input.
 *   - All DB queries are scoped by tenantId.
 */

import { prisma } from "@/lib/db/prisma";
import type {
  CreateTournamentResourceAllocationInput,
  TournamentResourceAllocationDto,
} from "./types";
import {
  TournamentNotFoundError,
  TournamentResourceAllocationNotFoundError,
  TournamentResourceAllocationDuplicateError,
  TournamentResourceAllocationArchivedResourceError,
  TournamentResourceAllocationArchivedFacilityError,
  TournamentResourceAllocationResourceNotFoundError,
} from "./errors";

const allocationInclude = {
  facilityResource: {
    select: {
      id: true,
      code: true,
      name: true,
      type: true,
      facilityId: true,
      facility: { select: { name: true } },
    },
  },
} as const;

type AllocationRow = {
  id: string;
  eventId: string;
  notes: string | null;
  displayOrder: number;
  facilityResource: {
    id: string;
    code: string;
    name: string;
    type: string;
    facilityId: string;
    facility: { name: string };
  };
};

function toDto(row: AllocationRow): TournamentResourceAllocationDto {
  return {
    id: row.id,
    facilityResourceId: row.facilityResource.id,
    facilityResourceCode: row.facilityResource.code,
    facilityResourceName: row.facilityResource.name,
    facilityResourceType: row.facilityResource.type,
    facilityId: row.facilityResource.facilityId,
    facilityName: row.facilityResource.facility.name,
    notes: row.notes,
    displayOrder: row.displayOrder,
  };
}

async function requireTournament(tenantId: string, tournamentId: string): Promise<void> {
  const event = await prisma.event.findFirst({
    where: { id: tournamentId, tenantId, type: "TOURNAMENT" },
    select: { id: true },
  });
  if (!event) throw new TournamentNotFoundError(tournamentId);
}

async function requireAllocation(tenantId: string, allocationId: string): Promise<AllocationRow> {
  const allocation = await prisma.tournamentResourceAllocation.findFirst({
    where: { id: allocationId, tenantId },
    include: allocationInclude,
  });
  if (!allocation) throw new TournamentResourceAllocationNotFoundError(allocationId);
  return allocation as unknown as AllocationRow;
}

/**
 * Lists all Spielfeld/Halle allocations for a tournament, ordered by displayOrder.
 *
 * @throws {TournamentNotFoundError}
 */
export async function listTournamentResourceAllocations(
  tenantId: string,
  tournamentId: string,
): Promise<TournamentResourceAllocationDto[]> {
  await requireTournament(tenantId, tournamentId);

  const rows = await prisma.tournamentResourceAllocation.findMany({
    where: { tenantId, eventId: tournamentId },
    include: allocationInclude,
    orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
  });

  return (rows as unknown as AllocationRow[]).map(toDto);
}

/**
 * Allocates a Spielfeld/Halle (or other) FacilityResource to a tournament.
 *
 * @throws {TournamentNotFoundError}
 * @throws {TournamentResourceAllocationResourceNotFoundError}
 * @throws {TournamentResourceAllocationArchivedResourceError}
 * @throws {TournamentResourceAllocationArchivedFacilityError}
 * @throws {TournamentResourceAllocationDuplicateError}
 */
export async function addTournamentResourceAllocation(
  tenantId: string,
  tournamentId: string,
  input: CreateTournamentResourceAllocationInput,
): Promise<TournamentResourceAllocationDto> {
  await requireTournament(tenantId, tournamentId);

  const { facilityResourceId, notes, displayOrder } = input;

  const resource = await prisma.facilityResource.findFirst({
    where: { id: facilityResourceId, tenantId },
    select: { id: true, status: true, facility: { select: { id: true, status: true } } },
  });
  if (!resource) throw new TournamentResourceAllocationResourceNotFoundError(facilityResourceId);

  if (resource.status === "ARCHIVED") {
    throw new TournamentResourceAllocationArchivedResourceError(facilityResourceId);
  }
  if (resource.facility.status === "ARCHIVED") {
    throw new TournamentResourceAllocationArchivedFacilityError(resource.facility.id);
  }

  let order = displayOrder;
  if (order === undefined) {
    const maxRow = await prisma.tournamentResourceAllocation.aggregate({
      where: { eventId: tournamentId },
      _max: { displayOrder: true },
    });
    order = (maxRow._max.displayOrder ?? -1) + 1;
  }

  try {
    const allocation = await prisma.tournamentResourceAllocation.create({
      data: {
        tenantId,
        eventId: tournamentId,
        facilityResourceId,
        notes: notes ?? null,
        displayOrder: order,
      },
      include: allocationInclude,
    });

    return toDto(allocation as unknown as AllocationRow);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("Unique constraint")) {
      throw new TournamentResourceAllocationDuplicateError(tournamentId, facilityResourceId);
    }
    throw err;
  }
}

/**
 * Removes a Spielfeld/Halle allocation from a tournament.
 *
 * @throws {TournamentResourceAllocationNotFoundError}
 */
export async function removeTournamentResourceAllocation(
  tenantId: string,
  allocationId: string,
): Promise<void> {
  await requireAllocation(tenantId, allocationId);
  await prisma.tournamentResourceAllocation.delete({ where: { id: allocationId } });
}

/**
 * Retrieves a single allocation by id.
 *
 * @throws {TournamentResourceAllocationNotFoundError}
 */
export async function getTournamentResourceAllocation(
  tenantId: string,
  allocationId: string,
): Promise<TournamentResourceAllocationDto> {
  return toDto(await requireAllocation(tenantId, allocationId));
}
