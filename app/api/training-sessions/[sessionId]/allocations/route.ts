/**
 * GET  /api/training-sessions/[sessionId]/allocations
 * POST /api/training-sessions/[sessionId]/allocations
 *
 * TRAININGCENTER-02 — occurrence-level resource allocation overrides
 * (TrainingSessionAllocation). Mirrors
 * app/api/training-series/[seriesId]/allocations/route.ts exactly, scoped
 * to a single canonical TrainingSession occurrence instead of the
 * recurring TrainingSeries.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireApiAnyPermission } from "@/lib/permissions/require-api-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import {
  createTrainingSessionAllocation,
  listAllocationsByTrainingSession,
} from "@/lib/training/session-allocation-service";
import {
  TrainingSessionNotFoundError,
  TrainingSessionAllocationResourceNotFoundError,
  TrainingSessionAllocationArchivedResourceError,
  TrainingSessionAllocationArchivedFacilityError,
  TrainingSessionAllocationDuplicateError,
} from "@/lib/training/errors";

type Params = { params: Promise<{ sessionId: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const auth = await requireApiAnyPermission([
    PERMISSIONS.TRAININGS_VIEW,
    PERMISSIONS.TRAININGS_MANAGE,
  ]);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const tenantId = auth.session.user?.activeTenantId;
  if (!tenantId) return NextResponse.json({ error: "Tenant context required" }, { status: 400 });

  const { sessionId } = await params;

  try {
    const allocations = await listAllocationsByTrainingSession(tenantId, sessionId);
    return NextResponse.json({ allocations });
  } catch (err) {
    if (err instanceof TrainingSessionNotFoundError) {
      return NextResponse.json({ error: "Training session not found" }, { status: 404 });
    }
    throw err;
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  const auth = await requireApiAnyPermission([PERMISSIONS.TRAININGS_MANAGE]);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const tenantId = auth.session.user?.activeTenantId;
  if (!tenantId) return NextResponse.json({ error: "Tenant context required" }, { status: 400 });

  const { sessionId } = await params;

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Request body required" }, { status: 400 });

  if (typeof body.facilityResourceId !== "string" || !body.facilityResourceId.trim()) {
    return NextResponse.json({ error: "facilityResourceId is required" }, { status: 400 });
  }

  try {
    const allocation = await createTrainingSessionAllocation(tenantId, {
      trainingSessionId: sessionId,
      facilityResourceId: body.facilityResourceId.trim(),
      notes: typeof body.notes === "string" ? body.notes.trim() || null : null,
      displayOrder: typeof body.displayOrder === "number" ? body.displayOrder : undefined,
    });
    return NextResponse.json({ allocation }, { status: 201 });
  } catch (err) {
    if (err instanceof TrainingSessionNotFoundError) {
      return NextResponse.json({ error: "Training session not found" }, { status: 404 });
    }
    if (err instanceof TrainingSessionAllocationResourceNotFoundError) {
      return NextResponse.json({ error: "Facility resource not found" }, { status: 404 });
    }
    if (err instanceof TrainingSessionAllocationArchivedResourceError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    if (err instanceof TrainingSessionAllocationArchivedFacilityError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    if (err instanceof TrainingSessionAllocationDuplicateError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    throw err;
  }
}
