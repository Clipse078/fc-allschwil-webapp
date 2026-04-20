import { notFound } from "next/navigation";
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

type EditMeetingPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

function toDateTimeLocalValue(value: Date | string | null | undefined) {
  if (!value) {
    return "";
  }

  const date = value instanceof Date ? value : new Date(value);
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - offset * 60 * 1000);
  return localDate.toISOString().slice(0, 16);
}

export default async function EditMeetingPage({ params }: EditMeetingPageProps) {
  await requireAnyPermission([PERMISSIONS.VEREINSLEITUNG_MEETINGS_MANAGE]);

  const resolvedParams = await params;

  const [meeting, matters] = await Promise.all([
    prisma.vereinsleitungMeeting.findUnique({
      where: { slug: resolvedParams.slug },
      include: {
        matterLinks: {
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
          select: {
            matterId: true,
          },
        },
        participants: {
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
          select: {
            personId: true,
            displayName: true,
            roleLabel: true,
            status: true,
            remarks: true,
          },
        },
      },
    }),
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
  ]);

  if (!meeting) {
    notFound();
  }

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
        title="Meeting bearbeiten"
        description="Meeting-Daten und verknüpfte Pendenzen zentral anpassen."
      />

      <VereinsleitungMeetingCreateForm
        mode="edit"
        meetingId={meeting.id}
        submitLabel="Meeting speichern"
        submittingLabel="Meeting wird gespeichert..."
        cancelHref={"/vereinsleitung/meetings/" + meeting.slug}
        initialValues={{
          title: meeting.title,
          subtitle: meeting.subtitle ?? "",
          description: meeting.description ?? "",
          location: meeting.location ?? "",
          onlineMeetingUrl: meeting.onlineMeetingUrl ?? "",
          startAt: toDateTimeLocalValue(meeting.startAt),
          endAt: toDateTimeLocalValue(meeting.endAt),
          status:
            meeting.status === "IN_PROGRESS" || meeting.status === "DONE"
              ? meeting.status
              : "PLANNED",
        }}
        initialSelectedMatterIds={meeting.matterLinks.map((link) => link.matterId)}
        initialParticipants={meeting.participants.map((participant) => ({
          personId: participant.personId,
          displayName: participant.displayName,
          roleLabel: participant.roleLabel,
          status: participant.status,
          remarks: participant.remarks,
        }))}
        matterOptions={matterOptions}
      />
    </div>
  );
}