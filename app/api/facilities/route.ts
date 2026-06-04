import { NextRequest, NextResponse } from "next/server";
import { requireApiAnyPermission } from "@/lib/permissions/require-api-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { createFacility, getFacilitiesForTenant } from "@/lib/facilities/queries";
import type { FacilityType } from "@prisma/client";

const ALLOWED_TYPES: FacilityType[] = ["PITCH", "DRESSING_ROOM_BLOCK", "INDOOR_HALL", "OTHER"];

export async function GET() {
  const auth = await requireApiAnyPermission([
    PERMISSIONS.FACILITIES_VIEW,
    PERMISSIONS.FACILITIES_MANAGE,
  ]);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const tenantId = auth.session.user?.tenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "Tenant context required" }, { status: 400 });
  }

  const facilities = await getFacilitiesForTenant(tenantId);
  return NextResponse.json({ facilities });
}

export async function POST(request: NextRequest) {
  const auth = await requireApiAnyPermission([PERMISSIONS.FACILITIES_MANAGE]);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const tenantId = auth.session.user?.tenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "Tenant context required" }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body.name !== "string" || !body.name.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const type: FacilityType = ALLOWED_TYPES.includes(body.type) ? body.type : "OTHER";

  const facility = await createFacility({
    tenantId,
    name: body.name.trim(),
    type,
    sortOrder: typeof body.sortOrder === "number" ? body.sortOrder : 0,
  });

  return NextResponse.json({ facility }, { status: 201 });
}
