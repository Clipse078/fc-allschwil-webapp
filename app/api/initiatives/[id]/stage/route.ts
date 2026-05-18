/**
 * PATCH /api/initiatives/[id]/stage
 *
 * Mirrors /api/targets/[id]/stage and /api/meetings/[id]/stage exactly.
 * Uses lib/governance/review-stage.ts for transition validation and reviewer stamping.
 *
 * Phase 2 TODOs:
 * - Enforce requiresFourEyeReview: block self-approval.
 * - Gate on RoleWorkflowRule for WorkflowDomain.INITIATIVES.
 * - Emit audit log entry.
 * - Fire nudge on SUBMITTED to linked Target owners.
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
import { canSeeEntity } from "@/lib/visibility/visibility-filter";

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

  const initiative = await prisma.initiative.findUnique({
    where: { id },
    select: {
      id: true,
      reviewStage: true,
      visibilityScope: true,
      createdByUserId: true,
      visibleRoleRefs: true,
      visibleUserRefs: true,
      visibleTeamRefs: true,
      visibleOrgUnitRefs: true,
      visiblePersonRefs: true,
    },
  });

  // Visibility check before governance — 404-mask restricted records
  if (!initiative || !canSeeEntity(initiative, actor)) {
    return NextResponse.json({ error: "Initiative nicht gefunden." }, { status: 404 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const rawStage = body?.stage;

    const validStages = Object.values(ReviewWorkflowStage);
    if (!rawStage || !validStages.includes(rawStage as ReviewWorkflowStage)) {
      return NextResponse.json({ error: "Ungültiger Prüfstatus." }, { status: 400 });
    }

    const toStage = rawStage as ReviewWorkflowStage;
    const fromStage = initiative.reviewStage;

    if (!canTransitionTo(fromStage, toStage)) {
      const fromInfo = getReviewStageInfo(fromStage);
      const toInfo = getReviewStageInfo(toStage);
      return NextResponse.json(
        { error: `Übergang von "${fromInfo.label}" zu "${toInfo.label}" ist nicht erlaubt.` },
        { status: 422 },
      );
    }

    const needsStamp = requiresReviewerStamp(toStage);
    const actorUserId = check.session.user.id;

    const updated = await prisma.initiative.update({
      where: { id },
      data: {
        reviewStage: toStage,
        reviewedByUserId: needsStamp ? actorUserId : undefined,
        reviewedAt: needsStamp ? new Date() : undefined,
      },
      select: {
        id: true,
        slug: true,
        reviewStage: true,
        reviewedByUserId: true,
        reviewedAt: true,
      },
    });

    return NextResponse.json({ initiative: updated });
  } catch (error) {
    console.error("Initiative stage transition failed:", error);
    return NextResponse.json(
      { error: "Statuswechsel konnte nicht gespeichert werden." },
      { status: 500 },
    );
  }
}
