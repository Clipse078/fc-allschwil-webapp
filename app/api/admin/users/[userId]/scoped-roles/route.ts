/**
 * /api/admin/users/[userId]/scoped-roles — OrgUnit-scoped role management
 * on the user detail page (USER-ADMIN-02).
 *
 * GET  → list all scoped (orgUnitId != null) UserRole assignments for the user
 *        in the caller's active tenant.
 *        Returns: { assignments: ScopedRoleAssignment[] }
 *        Permission: users.view OR users.manage
 *
 * POST → assign a scoped role to the user.
 *        Body: { roleId: string; orgUnitId: string; scopeMode?: "THIS_ORG_UNIT" | "THIS_ORG_UNIT_AND_DESCENDANTS" }
 *        Returns: { success: true; assigned: boolean; userRoleId: string }
 *        Permission: users.manage
 *
 * DELETE → remove a specific scoped role assignment.
 *          Body: { userRoleId: string }
 *          Returns: { success: true; removed: boolean }
 *          Permission: users.manage
 *
 * Tenant isolation: tenantId resolved exclusively from session.activeTenantId.
 * The user must have a TenantMembership in the caller's active tenant.
 *
 * HTTP status:
 *   200  — success
 *   400  — invalid body / domain validation error
 *   401  — unauthenticated
 *   403  — unauthorized or missing tenant context
 *   404  — user not found in this tenant / role or OrgUnit not found
 *   409  — constraint conflict (e.g. Club Admin cannot be scoped)
 *   500  — unexpected internal error
 */

import { NextRequest, NextResponse } from "next/server";
import { requireApiAnyPermission } from "@/lib/permissions/require-api-any-permission";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import {
  getScopedAssignmentsForUser,
  assignScopedRoleToUser,
  removeScopedRoleAssignment,
} from "@/lib/roles/scoped-mutations";
import { toRoleApiErrorResponse } from "@/lib/roles/errors";
import { prisma } from "@/lib/db/prisma";
import type { OrgUnitScopeMode } from "@prisma/client";

type RouteContext = { params: Promise<{ userId: string }> };

// ── GET ───────────────────────────────────────────────────────────────────────

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

  const membership = await prisma.tenantMembership.findUnique({
    where: { tenantId_userId: { tenantId, userId } },
    select: { isActive: true },
  });
  if (!membership) {
    return NextResponse.json({ error: "Benutzer nicht gefunden." }, { status: 404 });
  }

  try {
    const assignments = await getScopedAssignmentsForUser(tenantId, userId);
    return NextResponse.json({ assignments });
  } catch {
    return NextResponse.json({ error: "Interner Serverfehler." }, { status: 500 });
  }
}

// ── POST ──────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest, { params }: RouteContext) {
  const access = await requireApiPermission(PERMISSIONS.USERS_MANAGE);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantId = access.session.user?.activeTenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "Kein Mandanten-Kontext in der Sitzung." }, { status: 403 });
  }

  const actorUserId = access.session.user?.effectiveUserId ?? access.session.user?.id;
  if (!actorUserId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

  const b = body as Record<string, unknown>;
  if (typeof b?.roleId !== "string" || !b.roleId.trim()) {
    return NextResponse.json({ error: "roleId (string) ist erforderlich." }, { status: 400 });
  }
  if (typeof b?.orgUnitId !== "string" || !b.orgUnitId.trim()) {
    return NextResponse.json({ error: "orgUnitId (string) ist erforderlich." }, { status: 400 });
  }

  const VALID_SCOPE_MODES: OrgUnitScopeMode[] = [
    "THIS_ORG_UNIT",
    "THIS_ORG_UNIT_AND_DESCENDANTS",
  ];
  const scopeMode: OrgUnitScopeMode =
    typeof b.scopeMode === "string" && VALID_SCOPE_MODES.includes(b.scopeMode as OrgUnitScopeMode)
      ? (b.scopeMode as OrgUnitScopeMode)
      : "THIS_ORG_UNIT";

  try {
    const result = await assignScopedRoleToUser({
      tenantId,
      userId,
      roleId: b.roleId.trim(),
      orgUnitId: b.orgUnitId.trim(),
      scopeMode,
      actorUserId,
    });
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    const { status, body: errorBody } = toRoleApiErrorResponse(error);
    return NextResponse.json(errorBody, { status });
  }
}

// ── DELETE ────────────────────────────────────────────────────────────────────

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const access = await requireApiPermission(PERMISSIONS.USERS_MANAGE);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantId = access.session.user?.activeTenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "Kein Mandanten-Kontext in der Sitzung." }, { status: 403 });
  }

  const actorUserId = access.session.user?.effectiveUserId ?? access.session.user?.id;
  if (!actorUserId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { userId: _userId } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger Anfrage-Inhalt." }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  if (typeof b?.userRoleId !== "string" || !b.userRoleId.trim()) {
    return NextResponse.json({ error: "userRoleId (string) ist erforderlich." }, { status: 400 });
  }

  try {
    const result = await removeScopedRoleAssignment({
      tenantId,
      userRoleId: b.userRoleId.trim(),
      actorUserId,
    });
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    const { status, body: errorBody } = toRoleApiErrorResponse(error);
    return NextResponse.json(errorBody, { status });
  }
}
