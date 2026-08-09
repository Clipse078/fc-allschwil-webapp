/**
 * lib/tournaments/participant-allocation-service.ts
 *
 * TOURNAMENTCENTER-01B — per-participant Garderobe (dressing-room)
 * allocation domain service. Mirrors
 * lib/training/training-allocation-service.ts's allocation pattern, scoped
 * to a TournamentParticipant instead of a TrainingSeries.
 *
 * Architecture:
 *   TournamentParticipant → TournamentParticipantAllocation → FacilityResource
 *
 * Canonical principles:
 *   - Dressing rooms are assignable PER PARTICIPATING TEAM, independently.
 *   - Different participants may have different dressing rooms.
 *   - Multiple participants MAY share the same dressing room when facility
 *     rules allow it — duplicate guard is scoped to (participant, resource),
 *     never to the resource alone.
 *   - Archived FacilityResources cannot receive new allocations.
 *
 * Security invariants:
 *   - tenantId always comes from a trusted session context — never from input.
 *   - All DB queries are scoped by tenantId.
 */

import { prisma } from "@/lib/db/prisma";
import type {
  CreateTournamentParticipantAllocationInput,
  TournamentParticipantDressingRoomAllocationDto,
} from "./types";
import {
  TournamentParticipantNotFoundError,
  TournamentParticipantAllocationNotFoundError,
  TournamentParticipantAllocationDuplicateError,
  TournamentParticipantAllocationArchivedResourceError,
  TournamentParticipantAllocationArchivedFacilityError,
  TournamentParticipantAllocationResourceNotFoundError,
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
  tournamentParticipantId: string;
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

function toDto(row: AllocationRow): TournamentParticipantDressingRoomAllocationDto {
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

async function requireParticipant(tenantId: string, participantId: string): Promise<void> {
  const participant = await prisma.tournamentParticipant.findFirst({
    where: { id: participantId, tenantId },
    select: { id: true },
  });
  if (!participant) throw new TournamentParticipantNotFoundError(participantId);
}

async function requireAllocation(tenantId: string, allocationId: string): Promise<AllocationRow> {
  const allocation = await prisma.tournamentParticipantAllocation.findFirst({
    where: { id: allocationId, tenantId },
    include: allocationInclude,
  });
  if (!allocation) throw new TournamentParticipantAllocationNotFoundError(allocationId);
  return allocation as unknown as AllocationRow;
}

/**
 * Lists all Garderobe allocations for a participant, ordered by displayOrder.
 *
 * @throws {TournamentParticipantNotFoundError}
 */
export async function listParticipantDressingRoomAllocations(
  tenantId: string,
  participantId: string,
): Promise<TournamentParticipantDressingRoomAllocationDto[]> {
  await requireParticipant(tenantId, participantId);

  const rows = await prisma.tournamentParticipantAllocation.findMany({
    where: { tenantId, tournamentParticipantId: participantId },
    include: allocationInclude,
    orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
  });

  return (rows as unknown as AllocationRow[]).map(toDto);
}

/**
 * Allocates a Garderobe (or other) FacilityResource to a single tournament
 * participant. Multiple participants may share the same resource — no
 * global uniqueness on facilityResourceId.
 *
 * @throws {TournamentParticipantNotFoundError}
 * @throws {TournamentParticipantAllocationResourceNotFoundError}
 * @throws {TournamentParticipantAllocationArchivedResourceError}
 * @throws {TournamentParticipantAllocationArchivedFacilityError}
 * @throws {TournamentParticipantAllocationDuplicateError}
 */
export async function addParticipantDressingRoomAllocation(
  tenantId: string,
  participantId: string,
  input: CreateTournamentParticipantAllocationInput,
): Promise<TournamentParticipantDressingRoomAllocationDto> {
  await requireParticipant(tenantId, participantId);

  const { facilityResourceId, notes, displayOrder } = input;

  const resource = await prisma.facilityResource.findFirst({
    where: { id: facilityResourceId, tenantId },
    select: { id: true, status: true, facility: { select: { id: true, status: true } } },
  });
  if (!resource) {
    throw new TournamentParticipantAllocationResourceNotFoundError(facilityResourceId);
  }

  if (resource.status === "ARCHIVED") {
    throw new TournamentParticipantAllocationArchivedResourceError(facilityResourceId);
  }
  if (resource.facility.status === "ARCHIVED") {
    throw new TournamentParticipantAllocationArchivedFacilityError(resource.facility.id);
  }

  let order = displayOrder;
  if (order === undefined) {
    const maxRow = await prisma.tournamentParticipantAllocation.aggregate({
      where: { tournamentParticipantId: participantId },
      _max: { displayOrder: true },
    });
    order = (maxRow._max.displayOrder ?? -1) + 1;
  }

  try {
    const allocation = await prisma.tournamentParticipantAllocation.create({
      data: {
        tenantId,
        tournamentParticipantId: participantId,
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
      throw new TournamentParticipantAllocationDuplicateError(participantId, facilityResourceId);
    }
    throw err;
  }
}

/**
 * Removes a Garderobe allocation from a participant.
 *
 * @throws {TournamentParticipantAllocationNotFoundError}
 */
export async function removeParticipantDressingRoomAllocation(
  tenantId: string,
  allocationId: string,
): Promise<void> {
  await requireAllocation(tenantId, allocationId);
  await prisma.tournamentParticipantAllocation.delete({ where: { id: allocationId } });
}

/**
 * Retrieves a single allocation by id.
 *
 * @throws {TournamentParticipantAllocationNotFoundError}
 */
export async function getParticipantDressingRoomAllocation(
  tenantId: string,
  allocationId: string,
): Promise<TournamentParticipantDressingRoomAllocationDto> {
  return toDto(await requireAllocation(tenantId, allocationId));
}
