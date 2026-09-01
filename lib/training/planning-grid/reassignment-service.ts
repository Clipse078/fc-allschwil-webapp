/**
 * lib/training/planning-grid/reassignment-service.ts
 *
 * Canonical resource reassignment for the planning grid — occurrence override
 * or series-level allocation change with explicit scope.
 */

import { prisma } from "@/lib/db/prisma";
import { getResourceAvailability, type AvailabilityResourceGroup } from "@/lib/facilities/availability-service";
import { timeRangesOverlap } from "@/lib/facilities/allocation-rules";
import { classifyFacilityResourceType, type TrainingAllocationGroupKey } from "@/lib/training/allocation-groups";
import {
  createTrainingSessionAllocation,
  deleteTrainingSessionAllocation,
  listAllocationsByTrainingSession,
} from "@/lib/training/session-allocation-service";
import {
  createTrainingAllocation,
  deleteTrainingAllocation,
  listAllocationsByTrainingSeries,
} from "@/lib/training/training-allocation-service";
import type { ResourceReassignmentScope } from "./types";
import { TrainingSessionNotFoundError } from "@/lib/training/errors";

export type ReassignResourceInput = {
  tenantId: string;
  sessionId: string;
  targetResourceId: string;
  category: TrainingAllocationGroupKey;
  scope: ResourceReassignmentScope;
};

function toAvailabilityGroup(category: TrainingAllocationGroupKey): AvailabilityResourceGroup | null {
  if (category === "PITCH_HALL" || category === "DRESSING_ROOM") return category;
  return null;
}

async function assertTargetResourceAvailable(input: {
  tenantId: string;
  sessionId: string;
  targetResourceId: string;
  category: TrainingAllocationGroupKey;
  startAt: Date;
  endAt: Date;
}): Promise<void> {
  const availabilityGroup = toAvailabilityGroup(input.category);

  if (availabilityGroup) {
    const availability = await getResourceAvailability({
      tenantId: input.tenantId,
      startAt: input.startAt,
      endAt: input.endAt,
      group: availabilityGroup,
      excludeTrainingSessionId: input.sessionId,
    });

    const target = availability.find((row) => row.resourceId === input.targetResourceId);
    if (!target || target.status === "OCCUPIED") {
      const detail = target?.conflictLabel ?? "Ressource ist belegt";
      throw new Error(`Konflikt — ${detail}`);
    }
    return;
  }

  // OTHER resources: canonical availability-service does not model match/tournament
  // bookings for non pitch/hall/dressing-room types — training-only overlap guard.
  const overlappingSessions = await prisma.trainingSession.findMany({
    where: {
      tenantId: input.tenantId,
      status: "SCHEDULED",
      id: { not: input.sessionId },
      OR: [
        { overrideStartAt: null, startAt: { lt: input.endAt }, endAt: { gt: input.startAt } },
        {
          AND: [{ overrideStartAt: { not: null, lt: input.endAt } }, { overrideEndAt: { gt: input.startAt } }],
        },
      ],
    },
    select: {
      id: true,
      startAt: true,
      endAt: true,
      overrideStartAt: true,
      overrideEndAt: true,
      trainingSeries: {
        select: {
          title: true,
          allocations: {
            select: { facilityResourceId: true, facilityResource: { select: { type: true } } },
          },
        },
      },
      sessionAllocations: {
        select: { facilityResourceId: true, facilityResource: { select: { type: true } } },
      },
    },
  });

  for (const session of overlappingSessions) {
    const effectiveStart = session.overrideStartAt ?? session.startAt;
    const effectiveEnd = session.overrideEndAt ?? session.endAt;
    if (
      !timeRangesOverlap({
        startA: input.startAt,
        endA: input.endAt,
        startB: effectiveStart,
        endB: effectiveEnd,
      })
    ) {
      continue;
    }

    const overridesForGroup = session.sessionAllocations.filter(
      (row) => classifyFacilityResourceType(row.facilityResource.type) === input.category,
    );
    const effectiveAllocations =
      overridesForGroup.length > 0
        ? overridesForGroup
        : session.trainingSeries.allocations.filter(
            (row) => classifyFacilityResourceType(row.facilityResource.type) === input.category,
          );

    const conflict = effectiveAllocations.some((row) => row.facilityResourceId === input.targetResourceId);
    if (conflict) {
      throw new Error(`Konflikt — ${session.trainingSeries.title}`);
    }
  }
}

export async function reassignPlanningGridResource(input: ReassignResourceInput): Promise<void> {
  const session = await prisma.trainingSession.findFirst({
    where: { id: input.sessionId, tenantId: input.tenantId },
    select: {
      id: true,
      trainingSeriesId: true,
      date: true,
      status: true,
      startAt: true,
      endAt: true,
      overrideStartAt: true,
      overrideEndAt: true,
    },
  });
  if (!session) throw new TrainingSessionNotFoundError(input.sessionId);
  if (session.status !== "SCHEDULED") {
    throw new Error("Nur geplante Trainings können im Planungsraster verschoben werden.");
  }

  const resource = await prisma.facilityResource.findFirst({
    where: { id: input.targetResourceId, tenantId: input.tenantId, status: { not: "ARCHIVED" } },
    select: { id: true, type: true, facility: { select: { status: true } } },
  });
  if (!resource || resource.facility.status === "ARCHIVED") {
    throw new Error("Zielressource ist nicht verfügbar.");
  }
  if (classifyFacilityResourceType(resource.type) !== input.category) {
    throw new Error("Zielressource passt nicht zur gewählten Ressourcenkategorie.");
  }

  const effectiveStart = session.overrideStartAt ?? session.startAt;
  const effectiveEnd = session.overrideEndAt ?? session.endAt;

  await assertTargetResourceAvailable({
    tenantId: input.tenantId,
    sessionId: input.sessionId,
    targetResourceId: input.targetResourceId,
    category: input.category,
    startAt: effectiveStart,
    endAt: effectiveEnd,
  });

  if (input.scope === "occurrence") {
    await reassignOccurrenceResource(input.tenantId, input.sessionId, input.targetResourceId, input.category);
    return;
  }

  await reassignSeriesResource(
    input.tenantId,
    session.trainingSeriesId,
    input.targetResourceId,
    input.category,
  );
}

async function reassignOccurrenceResource(
  tenantId: string,
  sessionId: string,
  targetResourceId: string,
  category: TrainingAllocationGroupKey,
): Promise<void> {
  const existingOverrides = await listAllocationsByTrainingSession(tenantId, sessionId);
  const groupOverrides = existingOverrides.filter(
    (row) => classifyFacilityResourceType(row.facilityResourceType) === category,
  );

  for (const override of groupOverrides) {
    await deleteTrainingSessionAllocation(tenantId, override.id);
  }

  await createTrainingSessionAllocation(tenantId, {
    trainingSessionId: sessionId,
    facilityResourceId: targetResourceId,
  });
}

async function reassignSeriesResource(
  tenantId: string,
  seriesId: string,
  targetResourceId: string,
  category: TrainingAllocationGroupKey,
): Promise<void> {
  const seriesAllocations = await listAllocationsByTrainingSeries(tenantId, seriesId);
  const groupAllocations = seriesAllocations.filter(
    (row) => classifyFacilityResourceType(row.facilityResourceType) === category,
  );

  for (const allocation of groupAllocations) {
    await deleteTrainingAllocation(tenantId, allocation.id);
  }

  await createTrainingAllocation(tenantId, {
    trainingSeriesId: seriesId,
    facilityResourceId: targetResourceId,
  });
}
