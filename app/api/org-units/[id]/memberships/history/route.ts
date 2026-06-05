/**
 * Phase B — Membership History API
 *
 * GET /api/org-units/:id/memberships/history
 *
 * Returns all membership records for an org unit (all statuses), with optional
 * filtering by season and status. Used by the Membership History tab.
 *
 * Auth: ORG_VIEW or ORG_MANAGE
 * Tenant: scoped to the session tenant
 * Query params:
 *   ?seasonId=<id>  — filter by season
 *   ?status=<ACTIVE|INACTIVE|PENDING>  — filter by status
 */

import { NextRequest, NextResponse } from "next/server";
import { requireApiAnyPermission } from "@/lib/permissions/require-api-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getTenantFromSession } from "@/lib/tenants/queries";
import { getOrgUnitMembershipHistory } from "@/lib/org/queries";
import { prisma } from "@/lib/db/prisma";

type RouteContext = { params: Promise<{ id: string }> };

async function requireOrgUnitForTenant(orgUnitId: string, resolvedTenantId: string) {
  const orgUnit = await prisma.orgUnit.findUnique({
    where: { id: orgUnitId },
    select: { id: true, tenantId: true },
  });
  if (!orgUnit) return null;
  if (orgUnit.tenantId !== null && orgUnit.tenantId !== resolvedTenantId) return null;
  return orgUnit;
}

export async function GET(req: NextRequest, { params }: RouteContext) {
  const access = await requireApiAnyPermission([PERMISSIONS.ORG_VIEW, PERMISSIONS.ORG_MANAGE]);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const tenant = await getTenantFromSession(access.session.user?.tenantId);
  if (!tenant) return NextResponse.json({ error: "Standard-Tenant nicht gefunden." }, { status: 500 });

  const { id } = await params;
  const orgUnit = await requireOrgUnitForTenant(id, tenant.id);
  if (!orgUnit) return NextResponse.json({ error: "Organisationseinheit nicht gefunden." }, { status: 404 });

  const url = new URL(req.url);
  const seasonId = url.searchParams.get("seasonId") ?? undefined;
  const status = url.searchParams.get("status") ?? undefined;

  const memberships = await getOrgUnitMembershipHistory(id, { seasonId, status });
  return NextResponse.json({ memberships });
}
