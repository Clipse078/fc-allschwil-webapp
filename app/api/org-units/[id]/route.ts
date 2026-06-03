import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { OrgUnitType, OrgUnitStatus } from "@prisma/client";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getOrgUnitById } from "@/lib/org/queries";
import { getDefaultTenant } from "@/lib/tenants/queries";

type RouteContext = { params: Promise<{ id: string }> };

/** Returns 404 if the OrgUnit belongs to a different tenant (avoids information disclosure). */
function isCrossTenant(tenantId: string | null, defaultTenantId: string | undefined): boolean {
  if (!defaultTenantId) return false;
  if (tenantId === null) return false; // null = no tenant assigned; allow (defensive)
  return tenantId !== defaultTenantId;
}

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const access = await requireApiPermission(PERMISSIONS.USERS_MANAGE);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const { id } = await params;
  const [orgUnit, tenant] = await Promise.all([getOrgUnitById(id), getDefaultTenant()]);
  if (!orgUnit) return NextResponse.json({ error: "Organisationseinheit nicht gefunden." }, { status: 404 });
  if (isCrossTenant(orgUnit.tenantId, tenant?.id)) {
    return NextResponse.json({ error: "Organisationseinheit nicht gefunden." }, { status: 404 });
  }
  return NextResponse.json({ orgUnit });
}

export async function PUT(req: NextRequest, { params }: RouteContext) {
  const access = await requireApiPermission(PERMISSIONS.USERS_MANAGE);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const { id } = await params;
  const tenant = await getDefaultTenant();
  const existing = await prisma.orgUnit.findUnique({ where: { id }, select: { id: true, level: true, tenantId: true } });
  if (!existing) return NextResponse.json({ error: "Organisationseinheit nicht gefunden." }, { status: 404 });
  if (isCrossTenant(existing.tenantId, tenant?.id)) {
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
  const access = await requireApiPermission(PERMISSIONS.USERS_MANAGE);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const { id } = await params;
  const tenant = await getDefaultTenant();
  const existing = await prisma.orgUnit.findUnique({
    where: { id },
    select: { id: true, tenantId: true, _count: { select: { children: true } } },
  });
  if (!existing) return NextResponse.json({ error: "Organisationseinheit nicht gefunden." }, { status: 404 });
  if (isCrossTenant(existing.tenantId, tenant?.id)) {
    return NextResponse.json({ error: "Organisationseinheit nicht gefunden." }, { status: 404 });
  }
  if (existing._count.children > 0) {
    return NextResponse.json({ error: "Organisationseinheiten mit Untereinheiten können nicht gelöscht werden. Bitte Untereinheiten zuerst entfernen oder archivieren." }, { status: 409 });
  }

  // Prefer archive over hard delete
  await prisma.orgUnit.update({ where: { id }, data: { status: OrgUnitStatus.ARCHIVED } });
  return NextResponse.json({ message: "Organisationseinheit wurde archiviert." });
}
