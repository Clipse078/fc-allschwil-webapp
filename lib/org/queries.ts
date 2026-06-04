/**
 * Org Builder query helpers — server-only.
 *
 * loadOrgUnitIds() is called to extend ActorContext with org unit memberships,
 * enabling visibleOrgUnitRefs to be evaluated in canSeeEntity().
 *
 * Slice 11.2: loadOrgUnitIds now accepts an optional tenantId. When provided,
 * only memberships belonging to that tenant are included in the actor's
 * orgUnitIds. This prevents cross-tenant memberships from entering ActorContext.
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
      // Slice 11.3: linked teams via Team.orgUnitId bridge.
      teams: {
        where: { isActive: true },
        orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
        select: {
          id: true,
          name: true,
          slug: true,
          category: true,
          ageGroup: true,
          teamSeasons: {
            where: { season: { isActive: true } },
            take: 1,
            select: {
              displayName: true,
              season: { select: { name: true } },
            },
          },
        },
      },
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
 *
 * When tenantId is provided, only memberships for that tenant are returned,
 * preventing cross-tenant memberships from entering ActorContext.
 * When tenantId is omitted, all active memberships are returned (safe for
 * single-tenant deployments; the caller documents the backwards-compat reason).
 */
export async function loadOrgUnitIds(userId: string, tenantId?: string): Promise<string[]> {
  const memberships = await prisma.orgUnitMembership.findMany({
    where: {
      userId,
      status: "ACTIVE",
      ...(tenantId !== undefined ? { tenantId } : {}),
    },
    select: { orgUnitId: true },
  });
  return memberships.map((m) => m.orgUnitId);
}

export type OrgUnitListItem = Awaited<ReturnType<typeof getOrgUnits>>[number];

// ── TargetGroup queries ───────────────────────────────────────────────────────

export async function getTargetGroups(tenantId?: string) {
  return prisma.targetGroup.findMany({
    where: {
      status: { not: "ARCHIVED" },
      ...(tenantId ? { tenantId } : {}),
    },
    orderBy: { name: "asc" },
    select: {
      id: true,
      key: true,
      name: true,
      description: true,
      status: true,
      ruleJson: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

export async function getTargetGroupById(id: string) {
  return prisma.targetGroup.findUnique({
    where: { id },
    select: {
      id: true,
      tenantId: true,
      key: true,
      name: true,
      description: true,
      status: true,
      ruleJson: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

export type TargetGroupListItem = Awaited<ReturnType<typeof getTargetGroups>>[number];
export type OrgUnitDetail = Awaited<ReturnType<typeof getOrgUnitById>>;
