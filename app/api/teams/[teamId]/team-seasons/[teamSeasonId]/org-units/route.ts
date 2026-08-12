import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { getTenantFromSession } from "@/lib/tenants/queries";
import { logAction } from "@/lib/audit/log-action";
import {
  setTeamSeasonOrgUnit,
  type SetTeamSeasonOrgUnitErrorCode,
} from "@/lib/teams/team-season-service";

type Context = { params: Promise<{ teamId: string; teamSeasonId: string }> };

const ERROR_STATUS: Record<SetTeamSeasonOrgUnitErrorCode, number> = {
  TEAM_SEASON_NOT_FOUND: 404,
  TEAM_SEASON_TENANT_MISMATCH: 403,
  ORG_UNIT_NOT_FOUND: 404,
  ORG_UNIT_TENANT_MISMATCH: 403,
  ORG_UNIT_NOT_ACTIVE: 409,
  UNKNOWN_ERROR: 500,
};

/**
 * PATCH /api/teams/[teamId]/team-seasons/[teamSeasonId]/org-units
 *
 * TEAM-SEASON-ORGUNIT-01: (Re-)assigns or clears the primary OrgUnit
 * (TeamSeasonOrgUnit) for an existing TeamSeason.
 *
 * Body: `{ orgUnitId: string | null }` — null/omitted/empty clears the
 * primary assignment. Strictly tenant-scoped; requires TEAMS_MANAGE.
 *
 * Mirrors the competition route pattern.
 */
export async function PATCH(request: NextRequest, { params }: Context) {
  const access = await requireApiPermission(PERMISSIONS.TEAMS_MANAGE);

  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const { teamId, teamSeasonId } = await params;

  const tenant = await getTenantFromSession(access.session.user?.activeTenantId);
  if (!tenant) {
    return NextResponse.json({ error: "Standard-Tenant nicht gefunden." }, { status: 500 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger Anfragetext." }, { status: 400 });
  }

  const rawOrgUnitId = (body as { orgUnitId?: unknown } | null)?.orgUnitId;
  const orgUnitId =
    rawOrgUnitId === null || rawOrgUnitId === undefined || rawOrgUnitId === ""
      ? null
      : String(rawOrgUnitId).trim();

  const result = await setTeamSeasonOrgUnit({
    tenantId: tenant.id,
    teamId,
    teamSeasonId,
    orgUnitId,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.message },
      { status: ERROR_STATUS[result.code] ?? 400 },
    );
  }

  await logAction({
    actorUserId:
      access.session?.user?.effectiveUserId ?? access.session?.user?.id ?? null,
    moduleKey: "teams",
    entityType: "TeamSeasonOrgUnit",
    entityId: teamSeasonId,
    action: "UPDATE",
    afterJson: {
      teamId,
      teamSeasonId,
      orgUnitId: result.orgUnit?.id ?? null,
      orgUnitName: result.orgUnit?.name ?? null,
      orgUnitKey: result.orgUnit?.key ?? null,
    },
  });

  revalidatePath("/dashboard/teams");
  revalidatePath("/dashboard/teams/" + teamId);

  return NextResponse.json({
    message: result.orgUnit
      ? "Organisationseinheit wurde zugeordnet."
      : "Organisationseinheit-Zuordnung wurde entfernt.",
    orgUnit: result.orgUnit,
  });
}
