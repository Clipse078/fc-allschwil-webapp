/**
 * PATCH /api/targets/[id]/stage
 *
 * Stage transition using centralized requireTargetAccess() guard.
 * Phase 1: Target has no VisibilityScope — guard always succeeds for auth'd actors.
 * Phase 2: guard will enforce VisibilityScope + requiresFourEyeReview.
 *
 * Phase 2 TODOs:
 * - Enforce requiresFourEyeReview in requireTargetAccess({ access: "stage" }).
 * - Gate on RoleWorkflowRule for WorkflowDomain.TARGETS.
 * - Emit audit log entry.
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
import { buildActorContext } from "@/lib/visibility/actor-context";
import { requireTargetAccess } from "@/lib/visibility/visibility-guards";

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

    return NextResponse.json({ target: updated });
  } catch (error) {
    console.error("Stage transition failed:", error);
    return NextResponse.json(
      { error: "Statuswechsel konnte nicht gespeichert werden." },
      { status: 500 },
    );
  }
}
