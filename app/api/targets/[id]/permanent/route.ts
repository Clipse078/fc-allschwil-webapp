/**
 * DELETE /api/targets/[id]/permanent — Target permanent hard delete.
 *
 * ADMIN-HARD-DELETE-UI: Requires PERMISSIONS.TARGETS_DELETE — deliberately
 * NOT TARGETS_MANAGE. A dedicated `/permanent` sub-route keeps the existing
 * DELETE /api/targets/[id] behavior completely unchanged.
 *
 * Two-step flow (confirm query param):
 *   DELETE .../permanent              → PREVIEW: returns impact + requiresConfirmation: true
 *   DELETE .../permanent?confirm=true → PERFORM: deletes Target + cascade children
 */

import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { createEffectivePermissionResolver } from "@/lib/permissions/services/effective-permission-resolver";
import { canSeeEntity } from "@/lib/visibility/visibility-filter";
import { resolveLiveTenantActor } from "@/lib/permissions/require-strategic-api-context";
import { logAction } from "@/lib/audit/log-action";
import {
  getTargetDeletionImpact,
  deleteTargetPermanently,
} from "@/lib/targets/target-delete-service";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(request: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const tenantId = session.user.activeTenantId;
  const actorUserId = session.user.effectiveUserId ?? session.user.id;
  if (!tenantId || !actorUserId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const target = await prisma.target.findFirst({
    where: { id, tenantId },
    select: {
      id: true,
      title: true,
      visibilityScope: true,
      visibleRoleRefs: true,
      visibleUserRefs: true,
      visibleTeamRefs: true,
      visibleOrgUnitRefs: true,
      visiblePersonRefs: true,
      visibleTargetGroupRefs: true,
      createdByUserId: true,
    },
  });

  if (!target) {
    return NextResponse.json({ error: "Ziel nicht gefunden." }, { status: 404 });
  }

  const actor = await resolveLiveTenantActor(tenantId, actorUserId);

  if (!actor || !canSeeEntity(target, actor)) {
    return NextResponse.json({ error: "Ziel nicht gefunden." }, { status: 404 });
  }

  const resolver = createEffectivePermissionResolver(prisma);
  const authorized = await resolver.hasTenantDeletionAuthority({
    userId: actorUserId,
    permission: PERMISSIONS.TARGETS_DELETE,
    tenantId,
  });

  if (!authorized) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const confirmed = request.nextUrl.searchParams.get("confirm") === "true";

  if (!confirmed) {
    const impact = await getTargetDeletionImpact(id, tenantId);
    if (impact === null) {
      return NextResponse.json({ error: "Ziel nicht gefunden." }, { status: 404 });
    }
    return NextResponse.json({ impact, requiresConfirmation: true });
  }

  const result = await deleteTargetPermanently(id, tenantId);
  if (!result) {
    return NextResponse.json({ error: "Ziel nicht gefunden." }, { status: 404 });
  }

  await logAction({
    actorUserId: session.user.effectiveUserId ?? session.user.id ?? null,
    moduleKey: "targets",
    entityType: "Target",
    entityId: id,
    action: "DELETE",
    beforeJson: { title: result.title, impact: result.impact },
  });

  revalidatePath("/vereinsleitung/targets");

  return NextResponse.json({
    message: "Ziel wurde endgültig gelöscht.",
    impact: result.impact,
  });
}
