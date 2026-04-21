import { prisma } from "@/lib/db/prisma";
import {
  formatMatterDueDateLabel,
  formatMeetingDateLabel,
  formatMeetingTimeLabel,
  getDecisionTypeLabel,
  getMatterPriorityLabel,
  getMatterStatusLabel,
  getMeetingModeLabel,
  getMeetingProviderLabel,
  getTeamsSyncStatusLabel,
  type MeetingDecisionItem,
  type MeetingDetailItem,
  type MeetingParticipantItem,
  type MeetingProtocolEntryItem,
} from "@/lib/vereinsleitung/meeting-utils";
import {
  getParticipantInitials,
  getParticipantStats,
  getParticipantStatusLabel,
} from "@/lib/vereinsleitung/meeting-participants";

export async function getMeetingDetailItem(
  meetingIdOrSlug: string,
): Promise<MeetingDetailItem | null> {
  const meeting = await prisma.vereinsleitungMeeting.findFirst({
    where: {
      OR: [{ id: meetingIdOrSlug }, { slug: meetingIdOrSlug }],
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
      decisions: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        include: {
          responsiblePerson: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              displayName: true,
            },
          },
        },
      },
      protocolEntries: {
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

  const decisions: MeetingDecisionItem[] = meeting.decisions.map((decision) => {
    const responsibleDisplayName =
      decision.responsibleDisplayName ??
      decision.responsiblePerson?.displayName ??
      ([decision.responsiblePerson?.firstName, decision.responsiblePerson?.lastName]
        .filter(Boolean)
        .join(" ") || null);

    return {
      id: decision.id,
      agendaItemId: decision.agendaItemId,
      agendaItemTitle: decision.agendaItemTitle,
      decisionText: decision.decisionText,
      decisionType: decision.decisionType,
      decisionTypeLabel: getDecisionTypeLabel(decision.decisionType),
      responsiblePersonId: decision.responsiblePersonId,
      responsibleDisplayName,
      dueDateLabel: formatMatterDueDateLabel(decision.dueDate),
      createMatter: decision.createMatter,
      remarks: decision.remarks,
    };
  });

  const protocolEntries: MeetingProtocolEntryItem[] = meeting.protocolEntries.map((entry) => ({
    id: entry.id,
    agendaItemId: entry.agendaItemId,
    agendaItemTitle: entry.agendaItemTitle,
    notes: entry.notes,
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
    meetingMode: meeting.meetingMode,
    meetingModeLabel: getMeetingModeLabel(meeting.meetingMode),
    meetingProvider: meeting.meetingProvider,
    meetingProviderLabel: getMeetingProviderLabel(meeting.meetingProvider),
    teamsSyncStatus: meeting.teamsSyncStatus,
    teamsSyncStatusLabel: getTeamsSyncStatusLabel(meeting.teamsSyncStatus),
    externalMeetingUrl: meeting.externalMeetingUrl,
    teamsJoinUrl: meeting.teamsJoinUrl,
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
    protocolEntries,
    decisionsCount: decisions.length,
    decisions,
  };
}
