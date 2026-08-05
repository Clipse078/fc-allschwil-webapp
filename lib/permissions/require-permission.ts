import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { createEffectivePermissionResolver } from "@/lib/permissions/services/effective-permission-resolver";
import type { PermissionKey } from "@/lib/permissions/permissions";

/**
 * RPERM-04 — Authoritative permission gate.
 *
 * Evaluates `(permission, tenant)` live against the RPERM-03
 * EffectivePermissionResolver — never against the cached session
 * `permissionKeys` array. This is the actual authorization boundary and must
 * reflect the current DB state (role/membership revocations, tenant scope),
 * not a JWT snapshot from sign-in time.
 *
 * `tenantId` defaults to the session's `activeTenantId` (the single
 * tenant-resolution model — see lib/auth/session-context.ts and
 * lib/tenants/active-tenant.ts). Pass an explicit `tenantId` only for the
 * rare case of checking a permission in a tenant other than the caller's
 * active one (e.g. future platform-support tooling).
 *
 * A permission is granted when it appears in EITHER the platform or the
 * tenant bucket returned by the resolver — mirroring the union semantics
 * dashboard code has always relied on, but now correctly scoped: a
 * PLATFORM-scoped role never satisfies a TENANT-scoped permission check
 * (and vice versa), and tenant grants are isolated to the exact tenant.
 */
export async function requirePermission(permissionKey: PermissionKey, tenantId?: string) {
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

  const allowed = platform.includes(permissionKey) || tenant.includes(permissionKey);

  if (!allowed) {
    redirect("/dashboard");
  }

  return session;
}
