/**
 * lib/org-units/orgunit-delete-service.ts
 *
 * ADMIN-DELETE-ORG-01: Service layer for OrgUnit permanent hard-delete.
 *
 * Schema FK semantics relevant to this delete:
 *   • OrgUnit.parent → SetNull (children's parentId → null, not cascade-deleted)
 *   • OrgUnitMembership → Cascade on orgUnitId (auto-deleted)
 *   • PersonAssignment → Cascade on orgUnitId (auto-deleted)
 *   • TeamSeasonOrgUnit → onDelete behavior checked below (Cascade)
 *   • UserRole.orgUnitId → Cascade on OrgUnit (scoped role assignments auto-deleted)
 *   • Team.orgUnitId (legacy) → SetNull
 *
 * Preserved:
 *   • Persons — PersonAssignment rows are deleted but Person records survive.
 *   • Teams — Team.orgUnitId is set to null, Team is NOT deleted.
 *   • TeamSeasons — TeamSeasonOrgUnit rows cascade-delete; TeamSeason survives.
 *   • Users — UserRole.orgUnitId rows cascade-delete (scoped grants removed),
 *     but User, TenantMembership, and non-scoped UserRole survive.
 */

import { prisma } from "@/lib/db/prisma";

export type OrgUnitDeletionImpact = {
  /** Child OrgUnits whose parentId will be set to null (not deleted). */
  childOrgUnits: number;
  /** TeamSeasonOrgUnit join rows that will be cascade-deleted. */
  teamSeasonLinks: number;
  /** OrgUnitMembership rows (cascade-deleted). */
  orgUnitMemberships: number;
  /** PersonAssignment rows (cascade-deleted). */
  personAssignments: number;
  /** Scoped UserRole assignments targeting this OrgUnit (cascade-deleted). */
  scopedUserRoles: number;
  /** Legacy Team rows referencing this OrgUnit (Team.orgUnitId → null). */
  legacyTeamLinks: number;
};

/**
 * Returns the deletion impact for an OrgUnit within the given tenant.
 * Returns null when the OrgUnit does not exist or is cross-tenant.
 * Never mutates.
 */
export async function getOrgUnitDeletionImpact(
  tenantId: string,
  orgUnitId: string,
): Promise<OrgUnitDeletionImpact | null> {
  const orgUnit = await prisma.orgUnit.findUnique({
    where: { id: orgUnitId },
    select: {
      tenantId: true,
      _count: {
        select: {
          children: true,
          teamSeasonOrgUnits: true,
          memberships: true,
          personAssignments: true,
          userRoles: true,
          teams: true,
        },
      },
    },
  });

  if (!orgUnit) return null;
  // Accept null tenantId rows (legacy backfill) as belonging to the resolved tenant.
  if (orgUnit.tenantId !== null && orgUnit.tenantId !== tenantId) return null;

  return {
    childOrgUnits: orgUnit._count.children,
    teamSeasonLinks: orgUnit._count.teamSeasonOrgUnits,
    orgUnitMemberships: orgUnit._count.memberships,
    personAssignments: orgUnit._count.personAssignments,
    scopedUserRoles: orgUnit._count.userRoles,
    legacyTeamLinks: orgUnit._count.teams,
  };
}

export type OrgUnitDeletionResult = {
  orgUnitId: string;
  name: string;
  key: string;
  impact: OrgUnitDeletionImpact;
};

/**
 * Permanently deletes an OrgUnit within the given tenant.
 *
 * FK cascades handled automatically by Prisma/DB:
 *   • OrgUnitMembership (Cascade)
 *   • PersonAssignment (Cascade)
 *   • TeamSeasonOrgUnit (Cascade)
 *   • UserRole with orgUnitId (Cascade)
 *   • Team.orgUnitId (SetNull)
 *   • Children's parentId (SetNull — children survive as root units)
 *
 * No explicit cleanup needed beyond deleting the OrgUnit itself.
 * Persons, Teams, TeamSeasons, and Users all survive.
 *
 * Returns null when the OrgUnit does not exist in the tenant.
 */
export async function deleteOrgUnitPermanently(
  tenantId: string,
  orgUnitId: string,
): Promise<OrgUnitDeletionResult | null> {
  const orgUnit = await prisma.orgUnit.findUnique({
    where: { id: orgUnitId },
    select: {
      tenantId: true,
      name: true,
      key: true,
      _count: {
        select: {
          children: true,
          teamSeasonOrgUnits: true,
          memberships: true,
          personAssignments: true,
          userRoles: true,
          teams: true,
        },
      },
    },
  });

  if (!orgUnit) return null;
  if (orgUnit.tenantId !== null && orgUnit.tenantId !== tenantId) return null;

  const impact: OrgUnitDeletionImpact = {
    childOrgUnits: orgUnit._count.children,
    teamSeasonLinks: orgUnit._count.teamSeasonOrgUnits,
    orgUnitMemberships: orgUnit._count.memberships,
    personAssignments: orgUnit._count.personAssignments,
    scopedUserRoles: orgUnit._count.userRoles,
    legacyTeamLinks: orgUnit._count.teams,
  };

  // Single delete — all FK cascades/setNulls run automatically.
  await prisma.orgUnit.delete({ where: { id: orgUnitId } });

  return {
    orgUnitId,
    name: orgUnit.name,
    key: orgUnit.key,
    impact,
  };
}
