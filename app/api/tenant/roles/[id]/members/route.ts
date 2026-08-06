/**
 * /api/tenant/roles/[id]/members — tenant role assignment.
 *
 * GET    → assigned users for this role (role detail's assignedUsers).
 *          Permission: roles.view OR roles.manage.
 * POST   → assign { userId } to this role. Idempotent — assigning an
 *          already-assigned user succeeds without creating a duplicate.
 *          The target user must have an ACTIVE TenantMembership in the
 *          caller's active tenant — TenantMembership is the sole
 *          eligibility source, never User.tenantId.
 *          Permission: roles.manage OR roles.assign.
 * DELETE → remove ?userId= from this role. Never deletes the
 *          TenantMembership. Blocked when it would remove the last active
 *          assignee of a protected (isSystem) role in this tenant.
 *          Permission: roles.manage OR roles.assign.
 */

import { NextRequest, NextResponse } from "next/server";

import { requireTenantRoleApiContext } from "@/lib/roles/api-context";
import { TENANT_ROLES_ASSIGN, TENANT_ROLES_VIEW } from "@/lib/roles/access";
import { getTenantRoleDetail } from "@/lib/roles/tenant-queries";
import { assignTenantRoleToUser, removeTenantRoleAssignment } from "@/lib/roles/mutations";
import { toRoleApiErrorResponse } from "@/lib/roles/errors";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const guard = await requireTenantRoleApiContext(TENANT_ROLES_VIEW);
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const role = await getTenantRoleDetail(guard.context.tenantId, id);
  if (!role) {
    return NextResponse.json({ error: "Rolle nicht gefunden." }, { status: 404 });
  }

  return NextResponse.json({ users: role.assignedUsers });
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const guard = await requireTenantRoleApiContext(TENANT_ROLES_ASSIGN);
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const userId = typeof body.userId === "string" ? body.userId : "";

  if (!userId) {
    return NextResponse.json({ error: "userId ist erforderlich." }, { status: 400 });
  }

  try {
    const result = await assignTenantRoleToUser({
      tenantId: guard.context.tenantId,
      roleId: id,
      userId,
      actorUserId: guard.context.actorUserId,
    });
    return NextResponse.json(result);
  } catch (error) {
    const { status, body: errorBody } = toRoleApiErrorResponse(error);
    return NextResponse.json(errorBody, { status });
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const guard = await requireTenantRoleApiContext(TENANT_ROLES_ASSIGN);
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const userId = request.nextUrl.searchParams.get("userId") ?? "";

  if (!userId) {
    return NextResponse.json({ error: "userId ist erforderlich." }, { status: 400 });
  }

  try {
    const result = await removeTenantRoleAssignment({
      tenantId: guard.context.tenantId,
      roleId: id,
      userId,
      actorUserId: guard.context.actorUserId,
    });
    return NextResponse.json(result);
  } catch (error) {
    const { status, body: errorBody } = toRoleApiErrorResponse(error);
    return NextResponse.json(errorBody, { status });
  }
}
