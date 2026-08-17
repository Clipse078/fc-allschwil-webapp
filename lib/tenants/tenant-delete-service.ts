/**
 * lib/tenants/tenant-delete-service.ts
 *
 * ADMIN-DELETE-TENANT-01: Service layer for Tenant permanent hard-delete.
 *
 * Authority: SCE Super Admin only (PERMISSIONS.TENANTS_DELETE, scope=PLATFORM).
 * Tenant-local Club Admins do NOT hold this permission.
 *
 * Preservation rule (critical):
 *   - Global User records are NEVER deleted by this operation.
 *   - Users may belong to other tenants; only the membership/role rows
 *     for THIS tenant are cascade-deleted by Tenant FK relations.
 *   - TenantMembership rows → onDelete: Cascade (auto-deleted with Tenant)
 *   - UserRole.tenantId → onDelete: SetNull (rows survive as orphans unless
 *     we explicitly delete them before the Tenant row).
 *
 * OrgUnit: Tenant has no direct `orgUnits` back-relation (tenantId is nullable
 * in OrgUnit). We count/delete OrgUnits via a separate query on OrgUnit.tenantId.
 * The Prisma cascade from Tenant does NOT include OrgUnit (no @relation in Tenant
 * pointing to OrgUnit). We must explicitly delete OrgUnits before Tenant, or rely
 * on the schema cascade via their child relations. Actually: OrgUnit → tenantId is
 * nullable with no Tenant @relation, so deleting Tenant does NOT cascade to OrgUnit.
 * We must explicitly delete OrgUnits to avoid leaving orphaned rows.
 */

import { prisma } from "@/lib/db/prisma";

export type TenantDeletionImpact = {
  persons: number;
  teams: number;
  teamSeasons: number;
  orgUnits: number;
  users: number;
  registrations: number;
  events: number;
  trainingSeries: number;
  trainingSessions: number;
  newsArticles: number;
  mediaAssets: number;
  workspaceDocuments: number;
  infoboards: number;
  facilities: number;
  facilityResources: number;
  auditLogs: number;
};

/**
 * Returns the impact preview for permanently deleting a Tenant.
 * Returns null when the Tenant does not exist.
 * Never mutates.
 */
export async function getTenantDeletionImpact(
  tenantId: string,
): Promise<TenantDeletionImpact | null> {
  const tenantExists = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true },
  });

  if (!tenantExists) return null;

  const [
    persons, teams, orgUnits, registrations, events, trainingSeries,
    trainingSessions, newsArticles, mediaAssets, workspaceDocuments,
    infoboards, facilities, facilityResources, auditLogs, tenantMemberships,
  ] = await Promise.all([
    prisma.person.count({ where: { tenantId } }),
    prisma.team.count({ where: { tenantId } }),
    prisma.orgUnit.count({ where: { tenantId } }),
    prisma.registration.count({ where: { tenantId } }),
    prisma.event.count({ where: { tenantId } }),
    prisma.trainingSeries.count({ where: { tenantId } }),
    prisma.trainingSession.count({ where: { tenantId } }),
    prisma.newsArticle.count({ where: { tenantId } }),
    prisma.mediaAsset.count({ where: { tenantId } }),
    prisma.workspaceDocument.count({ where: { tenantId } }),
    prisma.infoboard.count({ where: { tenantId } }),
    prisma.facility.count({ where: { tenantId } }),
    prisma.facilityResource.count({ where: { tenantId } }),
    prisma.auditLog.count({ where: { tenantId } }),
    prisma.tenantMembership.count({ where: { tenantId } }),
  ]);

  const teamSeasons = await prisma.teamSeason.count({
    where: { team: { tenantId } },
  });

  return {
    persons, teams, teamSeasons, orgUnits, users: tenantMemberships,
    registrations, events, trainingSeries, trainingSessions,
    newsArticles, mediaAssets, workspaceDocuments, infoboards,
    facilities, facilityResources, auditLogs,
  };
}

export type TenantDeletionResult = {
  tenantId: string;
  name: string;
  key: string;
  impact: TenantDeletionImpact;
};

/**
 * Permanently deletes a Tenant and all its owned data.
 *
 * Pre-delete steps (items NOT cascade-deleted by Tenant FK):
 *   1. UserRole rows scoped to this tenant (tenantId: onDelete: SetNull — they
 *      survive Tenant delete as orphaned rows without explicit cleanup).
 *   2. OrgUnit rows for this tenant (OrgUnit.tenantId is nullable; no Tenant
 *      @relation pointing to OrgUnit in schema, so no FK cascade from Tenant).
 *      OrgUnit children (OrgUnitMembership, PersonAssignment, TeamSeasonOrgUnit,
 *      scoped UserRoles) cascade-delete with each OrgUnit row.
 *
 * Then: delete the Tenant row. All directly FK-cascaded tenant-owned data
 * (Person, Team, Facility, Registration, Event, TrainingSeries, etc.) auto-deletes.
 *
 * Global Users are NEVER deleted. After this operation:
 *   - User records for members of this tenant still exist globally.
 *   - TenantMembership rows for this tenant auto-delete (Cascade from Tenant).
 *   - They retain any memberships/roles in other tenants.
 *
 * Returns null when the Tenant does not exist.
 */
export async function deleteTenantPermanently(
  tenantId: string,
): Promise<TenantDeletionResult | null> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { name: true, key: true },
  });

  if (!tenant) return null;

  const impact = await getTenantDeletionImpact(tenantId);
  if (!impact) return null;

  await prisma.$transaction(async (tx) => {
    // Step 1: Delete scoped UserRole rows (tenantId → SetNull, so they survive
    // Tenant deletion as orphaned rows without this explicit cleanup).
    await tx.userRole.deleteMany({ where: { tenantId } });

    // Step 2: Delete OrgUnit rows (not cascade-deleted by Tenant FK).
    // Child rows (OrgUnitMembership, PersonAssignment, TeamSeasonOrgUnit, etc.)
    // cascade-delete automatically from each OrgUnit.
    await tx.orgUnit.deleteMany({ where: { tenantId } });

    // Step 3: Delete the Tenant row. All other directly FK-cascaded tenant-owned
    // data (Person, Team, Facility, Event, Registration, TrainingSeries,
    // TrainingSession, TenantMembership, etc.) auto-deletes via onDelete: Cascade.
    await tx.tenant.delete({ where: { id: tenantId } });
  });

  return { tenantId, name: tenant.name, key: tenant.key, impact };
}
