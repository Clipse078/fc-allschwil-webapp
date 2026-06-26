/**
 * GET /api/public/[tenant]/website/teams
 *
 * Returns active, website-visible teams with their current-season display names.
 * Tenant is resolved from the [tenant] path segment.
 *
 * DB-level tenant isolation is enforced via Team.tenantId
 * (migration: 20260626000000_team_tenant_isolation).
 *
 * Query params:
 *   seasonKey  — Resolve displayName from this season (e.g. "2025-26").
 *                Default: active season (isActive = true).
 */

import { type NextRequest, NextResponse } from "next/server";
import {
  buildWebsiteEnvelope,
  resolveTenantFromParams,
  assertWebsiteEnabled,
} from "@/lib/website/response-helpers";
import { getPublicTeams } from "@/lib/website/public-teams-feed";

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

    const teams = await getPublicTeams({ tenantId: tenant.id, seasonKey });

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
