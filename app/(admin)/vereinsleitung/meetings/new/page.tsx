import VereinsleitungMeetingCreateForm from "@/components/admin/vereinsleitung/VereinsleitungMeetingCreateForm";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import { prisma } from "@/lib/db/prisma";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import {
  formatMatterDueDateLabel,
  getMatterPriorityLabel,
  getMatterStatusLabel,
} from "@/lib/vereinsleitung/meeting-utils";

export default async function VereinsleitungMeetingNewPage() {
  await requireAnyPermission([PERMISSIONS.VEREINSLEITUNG_MEETINGS_MANAGE]);

  const matters = await prisma.vereinsleitungMatter.findMany({
    orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
    include: {
      owner: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          displayName: true,
        },
      },
    },
  });

  const matterOptions = matters.map((matter) => ({
    id: matter.id,
    title: matter.title,
    status: matter.status,
    statusLabel: getMatterStatusLabel(matter.status),
    priority: matter.priority,
    priorityLabel: getMatterPriorityLabel(matter.priority),
    dueDateLabel: formatMatterDueDateLabel(matter.dueDate),
    ownerName:
      matter.owner?.displayName ??
      ([matter.owner?.firstName, matter.owner?.lastName].filter(Boolean).join(" ") || null),
  }));

  return (
    <div className="space-y-8">
      <AdminSectionHeader
        eyebrow="Meetings"
        title="Meeting planen"
        description="Erfasse ein neues Meeting und verknüpfe bestehende Pendenzen direkt beim Erstellen."
      />

      <VereinsleitungMeetingCreateForm matterOptions={matterOptions} />
    </div>
  );
}
