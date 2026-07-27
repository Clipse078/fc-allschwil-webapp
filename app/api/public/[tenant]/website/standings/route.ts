/**
 * GET /api/public/[tenant]/website/standings
 *
 * Returns canonical standings tables for all active competitions belonging to
 * the tenant, or a single competition when competitionId is supplied.
 *
 * Standings are calculated on demand from canonical MatchResult data.
 * No provider logic is invoked. No standing tables are persisted.
 *
 * Tenant is resolved from the [tenant] path segment.
 * All results are tenant-isolated.
 *
 * Query params:
 *   competitionId — Optional. When supplied, returns only the standings
 *                   for that competition. When omitted, returns standings
 *                   for all active competitions.
 *
 * Response shape (single competition):
 *   { standings: StandingTable }
 *
 * Response shape (all competitions):
 *   { standings: StandingTable[] }
 *
 * Error codes:
 *   404 — Tenant not found.
 *   403 — Website integration disabled for tenant.
 *   404 — competitionId supplied but competition not found.
 *   500 — Unexpected calculation error.
 */

import { type NextRequest, NextResponse } from "next/server";
import {
  buildWebsiteEnvelope,
  resolveTenantFromParams,
  assertWebsiteEnabled,
} from "@/lib/website/response-helpers";
import {
  calculateCompetitionStandings,
  calculateTenantStandings,
} from "@/lib/standings/standings-service";
import { StandingsError } from "@/lib/standings/errors";

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
    const competitionId = searchParams.get("competitionId");

    if (competitionId) {
      const table = await calculateCompetitionStandings({
        tenantId: tenant.id,
        competitionId,
      });

      return NextResponse.json(
        buildWebsiteEnvelope(
          tenant,
          { standings: table },
          {
            competitionId,
            total: table.rows.length,
            matchCount: table.matchCount,
            lastUpdatedAt: table.lastUpdatedAt?.toISOString() ?? null,
          },
        ),
      );
    }

    const result = await calculateTenantStandings({ tenantId: tenant.id });

    const totalRows = result.tables.reduce(
      (sum, t) => sum + t.rows.length,
      0,
    );

    return NextResponse.json(
      buildWebsiteEnvelope(
        tenant,
        { standings: result.tables },
        {
          competitionCount: result.tables.length,
          total: totalRows,
        },
      ),
    );
  } catch (error) {
    if (error instanceof StandingsError) {
      if (error.code === "COMPETITION_NOT_FOUND") {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }
      if (error.code === "TENANT_NOT_FOUND") {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }
    }

    console.error("[public/[tenant]/website/standings] GET failed:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? "Standings calculation failed: " + error.message
            : "Standings konnte nicht geladen werden.",
      },
      { status: 500 },
    );
  }
}
