/**
 * lib/training/planning-grid/reassignment-service.ts
 *
 * Canonical resource reassignment for the planning grid — occurrence override
 * or series-level allocation change with explicit scope.
 */

import { prisma } from "@/lib/db/prisma";
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

export async function reassignPlanningGridResource(input: ReassignResourceInput): Promise<void> {
  const session = await prisma.trainingSession.findFirst({
    where: { id: input.sessionId, tenantId: input.tenantId },
    select: { id: true, trainingSeriesId: true, date: true, status: true },
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
