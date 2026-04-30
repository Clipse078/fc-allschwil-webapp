import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import MyRegistrationTasksPanel from "@/components/admin/tasks/MyRegistrationTasksPanel";
import { requirePermission } from "@/lib/permissions/require-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";

export default async function TasksPage() {
  // 🔒 enforce permission
  await requirePermission(PERMISSIONS.PEOPLE_VIEW);

  const session = await auth();

  if (!session?.user?.id) {
    return (
      <div className="text-sm text-slate-500">
        Nicht eingeloggt.
      </div>
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { personId: true },
  });

  const personId = user?.personId ?? null;

  if (!personId) {
    return (
      <div className="text-sm text-slate-500">
        Kein Profil (Person) mit diesem Benutzer verknüpft.
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
