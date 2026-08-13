/**
 * /api/org-units/[id]/responsibilities
 *
 * ORG-ACCESS-02: Scoped role assignment (Personen & Zuständigkeiten) for an OrgUnit.
 *
 * GET  → { assignments: ScopedRoleAssignment[] }
 *        Lists all scoped UserRole rows for this OrgUnit.
 *        Permission: org.view OR org.manage OR roles.view.
 *
 * POST → { userId, roleId, scopeMode? } — creates a scoped UserRole.
 *        Permission: org.manage OR roles.assign OR users.manage.
 *
 * Tenant isolation: tenantId resolved exclusively from session.user.activeTenantId.
 * Cross-tenant / PLATFORM role IDs are rejected by assignScopedRoleToUser().
 */

import { NextRequest, NextResponse } from "next/server";
import { requireApiAnyPermission } from "@/lib/permissions/require-api-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import {
  assignScopedRoleToUser,
  getScopedAssignmentsForOrgUnit,
} from "@/lib/roles/scoped-mutations";
import { toRoleApiErrorResponse } from "@/lib/roles/errors";
import type { OrgUnitScopeMode } from "@prisma/client";

type RouteContext = { params: Promise<{ id: string }> };

const VIEW_PERMISSIONS = [
  PERMISSIONS.ORG_VIEW,
  PERMISSIONS.ORG_MANAGE,
  PERMISSIONS.ROLES_VIEW,
  PERMISSIONS.USERS_VIEW,
  PERMISSIONS.USERS_MANAGE,
];

const MANAGE_PERMISSIONS = [
  PERMISSIONS.ORG_MANAGE,
  PERMISSIONS.ROLES_ASSIGN,
  PERMISSIONS.USERS_MANAGE,
];

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const access = await requireApiAnyPermission(VIEW_PERMISSIONS);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantId = access.session.user?.activeTenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "Kein Mandanten-Kontext." }, { status: 403 });
  }

  const { id: orgUnitId } = await params;
  if (!orgUnitId?.trim()) {
    return NextResponse.json({ error: "Ungültige OrgUnit-ID." }, { status: 400 });
  }

  try {
    const assignments = await getScopedAssignmentsForOrgUnit(tenantId, orgUnitId);
    return NextResponse.json({ assignments });
  } catch (error) {
    const { status, body } = toRoleApiErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}

export async function POST(req: NextRequest, { params }: RouteContext) {
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

  const { id: orgUnitId } = await params;
  if (!orgUnitId?.trim()) {
    return NextResponse.json({ error: "Ungültige OrgUnit-ID." }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger Anfrage-Inhalt." }, { status: 400 });
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Ungültiger Anfrage-Inhalt." }, { status: 400 });
  }

  const { userId, roleId, scopeMode } = body as Record<string, unknown>;

  if (typeof userId !== "string" || !userId.trim()) {
    return NextResponse.json({ error: "userId ist erforderlich." }, { status: 400 });
  }
  if (typeof roleId !== "string" || !roleId.trim()) {
    return NextResponse.json({ error: "roleId ist erforderlich." }, { status: 400 });
  }

  const validScopeModes: OrgUnitScopeMode[] = [
    "THIS_ORG_UNIT",
    "THIS_ORG_UNIT_AND_DESCENDANTS",
  ];
  if (scopeMode !== undefined && !validScopeModes.includes(scopeMode as OrgUnitScopeMode)) {
    return NextResponse.json(
      { error: `scopeMode muss THIS_ORG_UNIT oder THIS_ORG_UNIT_AND_DESCENDANTS sein.` },
      { status: 400 },
    );
  }

  try {
    const result = await assignScopedRoleToUser({
      tenantId,
      userId,
      roleId,
      orgUnitId,
      scopeMode: (scopeMode as OrgUnitScopeMode | undefined) ?? "THIS_ORG_UNIT",
      actorUserId,
    });
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    const { status, body: errorBody } = toRoleApiErrorResponse(error);
    return NextResponse.json(errorBody, { status });
  }
}
