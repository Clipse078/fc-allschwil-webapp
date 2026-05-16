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
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    isActive: user.isActive,
    roles: user.userRoles.map((userRole) => ({
      id: userRole.role.id,
      key: userRole.role.key,
      name: userRole.role.name,
    })),
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
    const isActive = Boolean(body.isActive);

    if (!firstName || !lastName || !email) {
      return NextResponse.json(
        { error: "Vorname, Nachname und E-Mail sind erforderlich." },
        { status: 400 }
      );
    }

    const existingUser = await prisma.user.findFirst({
      where: {
        email,
        NOT: {
          id: userId,
        },
      },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "Diese E-Mail ist bereits vergeben." },
        { status: 409 }
      );
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        firstName,
        lastName,
        email,
        isActive,
      },
    });

    return NextResponse.json({
      id: updatedUser.id,
      message: "Benutzer erfolgreich aktualisiert.",
    });
  } catch (error) {
    console.error("Update user failed:", error);

    return NextResponse.json(
      { error: "Benutzer konnte nicht aktualisiert werden." },
      { status: 500 }
    );
  }
}