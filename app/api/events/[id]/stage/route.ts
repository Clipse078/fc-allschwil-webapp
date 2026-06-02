/**
 * PATCH /api/events/[id]/stage
 *
 * Transitions an event through its review workflow.
 * Publishing to a public channel (→ PUBLISHED) requires an explicit
 * publish permission; all other transitions require events.manage.
 *
 * Enforcement order (mandatory):
 *   1. Session auth                            → 401
 *   2. Event existence check                   → 404
 *   3. Stage-machine validation (canTransitionTo) → 422
 *   4. Permission check per target stage       → 403
 *   5. DB update (with publishedAt stamp on → PUBLISHED)
 *   6. Audit log (best-effort, fire-and-forget)
 *
 * Sprint-0 scope: permission-based access only.
 * Phase 2: four-eye enforcement, RoleWorkflowRule gating.
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
import { logAction } from "@/lib/audit/log-action";

const PUBLISH_PERMISSIONS = new Set([
  "events.publish_website",
  "events.publish_infoboard",
]);

const EVENT_STAGE_SELECT = {
  id: true,
  reviewStage: true,
  publishedAt: true,
  createdByUserId: true,
  websiteVisible: true,
  infoboardVisible: true,
} as const;

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const event = await prisma.event.findUnique({
    where: { id },
    select: EVENT_STAGE_SELECT,
  });

  if (!event) {
    return NextResponse.json({ error: "Event nicht gefunden." }, { status: 404 });
  }

  const fromStage = event.reviewStage as ReviewWorkflowStage;

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    // body stays empty — validation below will catch missing stage
  }

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

  // Permission check: PUBLISHED requires a publish permission; all other transitions require manage.
  const permissionKeys: string[] = session.user.permissionKeys ?? [];
  const isPublishTransition = toStage === ReviewWorkflowStage.PUBLISHED;

  if (isPublishTransition) {
    const hasPublishPermission = permissionKeys.some((k) => PUBLISH_PERMISSIONS.has(k));
    if (!hasPublishPermission) {
      return NextResponse.json(
        { error: "events.publish_website oder events.publish_infoboard Berechtigung erforderlich." },
        { status: 403 },
      );
    }
  } else {
    const hasManagePermission = permissionKeys.includes("events.manage");
    if (!hasManagePermission) {
      return NextResponse.json(
        { error: "events.manage Berechtigung erforderlich." },
        { status: 403 },
      );
    }
  }

  const actorUserId =
    session.user.effectiveUserId ?? session.user.id ?? null;

  const needsReviewerStamp = requiresReviewerStamp(toStage);
  const now = new Date();

  const updated = await prisma.event.update({
    where: { id },
    data: {
      reviewStage: toStage,
      ...(needsReviewerStamp && {
        reviewedByUserId: actorUserId,
        reviewedAt: now,
      }),
      ...(isPublishTransition && {
        publishedAt: now,
        publishedByUserId: actorUserId,
      }),
    },
    select: {
      id: true,
      reviewStage: true,
      publishedAt: true,
      publishedByUserId: true,
      reviewedByUserId: true,
      reviewedAt: true,
    },
  });

  void logAction({
    actorUserId,
    moduleKey: "events",
    entityType: "Event",
    entityId: id,
    action: "STAGE_CHANGE",
    beforeJson: { reviewStage: fromStage },
    afterJson: { reviewStage: toStage },
    metadataJson: {
      publishedAt: isPublishTransition ? now.toISOString() : null,
      publishedByUserId: isPublishTransition ? actorUserId : null,
    },
  });

  return NextResponse.json({ event: updated });
}
