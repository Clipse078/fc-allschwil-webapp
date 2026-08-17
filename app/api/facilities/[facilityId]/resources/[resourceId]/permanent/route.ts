/**
 * DELETE /api/facilities/[facilityId]/resources/[resourceId]/permanent
 * — FacilityResource permanent hard delete.
 *
 * ADMIN-DELETE-FACILITIES-01: Requires PERMISSIONS.FACILITIES_DELETE.
 *
 * Cross-facility guard: the resource's facilityId must match the URL facilityId.
 *
 * Two-step flow:
 *   DELETE .../permanent              → PREVIEW: impact + requiresConfirmation.
 *   DELETE .../permanent?confirm=true → PERFORM: cascade-delete resource + allocation links.
 *
 * Preservation:
 *   Canonical planning entities (TrainingSeries, TrainingSession, Events,
 *   Tournaments, WeekplannerPlan) are NEVER deleted. Only the resource
 *   allocation links cascade-delete automatically via onDelete: Cascade.
 */

import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { createEffectivePermissionResolver } from "@/lib/permissions/services/effective-permission-resolver";
import { logAction } from "@/lib/audit/log-action";
import {
  getFacilityResourceDeletionImpact,
  deleteFacilityResourcePermanently,
} from "@/lib/facilities/facility-delete-service";

type Params = { params: Promise<{ facilityId: string; resourceId: string }> };

export async function DELETE(request: NextRequest, { params }: Params) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { facilityId, resourceId } = await params;

  const resource = await prisma.facilityResource.findUnique({
    where: { id: resourceId },
    select: { id: true, tenantId: true, facilityId: true, name: true, code: true },
  });

  if (!resource) {
    return NextResponse.json({ error: "Ressource nicht gefunden." }, { status: 404 });
  }

  // Cross-facility guard: resource must belong to the URL-specified facility.
  if (resource.facilityId !== facilityId) {
    return NextResponse.json({ error: "Ressource nicht gefunden." }, { status: 404 });
  }

  const resolver = createEffectivePermissionResolver(prisma);
  const authorized = await resolver.hasTenantDeletionAuthority({
    userId: session.user.id,
    permission: PERMISSIONS.FACILITIES_DELETE,
    tenantId: resource.tenantId,
  });

  if (!authorized) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const confirmed = request.nextUrl.searchParams.get("confirm") === "true";

  if (!confirmed) {
    const impact = await getFacilityResourceDeletionImpact(resource.tenantId, resourceId);

    if (impact === null) {
      return NextResponse.json({ error: "Ressource nicht gefunden." }, { status: 404 });
    }

    return NextResponse.json({ impact, requiresConfirmation: true });
  }

  const result = await deleteFacilityResourcePermanently(resource.tenantId, resourceId);

  if (!result) {
    return NextResponse.json({ error: "Ressource nicht gefunden." }, { status: 404 });
  }

  await logAction({
    actorUserId: session.user.effectiveUserId ?? session.user.id ?? null,
    moduleKey: "facilities",
    entityType: "FacilityResource",
    entityId: resourceId,
    action: "DELETE",
    beforeJson: { name: result.name, code: result.code, facilityId, impact: result.impact },
  });

  revalidatePath("/dashboard/admin/facilities");

  return NextResponse.json({
    message: "Ressource wurde endgültig gelöscht.",
    impact: result.impact,
  });
}
