/**
 * POST /api/training-series/[seriesId]/validate
 *
 * ORG-ACCESS-03: Moves a TrainingSeries from SUBMITTED (Eingereicht) to
 * APPROVED (Validiert) — coordinator/Club Admin validation.
 *
 * Authorization: only tenant-wide TRAININGS_MANAGE holders may validate.
 * OrgUnit-scoped users (even with scope for the team) cannot validate their
 * own or others' submissions.
 *
 * Once APPROVED the record is locked: scoped creator can see but not edit.
 * Coordinator retains management authority (can edit/reopen).
 *
 * Reopen (APPROVED/SUBMITTED → DRAFT): pass { action: "reopen" } in body.
 * Only coordinators may reopen.
 */

import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { createPlanningAuthorizationPolicy } from "@/lib/planning/planning-authorization-policy";
import { logAction } from "@/lib/audit/log-action";

type RouteContext = { params: Promise<{ seriesId: string }> };

export async function POST(req: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tenantId = session.user.activeTenantId;
  if (!tenantId) return NextResponse.json({ error: "Tenant context required" }, { status: 403 });

  const userId = session.user.effectiveUserId ?? session.user.id;
  if (!userId) return NextResponse.json({ error: "User identity required" }, { status: 403 });

  const { seriesId } = await params;
  if (!seriesId?.trim()) {
    return NextResponse.json({ error: "seriesId is required" }, { status: 400 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    // body is optional
  }
  const isReopen = body.action === "reopen";

  const series = await prisma.trainingSeries.findFirst({
    where: { id: seriesId, tenantId },
    select: {
      id: true,
      planningStage: true,
      teamSeason: { select: { teamId: true } },
    },
  });

  if (!series) {
    return NextResponse.json({ error: "Trainingsserie nicht gefunden." }, { status: 404 });
  }

  const policy = createPlanningAuthorizationPolicy(prisma);

  if (isReopen) {
    // Reopen: coordinator only, any stage → DRAFT
    const canValidate = await policy.canValidatePlanningRecord(
      { userId, tenantId },
      "training",
      { teamId: series.teamSeason?.teamId ?? null, planningStage: "SUBMITTED" }, // force check for coordinator
    );
    // canValidatePlanningRecord requires SUBMITTED stage; we bypass that check for reopen
    // by checking coordinator status directly. Use canEditPlanningRecord on an APPROVED record.
    const isTenantWideCoordinator = await policy.canEditPlanningRecord(
      { userId, tenantId },
      "training",
      { teamId: null, planningStage: "APPROVED" }, // APPROVED stage unlocks only for coordinator
    );

    if (!isTenantWideCoordinator) {
      return NextResponse.json({ error: "Keine Berechtigung zum Wiedereröffnen." }, { status: 403 });
    }

    void canValidate; // not used directly
    await prisma.trainingSeries.update({
      where: { id: seriesId },
      data: {
        planningStage: "DRAFT",
        planningSubmittedAt: null,
        planningSubmittedById: null,
        planningValidatedAt: null,
        planningValidatedById: null,
      },
    });

    await logAction({
      actorUserId: userId,
      moduleKey: "training",
      entityType: "TrainingSeries",
      entityId: seriesId,
      action: "REOPEN",
      afterJson: { planningStage: "DRAFT", reopenedByUserId: userId },
    });

    return NextResponse.json({ planningStage: "DRAFT", message: "Trainingsserie wiedereröffnet." });
  }

  // Normal validate: SUBMITTED → APPROVED
  const canValidate = await policy.canValidatePlanningRecord(
    { userId, tenantId },
    "training",
    {
      teamId: series.teamSeason?.teamId ?? null,
      planningStage: series.planningStage,
    },
  );

  if (!canValidate) {
    return NextResponse.json(
      {
        error:
          series.planningStage !== "SUBMITTED"
            ? "Die Trainingsserie wurde nicht eingereicht."
            : "Keine Berechtigung zur Validierung.",
      },
      { status: 403 },
    );
  }

  const now = new Date();
  await prisma.trainingSeries.update({
    where: { id: seriesId },
    data: {
      planningStage: "APPROVED",
      planningValidatedAt: now,
      planningValidatedById: userId,
    },
  });

  await logAction({
    actorUserId: userId,
    moduleKey: "training",
    entityType: "TrainingSeries",
    entityId: seriesId,
    action: "APPROVE",
    afterJson: {
      planningStage: "APPROVED",
      validatedAt: now.toISOString(),
      validatedByUserId: userId,
    },
  });

  return NextResponse.json({
    planningStage: "APPROVED",
    message: "Trainingsserie validiert.",
  });
}
