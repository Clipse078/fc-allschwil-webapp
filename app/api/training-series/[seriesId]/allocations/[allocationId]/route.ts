import { NextRequest, NextResponse } from "next/server";
import { requireApiAnyPermission } from "@/lib/permissions/require-api-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import {
  getTrainingAllocation,
  updateTrainingAllocation,
  deleteTrainingAllocation,
} from "@/lib/training/training-allocation-service";
import { TrainingAllocationNotFoundError } from "@/lib/training/errors";

type Params = { params: Promise<{ seriesId: string; allocationId: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const auth = await requireApiAnyPermission([
    PERMISSIONS.TRAININGS_VIEW,
    PERMISSIONS.TRAININGS_MANAGE,
  ]);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const tenantId = auth.session.user?.tenantId;
  if (!tenantId) return NextResponse.json({ error: "Tenant context required" }, { status: 400 });

  const { allocationId } = await params;

  try {
    const allocation = await getTrainingAllocation(tenantId, allocationId);
    return NextResponse.json({ allocation });
  } catch (err) {
    if (err instanceof TrainingAllocationNotFoundError) {
      return NextResponse.json({ error: "Allocation not found" }, { status: 404 });
    }
    throw err;
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const auth = await requireApiAnyPermission([PERMISSIONS.TRAININGS_MANAGE]);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const tenantId = auth.session.user?.tenantId;
  if (!tenantId) return NextResponse.json({ error: "Tenant context required" }, { status: 400 });

  const { allocationId } = await params;

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Request body required" }, { status: 400 });

  const input: { notes?: string | null; displayOrder?: number } = {};
  if (body.notes !== undefined) {
    input.notes = typeof body.notes === "string" ? body.notes.trim() || null : null;
  }
  if (typeof body.displayOrder === "number") {
    input.displayOrder = body.displayOrder;
  }

  if (Object.keys(input).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  try {
    const allocation = await updateTrainingAllocation(tenantId, allocationId, input);
    return NextResponse.json({ allocation });
  } catch (err) {
    if (err instanceof TrainingAllocationNotFoundError) {
      return NextResponse.json({ error: "Allocation not found" }, { status: 404 });
    }
    throw err;
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const auth = await requireApiAnyPermission([PERMISSIONS.TRAININGS_MANAGE]);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const tenantId = auth.session.user?.tenantId;
  if (!tenantId) return NextResponse.json({ error: "Tenant context required" }, { status: 400 });

  const { allocationId } = await params;

  try {
    await deleteTrainingAllocation(tenantId, allocationId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof TrainingAllocationNotFoundError) {
      return NextResponse.json({ error: "Allocation not found" }, { status: 404 });
    }
    throw err;
  }
}
