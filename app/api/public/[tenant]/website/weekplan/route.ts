/**
 * GET /api/public/[tenant]/website/weekplan
 *
 * Returns the published week plan (Wochenplan) for the specified tenant.
 * Results are grouped by calendar day (Monday–Sunday), ordered chronologically.
 *
 * WOCHENPLAN-2.0-01C — default week mode serves the canonical CURRENT WEEK
 * from /dashboard/planner/week (Weekplanner), not the legacy Wochenplan board.
 * Content types: trainings, HOME matches, HOME tournaments with canonical
 * sporting identity. Active tenant plan name is always exposed.
 *
 * Query params:
 *   scope      — "season" to return the legacy full active-season schedule
 *                (Event-based, backward compatible). Omit for current-week mode.
 *   weekId     — Ignored for content in current-week mode (always resolves the
 *                tenant-timezone current week). Still used for publication metadata.
 *   seasonKey  — Optional season filter in current-week mode.
 *   teamSlug   — Filter by canonical team slug. Never overrides HOME/facility rules.
 *   dateFrom   — Legacy week-mode filter (ignored in current-week mode).
 *   dateTo     — Legacy week-mode filter (ignored in current-week mode).
 *   limit      — Max events (season mode only).
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
import { buildPublicCurrentWeekFeed } from "@/lib/wochenplan/public-feed";
import {
  buildWebsiteEnvelope,
  resolveTenantFromParams,
  assertWebsiteEnabled,
} from "@/lib/website/response-helpers";
import { prisma } from "@/lib/db/prisma";
import type {
  PublicWochenplanDay,
  PublicWochenplanPublication,
  WeekplanSeasonData,
} from "@/lib/website/types";

type RouteParams = { params: Promise<{ tenant: string }> };

/** Active plan identity must reflect WochenplanPlan.isActive on every request. */
export const dynamic = "force-dynamic";

const WEEKPLAN_CACHE_CONTROL = "private, no-cache, no-store, must-revalidate";

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

    // ── Season scope: legacy Event-based feed (backward compatible) ─────────
    if (isSeasonScope) {
      const rawDays = await getGroupedWochenplan({
        tenantId: tenant.id,
        seasonKey: effectiveSeasonKey,
        teamSlug,
        dateFrom: null,
        dateTo: null,
        limit: rawLimit ?? SEASON_SCOPE_MAX_LIMIT,
        maxLimit: SEASON_SCOPE_MAX_LIMIT,
      });

      const activePlan = await getActiveWochenplanPlan(tenant.id);

      const resolvedDays = await Promise.all(
        rawDays.map(async (day) => ({
          ...day,
          events: await applyWochenplanPlanAllocations(tenant.id, day.events, activePlan),
        })),
      );

      const days: PublicWochenplanDay[] = resolvedDays.map((day) => ({
        date: day.date,
        calendarWeek: day.calendarWeek,
        weekdayLabel: day.weekdayLabel,
        events: day.events.map((event) => ({
          ...toPublicWebsiteEvent(event),
          kind: event.type as "TRAINING" | "MATCH" | "TOURNAMENT",
        })),
      }));

      const seasonData: WeekplanSeasonData = {
        publication: null,
        days,
      };

      const countEvents = days.reduce((sum, day) => sum + day.events.length, 0);

      return NextResponse.json(
        buildWebsiteEnvelope(tenant, seasonData, {
          scope: "season",
          countDays: days.length,
          countEvents,
          season: activeSeason,
        }),
        { headers: { "Cache-Control": WEEKPLAN_CACHE_CONTROL } },
      );
    }

    // ── Current-week mode: canonical Weekplanner feed ───────────────────────
    const feed = await buildPublicCurrentWeekFeed({
      tenantId: tenant.id,
      tenantName: tenant.name,
      teamSlug,
      seasonKey: effectiveSeasonKey,
    });

    // Enrich publication when weekId matches and week is published
    let publication: PublicWochenplanPublication | null = feed.publication;
    if (weekId && weekId !== feed.currentWeek.weekId) {
      const pub = await getWochenplanPublication(tenant.id, weekId);
      const activePlanName = feed.activePlan.name;
      if (pub?.isPublished) {
        publication = {
          weekId: pub.weekId,
          variantLabel: activePlanName,
          variantBadge: formatWochenplanVariantBadge(pub.weekId, activePlanName),
          isPublished: pub.isPublished,
          publishedAt: pub.publishedAt,
          activePlanId: feed.activePlan.id || null,
          activePlanName,
        };
      } else {
        publication = null;
      }
    }

    const data = { ...feed, publication };
    const countEvents = data.days.reduce((sum, day) => sum + day.events.length, 0);

    return NextResponse.json(
      buildWebsiteEnvelope(tenant, data, {
        scope: "week",
        mode: "current-week",
        countDays: data.days.length,
        countEvents,
        filters: {
          weekId: feed.currentWeek.weekId,
          seasonKey: effectiveSeasonKey,
          teamSlug,
        },
      }),
      { headers: { "Cache-Control": WEEKPLAN_CACHE_CONTROL } },
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
