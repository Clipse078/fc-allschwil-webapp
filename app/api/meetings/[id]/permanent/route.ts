/**
 * DELETE /api/meetings/[id]/permanent — Meeting permanent hard delete.
 *
 * ADMIN-HARD-DELETE-UI: Requires PERMISSIONS.MEETINGS_DELETE — deliberately
 * NOT MEETINGS_MANAGE, which authorizes create/edit but must never imply
 * permanent deletion. A dedicated `/permanent` sub-route keeps the existing
 * DELETE /api/meetings/[id] behavior completely unchanged.
 *
 * Authorization:
 *   Uses hasTenantDeletionAuthority() with the actor's active tenant.
 *   Meeting has no tenantId of its own; authority is resolved from the
 *   caller's active tenant context. Platform super_admin is always authorized.
 *
 * Two-step flow (confirm query param):
 *   DELETE .../permanent              → PREVIEW: returns impact + requiresConfirmation: true
 *   DELETE .../permanent?confirm=true → PERFORM: deletes Meeting + all cascade children
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
  getMeetingDeletionImpact,
  deleteMeetingPermanently,
} from "@/lib/meetings/meeting-delete-service";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(request: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const meeting = await prisma.meeting.findUnique({
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

  if (!meeting) {
    return NextResponse.json({ error: "Sitzung nicht gefunden." }, { status: 404 });
  }

  const actor = await getActorContext(session.user, session.user?.activeTenantId ?? undefined);

  if (!canSeeEntity(meeting, actor)) {
    return NextResponse.json({ error: "Sitzung nicht gefunden." }, { status: 404 });
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
    permission: PERMISSIONS.MEETINGS_DELETE,
    tenantId,
  });

  if (!authorized) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const confirmed = request.nextUrl.searchParams.get("confirm") === "true";

  if (!confirmed) {
    const impact = await getMeetingDeletionImpact(id);
    if (impact === null) {
      return NextResponse.json({ error: "Sitzung nicht gefunden." }, { status: 404 });
    }
    return NextResponse.json({ impact, requiresConfirmation: true });
  }

  const result = await deleteMeetingPermanently(id);
  if (!result) {
    return NextResponse.json({ error: "Sitzung nicht gefunden." }, { status: 404 });
  }

  await logAction({
    actorUserId: session.user.effectiveUserId ?? session.user.id ?? null,
    moduleKey: "meetings",
    entityType: "Meeting",
    entityId: id,
    action: "DELETE",
    beforeJson: {
      title: result.title,
      impact: result.impact,
    },
  });

  revalidatePath("/vereinsleitung/meetings");

  return NextResponse.json({
    message: "Sitzung wurde endgültig gelöscht.",
    impact: result.impact,
  });
}
