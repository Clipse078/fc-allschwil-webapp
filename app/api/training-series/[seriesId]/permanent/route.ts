/**
 * DELETE /api/training-series/[seriesId]/permanent — permanent hard delete.
 *
 * ADMIN-DELETE-02A / ADMIN-DELETE-02A-C1. Requires PERMISSIONS.TRAININGS_DELETE
 * — deliberately NOT TRAININGS_MANAGE, which authorizes create/edit/archive
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
 *      whether the caller may delete within that exact tenant.
 *
 * CORE PRODUCT RULE (ADMIN-DELETE-02A-C1): a trainings.delete holder is
 * NEVER blocked from permanently deleting a series merely because generated
 * sessions, facility allocations, or plan assignments exist. Instead, this
 * route implements a two-step "inspect impact → explicit confirmation →
 * atomic cleanup + delete" flow on the SAME endpoint, driven by the
 * `confirm` query parameter:
 *
 *   DELETE .../permanent            → PREVIEW: returns 200 with the impact
 *                                      (dependency counts) and
 *                                      requiresConfirmation: true. Deletes
 *                                      nothing.
 *   DELETE .../permanent?confirm=true → PERFORM: atomically cleans up owned/
 *                                        reference data and permanently
 *                                        deletes the series. See
 *                                        lib/training/training-lifecycle-service.ts.
 *
 * Both steps require the same authorization check — the impact preview
 * never leaks dependency information to an unauthorized caller.
 */

import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { createEffectivePermissionResolver } from "@/lib/permissions/services/effective-permission-resolver";
import { logAction } from "@/lib/audit/log-action";
import {
  deleteTrainingSeriesPermanently,
  getTrainingSeriesDeletionImpact,
} from "@/lib/training/training-lifecycle-service";
import { TrainingSeriesNotFoundError } from "@/lib/training/errors";

type Params = { params: Promise<{ seriesId: string }> };

export async function DELETE(request: NextRequest, { params }: Params) {
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

  const confirmed = request.nextUrl.searchParams.get("confirm") === "true";

  if (!confirmed) {
    const impact = await getTrainingSeriesDeletionImpact(seriesTenantId, seriesId);

    if (impact === null) {
      return NextResponse.json({ error: "Trainingsserie nicht gefunden." }, { status: 404 });
    }

    return NextResponse.json({ impact, requiresConfirmation: true });
  }

  try {
    const { deleted, impact } = await deleteTrainingSeriesPermanently(seriesTenantId, seriesId);

    await logAction({
      actorUserId: session.user.effectiveUserId ?? session.user.id ?? null,
      moduleKey: "trainings",
      entityType: "TrainingSeries",
      entityId: seriesId,
      action: "DELETE",
      beforeJson: { ...deleted, impact },
    });

    revalidatePath("/dashboard/training");

    return NextResponse.json({ message: "Trainingsserie wurde endgültig gelöscht.", impact });
  } catch (error) {
    if (error instanceof TrainingSeriesNotFoundError) {
      return NextResponse.json({ error: "Trainingsserie nicht gefunden." }, { status: 404 });
    }

    console.error("Delete training series failed:", error);
    return NextResponse.json(
      { error: "Trainingsserie konnte nicht gelöscht werden." },
      { status: 500 },
    );
  }
}
