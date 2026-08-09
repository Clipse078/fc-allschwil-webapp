/**
 * PUT    /api/weekplanner/plans/[planId]/time-overrides
 * DELETE /api/weekplanner/plans/[planId]/time-overrides
 *
 * WEEKPLANNER-01D — sparse start/end TIME overrides for one canonical
 * activity (TRAINING/MATCH/TOURNAMENT), within one WeekplannerPlan. Mirrors
 * app/api/weekplanner/plans/[planId]/allocations/route.ts's shape, but PUT
 * is an upsert (one row per activity per plan — see
 * lib/weekplanner/plan-service.ts) rather than an append.
 *
 * PUT body:    { activityType, activityId, startAt?, endAt? }
 *   Provide `startAt`/`endAt` as ISO instants on the activity's own
 *   canonical calendar day. Omitting/nulling BOTH clears the override
 *   entirely ("Standardzeit verwenden").
 * DELETE body: { activityType, activityId } — same as PUT with both fields
 *   omitted; provided as an explicit, idempotent reset action.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireApiAnyPermission } from "@/lib/permissions/require-api-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import type { WeekplannerActivityType } from "@/lib/weekplanner/plan-types";
import {
  setWeekplannerPlanActivityTimeOverride,
  clearWeekplannerPlanActivityTimeOverride,
} from "@/lib/weekplanner/plan-service";
import {
  WeekplannerPlanNotFoundError,
  WeekplannerPlanArchivedError,
  WeekplannerPlanAllocationActivityNotFoundError,
  WeekplannerPlanTimeOverrideInvalidRangeError,
} from "@/lib/weekplanner/plan-errors";

const MANAGE_PERMISSIONS = [PERMISSIONS.TRAININGS_MANAGE, PERMISSIONS.EVENTS_MANAGE] as const;

const ACTIVITY_TYPES: readonly WeekplannerActivityType[] = ["TRAINING", "MATCH", "TOURNAMENT"];

type Params = { params: Promise<{ planId: string }> };

function validateActivity(body: unknown): { activityType: WeekplannerActivityType; activityId: string } | null {
  if (!body || typeof body !== "object") return null;
  const { activityType, activityId } = body as Record<string, unknown>;
  if (typeof activityType !== "string" || !ACTIVITY_TYPES.includes(activityType as WeekplannerActivityType)) {
    return null;
  }
  if (typeof activityId !== "string" || !activityId.trim()) return null;
  return { activityType: activityType as WeekplannerActivityType, activityId: activityId.trim() };
}

export async function PUT(request: NextRequest, { params }: Params) {
  const auth = await requireApiAnyPermission([...MANAGE_PERMISSIONS]);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const tenantId = auth.session.user?.activeTenantId;
  if (!tenantId) return NextResponse.json({ error: "Tenant context required" }, { status: 400 });

  const { planId } = await params;
  const body = await request.json().catch(() => null);
  const activity = validateActivity(body);
  if (!activity) {
    return NextResponse.json(
      { error: `activityType must be one of ${ACTIVITY_TYPES.join(", ")} and activityId is required` },
      { status: 400 },
    );
  }

  const startAt = typeof (body as { startAt?: unknown }).startAt === "string" ? (body as { startAt: string }).startAt : null;
  const endAt = typeof (body as { endAt?: unknown }).endAt === "string" ? (body as { endAt: string }).endAt : null;

  try {
    const override = await setWeekplannerPlanActivityTimeOverride(tenantId, {
      weekplannerPlanId: planId,
      activityType: activity.activityType,
      activityId: activity.activityId,
      overrideStartAt: startAt,
      overrideEndAt: endAt,
    });
    return NextResponse.json({ override });
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
    if (err instanceof WeekplannerPlanTimeOverrideInvalidRangeError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    throw err;
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const auth = await requireApiAnyPermission([...MANAGE_PERMISSIONS]);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const tenantId = auth.session.user?.activeTenantId;
  if (!tenantId) return NextResponse.json({ error: "Tenant context required" }, { status: 400 });

  const { planId } = await params;
  const body = await request.json().catch(() => null);
  const activity = validateActivity(body);
  if (!activity) {
    return NextResponse.json(
      { error: `activityType must be one of ${ACTIVITY_TYPES.join(", ")} and activityId is required` },
      { status: 400 },
    );
  }

  try {
    await clearWeekplannerPlanActivityTimeOverride(tenantId, planId, activity.activityType, activity.activityId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof WeekplannerPlanNotFoundError) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }
    if (err instanceof WeekplannerPlanArchivedError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    throw err;
  }
}
