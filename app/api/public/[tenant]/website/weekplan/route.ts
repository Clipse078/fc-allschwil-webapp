/**
 * GET /api/public/[tenant]/website/weekplan
 *
 * Returns the published week plan (Wochenplan) for the specified tenant.
 * Results are grouped by calendar day, ordered chronologically.
 *
 * Only events with wochenplanVisible = true and websiteVisible = true are
 * included, scoped to the tenant. Only SCHEDULED, LIVE, COMPLETED, and
 * POSTPONED events appear.
 *
 * The publication field carries the active variant label (e.g. "Schlechtwetter-
 * Wochenplan") for the requested weekId. Returns null when the week has not been
 * published or when no weekId is supplied.
 *
 * Tenant is resolved from the [tenant] path segment.
 * Results are always tenant-isolated.
 *
 * Query params:
 *   weekId     — ISO week identifier, e.g. "2026-W26". Required for publication state.
 *   seasonKey  — Filter by season key. Default: all seasons.
 *   teamSlug   — Filter by team slug. Default: all teams.
 *   dateFrom   — ISO date lower bound for startAt. Default: no lower bound.
 *   dateTo     — ISO date upper bound for startAt. Default: no upper bound.
 *   limit      — Max events returned (1–250, default 100).
 */

import { type NextRequest, NextResponse } from "next/server";
import { getGroupedWochenplan } from "@/lib/events/public-event-feed";
import { toPublicWebsiteEvent } from "@/lib/website/public-events-mapper";
import {
  getWochenplanPublication,
  formatWochenplanVariantBadge,
} from "@/lib/wochenplan/publication-queries";
import {
  buildWebsiteEnvelope,
  resolveTenantFromParams,
  assertWebsiteEnabled,
} from "@/lib/website/response-helpers";
import type { PublicWochenplanDay, PublicWochenplanPublication } from "@/lib/website/types";

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
    const weekId = searchParams.get("weekId");
    const seasonKey = searchParams.get("seasonKey");
    const teamSlug = searchParams.get("teamSlug");
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const limit = parseLimit(searchParams.get("limit"));

    // Fetch grouped wochenplan events, scoped to this tenant.
    const rawDays = await getGroupedWochenplan({
      tenantId: tenant.id,
      seasonKey,
      teamSlug,
      dateFrom,
      dateTo,
      limit,
    });

    // Map each day's events to the website-safe shape.
    const days: PublicWochenplanDay[] = rawDays.map((day) => ({
      date: day.date,
      calendarWeek: day.calendarWeek,
      weekdayLabel: day.weekdayLabel,
      events: day.events.map(toPublicWebsiteEvent),
    }));

    // Resolve publication state for the requested week (null when not published).
    let publication: PublicWochenplanPublication | null = null;
    if (weekId) {
      const pub = await getWochenplanPublication(tenant.id, weekId);
      if (pub?.isPublished) {
        publication = {
          weekId: pub.weekId,
          variantLabel: pub.variantLabel,
          variantBadge: formatWochenplanVariantBadge(pub.weekId, pub.variantLabel),
          isPublished: pub.isPublished,
          publishedAt: pub.publishedAt,
        };
      }
    }

    const countEvents = days.reduce((sum, day) => sum + day.events.length, 0);

    return NextResponse.json(
      buildWebsiteEnvelope(
        tenant,
        { publication, days },
        {
          countDays: days.length,
          countEvents,
          filters: { weekId, seasonKey, teamSlug, dateFrom, dateTo, limit },
        },
      ),
    );
  } catch (error) {
    console.error("[public/[tenant]/website/weekplan] GET failed:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? "Technischer Fehler: " + error.message
            : "Wochenplan Feed konnte nicht geladen werden.",
      },
      { status: 500 },
    );
  }
}
