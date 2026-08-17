/**
 * DELETE /api/roles/[id]/permanent — Role permanent hard delete.
 *
 * ADMIN-HARD-DELETE-UI: Requires PERMISSIONS.ROLES_DELETE for tenant-scoped roles.
 * System roles (isSystem=true) and PLATFORM-scoped roles are unconditionally blocked.
 *
 * Two-step flow (confirm query param):
 *   DELETE .../permanent              → PREVIEW: returns impact or blocker
 *   DELETE .../permanent?confirm=true → PERFORM: deletes Role + cascade UserRole/permissions
 */

import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { createEffectivePermissionResolver } from "@/lib/permissions/services/effective-permission-resolver";
import { logAction } from "@/lib/audit/log-action";
import {
  getRoleDeletionImpact,
  deleteRolePermanently,
} from "@/lib/roles/role-delete-service";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(request: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // Resolve the role's tenant server-side — never trust client input.
  const role = await prisma.role.findUnique({
    where: { id },
    select: { tenantId: true, scope: true, isSystem: true, name: true, key: true },
  });

  if (!role) {
    return NextResponse.json({ error: "Rolle nicht gefunden." }, { status: 404 });
  }

  // Only TENANT-scoped roles owned by the caller's active tenant are eligible.
  // PLATFORM-scoped roles are blocked unconditionally.
  if (role.scope === "PLATFORM") {
    return NextResponse.json(
      { error: "Plattform-Rollen können nicht über diesen Endpunkt gelöscht werden." },
      { status: 403 },
    );
  }

  const tenantId = role.tenantId ?? session.user.activeTenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "Kein Mandant zugeordnet." }, { status: 400 });
  }

  // Verify caller is operating in the correct tenant context.
  if (role.tenantId !== null && session.user.activeTenantId && role.tenantId !== session.user.activeTenantId) {
    return NextResponse.json({ error: "Rolle nicht gefunden." }, { status: 404 });
  }

  const resolver = createEffectivePermissionResolver(prisma);
  const authorized = await resolver.hasTenantDeletionAuthority({
    userId: session.user.id,
    permission: PERMISSIONS.ROLES_DELETE,
    tenantId,
  });

  if (!authorized) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const confirmed = request.nextUrl.searchParams.get("confirm") === "true";

  if (!confirmed) {
    const impactResult = await getRoleDeletionImpact(tenantId, id);

    if (impactResult === null) {
      return NextResponse.json({ error: "Rolle nicht gefunden." }, { status: 404 });
    }

    if (impactResult.blocked) {
      return NextResponse.json(
        { blocked: true, blocker: impactResult.blocker },
        { status: 409 },
      );
    }

    return NextResponse.json({ impact: impactResult.impact, requiresConfirmation: true });
  }

  const result = await deleteRolePermanently(tenantId, id);

  if (result === null) {
    return NextResponse.json({ error: "Rolle nicht gefunden." }, { status: 404 });
  }

  if ("reason" in result) {
    return NextResponse.json({ blocked: true, blocker: result }, { status: 409 });
  }

  await logAction({
    actorUserId: session.user.effectiveUserId ?? session.user.id ?? null,
    moduleKey: "roles",
    entityType: "Role",
    entityId: id,
    action: "DELETE",
    beforeJson: {
      roleName: result.roleName,
      roleKey: result.roleKey,
      impact: result.impact,
    },
  });

  revalidatePath("/dashboard/administration/roles");

  return NextResponse.json({
    message: "Rolle wurde endgültig gelöscht.",
    impact: result.impact,
  });
}
