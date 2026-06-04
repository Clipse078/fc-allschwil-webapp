import { NextRequest, NextResponse } from "next/server";
import { OrgUnitStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getTenantFromSession } from "@/lib/tenants/queries";

type RouteContext = { params: Promise<{ id: string }> };

async function requireTargetGroupForTenant(id: string, resolvedTenantId: string) {
  const tg = await prisma.targetGroup.findUnique({
    where: { id },
    select: { id: true, tenantId: true },
  });
  if (!tg) return null;
  if (tg.tenantId !== null && tg.tenantId !== resolvedTenantId) return null;
  return tg;
}

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const access = await requireApiPermission(PERMISSIONS.ORG_MANAGE);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const tenant = await getTenantFromSession(access.session.user?.tenantId);
  if (!tenant) return NextResponse.json({ error: "Standard-Tenant nicht gefunden." }, { status: 500 });

  const { id } = await params;
  const guard = await requireTargetGroupForTenant(id, tenant.id);
  if (!guard) return NextResponse.json({ error: "Zielgruppe nicht gefunden." }, { status: 404 });

  const targetGroup = await prisma.targetGroup.findUnique({
    where: { id },
    select: {
      id: true,
      key: true,
      name: true,
      description: true,
      status: true,
      ruleJson: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  return NextResponse.json({ targetGroup });
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const access = await requireApiPermission(PERMISSIONS.ORG_MANAGE);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const tenant = await getTenantFromSession(access.session.user?.tenantId);
  if (!tenant) return NextResponse.json({ error: "Standard-Tenant nicht gefunden." }, { status: 500 });

  const { id } = await params;
  const guard = await requireTargetGroupForTenant(id, tenant.id);
  if (!guard) return NextResponse.json({ error: "Zielgruppe nicht gefunden." }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const data: Prisma.TargetGroupUpdateInput = {};

  if ("name" in body) {
    const name = (body.name ?? "").trim();
    if (!name) return NextResponse.json({ error: "Name darf nicht leer sein." }, { status: 400 });
    data.name = name;
  }
  if ("description" in body) {
    data.description = body.description?.trim() || null;
  }
  if ("status" in body) {
    const validStatuses = Object.values(OrgUnitStatus);
    if (validStatuses.includes(body.status)) {
      data.status = body.status as OrgUnitStatus;
    }
  }
  if ("ruleJson" in body) {
    data.ruleJson = body.ruleJson ?? Prisma.DbNull;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json(
      { error: "Keine gültigen Felder zum Aktualisieren angegeben." },
      { status: 400 },
    );
  }

  try {
    const updated = await prisma.targetGroup.update({
      where: { id },
      data,
      select: { id: true, key: true, name: true, status: true, updatedAt: true },
    });
    return NextResponse.json({ targetGroup: updated });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Zielgruppe konnte nicht aktualisiert werden." }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const access = await requireApiPermission(PERMISSIONS.ORG_MANAGE);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const tenant = await getTenantFromSession(access.session.user?.tenantId);
  if (!tenant) return NextResponse.json({ error: "Standard-Tenant nicht gefunden." }, { status: 500 });

  const { id } = await params;
  const guard = await requireTargetGroupForTenant(id, tenant.id);
  if (!guard) return NextResponse.json({ error: "Zielgruppe nicht gefunden." }, { status: 404 });

  await prisma.targetGroup.delete({ where: { id } });
  return NextResponse.json({ message: "Zielgruppe entfernt." });
}
