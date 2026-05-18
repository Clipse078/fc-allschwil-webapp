/**
 * PATCH /api/meetings/[id]/stage
 *
 * Mirror of /api/targets/[id]/stage — uses the same lib/governance/review-stage.ts
 * helpers for transition validation and reviewer stamping.
 *
 * Phase 2 TODOs (same as Target stage endpoint):
 * - Enforce requiresFourEyeReview: block self-approval.
 * - Gate on RoleWorkflowRule for WorkflowDomain.MEETINGS.
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
import { canSeeMeeting } from "@/lib/meetings/queries";

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

  const meeting = await prisma.meeting.findUnique({
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

  // Visibility check must happen before governance — 404-mask restricted records
  if (!meeting || !canSeeMeeting(meeting, actor)) {
    return NextResponse.json({ error: "Meeting nicht gefunden." }, { status: 404 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const rawStage = body?.stage;

    const validStages = Object.values(ReviewWorkflowStage);
    if (!rawStage || !validStages.includes(rawStage as ReviewWorkflowStage)) {
      return NextResponse.json({ error: "Ungültiger Prüfstatus." }, { status: 400 });
    }

    const toStage = rawStage as ReviewWorkflowStage;
    const fromStage = meeting.reviewStage;

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
