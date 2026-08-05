import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { createEffectivePermissionResolver } from "@/lib/permissions/services/effective-permission-resolver";
import type { PermissionKey } from "@/lib/permissions/permissions";

/**
 * RPERM-04 — Authoritative "any of" API permission gate.
 *
 * See requirePermission() (lib/permissions/require-permission.ts) for the
 * full resolution model. `tenantId` defaults to the session's
 * `activeTenantId`.
 */
export async function requireApiAnyPermission(permissionKeys: PermissionKey[], tenantId?: string) {
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
