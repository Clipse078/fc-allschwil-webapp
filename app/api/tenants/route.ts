import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { requireApiAnyPermission } from "@/lib/permissions/require-api-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getTenants } from "@/lib/tenants/queries";

export async function GET() {
  const access = await requireApiAnyPermission([
    PERMISSIONS.TENANTS_VIEW,
    PERMISSIONS.TENANTS_MANAGE,
  ]);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const tenants = await getTenants();
  return NextResponse.json({ tenants });
}

export async function POST(req: NextRequest) {
  const access = await requireApiPermission(PERMISSIONS.TENANTS_MANAGE);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const body = await req.json().catch(() => ({}));
  const name = (body?.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "Name ist erforderlich." }, { status: 400 });

  const rawKey = (body?.key ?? "").trim();
  const key =
    rawKey ||
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

  if (!/^[a-z0-9-]+$/.test(key)) {
    return NextResponse.json(
      { error: 'Key darf nur Kleinbuchstaben, Ziffern und Bindestriche enthalten.' },
      { status: 400 },
    );
  }

  const existing = await prisma.tenant.findUnique({ where: { key }, select: { id: true } });
  if (existing) {
    return NextResponse.json({ error: `Key "${key}" ist bereits vergeben.` }, { status: 409 });
  }

  try {
    const tenant = await prisma.tenant.create({
      data: { key, name, status: "ACTIVE" },
      select: { id: true, key: true, name: true, status: true },
    });
    return NextResponse.json({ tenant }, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Tenant konnte nicht erstellt werden." }, { status: 500 });
  }
}
