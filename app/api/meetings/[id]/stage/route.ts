/**
 * PATCH /api/meetings/[id]/stage
 *
 * Enforcement order (mandatory):
 *   1. Session auth
 *   2. requireMeetingAccess() → visibility (404-mask) + permission (403)
 *   3. Stage-machine validation (canTransitionTo) → 422
 *   4. Four-eye check (assertFourEyeAllowed) → 403 self-approval blocked
 *   5. DB update
 *
 * Phase 2 TODOs:
 * - Gate on RoleWorkflowRule for WorkflowDomain.MEETINGS.
 * - Emit audit log entry.
 * - Fire nudge on SUBMITTED to linked Target owners.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { ReviewWorkflowStage } from "@prisma/client";
import {
  canTransitionTo,
  requiresReviewerStamp,
  getReviewStageInfo,
} from "@/lib/governance/review-stage";
import { assertFourEyeAllowed } from "@/lib/governance/four-eye";
import { requireMeetingAccess } from "@/lib/visibility/visibility-guards";
import { logAuditEvent } from "@/lib/audit/audit-log";
import { requireStrategicApiContext } from "@/lib/permissions/require-strategic-api-context";
import { PERMISSIONS } from "@/lib/permissions/permissions";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const access = await requireStrategicApiContext([
    PERMISSIONS.MEETINGS_MANAGE,
  ]);
  if (!access.ok) return access.response;

  const { id } = await params;
  const { actor } = access.context;

  // Step 1+2: visibility (404-mask) + permission (403)
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

    // Step 3: state-machine validation
    if (!canTransitionTo(fromStage, toStage)) {
      const fromInfo = getReviewStageInfo(fromStage);
      const toInfo = getReviewStageInfo(toStage);
      return NextResponse.json(
        { error: `Übergang von "${fromInfo.label}" zu "${toInfo.label}" ist nicht erlaubt.` },
        { status: 422 },
      );
    }

    // Step 4: four-eye enforcement
    const fourEye = assertFourEyeAllowed({
      actorUserId: actor.userId,
      createdByUserId: guard.entity.createdByUserId,
      requiresFourEyeReview: guard.entity.requiresFourEyeReview,
      toStage,
    });
    if (!fourEye.ok) return fourEye.response;

    // Step 5: DB update
    const needsStamp = requiresReviewerStamp(toStage);

    const updated = await prisma.meeting.update({
      where: { id, tenantId: actor.tenantId },
      data: {
        reviewStage: toStage,
        reviewedByUserId: needsStamp ? actor.userId : undefined,
        reviewedAt: needsStamp ? new Date() : undefined,
      },
      select: { id: true, slug: true, reviewStage: true, reviewedByUserId: true, reviewedAt: true },
    });

    void logAuditEvent({
      actorUserId: actor.userId,
      module: "meetings",
      entityId: id,
      action: "STAGE_CHANGE",
      before: { reviewStage: fromStage },
      after: { reviewStage: toStage },
      metadata: { reviewedByUserId: needsStamp ? actor.userId : null },
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
