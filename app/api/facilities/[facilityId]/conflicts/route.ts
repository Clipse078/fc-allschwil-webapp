import { NextRequest, NextResponse } from "next/server";
import { requireApiAnyPermission } from "@/lib/permissions/require-api-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import {
  getConflictRulesForFacility,
  createConflictRule,
} from "@/lib/facilities/queries";

type Params = { params: Promise<{ facilityId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
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

  const { facilityId } = await params;
  const rules = await getConflictRulesForFacility(facilityId, tenantId);
  return NextResponse.json({ rules });
}

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

  if (!body || typeof body.resourceAId !== "string" || typeof body.resourceBId !== "string") {
    return NextResponse.json(
      { error: "resourceAId and resourceBId are required" },
      { status: 400 },
    );
  }

  if (body.resourceAId === body.resourceBId) {
    return NextResponse.json(
      { error: "A resource cannot conflict with itself" },
      { status: 400 },
    );
  }

  try {
    const rule = await createConflictRule({
      tenantId,
      facilityId,
      resourceAId: body.resourceAId,
      resourceBId: body.resourceBId,
    });
    return NextResponse.json({ rule }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("Unique constraint")) {
      return NextResponse.json(
        { error: "This conflict rule already exists." },
        { status: 409 },
      );
    }
    throw err;
  }
}
