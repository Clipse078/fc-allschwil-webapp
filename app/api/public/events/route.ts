/**
 * GET /api/public/events
 *
 * ⚠️  LEGACY / DEPRECATED UNVERSIONED ROUTE
 *
 * This route predates the tenant-scoped public API surface. It is preserved
 * for backward compatibility but MUST NOT be used by new consumers.
 *
 * New consumers should use the tenant-scoped canonical endpoints instead:
 *   GET /api/public/[tenant]/website/club-events
 *   GET /api/public/[tenant]/website/matches
 *   GET /api/public/[tenant]/website/tournaments
 *   GET /api/public/[tenant]/website/trainings
 *   GET /api/public/[tenant]/website/weekplan
 *
 * TENANT ISOLATION
 * All queries are tenant-scoped. Resolution order:
 *   1. X-Tenant-Slug request header (multi-tenant override).
 *   2. Default tenant fallback (single-tenant path, currently fc-allschwil).
 * Requests that cannot resolve a tenant receive a 404 response.
 * It is not possible for this route to return events from multiple tenants.
 *
 * Query params:
 *   surface    — "all" | "homepage" | "wochenplan" | "trainingsplan" | "team-page" | "infoboard"
 *                Default: "all"
 *   seasonKey  — ISO season key (e.g. "2025-26"). Default: all seasons.
 *   teamSlug   — Filter by team slug. Default: all teams.
 *   dateFrom   — ISO date lower bound for startAt (inclusive). Default: no lower bound.
 *   dateTo     — ISO date upper bound for startAt (inclusive). Default: no upper bound.
 *   limit      — Max events returned (default 100).
 */

import { NextRequest, NextResponse } from "next/server";
import {
  getPublicEvents,
  type PublicEventSurface,
} from "@/lib/events/public-event-feed";
import {
  resolveTenantFromRequest,
} from "@/lib/website/response-helpers";

const ALLOWED_SURFACES: PublicEventSurface[] = [
  "all",
  "homepage",
  "wochenplan",
  "trainingsplan",
  "team-page",
  "infoboard",
];

function parseSurface(value: string | null): PublicEventSurface {
  if (!value) {
    return "all";
  }

  if (ALLOWED_SURFACES.includes(value as PublicEventSurface)) {
    return value as PublicEventSurface;
  }

  return "all";
}

function parseLimit(value: string | null) {
  if (!value) {
    return 100;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return 100;
  }

  return parsed;
}

export async function GET(request: NextRequest) {
  try {
    // Tenant isolation: resolve from X-Tenant-Slug header or default tenant.
    const tenant = await resolveTenantFromRequest(request);

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found." }, { status: 404 });
    }

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

    // Strip internal allocation codes — raw codes are not for public consumption.
    // Callers that need display labels should use /api/public/infoboard or call
    // getInfoboardFeed() which resolves codes → human-readable labels.
    const events = rawEvents.map(
      ({ pitchCode: _p, homeDressingRoomCode: _h, awayDressingRoomCode: _a, ...rest }) =>
        rest,
    );

    return NextResponse.json({
      surface,
      count: events.length,
      filters: {
        seasonKey,
        teamSlug,
        dateFrom,
        dateTo,
        limit,
      },
      events,
    });
  } catch (error) {
    console.error("Public events feed failed:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? "Technischer Fehler: " + error.message
            : "Public Events Feed konnte nicht geladen werden.",
      },
      { status: 500 }
    );
  }
}
