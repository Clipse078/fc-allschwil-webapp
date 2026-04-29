import { prisma } from "@/lib/db/prisma";
import MyRegistrationTasksPanel from "@/components/admin/tasks/MyRegistrationTasksPanel";

export default async function TasksPage() {
  // TEMP: fallback user (replace later with real auth)
  const user = await prisma.user.findFirst({
    where: {
      isActive: true,
      personId: { not: null },
    },
    select: { personId: true },
  });

  const personId = user?.personId ?? null;

  if (!personId) {
    return (
      <div className="text-sm text-slate-500">
        Kein Benutzer zugeordnet.
      </div>
    );
  }

  const steps = await prisma.registrationWorkflowStep.findMany({
    where: {
      assignedPersonId: personId,
      status: { in: ["OPEN", "IN_PROGRESS", "BLOCKED"] },
    },
    include: {
      registration: true,
    },
    orderBy: [
      { status: "asc" },
      { dueDate: "asc" },
    ],
  });

  return (
    <div className="space-y-6">
      <MyRegistrationTasksPanel steps={steps} />
    </div>
  );
}
