import { NextRequest, NextResponse } from "next/server";
import { getInfoboardFeed } from "@/lib/events/public-event-feed";
import { resolveTenantFromRequest } from "@/lib/tenants/resolve-from-request";

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

    const tenant = await resolveTenantFromRequest(request);

    const events = await getInfoboardFeed({
      seasonKey,
      teamSlug,
      dateFrom,
      dateTo,
      limit,
      tenantId: tenant?.id ?? null,
    });

    return NextResponse.json({
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
    console.error("Public Infoboard feed failed:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? "Technischer Fehler: " + error.message
            : "Infoboard Feed konnte nicht geladen werden.",
      },
      { status: 500 }
    );
  }
}