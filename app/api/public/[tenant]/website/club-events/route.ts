/**
 * GET /api/public/[tenant]/website/club-events
 *
 * Returns general club-event records (EventType.OTHER) that are visible on the
 * website for the specified tenant.
 *
 * "Club events" are general club activities that are not matches, tournaments,
 * or trainings. Examples: Generalversammlung, Sponsorenlauf, Public Viewing,
 * Vereinsanlass, Helfereinsatz, Informationsabend.
 *
 * In the SportClubEvo data model these events carry EventType.OTHER.
 * EventType.MATCH, EventType.TOURNAMENT, and EventType.TRAINING are strictly
 * excluded. EventType.VACATION_PERIOD is an administrative planning type and
 * is also excluded.
 *
 * The event-type filter is applied at the database level via
 * getPublicEvents({ eventTypes: CLUB_EVENT_TYPES }).
 *
 * Only events with status SCHEDULED, LIVE, COMPLETED, or POSTPONED are
 * included. Draft, Archived, and Cancelled events are excluded.
 *
 * Tenant is resolved from the [tenant] path segment.
 * Results are always tenant-isolated — no cross-tenant data is returned.
 *
 * Query params:
 *   seasonKey  — ISO season key (e.g. "2025-26"). Default: all seasons.
 *   teamSlug   — Filter by team slug. Default: all teams.
 *   dateFrom   — ISO date lower bound for startAt (inclusive). Default: no lower bound.
 *   dateTo     — ISO date upper bound for startAt (inclusive). Default: no upper bound.
 *   limit      — Max events returned (1–250, default 100).
 */

import { type NextRequest, NextResponse } from "next/server";
import { getPublicEvents, CLUB_EVENT_TYPES } from "@/lib/events/public-event-feed";
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

    const rawEvents = await getPublicEvents({
      surface: "all",
      tenantId: tenant.id,
      seasonKey,
      teamSlug,
      dateFrom,
      dateTo,
      limit,
      eventTypes: CLUB_EVENT_TYPES,
    });

    const clubEvents = rawEvents.map(toPublicWebsiteEvent);

    return NextResponse.json(
      buildWebsiteEnvelope(
        tenant,
        { clubEvents },
        {
          total: clubEvents.length,
          filters: { seasonKey, teamSlug, dateFrom, dateTo, limit },
        },
      ),
    );
  } catch (error) {
    console.error("[public/[tenant]/website/club-events] GET failed:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? "Technischer Fehler: " + error.message
            : "Club Events Feed konnte nicht geladen werden.",
      },
      { status: 500 },
    );
  }
}
