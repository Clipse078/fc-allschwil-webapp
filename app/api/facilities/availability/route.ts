/**
 * GET /api/facilities/availability
 *
 * PLANNING-CREATION-UX-01A — provider-neutral live resource availability
 * for guided creation flows. Given a time interval and an allocation group,
 * returns FREE/OCCUPIED status (+ conflict details) for every non-archived
 * FacilityResource of that group belonging to the caller's tenant.
 *
 * Query params:
 *   startAt        ISO datetime (required)
 *   endAt          ISO datetime (optional — defaults to startAt)
 *   group          "PITCH_HALL" | "DRESSING_ROOM" (required)
 *   excludeEventId string (optional — excludes bookings of this Event, e.g.
 *                  when editing a tournament that already holds allocations)
 *
 * Permission: EVENTS_VIEW / EVENTS_MANAGE (same gate as tournament reads).
 * Tenant isolation: tenantId resolved from session, never from request query.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireApiAnyPermission } from "@/lib/permissions/require-api-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getResourceAvailability, type AvailabilityResourceGroup } from "@/lib/facilities/availability-service";

const VALID_GROUPS: readonly AvailabilityResourceGroup[] = ["PITCH_HALL", "DRESSING_ROOM"];

export async function GET(request: NextRequest) {
  const access = await requireApiAnyPermission([PERMISSIONS.EVENTS_VIEW, PERMISSIONS.EVENTS_MANAGE]);
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

  if (!startAtRaw || Number.isNaN(new Date(startAtRaw).getTime())) {
    return NextResponse.json({ error: "startAt is required and must be a valid date." }, { status: 400 });
  }
  if (endAtRaw && Number.isNaN(new Date(endAtRaw).getTime())) {
    return NextResponse.json({ error: "endAt must be a valid date." }, { status: 400 });
  }
  if (!groupRaw || !VALID_GROUPS.includes(groupRaw as AvailabilityResourceGroup)) {
    return NextResponse.json({ error: "group must be one of PITCH_HALL, DRESSING_ROOM." }, { status: 400 });
  }

  const availability = await getResourceAvailability({
    tenantId,
    startAt: startAtRaw,
    endAt: endAtRaw || null,
    group: groupRaw as AvailabilityResourceGroup,
    excludeEventId,
  });

  return NextResponse.json({ availability });
}
