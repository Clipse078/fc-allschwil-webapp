import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getTenantFromSession } from "@/lib/tenants/queries";
import { revalidatePath } from "next/cache";

// Org Builder Foundation v1: dedicated restore endpoint.
// Restoring an archived unit:
//   - Sets status back to ACTIVE
//   - Clears archivedAt
//   - Does NOT restore children (each child must be restored individually)
// Tenant guard enforced via session tenantId.

type RouteContext = { params: Promise<{ id: string }> };

function isCrossTenant(orgUnitTenantId: string | null, resolvedTenantId: string): boolean {
  if (orgUnitTenantId === null) return false;
  return orgUnitTenantId !== resolvedTenantId;
}

export async function POST(_req: NextRequest, { params }: RouteContext) {
  const access = await requireApiPermission(PERMISSIONS.ORG_MANAGE);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const tenant = await getTenantFromSession(access.session.user?.activeTenantId);
  if (!tenant) return NextResponse.json({ error: "Standard-Tenant nicht gefunden." }, { status: 500 });

  const { id } = await params;
  const existing = await prisma.orgUnit.findUnique({
    where: { id },
    select: { id: true, tenantId: true, status: true, name: true },
  });

  if (!existing) return NextResponse.json({ error: "Organisationseinheit nicht gefunden." }, { status: 404 });
  if (isCrossTenant(existing.tenantId, tenant.id)) {
    return NextResponse.json({ error: "Organisationseinheit nicht gefunden." }, { status: 404 });
  }
  if (existing.status !== "ARCHIVED") {
    return NextResponse.json({ error: "Nur archivierte Einheiten können wiederhergestellt werden." }, { status: 409 });
  }

  try {
    const restored = await prisma.orgUnit.update({
      where: { id },
      data: { status: "ACTIVE", archivedAt: null },
      select: { id: true, key: true, name: true, type: true, status: true, archivedAt: true },
    });

    revalidatePath("/dashboard/org-units");
    revalidatePath("/dashboard/org-units/" + id);

    return NextResponse.json({ orgUnit: restored, message: `${restored.name} wurde wiederhergestellt.` });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Wiederherstellung fehlgeschlagen." }, { status: 500 });
  }
}
