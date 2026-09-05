/**
 * DELETE /api/teams/[teamId]/team-seasons/[teamSeasonId]/permanent
 *
 * TeamSeason permanent hard delete. Reuses PERMISSIONS.TEAMS_DELETE —
 * TeamSeason is part of the Team lifecycle and the same authority grants
 * permanent seasonal-record deletion.
 *
 * Two-step flow (confirm query param):
 *   DELETE .../permanent              → PREVIEW: returns impact + requiresConfirmation: true
 *   DELETE .../permanent?confirm=true → PERFORM: non-FK weekplanner cleanup,
 *                                        then TeamSeason delete in a transaction.
 *
 * Tenant is resolved server-side via TeamSeason → Team → tenantId.
 * Never uses a client-supplied tenantId.
 */

import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { createEffectivePermissionResolver } from "@/lib/permissions/services/effective-permission-resolver";
import { logAction } from "@/lib/audit/log-action";
import {
  getTeamSeasonDeletionImpact,
  deleteTeamSeasonPermanently,
} from "@/lib/teams/team-season-delete-service";

type Params = { params: Promise<{ teamId: string; teamSeasonId: string }> };

export async function DELETE(request: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const activeTenantId = session.user.activeTenantId;
  if (!activeTenantId) {
    return NextResponse.json({ error: "Kein Mandanten-Kontext." }, { status: 403 });
  }

  const { teamId, teamSeasonId } = await params;

  // TeamSeason ownership is Team → tenantId and must match the active tenant.
  const teamSeason = await prisma.teamSeason.findFirst({
    where: { id: teamSeasonId, teamId, team: { tenantId: activeTenantId } },
    select: {
      id: true,
      teamId: true,
      displayName: true,
      team: { select: { id: true, tenantId: true } },
    },
  });

  if (!teamSeason) {
    return NextResponse.json({ error: "TeamSaison nicht gefunden." }, { status: 404 });
  }

  const resolver = createEffectivePermissionResolver(prisma);
  const authorized = await resolver.hasTenantDeletionAuthority({
    userId: session.user.effectiveUserId ?? session.user.id,
    permission: PERMISSIONS.TEAMS_DELETE,
    tenantId: activeTenantId,
  });

  if (!authorized) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const confirmed = request.nextUrl.searchParams.get("confirm") === "true";

  if (!confirmed) {
    const impact = await getTeamSeasonDeletionImpact(activeTenantId, teamSeasonId);
    if (impact === null) {
      return NextResponse.json({ error: "TeamSaison nicht gefunden." }, { status: 404 });
    }
    return NextResponse.json({ impact, requiresConfirmation: true });
  }

  const result = await deleteTeamSeasonPermanently(activeTenantId, teamSeasonId);
  if (!result) {
    return NextResponse.json({ error: "TeamSaison nicht gefunden." }, { status: 404 });
  }

  await logAction({
    actorUserId: session.user.effectiveUserId ?? session.user.id ?? null,
    moduleKey: "teams",
    entityType: "TeamSeason",
    entityId: teamSeasonId,
    action: "DELETE",
    beforeJson: {
      teamId,
      displayName: result.displayName,
      seasonName: result.seasonName,
      impact: result.impact,
    },
  });

  revalidatePath(`/dashboard/teams/${teamId}`);

  return NextResponse.json({
    message: "TeamSaison wurde endgültig gelöscht.",
    impact: result.impact,
  });
}
