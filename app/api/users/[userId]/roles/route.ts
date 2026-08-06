import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";

type RouteContext = {
  params: Promise<{
    userId: string;
  }>;
};

export async function GET(_: NextRequest, context: RouteContext) {
  const access = await requireApiPermission(PERMISSIONS.USERS_MANAGE);

  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const { userId } = await context.params;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      userRoles: {
        include: {
          role: true,
        },
      },
    },
  });

  if (!user) {
    return NextResponse.json({ error: "Benutzer nicht gefunden." }, { status: 404 });
  }

  return NextResponse.json({
    roleIds: user.userRoles.map((userRole) => userRole.roleId),
  });
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const access = await requireApiPermission(PERMISSIONS.USERS_MANAGE);

  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  try {
    const { userId } = await context.params;
    const body = await request.json();

    const roleIds = Array.isArray(body.roleIds)
      ? body.roleIds.map((value: unknown) => String(value))
      : [];

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: "Benutzer nicht gefunden." }, { status: 404 });
    }

    const roles = await prisma.role.findMany({
      where: {
        id: {
          in: roleIds,
        },
        isArchived: false,
        isTemplate: false,
      },
      select: {
        id: true,
        scope: true,
        tenantId: true,
      },
    });

    const validRoleIds = roles.map((role) => role.id);

    // RPERM-04: role assignment always creates a tenant-scoped UserRole (and
    // an active TenantMembership) for TENANT-scoped roles. PLATFORM-scoped
    // roles keep UserRole.tenantId = null. No more legacy paths — a user's
    // tenant access is only ever granted through TenantMembership.
    const tenantIdsNeedingMembership = Array.from(
      new Set(
        roles
          .filter((role) => role.scope === "TENANT" && role.tenantId)
          .map((role) => role.tenantId as string),
      ),
    );

    await prisma.$transaction(async (tx) => {
      await tx.userRole.deleteMany({ where: { userId } });

      for (const role of roles) {
        await tx.userRole.create({
          data: {
            userId,
            roleId: role.id,
            tenantId: role.scope === "TENANT" ? role.tenantId : null,
          },
        });
      }

      for (const tenantId of tenantIdsNeedingMembership) {
        await tx.tenantMembership.upsert({
          where: { tenantId_userId: { tenantId, userId } },
          update: { isActive: true },
          create: { tenantId, userId, isActive: true },
        });
      }
    });

    return NextResponse.json({
      message: "Rollen erfolgreich gespeichert.",
      roleIds: validRoleIds,
    });
  } catch (error) {
    console.error("Update user roles failed:", error);

    return NextResponse.json(
      { error: "Rollen konnten nicht gespeichert werden." },
      { status: 500 }
    );
  }
}
