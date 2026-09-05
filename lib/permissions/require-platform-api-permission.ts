import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import type { PermissionKey } from "@/lib/permissions/permissions";
import { createEffectivePermissionResolver } from "@/lib/permissions/services/effective-permission-resolver";

/**
 * Live platform-only authorization for privileged account administration.
 *
 * Platform lifecycle operations never use tenant permissions or an
 * impersonated effective identity. The authenticated actor must be active and
 * must currently hold the requested PLATFORM permission.
 */
export async function requirePlatformApiPermission(permissionKey: PermissionKey) {
  const session = await auth();

  if (!session?.user) {
    return {
      ok: false as const,
      status: 401,
      error: "Unauthorized",
      session: null,
      actorUserId: null,
    };
  }

  if (session.user.isImpersonating) {
    return {
      ok: false as const,
      status: 403,
      error: "Forbidden",
      session,
      actorUserId: null,
    };
  }

  const actorUserId = session.user.actorUserId ?? session.user.id;
  if (!actorUserId || session.user.effectiveUserId !== actorUserId) {
    return {
      ok: false as const,
      status: 403,
      error: "Forbidden",
      session,
      actorUserId: null,
    };
  }

  const actor = await prisma.user.findUnique({
    where: { id: actorUserId },
    select: { isActive: true },
  });
  if (!actor?.isActive) {
    return {
      ok: false as const,
      status: 403,
      error: "Forbidden",
      session,
      actorUserId: null,
    };
  }

  const resolver = createEffectivePermissionResolver(prisma);
  const allowed = await resolver.hasPermission({
    userId: actorUserId,
    permission: permissionKey,
  });

  if (!allowed) {
    return {
      ok: false as const,
      status: 403,
      error: "Forbidden",
      session,
      actorUserId: null,
    };
  }

  return {
    ok: true as const,
    status: 200,
    error: null,
    session,
    actorUserId,
  };
}
