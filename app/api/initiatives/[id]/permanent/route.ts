/**
 * DELETE /api/initiatives/[id]/permanent — Initiative permanent hard delete.
 *
 * ADMIN-HARD-DELETE-UI: Requires PERMISSIONS.INITIATIVES_DELETE — deliberately
 * NOT INITIATIVES_MANAGE. A dedicated `/permanent` sub-route keeps the
 * existing DELETE /api/initiatives/[id] behavior completely unchanged.
 *
 * Two-step flow (confirm query param):
 *   DELETE .../permanent              → PREVIEW: returns impact + requiresConfirmation: true
 *   DELETE .../permanent?confirm=true → PERFORM: deletes Initiative
 */

import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { createEffectivePermissionResolver } from "@/lib/permissions/services/effective-permission-resolver";
import { canSeeEntity } from "@/lib/visibility/visibility-filter";
import { getActorContext } from "@/lib/visibility/get-actor-context";
import { logAction } from "@/lib/audit/log-action";
import {
  getInitiativeDeletionImpact,
  deleteInitiativePermanently,
} from "@/lib/initiatives/initiative-delete-service";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(request: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const initiative = await prisma.initiative.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      slug: true,
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

  if (!initiative) {
    return NextResponse.json({ error: "Initiative nicht gefunden." }, { status: 404 });
  }

  const actor = await getActorContext(session.user, session.user?.activeTenantId ?? undefined);

  if (!canSeeEntity(initiative, actor)) {
    return NextResponse.json({ error: "Initiative nicht gefunden." }, { status: 404 });
  }

  const tenantId = session.user.activeTenantId;
  if (!tenantId) {
    return NextResponse.json(
      { error: "Kein aktiver Mandant. Bitte Mandant wechseln." },
      { status: 403 },
    );
  }

  const resolver = createEffectivePermissionResolver(prisma);
  const authorized = await resolver.hasTenantDeletionAuthority({
    userId: session.user.id,
    permission: PERMISSIONS.INITIATIVES_DELETE,
    tenantId,
  });

  if (!authorized) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const confirmed = request.nextUrl.searchParams.get("confirm") === "true";

  if (!confirmed) {
    const impact = await getInitiativeDeletionImpact(id);
    if (impact === null) {
      return NextResponse.json({ error: "Initiative nicht gefunden." }, { status: 404 });
    }
    return NextResponse.json({ impact, requiresConfirmation: true });
  }

  const result = await deleteInitiativePermanently(id);
  if (!result) {
    return NextResponse.json({ error: "Initiative nicht gefunden." }, { status: 404 });
  }

  await logAction({
    actorUserId: session.user.effectiveUserId ?? session.user.id ?? null,
    moduleKey: "initiatives",
    entityType: "Initiative",
    entityId: id,
    action: "DELETE",
    beforeJson: { title: result.title, impact: result.impact },
  });

  revalidatePath("/vereinsleitung/initiativen");

  return NextResponse.json({
    message: "Initiative wurde endgültig gelöscht.",
    impact: result.impact,
  });
}
