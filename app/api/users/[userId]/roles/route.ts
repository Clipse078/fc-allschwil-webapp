import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { logAction } from "@/lib/audit/log-action";

type RouteContext = {
  params: Promise<{
    userId: string;
  }>;
};

export async function PUT(request: NextRequest, context: RouteContext) {
  const access = await requireApiPermission(PERMISSIONS.USERS_MANAGE);

  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  try {
    const { userId } = await context.params;
    const body = await request.json();
    const roleIds: string[] = Array.isArray(body.roleIds)
      ? body.roleIds
          .map((value: unknown) => String(value).trim())
          .filter((value: string) => Boolean(value))
      : [];

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        userRoles: {
          select: {
            roleId: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "Benutzer nicht gefunden." }, { status: 404 });
    }

    const validRoles = roleIds.length
      ? await prisma.role.findMany({
          where: {
            id: {
              in: roleIds,
            },
          },
          select: {
            id: true,
          },
        })
      : [];

    if (validRoles.length !== roleIds.length) {
      return NextResponse.json(
        { error: "Mindestens eine ausgewählte Rolle ist ungültig." },
        { status: 400 }
      );
    }

    await prisma.$transaction([
      prisma.userRole.deleteMany({
        where: {
          userId,
        },
      }),
      ...(roleIds.length > 0
        ? roleIds.map((roleId) =>
            prisma.userRole.create({
              data: {
                userId,
                roleId,
              },
            })
          )
        : []),
    ]);

    const actorUserId =
      access.session?.user?.effectiveUserId ??
      access.session?.user?.id ??
      null;

    await logAction({
      actorUserId,
      moduleKey: "users",
      entityType: "UserRole",
      entityId: userId,
      action: "UPDATE",
      beforeJson: {
        roleIds: user.userRoles.map((item) => item.roleId),
      },
      afterJson: {
        roleIds,
      },
    });

    return NextResponse.json({
      message: "Rollen erfolgreich gespeichert.",
      roleIds,
    });
  } catch (error) {
    console.error("Update user roles failed:", error);

    if (error instanceof Error) {
      return NextResponse.json(
        { error: "Rollen konnten nicht gespeichert werden: " + error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: "Rollen konnten nicht gespeichert werden." },
      { status: 500 }
    );
  }
}