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
  const effectiveUserId = session.user.effectiveUserId ?? session.user.id;
  if (!effectiveUserId) {
    return {
      ok: false as const,
      status: 403,
      error: "Forbidden",
      session,
    };
  }

  const [liveSubject, liveMembership] = await Promise.all([
    prisma.user.findUnique({
      where: { id: effectiveUserId },
      select: { isActive: true },
    }),
    effectiveTenantId
      ? prisma.tenantMembership.findFirst({
          where: {
            tenantId: effectiveTenantId,
            userId: effectiveUserId,
            isActive: true,
            tenant: { status: "ACTIVE" },
          },
          select: { id: true },
        })
      : Promise.resolve(null),
  ]);
  if (!liveSubject?.isActive || (effectiveTenantId && !liveMembership)) {
    return {
      ok: false as const,
      status: 403,
      error: "Forbidden",
      session,
    };
  }

  const resolver = createEffectivePermissionResolver(prisma);
  const { platform, tenant } = await resolver.getEffectivePermissions({
    userId: effectiveUserId,
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
