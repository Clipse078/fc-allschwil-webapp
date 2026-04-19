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
    const roleIds: string[] = Array.isArray(body.roleIds)
      ? body.roleIds
          .map((value: unknown) => String(value).trim())
          .filter((value: string) => Boolean(value))
      : [];

    if (!firstName || !lastName || !email) {
      return NextResponse.json(
        { error: "Vorname, Nachname und E-Mail sind erforderlich." },
        { status: 400 }
      );
    }

    if (roleIds.length === 0) {
      return NextResponse.json(
        { error: "Vor dem Erstellen muss mindestens eine Rolle zugewiesen werden." },
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

    const validRoles = await prisma.role.findMany({
      where: {
        id: {
          in: roleIds,
        },
      },
      select: {
        id: true,
      },
    });

    if (validRoles.length !== roleIds.length) {
      return NextResponse.json(
        { error: "Mindestens eine ausgewählte Rolle ist ungültig." },
        { status: 400 }
      );
    }

    const placeholderPasswordHash = await hashPassword(crypto.randomUUID() + "-invite-only");

    const actorUserId =
      access.session?.user?.effectiveUserId ??
      access.session?.user?.id ??
      null;

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
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

      if (roleIds.length > 0) {
        await tx.userRole.createMany({
          data: roleIds.map((roleId) => ({
            userId: user.id,
            roleId,
          })),
        });
      }

      return user;
    });

    await logAction({
      actorUserId,
      moduleKey: "users",
      entityType: "User",
      entityId: result.id,
      action: "CREATE",
      afterJson: {
        firstName: result.firstName,
        lastName: result.lastName,
        email: result.email,
        isActive: result.isActive,
        accessState: result.accessState,
        roleIds,
      },
    });

    return NextResponse.json(
      {
        id: result.id,
        message: "Benutzer erfolgreich erstellt. Rollen sind bereits zugewiesen, Einladung kann jetzt gesendet werden.",
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