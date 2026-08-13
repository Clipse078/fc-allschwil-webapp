/**
 * POST /api/training-series/[seriesId]/submit
 *
 * ORG-ACCESS-03: Moves a TrainingSeries from DRAFT (Entwurf) to SUBMITTED
 * (Eingereicht) — signals the scoped creator is requesting coordinator validation.
 *
 * Authorization: user must have write scope for this series' team (either
 * tenant-wide TRAININGS_MANAGE or OrgUnit-scoped TRAININGS_MANAGE for the
 * team's canonical OrgUnit). The series must currently be in DRAFT stage.
 *
 * Once SUBMITTED the scoped creator can see but not edit the series.
 * Coordinators can still manage and validate it.
 */

import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { createPlanningAuthorizationPolicy } from "@/lib/planning/planning-authorization-policy";
import { logAction } from "@/lib/audit/log-action";

type RouteContext = { params: Promise<{ seriesId: string }> };

export async function POST(_req: NextRequest, { params }: RouteContext): Promise<NextResponse> {
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

  // Load the series to verify existence, tenant, and current stage.
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
  const canSubmit = await policy.canSubmitPlanningRecord(
    { userId, tenantId },
    "training",
    {
      teamId: series.teamSeason?.teamId ?? null,
      planningStage: series.planningStage,
    },
  );

  if (!canSubmit) {
    return NextResponse.json(
      {
        error:
          series.planningStage !== "DRAFT"
            ? "Die Trainingsserie befindet sich nicht im Entwurfsstatus."
            : "Keine Berechtigung zum Einreichen dieser Trainingsserie.",
      },
      { status: 403 },
    );
  }

  const now = new Date();
  await prisma.trainingSeries.update({
    where: { id: seriesId },
    data: {
      planningStage: "SUBMITTED",
      planningSubmittedAt: now,
      planningSubmittedById: userId,
    },
  });

  await logAction({
    actorUserId: userId,
    moduleKey: "training",
    entityType: "TrainingSeries",
    entityId: seriesId,
    action: "SUBMIT_FOR_REVIEW",
    afterJson: {
      planningStage: "SUBMITTED",
      submittedAt: now.toISOString(),
      submittedByUserId: userId,
    },
  });

  return NextResponse.json({
    planningStage: "SUBMITTED",
    message: "Trainingsserie zur Prüfung eingereicht.",
  });
}
