/**
 * PATCH /api/meetings/[id]/stage
 *
 * Stage transition using centralized requireMeetingAccess() guard.
 * Visibility check runs inside the guard before governance — consistent with
 * the platform rule: visibility before governance.
 *
 * Phase 2 TODOs:
 * - Enforce requiresFourEyeReview inside requireMeetingAccess({ access: "stage" }).
 * - Gate on RoleWorkflowRule for WorkflowDomain.MEETINGS.
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
import { requireMeetingAccess } from "@/lib/visibility/visibility-guards";

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

  // Visibility check runs before governance — 404-masks invisible records
  const guard = await requireMeetingAccess({ actor, id, access: "stage" });
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
        { error: `Übergang von "${fromInfo.label}" zu "${toInfo.label}" ist nicht erlaubt.` },
        { status: 422 },
      );
    }

    const needsStamp = requiresReviewerStamp(toStage);
    const actorUserId = actor.userId;

    const updated = await prisma.meeting.update({
      where: { id },
      data: {
        reviewStage: toStage,
        reviewedByUserId: needsStamp ? actorUserId : undefined,
        reviewedAt: needsStamp ? new Date() : undefined,
      },
      select: { id: true, slug: true, reviewStage: true, reviewedByUserId: true, reviewedAt: true },
    });

    return NextResponse.json({ meeting: updated });
  } catch (error) {
    console.error("Meeting stage transition failed:", error);
    return NextResponse.json(
      { error: "Statuswechsel konnte nicht gespeichert werden." },
      { status: 500 },
    );
  }
}
