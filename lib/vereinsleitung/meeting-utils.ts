export type MeetingListItem = {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  status: string;
  statusLabel?: string;
  approvalStatus: string;
  approvalStatusLabel: string;
  isApprovalLocked: boolean;
  dateLabel: string;
  timeLabel: string;
  location: string | null;
  linkedMatterCount: number;
  openMatterCount: number;
};

export type MeetingMatterItem = {
  linkId: string;
  id: string;
  title: string;
  status: string;
  statusLabel: string;
  priority: string;
  priorityLabel: string;
  dueDateLabel: string | null;
  ownerName: string | null;
  sourceMeetingTitle: string | null;
};

export type MeetingParticipantItem = {
  id: string;
  displayName: string;
  roleLabel: string | null;
  status: string;
  statusLabel: string;
  initials: string;
  remarks: string | null;
};

export type MeetingParticipantStats = {
  total: number;
  confirmed: number;
  excused: number;
  absent: number;
  invited: number;
};

export type MeetingAgendaItem = {
  id: string;
  title: string;
  description: string | null;
  sortOrder: number;
};

export type MeetingInitiativeOption = {
  id: string;
  slug: string;
  title: string;
  status: string;
  statusLabel: string;
};

export type MeetingDecisionItem = {
  id: string;
  agendaItemId: string | null;
  agendaItemTitle: string | null;
  decisionText: string;
  decisionType: string;
  decisionTypeLabel: string;
  responsiblePersonId: string | null;
  responsibleDisplayName: string | null;
  dueDateLabel: string | null;
  createMatter: boolean;
  remarks: string | null;
  initiativeId: string | null;
  initiativeTitle: string | null;
  initiativeSlug: string | null;
  hasSourcedWorkItem: boolean;
  sourcedWorkItemCount: number;
};

export type MeetingDecisionResponsibleOption = {
  id: string;
  displayName: string;
  roleLabel?: string | null;
  email?: string | null;
};

export type MeetingProtocolEntryItem = {
  id: string;
  agendaItemId: string | null;
  agendaItemTitle: string | null;
  notes: string;
};

export type MeetingStatusOption = {
  value: string;
  label: string;
};

export type MeetingApprovalStatusOption = {
  value: string;
  label: string;
};

export type MeetingDetailItem = {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  status: string;
  statusLabel: string;
  approvalStatus: string;
  approvalStatusLabel: string;
  approvalNotes: string | null;
  approvalSubmittedAtLabel: string | null;
  approvedAtLabel: string | null;
  rejectedAtLabel: string | null;
  approvalRequestedByUserId: string | null;
  approvedByUserId: string | null;
  rejectedByUserId: string | null;
  approvalLockReasonLabel: string | null;
  isDone: boolean;
  isApprovalLocked: boolean;
  dateLabel: string;
  timeLabel: string;
  location: string | null;
  onlineMeetingUrl: string | null;
  meetingMode: string;
  meetingModeLabel: string;
  meetingProvider: string;
  meetingProviderLabel: string;
  teamsSyncStatus: string;
  teamsSyncStatusLabel: string;
  externalMeetingUrl: string | null;
  teamsJoinUrl: string | null;
  linkedMatters: MeetingMatterItem[];
  agendaItems: MeetingAgendaItem[];
  participants: MeetingParticipantItem[];
  participantStats: MeetingParticipantStats;
  protocolNotes: string | null;
  protocolEntries: MeetingProtocolEntryItem[];
  decisionsCount: number;
  decisions?: MeetingDecisionItem[];
  initiativeOptions: MeetingInitiativeOption[];
};

const DATE_FORMATTER = new Intl.DateTimeFormat("de-CH", {
  weekday: "long",
  day: "2-digit",
  month: "long",
  year: "numeric",
});

