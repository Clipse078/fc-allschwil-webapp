import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getDefaultTenant } from "@/lib/tenants/queries";
import { revalidatePath } from "next/cache";

// Slice 11.5: sibling reorder endpoint.
// POST { direction: "up" | "down" } — swaps sortOrder with the adjacent sibling
// in the same parent group, ordered by (sortOrder ASC, name ASC).

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: RouteContext) {
  const access = await requireApiPermission(PERMISSIONS.ORG_MANAGE);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const tenant = await getDefaultTenant();
  if (!tenant) return NextResponse.json({ error: "Standard-Tenant nicht gefunden." }, { status: 500 });

  const { id } = await params;

  const unit = await prisma.orgUnit.findUnique({
    where: { id },
    select: { id: true, parentId: true, sortOrder: true, tenantId: true },
  });
  if (!unit) return NextResponse.json({ error: "Organisationseinheit nicht gefunden." }, { status: 404 });
  if (unit.tenantId !== null && unit.tenantId !== tenant.id) {
    return NextResponse.json({ error: "Organisationseinheit nicht gefunden." }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const direction = body?.direction;
  if (direction !== "up" && direction !== "down") {
    return NextResponse.json(
      { error: "direction muss 'up' oder 'down' sein." },
      { status: 400 }
    );
  }

  // Load all siblings (same parentId, same tenant), ordered by sortOrder then name.
  const siblings = await prisma.orgUnit.findMany({
    where: {
      tenantId: tenant.id,
      parentId: unit.parentId,
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, sortOrder: true },
  });

  const idx = siblings.findIndex((s) => s.id === id);
  if (idx === -1) {
    return NextResponse.json({ error: "Einheit nicht in Geschwisterliste gefunden." }, { status: 500 });
  }

  const swapIdx = direction === "up" ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= siblings.length) {
    return NextResponse.json(
      { error: "Einheit ist bereits am Rand der Reihenfolge." },
      { status: 400 }
    );
  }

  const target = siblings[swapIdx];
  const unitNewOrder = target.sortOrder;
  const targetNewOrder = unit.sortOrder;

  // Swap sortOrders. Use a temp value to avoid unique constraint collisions
  // when the two units share the same sortOrder value.
  if (unitNewOrder === targetNewOrder) {
    // Same sortOrder — disambiguate by assigning idx-based values.
    await prisma.$transaction([
      prisma.orgUnit.update({ where: { id: unit.id }, data: { sortOrder: swapIdx } }),
      prisma.orgUnit.update({ where: { id: target.id }, data: { sortOrder: idx } }),
    ]);
  } else {
    await prisma.$transaction([
      prisma.orgUnit.update({ where: { id: unit.id }, data: { sortOrder: unitNewOrder } }),
      prisma.orgUnit.update({ where: { id: target.id }, data: { sortOrder: targetNewOrder } }),
    ]);
  }

  revalidatePath("/dashboard/org-units");
  if (unit.parentId) {
    revalidatePath("/dashboard/org-units/" + unit.parentId);
  }

  return NextResponse.json({ message: "Reihenfolge aktualisiert." });
}
