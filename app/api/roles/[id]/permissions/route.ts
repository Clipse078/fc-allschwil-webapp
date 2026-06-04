/**
 * /api/roles/[id]/permissions — read/write role–permission assignments.
 *
 * GET  → returns { permissionKeys: string[] } currently assigned to the role
 * PUT  → bulk-replace all RolePermission rows for this role
 *        body: { permissionKeys: string[] }
 *        Transaction: deleteMany + createMany for valid, active keys.
 *
 * Permission: USERS_MANAGE (role administration)
 *
 * Design:
 * - Tenant isolation is implicit: Role and Permission rows are platform-global
 *   (not tenant-scoped in the current schema). This matches existing behavior.
 * - super_admin lockout guard: refuses to remove users.manage from the
 *   super_admin role if it is the last role possessing that permission.
 * - Unknown permissionKeys are silently ignored (no error for stale client state).
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const access = await requireApiPermission(PERMISSIONS.USERS_MANAGE);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const { id } = await params;
  const role = await prisma.role.findUnique({
    where: { id },
    select: {
      rolePermissions: {
        select: { permission: { select: { key: true } } },
      },
    },
  });
  if (!role) return NextResponse.json({ error: "Rolle nicht gefunden." }, { status: 404 });

  return NextResponse.json({
    permissionKeys: role.rolePermissions.map((rp) => rp.permission.key),
  });
}

export async function PUT(req: NextRequest, { params }: RouteContext) {
  const access = await requireApiPermission(PERMISSIONS.USERS_MANAGE);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const { id } = await params;

  const role = await prisma.role.findUnique({
    where: { id },
    select: { id: true, key: true },
  });
  if (!role) return NextResponse.json({ error: "Rolle nicht gefunden." }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const rawKeys: unknown = body.permissionKeys;
  if (!Array.isArray(rawKeys)) {
    return NextResponse.json(
      { error: "permissionKeys muss ein Array sein." },
      { status: 400 },
    );
  }

  const requestedKeys: string[] = rawKeys
    .filter((k): k is string => typeof k === "string" && k.trim().length > 0)
    .map((k) => k.trim());

  // Super-admin lockout guard: refuse to remove users.manage from super_admin
  // if it would be the only role with that permission.
  if (role.key === "super_admin" && !requestedKeys.includes(PERMISSIONS.USERS_MANAGE)) {
    const otherRolesWithManage = await prisma.rolePermission.count({
      where: {
        permission: { key: PERMISSIONS.USERS_MANAGE },
        role: { key: { not: "super_admin" } },
      },
    });
    if (otherRolesWithManage === 0) {
      return NextResponse.json(
        {
          error:
            "users.manage kann nicht von super_admin entfernt werden — es wäre kein Benutzer mehr mit dieser Berechtigung vorhanden.",
        },
        { status: 409 },
      );
    }
  }

  // Resolve valid permission IDs for the requested keys.
  const validPerms = await prisma.permission.findMany({
    where: { key: { in: requestedKeys } },
    select: { id: true, key: true },
  });
  const validPermIds = validPerms.map((p) => p.id);

  // Bulk replace: delete all current assignments, create new ones.
  await prisma.$transaction([
    prisma.rolePermission.deleteMany({ where: { roleId: id } }),
    prisma.rolePermission.createMany({
      data: validPermIds.map((permissionId) => ({ roleId: id, permissionId })),
      skipDuplicates: true,
    }),
  ]);

  return NextResponse.json({
    permissionKeys: validPerms.map((p) => p.key),
  });
}
