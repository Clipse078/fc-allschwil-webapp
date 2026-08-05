import { NextRequest, NextResponse } from "next/server";
import { requireApiAnyPermission } from "@/lib/permissions/require-api-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import {
  createTrainingAllocation,
  listAllocationsByTrainingSeries,
} from "@/lib/training/training-allocation-service";
import {
  TrainingSeriesNotFoundError,
  TrainingAllocationResourceNotFoundError,
  TrainingAllocationArchivedResourceError,
  TrainingAllocationArchivedFacilityError,
  TrainingAllocationDuplicateError,
} from "@/lib/training/errors";

type Params = { params: Promise<{ seriesId: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const auth = await requireApiAnyPermission([
    PERMISSIONS.TRAININGS_VIEW,
    PERMISSIONS.TRAININGS_MANAGE,
  ]);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const tenantId = auth.session.user?.activeTenantId;
  if (!tenantId) return NextResponse.json({ error: "Tenant context required" }, { status: 400 });

  const { seriesId } = await params;

  try {
    const allocations = await listAllocationsByTrainingSeries(tenantId, seriesId);
    return NextResponse.json({ allocations });
  } catch (err) {
    if (err instanceof TrainingSeriesNotFoundError) {
      return NextResponse.json({ error: "Training series not found" }, { status: 404 });
    }
    throw err;
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  const auth = await requireApiAnyPermission([PERMISSIONS.TRAININGS_MANAGE]);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const tenantId = auth.session.user?.activeTenantId;
  if (!tenantId) return NextResponse.json({ error: "Tenant context required" }, { status: 400 });

  const { seriesId } = await params;

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Request body required" }, { status: 400 });

  if (typeof body.facilityResourceId !== "string" || !body.facilityResourceId.trim()) {
    return NextResponse.json({ error: "facilityResourceId is required" }, { status: 400 });
  }

  try {
    const allocation = await createTrainingAllocation(tenantId, {
      trainingSeriesId: seriesId,
      facilityResourceId: body.facilityResourceId.trim(),
      notes: typeof body.notes === "string" ? body.notes.trim() || null : null,
      displayOrder: typeof body.displayOrder === "number" ? body.displayOrder : undefined,
    });
    return NextResponse.json({ allocation }, { status: 201 });
  } catch (err) {
    if (err instanceof TrainingSeriesNotFoundError) {
      return NextResponse.json({ error: "Training series not found" }, { status: 404 });
    }
    if (err instanceof TrainingAllocationResourceNotFoundError) {
      return NextResponse.json({ error: "Facility resource not found" }, { status: 404 });
    }
    if (err instanceof TrainingAllocationArchivedResourceError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    if (err instanceof TrainingAllocationArchivedFacilityError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    if (err instanceof TrainingAllocationDuplicateError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    throw err;
  }
}
