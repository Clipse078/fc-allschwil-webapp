import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { requireApiAnyPermission } from "@/lib/permissions/require-api-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getTenantDetail } from "@/lib/tenants/queries";

type RouteContext = { params: Promise<{ tenantSlug: string }> };

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const access = await requireApiAnyPermission([
    PERMISSIONS.TENANTS_VIEW,
    PERMISSIONS.TENANTS_MANAGE,
  ]);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const { tenantSlug } = await params;
  const tenant = await getTenantDetail(tenantSlug);
  if (!tenant) return NextResponse.json({ error: "Tenant nicht gefunden." }, { status: 404 });
  return NextResponse.json({ tenant });
}

export async function PUT(req: NextRequest, { params }: RouteContext) {
  const access = await requireApiPermission(PERMISSIONS.TENANTS_MANAGE);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const { tenantSlug } = await params;
  const existing = await prisma.tenant.findUnique({ where: { key: tenantSlug }, select: { id: true, status: true } });
  if (!existing) return NextResponse.json({ error: "Tenant nicht gefunden." }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const name = body?.name?.trim();
  if (name !== undefined && !name) {
    return NextResponse.json({ error: "Name darf nicht leer sein." }, { status: 400 });
  }

  const validStatuses = ["ACTIVE", "INACTIVE"] as const;
  type UpdatableStatus = (typeof validStatuses)[number];
  const status: UpdatableStatus | undefined = validStatuses.includes(body?.status)
    ? (body.status as UpdatableStatus)
    : undefined;

  try {
    const tenant = await prisma.tenant.update({
      where: { key: tenantSlug },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(status !== undefined ? { status } : {}),
      },
      select: { id: true, key: true, name: true, status: true, updatedAt: true },
    });
    return NextResponse.json({ tenant });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Tenant konnte nicht aktualisiert werden." }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const access = await requireApiPermission(PERMISSIONS.TENANTS_MANAGE);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const { tenantSlug } = await params;
  const existing = await prisma.tenant.findUnique({
    where: { key: tenantSlug },
    select: { id: true, status: true },
  });
  if (!existing) return NextResponse.json({ error: "Tenant nicht gefunden." }, { status: 404 });
  if (existing.status === "ARCHIVED") {
    return NextResponse.json({ error: "Tenant ist bereits archiviert." }, { status: 409 });
  }

  // Guard: do not archive the last ACTIVE tenant — the platform would become inaccessible.
  const activeCount = await prisma.tenant.count({ where: { status: "ACTIVE" } });
  if (activeCount <= 1) {
    return NextResponse.json(
      { error: "Der letzte aktive Tenant kann nicht archiviert werden." },
      { status: 409 },
    );
  }

  await prisma.tenant.update({ where: { key: tenantSlug }, data: { status: "ARCHIVED" } });
  return NextResponse.json({ message: "Tenant wurde archiviert." });
}
