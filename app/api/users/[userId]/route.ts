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

export async function GET(_request: NextRequest, context: RouteContext) {
  const access = await requireApiPermission(PERMISSIONS.USERS_MANAGE);

  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const { userId } = await context.params;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      isActive: true,
      accessState: true,
      invitedAt: true,
      inviteAcceptedAt: true,
      passwordSetAt: true,
      passwordResetSentAt: true,
      lastLoginAt: true,
      userRoles: {
        select: {
          role: {
            select: {
              id: true,
              key: true,
              name: true,
            },
          },
        },
      },
    },
  });

  if (!user) {
    return NextResponse.json({ error: "Benutzer nicht gefunden." }, { status: 404 });
  }

  return NextResponse.json({
    ...user,
    roleIds: user.userRoles.map((item) => item.role.id),
  });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const access = await requireApiPermission(PERMISSIONS.USERS_MANAGE);

  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  try {
    const { userId } = await context.params;
    const body = await request.json();

    const firstName = String(body.firstName ?? "").trim();
    const lastName = String(body.lastName ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const isActive =
      body.isActive === null || body.isActive === undefined
        ? true
        : Boolean(body.isActive);

    if (!firstName || !lastName || !email) {
      return NextResponse.json(
        { error: "Vorname, Nachname und E-Mail sind erforderlich." },
        { status: 400 }
      );
    }

    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        isActive: true,
        accessState: true,
      },
    });

    if (!existingUser) {
      return NextResponse.json({ error: "Benutzer nicht gefunden." }, { status: 404 });
    }

    const conflictingUser = await prisma.user.findFirst({
      where: {
        email,
        id: {
          not: userId,
        },
      },
      select: {
        id: true,
      },
    });

    if (conflictingUser) {
      return NextResponse.json(
        { error: "Ein anderer Benutzer mit dieser E-Mail existiert bereits." },
        { status: 409 }
      );
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        firstName,
        lastName,
        email,
        isActive,
        accessState: isActive ? undefined : "SUSPENDED",
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        isActive: true,
        accessState: true,
      },
    });

    const actorUserId =
      access.session?.user?.effectiveUserId ??
      access.session?.user?.id ??
      null;

    await logAction({
      actorUserId,
      moduleKey: "users",
      entityType: "User",
      entityId: updated.id,
      action: "UPDATE",
      beforeJson: existingUser,
      afterJson: updated,
    });

    return NextResponse.json({
      message: "Benutzer erfolgreich gespeichert.",
      user: updated,
    });
  } catch (error) {
    console.error("Update user failed:", error);

    if (error instanceof Error) {
      return NextResponse.json(
        { error: "Benutzer konnte nicht gespeichert werden: " + error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: "Benutzer konnte nicht gespeichert werden." },
      { status: 500 }
    );
  }
}
