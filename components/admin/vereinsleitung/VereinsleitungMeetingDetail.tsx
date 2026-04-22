import VereinsleitungMeetingActionsCard from "@/components/admin/vereinsleitung/VereinsleitungMeetingActionsCard";
import VereinsleitungMeetingAgendaCard from "@/components/admin/vereinsleitung/VereinsleitungMeetingAgendaCard";
import VereinsleitungMeetingDecisionsCard from "@/components/admin/vereinsleitung/VereinsleitungMeetingDecisionsCard";
import VereinsleitungMeetingExecutionWorkspace from "@/components/admin/vereinsleitung/VereinsleitungMeetingExecutionWorkspace";
import VereinsleitungMeetingInfoCard from "@/components/admin/vereinsleitung/VereinsleitungMeetingInfoCard";
import VereinsleitungMeetingParticipantsCard from "@/components/admin/vereinsleitung/VereinsleitungMeetingParticipantsCard";
import VereinsleitungMeetingProtocolCard from "@/components/admin/vereinsleitung/VereinsleitungMeetingProtocolCard";
import { getPreferredMeetingUrl, type MeetingDetailItem } from "@/lib/vereinsleitung/meeting-utils";

type VereinsleitungMeetingDetailProps = {
  meeting: MeetingDetailItem;
  canManageMeetings: boolean;
  canReviewMeetings: boolean;
  canApproveMeetings: boolean;
};

export default function VereinsleitungMeetingDetail({
  meeting,
  canManageMeetings,
  canReviewMeetings,
  canApproveMeetings,
}: VereinsleitungMeetingDetailProps) {
  const meetingUrl = getPreferredMeetingUrl({
    teamsJoinUrl: meeting.teamsJoinUrl,
    externalMeetingUrl: meeting.externalMeetingUrl,
    onlineMeetingUrl: meeting.onlineMeetingUrl,
  });

  return (
    <div className="space-y-5">
      <VereinsleitungMeetingExecutionWorkspace
        meetingId={meeting.id}
        agendaItems={meeting.agendaItems}
        protocolEntries={meeting.protocolEntries}
        decisions={meeting.decisions ?? []}
        initiativeOptions={meeting.initiativeOptions}
        isDone={meeting.isDone || meeting.isApprovalLocked}
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.85fr)_360px]">
        <div className="space-y-5">
          <VereinsleitungMeetingAgendaCard
            title="Meeting-Kontext"
            subtitle={meeting.subtitle}
            description={meeting.description}
            agendaItems={meeting.agendaItems}
          />
          <VereinsleitungMeetingActionsCard
            title="Meeting-Aktionen"
            linkedMatters={meeting.linkedMatters}
            meetingUrl={meetingUrl}
            teamsSyncStatusLabel={meeting.teamsSyncStatusLabel}
            isLocked={meeting.isDone || meeting.isApprovalLocked}
            approvalStatusLabel={meeting.approvalStatusLabel}
            isApprovalLocked={meeting.isApprovalLocked}
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
            meetingId={meeting.id}
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
            status={meeting.status}
            statusLabel={meeting.statusLabel}
            approvalStatus={meeting.approvalStatus}
            approvalStatusLabel={meeting.approvalStatusLabel}
            approvalNotes={meeting.approvalNotes}
            approvalSubmittedAtLabel={meeting.approvalSubmittedAtLabel}
            approvedAtLabel={meeting.approvedAtLabel}
            rejectedAtLabel={meeting.rejectedAtLabel}
            approvalRequestedByUserId={meeting.approvalRequestedByUserId}
            approvedByUserId={meeting.approvedByUserId}
            rejectedByUserId={meeting.rejectedByUserId}
            approvalLockReasonLabel={meeting.approvalLockReasonLabel}
            isApprovalLocked={meeting.isApprovalLocked}
            isDone={meeting.isDone}
            canManageMeetings={canManageMeetings}
            canReviewMeetings={canReviewMeetings}
            canApproveMeetings={canApproveMeetings}
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
