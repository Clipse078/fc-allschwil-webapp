import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { hashPassword } from "@/lib/auth/password";
import { prisma } from "@/lib/db/prisma";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { logAction } from "@/lib/audit/log-action";

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

    if (!firstName || !lastName || !email) {
      return NextResponse.json(
        { error: "Vorname, Nachname und E-Mail sind erforderlich." },
        { status: 400 }
      );
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "Ein Benutzer mit dieser E-Mail existiert bereits." },
        { status: 409 }
      );
    }

    const placeholderPasswordHash = await hashPassword(crypto.randomUUID() + "-invite-only");

    const actorUserId =
      access.session?.user?.effectiveUserId ??
      access.session?.user?.id ??
      null;

    const user = await prisma.user.create({
      data: {
        firstName,
        lastName,
        email,
        passwordHash: placeholderPasswordHash,
        isActive: true,
        accessState: "PENDING_INVITE",
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

    await logAction({
      actorUserId,
      moduleKey: "users",
      entityType: "User",
      entityId: user.id,
      action: "CREATE",
      afterJson: {
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        isActive: user.isActive,
        accessState: user.accessState,
      },
    });

    return NextResponse.json(
      {
        id: user.id,
        message: "Benutzer erfolgreich erstellt. Weise jetzt mindestens eine Rolle zu und sende danach die Einladung.",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create user failed:", error);

    if (error instanceof Error) {
      return NextResponse.json(
        { error: "Benutzer konnte nicht erstellt werden: " + error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: "Benutzer konnte nicht erstellt werden." },
      { status: 500 }
    );
  }
}
