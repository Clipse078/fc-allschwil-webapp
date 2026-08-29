/**
 * PATCH /api/weekplanner/plans/[planId]/allocations/[allocationId]
 * DELETE /api/weekplanner/plans/[planId]/allocations/[allocationId]
 *
 * WOCHENPLAN-2.0-01H-E2 — PATCH updates occupancy buffers (and optional metadata).
 */

import { NextRequest, NextResponse } from "next/server";
import { requireApiAnyPermission } from "@/lib/permissions/require-api-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import {
  getWeekplannerPlanAllocation,
  deleteWeekplannerPlanAllocation,
  updateWeekplannerPlanAllocation,
} from "@/lib/weekplanner/plan-service";
import {
  WeekplannerPlanAllocationNotFoundError,
  WeekplannerPlanAllocationOccupancyValidationError,
  WeekplannerPlanArchivedError,
} from "@/lib/weekplanner/plan-errors";

const MANAGE_PERMISSIONS = [PERMISSIONS.TRAININGS_MANAGE, PERMISSIONS.EVENTS_MANAGE] as const;

type Params = { params: Promise<{ planId: string; allocationId: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const auth = await requireApiAnyPermission([...MANAGE_PERMISSIONS]);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const tenantId = auth.session.user?.activeTenantId;
  if (!tenantId) return NextResponse.json({ error: "Tenant context required" }, { status: 400 });

  const { planId, allocationId } = await params;
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Request body required" }, { status: 400 });

  try {
    const existing = await getWeekplannerPlanAllocation(tenantId, allocationId);
    if (existing.weekplannerPlanId !== planId) {
      return NextResponse.json({ error: "Allocation not found" }, { status: 404 });
    }

    const allocation = await updateWeekplannerPlanAllocation(tenantId, allocationId, {
      occupancyBeforeMinutes: body.occupancyBeforeMinutes,
      occupancyAfterMinutes: body.occupancyAfterMinutes,
      notes: typeof body.notes === "string" ? body.notes.trim() || null : body.notes,
      displayOrder: typeof body.displayOrder === "number" ? body.displayOrder : undefined,
    });
    return NextResponse.json({ allocation });
  } catch (err) {
    if (err instanceof WeekplannerPlanAllocationNotFoundError) {
      return NextResponse.json({ error: "Allocation not found" }, { status: 404 });
    }
    if (err instanceof WeekplannerPlanArchivedError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    if (err instanceof WeekplannerPlanAllocationOccupancyValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }
}

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
