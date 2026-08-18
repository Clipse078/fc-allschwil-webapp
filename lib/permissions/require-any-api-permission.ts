import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { createEffectivePermissionResolver } from "@/lib/permissions/services/effective-permission-resolver";
import type { PermissionKey } from "@/lib/permissions/permissions";

/**
 * RPERM-04 — "Any of" authoritative API permission gate.
 *
 * Grants access when the user holds at least one of `permissionKeys`
 * in either the platform or the tenant (`tenantId` ?? session.activeTenantId) bucket.
 *
 * See requireApiPermission() for the single-key variant.
 */
export async function requireAnyApiPermission(
  permissionKeys: PermissionKey[],
  tenantId?: string,
) {
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

  const resolver = createEffectivePermissionResolver(prisma);
  const { platform, tenant } = await resolver.getEffectivePermissions({
    userId: session.user.id,
    tenantId: effectiveTenantId,
  });

  const allowed = permissionKeys.some(
    (key) => platform.includes(key) || tenant.includes(key),
  );

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
