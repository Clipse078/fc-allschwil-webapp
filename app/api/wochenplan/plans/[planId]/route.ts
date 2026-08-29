/**
 * GET   /api/wochenplan/plans/[planId]
 * PATCH /api/wochenplan/plans/[planId] — rename ({ name }) or activate ({ active: true })
 *
 * WOCHENPLAN-2.0-01B — minimal tenant-level plan lifecycle.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireApiAnyPermission } from "@/lib/permissions/require-api-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import {
  getWochenplanPlan,
  renameWochenplanPlan,
  activateWochenplanPlan,
} from "@/lib/wochenplan/plan-service";
import {
  WochenplanPlanNotFoundError,
  WochenplanPlanValidationError,
  WochenplanPlanNameConflictError,
  WochenplanPlanArchivedError,
  WochenplanPlanActivationConflictError,
} from "@/lib/wochenplan/plan-errors";

const VIEW_PERMISSIONS = [PERMISSIONS.WOCHENPLAN_MANAGE, PERMISSIONS.EVENTS_VIEW] as const;
const MANAGE_PERMISSIONS = [PERMISSIONS.WOCHENPLAN_MANAGE, PERMISSIONS.EVENTS_MANAGE] as const;

type Params = { params: Promise<{ planId: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const auth = await requireApiAnyPermission([...VIEW_PERMISSIONS]);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const tenantId = auth.session.user?.activeTenantId;
  if (!tenantId) return NextResponse.json({ error: "Tenant context required" }, { status: 400 });

  const { planId } = await params;

  try {
    const plan = await getWochenplanPlan(tenantId, planId);
    return NextResponse.json({ plan });
  } catch (err) {
    if (err instanceof WochenplanPlanNotFoundError) {
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
    if (body.active === true) {
      const plan = await activateWochenplanPlan(tenantId, planId);
      return NextResponse.json({ plan });
    }

    if (typeof body.name === "string") {
      const plan = await renameWochenplanPlan(tenantId, planId, body.name);
      return NextResponse.json({ plan });
    }

    return NextResponse.json(
      { error: "Provide { name } to rename or { active: true } to activate as public plan" },
      { status: 400 },
    );
  } catch (err) {
    if (err instanceof WochenplanPlanNotFoundError) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }
    if (err instanceof WochenplanPlanValidationError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    if (err instanceof WochenplanPlanNameConflictError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    if (err instanceof WochenplanPlanArchivedError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    if (err instanceof WochenplanPlanActivationConflictError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    throw err;
  }
}
