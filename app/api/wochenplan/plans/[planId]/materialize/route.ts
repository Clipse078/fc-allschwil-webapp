/**
 * POST /api/wochenplan/plans/[planId]/materialize
 *
 * WOCHENPLAN-2.0-01F — materialize a tenant-level alternative WochenplanPlan into
 * a week-scoped WeekplannerPlan for the requested week.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireApiAnyPermission } from "@/lib/permissions/require-api-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { materializeLinkedWeekplannerPlan } from "@/lib/wochenplan/plan-materialization";
import {
  WochenplanPlanArchivedError,
  WochenplanPlanNotFoundError,
  WochenplanPlanValidationError,
} from "@/lib/wochenplan/plan-errors";
import { WeekplannerPlanValidationError } from "@/lib/weekplanner/plan-errors";

const MANAGE_PERMISSIONS = [
  PERMISSIONS.TRAININGS_MANAGE,
  PERMISSIONS.EVENTS_MANAGE,
  PERMISSIONS.WOCHENPLAN_MANAGE,
] as const;

type Params = { params: Promise<{ planId: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const auth = await requireApiAnyPermission([...MANAGE_PERMISSIONS]);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const tenantId = auth.session.user?.activeTenantId;
  if (!tenantId) return NextResponse.json({ error: "Tenant context required" }, { status: 400 });

  const { planId } = await params;
  const body = await request.json().catch(() => ({}));
  const weekId = typeof body.weekId === "string" ? body.weekId.trim() : "";
  if (!weekId) {
    return NextResponse.json({ error: "weekId is required" }, { status: 400 });
  }

  try {
    const result = await materializeLinkedWeekplannerPlan(tenantId, weekId, planId, {
      createdByUserId: auth.session.user?.id ?? null,
    });
    return NextResponse.json(result, { status: result.created ? 201 : 200 });
  } catch (err) {
    if (err instanceof WochenplanPlanNotFoundError) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }
    if (err instanceof WochenplanPlanArchivedError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    if (
      err instanceof WochenplanPlanValidationError ||
      err instanceof WeekplannerPlanValidationError
    ) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    throw err;
  }
}
