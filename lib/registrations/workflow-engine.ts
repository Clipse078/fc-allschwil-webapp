import { prisma } from "@/lib/db/prisma";

export async function createWorkflowForRegistration(registrationId: string) {
  const registration = await prisma.registration.findUnique({
    where: { id: registrationId },
  });

  if (!registration) return;

  const template = await prisma.registrationWorkflowTemplate.findFirst({
    where: {
      targetGroup: registration.targetGroup,
      OR: [
        { registrationType: registration.type },
        { registrationType: null },
      ],
      isActive: true,
    },
    orderBy: { sortOrder: "asc" },
    include: {
      registrationWorkflowTemplateSteps: {
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  if (!template || template.registrationWorkflowTemplateSteps.length === 0) return;

  for (let i = 0; i < template.registrationWorkflowTemplateSteps.length; i++) {
    const step = template.registrationWorkflowTemplateSteps[i];

    await prisma.registrationWorkflowStep.create({
      data: {
        registrationId,
        title: step.title,
        description: step.description,
        sortOrder: step.sortOrder,
        status: i === 0 ? "IN_PROGRESS" : "OPEN",
        assignedRoleId: step.assignedRoleId,
        assignedPersonId: step.assignedPersonId,
        dueDate: step.defaultDueDays
          ? new Date(Date.now() + step.defaultDueDays * 24 * 60 * 60 * 1000)
          : null,
      },
    });
  }
}

export async function advanceWorkflowStep(registrationId: string, stepId: string) {
  const steps = await prisma.registrationWorkflowStep.findMany({
    where: { registrationId },
    orderBy: { sortOrder: "asc" },
  });

  const index = steps.findIndex((s) => s.id === stepId);
  if (index === -1) return;

  const next = steps[index + 1];

  if (next) {
    await prisma.registrationWorkflowStep.update({
      where: { id: next.id },
      data: { status: "IN_PROGRESS" },
    });
  }
}


