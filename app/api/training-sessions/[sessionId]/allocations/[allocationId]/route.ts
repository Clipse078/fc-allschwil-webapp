/**
 * DELETE /api/training-sessions/[sessionId]/allocations/[allocationId]
 *
 * TRAININGCENTER-02 — removes one occurrence-level allocation override.
 * When this removes the last override row for an allocation group
 * (Spielfeld/Halle or Garderobe), that group reverts to the TrainingSeries
 * default for this occurrence — see session-allocation-service.ts.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireApiAnyPermission } from "@/lib/permissions/require-api-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import {
  getTrainingSessionAllocation,
  deleteTrainingSessionAllocation,
} from "@/lib/training/session-allocation-service";
import { TrainingSessionAllocationNotFoundError } from "@/lib/training/errors";

type Params = { params: Promise<{ sessionId: string; allocationId: string }> };

export async function DELETE(_request: NextRequest, { params }: Params) {
  const auth = await requireApiAnyPermission([PERMISSIONS.TRAININGS_MANAGE]);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const tenantId = auth.session.user?.activeTenantId;
  if (!tenantId) return NextResponse.json({ error: "Tenant context required" }, { status: 400 });

  const { sessionId, allocationId } = await params;

  try {
    // Enforce URL ownership before mutation
    const existing = await getTrainingSessionAllocation(tenantId, allocationId);
    if (existing.trainingSessionId !== sessionId) {
      return NextResponse.json({ error: "Allocation not found" }, { status: 404 });
    }
    await deleteTrainingSessionAllocation(tenantId, allocationId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof TrainingSessionAllocationNotFoundError) {
      return NextResponse.json({ error: "Allocation not found" }, { status: 404 });
    }
    throw err;
  }
}
