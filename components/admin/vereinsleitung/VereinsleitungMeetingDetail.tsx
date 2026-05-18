import VereinsleitungMeetingActionsCard from "@/components/admin/vereinsleitung/VereinsleitungMeetingActionsCard";
import VereinsleitungMeetingAgendaCard from "@/components/admin/vereinsleitung/VereinsleitungMeetingAgendaCard";
import VereinsleitungMeetingDecisionsCard from "@/components/admin/vereinsleitung/VereinsleitungMeetingDecisionsCard";
import VereinsleitungMeetingInfoCard from "@/components/admin/vereinsleitung/VereinsleitungMeetingInfoCard";
import VereinsleitungMeetingParticipantsCard from "@/components/admin/vereinsleitung/VereinsleitungMeetingParticipantsCard";
import type { MeetingLiveData, MeetingSubEntities } from "@/lib/meetings/queries";

/**
 * TODO: Cross-Module Linking
 * 1. Add "Verknüpfte Ziele" panel showing Targets that reference this Meeting.
 * 2. Decision records → Target.nudgeJson as meeting outcome nudges.
 * 3. Action items with targetId → surface on linked Target detail.
 */

type VereinsleitungMeetingDetailProps = {
  dbMeeting?: MeetingLiveData | null;
  subEntities?: MeetingSubEntities | null;
};

export default function VereinsleitungMeetingDetail({ dbMeeting, subEntities }: VereinsleitungMeetingDetailProps) {
  const isDbBacked = Boolean(dbMeeting);

  return (
    <div className="space-y-5">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.85fr)_360px]">
        <div className="space-y-5">
          <VereinsleitungMeetingAgendaCard isDbBacked={isDbBacked} agendaItems={subEntities?.agendaItems} />
          <VereinsleitungMeetingDecisionsCard isDbBacked={isDbBacked} decisions={subEntities?.decisions} />
          <VereinsleitungMeetingActionsCard isDbBacked={isDbBacked} actions={subEntities?.actions} />
        </div>
        <div className="space-y-5">
          <VereinsleitungMeetingInfoCard dbMeeting={dbMeeting} />
          <VereinsleitungMeetingParticipantsCard dbMeeting={dbMeeting} participants={subEntities?.participants} />
        </div>
      </div>
    </div>
  );
}
