/**
 * GET /api/public/[tenant]/website/matches
 *
 * Returns MATCH-type events that are visible on the website for the specified
 * tenant. Equivalent to /events with type=MATCH applied server-side.
 *
 * Only MATCH events with status SCHEDULED, LIVE, COMPLETED, or POSTPONED are
 * included. Non-match event types (TRAINING, TOURNAMENT, OTHER, VACATION_PERIOD)
 * are excluded. Draft, Archived, and Cancelled events are excluded.
 *
 * Tenant is resolved from the [tenant] path segment.
 * Results are always tenant-isolated.
 *
 * Query params:
 *   seasonKey  — ISO season key (e.g. "2025-26"). Default: all seasons.
 *   teamSlug   — Filter by team slug. Default: all teams.
 *   dateFrom   — ISO date lower bound for startAt (inclusive). Default: no lower bound.
 *   dateTo     — ISO date upper bound for startAt (inclusive). Default: no upper bound.
 *   limit      — Max matches returned (1–250, default 100).
 */

import { type NextRequest, NextResponse } from "next/server";
import { getPublicEvents } from "@/lib/events/public-event-feed";
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
    });

    // Filter to MATCH type only after the query to avoid a raw SQL where clause.
    // getPublicEvents already applies websiteVisible + status filters; the type
    // filter here is a clean application-layer concern consistent with the
    // existing surface-based filtering model.
    const matches = rawEvents
      .filter((e) => e.type === "MATCH")
      .map(toPublicWebsiteEvent);

    return NextResponse.json(
      buildWebsiteEnvelope(
        tenant,
        { matches },
        {
          total: matches.length,
          filters: { seasonKey, teamSlug, dateFrom, dateTo, limit },
        },
      ),
    );
  } catch (error) {
    console.error("[public/[tenant]/website/matches] GET failed:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? "Technischer Fehler: " + error.message
            : "Matches Feed konnte nicht geladen werden.",
      },
      { status: 500 },
    );
  }
}
