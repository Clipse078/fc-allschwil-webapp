/**
 * /api/roles/[id]/permissions — read/write role–permission assignments.
 *
 * GET  → returns { permissionKeys: string[] } currently assigned to the role
 * PUT  → bulk-replace all RolePermission rows for this role
 *        body: { permissionKeys: string[] }
 *        Delegates to setPlatformRolePermissions() (RPERM-05-C1), which
 *        re-validates every key as scope=PLATFORM server-side and rejects
 *        the whole batch (no partial persist) if any key is TENANT-scoped.
 *
 * Permission: USERS_MANAGE (role administration)
 *
 * Design:
 * - Tenant isolation is implicit: Role and Permission rows are platform-global
 *   (not tenant-scoped in the current schema). This matches existing behavior.
 * - super_admin lockout guard: refuses to remove users.manage from the
 *   super_admin role if it is the last role possessing that permission.
 * - Unknown permissionKeys are silently ignored (no error for stale client
 *   state) — but a *known* TENANT-scoped key is a hard, atomic rejection.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requirePlatformApiPermission } from "@/lib/permissions/require-platform-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { setPlatformRolePermissions } from "@/lib/roles/platform-mutations";
import { toRoleApiErrorResponse } from "@/lib/roles/errors";
import { auditRejectedPrivilegedAction } from "@/lib/audit/security-events";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const access = await requirePlatformApiPermission(PERMISSIONS.USERS_MANAGE);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  // RPERM-05: PLATFORM-scope guard — see /api/tenant/roles/[id]/permissions
  // for the tenant equivalent of this endpoint.
  const { id } = await params;
  const role = await prisma.role.findFirst({
    where: { id, scope: "PLATFORM" },
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
  const access = await requirePlatformApiPermission(PERMISSIONS.USERS_MANAGE);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const { id } = await params;

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

  try {
    const result = await setPlatformRolePermissions({
      roleId: id,
      permissionKeys: requestedKeys,
      actorUserId: access.actorUserId,
    });
    return NextResponse.json(result);
  } catch (error) {
    const { status, body: errorBody } = toRoleApiErrorResponse(error);
    if (status >= 400 && status < 500) {
      await auditRejectedPrivilegedAction({
        actorUserId: access.actorUserId,
        tenantId: null,
        action: "PLATFORM_PERMISSION_CHANGE_REJECTED",
        entityType: "Role",
        entityId: id,
        reasonCode:
          "code" in errorBody && typeof errorBody.code === "string"
            ? errorBody.code
            : "REJECTED",
      });
    }
    return NextResponse.json(errorBody, { status });
  }
}
