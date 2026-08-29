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
 * published or when no weekId is supplied, and always null when scope=season.
 *
 * Tenant is resolved from the [tenant] path segment.
 * Results are always tenant-isolated.
 *
 * Query params:
 *   scope      — "season" to return the full active-season schedule.
 *                When scope=season the active Season is resolved from the DB
 *                (Season.isActive = true), weekId is ignored, limit defaults
 *                to SEASON_SCOPE_MAX_LIMIT, and publication is always null.
 *                Omit or pass any other value for the default week-oriented mode.
 *   weekId     — ISO week identifier, e.g. "2026-W26". Required for publication
 *                state. Ignored when scope=season.
 *   seasonKey  — Filter by season key. Default: all seasons. Ignored when
 *                scope=season (the active season key is used instead).
 *   teamSlug   — Filter by team slug. Default: all teams.
 *   dateFrom   — ISO date lower bound for startAt. Default: no lower bound.
 *   dateTo     — ISO date upper bound for startAt. Default: no upper bound.
 *   limit      — Max events returned. Default/max: 100/250 (week mode) or
 *                SEASON_SCOPE_MAX_LIMIT (season mode). Capped at the mode max.
 */

import { type NextRequest, NextResponse } from "next/server";
import { getGroupedWochenplan, SEASON_SCOPE_MAX_LIMIT } from "@/lib/events/public-event-feed";
import { toPublicWebsiteEvent } from "@/lib/website/public-events-mapper";
import {
  getWochenplanPublication,
  formatWochenplanVariantBadge,
} from "@/lib/wochenplan/publication-queries";
import { getActiveWochenplanPlan } from "@/lib/wochenplan/plan-service";
import { applyWochenplanPlanAllocations } from "@/lib/wochenplan/plan-queries";
import {
  buildWebsiteEnvelope,
  resolveTenantFromParams,
  assertWebsiteEnabled,
} from "@/lib/website/response-helpers";
import { prisma } from "@/lib/db/prisma";
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
    const scope = searchParams.get("scope");
    const isSeasonScope = scope === "season";

    const weekId = isSeasonScope ? null : searchParams.get("weekId");
    const teamSlug = searchParams.get("teamSlug");
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const rawLimit = parseLimit(searchParams.get("limit"));

    let effectiveSeasonKey: string | null = null;
    let activeSeason: { key: string; name: string } | null = null;

    if (isSeasonScope) {
      // Resolve the canonical active season; its key scopes all events.
      // Season has no tenantId — it is global. Tenant isolation is enforced
      // at the Event level (Event.tenantId) by getGroupedWochenplan.
      activeSeason = await prisma.season.findFirst({
        where: { isActive: true },
        select: { key: true, name: true },
      });

      if (!activeSeason) {
        return NextResponse.json(
          { error: "Keine aktive Saison gefunden." },
          { status: 404 },
        );
      }

      effectiveSeasonKey = activeSeason.key;
    } else {
      effectiveSeasonKey = searchParams.get("seasonKey");
    }

    // Fetch grouped wochenplan events, scoped to this tenant.
    const rawDays = await getGroupedWochenplan({
      tenantId: tenant.id,
      seasonKey: effectiveSeasonKey,
      teamSlug,
      dateFrom: isSeasonScope ? null : dateFrom,
      dateTo: isSeasonScope ? null : dateTo,
      limit: isSeasonScope ? (rawLimit ?? SEASON_SCOPE_MAX_LIMIT) : rawLimit,
      maxLimit: isSeasonScope ? SEASON_SCOPE_MAX_LIMIT : undefined,
    });

    const activePlan = await getActiveWochenplanPlan(tenant.id);

    const resolvedDays = await Promise.all(
      rawDays.map(async (day) => ({
        ...day,
        events: await applyWochenplanPlanAllocations(tenant.id, day.events, activePlan),
      })),
    );

    // Map each day's events to the website-safe shape.
    const days: PublicWochenplanDay[] = resolvedDays.map((day) => ({
      date: day.date,
      calendarWeek: day.calendarWeek,
      weekdayLabel: day.weekdayLabel,
      events: day.events.map(toPublicWebsiteEvent),
    }));

    // Resolve publication state for the requested week (null when not published).
    // Season-scope queries have no single-week publication state — always null.
    let publication: PublicWochenplanPublication | null = null;
    if (!isSeasonScope && weekId) {
      const pub = await getWochenplanPublication(tenant.id, weekId);
      const variantLabel = activePlan?.name ?? pub?.variantLabel ?? "Wochenplan";
      if (pub?.isPublished) {
        publication = {
          weekId: pub.weekId,
          variantLabel,
          variantBadge: formatWochenplanVariantBadge(pub.weekId, variantLabel),
          isPublished: pub.isPublished,
          publishedAt: pub.publishedAt,
          activePlanId: activePlan?.id ?? null,
          activePlanName: activePlan?.name ?? null,
        };
      }
    }

    const countEvents = days.reduce((sum, day) => sum + day.events.length, 0);

    return NextResponse.json(
      buildWebsiteEnvelope(
        tenant,
        { publication, days },
        {
          scope: isSeasonScope ? "season" : "week",
          countDays: days.length,
          countEvents,
          ...(isSeasonScope
            ? { season: activeSeason }
            : { filters: { weekId, seasonKey: effectiveSeasonKey, teamSlug, dateFrom, dateTo, limit: rawLimit } }),
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
