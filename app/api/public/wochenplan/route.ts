import { NextRequest, NextResponse } from "next/server";
import { getGroupedWochenplan } from "@/lib/events/public-event-feed";

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

    const seasonKey = searchParams.get("seasonKey");
    const teamSlug = searchParams.get("teamSlug");
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const limit = parseLimit(searchParams.get("limit"));

    const days = await getGroupedWochenplan({
      seasonKey,
      teamSlug,
      dateFrom,
      dateTo,
      limit,
    });

    return NextResponse.json({
      countDays: days.length,
      countEvents: days.reduce((sum, day) => sum + day.events.length, 0),
      filters: {
        seasonKey,
        teamSlug,
        dateFrom,
        dateTo,
        limit,
      },
      days,
    });
  } catch (error) {
    console.error("Public Wochenplan feed failed:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? "Technischer Fehler: " + error.message
            : "Wochenplan Feed konnte nicht geladen werden.",
      },
      { status: 500 }
    );
  }
}