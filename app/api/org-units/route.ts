import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { OrgUnitType } from "@prisma/client";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getOrgUnits } from "@/lib/org/queries";
import { getDefaultTenant } from "@/lib/tenants/queries";

export async function GET() {
  const access = await requireApiPermission(PERMISSIONS.USERS_MANAGE);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const orgUnits = await getOrgUnits();
  return NextResponse.json({ orgUnits });
}

export async function POST(req: NextRequest) {
  const access = await requireApiPermission(PERMISSIONS.USERS_MANAGE);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const body = await req.json().catch(() => ({}));
  const name = (body?.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "Name ist erforderlich." }, { status: 400 });

  const rawKey = (body?.key ?? "").trim();
  const key = rawKey || name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  const existing = await prisma.orgUnit.findUnique({ where: { key }, select: { id: true } });
  if (existing) return NextResponse.json({ error: `Key "${key}" ist bereits vergeben.` }, { status: 409 });

  const validTypes = Object.values(OrgUnitType);
  const type: OrgUnitType = validTypes.includes(body?.type) ? body.type : OrgUnitType.DEPARTMENT;

  const tenant = await getDefaultTenant();
  if (!tenant) return NextResponse.json({ error: "Standard-Tenant nicht gefunden." }, { status: 500 });

  // Max depth 3 enforcement
  let level = 0;
  if (body?.parentId) {
    const parent = await prisma.orgUnit.findUnique({ where: { id: body.parentId }, select: { level: true } });
    if (!parent) return NextResponse.json({ error: "Übergeordnete Einheit nicht gefunden." }, { status: 400 });
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
