import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { createEffectivePermissionResolver } from "@/lib/permissions/services/effective-permission-resolver";
import type { PermissionKey } from "@/lib/permissions/permissions";

/**
 * RPERM-04 — Authoritative "any of" permission gate.
 *
 * See requirePermission() for the resolution model. Grants access when the
 * user holds at least one of `permissionKeys` in either the platform or the
 * tenant (`tenantId` ?? session.activeTenantId) bucket.
 */
export async function requireAnyPermission(permissionKeys: PermissionKey[], tenantId?: string) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
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
    redirect("/dashboard");
  }

  return session;
}
