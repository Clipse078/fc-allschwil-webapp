import VereinsleitungMeetingCreateForm from "@/components/admin/vereinsleitung/VereinsleitungMeetingCreateForm";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import { prisma } from "@/lib/db/prisma";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import {
  formatMatterDueDateLabel,
  getInitiativeStatusLabel,
  getMatterPriorityLabel,
  getMatterStatusLabel,
} from "@/lib/vereinsleitung/meeting-utils";

function getInitiativeProgressPercent(
  workItems: Array<{ status: string }>,
) {
  if (workItems.length === 0) {
    return 0;
  }

  const resolvedCount = workItems.filter((item) => item.status === "RESOLVED").length;
  return Math.round((resolvedCount / workItems.length) * 100);
}

export default async function VereinsleitungMeetingNewPage() {
  await requireAnyPermission([PERMISSIONS.VEREINSLEITUNG_MEETINGS_MANAGE]);

  const [matters, initiatives] = await Promise.all([
    prisma.vereinsleitungMatter.findMany({
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
    }),
    prisma.vereinsleitungInitiative.findMany({
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        slug: true,
        title: true,
        status: true,
        workItems: {
          select: {
            status: true,
          },
        },
      },
    }),
  ]);

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

  const initiativeOptions = initiatives.map((initiative) => ({
    id: initiative.id,
    slug: initiative.slug,
    title: initiative.title,
    status: initiative.status,
    statusLabel: getInitiativeStatusLabel(initiative.status),
    progressPercent: getInitiativeProgressPercent(initiative.workItems),
  }));

  return (
    <div className="space-y-8">
      <AdminSectionHeader
        eyebrow="Meetings"
        title="Meeting planen"
        description="Neues Meeting erfassen und direkt mit Pendenzen verknüpfen."
      />

      <VereinsleitungMeetingCreateForm
        matterOptions={matterOptions}
        initiativeOptions={initiativeOptions}
      />
    </div>
  );
}