import { prisma } from "@/lib/db/prisma";
import type { ScopedTaskPreviewItem, ScopedTaskSourceAdapter } from "@/lib/tasks/scoped-task-types";

const ACTIVE_STATUSES = ["OPEN", "IN_PROGRESS", "BLOCKED"] as const;

export const registrationTaskSource: ScopedTaskSourceAdapter = {
  source: "REGISTRATION",

  async countForPerson(personId: string) {
    return prisma.registrationWorkflowStep.count({
      where: {
        assignedPersonId: personId,
        status: { in: [...ACTIVE_STATUSES] },
      },
    });
  },

  async previewForPerson(personId: string, limit: number): Promise<ScopedTaskPreviewItem[]> {
    const steps = await prisma.registrationWorkflowStep.findMany({
      where: {
        assignedPersonId: personId,
        status: { in: [...ACTIVE_STATUSES] },
      },
      include: {
        registration: true,
      },
      orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
      take: limit,
    });

    const now = new Date();

    return steps.map((step) => {
      const personLabel =
        step.registration.displayName ||
        `${step.registration.firstName ?? ""} ${step.registration.lastName ?? ""}`.trim() ||
        "Neue Anmeldung";

      return {
        id: step.id,
        source: "REGISTRATION",
        sourceLabel: "Neue Anmeldung",
        title: step.title,
        href: `/dashboard/neu-anmeldungen/${step.registration.id}`,
        personLabel,
        dueDate: step.dueDate ? step.dueDate.toISOString() : null,
        isOverdue: step.dueDate ? step.dueDate < now : false,
        scopeType: "VEREIN",
        scopeLabel: "FC Allschwil",
      };
    });
  },

  async completeTask(taskId: string, personId: string) {
    const step = await prisma.registrationWorkflowStep.findUnique({
      where: { id: taskId },
    });

    if (!step || step.assignedPersonId !== personId) {
      return { ok: false, status: 403, error: "Forbidden" };
    }

    await prisma.registrationWorkflowStep.update({
      where: { id: taskId },
      data: {
        status: "DONE",
        completedAt: new Date(),
      },
    });

    return { ok: true };
  },
};
