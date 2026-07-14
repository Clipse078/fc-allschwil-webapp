import { NextRequest, NextResponse } from "next/server";
import { requireApiAnyPermission } from "@/lib/permissions/require-api-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { updateFacility } from "@/lib/facilities/queries";
import type { FacilityStatus, FacilityType } from "@prisma/client";

const ALLOWED_TYPES: FacilityType[] = [
  "PITCH",
  "DRESSING_ROOM_BLOCK",
  "INDOOR_HALL",
  "OTHER",
  "HALL",
  "ROOM",
];
const ALLOWED_STATUSES: FacilityStatus[] = ["ACTIVE", "INACTIVE", "ARCHIVED"];

type Params = { params: Promise<{ facilityId: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const auth = await requireApiAnyPermission([PERMISSIONS.FACILITIES_MANAGE]);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const tenantId = auth.session.user?.tenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "Tenant context required" }, { status: 400 });
  }

  const { facilityId } = await params;
  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Request body required" }, { status: 400 });
  }

  const data: Parameters<typeof updateFacility>[2] = {};
  if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim();
  if (ALLOWED_TYPES.includes(body.type)) data.type = body.type;
  if (ALLOWED_STATUSES.includes(body.status)) data.status = body.status;
  if (typeof body.sortOrder === "number") data.sortOrder = body.sortOrder;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  await updateFacility(facilityId, tenantId, data);
  return NextResponse.json({ ok: true });
}
