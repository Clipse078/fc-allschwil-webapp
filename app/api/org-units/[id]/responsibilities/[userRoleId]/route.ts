/**
 * /api/org-units/[id]/responsibilities/[userRoleId]
 *
 * ORG-ACCESS-02: Remove a scoped role assignment (Personen & Zuständigkeiten).
 *
 * DELETE → removes the scoped UserRole row with the given id.
 *          Permission: org.manage OR roles.assign OR users.manage.
 *          Only scoped (orgUnitId ≠ null) rows may be deleted here.
 *          Tenant-wide assignments are unaffected.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireApiAnyPermission } from "@/lib/permissions/require-api-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { removeScopedRoleAssignment } from "@/lib/roles/scoped-mutations";
import { toRoleApiErrorResponse } from "@/lib/roles/errors";

type RouteContext = { params: Promise<{ id: string; userRoleId: string }> };

const MANAGE_PERMISSIONS = [
  PERMISSIONS.ORG_MANAGE,
  PERMISSIONS.ROLES_ASSIGN,
  PERMISSIONS.USERS_MANAGE,
];

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const access = await requireApiAnyPermission(MANAGE_PERMISSIONS);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantId = access.session.user?.activeTenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "Kein Mandanten-Kontext." }, { status: 403 });
  }

  const actorUserId = access.session.user?.effectiveUserId ?? access.session.user?.id;
  if (!actorUserId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { userRoleId } = await params;
  if (!userRoleId?.trim()) {
    return NextResponse.json({ error: "Ungültige UserRole-ID." }, { status: 400 });
  }

  try {
    const result = await removeScopedRoleAssignment({
      tenantId,
      userRoleId,
      actorUserId,
    });
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    const { status, body } = toRoleApiErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
