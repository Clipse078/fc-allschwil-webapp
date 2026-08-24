import { NextRequest, NextResponse } from "next/server";
import { requireApiAnyPermission } from "@/lib/permissions/require-api-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getPlayerAttendanceHistory } from "@/lib/attendance/queries";
import { assertTeamSeasonAccess } from "@/lib/attendance/route-helpers";

type Context = {
  params: Promise<{ teamId: string; teamSeasonId: string; personId: string }>;
};

export async function GET(_request: NextRequest, context: Context) {
  const access = await requireApiAnyPermission([
    PERMISSIONS.TEAMS_VIEW,
    PERMISSIONS.TEAMS_MANAGE,
    PERMISSIONS.TEAMS_DELETE,
  ]);

  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantId = access.session?.user.activeTenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "Kein Mandant aktiv." }, { status: 400 });
  }

  const { teamId, teamSeasonId, personId } = await context.params;
  const teamSeason = await assertTeamSeasonAccess(teamId, teamSeasonId, tenantId);

  if (!teamSeason) {
    return NextResponse.json({ error: "Team-Saison nicht gefunden." }, { status: 404 });
  }

  const history = await getPlayerAttendanceHistory(tenantId, teamSeasonId, personId);
  return NextResponse.json({ history });
}
