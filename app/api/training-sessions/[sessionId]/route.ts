/**
 * PATCH /api/training-sessions/[sessionId]
 *
 * TRAININGCENTER-01 — single-occurrence exception handling: cancel or
 * restore one canonical TrainingSession without mutating its parent
 * TrainingSeries recurrence definition.
 *
 * Body:
 *   status  "CANCELLED" | "SCHEDULED", required
 *
 * Only these two transitions are exposed:
 *   SCHEDULED -> CANCELLED  (cancel a single occurrence, e.g. holiday, ad-hoc)
 *   CANCELLED -> SCHEDULED  (restore/undo a cancellation)
 *
 * POSTPONED/MOVED (rescheduling a single occurrence's date/time/allocation)
 * are reserved for a future PR — see session-lifecycle-service.ts.
 *
 * Permission: TRAININGS_MANAGE
 * Tenant isolation: tenantId resolved from session, never from request body.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireApiAnyPermission } from "@/lib/permissions/require-api-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { cancelTrainingSession, restoreTrainingSession } from "@/lib/training/session-lifecycle-service";
import {
  TrainingSessionInvalidTransitionError,
  TrainingSessionNotFoundError,
} from "@/lib/training/errors";

type Params = { params: Promise<{ sessionId: string }> };

const ALLOWED_STATUSES = ["CANCELLED", "SCHEDULED"] as const;
type AllowedStatus = (typeof ALLOWED_STATUSES)[number];

function isAllowedStatus(value: unknown): value is AllowedStatus {
  return typeof value === "string" && (ALLOWED_STATUSES as readonly string[]).includes(value);
}

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

  if (!isAllowedStatus(body.status)) {
    return NextResponse.json(
      { error: `status must be one of: ${ALLOWED_STATUSES.join(", ")}` },
      { status: 400 },
    );
  }

  try {
    const session =
      body.status === "CANCELLED"
        ? await cancelTrainingSession(tenantId, sessionId)
        : await restoreTrainingSession(tenantId, sessionId);

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
