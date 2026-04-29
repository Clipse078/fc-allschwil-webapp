import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireApiAnyPermission } from "@/lib/permissions/require-api-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";

type Context = {
  params: Promise<{ registrationId: string; stepId: string }>;
};

export async function POST(_request: NextRequest, context: Context) {
  await requireApiAnyPermission([PERMISSIONS.PEOPLE_MANAGE]);

  const { registrationId, stepId } = await context.params;

  const result = await prisma.$transaction(async (tx) => {
    const currentStep = await tx.registrationWorkflowStep.findUnique({
      where: { id: stepId },
    });

    if (!currentStep || currentStep.registrationId !== registrationId) {
      return { error: "Workflow-Schritt nicht gefunden.", status: 404 };
    }

    if (currentStep.status === "DONE") {
      return { error: "Schritt bereits abgeschlossen.", status: 409 };
    }

    const updatedStep = await tx.registrationWorkflowStep.update({
      where: { id: stepId },
      data: {
        status: "DONE",
        completedAt: new Date(),
      },
    });

    const nextStep = await tx.registrationWorkflowStep.findFirst({
      where: {
        registrationId,
        sortOrder: { gt: currentStep.sortOrder },
      },
      orderBy: { sortOrder: "asc" },
    });

    if (nextStep) {
      await tx.registrationWorkflowStep.update({
        where: { id: nextStep.id },
        data: { status: "IN_PROGRESS" },
      });

      await tx.registration.update({
        where: { id: registrationId },
        data: { status: "IN_REVIEW" },
      });
    } else {
      await tx.registration.update({
        where: { id: registrationId },
        data: { status: "APPROVED" },
      });
    }

    return {
      step: updatedStep,
      nextStepId: nextStep?.id ?? null,
    };
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(result);
}
