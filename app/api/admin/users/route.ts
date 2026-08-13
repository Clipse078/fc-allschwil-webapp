/**
 * GET /api/admin/users
 *
 * Returns all tenant members (TenantMembership + User + tenant-scoped roles)
 * for the authenticated user's active tenant.
 *
 * Authorization: requires users.view or users.manage (tenant-scoped).
 * Tenant isolation: tenantId is resolved exclusively from the session's
 *   activeTenantId — never from query params or request body.
 *
 * Security guarantees:
 *   - passwordHash, reset tokens, and session data are never returned.
 *   - Only members of the caller's own active tenant are ever returned.
 *
 * HTTP status:
 *   200  — { users: TenantUserItem[] }
 *   401  — unauthenticated
 *   403  — unauthorized or missing tenant context
 *   500  — unexpected internal error
 */

import { NextResponse } from "next/server";
import { requireApiAnyPermission } from "@/lib/permissions/require-api-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getTenantUsersListData } from "@/lib/users/queries";

export async function GET() {
  const access = await requireApiAnyPermission([
    PERMISSIONS.USERS_VIEW,
    PERMISSIONS.USERS_MANAGE,
  ]);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantId = access.session.user.activeTenantId;
  if (!tenantId) {
    return NextResponse.json(
      { error: "Kein Tenant-Kontext in der Sitzung vorhanden." },
      { status: 403 },
    );
  }

  try {
    const users = await getTenantUsersListData(tenantId);
    return NextResponse.json({ users });
  } catch {
    return NextResponse.json(
      { error: "Interne Serverfehlermeldung." },
      { status: 500 },
    );
  }
}
