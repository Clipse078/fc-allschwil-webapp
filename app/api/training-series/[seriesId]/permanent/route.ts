/**
 * DELETE /api/training-series/[seriesId]/permanent — permanent hard delete.
 *
 * ADMIN-DELETE-02A. Requires PERMISSIONS.TRAININGS_DELETE — deliberately NOT
 * TRAININGS_MANAGE, which authorizes create/edit/archive
 * (DELETE /api/training-series/[seriesId], unchanged by this file) but must
 * never imply permanent deletion on its own. A dedicated `/permanent`
 * sub-route is used rather than repurposing the existing DELETE
 * /api/training-series/[seriesId] endpoint, which already has an
 * established, tested archive contract (TRAININGCENTER-03A) — this keeps
 * that contract completely unchanged.
 *
 * Authorization model (mirrors app/api/teams/[teamId]/route.ts DELETE,
 * ADMIN-DELETE-01B):
 *   1. The target TrainingSeries (and therefore its owning tenant) is
 *      resolved strictly server-side from `seriesId` — a client-supplied
 *      tenantId is never read or trusted for this decision.
 *   2. EffectivePermissionResolver.hasTenantDeletionAuthority() decides
 *      whether the caller may delete within that exact tenant (tenant-scoped
 *      trainings.delete grant, or the SCE Super Admin's platform-held
 *      trainings.delete grant resolved against this tenant once confirmed
 *      real and operationally ACTIVE).
 *
 * Refuses to delete when meaningful dependencies/history exist (generated
 * sessions, facility allocations, training-plan assignments) — recommends
 * archiving instead. See lib/training/training-lifecycle-service.ts.
 */

import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { createEffectivePermissionResolver } from "@/lib/permissions/services/effective-permission-resolver";
import { logAction } from "@/lib/audit/log-action";
import {
  TrainingSeriesDeletionBlockedError,
  deleteTrainingSeriesSafely,
} from "@/lib/training/training-lifecycle-service";
import { TrainingSeriesNotFoundError } from "@/lib/training/errors";

type Params = { params: Promise<{ seriesId: string }> };

export async function DELETE(_request: NextRequest, { params }: Params) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { seriesId } = await params;

  // Resolve the target TrainingSeries and its tenant strictly server-side —
  // never trust a client-supplied tenantId for a permanent-deletion decision.
  const series = await prisma.trainingSeries.findUnique({
    where: { id: seriesId },
    select: { id: true, tenantId: true },
  });

  if (!series) {
    return NextResponse.json({ error: "Trainingsserie nicht gefunden." }, { status: 404 });
  }

  const seriesTenantId = series.tenantId;

  const resolver = createEffectivePermissionResolver(prisma);
  const authorized = await resolver.hasTenantDeletionAuthority({
    userId: session.user.id,
    permission: PERMISSIONS.TRAININGS_DELETE,
    tenantId: seriesTenantId,
  });

  if (!authorized) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const deleted = await deleteTrainingSeriesSafely(seriesTenantId, seriesId);

    await logAction({
      actorUserId: session.user.effectiveUserId ?? session.user.id ?? null,
      moduleKey: "trainings",
      entityType: "TrainingSeries",
      entityId: seriesId,
      action: "DELETE",
      beforeJson: deleted,
    });

    revalidatePath("/dashboard/training");

    return NextResponse.json({ message: "Trainingsserie wurde endgültig gelöscht." });
  } catch (error) {
    if (error instanceof TrainingSeriesNotFoundError) {
      return NextResponse.json({ error: "Trainingsserie nicht gefunden." }, { status: 404 });
    }

    if (error instanceof TrainingSeriesDeletionBlockedError) {
      return NextResponse.json(
        {
          error: error.message,
          blockers: error.blockers,
        },
        { status: 409 },
      );
    }

    console.error("Delete training series failed:", error);
    return NextResponse.json(
      { error: "Trainingsserie konnte nicht gelöscht werden." },
      { status: 500 },
    );
  }
}
