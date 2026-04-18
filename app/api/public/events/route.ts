import { NextRequest, NextResponse } from "next/server";
import {
  getPublicEvents,
  type PublicEventSurface,
} from "@/lib/events/public-event-feed";

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

    const events = await getPublicEvents({
      surface,
      seasonKey,
      teamSlug,
      dateFrom,
      dateTo,
      limit,
    });

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