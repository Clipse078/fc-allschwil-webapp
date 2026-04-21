import VereinsleitungMeetingActionsCard from "@/components/admin/vereinsleitung/VereinsleitungMeetingActionsCard";
import VereinsleitungMeetingAgendaCard from "@/components/admin/vereinsleitung/VereinsleitungMeetingAgendaCard";
import VereinsleitungMeetingDecisionsCard from "@/components/admin/vereinsleitung/VereinsleitungMeetingDecisionsCard";
import VereinsleitungMeetingInfoCard from "@/components/admin/vereinsleitung/VereinsleitungMeetingInfoCard";
import VereinsleitungMeetingParticipantsCard from "@/components/admin/vereinsleitung/VereinsleitungMeetingParticipantsCard";
import VereinsleitungMeetingProtocolCard from "@/components/admin/vereinsleitung/VereinsleitungMeetingProtocolCard";
import type { MeetingDetailItem } from "@/lib/vereinsleitung/meeting-utils";

type VereinsleitungMeetingDetailProps = {
  meeting: MeetingDetailItem;
};

export default function VereinsleitungMeetingDetail({
  meeting,
}: VereinsleitungMeetingDetailProps) {
  return (
    <div className="space-y-5">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.85fr)_360px]">
        <div className="space-y-5">
          <VereinsleitungMeetingAgendaCard
            title="Meeting-Kontext"
            subtitle={meeting.subtitle}
            description={meeting.description}
          />
          <VereinsleitungMeetingActionsCard
            title="Verknuepfte Pendenzen"
            linkedMatters={meeting.linkedMatters}
          />
          <VereinsleitungMeetingProtocolCard notes={meeting.protocolNotes} />
          <VereinsleitungMeetingDecisionsCard decisionsCount={meeting.decisionsCount} />
        </div>

        <div className="space-y-5">
          <VereinsleitungMeetingInfoCard
            title="Sitzungsinformationen"
            dateLabel={meeting.dateLabel}
            timeLabel={meeting.timeLabel}
            location={meeting.location}
            onlineMeetingUrl={meeting.onlineMeetingUrl}
          />
          <VereinsleitungMeetingParticipantsCard
            participants={meeting.participants}
            stats={meeting.participantStats}
          />
        </div>
      </div>
    </div>
  );
}
