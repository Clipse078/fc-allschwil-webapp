/**
 * Org Builder query helpers — server-only.
 *
 * loadOrgUnitIds() is called to extend ActorContext with org unit memberships,
 * enabling visibleOrgUnitRefs to be evaluated in canSeeEntity().
 *
 * TODO: cache orgUnitIds in JWT at login time to avoid a DB query on every
 *   request. Until then, this is called lazily in routes that need it.
 *
 * TODO: when personId is available on ActorContext, extend loadOrgUnitIds
 *   to also include OrgUnitMembership records linked via personId.
 */

import { prisma } from "@/lib/db/prisma";

export async function getOrgUnits(tenantId?: string) {
  return prisma.orgUnit.findMany({
    where: {
      status: { not: "ARCHIVED" },
      ...(tenantId ? { tenantId } : {}),
    },
    orderBy: [{ level: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      key: true,
      name: true,
      type: true,
      status: true,
      parentId: true,
      level: true,
      sortOrder: true,
      description: true,
      _count: { select: { memberships: true, children: true } },
    },
  });
}

export async function getOrgUnitById(id: string) {
  return prisma.orgUnit.findUnique({
    where: { id },
    select: {
      id: true,
      tenantId: true,
      key: true,
      name: true,
      type: true,
      status: true,
      parentId: true,
      level: true,
      sortOrder: true,
      description: true,
      createdAt: true,
      updatedAt: true,
      parent: { select: { id: true, name: true, key: true } },
      children: { select: { id: true, name: true, key: true, type: true, status: true }, orderBy: { sortOrder: "asc" } },
      memberships: {
        where: { status: "ACTIVE" },
        select: {
          id: true,
          userId: true,
          personId: true,
          roleKey: true,
          isPrimary: true,
          status: true,
          startsAt: true,
          endsAt: true,
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          person: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              displayName: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });
}

/**
 * Load the orgUnit IDs that a user is an active member of.
 * Used to populate ActorContext.orgUnitIds.
 */
export async function loadOrgUnitIds(userId: string): Promise<string[]> {
  const memberships = await prisma.orgUnitMembership.findMany({
    where: { userId, status: "ACTIVE" },
    select: { orgUnitId: true },
  });
  return memberships.map((m) => m.orgUnitId);
}

export type OrgUnitListItem = Awaited<ReturnType<typeof getOrgUnits>>[number];
export type OrgUnitDetail = Awaited<ReturnType<typeof getOrgUnitById>>;
