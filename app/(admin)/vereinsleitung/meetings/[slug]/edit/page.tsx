import { notFound } from "next/navigation";
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

function getDatePart(value: Date | string | null | undefined) {
  const localValue = toDateTimeLocalValue(value);
  return localValue ? localValue.slice(0, 10) : "";
}

function getTimePart(value: Date | string | null | undefined) {
  const localValue = toDateTimeLocalValue(value);
  return localValue ? localValue.slice(11, 16) : "";
}

function getInitiativeProgressPercent(
  workItems: Array<{ status: string }>,
) {
  if (workItems.length === 0) {
    return 0;
  }

  const resolvedCount = workItems.filter((item) => item.status === "RESOLVED").length;
  return Math.round((resolvedCount / workItems.length) * 100);
}

export default async function EditMeetingPage({ params }: EditMeetingPageProps) {
  await requireAnyPermission([PERMISSIONS.VEREINSLEITUNG_MEETINGS_MANAGE]);

  const resolvedParams = await params;

  const [meeting, matters, initiatives] = await Promise.all([
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
        agendaItems: {
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
          select: {
            title: true,
            description: true,
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
        title="Meeting bearbeiten"
        description="Meeting-Daten und Pendenzen-Verknüpfungen anpassen."
      />

      <VereinsleitungMeetingCreateForm
        mode="edit"
        meetingId={meeting.id}
        submitLabel="Änderungen speichern"
        submittingLabel="Änderungen werden gespeichert..."
        cancelHref={"/vereinsleitung/meetings/" + meeting.slug}
        initiativeOptions={initiativeOptions}
        initialValues={{
          title: meeting.title,
          description: meeting.description ?? "",
          location: meeting.location ?? "",
          meetingDate: getDatePart(meeting.startAt),
          startTime: getTimePart(meeting.startAt),
          endTime: getTimePart(meeting.endAt),
          meetingProvider: meeting.meetingProvider,
          meetingLink:
            meeting.teamsJoinUrl ??
            meeting.externalMeetingUrl ??
            meeting.onlineMeetingUrl ??
            "",
          teamsSyncStatus: meeting.teamsSyncStatus,
        }}
        initialSelectedMatterIds={meeting.matterLinks.map((link) => link.matterId)}
        initialParticipants={meeting.participants.map((participant) => ({
          personId: participant.personId,
          displayName: participant.displayName,
          roleLabel: participant.roleLabel,
          status: participant.status,
          remarks: participant.remarks,
        }))}
        initialAgendaItems={meeting.agendaItems.map((item) => ({
          title: item.title,
          description: item.description,
        }))}
        matterOptions={matterOptions}
      />
    </div>
  );
}