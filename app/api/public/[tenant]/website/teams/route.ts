/**
 * GET /api/public/[tenant]/website/teams
 *
 * Returns active, website-visible teams with their current-season display names.
 * Tenant is resolved from the [tenant] path segment.
 *
 * ─── ISOLATION STATUS: PENDING MIGRATION ────────────────────────────────────
 * This endpoint currently returns { "teams": [] } because the Team model does
 * not carry a tenantId FK, making DB-level tenant isolation impossible.
 *
 * Per the SportClubEvo engineering standard:
 *   "No public endpoint may expose cross-tenant data."
 *   "Every public query must be tenant-scoped at the database/query level."
 *
 * Route-level tenant validation (resolveTenantFromParams + assertWebsiteEnabled)
 * is applied, but that alone is insufficient without a DB-level WHERE clause.
 *
 * The investigated indirect paths are ALL unreliable:
 *   - Team.orgUnitId → OrgUnit.tenantId:  orgUnitId is nullable; missing
 *     assignment silently drops teams rather than isolating them.
 *   - Team → Event.tenantId:  Event.tenantId is nullable; teams with no events
 *     would be excluded, producing false negatives.
 *   - TeamSeason → Season:  Season has no tenantId. Dead end.
 *
 * Required fix: apply migration `add_team_tenant_isolation` (adds Team.tenantId).
 * See lib/website/public-teams-feed.ts for the full migration SQL and the exact
 * code change needed in getPublicTeams() after the migration.
 *
 * After the migration and getPublicTeams() update, remove the early-return
 * below and replace it with the normal query call.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Query params (active after migration):
 *   seasonKey  — Resolve displayName from this season (e.g. "2025-26").
 *                Default: active season (isActive = true).
 */

import { type NextRequest, NextResponse } from "next/server";
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

    // ISOLATION GAP: Return safe empty response until the Team.tenantId migration
    // is applied and getPublicTeams() is updated to scope by tenantId.
    // See the isolation status documentation above.
    return NextResponse.json(
      buildWebsiteEnvelope(
        tenant,
        { teams: [] },
        {
          total: 0,
          seasonKey: seasonKey ?? null,
          pendingMigration: "Team.tenantId — see docs/public-website-api.md",
        },
      ),
    );

    // ----- ENABLE AFTER MIGRATION -----
    // import { getPublicTeams } from "@/lib/website/public-teams-feed";
    //
    // const teams = await getPublicTeams({ tenantId: tenant.id, seasonKey });
    //
    // return NextResponse.json(
    //   buildWebsiteEnvelope(
    //     tenant,
    //     { teams },
    //     { total: teams.length, seasonKey: seasonKey ?? null },
    //   ),
    // );
    // ----------------------------------
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
