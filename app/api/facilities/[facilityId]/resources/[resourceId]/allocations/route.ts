import { NextRequest, NextResponse } from "next/server";
import { requireApiAnyPermission } from "@/lib/permissions/require-api-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { listAllocationsByFacilityResource } from "@/lib/training/training-allocation-service";
import { TrainingAllocationResourceNotFoundError } from "@/lib/training/errors";

type Params = { params: Promise<{ facilityId: string; resourceId: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const auth = await requireApiAnyPermission([
    PERMISSIONS.TRAININGS_VIEW,
    PERMISSIONS.TRAININGS_MANAGE,
    PERMISSIONS.FACILITIES_VIEW,
    PERMISSIONS.FACILITIES_MANAGE,
  ]);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const tenantId = auth.session.user?.activeTenantId;
  if (!tenantId) return NextResponse.json({ error: "Tenant context required" }, { status: 400 });

  const { resourceId } = await params;

  try {
    const allocations = await listAllocationsByFacilityResource(tenantId, resourceId);
    return NextResponse.json({ allocations });
  } catch (err) {
    if (err instanceof TrainingAllocationResourceNotFoundError) {
      return NextResponse.json({ error: "Facility resource not found" }, { status: 404 });
    }
    throw err;
  }
}
