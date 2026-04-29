import { prisma } from "@/lib/db/prisma";
import { findBestPersonIdForRole } from "@/lib/registrations/auto-assignment";

export async function createWorkflowForRegistration(registrationId: string) {
  await prisma.$transaction(async (tx) => {
    const registration = await tx.registration.findUnique({
      where: { id: registrationId },
    });

    if (!registration) return;

    const existingSteps = await tx.registrationWorkflowStep.count({
      where: { registrationId },
    });

    if (existingSteps > 0) return;

    const template = await tx.registrationWorkflowTemplate.findFirst({
      where: {
        targetGroup: registration.targetGroup,
        OR: [{ registrationType: registration.type }, { registrationType: null }],
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
      const isFirstStep = i === 0;
      const autoAssignedPersonId =
        step.assignedPersonId ?? (isFirstStep ? await findBestPersonIdForRole(tx, step.assignedRoleId) : null);

      await tx.registrationWorkflowStep.create({
        data: {
          registrationId,
          title: step.title,
          description: step.description,
          sortOrder: step.sortOrder,
          status: isFirstStep ? "IN_PROGRESS" : "OPEN",
          assignedRoleId: step.assignedRoleId,
          assignedPersonId: autoAssignedPersonId,
          dueDate: step.defaultDueDays
            ? new Date(Date.now() + step.defaultDueDays * 24 * 60 * 60 * 1000)
            : null,
        },
      });

      if (isFirstStep) {
        await tx.registration.update({
          where: { id: registrationId },
          data: {
            status: "IN_REVIEW",
            assignedTo: autoAssignedPersonId ?? step.assignedRoleId ?? null,
          },
        });
      }
    }
  });
}
