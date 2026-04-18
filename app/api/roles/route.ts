import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";

export async function GET() {
  const access = await requireApiPermission(PERMISSIONS.USERS_MANAGE);

  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const roles = await prisma.role.findMany({
    orderBy: { name: "asc" },
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

  return NextResponse.json({ roles });
}

export async function POST(request: NextRequest) {
  const access = await requireApiPermission(PERMISSIONS.USERS_MANAGE);

  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  try {
    const body = await request.json();

    const key = String(body.key ?? "").trim();
    const name = String(body.name ?? "").trim();
    const description =
      body.description === null || body.description === undefined
        ? null
        : String(body.description).trim() || null;

    const canAccessVereinsleitung = Boolean(body.canAccessVereinsleitung);
    const canAttendVereinsleitungMeetings = Boolean(
      body.canAttendVereinsleitungMeetings,
    );

    if (!key) {
      return NextResponse.json({ error: "Key ist erforderlich." }, { status: 400 });
    }

    if (!name) {
      return NextResponse.json({ error: "Name ist erforderlich." }, { status: 400 });
    }

    const role = await prisma.role.create({
      data: {
        key,
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

    return NextResponse.json({ role }, { status: 201 });
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json(
        { error: "Technischer Fehler: " + error.message },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { error: "Rolle konnte nicht erstellt werden." },
      { status: 500 },
    );
  }
}
