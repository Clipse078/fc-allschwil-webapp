import { NextResponse } from "next/server";
import { requireApiTenantPermissionContext } from "@/lib/permissions/require-api-tenant-context";
import type { PermissionKey } from "@/lib/permissions/permissions";
import { getActorContext } from "@/lib/visibility/get-actor-context";
import type { ActorContext } from "@/lib/visibility/actor-context";
import { prisma } from "@/lib/db/prisma";
import { createEffectivePermissionResolver } from "@/lib/permissions/services/effective-permission-resolver";

export type StrategicApiContext = {
  tenantId: string;
  actorUserId: string;
  actor: ActorContext;
};

export type StrategicApiContextResult =
  | { ok: true; context: StrategicApiContext }
  | { ok: false; response: NextResponse };

export async function resolveLiveTenantActor(
  tenantId: string,
  actorUserId: string,
): Promise<ActorContext | null> {
  const membership = await prisma.tenantMembership.findFirst({
    where: {
      tenantId,
      userId: actorUserId,
      isActive: true,
      user: { isActive: true },
      tenant: { status: "ACTIVE" },
    },
    select: { id: true },
  });
  if (!membership) return null;

  const [effective, assignments] = await Promise.all([
    createEffectivePermissionResolver(prisma).getEffectivePermissions({
      userId: actorUserId,
      tenantId,
    }),
    prisma.userRole.findMany({
      where: {
        userId: actorUserId,
        tenantId,
        role: { scope: "TENANT", tenantId, isArchived: false },
      },
      select: { role: { select: { key: true } } },
    }),
  ]);

  return getActorContext(
    {
      id: actorUserId,
      roleKeys: assignments.map((assignment) => assignment.role.key),
      permissionKeys: [...effective.platform, ...effective.tenant],
    },
    tenantId,
  );
}

export async function requireStrategicApiContext(
  permissions: readonly PermissionKey[],
): Promise<StrategicApiContextResult> {
  const access = await requireApiTenantPermissionContext(permissions);
  if (!access.ok) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: access.error },
        { status: access.status },
      ),
    };
  }

  const { tenantId, actorUserId, roleKeys, permissionKeys } = access.context;
  const actor = await getActorContext(
    { id: actorUserId, roleKeys, permissionKeys },
    tenantId,
  );

  return { ok: true, context: { tenantId, actorUserId, actor } };
}
