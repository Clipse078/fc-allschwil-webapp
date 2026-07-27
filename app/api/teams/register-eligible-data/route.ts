/**
 * app/api/teams/register-eligible-data/route.ts
 *
 * GET /api/teams/register-eligible-data
 *
 * Returns data needed for the Team registration wizard:
 *   - seasons: all seasons with lifecycle status
 *   - orgUnits: eligible (active, tenant-scoped) org units
 *   - existingTeams: existing active teams in the tenant (for "reuse" flow)
 *   - unmappedFederationTeams: unmapped TeamExternalMapping rows (for Verband step)
 *   - eligibleCompetitions: non-archived competitions for the tenant (for Competition step)
 *
 * Requires: teams.manage permission
 */

import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getTenantFromSession } from "@/lib/tenants/queries";
import { getEligibleOrgUnitsForTeamSeason } from "@/lib/teams/team-season-service";
import {
  getRegistrationEligibleSeasons,
  getExistingTeamsForTenant,
  getUnmappedFederationTeams,
} from "@/lib/teams/team-registration-service";
import { getEligibleCompetitions } from "@/lib/competitions/queries";

export async function GET() {
  const access = await requireApiPermission(PERMISSIONS.TEAMS_MANAGE);

  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenant = await getTenantFromSession(access.session.user?.tenantId);
  if (!tenant) {
    return NextResponse.json(
      { error: "Mandant nicht gefunden." },
      { status: 400 },
    );
  }

  const [seasons, orgUnits, existingTeams, unmappedFederationTeams, eligibleCompetitions] =
    await Promise.all([
      getRegistrationEligibleSeasons(),
      getEligibleOrgUnitsForTeamSeason(tenant.id),
      getExistingTeamsForTenant(tenant.id),
      getUnmappedFederationTeams(tenant.id),
      getEligibleCompetitions(tenant.id),
    ]);

  return NextResponse.json({
    seasons,
    orgUnits,
    existingTeams,
    unmappedFederationTeams,
    eligibleCompetitions,
  });
}
