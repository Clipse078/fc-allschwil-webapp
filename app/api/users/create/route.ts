import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { hashPassword } from "@/lib/auth/password";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { requirePlatformApiPermission } from "@/lib/permissions/require-platform-api-permission";
import { writeAuditRecord } from "@/lib/audit/audit-record";

export async function POST(request: NextRequest) {
  const access = await requirePlatformApiPermission(PERMISSIONS.USERS_MANAGE);

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

    const passwordHash = await hashPassword(password);

    // RPERM-04: a new user is provisioned into the creating admin's active
    // tenant via a TenantMembership row — never via the legacy User.tenantId
    // column, which is no longer written for new users.
    const activeTenantId = access.session.user.activeTenantId;

    const user = await prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          firstName,
          lastName,
          email,
          passwordHash,
          isActive: true,
        },
      });

      if (activeTenantId) {
        await tx.tenantMembership.create({
          data: {
            tenantId: activeTenantId,
            userId: createdUser.id,
            isActive: true,
          },
        });
      }

      await writeAuditRecord(tx, {
        tenantId: null,
        actorUserId: access.actorUserId,
        moduleKey: "users",
        entityType: "User",
        entityId: createdUser.id,
        action: "PLATFORM_USER_CREATED",
        afterJson: {
          isActive: true,
          tenantMembershipProvisioned: Boolean(activeTenantId),
          tenantId: activeTenantId,
        },
      });

      return createdUser;
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