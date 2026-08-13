/**
 * PUT /api/training-series/[seriesId]    — update a TrainingSeries and re-generate
 * DELETE /api/training-series/[seriesId] — archive a TrainingSeries (soft; history preserved)
 *
 * TRAININGCENTER-03A.
 *
 * PUT re-runs generateTrainingSessions() across the (possibly new)
 * [validFrom, validUntil] window on every save. Generation is idempotent
 * (TRAININGCENTER-02): re-saving never duplicates existing sessions, and
 * extending the range only creates the newly missing occurrences.
 * teamSeasonId is immutable after creation — a TrainingSeries belongs to
 * exactly one TeamSeason for its lifetime.
 *
 * DELETE archives (status -> ARCHIVED); it does not touch already-generated
 * TrainingSession rows, so generated history is preserved.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { createPlanningAuthorizationPolicy } from "@/lib/planning/planning-authorization-policy";
import { updateTrainingSeries, archiveTrainingSeries, getTrainingSeries } from "@/lib/training/training-service";
import { generateTrainingSessions } from "@/lib/training/session-generation-service";
import { TrainingSeriesNotFoundError, TrainingSeriesValidationError, TrainingSeriesConflictError } from "@/lib/training/errors";
import { parseWeekdaySchedules, parseRequiredDate } from "@/lib/training/series-request-helpers";
import type { PlanningRecord } from "@/lib/planning/planning-authorization-policy";

type Params = { params: Promise<{ seriesId: string }> };

export async function PUT(request: NextRequest, { params }: Params) {
  // ORG-ACCESS-03: accept tenant-wide coordinators AND OrgUnit-scoped users.
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tenantId = session.user?.activeTenantId;
  if (!tenantId) return NextResponse.json({ error: "Tenant context required" }, { status: 400 });

  const userId = session.user.effectiveUserId ?? session.user.id;
  if (!userId) return NextResponse.json({ error: "User identity required" }, { status: 403 });

  const { seriesId } = await params;

  // ORG-ACCESS-03: load the series to check edit authorization.
  const existingSeries = await prisma.trainingSeries.findFirst({
    where: { id: seriesId, tenantId },
    select: {
      id: true,
      planningStage: true,
      teamSeason: { select: { teamId: true } },
    },
  });
  if (!existingSeries) {
    return NextResponse.json({ error: "Trainingsserie nicht gefunden." }, { status: 404 });
  }

  const planningRecord: PlanningRecord = {
    teamId: existingSeries.teamSeason?.teamId ?? null,
    planningStage: existingSeries.planningStage,
  };
  const planningPolicy = createPlanningAuthorizationPolicy(prisma);
  const canEdit = await planningPolicy.canEditPlanningRecord(
    { userId, tenantId },
    "training",
    planningRecord,
  );
  if (!canEdit) {
    return NextResponse.json(
      { error: "Keine Berechtigung zum Bearbeiten dieser Trainingsserie." },
      { status: 403 },
    );
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Request body required" }, { status: 400 });
  }

  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }

  const validFrom = parseRequiredDate(body.validFrom, "validFrom");
  if (!validFrom.ok) return NextResponse.json({ error: validFrom.error }, { status: 400 });

  const validUntil = parseRequiredDate(body.validUntil, "validUntil");
  if (!validUntil.ok) return NextResponse.json({ error: validUntil.error }, { status: 400 });

  if (validFrom.value >= validUntil.value) {
    return NextResponse.json({ error: "validFrom must be before validUntil" }, { status: 400 });
  }

  const schedules = parseWeekdaySchedules(body.weekdaySchedules);
  if (!schedules.ok) return NextResponse.json({ error: schedules.error }, { status: 400 });

  try {
    await updateTrainingSeries(tenantId, seriesId, {
      title,
      description: typeof body.description === "string" ? body.description.trim() || null : null,
      timezone: typeof body.timezone === "string" && body.timezone.trim() ? body.timezone.trim() : undefined,
      startsAt: schedules.value.startsAt,
      endsAt: schedules.value.endsAt,
      weekdays: schedules.value.weekdays,
      weekdayTimes: schedules.value.weekdayTimes,
      validFrom: validFrom.value,
      validUntil: validUntil.value,
    });

    const generation = await generateTrainingSessions(tenantId, seriesId, {
      from: validFrom.value,
      to: validUntil.value,
    });

    const series = await getTrainingSeries(tenantId, seriesId);

    return NextResponse.json({ series, generation });
  } catch (err) {
    if (err instanceof TrainingSeriesValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    if (err instanceof TrainingSeriesNotFoundError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    if (err instanceof TrainingSeriesConflictError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    throw err;
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  // ORG-ACCESS-03: archive is an edit-level action — same scope as PUT.
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tenantId = session.user?.activeTenantId;
  if (!tenantId) return NextResponse.json({ error: "Tenant context required" }, { status: 400 });

  const userId = session.user.effectiveUserId ?? session.user.id;
  if (!userId) return NextResponse.json({ error: "User identity required" }, { status: 403 });

  const { seriesId } = await params;

  // Scope check: user must be coordinator or have edit rights on DRAFT records.
  const existingSeries = await prisma.trainingSeries.findFirst({
    where: { id: seriesId, tenantId },
    select: {
      id: true,
      planningStage: true,
      teamSeason: { select: { teamId: true } },
    },
  });
  if (!existingSeries) {
    return NextResponse.json({ error: "Trainingsserie nicht gefunden." }, { status: 404 });
  }

  const planningRecord: PlanningRecord = {
    teamId: existingSeries.teamSeason?.teamId ?? null,
    planningStage: existingSeries.planningStage,
  };
  const planningPolicy = createPlanningAuthorizationPolicy(prisma);
  const canEdit = await planningPolicy.canEditPlanningRecord(
    { userId, tenantId },
    "training",
    planningRecord,
  );
  if (!canEdit) {
    return NextResponse.json(
      { error: "Keine Berechtigung zum Archivieren dieser Trainingsserie." },
      { status: 403 },
    );
  }

  try {
    const series = await archiveTrainingSeries(tenantId, seriesId);
    return NextResponse.json({ series });
  } catch (err) {
    if (err instanceof TrainingSeriesNotFoundError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    throw err;
  }
}
