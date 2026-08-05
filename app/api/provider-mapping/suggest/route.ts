/**
 * GET /api/provider-mapping/suggest
 *
 * Returns ranked mapping suggestions for a TeamSeason + provider combination.
 *
 * Authorization: TEAMS_MANAGE.
 *
 * Query parameters:
 *   teamSeasonId   string  — required — canonical TeamSeason to suggest for
 *   provider       string  — required — e.g. "SFV"
 *   competitionId  string  — optional — narrow suggestions by competition/league
 *
 * Response:
 *   { suggestions: MappingSuggestion[] }
 *
 * Suggestions are ranked by descending confidence score. The caller must
 * confirm the selection — no auto-mapping is performed.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { suggestProviderMappings } from "@/lib/provider-mapping/provider-mapping-service";
import { ensureSfvAdapterRegistered } from "@/lib/integrations/sfv/register-adapter";

export const dynamic = "force-dynamic";

ensureSfvAdapterRegistered();

export async function GET(request: NextRequest): Promise<NextResponse> {
  const access = await requireApiPermission(PERMISSIONS.TEAMS_MANAGE);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantId = access.session.user.activeTenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "Kein Mandanten-Kontext." }, { status: 403 });
  }

  const sp = request.nextUrl.searchParams;
  const teamSeasonId = sp.get("teamSeasonId");
  const provider = sp.get("provider");
  const competitionId = sp.get("competitionId") ?? undefined;

  if (!teamSeasonId) {
    return NextResponse.json({ error: "teamSeasonId ist erforderlich." }, { status: 400 });
  }
  if (!provider) {
    return NextResponse.json({ error: "provider ist erforderlich." }, { status: 400 });
  }

  try {
    const suggestions = await suggestProviderMappings(
      tenantId,
      teamSeasonId,
      provider,
      competitionId,
    );
    return NextResponse.json({ suggestions });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unbekannter Fehler.";
    console.error("[provider-mapping/suggest] GET error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
