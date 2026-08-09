/**
 * DELETE /api/weekplanner/plans/[planId]/allocations/[allocationId]
 *
 * WEEKPLANNER-01B — removes one plan override row. When this removes the
 * last override row for an (activity, group[, participant]) combination,
 * that group reverts to the Standardplan default for this plan only — see
 * lib/weekplanner/plan-service.ts.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireApiAnyPermission } from "@/lib/permissions/require-api-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import {
  getWeekplannerPlanAllocation,
  deleteWeekplannerPlanAllocation,
} from "@/lib/weekplanner/plan-service";
import { WeekplannerPlanAllocationNotFoundError } from "@/lib/weekplanner/plan-errors";

const MANAGE_PERMISSIONS = [PERMISSIONS.TRAININGS_MANAGE, PERMISSIONS.EVENTS_MANAGE] as const;

type Params = { params: Promise<{ planId: string; allocationId: string }> };

export async function DELETE(_request: NextRequest, { params }: Params) {
  const auth = await requireApiAnyPermission([...MANAGE_PERMISSIONS]);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const tenantId = auth.session.user?.activeTenantId;
  if (!tenantId) return NextResponse.json({ error: "Tenant context required" }, { status: 400 });

  const { planId, allocationId } = await params;

  try {
    const existing = await getWeekplannerPlanAllocation(tenantId, allocationId);
    if (existing.weekplannerPlanId !== planId) {
      return NextResponse.json({ error: "Allocation not found" }, { status: 404 });
    }
    await deleteWeekplannerPlanAllocation(tenantId, allocationId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof WeekplannerPlanAllocationNotFoundError) {
      return NextResponse.json({ error: "Allocation not found" }, { status: 404 });
    }
    throw err;
  }
}
