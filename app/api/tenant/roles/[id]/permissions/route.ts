/**
 * /api/tenant/roles/[id]/permissions — tenant role permission matrix.
 *
 * GET → the full TENANT-scoped/grantable permission catalog (grouped by
 *       module) plus the role's currently assigned keys.
 *       Permission: roles.view OR roles.manage.
 * PUT → bulk-replace the role's permission set. Every submitted key is
 *       re-validated server-side as scope=TENANT AND grantableByAdmin=true
 *       — a PLATFORM permission key in the body is rejected, never
 *       silently ignored. Essential permissions on a protected (isSystem)
 *       role cannot be removed.
 *       Permission: roles.manage.
 */

import { NextRequest, NextResponse } from "next/server";

import { requireTenantRoleApiContext } from "@/lib/roles/api-context";
import { TENANT_ROLES_MANAGE, TENANT_ROLES_VIEW } from "@/lib/roles/access";
import { getTenantPermissionCatalog, getTenantRoleDetail } from "@/lib/roles/tenant-queries";
import { setTenantRolePermissions } from "@/lib/roles/mutations";
import { toRoleApiErrorResponse } from "@/lib/roles/errors";
import { auditRejectedPrivilegedAction } from "@/lib/audit/security-events";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const guard = await requireTenantRoleApiContext(TENANT_ROLES_VIEW);
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const role = await getTenantRoleDetail(guard.context.tenantId, id);
  if (!role) {
    return NextResponse.json({ error: "Rolle nicht gefunden." }, { status: 404 });
  }

  const moduleGroups = await getTenantPermissionCatalog();

  return NextResponse.json({
    moduleGroups,
    assignedKeys: role.permissions.map((p) => p.key),
    lockedKeys: role.lockedPermissionKeys,
  });
}

export async function PUT(request: NextRequest, { params }: RouteContext) {
  const guard = await requireTenantRoleApiContext(TENANT_ROLES_MANAGE);
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const rawKeys: unknown = body.permissionKeys;

  if (!Array.isArray(rawKeys)) {
    return NextResponse.json({ error: "permissionKeys muss ein Array sein." }, { status: 400 });
  }

  const permissionKeys = rawKeys.filter((k): k is string => typeof k === "string");

  try {
    const result = await setTenantRolePermissions({
      tenantId: guard.context.tenantId,
      roleId: id,
      permissionKeys,
      actorUserId: guard.context.actorUserId,
    });
    return NextResponse.json(result);
  } catch (error) {
    const { status, body: errorBody } = toRoleApiErrorResponse(error);
    if (status >= 400 && status < 500) {
      await auditRejectedPrivilegedAction({
        actorUserId: guard.context.actorUserId,
        tenantId: guard.context.tenantId,
        action: "TENANT_PERMISSION_CHANGE_REJECTED",
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
