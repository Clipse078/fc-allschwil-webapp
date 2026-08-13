/**
 * /api/admin/users/[userId]/roles — tenant role management for the admin
 * user detail page (USER-ADMIN-02C).
 *
 * GET  → { roles: TenantRoleListItem[], assignedRoleIds: string[] }
 *        Lists all non-archived tenant roles + the user's current assignments.
 *        Permission: users.view OR users.manage.
 *
 * PUT  → { roleIds: string[] } — syncs the user's tenant roles to the given
 *        set. Assignments and removals are applied atomically.
 *        Permission: users.manage.
 *
 * Tenant isolation: tenantId resolved exclusively from
 * session.user.activeTenantId — never from the request body or URL.
 * Cross-tenant / PLATFORM role IDs in the body are rejected by
 * setTenantUserRoles() (RoleNotFoundError → 404).
 */

import { NextRequest, NextResponse } from "next/server";
import { requireApiAnyPermission } from "@/lib/permissions/require-api-any-permission";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getTenantRolesOverview } from "@/lib/roles/tenant-queries";
import { setTenantUserRoles } from "@/lib/roles/mutations";
import { toRoleApiErrorResponse } from "@/lib/roles/errors";
import { prisma } from "@/lib/db/prisma";

type RouteContext = { params: Promise<{ userId: string }> };

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const access = await requireApiAnyPermission([
    PERMISSIONS.USERS_VIEW,
    PERMISSIONS.USERS_MANAGE,
  ]);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantId = access.session.user?.activeTenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "Kein Mandanten-Kontext in der Sitzung." }, { status: 403 });
  }

  const { userId } = await params;
  if (!userId?.trim()) {
    return NextResponse.json({ error: "Ungültige Benutzer-ID." }, { status: 400 });
  }

  // Verify user is a member of this tenant (tenant isolation).
  const membership = await prisma.tenantMembership.findUnique({
    where: { tenantId_userId: { tenantId, userId } },
    select: { isActive: true },
  });
  if (!membership) {
    return NextResponse.json({ error: "Benutzer nicht gefunden." }, { status: 404 });
  }

  const [allRoles, currentAssignments] = await Promise.all([
    getTenantRolesOverview(tenantId),
    prisma.userRole.findMany({
      where: { tenantId, userId, role: { scope: "TENANT", tenantId } },
      select: { roleId: true },
    }),
  ]);

  return NextResponse.json({
    roles: allRoles.filter((r) => !r.isArchived),
    assignedRoleIds: currentAssignments.map((ur) => ur.roleId),
  });
}

export async function PUT(request: NextRequest, { params }: RouteContext) {
  const access = await requireApiPermission(PERMISSIONS.USERS_MANAGE);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantId = access.session.user?.activeTenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "Kein Mandanten-Kontext in der Sitzung." }, { status: 403 });
  }

  const { userId } = await params;
  if (!userId?.trim()) {
    return NextResponse.json({ error: "Ungültige Benutzer-ID." }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger Anfrage-Inhalt." }, { status: 400 });
  }

  if (
    typeof body !== "object" ||
    body === null ||
    !Array.isArray((body as Record<string, unknown>).roleIds)
  ) {
    return NextResponse.json({ error: "roleIds (string[]) ist erforderlich." }, { status: 400 });
  }

  const rawIds = (body as { roleIds: unknown[] }).roleIds;
  if (rawIds.some((id) => typeof id !== "string")) {
    return NextResponse.json({ error: "roleIds muss ein Array von Strings sein." }, { status: 400 });
  }

  const roleIds = rawIds as string[];
  const actorUserId = access.session.user?.effectiveUserId ?? access.session.user?.id;
  if (!actorUserId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await setTenantUserRoles({ tenantId, userId, roleIds, actorUserId });
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    const { status, body: errorBody } = toRoleApiErrorResponse(error);
    return NextResponse.json(errorBody, { status });
  }
}
