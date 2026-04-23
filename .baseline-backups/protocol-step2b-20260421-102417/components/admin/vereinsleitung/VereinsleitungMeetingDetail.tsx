import VereinsleitungMeetingActionsCard from "@/components/admin/vereinsleitung/VereinsleitungMeetingActionsCard";
import VereinsleitungMeetingAgendaCard from "@/components/admin/vereinsleitung/VereinsleitungMeetingAgendaCard";
import VereinsleitungMeetingDecisionsCard from "@/components/admin/vereinsleitung/VereinsleitungMeetingDecisionsCard";
import VereinsleitungMeetingInfoCard from "@/components/admin/vereinsleitung/VereinsleitungMeetingInfoCard";
import VereinsleitungMeetingParticipantsCard from "@/components/admin/vereinsleitung/VereinsleitungMeetingParticipantsCard";
import VereinsleitungMeetingProtocolCard from "@/components/admin/vereinsleitung/VereinsleitungMeetingProtocolCard";
import { getPreferredMeetingUrl, type MeetingDetailItem } from "@/lib/vereinsleitung/meeting-utils";

type VereinsleitungMeetingDetailProps = {
  meeting: MeetingDetailItem;
};

export default function VereinsleitungMeetingDetail({
  meeting,
}: VereinsleitungMeetingDetailProps) {
  const meetingUrl = getPreferredMeetingUrl({
    teamsJoinUrl: meeting.teamsJoinUrl,
    externalMeetingUrl: meeting.externalMeetingUrl,
    onlineMeetingUrl: meeting.onlineMeetingUrl,
  });

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
            title="Meeting-Aktionen"
            linkedMatters={meeting.linkedMatters}
            meetingUrl={meetingUrl}
            teamsSyncStatusLabel={meeting.teamsSyncStatusLabel}
          />
          <VereinsleitungMeetingProtocolCard
            meetingId={meeting.id}
            notes={meeting.protocolNotes}
            protocolEntries={meeting.protocolEntries}
          />
          <VereinsleitungMeetingDecisionsCard
            meetingId={meeting.id}
            decisions={meeting.decisions ?? []}
          />
        </div>

        <div className="space-y-5">
          <VereinsleitungMeetingInfoCard
            title="Sitzungsinformationen"
            dateLabel={meeting.dateLabel}
            timeLabel={meeting.timeLabel}
            location={meeting.location}
            onlineMeetingUrl={meeting.onlineMeetingUrl}
            meetingModeLabel={meeting.meetingModeLabel}
            meetingProviderLabel={meeting.meetingProviderLabel}
            teamsSyncStatusLabel={meeting.teamsSyncStatusLabel}
            externalMeetingUrl={meeting.externalMeetingUrl}
            teamsJoinUrl={meeting.teamsJoinUrl}
          />
          <div id="participants">
            <VereinsleitungMeetingParticipantsCard
              participants={meeting.participants}
              stats={meeting.participantStats}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

