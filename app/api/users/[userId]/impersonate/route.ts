import { NextResponse } from "next/server";
import { auth, unstable_update } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { logAction } from "@/lib/audit/log-action";

type RouteContext = {
  params: Promise<{
    userId: string;
  }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const access = await requireApiPermission(PERMISSIONS.USERS_IMPERSONATE);

  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const currentSession = await auth();

  if (!currentSession?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { userId } = await context.params;

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
      { error: "Zielbenutzer nicht gefunden oder inaktiv." },
      { status: 404 }
    );
  }

  const actorUserId =
    currentSession.user.effectiveUserId ??
    currentSession.user.id;

  if (actorUserId === targetUser.id) {
    return NextResponse.json(
      { error: "Impersonation des aktuellen Benutzers ist nicht nötig." },
      { status: 400 }
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

  const actorName = [currentSession.user.firstName, currentSession.user.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();

  await unstable_update({
    user: {
      id: targetUser.id,
      email: targetUser.email,
      firstName: targetUser.firstName,
      lastName: targetUser.lastName,
      roleKeys,
      permissionKeys,
      isImpersonating: true,
      actorUserId,
      actorEmail: currentSession.user.email,
      actorName,
      effectiveUserId: targetUser.id,
    },
  });

  await logAction({
    actorUserId,
    moduleKey: "users",
    entityType: "UserImpersonation",
    entityId: targetUser.id,
    action: "START",
    afterJson: {
      targetUserId: targetUser.id,
      targetEmail: targetUser.email,
    },
  });

  return NextResponse.json({
    message: "Impersonation gestartet.",
  });
}
