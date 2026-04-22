import type {
  MeetingAgendaItem,
  MeetingDecisionItem,
  MeetingProtocolEntryItem,
} from "@/lib/vereinsleitung/meeting-utils";

export type MeetingAgendaExecutionGroup = MeetingAgendaItem & {
  protocolEntries: MeetingProtocolEntryItem[];
  decisions: MeetingDecisionItem[];
};

export function groupByAgendaItems(
  agendaItems: MeetingAgendaItem[],
  protocolEntries: MeetingProtocolEntryItem[],
  decisions: MeetingDecisionItem[],
): MeetingAgendaExecutionGroup[] {
  return agendaItems.map((item) => ({
    ...item,
    protocolEntries: protocolEntries.filter(
      (entry) => entry.agendaItemId === item.id,
    ),
    decisions: decisions.filter(
      (decision) => decision.agendaItemId === item.id,
    ),
  }));
}
