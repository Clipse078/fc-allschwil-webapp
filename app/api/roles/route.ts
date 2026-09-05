import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requirePlatformApiPermission } from "@/lib/permissions/require-platform-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { writeAuditRecord } from "@/lib/audit/log-action";

export async function GET() {
  const access = await requirePlatformApiPermission(PERMISSIONS.USERS_MANAGE);

  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  // RPERM-05: PLATFORM-scope guard — tenant roles are managed exclusively
  // through /api/tenant/roles.
  const roles = await prisma.role.findMany({
    where: { scope: "PLATFORM" },
    orderBy: { name: "asc" },
    select: {
      id: true,
      key: true,
      name: true,
      description: true,
      canAccessVereinsleitung: true,
      canAttendVereinsleitungMeetings: true,
      updatedAt: true,
      _count: {
        select: {
          userRoles: true,
          rolePermissions: true,
        },
      },
    },
  });

  return NextResponse.json({
    roles: roles.map((role) => ({
      id: role.id,
      key: role.key,
      name: role.name,
      description: role.description,
      canAccessVereinsleitung: role.canAccessVereinsleitung,
      canAttendVereinsleitungMeetings: role.canAttendVereinsleitungMeetings,
      updatedAt: role.updatedAt,
      userCount: role._count.userRoles,
      permissionCount: role._count.rolePermissions,
    })),
  });
}

export async function POST(request: NextRequest) {
  const access = await requirePlatformApiPermission(PERMISSIONS.USERS_MANAGE);

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

    // RPERM-05: scope is always forced to PLATFORM here — this endpoint
    // never accepts a scope/tenantId from the request body. Tenant custom
    // roles are created exclusively through POST /api/tenant/roles.
    const role = await prisma.$transaction(async (tx) => {
      const created = await tx.role.create({
        data: {
          key,
          name,
          description,
          canAccessVereinsleitung,
          canAttendVereinsleitungMeetings,
          scope: "PLATFORM",
          isSystem: false,
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
        entityId: created.id,
        action: "PLATFORM_ROLE_CREATE",
        afterJson: { key: created.key },
      });
      return created;
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
