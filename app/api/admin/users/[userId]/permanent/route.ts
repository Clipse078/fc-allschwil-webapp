/**
 * DELETE /api/admin/users/[userId]/permanent — Global User account permanent hard delete.
 *
 * ADMIN-HARD-DELETE-UI: Requires PERMISSIONS.USERS_DELETE (scope=PLATFORM).
 * Only the SCE super_admin platform role carries this permission. Club Admins
 * may never perform global User deletion.
 *
 * For tenant membership removal (Club Admin flow), use:
 *   DELETE /api/admin/users/[userId]/membership
 *
 * Two-step flow (confirm query param):
 *   DELETE .../permanent              → PREVIEW: returns impact or blocker
 *   DELETE .../permanent?confirm=true → PERFORM: deletes User (cascades all tenant data)
 *
 * Safety: blocked if the user is the last active super_admin.
 */

import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { createEffectivePermissionResolver } from "@/lib/permissions/services/effective-permission-resolver";
import { logAction } from "@/lib/audit/log-action";
import {
  getUserDeletionImpact,
  deleteUserPermanently,
} from "@/lib/users/user-delete-service";

type Params = { params: Promise<{ userId: string }> };

export async function DELETE(request: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { userId } = await params;

  // Platform permission check: users.delete is scope=PLATFORM.
  // No tenantId supplied → resolver checks platform permissions only.
  const resolver = createEffectivePermissionResolver(prisma);
  const authorized = await resolver.hasPermission({
    userId: session.user.id,
    permission: PERMISSIONS.USERS_DELETE,
  });

  if (!authorized) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Prevent self-deletion.
  if (userId === session.user.id) {
    return NextResponse.json(
      { error: "Du kannst deinen eigenen Account nicht endgültig löschen." },
      { status: 400 },
    );
  }

  const confirmed = request.nextUrl.searchParams.get("confirm") === "true";

  if (!confirmed) {
    const impactResult = await getUserDeletionImpact(userId);

    if (impactResult === null) {
      return NextResponse.json({ error: "Benutzer nicht gefunden." }, { status: 404 });
    }

    if (impactResult.blocked) {
      return NextResponse.json(
        { blocked: true, blocker: impactResult.blocker },
        { status: 409 },
      );
    }

    return NextResponse.json({
      impact: impactResult.impact,
      requiresConfirmation: true,
    });
  }

  const result = await deleteUserPermanently(userId);

  if (result === null) {
    return NextResponse.json({ error: "Benutzer nicht gefunden." }, { status: 404 });
  }

  if ("reason" in result) {
    return NextResponse.json(
      { blocked: true, blocker: result },
      { status: 409 },
    );
  }

  await logAction({
    actorUserId: session.user.effectiveUserId ?? session.user.id ?? null,
    moduleKey: "users",
    entityType: "User",
    entityId: userId,
    action: "DELETE",
    beforeJson: {
      email: result.email,
      displayName: result.displayName,
      impact: result.impact,
    },
  });

  revalidatePath("/dashboard/users");

  return NextResponse.json({
    message: "Benutzer-Account wurde endgültig gelöscht.",
    impact: result.impact,
  });
}
