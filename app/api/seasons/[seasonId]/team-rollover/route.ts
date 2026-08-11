/**
 * app/api/seasons/[seasonId]/team-rollover/route.ts
 *
 * ADMIN-MASTERDATA-UX-01-C2 — "Teams übernehmen" bulk Season Team rollover.
 *
 * GET  → candidate existing active tenant Teams not yet registered for this
 *        Season (lib/teams/team-registration-service.ts#getBulkRolloverCandidateTeams).
 * POST → establishes the TeamSeason relationship for every selected Team in
 *        one operation, by calling the canonical registerTeamSeason()
 *        primitive once per Team
 *        (lib/teams/team-registration-service.ts#bulkRegisterExistingTeamsForSeason).
 *        No parallel TeamSeason write path is introduced.
 *
 * Gated by teams.manage — same permission as the single-Team registration
 * wizard (POST /api/teams/register), since this is the same canonical
 * TeamSeason materialization, just applied to multiple Teams at once.
 *
 * Works for an arbitrary target Season regardless of Season.isActive — see
 * lib/teams/team-registration-service.ts for the eligibility rules.
 */

import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getTenantFromSession } from "@/lib/tenants/queries";
import { logAction } from "@/lib/audit/log-action";
import {
  bulkRegisterExistingTeamsForSeason,
  getBulkRolloverCandidateTeams,
} from "@/lib/teams/team-registration-service";

type Context = {
  params: Promise<{ seasonId: string }>;
};

export async function GET(_: NextRequest, context: Context) {
  const access = await requireApiPermission(PERMISSIONS.TEAMS_MANAGE);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenant = await getTenantFromSession(access.session.user?.activeTenantId);
  if (!tenant) {
    return NextResponse.json(
      { error: "Mandant nicht gefunden. Bitte melde dich erneut an." },
      { status: 400 },
    );
  }

  const { seasonId } = await context.params;
  const candidates = await getBulkRolloverCandidateTeams(tenant.id, seasonId);

  return NextResponse.json({ candidates });
}

export async function POST(request: NextRequest, context: Context) {
  const access = await requireApiPermission(PERMISSIONS.TEAMS_MANAGE);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenant = await getTenantFromSession(access.session.user?.activeTenantId);
  if (!tenant) {
    return NextResponse.json(
      { error: "Mandant nicht gefunden. Bitte melde dich erneut an." },
      { status: 400 },
    );
  }

  const { seasonId } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger Anfragekörper." }, { status: 400 });
  }

  const rawTeamIds =
    body && typeof body === "object" && Array.isArray((body as Record<string, unknown>).teamIds)
      ? ((body as Record<string, unknown>).teamIds as unknown[])
      : [];

  const teamIds = rawTeamIds
    .filter((id): id is string => typeof id === "string" && id.trim().length > 0)
    .map((id) => id.trim());

  if (teamIds.length === 0) {
    return NextResponse.json(
      { error: "Mindestens ein Team muss ausgewählt sein." },
      { status: 400 },
    );
  }

  let result;
  try {
    result = await bulkRegisterExistingTeamsForSeason({
      tenantId: tenant.id,
      seasonId,
      teamIds,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "SEASON_NOT_FOUND") {
      return NextResponse.json({ error: "Saison nicht gefunden." }, { status: 404 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unbekannter Fehler." },
      { status: 500 },
    );
  }

  revalidatePath("/dashboard/seasons");
  revalidatePath("/dashboard/teams");
  revalidatePath("/dashboard/training/new");

  await logAction({
    actorUserId: access.session.user?.effectiveUserId ?? access.session.user?.id ?? null,
    moduleKey: "teams",
    entityType: "Season",
    entityId: seasonId,
    action: "UPDATE",
    afterJson: {
      seasonId,
      tenantId: tenant.id,
      requestedTeamIds: teamIds,
      createdCount: result.createdCount,
      alreadyPresentCount: result.alreadyPresentCount,
      skippedCount: result.skippedCount,
      rejectedCount: result.rejectedCount,
    },
  });

  return NextResponse.json(result);
}
