import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { auth, unstable_update } from "@/auth";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";

type RouteContext = {
  params: Promise<{
    userId: string;
  }>;
};

export async function POST(_: NextRequest, context: RouteContext) {
  const access = await requireApiPermission(PERMISSIONS.USERS_IMPERSONATE);

  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { userId } = await context.params;

  if (session.user.effectiveUserId === userId) {
    return NextResponse.json(
      { error: "Dieser Benutzer ist bereits aktiv." },
      { status: 400 }
    );
  }

  const targetUser = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      userRoles: {
        include: {
          role: {
            include: {
              rolePermissions: {
                include: {
                  permission: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!targetUser || !targetUser.isActive) {
    return NextResponse.json(
      { error: "Benutzer nicht gefunden oder inaktiv." },
      { status: 404 }
    );
  }

  const roleKeys = Array.from(new Set(targetUser.userRoles.map((userRole) => userRole.role.key)));
  const permissionKeys = Array.from(
    new Set(
      targetUser.userRoles.flatMap((userRole) =>
        userRole.role.rolePermissions.map((rolePermission) => rolePermission.permission.key)
      )
    )
  );

  const actorName =
    (session.user.firstName + " " + session.user.lastName).trim() || session.user.email;

  await unstable_update({
    user: {
      id: targetUser.id,
      email: targetUser.email,
      firstName: targetUser.firstName,
      lastName: targetUser.lastName,
      roleKeys,
      permissionKeys,
      isImpersonating: true,
      actorUserId: session.user.actorUserId ?? session.user.id,
      actorEmail: session.user.actorEmail ?? session.user.email,
      actorName: session.user.actorName ?? actorName,
      effectiveUserId: targetUser.id,
    },
  });

  return NextResponse.json({
    message: "Impersonation gestartet.",
  });
}