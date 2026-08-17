/**
 * lib/facilities/facility-delete-service.ts
 *
 * ADMIN-DELETE-FACILITIES-01: Service layer for Facility and FacilityResource
 * permanent hard-delete.
 *
 * Preservation rule:
 *   Deleting a FacilityResource removes only the resource record and its
 *   allocation LINK rows (TrainingAllocation, TrainingSessionAllocation, etc.).
 *   These link rows are subordinate to the resource — they record "which
 *   resource was assigned to which training/match". The canonical planning
 *   entities themselves (TrainingSeries, TrainingSession, Event, Tournament,
 *   WeekplannerPlan) are NEVER deleted; only the resource-assignment links
 *   are removed by the DB engine cascade.
 *
 * Schema FK behavior (from prisma/schema.prisma):
 *   FacilityResource.facilityId            → non-nullable, onDelete: Cascade (from Facility)
 *   TrainingAllocation.facilityResourceId  → non-nullable, onDelete: Cascade
 *   TrainingSessionAllocation.facilityResourceId → non-nullable, onDelete: Cascade
 *   TournamentResourceAllocation.facilityResourceId → non-nullable, onDelete: Cascade
 *   TournamentParticipantAllocation.facilityResourceId → non-nullable, onDelete: Cascade
 *   WeekplannerPlanAllocation.facilityResourceId → non-nullable, onDelete: Cascade
 *
 *   All allocation rows cascade-delete automatically. The DB engine handles
 *   this — no explicit pre-delete cleanup is needed. The planning history
 *   (sessions were scheduled, matches were played) is preserved in full;
 *   only the "which resource" linkage is removed with the resource.
 */

import { prisma } from "@/lib/db/prisma";

// ── FacilityResource permanent delete ────────────────────────────────────────

export type FacilityResourceDeletionImpact = {
  /** Training series allocation links cascade-deleted (TrainingSeries survives). */
  trainingAllocations: number;
  /** Training session allocation links cascade-deleted (TrainingSession survives). */
  trainingSessionAllocations: number;
  /** Tournament resource allocation links cascade-deleted (Tournament survives). */
  tournamentResourceAllocations: number;
  /** Tournament participant allocation links cascade-deleted (TournamentParticipant survives). */
  tournamentParticipantAllocations: number;
  /** Weekplanner plan allocation links cascade-deleted (WeekplannerPlan survives). */
  weekplannerPlanAllocations: number;
};

/**
 * Returns deletion impact for a FacilityResource within the given tenant.
 * Returns null when the resource does not exist or is cross-tenant.
 * Never mutates.
 */
export async function getFacilityResourceDeletionImpact(
  tenantId: string,
  resourceId: string,
): Promise<FacilityResourceDeletionImpact | null> {
  const resource = await prisma.facilityResource.findUnique({
    where: { id: resourceId },
    select: {
      tenantId: true,
      _count: {
        select: {
          trainingAllocations: true,
          trainingSessionAllocations: true,
          tournamentResourceAllocations: true,
          tournamentParticipantAllocations: true,
          weekplannerPlanAllocations: true,
        },
      },
    },
  });

  if (!resource || resource.tenantId !== tenantId) return null;

  return {
    trainingAllocations: resource._count.trainingAllocations,
    trainingSessionAllocations: resource._count.trainingSessionAllocations,
    tournamentResourceAllocations: resource._count.tournamentResourceAllocations,
    tournamentParticipantAllocations: resource._count.tournamentParticipantAllocations,
    weekplannerPlanAllocations: resource._count.weekplannerPlanAllocations,
  };
}

export type FacilityResourceDeletionResult = {
  resourceId: string;
  name: string;
  code: string;
  impact: FacilityResourceDeletionImpact;
};

/**
 * Permanently deletes a FacilityResource within the given tenant.
 *
 * Allocation link rows (TrainingAllocation, TrainingSessionAllocation, etc.)
 * cascade-delete automatically via onDelete: Cascade on facilityResourceId.
 * The canonical planning records (TrainingSeries, TrainingSession, Event,
 * Tournament, WeekplannerPlan) are never deleted — only the allocation links.
 *
 * Returns null when the resource does not exist in the tenant.
 */
export async function deleteFacilityResourcePermanently(
  tenantId: string,
  resourceId: string,
): Promise<FacilityResourceDeletionResult | null> {
  const resource = await prisma.facilityResource.findUnique({
    where: { id: resourceId },
    select: {
      tenantId: true,
      name: true,
      code: true,
      _count: {
        select: {
          trainingAllocations: true,
          trainingSessionAllocations: true,
          tournamentResourceAllocations: true,
          tournamentParticipantAllocations: true,
          weekplannerPlanAllocations: true,
        },
      },
    },
  });

  if (!resource || resource.tenantId !== tenantId) return null;

  const impact: FacilityResourceDeletionImpact = {
    trainingAllocations: resource._count.trainingAllocations,
    trainingSessionAllocations: resource._count.trainingSessionAllocations,
    tournamentResourceAllocations: resource._count.tournamentResourceAllocations,
    tournamentParticipantAllocations: resource._count.tournamentParticipantAllocations,
    weekplannerPlanAllocations: resource._count.weekplannerPlanAllocations,
  };

  // DB engine cascade-deletes allocation link rows automatically (onDelete: Cascade).
  // Canonical planning entities (TrainingSeries, TrainingSession, etc.) are never touched.
  await prisma.facilityResource.delete({ where: { id: resourceId } });

  return { resourceId, name: resource.name, code: resource.code, impact };
}

