import { prisma } from "@/lib/db/prisma";
import {
  formatMatterDueDateLabel,
  formatMeetingDateLabel,
  formatMeetingTimeLabel,
  getMatterPriorityLabel,
  getMatterStatusLabel,
  type MeetingDetailItem,
  type MeetingParticipantItem,
} from "@/lib/vereinsleitung/meeting-utils";
import {
  getParticipantInitials,
  getParticipantStats,
  getParticipantStatusLabel,
} from "@/lib/vereinsleitung/meeting-participants";

export async function getMeetingDetailItemBySlug(
  slug: string,
): Promise<MeetingDetailItem | null> {
  const meeting = await prisma.vereinsleitungMeeting.findUnique({
    where: {
      slug,
    },
    include: {
      matterLinks: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        include: {
          matter: {
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
          },
          carriedOverFromMeeting: {
            select: {
              id: true,
              title: true,
            },
          },
        },
      },
      participants: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      },
    },
  });

  if (!meeting) {
    return null;
  }

  const participants: MeetingParticipantItem[] = meeting.participants.map((participant) => ({
    id: participant.id,
    displayName: participant.displayName,
    roleLabel: participant.roleLabel,
    status: participant.status,
    statusLabel: getParticipantStatusLabel(participant.status),
    initials: getParticipantInitials(participant.displayName),
    remarks: participant.remarks,
  }));

  return {
    id: meeting.id,
    slug: meeting.slug,
    title: meeting.title,
    subtitle: meeting.subtitle,
    description: meeting.description,
    status: meeting.status,
    dateLabel: formatMeetingDateLabel(meeting.startAt),
    timeLabel: formatMeetingTimeLabel(meeting.startAt, meeting.endAt),
    location: meeting.location,
    onlineMeetingUrl: meeting.onlineMeetingUrl,
    linkedMatters: meeting.matterLinks.map((link) => {
      const ownerName =
        link.matter.owner?.displayName ??
        ([link.matter.owner?.firstName, link.matter.owner?.lastName]
          .filter(Boolean)
          .join(" ") || null);

      return {
        linkId: link.id,
        id: link.matter.id,
        title: link.matter.title,
        status: link.matter.status,
        statusLabel: getMatterStatusLabel(link.matter.status),
        priority: link.matter.priority,
        priorityLabel: getMatterPriorityLabel(link.matter.priority),
        dueDateLabel: formatMatterDueDateLabel(link.matter.dueDate),
        ownerName,
        sourceMeetingTitle: link.carriedOverFromMeeting?.title ?? null,
      };
    }),
    participants,
    participantStats: getParticipantStats(participants),
    protocolNotes: meeting.notes,
    decisionsCount: 0,
  };
}
