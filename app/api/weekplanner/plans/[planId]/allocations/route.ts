/**
 * GET  /api/weekplanner/plans/[planId]/allocations
 * POST /api/weekplanner/plans/[planId]/allocations
 *
 * WEEKPLANNER-01B — sparse resource-allocation overrides for one
 * WeekplannerPlan. Mirrors
 * app/api/training-sessions/[sessionId]/allocations/route.ts.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireApiAnyPermission } from "@/lib/permissions/require-api-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import type { WeekplannerActivityType, WeekplannerAllocationGroup } from "@/lib/weekplanner/plan-types";
import {
  listWeekplannerPlanAllocations,
  createWeekplannerPlanAllocation,
} from "@/lib/weekplanner/plan-service";
import {
  WeekplannerPlanNotFoundError,
  WeekplannerPlanArchivedError,
  WeekplannerPlanAllocationActivityNotFoundError,
  WeekplannerPlanAllocationInvalidParticipantError,
  WeekplannerPlanAllocationGroupMismatchError,
  WeekplannerPlanAllocationResourceNotFoundError,
  WeekplannerPlanAllocationArchivedResourceError,
  WeekplannerPlanAllocationArchivedFacilityError,
  WeekplannerPlanAllocationDuplicateError,
  WeekplannerPlanAllocationOccupancyValidationError,
} from "@/lib/weekplanner/plan-errors";

const VIEW_PERMISSIONS = [
  PERMISSIONS.TRAININGS_VIEW,
  PERMISSIONS.TRAININGS_MANAGE,
  PERMISSIONS.EVENTS_VIEW,
  PERMISSIONS.EVENTS_MANAGE,
] as const;

const MANAGE_PERMISSIONS = [PERMISSIONS.TRAININGS_MANAGE, PERMISSIONS.EVENTS_MANAGE] as const;

const ACTIVITY_TYPES: readonly WeekplannerActivityType[] = ["TRAINING", "MATCH", "TOURNAMENT"];
const ALLOCATION_GROUPS: readonly WeekplannerAllocationGroup[] = ["PITCH_HALL", "DRESSING_ROOM"];

type Params = { params: Promise<{ planId: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const auth = await requireApiAnyPermission([...VIEW_PERMISSIONS]);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const tenantId = auth.session.user?.activeTenantId;
  if (!tenantId) return NextResponse.json({ error: "Tenant context required" }, { status: 400 });

  const { planId } = await params;

  try {
    const allocations = await listWeekplannerPlanAllocations(tenantId, planId);
    return NextResponse.json({ allocations });
  } catch (err) {
    if (err instanceof WeekplannerPlanNotFoundError) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }
    throw err;
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  const auth = await requireApiAnyPermission([...MANAGE_PERMISSIONS]);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const tenantId = auth.session.user?.activeTenantId;
  if (!tenantId) return NextResponse.json({ error: "Tenant context required" }, { status: 400 });

  const { planId } = await params;
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Request body required" }, { status: 400 });

  if (!ACTIVITY_TYPES.includes(body.activityType)) {
    return NextResponse.json({ error: `activityType must be one of ${ACTIVITY_TYPES.join(", ")}` }, { status: 400 });
  }
  if (typeof body.activityId !== "string" || !body.activityId.trim()) {
    return NextResponse.json({ error: "activityId is required" }, { status: 400 });
  }
  if (!ALLOCATION_GROUPS.includes(body.allocationGroup)) {
    return NextResponse.json({ error: `allocationGroup must be one of ${ALLOCATION_GROUPS.join(", ")}` }, { status: 400 });
  }
  if (typeof body.facilityResourceId !== "string" || !body.facilityResourceId.trim()) {
    return NextResponse.json({ error: "facilityResourceId is required" }, { status: 400 });
  }

  try {
    const allocation = await createWeekplannerPlanAllocation(tenantId, {
      weekplannerPlanId: planId,
      activityType: body.activityType,
      activityId: body.activityId.trim(),
      allocationGroup: body.allocationGroup,
      participantId: typeof body.participantId === "string" ? body.participantId.trim() || null : null,
      facilityResourceId: body.facilityResourceId.trim(),
      notes: typeof body.notes === "string" ? body.notes.trim() || null : null,
      occupancyBeforeMinutes: body.occupancyBeforeMinutes,
      occupancyAfterMinutes: body.occupancyAfterMinutes,
    });
    return NextResponse.json({ allocation }, { status: 201 });
  } catch (err) {
    if (err instanceof WeekplannerPlanNotFoundError) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }
    if (err instanceof WeekplannerPlanArchivedError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    if (err instanceof WeekplannerPlanAllocationActivityNotFoundError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    if (err instanceof WeekplannerPlanAllocationInvalidParticipantError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    if (err instanceof WeekplannerPlanAllocationGroupMismatchError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    if (err instanceof WeekplannerPlanAllocationResourceNotFoundError) {
      return NextResponse.json({ error: "Facility resource not found" }, { status: 404 });
    }
    if (err instanceof WeekplannerPlanAllocationArchivedResourceError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    if (err instanceof WeekplannerPlanAllocationArchivedFacilityError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    if (err instanceof WeekplannerPlanAllocationDuplicateError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    if (err instanceof WeekplannerPlanAllocationOccupancyValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }
}
