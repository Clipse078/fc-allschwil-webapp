import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  const access = await requireApiPermission(PERMISSIONS.USERS_MANAGE);

  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const { id } = await context.params;

  try {
    const body = await request.json();

    const name = String(body.name ?? "").trim();
    const description =
      body.description === null || body.description === undefined
        ? null
        : String(body.description).trim() || null;

    const canAccessVereinsleitung = Boolean(body.canAccessVereinsleitung);
    const canAttendVereinsleitungMeetings = Boolean(
      body.canAttendVereinsleitungMeetings,
    );

    if (!name) {
      return NextResponse.json({ error: "Name ist erforderlich." }, { status: 400 });
    }

    const existingRole = await prisma.role.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existingRole) {
      return NextResponse.json({ error: "Rolle nicht gefunden." }, { status: 404 });
    }

    const role = await prisma.role.update({
      where: { id },
      data: {
        name,
        description,
        canAccessVereinsleitung,
        canAttendVereinsleitungMeetings,
      },
      select: {
        id: true,
        key: true,
        name: true,
        description: true,
        canAccessVereinsleitung: true,
        canAttendVereinsleitungMeetings: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ role });
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json(
        { error: "Technischer Fehler: " + error.message },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { error: "Rolle konnte nicht gespeichert werden." },
      { status: 500 },
    );
  }
}
