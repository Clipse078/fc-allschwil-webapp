/**
 * GET /api/public/[tenant]/website/events
 *
 * Returns website-visible events for the specified tenant, scoped to the
 * requested surface. Only events with status SCHEDULED, LIVE, COMPLETED, or
 * POSTPONED are included. Draft, Archived, and Cancelled events are excluded.
 *
 * Tenant is resolved from the [tenant] path segment.
 * Results are always tenant-isolated — no cross-tenant data is returned.
 *
 * Query params:
 *   surface    — "all" | "homepage" | "wochenplan" | "trainingsplan" | "team-page"
 *                Default: "all" (all websiteVisible events)
 *   seasonKey  — ISO season key (e.g. "2025-26"). Default: all seasons.
 *   teamSlug   — Filter by team slug. Default: all teams.
 *   dateFrom   — ISO date lower bound for startAt (inclusive). Default: no lower bound.
 *   dateTo     — ISO date upper bound for startAt (inclusive). Default: no upper bound.
 *   limit      — Max events returned (1–250, default 100).
 */

import { type NextRequest, NextResponse } from "next/server";
import {
  getPublicEvents,
  type PublicEventSurface,
} from "@/lib/events/public-event-feed";
import { toPublicWebsiteEvent } from "@/lib/website/public-events-mapper";
import {
  buildWebsiteEnvelope,
  resolveTenantFromParams,
  assertWebsiteEnabled,
} from "@/lib/website/response-helpers";

type RouteParams = { params: Promise<{ tenant: string }> };

const ALLOWED_SURFACES: PublicEventSurface[] = [
  "all",
  "homepage",
  "wochenplan",
  "trainingsplan",
  "team-page",
  "infoboard",
];

function parseSurface(value: string | null): PublicEventSurface {
  if (value && ALLOWED_SURFACES.includes(value as PublicEventSurface)) {
    return value as PublicEventSurface;
  }
  return "all";
}

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
    const surface = parseSurface(searchParams.get("surface"));
    const seasonKey = searchParams.get("seasonKey");
    const teamSlug = searchParams.get("teamSlug");
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const limit = parseLimit(searchParams.get("limit"));

    const rawEvents = await getPublicEvents({
      surface,
      tenantId: tenant.id,
      seasonKey,
      teamSlug,
      dateFrom,
      dateTo,
      limit,
    });

    const events = rawEvents.map(toPublicWebsiteEvent);

    return NextResponse.json(
      buildWebsiteEnvelope(
        tenant,
        { events },
        {
          total: events.length,
          surface,
          filters: { seasonKey, teamSlug, dateFrom, dateTo, limit },
        },
      ),
    );
  } catch (error) {
    console.error("[public/[tenant]/website/events] GET failed:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? "Technischer Fehler: " + error.message
            : "Events Feed konnte nicht geladen werden.",
      },
      { status: 500 },
    );
  }
}
