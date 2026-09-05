/**
 * getActorContext — async actor factory that hydrates orgUnitIds and targetGroupIds from DB.
 *
 * Use this instead of buildActorContext() in any server component or route
 * handler that runs visibility-filtered queries or centralized guards.
 * The orgUnitIds are required to evaluate visibleOrgUnitRefs on RESTRICTED
 * entities. The targetGroupIds are required to evaluate visibleTargetGroupRefs
 * (Phase D).
 *
 * Pattern:
 *   const actor = await getActorContext(session.user, tenant.id);
 *   // or inside an API route:
 *   const actor = await getActorContext(check.session.user, tenant.id);
 *
 * Backwards-compatible: if the user has no memberships, orgUnitIds and
 * targetGroupIds default to [] — no false-positive visibility grants.
 *
 * DB-resilient: if tables do not yet exist (pre-migration STAGE), queries are
 * caught and fall back to [] rather than crashing the request.
 *
 * Slice 11.2: tenantId parameter added. When provided, loadOrgUnitIds filters
 * memberships to the given tenant, preventing cross-tenant membership data
 * from entering ActorContext.
 *
 * Phase D: targetGroupIds now loaded in parallel with orgUnitIds. Both use
 * the same tenant scope for consistency.
 *
 * TODO: replace the DB queries with JWT-cached values once membership is
 *   included in the session token. Until then, this is 2 extra DB queries
 *   per request on visibility-gated endpoints.
 * TODO: pass tenantId from all callers once the session carries it.
 */

import { buildActorContext } from "./actor-context";
import { loadOrgUnitIds, loadTargetGroupIds } from "@/lib/org/queries";
import { prisma } from "@/lib/db/prisma";
import { createEffectivePermissionResolver } from "@/lib/permissions/services/effective-permission-resolver";

type SessionUser = {
  id: string;
  roleKeys: string[];
  permissionKeys: string[];
};

/**
 * Build a fully-hydrated ActorContext, including orgUnitIds and targetGroupIds from DB.
 * Safe to call even if the user has no memberships — returns [] in each case.
 * Also safe when tables do not yet exist (falls back to []).
 *
 * Provide tenantId to restrict memberships to a single tenant (recommended).
 * Omitting tenantId loads all active memberships across tenants — acceptable
 * only as a backwards-compat fallback in single-tenant deployments.
 */
export async function getActorContext(user: SessionUser, tenantId?: string) {
  let orgUnitIds: string[] = [];
  let targetGroupIds: string[] = [];
  let roleKeys = user.roleKeys ?? [];
  let permissionKeys = user.permissionKeys ?? [];

  if (tenantId) {
    try {
      const membership = await prisma.tenantMembership.findFirst({
        where: {
          tenantId,
          userId: user.id,
          isActive: true,
          user: { isActive: true },
          tenant: { status: "ACTIVE" },
        },
        select: { id: true },
      });
      if (!membership) {
        return buildActorContext(
          { id: user.id, roleKeys: [], permissionKeys: [] },
          [],
          [],
        );
      }

      const [effective, assignments] = await Promise.all([
        createEffectivePermissionResolver(prisma).getEffectivePermissions({
          userId: user.id,
          tenantId,
        }),
        prisma.userRole.findMany({
          where: {
            userId: user.id,
            tenantId,
            role: { scope: "TENANT", tenantId, isArchived: false },
          },
          select: { role: { select: { key: true } } },
        }),
      ]);
      permissionKeys = [...effective.platform, ...effective.tenant];
      roleKeys = assignments.map((assignment) => assignment.role.key);
    } catch {
      return buildActorContext(
        { id: user.id, roleKeys: [], permissionKeys: [] },
        [],
        [],
      );
    }
  }

  try {
    [orgUnitIds, targetGroupIds] = await Promise.all([
      loadOrgUnitIds(user.id, tenantId),
      loadTargetGroupIds(user.id, tenantId),
    ]);
  } catch {
    // Tables may not yet exist (pre-migration environment).
    // [] is the documented safe default — no false-positive visibility grants.
  }

  return buildActorContext(
    { id: user.id, roleKeys, permissionKeys },
    orgUnitIds,
    targetGroupIds,
    tenantId,
  );
}
