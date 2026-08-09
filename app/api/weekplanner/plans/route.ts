/**
 * GET  /api/weekplanner/plans?weekId=YYYY-MM-DD
 * POST /api/weekplanner/plans
 *
 * WEEKPLANNER-01B — plan selector data + "+ Plan erstellen". Mirrors
 * app/api/training-sessions/[sessionId]/allocations/route.ts's shape.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireApiAnyPermission } from "@/lib/permissions/require-api-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { listWeekplannerPlans, createWeekplannerPlan } from "@/lib/weekplanner/plan-service";
import {
  WeekplannerPlanValidationError,
  WeekplannerPlanNameConflictError,
} from "@/lib/weekplanner/plan-errors";

const VIEW_PERMISSIONS = [
  PERMISSIONS.TRAININGS_VIEW,
  PERMISSIONS.TRAININGS_MANAGE,
  PERMISSIONS.EVENTS_VIEW,
  PERMISSIONS.EVENTS_MANAGE,
] as const;

const MANAGE_PERMISSIONS = [PERMISSIONS.TRAININGS_MANAGE, PERMISSIONS.EVENTS_MANAGE] as const;

export async function GET(request: NextRequest) {
  const auth = await requireApiAnyPermission([...VIEW_PERMISSIONS]);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const tenantId = auth.session.user?.activeTenantId;
  if (!tenantId) return NextResponse.json({ error: "Tenant context required" }, { status: 400 });

  const weekId = request.nextUrl.searchParams.get("weekId");
  if (!weekId) return NextResponse.json({ error: "weekId query parameter is required" }, { status: 400 });

  const plans = await listWeekplannerPlans(tenantId, weekId);
  return NextResponse.json({ plans });
}

export async function POST(request: NextRequest) {
  const auth = await requireApiAnyPermission([...MANAGE_PERMISSIONS]);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const tenantId = auth.session.user?.activeTenantId;
  if (!tenantId) return NextResponse.json({ error: "Tenant context required" }, { status: 400 });

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Request body required" }, { status: 400 });

  if (typeof body.weekId !== "string" || !body.weekId.trim()) {
    return NextResponse.json({ error: "weekId is required" }, { status: 400 });
  }
  if (typeof body.name !== "string" || !body.name.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  try {
    const plan = await createWeekplannerPlan(tenantId, {
      weekId: body.weekId,
      name: body.name,
      createdByUserId: auth.session.user?.id ?? null,
    });
    return NextResponse.json({ plan }, { status: 201 });
  } catch (err) {
    if (err instanceof WeekplannerPlanValidationError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    if (err instanceof WeekplannerPlanNameConflictError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    throw err;
  }
}
