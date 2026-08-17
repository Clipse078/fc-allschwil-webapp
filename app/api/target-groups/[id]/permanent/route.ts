/**
 * DELETE /api/target-groups/[id]/permanent — TargetGroup permanent hard delete.
 *
 * ADMIN-HARD-DELETE-UI: Requires PERMISSIONS.ORG_DELETE — deliberately NOT
 * ORG_MANAGE. TargetGroups are org-module entities; org.delete is the canonical
 * permanent-deletion permission for this module.
 *
 * Two-step flow (confirm query param):
 *   DELETE .../permanent              → PREVIEW: returns impact + requiresConfirmation: true
 *   DELETE .../permanent?confirm=true → PERFORM: deletes TargetGroup, nulls Registration.targetGroupId
 */

import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { createEffectivePermissionResolver } from "@/lib/permissions/services/effective-permission-resolver";
import { logAction } from "@/lib/audit/log-action";
import {
  getTargetGroupDeletionImpact,
  deleteTargetGroupPermanently,
} from "@/lib/org/target-group-delete-service";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(request: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const tg = await prisma.targetGroup.findUnique({
    where: { id },
    select: { id: true, tenantId: true, name: true, key: true },
  });

  if (!tg) {
    return NextResponse.json({ error: "Zielgruppe nicht gefunden." }, { status: 404 });
  }

  const activeTenantId = session.user.activeTenantId;
  const targetGroupTenantId = tg.tenantId ?? activeTenantId;

  if (!targetGroupTenantId) {
    return NextResponse.json({ error: "Zielgruppe hat keinen Mandanten." }, { status: 400 });
  }

  // Tenant isolation: caller must operate in the same tenant as the target group.
  if (tg.tenantId !== null && activeTenantId && tg.tenantId !== activeTenantId) {
    return NextResponse.json({ error: "Zielgruppe nicht gefunden." }, { status: 404 });
  }

  const resolver = createEffectivePermissionResolver(prisma);
  const authorized = await resolver.hasTenantDeletionAuthority({
    userId: session.user.id,
    permission: PERMISSIONS.ORG_DELETE,
    tenantId: targetGroupTenantId,
  });

  if (!authorized) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const confirmed = request.nextUrl.searchParams.get("confirm") === "true";

  if (!confirmed) {
    const impact = await getTargetGroupDeletionImpact(targetGroupTenantId, id);
    if (impact === null) {
      return NextResponse.json({ error: "Zielgruppe nicht gefunden." }, { status: 404 });
    }
    return NextResponse.json({ impact, requiresConfirmation: true });
  }

  const result = await deleteTargetGroupPermanently(targetGroupTenantId, id);
  if (!result) {
    return NextResponse.json({ error: "Zielgruppe nicht gefunden." }, { status: 404 });
  }

  await logAction({
    actorUserId: session.user.effectiveUserId ?? session.user.id ?? null,
    moduleKey: "org",
    entityType: "TargetGroup",
    entityId: id,
    action: "DELETE",
    beforeJson: { name: result.name, key: result.key, impact: result.impact },
  });

  revalidatePath("/dashboard/target-groups");

  return NextResponse.json({
    message: "Zielgruppe wurde endgültig gelöscht.",
    impact: result.impact,
  });
}
