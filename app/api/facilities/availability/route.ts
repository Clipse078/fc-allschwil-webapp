/**
 * GET /api/facilities/availability
 *
 * PLANNING-CREATION-UX-01A — provider-neutral live resource availability
 * for guided creation flows. Given a time interval and an allocation group,
 * returns FREE/OCCUPIED status (+ conflict details) for every non-archived
 * FacilityResource of that group belonging to the caller's tenant.
 *
 * Query params:
 *   startAt                    ISO datetime (required)
 *   endAt                      ISO datetime (optional — defaults to startAt)
 *   group                      "PITCH_HALL" | "DRESSING_ROOM" (required)
 *   excludeEventId             string (optional — excludes bookings of this
 *                              Event, e.g. when editing a Match/Tournament
 *                              that already holds allocations)
 *   excludeTrainingSessionId   string (optional — RESOURCE-AVAILABILITY-UX-01,
 *                              excludes this TrainingSession's own occurrence,
 *                              e.g. when editing its resource overrides)
 *
 * Permission: EVENTS_VIEW / EVENTS_MANAGE OR TRAININGS_VIEW / TRAININGS_MANAGE
 * — every operational Center (TrainingCenter/MatchCenter/TournamentCenter)
 * wiring this into its own selectors reaches this endpoint under its own
 * existing module permission; this never introduces a new permission.
 * Tenant isolation: tenantId resolved from session, never from request query.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireApiAnyPermission } from "@/lib/permissions/require-api-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getResourceAvailability, type AvailabilityResourceGroup } from "@/lib/facilities/availability-service";
import type { WeekplannerActivityType } from "@/lib/weekplanner/plan-types";

const VALID_GROUPS: readonly AvailabilityResourceGroup[] = ["PITCH_HALL", "DRESSING_ROOM"];
const ACTIVITY_TYPES: readonly WeekplannerActivityType[] = ["TRAINING", "MATCH", "TOURNAMENT"];

function parseNonNegativeInt(raw: string | null, label: string): number | "invalid" {
  if (raw == null || raw === "") return 0;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 0) return "invalid";
  return parsed;
}

export async function GET(request: NextRequest) {
  const access = await requireApiAnyPermission([
    PERMISSIONS.EVENTS_VIEW,
    PERMISSIONS.EVENTS_MANAGE,
    PERMISSIONS.TRAININGS_VIEW,
    PERMISSIONS.TRAININGS_MANAGE,
  ]);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantId = access.session.user.activeTenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "Tenant context is required." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const startAtRaw = searchParams.get("startAt");
  const endAtRaw = searchParams.get("endAt");
  const groupRaw = searchParams.get("group");
  const excludeEventId = searchParams.get("excludeEventId") ?? undefined;
  const excludeTrainingSessionId = searchParams.get("excludeTrainingSessionId") ?? undefined;
  const weekplannerPlanId = searchParams.get("weekplannerPlanId") ?? undefined;
  const excludeWeekplannerActivityId = searchParams.get("excludeWeekplannerActivityId") ?? undefined;
  const excludeWeekplannerActivityTypeRaw = searchParams.get("excludeWeekplannerActivityType");
  const occupancyBeforeRaw = parseNonNegativeInt(searchParams.get("occupancyBeforeMinutes"), "occupancyBeforeMinutes");
  const occupancyAfterRaw = parseNonNegativeInt(searchParams.get("occupancyAfterMinutes"), "occupancyAfterMinutes");

  if (!startAtRaw || Number.isNaN(new Date(startAtRaw).getTime())) {
    return NextResponse.json({ error: "startAt is required and must be a valid date." }, { status: 400 });
  }
  if (endAtRaw && Number.isNaN(new Date(endAtRaw).getTime())) {
    return NextResponse.json({ error: "endAt must be a valid date." }, { status: 400 });
  }
  if (!groupRaw || !VALID_GROUPS.includes(groupRaw as AvailabilityResourceGroup)) {
    return NextResponse.json({ error: "group must be one of PITCH_HALL, DRESSING_ROOM." }, { status: 400 });
  }
  if (occupancyBeforeRaw === "invalid") {
    return NextResponse.json({ error: "occupancyBeforeMinutes must be a non-negative integer." }, { status: 400 });
  }
  if (occupancyAfterRaw === "invalid") {
    return NextResponse.json({ error: "occupancyAfterMinutes must be a non-negative integer." }, { status: 400 });
  }
  if (
    excludeWeekplannerActivityTypeRaw &&
    !ACTIVITY_TYPES.includes(excludeWeekplannerActivityTypeRaw as WeekplannerActivityType)
  ) {
    return NextResponse.json(
      { error: `excludeWeekplannerActivityType must be one of ${ACTIVITY_TYPES.join(", ")}.` },
      { status: 400 },
    );
  }

  const availability = await getResourceAvailability({
    tenantId,
    startAt: startAtRaw,
    endAt: endAtRaw || null,
    group: groupRaw as AvailabilityResourceGroup,
    excludeEventId,
    excludeTrainingSessionId,
    occupancyBeforeMinutes: occupancyBeforeRaw,
    occupancyAfterMinutes: occupancyAfterRaw,
    weekplannerPlanId,
    excludeWeekplannerActivityType: excludeWeekplannerActivityTypeRaw as WeekplannerActivityType | undefined,
    excludeWeekplannerActivityId,
  });

  return NextResponse.json({ availability });
}
