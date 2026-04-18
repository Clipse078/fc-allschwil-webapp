import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db/prisma";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";

export async function POST(request: NextRequest) {
  const access = await requireApiPermission(PERMISSIONS.USERS_MANAGE);

  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  try {
    const body = await request.json();
    const firstName = String(body.firstName ?? "").trim();
    const lastName = String(body.lastName ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "").trim();

    if (!firstName || !lastName || !email || !password) {
      return NextResponse.json(
        { error: "Vorname, Nachname, E-Mail und Passwort sind erforderlich." },
        { status: 400 }
      );
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "Ein Benutzer mit dieser E-Mail existiert bereits." },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        firstName,
        lastName,
        email,
        passwordHash,
        isActive: true,
      },
    });

    return NextResponse.json(
      {
        id: user.id,
        message: "Benutzer erfolgreich erstellt.",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create user failed:", error);

    return NextResponse.json(
      { error: "Benutzer konnte nicht erstellt werden." },
      { status: 500 }
    );
  }
}