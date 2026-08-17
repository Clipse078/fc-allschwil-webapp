/**
 * DELETE /api/facilities/[facilityId]/permanent — Facility permanent hard delete.
 *
 * ADMIN-DELETE-FACILITIES-01: Requires PERMISSIONS.FACILITIES_DELETE — deliberately
 * NOT FACILITIES_MANAGE. A dedicated `/permanent` sub-route keeps the existing
 * PATCH (update) behavior completely unchanged.
 *
 * Authorization: session tenantId + FACILITIES_DELETE via hasTenantDeletionAuthority.
 *
 * Two-step flow:
 *   DELETE .../permanent              → PREVIEW: impact + requiresConfirmation.
 *   DELETE .../permanent?confirm=true → PERFORM: cascade-delete children, then Facility.
 *
 * Preservation:
 *   Canonical planning entities (TrainingSeries, TrainingSession, Events,
 *   Tournaments, WeekplannerPlan) are NEVER deleted. Only the resource
 *   allocation links cascade-delete with the resource rows.
 */

import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { createEffectivePermissionResolver } from "@/lib/permissions/services/effective-permission-resolver";
import { logAction } from "@/lib/audit/log-action";
import {
  getFacilityDeletionImpact,
  deleteFacilityPermanently,
} from "@/lib/facilities/facility-delete-service";

type Params = { params: Promise<{ facilityId: string }> };

export async function DELETE(request: NextRequest, { params }: Params) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { facilityId } = await params;

  const facility = await prisma.facility.findUnique({
    where: { id: facilityId },
    select: { id: true, tenantId: true, name: true },
  });

  if (!facility) {
    return NextResponse.json({ error: "Anlage nicht gefunden." }, { status: 404 });
  }

  const resolver = createEffectivePermissionResolver(prisma);
  const authorized = await resolver.hasTenantDeletionAuthority({
    userId: session.user.id,
    permission: PERMISSIONS.FACILITIES_DELETE,
    tenantId: facility.tenantId,
  });

  if (!authorized) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const confirmed = request.nextUrl.searchParams.get("confirm") === "true";

  if (!confirmed) {
    const impact = await getFacilityDeletionImpact(facility.tenantId, facilityId);

    if (impact === null) {
      return NextResponse.json({ error: "Anlage nicht gefunden." }, { status: 404 });
    }

    return NextResponse.json({ impact, requiresConfirmation: true });
  }

  const result = await deleteFacilityPermanently(facility.tenantId, facilityId);

  if (!result) {
    return NextResponse.json({ error: "Anlage nicht gefunden." }, { status: 404 });
  }

  await logAction({
    actorUserId: session.user.effectiveUserId ?? session.user.id ?? null,
    moduleKey: "facilities",
    entityType: "Facility",
    entityId: facilityId,
    action: "DELETE",
    beforeJson: { name: result.name, impact: result.impact },
  });

  revalidatePath("/dashboard/admin/facilities");

  return NextResponse.json({
    message: "Anlage wurde endgültig gelöscht.",
    impact: result.impact,
  });
}
