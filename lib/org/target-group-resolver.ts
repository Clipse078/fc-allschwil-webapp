/**
 * TargetGroup Resolution Engine — server-only.
 *
 * Evaluates TargetGroup.ruleJson to a deterministic set of member IDs.
 * No AI, no probabilistic logic. Pure DB lookups + set algebra.
 *
 * Supports:
 *   - userIds clause: explicit user list
 *   - personIds clause: explicit person list
 *   - orgUnitIds clause: all active, non-expired members of given org units
 *   - roleKeys clause: all users holding given role keys
 *   - teamIds clause: all active squad + trainer members of given team seasons
 *   - union: logical OR across sub-clauses
 *   - intersection: logical AND across sub-clauses
 *
 * Performance: resolves lazily — DB queries are only issued for referenced
 * clause types. Results are deduplicated in-process.
 *
 * Tenant isolation: all queries are tenant-scoped when tenantId is provided.
 * Cross-tenant leakage is structurally impossible: org units / teams / roles
 * are fetched with tenant filters.
 *
 * Future consumers: visibility (Phase D), communication, polls, newsletters,
 * meetings, initiatives, strategy, registrations, finance, mobile app.
 */

import { prisma } from "@/lib/db/prisma";
import type {
  TargetGroupClause,
  ResolvedMembership,
  TargetGroupResolveResult,
} from "./target-group-types";

// ── Internal resolution context ───────────────────────────────────────────────

type ResolutionCtx = {
  tenantId?: string;
  now: Date;
};

type MemberKey = string; // `user:${userId}` or `person:${personId}`

type MemberEntry = ResolvedMembership & {
  _key: MemberKey;
};

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Resolve a TargetGroup to its full member set.
 *
 * @param targetGroupId - the TargetGroup to resolve
 * @param tenantId - optional tenant scope; strongly recommended for tenant safety
 */
export async function resolveTargetGroup(
  targetGroupId: string,
  tenantId?: string,
): Promise<TargetGroupResolveResult | null> {
  const group = await prisma.targetGroup.findUnique({
    where: { id: targetGroupId },
    select: { id: true, tenantId: true, ruleJson: true, status: true },
  });

  if (!group) return null;
  if (group.status === "ARCHIVED") return null;

  // Tenant isolation: reject cross-tenant access
  if (tenantId && group.tenantId && group.tenantId !== tenantId) return null;

  const ctx: ResolutionCtx = { tenantId: tenantId ?? group.tenantId ?? undefined, now: new Date() };

  const memberMap = new Map<MemberKey, MemberEntry>();

  if (group.ruleJson) {
    await applyClause(group.ruleJson as TargetGroupClause, ctx, memberMap, "union");
  }

  const members = Array.from(memberMap.values()).map(({ _key: _ignored, ...m }) => m);

  return {
    targetGroupId,
    userIds: members.filter((m) => m.userId).map((m) => m.userId!),
    personIds: members.filter((m) => m.personId).map((m) => m.personId!),
    members,
    resolvedAt: new Date().toISOString(),
    memberCount: members.length,
  };
}

/**
 * Quickly resolve just the user IDs for a target group.
 * Used by loadTargetGroupIds and canSeeEntity integration.
 */
export async function resolveTargetGroupUserIds(
  targetGroupId: string,
  tenantId?: string,
): Promise<string[]> {
  const result = await resolveTargetGroup(targetGroupId, tenantId);
  return result?.userIds ?? [];
}

// ── Clause evaluator ──────────────────────────────────────────────────────────

async function applyClause(
  clause: TargetGroupClause,
  ctx: ResolutionCtx,
  out: Map<MemberKey, MemberEntry>,
  mode: "union" | "intersection",
): Promise<void> {
  if (clause.type === "union") {
    for (const sub of clause.clauses) {
      await applyClause(sub, ctx, out, "union");
    }
    return;
  }

  if (clause.type === "intersection") {
    // Intersection: collect each sub-clause separately, then intersect keys
    const subMaps: Map<MemberKey, MemberEntry>[] = [];
    for (const sub of clause.clauses) {
      const subMap = new Map<MemberKey, MemberEntry>();
      await applyClause(sub, ctx, subMap, "union");
      subMaps.push(subMap);
    }
    if (subMaps.length === 0) return;

    // Keys present in ALL sub-maps
    const intersectedKeys = Array.from(subMaps[0].keys()).filter((k) =>
      subMaps.every((m) => m.has(k)),
    );

    for (const key of intersectedKeys) {
      const entry = subMaps[0].get(key)!;
      if (mode === "union") {
        mergeEntry(out, entry);
      }
    }
    return;
  }

  // Leaf clauses
  const entries = await resolveLeafClause(clause, ctx);
  if (mode === "union") {
    for (const e of entries) mergeEntry(out, e);
  }
}