const SHORT_DATE_FORMATTER = new Intl.DateTimeFormat("de-CH", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const TIME_FORMATTER = new Intl.DateTimeFormat("de-CH", {
  hour: "2-digit",
  minute: "2-digit",
});

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat("de-CH", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function slugifyMeetingTitle(title: string) {
  return title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

export function formatMeetingDateLabel(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  return DATE_FORMATTER.format(date);
}

export function formatMeetingListDateLabel(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  return SHORT_DATE_FORMATTER.format(date);
}

export function formatMeetingDateTimeLabel(value?: Date | string | null) {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  return DATE_TIME_FORMATTER.format(date) + " Uhr";
}

export function formatMeetingTimeLabel(
  startAt: Date | string,
  endAt?: Date | string | null,
) {
  const start = startAt instanceof Date ? startAt : new Date(startAt);
  const startLabel = TIME_FORMATTER.format(start) + " Uhr";

  if (!endAt) {
    return startLabel;
  }

  const end = endAt instanceof Date ? endAt : new Date(endAt);
  return TIME_FORMATTER.format(start) + " - " + TIME_FORMATTER.format(end) + " Uhr";
}

export function getMatterStatusLabel(status: string) {
  switch (status) {
    case "OPEN":
      return "Offen";
    case "IN_PROGRESS":
      return "In Arbeit";
    case "DONE":
      return "Erledigt";
    default:
      return status;
  }
}

export function getMatterPriorityLabel(priority: string) {
  switch (priority) {
    case "HIGH":
      return "Hoch";
    case "MEDIUM":
      return "Mittel";
    case "LOW":
      return "Tief";
    default:
      return priority;
  }
}

export function formatMatterDueDateLabel(value?: Date | string | null) {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  return SHORT_DATE_FORMATTER.format(date);
}

export function getMeetingModeLabel(value: string) {
  switch (value) {
    case "ON_SITE":
      return "Vor Ort";
    case "ONLINE":
      return "Online";
    case "HYBRID":
      return "Hybrid";
    default:
      return value;
  }
}

export function getMeetingProviderLabel(value: string) {
  switch (value) {
    case "NONE":
      return "Kein Online-Provider";
    case "EXTERNAL":
      return "Externer Link";
    case "MICROSOFT_TEAMS":
      return "Microsoft Teams";
    default:
      return value;
  }
}

export function getTeamsSyncStatusLabel(value: string) {
  switch (value) {
    case "NOT_CONFIGURED":
      return "Nicht konfiguriert";
    case "MANUAL":
      return "Manuell";
    case "PENDING":
      return "Ausstehend";
    case "CREATED":
      return "Erstellt";
    case "FAILED":
      return "Fehlgeschlagen";
    default:
      return value;
  }
}

export function getDecisionTypeLabel(value: string) {
  switch (value) {
    case "DECISION":
      return "Beschluss";
    case "TASK":
      return "Auftrag";
    case "APPROVAL":
      return "Freigabe";
    case "INFO":
      return "Info";
    default:
      return value;
  }
}

export function getDecisionTypeOptions() {
  return [
    { value: "DECISION", label: "Beschluss" },
    { value: "TASK", label: "Auftrag" },
    { value: "APPROVAL", label: "Freigabe" },
    { value: "INFO", label: "Info" },
  ] as const;
}

export function getMeetingStatusLabel(value: string) {
  switch (value) {
    case "PLANNED":
      return "Geplant";
    case "IN_PROGRESS":
      return "In Durchführung";
    case "DONE":
      return "Abgeschlossen";
    default:
      return value;
  }
}

export function getMeetingStatusOptions(): MeetingStatusOption[] {
  return [
    { value: "PLANNED", label: "Geplant" },
    { value: "IN_PROGRESS", label: "In Durchführung" },
    { value: "DONE", label: "Abgeschlossen" },
  ];
}

export function getMeetingApprovalStatusLabel(value: string) {
  switch (value) {
    case "DRAFT":
      return "Entwurf";
    case "SUBMITTED":
      return "Zur Prüfung";
    case "APPROVED":
      return "Freigegeben";
    case "REJECTED":
      return "Abgelehnt";
    default:
      return value;
  }
}

export function getMeetingApprovalStatusOptions(): MeetingApprovalStatusOption[] {
  return [
    { value: "DRAFT", label: "Entwurf" },
    { value: "SUBMITTED", label: "Zur Prüfung" },
    { value: "APPROVED", label: "Freigegeben" },
    { value: "REJECTED", label: "Abgelehnt" },
  ];
}

export function getInitiativeStatusLabel(value: string) {
  switch (value) {
    case "PLANNED":
      return "Geplant";
    case "DONE":
      return "Abgeschlossen";
    default:
      return "In Arbeit";
  }
}

export function isMeetingApprovalLocked(status: string) {
  return status === "APPROVED";
}

export function getMeetingApprovalLockReasonLabel(input: {
  status: string;
  approvalStatus: string;
}) {
  if (input.status === "DONE") {
    return "Gesperrt, weil das Meeting abgeschlossen ist.";
  }

  if (input.approvalStatus === "APPROVED") {
    return "Gesperrt, weil das Meeting freigegeben wurde.";
  }

  return null;
}

export function getPreferredMeetingUrl(input: {
  teamsJoinUrl?: string | null;
  externalMeetingUrl?: string | null;
  onlineMeetingUrl?: string | null;
}) {
  return input.teamsJoinUrl ?? input.externalMeetingUrl ?? input.onlineMeetingUrl ?? null;
}