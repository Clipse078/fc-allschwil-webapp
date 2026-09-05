import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { createEffectivePermissionResolver } from "@/lib/permissions/services/effective-permission-resolver";
import type { PermissionKey } from "@/lib/permissions/permissions";

/**
 * RPERM-04 — Authoritative API permission gate.
 *
 * See requirePermission() (lib/permissions/require-permission.ts) for the
 * full resolution model. `tenantId` defaults to the session's
 * `activeTenantId`; pass an explicit value only to check a permission in a
 * tenant other than the caller's active one.
 */
export async function requireApiPermission(permissionKey: PermissionKey, tenantId?: string) {
  const session = await auth();

  if (!session?.user) {
    return {
      ok: false as const,
      status: 401,
      error: "Unauthorized",
      session: null,
    };
  }

  const effectiveTenantId = tenantId ?? session.user.activeTenantId ?? undefined;
  const effectiveUserId = session.user.effectiveUserId ?? session.user.id;

  const resolver = createEffectivePermissionResolver(prisma);
  const { platform, tenant } = await resolver.getEffectivePermissions({
    userId: effectiveUserId,
    tenantId: effectiveTenantId,
  });

  const allowed = platform.includes(permissionKey) || tenant.includes(permissionKey);

  if (!allowed) {
    return {
      ok: false as const,
      status: 403,
      error: "Forbidden",
      session,
    };
  }

  return {
    ok: true as const,
    status: 200,
    error: null,
    session,
  };
}
