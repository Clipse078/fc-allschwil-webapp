/**
 * GET /api/public/[tenant]/website/teams/[slug]
 *
 * Returns the public team detail for the given slug, including:
 *   - Core team metadata (name, displayName, category, ageGroup, genderGroup)
 *   - Active-season squad (isWebsiteVisible = true, status = ACTIVE)
 *   - Active-season trainer staff (isWebsiteVisible = true, status = ACTIVE)
 *   - Upcoming training sessions (next 28 days, websiteVisible = true)
 *   - Upcoming match fixtures (next 5, websiteVisible = true)
 *   - Recent completed match results (last 5, websiteVisible = true)
 *
 * Tenant isolation: Team.tenantId is enforced at the DB level.
 * Privacy: personId, email, phone, dateOfBirth, remarks are never returned.
 * Visibility: squad/trainer lists are empty when TeamSeason flags disable them.
 *
 * Query params:
 *   seasonKey — Resolve squad/trainers from this season (e.g. "2025-26").
 *               Default: active season (isActive = true).
 *
 * Error responses:
 *   404 — tenant not found or inactive
 *   403 — website integration disabled for tenant
 *   404 — team slug not found, inactive, or websiteVisible = false
 *   500 — unexpected server error
 */

import { type NextRequest, NextResponse } from "next/server";
import {
  buildWebsiteEnvelope,
  resolveTenantFromParams,
  assertWebsiteEnabled,
} from "@/lib/website/response-helpers";
import { getPublicTeamDetail } from "@/lib/website/public-teams-feed";

type RouteParams = { params: Promise<{ tenant: string; slug: string }> };

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { tenant: tenantSlug, slug } = await params;

    const tenant = await resolveTenantFromParams(tenantSlug);

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found." }, { status: 404 });
    }

    const guard = assertWebsiteEnabled(tenant);
    if (guard) return guard;

    const { searchParams } = new URL(request.url);
    const seasonKey = searchParams.get("seasonKey");

    const team = await getPublicTeamDetail({
      tenantId: tenant.id,
      slug,
      seasonKey,
    });

    if (!team) {
      return NextResponse.json(
        { error: "Team not found." },
        { status: 404 },
      );
    }

    return NextResponse.json(
      buildWebsiteEnvelope(
        tenant,
        { team },
        { seasonKey: seasonKey ?? null },
      ),
    );
  } catch (error) {
    console.error("[public/[tenant]/website/teams/[slug]] GET failed:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? "Technischer Fehler: " + error.message
            : "Team Detail konnte nicht geladen werden.",
      },
      { status: 500 },
    );
  }
}
