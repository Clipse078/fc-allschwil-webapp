/**
 * PATCH /api/targets/[id]/stage
 *
 * Enforcement order (mandatory):
 *   1. Session auth
 *   2. requireTargetAccess() → visibility (404-mask) + permission (403)
 *   3. Stage-machine validation (canTransitionTo) → 422
 *   4. Four-eye check (assertFourEyeAllowed) → 403 self-approval blocked
 *   5. DB update
 *
 * Phase 2 TODOs: RoleWorkflowRule gating for WorkflowDomain.TARGETS, audit log.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { auth } from "@/auth";
import { ReviewWorkflowStage } from "@prisma/client";
import {
  canTransitionTo,
  requiresReviewerStamp,
  getReviewStageInfo,
} from "@/lib/governance/review-stage";
import { assertFourEyeAllowed } from "@/lib/governance/four-eye";
import { buildActorContext } from "@/lib/visibility/actor-context";
import { requireTargetAccess } from "@/lib/visibility/visibility-guards";
import { logAuditEvent } from "@/lib/audit/audit-log";

async function requireSession() {
  const session = await auth();
  if (!session?.user) {
    return { ok: false as const, status: 401, error: "Unauthorized" };
  }
  return { ok: true as const, session };
}

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const check = await requireSession();
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  const { id } = await params;
  const actor = buildActorContext(check.session.user);

  const guard = await requireTargetAccess({ actor, id, access: "stage" });
  if (!guard.ok) return guard.response;

  const fromStage = guard.entity.reviewStage as ReviewWorkflowStage;

  try {
    const body = await request.json().catch(() => ({}));
    const rawStage = body?.stage;

    const validStages = Object.values(ReviewWorkflowStage);
    if (!rawStage || !validStages.includes(rawStage as ReviewWorkflowStage)) {
      return NextResponse.json({ error: "Ungültiger Prüfstatus." }, { status: 400 });
    }

    const toStage = rawStage as ReviewWorkflowStage;

    if (!canTransitionTo(fromStage, toStage)) {
      const fromInfo = getReviewStageInfo(fromStage);
      const toInfo = getReviewStageInfo(toStage);
      return NextResponse.json(
        {
          error: `Übergang von "${fromInfo.label}" zu "${toInfo.label}" ist nicht erlaubt.`,
        },
        { status: 422 },
      );
    }

    const fourEye = assertFourEyeAllowed({
      actorUserId: actor.userId,
      createdByUserId: guard.entity.createdByUserId,
      requiresFourEyeReview: guard.entity.requiresFourEyeReview,
      toStage,
    });
    if (!fourEye.ok) return fourEye.response;

    const needsStamp = requiresReviewerStamp(toStage);

    const updated = await prisma.target.update({
      where: { id },
      data: {
        reviewStage: toStage,
        reviewedByUserId: needsStamp ? actor.userId : undefined,
        reviewedAt: needsStamp ? new Date() : undefined,
      },
      select: {
        id: true,
        title: true,
        reviewStage: true,
        reviewedByUserId: true,
        reviewedAt: true,
      },
    });

    void logAuditEvent({
      actorUserId: actor.userId,
      module: "targets",
      entityId: id,
      action: "STAGE_CHANGE",
      before: { reviewStage: fromStage },
      after: { reviewStage: toStage },
      metadata: { reviewedByUserId: needsStamp ? actor.userId : null },
    });

    return NextResponse.json({ target: updated });
  } catch (error) {
    console.error("Stage transition failed:", error);
    return NextResponse.json(
      { error: "Statuswechsel konnte nicht gespeichert werden." },
      { status: 500 },
    );
  }
}
