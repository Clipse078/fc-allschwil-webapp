/**
 * PATCH /api/targets/[id]/stage
 *
 * Lightweight review-stage transition endpoint.
 * Validates the transition against the allowed state machine and records a
 * reviewer stamp when moving to APPROVED or REJECTED.
 *
 * Governance Phase 2 TODOs:
 * - Enforce requiresFourEyeReview: block self-approval (actor ≠ creator).
 * - Check RoleWorkflowRule to gate who may approve/reject.
 * - Fire nudge/reminder hooks on SUBMITTED.
 * - Emit audit log entry (consistent with Event workflow audit pattern).
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

  const target = await prisma.target.findUnique({
    where: { id },
    select: { id: true, title: true, reviewStage: true, requiresFourEyeReview: true },
  });

  if (!target) {
    return NextResponse.json({ error: "Ziel nicht gefunden." }, { status: 404 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const rawStage = body?.stage;

    const validStages = Object.values(ReviewWorkflowStage);
    if (!rawStage || !validStages.includes(rawStage as ReviewWorkflowStage)) {
      return NextResponse.json(
        { error: "Ungültiger Prüfstatus." },
        { status: 400 },
      );
    }

    const toStage = rawStage as ReviewWorkflowStage;
    const fromStage = target.reviewStage;

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
    const actorUserId = check.session.user.id;

    const updated = await prisma.target.update({
      where: { id },
      data: {
        reviewStage: toStage,
        reviewedByUserId: needsStamp ? actorUserId : undefined,
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
