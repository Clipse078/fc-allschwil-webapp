/**
 * GET /api/public/[tenant]/website/trainings
 *
 * Returns individual EventType.TRAINING records that are visible on the
 * website for the specified tenant. The event-type filter is applied at the
 * database level via getPublicEvents({ eventTypes: TRAINING_EVENT_TYPES }).
 *
 * Training events are additionally gated by the trainingsplanVisible flag:
 * only events with both websiteVisible = true and trainingsplanVisible = true
 * are included. This is enforced via surface: "trainingsplan".
 *
 * Only TRAINING events with status SCHEDULED, LIVE, COMPLETED, or POSTPONED
 * are included. All other event types are excluded at the database level.
 * Draft, Archived, and Cancelled events are excluded.
 *
 * This endpoint represents individual training records and does NOT replace
 * /api/public/[tenant]/website/weekplan, which is a composed weekly schedule
 * that may aggregate trainings, matches, and tournaments according to
 * wochenplanVisible publication rules.
 *
 * Tenant is resolved from the [tenant] path segment.
 * Results are always tenant-isolated — no cross-tenant data is returned.
 *
 * Query params:
 *   seasonKey  — ISO season key (e.g. "2025-26"). Default: all seasons.
 *   teamSlug   — Filter by team slug. Default: all teams.
 *   dateFrom   — ISO date lower bound for startAt (inclusive). Default: no lower bound.
 *   dateTo     — ISO date upper bound for startAt (inclusive). Default: no upper bound.
 *   limit      — Max trainings returned (1–250, default 100).
 */

import { type NextRequest, NextResponse } from "next/server";
import { getPublicEvents, TRAINING_EVENT_TYPES } from "@/lib/events/public-event-feed";
import { toPublicWebsiteEvent } from "@/lib/website/public-events-mapper";
import {
  buildWebsiteEnvelope,
  resolveTenantFromParams,
  assertWebsiteEnabled,
} from "@/lib/website/response-helpers";

type RouteParams = { params: Promise<{ tenant: string }> };

function parseLimit(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { tenant: tenantSlug } = await params;

    const tenant = await resolveTenantFromParams(tenantSlug);

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found." }, { status: 404 });
    }

    const guard = assertWebsiteEnabled(tenant);
    if (guard) return guard;

    const { searchParams } = new URL(request.url);
    const seasonKey = searchParams.get("seasonKey");
    const teamSlug = searchParams.get("teamSlug");
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const limit = parseLimit(searchParams.get("limit"));

    // surface: "trainingsplan" enforces websiteVisible = true AND trainingsplanVisible = true
    const rawEvents = await getPublicEvents({
      surface: "trainingsplan",
      tenantId: tenant.id,
      seasonKey,
      teamSlug,
      dateFrom,
      dateTo,
      limit,
      eventTypes: TRAINING_EVENT_TYPES,
    });

    const trainings = rawEvents.map(toPublicWebsiteEvent);

    return NextResponse.json(
      buildWebsiteEnvelope(
        tenant,
        { trainings },
        {
          total: trainings.length,
          filters: { seasonKey, teamSlug, dateFrom, dateTo, limit },
        },
      ),
    );
  } catch (error) {
    console.error("[public/[tenant]/website/trainings] GET failed:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? "Technischer Fehler: " + error.message
            : "Trainings Feed konnte nicht geladen werden.",
      },
      { status: 500 },
    );
  }
}
