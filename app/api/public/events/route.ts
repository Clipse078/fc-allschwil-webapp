import { NextRequest, NextResponse } from "next/server";
import {
  getPublicEvents,
  type PublicEventSurface,
} from "@/lib/events/public-event-feed";
import { resolveTenantFromRequest } from "@/lib/website/response-helpers";


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
    const { searchParams } = new URL(request.url);

    const surface = parseSurface(searchParams.get("surface"));
    const seasonKey = searchParams.get("seasonKey");
    const teamSlug = searchParams.get("teamSlug");
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const limit = parseLimit(searchParams.get("limit"));

    const tenant = await resolveTenantFromRequest(request);

    if (!tenant) {
      return NextResponse.json(
        { error: "Tenant not found." },
        { status: 404 },
      );
    }

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