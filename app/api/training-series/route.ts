/**
 * POST /api/training-series
 *
 * TRAININGCENTER-03A: creates a TrainingSeries and immediately generates its
 * canonical TrainingSession rows (via the TRAININGCENTER-02 generation
 * service) across [validFrom, validUntil] — "Save" always produces the
 * concrete, dated occurrences the rest of the TrainingCenter reads from.
 *
 * Body:
 *   teamSeasonId     string, required
 *   title            string, required
 *   description      string | null, optional
 *   timezone         string, optional (defaults to "Europe/Zurich")
 *   validFrom        "YYYY-MM-DD", required — generation window lower bound
 *   validUntil       "YYYY-MM-DD", required — generation window upper bound
 *   weekdaySchedules [{ weekday, startsAt, endsAt }, ...], required, >= 1 entry
 */

import { NextRequest, NextResponse } from "next/server";
import { requireApiAnyPermission } from "@/lib/permissions/require-api-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { createTrainingSeries, getTrainingSeries } from "@/lib/training/training-service";
import { generateTrainingSessions } from "@/lib/training/session-generation-service";
import {
  TrainingSeriesValidationError,
  TrainingSeriesConflictError,
  TrainingSeriesTeamSeasonNotFoundError,
  TrainingSeriesArchivedTeamError,
} from "@/lib/training/errors";
import { parseWeekdaySchedules, parseRequiredDate } from "@/lib/training/series-request-helpers";

export async function POST(request: NextRequest) {
  const auth = await requireApiAnyPermission([PERMISSIONS.TRAININGS_MANAGE]);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const tenantId = auth.session.user?.activeTenantId;
  if (!tenantId) return NextResponse.json({ error: "Tenant context required" }, { status: 400 });

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Request body required" }, { status: 400 });
  }

  const teamSeasonId = typeof body.teamSeasonId === "string" ? body.teamSeasonId.trim() : "";
  if (!teamSeasonId) {
    return NextResponse.json({ error: "teamSeasonId is required" }, { status: 400 });
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
    const created = await createTrainingSeries(tenantId, {
      teamSeasonId,
      title,
      description: typeof body.description === "string" ? body.description.trim() || null : null,
      timezone: typeof body.timezone === "string" && body.timezone.trim() ? body.timezone.trim() : "Europe/Zurich",
      startsAt: schedules.value.startsAt,
      endsAt: schedules.value.endsAt,
      weekdays: schedules.value.weekdays,
      weekdayTimes: schedules.value.weekdayTimes,
      validFrom: validFrom.value,
      validUntil: validUntil.value,
    });

    const generation = await generateTrainingSessions(tenantId, created.id, {
      from: validFrom.value,
      to: validUntil.value,
    });

    const series = await getTrainingSeries(tenantId, created.id);

    return NextResponse.json({ series, generation }, { status: 201 });
  } catch (err) {
    if (err instanceof TrainingSeriesValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    if (err instanceof TrainingSeriesTeamSeasonNotFoundError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    if (err instanceof TrainingSeriesArchivedTeamError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    if (err instanceof TrainingSeriesConflictError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    throw err;
  }
}
