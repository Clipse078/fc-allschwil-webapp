import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { requirePlatformApiPermission } from "@/lib/permissions/require-platform-api-permission";

export async function GET(request: NextRequest) {
  const platformScope =
    request.nextUrl.searchParams.get("scope") === "platform";

  if (platformScope) {
    const platformAccess = await requirePlatformApiPermission(
      PERMISSIONS.USERS_MANAGE,
    );
    if (!platformAccess.ok) {
      return NextResponse.json(
        { error: platformAccess.error },
        { status: platformAccess.status },
      );
    }

    return listAuditLogs(null);
  }

  const access = await requireApiPermission(PERMISSIONS.USERS_MANAGE);

  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantId = access.session.user.activeTenantId;
  if (!tenantId) {
    const platformAccess = await requirePlatformApiPermission(
      PERMISSIONS.USERS_MANAGE,
    );
    if (!platformAccess.ok) {
      return NextResponse.json(
        { error: platformAccess.error },
        { status: platformAccess.status },
      );
    }
    return listAuditLogs(null);
  }

  return listAuditLogs(tenantId);
}

async function listAuditLogs(tenantId: string | null) {
  const logs = await prisma.auditLog.findMany({
    where: { tenantId },
    orderBy: {
      createdAt: "desc",
    },
    take: 100,
    select: {
      id: true,
      moduleKey: true,
      entityType: true,
      entityId: true,
      action: true,
      createdAt: true,
      actorUser: {
        select: {
          firstName: true,
          lastName: true,
          email: true,
        },
      },
    },
  });

  const formatted = logs.map((log) => ({
    id: log.id,
    moduleKey: log.moduleKey,
    entityType: log.entityType,
    entityId: log.entityId,
    action: log.action,
    createdAt: log.createdAt,
    actorName:
      log.actorUser
        ? (log.actorUser.firstName + " " + log.actorUser.lastName).trim()
        : null,
    actorEmail: log.actorUser?.email ?? null,
  }));

  return NextResponse.json(formatted);
}