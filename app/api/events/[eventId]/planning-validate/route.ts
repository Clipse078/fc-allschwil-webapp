/**
 * POST /api/events/[eventId]/planning-validate
 *
 * ORG-ACCESS-03: Moves a MATCH or TOURNAMENT Event from SUBMITTED (Eingereicht)
 * to APPROVED (Validiert) — coordinator/Club Admin validation.
 *
 * Authorization: only tenant-wide EVENTS_MANAGE holders may validate.
 * Scoped users cannot validate their own submissions.
 *
 * Reopen: pass { action: "reopen" } to move APPROVED/SUBMITTED → DRAFT.
 * Only coordinators may reopen.
 */

import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { createPlanningAuthorizationPolicy } from "@/lib/planning/planning-authorization-policy";
import type { PlanningDomain } from "@/lib/planning/planning-authorization-policy";
import { logAction } from "@/lib/audit/log-action";

type RouteContext = { params: Promise<{ eventId: string }> };

const ALLOWED_EVENT_TYPES = new Set(["MATCH", "TOURNAMENT"]);

export async function POST(req: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tenantId = session.user.activeTenantId;
  if (!tenantId) return NextResponse.json({ error: "Tenant context required" }, { status: 403 });

  const userId = session.user.effectiveUserId ?? session.user.id;
  if (!userId) return NextResponse.json({ error: "User identity required" }, { status: 403 });

  const { eventId } = await params;
  if (!eventId?.trim()) {
    return NextResponse.json({ error: "eventId is required" }, { status: 400 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    // body is optional
  }
  const isReopen = body.action === "reopen";

  const event = await prisma.event.findFirst({
    where: { id: eventId, tenantId },
    select: {
      id: true,
      type: true,
      source: true,
      reviewStage: true,
      teamId: true,
    },
  });

  if (!event) {
    return NextResponse.json({ error: "Event nicht gefunden." }, { status: 404 });
  }

  if (!ALLOWED_EVENT_TYPES.has(event.type)) {
    return NextResponse.json(
      { error: "Nur Spiele und Turniere können validiert werden." },
      { status: 400 },
    );
  }

  const domain: PlanningDomain = event.type === "MATCH" ? "match" : "tournament";
  const policy = createPlanningAuthorizationPolicy(prisma);

  if (isReopen) {
    // Reopen requires coordinator authority (can edit APPROVED records)
    const canReopen = await policy.canEditPlanningRecord(
      { userId, tenantId },
      domain,
      { teamId: null, planningStage: "APPROVED" }, // APPROVED stage, no team → coordinator only
    );
    if (!canReopen) {
      return NextResponse.json(
        { error: "Keine Berechtigung zum Wiedereröffnen." },
        { status: 403 },
      );
    }

    await prisma.event.update({
      where: { id: eventId },
      data: {
        reviewStage: "DRAFT",
        reviewRequestedAt: null,
        reviewedAt: null,
        approvedByUserId: null,
        reviewedByUserId: null,
      },
    });

    await logAction({
      actorUserId: userId,
      moduleKey: "events",
      entityType: "Event",
      entityId: eventId,
      action: "REOPEN",
      afterJson: { reviewStage: "DRAFT", reopenedByUserId: userId },
    });

    return NextResponse.json({ reviewStage: "DRAFT", message: "Event wiedereröffnet." });
  }

  // Normal validate: SUBMITTED → APPROVED
  const canValidate = await policy.canValidatePlanningRecord(
    { userId, tenantId },
    domain,
    {
      teamId: event.teamId,
      planningStage: event.reviewStage,
      source: event.source,
    },
  );

  if (!canValidate) {
    return NextResponse.json(
      {
        error:
          event.reviewStage !== "SUBMITTED"
            ? "Das Event wurde nicht eingereicht."
            : "Keine Berechtigung zur Validierung.",
      },
      { status: 403 },
    );
  }

  const now = new Date();
  await prisma.event.update({
    where: { id: eventId },
    data: {
      reviewStage: "APPROVED",
      reviewedAt: now,
      approvedByUserId: userId,
      reviewedByUserId: userId,
    },
  });

  await logAction({
    actorUserId: userId,
    moduleKey: "events",
    entityType: "Event",
    entityId: eventId,
    action: "APPROVE",
    afterJson: {
      reviewStage: "APPROVED",
      validatedAt: now.toISOString(),
      validatedByUserId: userId,
    },
  });

  return NextResponse.json({
    reviewStage: "APPROVED",
    message: "Event validiert.",
  });
}
