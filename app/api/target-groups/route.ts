import { NextRequest, NextResponse } from "next/server";
import { OrgUnitStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getTargetGroups } from "@/lib/org/queries";
import { getTenantFromSession } from "@/lib/tenants/queries";

export async function GET() {
  const access = await requireApiPermission(PERMISSIONS.ORG_MANAGE);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const tenant = await getTenantFromSession(access.session.user?.activeTenantId);
  if (!tenant) return NextResponse.json({ error: "Standard-Tenant nicht gefunden." }, { status: 500 });

  const targetGroups = await getTargetGroups(tenant.id);
  return NextResponse.json({ targetGroups });
}

export async function POST(req: NextRequest) {
  const access = await requireApiPermission(PERMISSIONS.ORG_MANAGE);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const tenant = await getTenantFromSession(access.session.user?.activeTenantId);
  if (!tenant) return NextResponse.json({ error: "Standard-Tenant nicht gefunden." }, { status: 500 });

  const body = await req.json().catch(() => ({}));
  const name = (body?.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "Name ist erforderlich." }, { status: 400 });

  const rawKey = (body?.key ?? "").trim();
  const key = rawKey || name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  // Slice 11.6: key uniqueness is tenant-scoped (@@unique([tenantId, key])).
  // Use findFirst with explicit tenantId filter rather than the removed global @unique.
  const existing = await prisma.targetGroup.findFirst({
    where: { tenantId: tenant.id, key },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json({ error: `Key „${key}" ist bereits vergeben.` }, { status: 409 });
  }

  const validStatuses = Object.values(OrgUnitStatus);
  const status: OrgUnitStatus = validStatuses.includes(body?.status)
    ? body.status
    : OrgUnitStatus.ACTIVE;

  try {
    const targetGroup = await prisma.targetGroup.create({
      data: {
        tenantId: tenant.id,
        key,
        name,
        description: body?.description?.trim() || null,
        status,
        ruleJson: body?.ruleJson ?? null,
      },
      select: { id: true, key: true, name: true, status: true },
    });
    return NextResponse.json({ targetGroup }, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Zielgruppe konnte nicht erstellt werden." }, { status: 500 });
  }
}
