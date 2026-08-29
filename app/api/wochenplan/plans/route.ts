/**
 * GET  /api/wochenplan/plans
 * POST /api/wochenplan/plans
 *
 * WOCHENPLAN-2.0-01B — tenant-level plan selector + create plan.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireApiAnyPermission } from "@/lib/permissions/require-api-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { listWochenplanPlans, createWochenplanPlan } from "@/lib/wochenplan/plan-service";
import { createWochenplanPlanWithWeek } from "@/lib/wochenplan/plan-creation";
import type { WochenplanPlanCreationMode } from "@/lib/wochenplan/plan-types";
import {
  WochenplanPlanValidationError,
  WochenplanPlanNameConflictError,
  WochenplanPlanArchivedError,
  WochenplanPlanNotFoundError,
} from "@/lib/wochenplan/plan-errors";
import { WeekplannerPlanValidationError } from "@/lib/weekplanner/plan-errors";

const VIEW_PERMISSIONS = [PERMISSIONS.WOCHENPLAN_MANAGE, PERMISSIONS.EVENTS_VIEW] as const;
const MANAGE_PERMISSIONS = [PERMISSIONS.WOCHENPLAN_MANAGE, PERMISSIONS.EVENTS_MANAGE] as const;

export async function GET() {
  const auth = await requireApiAnyPermission([...VIEW_PERMISSIONS]);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const tenantId = auth.session.user?.activeTenantId;
  if (!tenantId) return NextResponse.json({ error: "Tenant context required" }, { status: 400 });

  const plans = await listWochenplanPlans(tenantId);
  return NextResponse.json({ plans });
}

export async function POST(request: NextRequest) {
  const auth = await requireApiAnyPermission([...MANAGE_PERMISSIONS]);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const tenantId = auth.session.user?.activeTenantId;
  if (!tenantId) return NextResponse.json({ error: "Tenant context required" }, { status: 400 });

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Request body required" }, { status: 400 });

  if (typeof body.name !== "string" || !body.name.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const weekId = typeof body.weekId === "string" ? body.weekId.trim() : "";
  const mode: WochenplanPlanCreationMode =
    body.mode === "copy" ? "copy" : body.mode === "empty" ? "empty" : "empty";
  const sourceWochenplanPlanId =
    typeof body.sourceWochenplanPlanId === "string" ? body.sourceWochenplanPlanId.trim() : null;

  try {
    if (weekId) {
      const result = await createWochenplanPlanWithWeek(tenantId, {
        name: body.name,
        description: typeof body.description === "string" ? body.description : null,
        weekId,
        mode,
        sourceWochenplanPlanId,
        createdByUserId: auth.session.user?.id ?? null,
      });
      return NextResponse.json(result, { status: 201 });
    }

    const plan = await createWochenplanPlan(tenantId, {
      name: body.name,
      description: typeof body.description === "string" ? body.description : null,
    });
    return NextResponse.json({ plan }, { status: 201 });
  } catch (err) {
    if (err instanceof WochenplanPlanNotFoundError) {
      return NextResponse.json({ error: "Source plan not found" }, { status: 404 });
    }
    if (err instanceof WochenplanPlanValidationError || err instanceof WeekplannerPlanValidationError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    if (err instanceof WochenplanPlanNameConflictError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    if (err instanceof WochenplanPlanArchivedError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    throw err;
  }
}
