import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { OrgUnitType } from "@prisma/client";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { requireApiAnyPermission } from "@/lib/permissions/require-api-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getOrgUnits } from "@/lib/org/queries";
import { getTenantFromSession } from "@/lib/tenants/queries";

// Slice 11.2b: tenant resolved from session-carried tenantId via getTenantFromSession().
// Falls back to getDefaultTenant() for legacy sessions where tenantId is null.
// Phase 1 Core: GET accepts ORG_VIEW in addition to ORG_MANAGE so the
// AllowlistPanel can fetch org units for any user with read access.

export async function GET() {
  const access = await requireApiAnyPermission([PERMISSIONS.ORG_VIEW, PERMISSIONS.ORG_MANAGE]);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const tenant = await getTenantFromSession(access.session.user?.tenantId);
  if (!tenant) return NextResponse.json({ error: "Standard-Tenant nicht gefunden." }, { status: 500 });

  const orgUnits = await getOrgUnits(tenant.id);
  return NextResponse.json({ orgUnits });
}

export async function POST(req: NextRequest) {
  const access = await requireApiPermission(PERMISSIONS.ORG_MANAGE);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const tenant = await getTenantFromSession(access.session.user?.tenantId);
  if (!tenant) return NextResponse.json({ error: "Standard-Tenant nicht gefunden." }, { status: 500 });

  const body = await req.json().catch(() => ({}));
  const name = (body?.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "Name ist erforderlich." }, { status: 400 });

  const rawKey = (body?.key ?? "").trim();
  const key = rawKey || name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  // Slice 11.2: key uniqueness is now tenant-scoped (@@unique([tenantId, key])).
  // Use findFirst with explicit tenantId filter rather than the removed global @unique.
  const existing = await prisma.orgUnit.findFirst({
    where: { tenantId: tenant.id, key },
    select: { id: true },
  });
  if (existing) return NextResponse.json({ error: `Key "${key}" ist bereits vergeben.` }, { status: 409 });

  const validTypes = Object.values(OrgUnitType);
  const type: OrgUnitType = validTypes.includes(body?.type) ? body.type : OrgUnitType.DEPARTMENT;

  // Max depth 3 enforcement
  let level = 0;
  if (body?.parentId) {
    const parent = await prisma.orgUnit.findUnique({ where: { id: body.parentId }, select: { level: true, tenantId: true } });
    if (!parent) return NextResponse.json({ error: "Übergeordnete Einheit nicht gefunden." }, { status: 400 });
    // Ensure parent belongs to the same tenant.
    if (parent.tenantId !== null && parent.tenantId !== tenant.id) {
      return NextResponse.json({ error: "Übergeordnete Einheit nicht gefunden." }, { status: 400 });
    }
    if (parent.level >= 2) return NextResponse.json({ error: "Maximale Verschachtelungstiefe von 3 Ebenen erreicht." }, { status: 400 });
    level = parent.level + 1;
  }

  try {
    const orgUnit = await prisma.orgUnit.create({
      data: {
        tenantId: tenant.id,
        key, name, type, level,
        description: body?.description?.trim() || null,
        parentId: body?.parentId?.trim() || null,
        sortOrder: body?.sortOrder ?? 0,
      },
      select: { id: true, key: true, name: true, type: true, level: true },
    });
    return NextResponse.json({ orgUnit }, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Organisationseinheit konnte nicht erstellt werden." }, { status: 500 });
  }
}
