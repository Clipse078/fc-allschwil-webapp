/**
 * DELETE /api/org-units/[id]/permanent — OrgUnit permanent hard delete.
 *
 * ADMIN-DELETE-ORG-01: Requires PERMISSIONS.ORG_DELETE — deliberately NOT
 * ORG_MANAGE, which authorizes create/edit/archive but must never imply
 * permanent deletion. A dedicated `/permanent` sub-route keeps the
 * existing DELETE /api/org-units/[id] (archive) behavior unchanged.
 *
 * Authorization:
 *   1. OrgUnit and its owning tenant are resolved server-side from `id`.
 *   2. EffectivePermissionResolver.hasTenantDeletionAuthority() decides
 *      whether the caller may delete within that exact tenant.
 *
 * Two-step flow:
 *   DELETE .../permanent              → PREVIEW: impact + requiresConfirmation.
 *   DELETE .../permanent?confirm=true → PERFORM: cascade cleanup + delete.
 *
 * Preservation guarantees:
 *   • Persons survive — PersonAssignment rows are removed, Person stays.
 *   • Teams survive — Team.orgUnitId set to null (legacy link dissolved).
 *   • TeamSeasons survive — TeamSeasonOrgUnit join rows are cascade-deleted.
 *   • Users survive — scoped UserRole grants on this OrgUnit are removed;
 *     User, TenantMembership, non-scoped UserRole remain untouched.
 *   • Children are re-rooted (parentId → null), not deleted.
 */

import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { createEffectivePermissionResolver } from "@/lib/permissions/services/effective-permission-resolver";
import { logAction } from "@/lib/audit/log-action";
import {
  getOrgUnitDeletionImpact,
  deleteOrgUnitPermanently,
} from "@/lib/org-units/orgunit-delete-service";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(request: NextRequest, { params }: Params) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // Resolve OrgUnit and its tenant strictly server-side.
  const orgUnit = await prisma.orgUnit.findUnique({
    where: { id },
    select: { id: true, tenantId: true, name: true },
  });

  if (!orgUnit) {
    return NextResponse.json({ error: "Organisationseinheit nicht gefunden." }, { status: 404 });
  }

  // Legacy null tenantId rows fall through to the resolver with their actual tenantId.
  // We need a concrete tenantId for hasTenantDeletionAuthority; resolve from session
  // if the row has no tenantId (legacy backfill scenario).
  const orgUnitTenantId =
    orgUnit.tenantId ?? (session.user as { activeTenantId?: string }).activeTenantId ?? null;

  if (!orgUnitTenantId) {
    return NextResponse.json({ error: "Tenant-Kontext nicht bestimmbar." }, { status: 400 });
  }

  const resolver = createEffectivePermissionResolver(prisma);
  const authorized = await resolver.hasTenantDeletionAuthority({
    userId: session.user.id,
    permission: PERMISSIONS.ORG_DELETE,
    tenantId: orgUnitTenantId,
  });

  if (!authorized) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const confirmed = request.nextUrl.searchParams.get("confirm") === "true";

  if (!confirmed) {
    const impact = await getOrgUnitDeletionImpact(orgUnitTenantId, id);

    if (impact === null) {
      return NextResponse.json({ error: "Organisationseinheit nicht gefunden." }, { status: 404 });
    }

    return NextResponse.json({ impact, requiresConfirmation: true });
  }

  const result = await deleteOrgUnitPermanently(orgUnitTenantId, id);

  if (!result) {
    return NextResponse.json({ error: "Organisationseinheit nicht gefunden." }, { status: 404 });
  }

  await logAction({
    actorUserId: session.user.effectiveUserId ?? session.user.id ?? null,
    moduleKey: "org",
    entityType: "OrgUnit",
    entityId: id,
    action: "DELETE",
    beforeJson: {
      name: result.name,
      key: result.key,
      impact: result.impact,
    },
  });

  revalidatePath("/dashboard/org-units");

  return NextResponse.json({
    message: "Organisationseinheit wurde endgültig gelöscht.",
    impact: result.impact,
  });
}
