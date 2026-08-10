import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { getTenantFromSession } from "@/lib/tenants/queries";
import { logAction } from "@/lib/audit/log-action";
import {
  setTeamSeasonCompetition,
  type SetTeamSeasonCompetitionErrorCode,
} from "@/lib/teams/team-season-service";

type Context = { params: Promise<{ teamId: string; teamSeasonId: string }> };

const ERROR_STATUS: Record<SetTeamSeasonCompetitionErrorCode, number> = {
  TEAM_SEASON_NOT_FOUND: 404,
  TEAM_SEASON_TENANT_MISMATCH: 403,
  COMPETITION_NOT_FOUND: 404,
  COMPETITION_TENANT_MISMATCH: 403,
  COMPETITION_ARCHIVED: 409,
  COMPETITION_NOT_ALLOWED: 400,
  UNKNOWN_ERROR: 500,
};

/**
 * PATCH /api/teams/[teamId]/team-seasons/[teamSeasonId]/competition
 *
 * TEAMCENTER-UX-01C: (Re-)assigns or clears the primary Wettbewerb/Liga
 * (TeamSeasonCompetition) for an existing TeamSeason — the only prior write
 * path was the registration wizard (team-registration-service.ts), which
 * could not be used again once a Team already existed. This route is a thin
 * wrapper around the canonical `setTeamSeasonCompetition` service; no
 * business rules are duplicated here.
 *
 * Body: `{ competitionId: string | null }` — null/omitted/empty clears the
 * assignment. Strictly tenant-scoped; requires TEAMS_MANAGE.
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

  const rawCompetitionId = (body as { competitionId?: unknown } | null)?.competitionId;
  const competitionId =
    rawCompetitionId === null || rawCompetitionId === undefined || rawCompetitionId === ""
      ? null
      : String(rawCompetitionId).trim();

  const result = await setTeamSeasonCompetition({
    tenantId: tenant.id,
    teamId,
    teamSeasonId,
    competitionId,
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
    entityType: "TeamSeasonCompetition",
    entityId: teamSeasonId,
    action: "UPDATE",
    afterJson: {
      teamId,
      teamSeasonId,
      competitionId: result.competition?.id ?? null,
      competitionName: result.competition?.officialName ?? null,
    },
  });

  revalidatePath("/dashboard/teams");
  revalidatePath("/dashboard/teams/" + teamId);

  return NextResponse.json({
    message: result.competition
      ? "Wettbewerb wurde zugeordnet."
      : "Wettbewerb-Zuordnung wurde entfernt.",
    competition: result.competition,
  });
}
