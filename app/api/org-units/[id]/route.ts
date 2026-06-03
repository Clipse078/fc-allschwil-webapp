import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { OrgUnitType, OrgUnitStatus } from "@prisma/client";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getOrgUnitById } from "@/lib/org/queries";
import { getDefaultTenant } from "@/lib/tenants/queries";

// Slice 11.2: tenant is resolved once per request from getDefaultTenant().
// getDefaultTenant() is the backwards-compat fallback until the session carries tenantId.

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Returns true if the OrgUnit belongs to a different tenant than the resolved one.
 *
 * Null tenantId: legacy rows backfilled in migration
 * 20260601124700_add_org_membership_relations_tenant_backfill should have no
 * null tenantId rows remaining. If one is encountered it is treated as belonging
 * to the resolved (default) tenant — this is the documented backwards-compat
 * fallback to avoid breaking any pre-migration residue.
 */
function isCrossTenant(orgUnitTenantId: string | null, resolvedTenantId: string): boolean {
  if (orgUnitTenantId === null) return false; // null = pre-migration residue; allow (backwards-compat)
  return orgUnitTenantId !== resolvedTenantId;
}

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const access = await requireApiPermission(PERMISSIONS.ORG_MANAGE);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const tenant = await getDefaultTenant();
  if (!tenant) return NextResponse.json({ error: "Standard-Tenant nicht gefunden." }, { status: 500 });

  const { id } = await params;
  const orgUnit = await getOrgUnitById(id);
  if (!orgUnit) return NextResponse.json({ error: "Organisationseinheit nicht gefunden." }, { status: 404 });
  if (isCrossTenant(orgUnit.tenantId, tenant.id)) {
    return NextResponse.json({ error: "Organisationseinheit nicht gefunden." }, { status: 404 });
  }
  return NextResponse.json({ orgUnit });
}

export async function PUT(req: NextRequest, { params }: RouteContext) {
  const access = await requireApiPermission(PERMISSIONS.ORG_MANAGE);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const tenant = await getDefaultTenant();
  if (!tenant) return NextResponse.json({ error: "Standard-Tenant nicht gefunden." }, { status: 500 });

  const { id } = await params;
  const existing = await prisma.orgUnit.findUnique({ where: { id }, select: { id: true, level: true, tenantId: true } });
  if (!existing) return NextResponse.json({ error: "Organisationseinheit nicht gefunden." }, { status: 404 });
  if (isCrossTenant(existing.tenantId, tenant.id)) {
    return NextResponse.json({ error: "Organisationseinheit nicht gefunden." }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const validTypes = Object.values(OrgUnitType);
  const validStatuses = Object.values(OrgUnitStatus);

  try {
    const updated = await prisma.orgUnit.update({
      where: { id },
      data: {
        name: body?.name?.trim() || undefined,
        description: body?.description?.trim() || null,
        type: validTypes.includes(body?.type) ? body.type : undefined,
        status: validStatuses.includes(body?.status) ? body.status : undefined,
        sortOrder: body?.sortOrder !== undefined ? Number(body.sortOrder) : undefined,
      },
      select: { id: true, key: true, name: true, type: true, status: true },
    });
    return NextResponse.json({ orgUnit: updated });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Organisationseinheit konnte nicht aktualisiert werden." }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const access = await requireApiPermission(PERMISSIONS.ORG_MANAGE);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const tenant = await getDefaultTenant();
  if (!tenant) return NextResponse.json({ error: "Standard-Tenant nicht gefunden." }, { status: 500 });

  const { id } = await params;
  const existing = await prisma.orgUnit.findUnique({
    where: { id },
    select: { id: true, tenantId: true, _count: { select: { children: true } } },
  });
  if (!existing) return NextResponse.json({ error: "Organisationseinheit nicht gefunden." }, { status: 404 });
  if (isCrossTenant(existing.tenantId, tenant.id)) {
    return NextResponse.json({ error: "Organisationseinheit nicht gefunden." }, { status: 404 });
  }
  if (existing._count.children > 0) {
    return NextResponse.json({ error: "Organisationseinheiten mit Untereinheiten können nicht gelöscht werden. Bitte Untereinheiten zuerst entfernen oder archivieren." }, { status: 409 });
  }

  // Prefer archive over hard delete
  await prisma.orgUnit.update({ where: { id }, data: { status: OrgUnitStatus.ARCHIVED } });
  return NextResponse.json({ message: "Organisationseinheit wurde archiviert." });
}
