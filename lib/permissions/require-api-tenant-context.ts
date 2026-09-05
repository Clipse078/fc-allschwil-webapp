import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import type { PermissionKey } from "@/lib/permissions/permissions";
import { createEffectivePermissionResolver } from "@/lib/permissions/services/effective-permission-resolver";

export type ApiTenantPermissionContext = {
  tenantId: string;
  actorUserId: string;
};

export type ApiTenantPermissionContextResult =
  | { ok: true; context: ApiTenantPermissionContext }
  | { ok: false; status: 401 | 403; error: string };

/**
 * Resolves the effective actor, verifies their live active membership in the
 * session-selected tenant, then evaluates the requested permissions there.
 * Platform permissions alone never bypass the tenant-membership gate.
 */
export async function requireApiTenantPermissionContext(
  permissionKeys: readonly PermissionKey[],
): Promise<ApiTenantPermissionContextResult> {
  const session = await auth();
  if (!session?.user) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }

  const tenantId = session.user.activeTenantId;
  const actorUserId = session.user.effectiveUserId ?? session.user.id;
  if (!tenantId || !actorUserId) {
    return { ok: false, status: 403, error: "Forbidden" };
  }

  const membership = await prisma.tenantMembership.findFirst({
    where: {
      tenantId,
      userId: actorUserId,
      isActive: true,
      tenant: { status: "ACTIVE" },
      user: { isActive: true },
    },
    select: { id: true },
  });
  if (!membership) {
    return { ok: false, status: 403, error: "Forbidden" };
  }

  const resolver = createEffectivePermissionResolver(prisma);
  const { platform, tenant } = await resolver.getEffectivePermissions({
    userId: actorUserId,
    tenantId,
  });
  const allowed = permissionKeys.some(
    (permission) => platform.includes(permission) || tenant.includes(permission),
  );
  if (!allowed) {
    return { ok: false, status: 403, error: "Forbidden" };
  }

  return { ok: true, context: { tenantId, actorUserId } };
}
