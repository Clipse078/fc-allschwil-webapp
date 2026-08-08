/**
 * PATCH /api/training-sessions/[sessionId]/reschedule
 * DELETE /api/training-sessions/[sessionId]/reschedule
 *
 * TRAININGCENTER-02 — single-occurrence date/time exception handling: edit
 * one canonical TrainingSession's effective date and/or start/end time
 * without mutating its parent TrainingSeries recurrence definition.
 *
 * PATCH body:
 *   startsAt  "HH:mm", required
 *   endsAt    "HH:mm", required, must be after startsAt
 *   date      "YYYY-MM-DD", optional — omit to keep the canonical date
 *
 * DELETE clears any existing override, reverting to the TrainingSeries
 * default (equivalent to PATCH-ing back the canonical values).
 *
 * Permission: TRAININGS_MANAGE
 * Tenant isolation: tenantId resolved from session, never from request body.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireApiAnyPermission } from "@/lib/permissions/require-api-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { rescheduleTrainingSession, resetTrainingSessionSchedule } from "@/lib/training/session-reschedule-service";
import {
  TrainingSessionInvalidTransitionError,
  TrainingSessionNotFoundError,
  TrainingSessionRescheduleValidationError,
} from "@/lib/training/errors";

type Params = { params: Promise<{ sessionId: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const auth = await requireApiAnyPermission([PERMISSIONS.TRAININGS_MANAGE]);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const tenantId = auth.session.user?.activeTenantId;
  if (!tenantId) return NextResponse.json({ error: "Tenant context required" }, { status: 400 });

  const { sessionId } = await params;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Request body required" }, { status: 400 });
  }

  if (typeof body.startsAt !== "string" || typeof body.endsAt !== "string") {
    return NextResponse.json({ error: "startsAt and endsAt are required" }, { status: 400 });
  }

  try {
    const session = await rescheduleTrainingSession(tenantId, sessionId, {
      startsAt: body.startsAt,
      endsAt: body.endsAt,
      date: typeof body.date === "string" ? body.date : null,
    });
    return NextResponse.json({ session });
  } catch (err) {
    if (err instanceof TrainingSessionNotFoundError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    if (err instanceof TrainingSessionInvalidTransitionError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    if (err instanceof TrainingSessionRescheduleValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const auth = await requireApiAnyPermission([PERMISSIONS.TRAININGS_MANAGE]);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const tenantId = auth.session.user?.activeTenantId;
  if (!tenantId) return NextResponse.json({ error: "Tenant context required" }, { status: 400 });

  const { sessionId } = await params;

  try {
    const session = await resetTrainingSessionSchedule(tenantId, sessionId);
    return NextResponse.json({ session });
  } catch (err) {
    if (err instanceof TrainingSessionNotFoundError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    if (err instanceof TrainingSessionInvalidTransitionError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    throw err;
  }
}
