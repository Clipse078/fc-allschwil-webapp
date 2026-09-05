import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requirePlatformApiPermission } from "@/lib/permissions/require-platform-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { writeAuditRecord } from "@/lib/audit/log-action";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  const access = await requirePlatformApiPermission(PERMISSIONS.USERS_MANAGE);

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

    // RPERM-05: PLATFORM-scope guard — a tenant-owned role id can never be
    // mutated through this platform-only endpoint. 404 (not 403) so this
    // route cannot be used to probe whether a given id belongs to a tenant
    // role.
    const existingRole = await prisma.role.findFirst({
      where: { id, scope: "PLATFORM" },
      select: {
        id: true,
        name: true,
        canAccessVereinsleitung: true,
        canAttendVereinsleitungMeetings: true,
      },
    });

    if (!existingRole) {
      return NextResponse.json({ error: "Rolle nicht gefunden." }, { status: 404 });
    }

    const role = await prisma.$transaction(async (tx) => {
      const updated = await tx.role.update({
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
      await writeAuditRecord(tx, {
        tenantId: null,
        actorUserId: access.actorUserId,
        moduleKey: "roles",
        entityType: "Role",
        entityId: updated.id,
        action: "PLATFORM_ROLE_UPDATE",
        beforeJson: {
          name: existingRole.name,
          canAccessVereinsleitung: existingRole.canAccessVereinsleitung,
          canAttendVereinsleitungMeetings:
            existingRole.canAttendVereinsleitungMeetings,
        },
        afterJson: {
          name: updated.name,
          canAccessVereinsleitung: updated.canAccessVereinsleitung,
          canAttendVereinsleitungMeetings:
            updated.canAttendVereinsleitungMeetings,
        },
      });
      return updated;
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