function mergeEntry(out: Map<MemberKey, MemberEntry>, entry: MemberEntry) {
  const existing = out.get(entry._key);
  if (!existing) {
    out.set(entry._key, entry);
    return;
  }
  // Merge attribution arrays
  if (entry.viaOrgUnitIds)
    existing.viaOrgUnitIds = dedup([...(existing.viaOrgUnitIds ?? []), ...entry.viaOrgUnitIds]);
  if (entry.viaRoleKeys)
    existing.viaRoleKeys = dedup([...(existing.viaRoleKeys ?? []), ...entry.viaRoleKeys]);
  if (entry.viaTeamIds)
    existing.viaTeamIds = dedup([...(existing.viaTeamIds ?? []), ...entry.viaTeamIds]);
}

function dedup<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

// ── Leaf clause resolvers ─────────────────────────────────────────────────────

async function resolveLeafClause(
  clause: Exclude<TargetGroupClause, { type: "union" } | { type: "intersection" }>,
  ctx: ResolutionCtx,
): Promise<MemberEntry[]> {
  switch (clause.type) {
    case "userIds":
      return resolveUserIds(clause.value);
    case "personIds":
      return resolvePersonIds(clause.value);
    case "orgUnitIds":
      return resolveOrgUnitIds(clause.value, ctx);
    case "roleKeys":
      return resolveRoleKeys(clause.value, ctx);
    case "teamIds":
      return resolveTeamIds(clause.value);
  }
}

async function resolveUserIds(ids: string[]): Promise<MemberEntry[]> {
  if (ids.length === 0) return [];
  const users = await prisma.user.findMany({
    where: { id: { in: ids }, isActive: true },
    select: { id: true, firstName: true, lastName: true, email: true },
  });
  return users.map((u) => ({
    _key: `user:${u.id}`,
    userId: u.id,
    personId: null,
    roleKey: null,
    displayName: `${u.firstName} ${u.lastName}`,
    email: u.email,
    memberType: "user" as const,
  }));
}

async function resolvePersonIds(ids: string[]): Promise<MemberEntry[]> {
  if (ids.length === 0) return [];
  const persons = await prisma.person.findMany({
    where: { id: { in: ids }, isActive: true },
    select: { id: true, firstName: true, lastName: true, displayName: true, email: true },
  });
  return persons.map((p) => ({
    _key: `person:${p.id}`,
    userId: null,
    personId: p.id,
    roleKey: null,
    displayName: p.displayName ?? `${p.firstName} ${p.lastName}`,
    email: p.email,
    memberType: "person" as const,
  }));
}

async function resolveOrgUnitIds(ids: string[], ctx: ResolutionCtx): Promise<MemberEntry[]> {
  if (ids.length === 0) return [];
  const memberships = await prisma.orgUnitMembership.findMany({
    where: {
      orgUnitId: { in: ids },
      status: "ACTIVE",
      OR: [{ endsAt: null }, { endsAt: { gt: ctx.now } }],
      ...(ctx.tenantId ? { tenantId: ctx.tenantId } : {}),
    },
    select: {
      orgUnitId: true,
      userId: true,
      personId: true,
      roleKey: true,
      user: { select: { id: true, firstName: true, lastName: true, email: true, isActive: true } },
      person: {
        select: { id: true, firstName: true, lastName: true, displayName: true, email: true, isActive: true },
      },
    },
  });

  const results: MemberEntry[] = [];
  for (const m of memberships) {
    if (m.user && m.user.isActive) {
      results.push({
        _key: `user:${m.user.id}`,
        userId: m.user.id,
        personId: null,
        roleKey: m.roleKey,
        displayName: `${m.user.firstName} ${m.user.lastName}`,
        email: m.user.email,
        memberType: "user",
        viaOrgUnitIds: [m.orgUnitId],
      });
    }
    if (m.person && m.person.isActive) {
      results.push({
        _key: `person:${m.person.id}`,
        userId: null,
        personId: m.person.id,
        roleKey: m.roleKey,
        displayName: m.person.displayName ?? `${m.person.firstName} ${m.person.lastName}`,
        email: m.person.email,
        memberType: "person",
        viaOrgUnitIds: [m.orgUnitId],
      });
    }
  }
  return results;
}

