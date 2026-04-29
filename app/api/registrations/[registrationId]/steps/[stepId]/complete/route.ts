import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireApiAnyPermission } from "@/lib/permissions/require-api-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";

type Context = {
  params: Promise<{ registrationId: string; stepId: string }>;
};

export async function POST(request: NextRequest, context: Context) {
  await requireApiAnyPermission([PERMISSIONS.PEOPLE_MANAGE]);

  const { registrationId, stepId } = await context.params;

  const step = await prisma.registrationWorkflowStep.findUnique({
    where: { id: stepId },
  });

  if (!step || step.registrationId !== registrationId) {
    return NextResponse.json({ error: "Workflow Schritt nicht gefunden." }, { status: 404 });
  }

  if (step.status === "DONE") {
    return NextResponse.json({ error: "Schritt bereits abgeschlossen." }, { status: 409 });
  }

  const now = new Date();

  const updatedStep = await prisma.registrationWorkflowStep.update({
    where: { id: stepId },
    data: {
      status: "DONE",
      completedAt: now,
    },
  });

  // find next step
  const nextStep = await prisma.registrationWorkflowStep.findFirst({
    where: {
      registrationId,
      sortOrder: { gt: step.sortOrder },
    },
    orderBy: { sortOrder: "asc" },
  });

  if (nextStep && nextStep.status === "OPEN") {
    await prisma.registrationWorkflowStep.update({
      where: { id: nextStep.id },
      data: {
        status: "IN_PROGRESS",
      },
    });
  }

  return NextResponse.json({
    step: updatedStep,
    nextStepId: nextStep?.id ?? null,
  });
}