// ── Facility permanent delete ─────────────────────────────────────────────────

export type FacilityDeletionImpact = {
  /** Direct child FacilityResource rows (cascade-deleted with the Facility). */
  resources: number;
  /** Aggregated allocation link rows across all child resources (cascade-deleted). */
  totalAllocationRefs: number;
};

/**
 * Returns deletion impact for a Facility within the given tenant.
 * Returns null when the facility does not exist or is cross-tenant.
 * Never mutates.
 */
export async function getFacilityDeletionImpact(
  tenantId: string,
  facilityId: string,
): Promise<FacilityDeletionImpact | null> {
  const facility = await prisma.facility.findUnique({
    where: { id: facilityId },
    select: {
      tenantId: true,
      _count: { select: { resources: true } },
    },
  });

  if (!facility || facility.tenantId !== tenantId) return null;

  // Count all allocation references across child resources.
  // Use individual count queries scoped by facility resources in this tenant.
  const resourceIds = await prisma.facilityResource.findMany({
    where: { facilityId, tenantId },
    select: { id: true },
  }).then((rows) => rows.map((r) => r.id));

  const totalAllocationRefs = resourceIds.length === 0 ? 0 : (
    await Promise.all([
      prisma.trainingAllocation.count({ where: { facilityResourceId: { in: resourceIds } } }),
      prisma.trainingSessionAllocation.count({ where: { facilityResourceId: { in: resourceIds } } }),
      prisma.tournamentResourceAllocation.count({ where: { facilityResourceId: { in: resourceIds } } }),
      prisma.tournamentParticipantAllocation.count({ where: { facilityResourceId: { in: resourceIds } } }),
      prisma.weekplannerPlanAllocation.count({ where: { facilityResourceId: { in: resourceIds } } }),
    ])
  ).reduce((sum, n) => sum + n, 0);

  return {
    resources: facility._count.resources,
    totalAllocationRefs,
  };
}

export type FacilityDeletionResult = {
  facilityId: string;
  name: string;
  impact: FacilityDeletionImpact;
};

/**
 * Permanently deletes a Facility within the given tenant.
 *
 * All child FacilityResource rows cascade-delete automatically.
 * Allocation references on each resource are set to null by the DB engine
 * (onDelete: SetNull on allocation FK columns).
 * Trainings, Matches, Tournaments, and Events are preserved.
 *
 * Returns null when the facility does not exist in the tenant.
 */
export async function deleteFacilityPermanently(
  tenantId: string,
  facilityId: string,
): Promise<FacilityDeletionResult | null> {
  const facility = await prisma.facility.findUnique({
    where: { id: facilityId },
    select: {
      tenantId: true,
      name: true,
      _count: { select: { resources: true } },
    },
  });

  if (!facility || facility.tenantId !== tenantId) return null;

  // Count total allocation refs for audit (before deletion).
  const resourceIdsForAudit = await prisma.facilityResource.findMany({
    where: { facilityId, tenantId },
    select: { id: true },
  }).then((rows) => rows.map((r) => r.id));

  const totalAllocationRefs = resourceIdsForAudit.length === 0 ? 0 : (
    await Promise.all([
      prisma.trainingAllocation.count({ where: { facilityResourceId: { in: resourceIdsForAudit } } }),
      prisma.trainingSessionAllocation.count({ where: { facilityResourceId: { in: resourceIdsForAudit } } }),
      prisma.tournamentResourceAllocation.count({ where: { facilityResourceId: { in: resourceIdsForAudit } } }),
      prisma.tournamentParticipantAllocation.count({ where: { facilityResourceId: { in: resourceIdsForAudit } } }),
      prisma.weekplannerPlanAllocation.count({ where: { facilityResourceId: { in: resourceIdsForAudit } } }),
    ])
  ).reduce((sum, n) => sum + n, 0);

  const impact: FacilityDeletionImpact = {
    resources: facility._count.resources,
    totalAllocationRefs,
  };

  // Deleting the Facility cascade-deletes all FacilityResource children.
  // Each resource deletion then cascade-deletes its allocation link rows.
  // Canonical planning entities (TrainingSeries, TrainingSession, etc.) are never touched.
  await prisma.facility.delete({ where: { id: facilityId } });

  return { facilityId, name: facility.name, impact };
}
