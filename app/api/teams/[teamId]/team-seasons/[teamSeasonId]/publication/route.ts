import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { logAction } from "@/lib/audit/log-action";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import {
  updateTeamSeasonPublication,
  type UpdateTeamSeasonPublicationResult,
} from "@/lib/teams/team-season-service";
import { getTenantFromSession } from "@/lib/tenants/queries";

type Context = { params: Promise<{ teamId: string; teamSeasonId: string }> };

const publicationUpdateSchema = z
  .object({
    showNextMatch: z.boolean().optional(),
    showNextTournament: z.boolean().optional(),
    squadWebsiteVisible: z.boolean().optional(),
    trainerTeamWebsiteVisible: z.boolean().optional(),
    trainingWebsiteVisible: z.boolean().optional(),
  })
  .strict()
  .refine(
    (value) =>
      value.showNextMatch !== undefined ||
      value.showNextTournament !== undefined ||
      value.squadWebsiteVisible !== undefined ||
      value.trainerTeamWebsiteVisible !== undefined ||
      value.trainingWebsiteVisible !== undefined,
    { message: "Mindestens eine Veröffentlichungseinstellung ist erforderlich." },
  );

const ERROR_STATUS: Record<
  Exclude<UpdateTeamSeasonPublicationResult, { ok: true }>["code"],
  number
> = {
  TEAM_SEASON_NOT_FOUND: 404,
  TEAM_SEASON_TENANT_MISMATCH: 403,
  NO_FIELDS_SUPPLIED: 400,
  UNKNOWN_ERROR: 500,
};

/**
 * PATCH /api/teams/[teamId]/team-seasons/[teamSeasonId]/publication
 *
 * Updates only supplied, seasonal public team-page publication controls.
 * Requires teams.manage and derives the tenant exclusively from the session.
 */
export async function PATCH(request: NextRequest, { params }: Context) {
  const access = await requireApiPermission(PERMISSIONS.TEAMS_MANAGE);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenant = await getTenantFromSession(access.session.user?.activeTenantId);
  if (!tenant) {
    return NextResponse.json(
      { error: "Standard-Tenant nicht gefunden." },
      { status: 500 },
    );
  }

  const parsed = publicationUpdateSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Ungültiger Anfragetext." },
      { status: 400 },
    );
  }

  const { teamId, teamSeasonId } = await params;
  const result = await updateTeamSeasonPublication({
    tenantId: tenant.id,
    teamId,
    teamSeasonId,
    ...parsed.data,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.message },
      { status: ERROR_STATUS[result.code] },
    );
  }

  await logAction({
    actorUserId:
      access.session.user?.effectiveUserId ?? access.session.user?.id ?? null,
    moduleKey: "teams",
    entityType: "TeamSeason",
    entityId: teamSeasonId,
    action: "UPDATE",
    beforeJson: result.before,
    afterJson: result.publication,
    metadataJson: {
      teamId,
      fields: Object.keys(parsed.data),
    },
  });

  revalidatePath("/dashboard/teams");
  revalidatePath(`/dashboard/teams/${teamId}`);

  return NextResponse.json({
    message: "Website-Veröffentlichung wurde gespeichert.",
    publication: result.publication,
  });
}