async function resolveRoleKeys(keys: string[], ctx: ResolutionCtx): Promise<MemberEntry[]> {
  if (keys.length === 0) return [];

  const roles = await prisma.role.findMany({
    where: { key: { in: keys } },
    select: { id: true, key: true },
  });
  const roleIds = roles.map((r) => r.id);
  if (roleIds.length === 0) return [];

  const roleKeyById = Object.fromEntries(roles.map((r) => [r.id, r.key]));

  const userRoles = await prisma.userRole.findMany({
    where: { roleId: { in: roleIds } },
    select: {
      roleId: true,
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          isActive: true,
        },
      },
    },
  });

  // RPERM-04: tenant membership is the canonical source of a user's tenant
  // scope — never the legacy User.tenantId column. When ctx.tenantId is set,
  // restrict results to users holding an active TenantMembership for it.
  let allowedUserIds: Set<string> | null = null;
  if (ctx.tenantId) {
    const candidateUserIds = Array.from(new Set(userRoles.map((ur) => ur.user.id)));
    const memberships = await prisma.tenantMembership.findMany({
      where: { tenantId: ctx.tenantId, userId: { in: candidateUserIds }, isActive: true },
      select: { userId: true },
    });
    allowedUserIds = new Set(memberships.map((m) => m.userId));
  }

  const results: MemberEntry[] = [];
  for (const ur of userRoles) {
    if (!ur.user.isActive) continue;
    if (allowedUserIds && !allowedUserIds.has(ur.user.id)) continue;
    results.push({
      _key: `user:${ur.user.id}`,
      userId: ur.user.id,
      personId: null,
      roleKey: roleKeyById[ur.roleId],
      displayName: `${ur.user.firstName} ${ur.user.lastName}`,
      email: ur.user.email,
      memberType: "user",
      viaRoleKeys: [roleKeyById[ur.roleId]],
    });
  }
  return results;
}

async function resolveTeamIds(ids: string[]): Promise<MemberEntry[]> {
  if (ids.length === 0) return [];

  // Get active team seasons for the given teams
  const teamSeasons = await prisma.teamSeason.findMany({
    where: {
      teamId: { in: ids },
      status: "ACTIVE",
    },
    select: {
      id: true,
      teamId: true,
      playerSquadMembers: {
        where: { status: "ACTIVE" },
        select: {
          person: {
            select: { id: true, firstName: true, lastName: true, displayName: true, email: true, isActive: true },
          },
        },
      },
      trainerTeamMembers: {
        where: { status: "ACTIVE" },
        select: {
          person: {
            select: { id: true, firstName: true, lastName: true, displayName: true, email: true, isActive: true },
          },
        },
      },
    },
  });

  const results: MemberEntry[] = [];
  for (const ts of teamSeasons) {
    for (const sq of ts.playerSquadMembers) {
      if (!sq.person.isActive) continue;
      results.push({
        _key: `person:${sq.person.id}`,
        userId: null,
        personId: sq.person.id,
        roleKey: null,
        displayName: sq.person.displayName ?? `${sq.person.firstName} ${sq.person.lastName}`,
        email: sq.person.email,
        memberType: "person",
        viaTeamIds: [ts.teamId],
      });
    }
    for (const tr of ts.trainerTeamMembers) {
      if (!tr.person.isActive) continue;
      results.push({
        _key: `person:${tr.person.id}`,
        userId: null,
        personId: tr.person.id,
        roleKey: null,
        displayName: tr.person.displayName ?? `${tr.person.firstName} ${tr.person.lastName}`,
        email: tr.person.email,
        memberType: "person",
        viaTeamIds: [ts.teamId],
      });
    }
  }
  return results;
}
