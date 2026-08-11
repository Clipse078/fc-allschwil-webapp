/**
 * POST /api/training-series
 *
 * TRAININGCENTER-03A: creates a TrainingSeries and immediately generates its
 * canonical TrainingSession rows (via the TRAININGCENTER-02 generation
 * service) across [validFrom, validUntil] — "Save" always produces the
 * concrete, dated occurrences the rest of the TrainingCenter reads from.
 *
 * RESOURCE-AVAILABILITY-UX-01-C1 / -C1-V: also accepts the series' initial
 * Spielfeld/Halle + Garderobe default allocations (`facilityResourceIds`)
 * and persists them as TrainingAllocation rows in THIS SAME request/server
 * invocation — see below for why this must not be a separate client-driven
 * follow-up request, and why a failed allocation must roll back the
 * series/sessions rather than leave them behind.
 *
 * Body:
 *   teamSeasonId        string, required
 *   title               string, required
 *   description         string | null, optional
 *   timezone            string, optional (defaults to "Europe/Zurich")
 *   validFrom           "YYYY-MM-DD", required — generation window lower bound
 *   validUntil          "YYYY-MM-DD", required — generation window upper bound
 *   weekdaySchedules    [{ weekday, startsAt, endsAt }, ...], required, >= 1 entry
 *   facilityResourceIds string[], optional — default resource allocations for the series
 *
 * Root-cause fix (RESOURCE-AVAILABILITY-UX-01-C1): previously, the guided
 * creation form persisted a series' default allocations via SEPARATE,
 * sequential client-driven requests AFTER this one succeeded (see
 * lib/training/create-training-series-orchestration.ts). Because those
 * follow-up requests were not tied to this one, any interruption between
 * them (closed tab, navigation, lost connection, client crash) left a fully
 * valid, correctly-generated TrainingSeries with its recurring
 * TrainingSessions permanently allocation-less — reproducing exactly as
 * "Spielfeld/Halle: Keine Ressource zugewiesen" / "Garderobe: Keine
 * Ressource zugewiesen" on every generated occurrence, with no error ever
 * surfaced.
 *
 * RESOURCE-AVAILABILITY-UX-01-C1-V correctness fix: creating the series,
 * generating its sessions, and persisting the requested default
 * allocations are three separate Prisma call sites (createTrainingSeries,
 * generateTrainingSessions, createTrainingAllocation per resource) — this
 * request is NOT one Prisma transaction. The original fix merely collected
 * a failed facilityResourceId into an `allocationErrors` array while still
 * returning 201 with the already-created series/sessions — exactly the
 * "successful but partially configured series" this endpoint exists to
 * prevent. Now: if ANY requested facilityResourceId fails to allocate, the
 * just-created TrainingSeries is rolled back via the EXISTING
 * deleteTrainingSeriesPermanently() (lib/training/training-lifecycle-
 * service.ts) — itself a single Prisma transaction whose FK cascades
 * remove the series' TrainingSessions and any TrainingAllocation rows
 * already attached — and the request fails instead of returning 201. This
 * guarantees a 201 response never refers to a series missing a requested
 * default allocation, with no schema change and no redesign of the
 * generation/allocation services themselves.
 *
 * Every generated TrainingSession already resolves its EFFECTIVE allocation
 * from its parent TrainingSeries' TrainingAllocation rows at read time (see
 * lib/training/operational-state.ts, view-model.ts,
 * session-allocation-service.ts, lib/facilities/availability-service.ts,
 * lib/weekplanner/queries.ts) — so once the default allocations exist here,
 * every occurrence (present AND future, since generation always reads the
 * series' current allocations at generation time) inherits them
 * automatically; no TrainingSession-level copy is written or needed.
 * Individual occurrence overrides (TrainingSessionAllocation) remain
 * completely unaffected by this route.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireApiAnyPermission } from "@/lib/permissions/require-api-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { createTrainingSeries, getTrainingSeries } from "@/lib/training/training-service";
import { generateTrainingSessions } from "@/lib/training/session-generation-service";
import { createTrainingAllocation } from "@/lib/training/training-allocation-service";
import { deleteTrainingSeriesPermanently } from "@/lib/training/training-lifecycle-service";
import {
  TrainingSeriesValidationError,
  TrainingSeriesConflictError,
  TrainingSeriesTeamSeasonNotFoundError,
  TrainingSeriesArchivedTeamError,
  TrainingAllocationResourceNotFoundError,
  TrainingAllocationArchivedResourceError,
  TrainingAllocationArchivedFacilityError,
  TrainingAllocationDuplicateError,
  TrainingAllocationTenantMismatchError,
} from "@/lib/training/errors";
import {
  parseWeekdaySchedules,
  parseRequiredDate,
  parseFacilityResourceIds,
} from "@/lib/training/series-request-helpers";

/**
 * Maps an allocation-validation error to the HTTP status the standalone
 * POST /api/training-series/:id/allocations endpoint already uses for the
 * same error type, so a resource rejected during series creation and a
 * resource rejected via the standalone allocations page fail the same way.
 */
function allocationErrorStatus(err: unknown): number {
  if (err instanceof TrainingAllocationResourceNotFoundError) return 404;
  if (err instanceof TrainingAllocationArchivedResourceError) return 422;
  if (err instanceof TrainingAllocationArchivedFacilityError) return 422;
  if (err instanceof TrainingAllocationDuplicateError) return 409;
  if (err instanceof TrainingAllocationTenantMismatchError) return 409;
  return 422;
}

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

  const facilityResourceIds = parseFacilityResourceIds(body.facilityResourceIds);
  if (!facilityResourceIds.ok) {
    return NextResponse.json({ error: facilityResourceIds.error }, { status: 400 });
  }

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

    // RESOURCE-AVAILABILITY-UX-01-C1-V: persist the series' default
    // allocations HERE — same request, same server-side invocation as the
    // series + session generation above, so there is no client-observable
    // gap in which the series can exist without them. Unlike the earlier
    // partial-failure design, a resource that fails validation (archived,
    // not found, already allocated, cross-tenant) now rolls back the
    // just-created series/sessions and fails the WHOLE request — a 201
    // response must never refer to a series missing a requested default
    // allocation.
    for (const facilityResourceId of facilityResourceIds.value) {
      try {
        await createTrainingAllocation(tenantId, {
          trainingSeriesId: created.id,
          facilityResourceId,
        });
      } catch (allocationErr) {
        await deleteTrainingSeriesPermanently(tenantId, created.id);
        const message =
          allocationErr instanceof Error
            ? allocationErr.message
            : "Ressource konnte nicht zugewiesen werden.";
        return NextResponse.json({ error: message }, { status: allocationErrorStatus(allocationErr) });
      }
    }

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
