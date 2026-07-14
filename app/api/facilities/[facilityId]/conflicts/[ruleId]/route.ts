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

  const tenantId = auth.session.user?.tenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "Tenant context required" }, { status: 400 });
  }

  const { ruleId } = await params;
  await deleteConflictRule(ruleId, tenantId);
  return NextResponse.json({ ok: true });
}
