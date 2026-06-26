/**
 * GET /api/public/[tenant]/website/teams
 *
 * Returns active, website-visible teams with their current-season display names.
 * The tenant slug in the path is validated and the websiteEnabled flag is checked,
 * but the team list itself is not yet tenant-scoped at the DB level because the
 * Team model does not carry a tenantId FK in the current schema.
 *
 * For the current FC Allschwil single-tenant deployment this is correct — all
 * teams belong to FC Allschwil. When multi-tenant team scoping is required a
 * schema migration must add tenantId to Team, and this endpoint will filter by it.
 *
 * Only isActive = true && websiteVisible = true teams are returned.
 * Season display names come from the active TeamSeason record.
 *
 * Query params:
 *   seasonKey  — Resolve displayName from this season (e.g. "2025-26").
 *                Default: active season (isActive = true).
 */

import { type NextRequest, NextResponse } from "next/server";
import { getPublicTeams } from "@/lib/website/public-teams-feed";
import {
  buildWebsiteEnvelope,
  resolveTenantFromParams,
  assertWebsiteEnabled,
} from "@/lib/website/response-helpers";

type RouteParams = { params: Promise<{ tenant: string }> };

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
    const seasonKey = searchParams.get("seasonKey");

    const teams = await getPublicTeams({ seasonKey });

    return NextResponse.json(
      buildWebsiteEnvelope(
        tenant,
        { teams },
        { total: teams.length, seasonKey: seasonKey ?? null },
      ),
    );
  } catch (error) {
    console.error("[public/[tenant]/website/teams] GET failed:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? "Technischer Fehler: " + error.message
            : "Teams Feed konnte nicht geladen werden.",
      },
      { status: 500 },
    );
  }
}
