/**
 * DELETE /api/competitions/[competitionId]/permanent — Competition permanent hard delete.
 *
 * ADMIN-HARD-DELETE-UI-UPLIFT: Requires PERMISSIONS.COMPETITIONS_DELETE.
 * A dedicated `/permanent` sub-route preserves the existing
 * DELETE /api/competitions/[competitionId] soft-archive behavior unchanged.
 *
 * Two-step flow (confirm query param):
 *   DELETE .../permanent              → PREVIEW: returns impact + requiresConfirmation: true
 *   DELETE .../permanent?confirm=true → PERFORM: removes TeamSeasonCompetition links,
 *                                        then deletes Competition in a transaction.
 */

import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { createEffectivePermissionResolver } from "@/lib/permissions/services/effective-permission-resolver";
import { logAction } from "@/lib/audit/log-action";
import {
  getCompetitionDeletionImpact,
  deleteCompetitionPermanently,
} from "@/lib/competitions/competition-delete-service";

type Params = { params: Promise<{ competitionId: string }> };

export async function DELETE(request: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { competitionId } = await params;

  // Resolve tenant server-side from the Competition row — never from client.
  const competition = await prisma.competition.findUnique({
    where: { id: competitionId },
    select: { tenantId: true, officialName: true },
  });

  if (!competition) {
    return NextResponse.json({ error: "Wettbewerb nicht gefunden." }, { status: 404 });
  }

  const tenantId = competition.tenantId;

  // Tenant isolation: caller must operate in the same tenant.
  if (session.user.activeTenantId && competition.tenantId !== session.user.activeTenantId) {
    return NextResponse.json({ error: "Wettbewerb nicht gefunden." }, { status: 404 });
  }

  const resolver = createEffectivePermissionResolver(prisma);
  const authorized = await resolver.hasTenantDeletionAuthority({
    userId: session.user.id,
    permission: PERMISSIONS.COMPETITIONS_DELETE,
    tenantId,
  });

  if (!authorized) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const confirmed = request.nextUrl.searchParams.get("confirm") === "true";

  if (!confirmed) {
    const impact = await getCompetitionDeletionImpact(tenantId, competitionId);
    if (impact === null) {
      return NextResponse.json({ error: "Wettbewerb nicht gefunden." }, { status: 404 });
    }
    return NextResponse.json({ impact, requiresConfirmation: true });
  }

  const result = await deleteCompetitionPermanently(tenantId, competitionId);
  if (!result) {
    return NextResponse.json({ error: "Wettbewerb nicht gefunden." }, { status: 404 });
  }

  await logAction({
    actorUserId: session.user.effectiveUserId ?? session.user.id ?? null,
    moduleKey: "competitions",
    entityType: "Competition",
    entityId: competitionId,
    action: "DELETE",
    beforeJson: { officialName: result.officialName, impact: result.impact },
  });

  revalidatePath("/dashboard/competitions");

  return NextResponse.json({
    message: "Wettbewerb wurde endgültig gelöscht.",
    impact: result.impact,
  });
}
