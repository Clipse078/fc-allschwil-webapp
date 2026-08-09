/**
 * GET    /api/weekplanner/plans/[planId]
 * PATCH  /api/weekplanner/plans/[planId]  — rename ({ name }), archive
 *        ({ archived: true }), or activate/deactivate as the OPERATIONAL
 *        plan ({ active: true } / { active: false }) — WEEKPLANNER-01E.
 * DELETE /api/weekplanner/plans/[planId]  — hard delete, only when safe (zero overrides)
 *
 * WEEKPLANNER-01B — minimal plan lifecycle management (rename / archive /
 * delete-where-safe). No restore endpoint — out of product scope for this
 * slice (see prisma/schema.prisma#WeekplannerPlan doc comment).
 */

import { NextRequest, NextResponse } from "next/server";
import { requireApiAnyPermission } from "@/lib/permissions/require-api-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import {
  getWeekplannerPlan,
  renameWeekplannerPlan,
  archiveWeekplannerPlan,
  deleteWeekplannerPlan,
  activateWeekplannerPlan,
  deactivateWeekplannerPlan,
} from "@/lib/weekplanner/plan-service";
import {
  WeekplannerPlanNotFoundError,
  WeekplannerPlanValidationError,
  WeekplannerPlanNameConflictError,
  WeekplannerPlanArchivedError,
  WeekplannerPlanDeleteUnsafeError,
} from "@/lib/weekplanner/plan-errors";

const VIEW_PERMISSIONS = [
  PERMISSIONS.TRAININGS_VIEW,
  PERMISSIONS.TRAININGS_MANAGE,
  PERMISSIONS.EVENTS_VIEW,
  PERMISSIONS.EVENTS_MANAGE,
] as const;

const MANAGE_PERMISSIONS = [PERMISSIONS.TRAININGS_MANAGE, PERMISSIONS.EVENTS_MANAGE] as const;

type Params = { params: Promise<{ planId: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const auth = await requireApiAnyPermission([...VIEW_PERMISSIONS]);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const tenantId = auth.session.user?.activeTenantId;
  if (!tenantId) return NextResponse.json({ error: "Tenant context required" }, { status: 400 });

  const { planId } = await params;

  try {
    const plan = await getWeekplannerPlan(tenantId, planId);
    return NextResponse.json({ plan });
  } catch (err) {
    if (err instanceof WeekplannerPlanNotFoundError) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }
    throw err;
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const auth = await requireApiAnyPermission([...MANAGE_PERMISSIONS]);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const tenantId = auth.session.user?.activeTenantId;
  if (!tenantId) return NextResponse.json({ error: "Tenant context required" }, { status: 400 });

  const { planId } = await params;
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Request body required" }, { status: 400 });

  try {
    if (body.archived === true) {
      const plan = await archiveWeekplannerPlan(tenantId, planId);
      return NextResponse.json({ plan });
    }

    if (body.active === true) {
      const plan = await activateWeekplannerPlan(tenantId, planId);
      return NextResponse.json({ plan });
    }

    if (body.active === false) {
      const plan = await deactivateWeekplannerPlan(tenantId, planId);
      return NextResponse.json({ plan });
    }

    if (typeof body.name === "string") {
      const plan = await renameWeekplannerPlan(tenantId, planId, body.name);
      return NextResponse.json({ plan });
    }

    return NextResponse.json(
      { error: "Provide { name } to rename, { archived: true } to archive, or { active: true|false } to activate/deactivate" },
      { status: 400 },
    );
  } catch (err) {
    if (err instanceof WeekplannerPlanNotFoundError) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }
    if (err instanceof WeekplannerPlanValidationError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    if (err instanceof WeekplannerPlanNameConflictError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    if (err instanceof WeekplannerPlanArchivedError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    throw err;
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const auth = await requireApiAnyPermission([...MANAGE_PERMISSIONS]);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const tenantId = auth.session.user?.activeTenantId;
  if (!tenantId) return NextResponse.json({ error: "Tenant context required" }, { status: 400 });

  const { planId } = await params;

  try {
    await deleteWeekplannerPlan(tenantId, planId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof WeekplannerPlanNotFoundError) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }
    if (err instanceof WeekplannerPlanDeleteUnsafeError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    throw err;
  }
}
