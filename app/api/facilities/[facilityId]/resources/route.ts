import { NextRequest, NextResponse } from "next/server";
import { requireApiAnyPermission } from "@/lib/permissions/require-api-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { createFacilityResource } from "@/lib/facilities/queries";
import type { FacilityResourceType } from "@prisma/client";

const ALLOWED_TYPES: FacilityResourceType[] = [
  "FULL_PITCH",
  "HALF_PITCH",
  "DRESSING_ROOM",
  "OTHER",
];

type Params = { params: Promise<{ facilityId: string }> };

export async function POST(request: NextRequest, { params }: Params) {
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

  if (!body || typeof body.name !== "string" || !body.name.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  if (typeof body.code !== "string" || !body.code.trim()) {
    return NextResponse.json({ error: "code is required" }, { status: 400 });
  }

  const type: FacilityResourceType = ALLOWED_TYPES.includes(body.type) ? body.type : "OTHER";

  try {
    const resource = await createFacilityResource({
      tenantId,
      facilityId,
      name: body.name.trim(),
      code: body.code.trim().toUpperCase(),
      type,
      sortOrder: typeof body.sortOrder === "number" ? body.sortOrder : 0,
    });
    return NextResponse.json({ resource }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("Unique constraint")) {
      return NextResponse.json(
        { error: "A resource with this code already exists for this tenant." },
        { status: 409 },
      );
    }
    throw err;
  }
}
