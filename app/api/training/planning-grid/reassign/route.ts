/**
 * POST /api/training/planning-grid/reassign
 *
 * TRAINING-CENTER-PREMIUM-03 — canonical resource reassignment from the
 * planning grid with explicit occurrence vs series scope.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireApiAnyPermission } from "@/lib/permissions/require-api-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { reassignPlanningGridResource } from "@/lib/training/planning-grid/reassignment-service";
import { isValidPlanningCategory } from "@/lib/training/planning-grid/data-service";
import { TrainingSessionNotFoundError } from "@/lib/training/errors";
import type { ResourceReassignmentScope } from "@/lib/training/planning-grid/types";

function isValidScope(value: unknown): value is ResourceReassignmentScope {
  return value === "occurrence" || value === "series";
}

export async function POST(request: NextRequest) {
  const auth = await requireApiAnyPermission([PERMISSIONS.TRAININGS_MANAGE]);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const tenantId = auth.session.user?.activeTenantId;
  if (!tenantId) return NextResponse.json({ error: "Tenant context required" }, { status: 400 });

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Request body required" }, { status: 400 });

  const { sessionId, targetResourceId, category, scope } = body;

  if (typeof sessionId !== "string" || !sessionId.trim()) {
    return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
  }
  if (typeof targetResourceId !== "string" || !targetResourceId.trim()) {
    return NextResponse.json({ error: "targetResourceId is required" }, { status: 400 });
  }
  if (typeof category !== "string" || !isValidPlanningCategory(category)) {
    return NextResponse.json({ error: "Valid category is required" }, { status: 400 });
  }
  if (!isValidScope(scope)) {
    return NextResponse.json({ error: "scope must be occurrence or series" }, { status: 400 });
  }

  try {
    await reassignPlanningGridResource({
      tenantId,
      sessionId: sessionId.trim(),
      targetResourceId: targetResourceId.trim(),
      category,
      scope,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof TrainingSessionNotFoundError) {
      return NextResponse.json({ error: "Training session not found" }, { status: 404 });
    }
    if (err instanceof Error) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    throw err;
  }
}
