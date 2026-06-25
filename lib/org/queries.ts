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
 * Phase 1 Core: endsAt enforcement — memberships past their end date are
 * excluded from ActorContext so expired memberships do not grant visibility.
 *
 * Phase 1 Core: person-based memberships — when personId is provided, org
 * unit memberships linked via personId are also included in orgUnitIds.
 *
 * Phase 2 (org-based permissions): archived org unit filter — memberships
 * pointing to archived org units are excluded from ActorContext so archived
 * units never grant visibility or access.
 *
 * TODO: cache orgUnitIds in JWT at login time to avoid a DB query on every
 *   request. Until then, this is called lazily in routes that need it.
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
      archivedAt: true,
      _count: { select: { memberships: true, children: true } },
    },
  });
}

/**
 * Returns all ARCHIVED org units for a tenant.
 * Used in the archived view of the Organisation Builder to allow restore.
 */
export async function getArchivedOrgUnits(tenantId?: string) {
  return prisma.orgUnit.findMany({
    where: {
      status: "ARCHIVED",
      ...(tenantId ? { tenantId } : {}),
    },
    orderBy: [{ archivedAt: "desc" }, { name: "asc" }],
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
      archivedAt: true,
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
      archivedAt: true,
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
          notes: true,
          seasonId: true,
          season: { select: { id: true, name: true, key: true } },
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
 * Load the orgUnit IDs that a user (or their associated person) is an active member of.
 * Used to populate ActorContext.orgUnitIds.
 *
 * Phase 1 Core:
 * - Enforces endsAt: memberships with a past endsAt are excluded so expired
 *   memberships do not grant visibility access.
 * - Includes person-based memberships when personId is provided.
 *
 * Phase 2 (org-based permissions):
 * - Excludes memberships pointing to archived org units. When an OrgUnit is
 *   archived (status: "ARCHIVED"), it must no longer grant visibility or access
 *   to any entity via visibleOrgUnitRefs. Only non-archived org units propagate
 *   membership into ActorContext.
 *
 * When tenantId is provided, only memberships for that tenant are returned,
 * preventing cross-tenant memberships from entering ActorContext.
 * When tenantId is omitted, all active memberships are returned (safe for
 * single-tenant deployments; the caller documents the backwards-compat reason).
 */
export async function loadOrgUnitIds(
  userId: string,
  tenantId?: string,
  personId?: string,
): Promise<string[]> {
  const now = new Date();
  const tenantFilter = tenantId !== undefined ? { tenantId } : {};
  const expiryFilter = { OR: [{ endsAt: null }, { endsAt: { gt: now } }] };
  // Exclude memberships for archived org units — archived units must not grant visibility.
  const activeOrgUnitFilter = { orgUnit: { status: { not: "ARCHIVED" as const } } };

  const [userMemberships, personMemberships] = await Promise.all([
    prisma.orgUnitMembership.findMany({
      where: { userId, status: "ACTIVE", ...tenantFilter, ...expiryFilter, ...activeOrgUnitFilter },
      select: { orgUnitId: true },
    }),
    personId
      ? prisma.orgUnitMembership.findMany({
          where: { personId, status: "ACTIVE", ...tenantFilter, ...expiryFilter, ...activeOrgUnitFilter },
          select: { orgUnitId: true },
        })
      : Promise.resolve([]),
  ]);

  const ids = new Set<string>();
  for (const m of userMemberships) ids.add(m.orgUnitId);
  for (const m of personMemberships) ids.add(m.orgUnitId);
  return Array.from(ids);
}

export type OrgUnitListItem = Awaited<ReturnType<typeof getOrgUnits>>[number];
export type ArchivedOrgUnitListItem = Awaited<ReturnType<typeof getArchivedOrgUnits>>[number];

/**
 * Phase B — Membership history: returns all memberships for an org unit,
 * including INACTIVE and PENDING, with optional season/status filters.
 * Used by the history tab on the org unit detail page.
 */
export async function getOrgUnitMembershipHistory(
  orgUnitId: string,
  opts: { seasonId?: string; status?: string } = {},
) {
  return prisma.orgUnitMembership.findMany({
    where: {
      orgUnitId,
      ...(opts.status ? { status: opts.status as "ACTIVE" | "INACTIVE" | "PENDING" } : {}),
      ...(opts.seasonId ? { seasonId: opts.seasonId } : {}),
    },
    orderBy: [{ createdAt: "desc" }],
    select: {
      id: true,
      userId: true,
      personId: true,
      roleKey: true,
      status: true,
      isPrimary: true,
      startsAt: true,
      endsAt: true,
      notes: true,
      seasonId: true,
      season: { select: { id: true, name: true, key: true } },
      createdAt: true,
      updatedAt: true,
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
  });
}

export type MembershipHistoryItem = Awaited<ReturnType<typeof getOrgUnitMembershipHistory>>[number];

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

/**
 * Load all target group IDs that a user (or person) belongs to via resolved membership.
 * Used by getActorContext to populate ActorContext.targetGroupIds.
 * Calls resolveTargetGroupMemberIds for each active target group.
 */
export async function loadTargetGroupIds(
  userId: string,
  tenantId?: string,
  personId?: string,
): Promise<string[]> {
  const groups = await prisma.targetGroup.findMany({
    where: {
      status: { not: "ARCHIVED" },
      ...(tenantId ? { tenantId } : {}),
    },
    select: { id: true, ruleJson: true },
  });

  const ids: string[] = [];
  for (const group of groups) {
    const members = resolveRuleJsonMemberIds(group.ruleJson);
    const inGroup =
      members.userIds.includes(userId) ||
      (personId ? members.personIds.includes(personId) : false);
    if (inGroup) ids.push(group.id);
  }
  return ids;
}

/**
 * Minimal in-process ruleJson evaluation — extracts explicit userIds and personIds.
 * Full rule evaluation (orgUnit-based, role-based) is in lib/org/target-group-resolver.ts.
 * This lightweight version is used in loadTargetGroupIds to avoid circular imports.
 */
function resolveRuleJsonMemberIds(ruleJson: unknown): {
  userIds: string[];
  personIds: string[];
} {
  if (!ruleJson || typeof ruleJson !== "object") return { userIds: [], personIds: [] };
  const rule = ruleJson as Record<string, unknown>;

  const userIds = new Set<string>();
  const personIds = new Set<string>();

  function processClause(clause: unknown) {
    if (!clause || typeof clause !== "object") return;
    const c = clause as Record<string, unknown>;
    if (c.type === "userIds" && Array.isArray(c.value)) {
      c.value.filter((v): v is string => typeof v === "string").forEach((v) => userIds.add(v));
    }
    if (c.type === "personIds" && Array.isArray(c.value)) {
      c.value.filter((v): v is string => typeof v === "string").forEach((v) => personIds.add(v));
    }
    if ((c.type === "union" || c.type === "intersection") && Array.isArray(c.clauses)) {
      (c.clauses as unknown[]).forEach(processClause);
    }
  }

  processClause(rule);
  return { userIds: Array.from(userIds), personIds: Array.from(personIds) };
}
