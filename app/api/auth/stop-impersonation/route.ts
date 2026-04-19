import { NextResponse } from "next/server";
import { auth, unstable_update } from "@/auth";
import { prisma } from "@/lib/db/prisma";

export async function POST() {
  const session = await auth();

  if (!session?.user || !session.user.isImpersonating || !session.user.actorUserId) {
    return NextResponse.json(
      { error: "Keine aktive Impersonation gefunden." },
      { status: 400 }
    );
  }

  const actorUser = await prisma.user.findUnique({
    where: { id: session.user.actorUserId },
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

  if (!actorUser || !actorUser.isActive) {
    return NextResponse.json(
      { error: "Originaler Admin nicht gefunden oder inaktiv." },
      { status: 404 }
    );
  }

  const roleKeys = Array.from(new Set(actorUser.userRoles.map((userRole) => userRole.role.key)));
  const permissionKeys = Array.from(
    new Set(
      actorUser.userRoles.flatMap((userRole) =>
        userRole.role.rolePermissions.map((rolePermission) => rolePermission.permission.key)
      )
    )
  );

  await unstable_update({
    user: {
      id: actorUser.id,
      email: actorUser.email,
      firstName: actorUser.firstName,
      lastName: actorUser.lastName,
      roleKeys,
      permissionKeys,
      isImpersonating: false,
      actorUserId: undefined,
      actorEmail: undefined,
      actorName: undefined,
      effectiveUserId: actorUser.id,
    },
  });

  return NextResponse.json({
    message: "Impersonation beendet.",
  });
}