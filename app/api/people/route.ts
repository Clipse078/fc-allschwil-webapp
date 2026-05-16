import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireApiAnyPermission } from "@/lib/permissions/require-api-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";

export async function POST(request: NextRequest) {
  const access = await requireApiAnyPermission([
    PERMISSIONS.PEOPLE_MANAGE,
    PERMISSIONS.TEAMS_MANAGE,
  ]);

  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  try {
    const body = await request.json();

    const firstName = String(body.firstName ?? "").trim();
    const lastName = String(body.lastName ?? "").trim();
    const dateOfBirthRaw = String(body.dateOfBirth ?? "").trim();

    if (!firstName || !lastName) {
      return NextResponse.json(
        { error: "Vorname und Nachname sind erforderlich." },
        { status: 400 }
      );
    }

    const dateOfBirth = dateOfBirthRaw ? new Date(dateOfBirthRaw) : null;

    if (dateOfBirthRaw && Number.isNaN(dateOfBirth?.getTime())) {
      return NextResponse.json(
        { error: "Ungueltiges Geburtsdatum." },
        { status: 400 }
      );
    }

    const person = await prisma.person.create({
      data: {
        firstName,
        lastName,
        dateOfBirth,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        displayName: true,
        email: true,
        phone: true,
        dateOfBirth: true,
      },
    });

    return NextResponse.json(
      {
        message: "Person erfolgreich erstellt.",
        person,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create person failed:", error);

    if (error instanceof Error) {
      return NextResponse.json(
        { error: "Technischer Fehler: " + error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: "Person konnte nicht erstellt werden." },
      { status: 500 }
    );
  }
}
