/**
 * GET /api/public/[tenant]/website/tournaments
 *
 * Returns only EventType.TOURNAMENT events that are visible on the website
 * for the specified tenant. The event-type filter is applied at the database
 * level via getPublicEvents({ eventTypes: TOURNAMENT_EVENT_TYPES }).
 *
 * Only tournaments with status SCHEDULED, LIVE, COMPLETED, or POSTPONED are
 * included. All other event types (MATCH, TRAINING, OTHER, VACATION_PERIOD)
 * are excluded at the database level. Draft, Archived, and Cancelled events
 * are excluded.
 *
 * This endpoint supports the /turnierplan migration for the FC Allschwil website.
 * No tournament bracket or participant model is included in this slice.
 *
 * Tenant is resolved from the [tenant] path segment.
 * Results are always tenant-isolated — no cross-tenant data is returned.
 *
 * Query params:
 *   seasonKey  — ISO season key (e.g. "2025-26"). Default: all seasons.
 *   teamSlug   — Filter by team slug. Default: all teams.
 *   dateFrom   — ISO date lower bound for startAt (inclusive). Default: no lower bound.
 *   dateTo     — ISO date upper bound for startAt (inclusive). Default: no upper bound.
 *   limit      — Max tournaments returned (1–250, default 100).
 */

import { type NextRequest, NextResponse } from "next/server";
import { getPublicEvents, TOURNAMENT_EVENT_TYPES } from "@/lib/events/public-event-feed";
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
      eventTypes: TOURNAMENT_EVENT_TYPES,
    });

    const tournaments = rawEvents.map(toPublicWebsiteEvent);

    return NextResponse.json(
      buildWebsiteEnvelope(
        tenant,
        { tournaments },
        {
          total: tournaments.length,
          filters: { seasonKey, teamSlug, dateFrom, dateTo, limit },
        },
      ),
    );
  } catch (error) {
    console.error("[public/[tenant]/website/tournaments] GET failed:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? "Technischer Fehler: " + error.message
            : "Tournaments Feed konnte nicht geladen werden.",
      },
      { status: 500 },
    );
  }
}
