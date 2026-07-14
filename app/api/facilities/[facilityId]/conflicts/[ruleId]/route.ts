import { NextRequest, NextResponse } from "next/server";
import { requireApiAnyPermission } from "@/lib/permissions/require-api-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { deleteConflictRule } from "@/lib/facilities/queries";

type Params = { params: Promise<{ facilityId: string; ruleId: string }> };

export async function DELETE(_req: NextRequest, { params }: Params) {
  const auth = await requireApiAnyPermission([PERMISSIONS.FACILITIES_MANAGE]);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  // tenantId comes exclusively from the authenticated session.
  // facilityId comes exclusively from the URL parameter.
  const tenantId = auth.session.user?.tenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "Tenant context required" }, { status: 400 });
  }

  const { facilityId, ruleId } = await params;

  const result = await deleteConflictRule(ruleId, tenantId, facilityId);

  if (result.count === 0) {
    return NextResponse.json({ error: "Conflict rule not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
