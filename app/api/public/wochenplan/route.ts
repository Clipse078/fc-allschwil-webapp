import { NextRequest, NextResponse } from "next/server";
import { getGroupedWochenplan } from "@/lib/events/public-event-feed";
import { resolveTenantFromRequest } from "@/lib/tenants/resolve-from-request";
import {
  getWochenplanPublication,
  formatWochenplanVariantBadge,
} from "@/lib/wochenplan/publication-queries";

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
    const weekId = searchParams.get("weekId");

    const days = await getGroupedWochenplan({
      seasonKey,
      teamSlug,
      dateFrom,
      dateTo,
      limit,
    });

    // Resolve active variant publication for the requested week.
    let publication: {
      weekId: string;
      variantLabel: string;
      variantBadge: string;
      isPublished: boolean;
      publishedAt: Date | null;
    } | null = null;

    if (weekId) {
      const tenant = await resolveTenantFromRequest(request);
      if (tenant) {
        const pub = await getWochenplanPublication(tenant.id, weekId);
        if (pub && pub.isPublished) {
          publication = {
            weekId: pub.weekId,
            variantLabel: pub.variantLabel,
            variantBadge: formatWochenplanVariantBadge(pub.weekId, pub.variantLabel),
            isPublished: pub.isPublished,
            publishedAt: pub.publishedAt,
          };
        }
      }
    }

    return NextResponse.json({
      countDays: days.length,
      countEvents: days.reduce((sum, day) => sum + day.events.length, 0),
      publication,
      filters: {
        seasonKey,
        teamSlug,
        dateFrom,
        dateTo,
        limit,
        weekId,
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
