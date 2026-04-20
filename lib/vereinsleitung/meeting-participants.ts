import type { MeetingParticipantItem, MeetingParticipantStats } from "@/lib/vereinsleitung/meeting-utils";

export function getParticipantInitials(value: string) {
  const parts = value
    .split(" ")
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) {
    return "NA";
  }

  return parts.map((part) => part.charAt(0).toUpperCase()).join("");
}

export function getParticipantStatusLabel(status: string) {
  switch (status) {
    case "CONFIRMED":
      return "Anwesend";
    case "EXCUSED":
      return "Entschuldigt";
    case "ABSENT":
      return "Abwesend";
    case "INVITED":
      return "Eingeladen";
    default:
      return status;
  }
}

export function getParticipantStats(
  participants: Pick<MeetingParticipantItem, "status">[],
): MeetingParticipantStats {
  return {
    total: participants.length,
    confirmed: participants.filter((participant) => participant.status === "CONFIRMED").length,
    excused: participants.filter((participant) => participant.status === "EXCUSED").length,
    absent: participants.filter((participant) => participant.status === "ABSENT").length,
    invited: participants.filter((participant) => participant.status === "INVITED").length,
  };
}
