/**
 * POST /api/events/[eventId]/planning-submit
 *
 * ORG-ACCESS-03: Moves a MATCH or TOURNAMENT Event from DRAFT (Entwurf) to
 * SUBMITTED (Eingereicht) for coordinator validation.
 *
 * Authorization: user must have write scope for the event's team.
 * The event must be in DRAFT planningStage (reviewStage) and source must be
 * MANUAL (SFV/provider records cannot be submitted through this path).
 *
 * Note: this route uses `reviewStage` (the existing field on Event) as the
 * planning workflow stage. See ORG-ACCESS-03 architecture note in
 * planning-authorization-policy.ts.
 */

import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { createPlanningAuthorizationPolicy } from "@/lib/planning/planning-authorization-policy";
import type { PlanningDomain } from "@/lib/planning/planning-authorization-policy";
import { logAction } from "@/lib/audit/log-action";

type RouteContext = { params: Promise<{ eventId: string }> };

const ALLOWED_EVENT_TYPES = new Set(["MATCH", "TOURNAMENT"]);

export async function POST(_req: NextRequest, { params }: RouteContext): Promise<NextResponse> {
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
      { error: "Nur Spiele und Turniere können eingereicht werden." },
      { status: 400 },
    );
  }

  const domain: PlanningDomain = event.type === "MATCH" ? "match" : "tournament";
  const policy = createPlanningAuthorizationPolicy(prisma);
  const canSubmit = await policy.canSubmitPlanningRecord(
    { userId, tenantId },
    domain,
    {
      teamId: event.teamId,
      planningStage: event.reviewStage,
      source: event.source,
    },
  );

  if (!canSubmit) {
    return NextResponse.json(
      {
        error:
          event.reviewStage !== "DRAFT"
            ? "Das Event befindet sich nicht im Entwurfsstatus."
            : "Keine Berechtigung zum Einreichen.",
      },
      { status: 403 },
    );
  }

  const now = new Date();
  await prisma.event.update({
    where: { id: eventId },
    data: {
      reviewStage: "SUBMITTED",
      reviewRequestedAt: now,
    },
  });

  await logAction({
    actorUserId: userId,
    moduleKey: "events",
    entityType: "Event",
    entityId: eventId,
    action: "SUBMIT_FOR_REVIEW",
    afterJson: {
      reviewStage: "SUBMITTED",
      submittedAt: now.toISOString(),
      submittedByUserId: userId,
    },
  });

  return NextResponse.json({
    reviewStage: "SUBMITTED",
    message: "Zur Prüfung eingereicht.",
  });
}
