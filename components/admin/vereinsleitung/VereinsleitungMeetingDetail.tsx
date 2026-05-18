/**
 * TODO: Cross-Module Linking — Meeting detail integration
 *
 * 1. Add a "Verknüpfte Ziele" section showing Targets that reference this Meeting
 *    (reverse query: Target.linkedMeetingRefs contains this meeting's slug).
 * 2. When MeetingAction model exists, surface actions linked to Targets on
 *    the Target detail page as "open actions from meetings".
 * 3. Decision records should optionally append to Target.nudgeJson as
 *    "meeting outcome" nudges for operational traceability.
 * 4. Use TargetLinksPanel in reverse: MeetingLinkedTargetsPanel.
 */

import VereinsleitungMeetingActionsCard from "@/components/admin/vereinsleitung/VereinsleitungMeetingActionsCard";
import VereinsleitungMeetingAgendaCard from "@/components/admin/vereinsleitung/VereinsleitungMeetingAgendaCard";
import VereinsleitungMeetingDecisionsCard from "@/components/admin/vereinsleitung/VereinsleitungMeetingDecisionsCard";
import VereinsleitungMeetingInfoCard from "@/components/admin/vereinsleitung/VereinsleitungMeetingInfoCard";
import VereinsleitungMeetingParticipantsCard from "@/components/admin/vereinsleitung/VereinsleitungMeetingParticipantsCard";
import type { MeetingLiveData } from "@/lib/meetings/queries";

type VereinsleitungMeetingDetailProps = {
  /**
   * slug is passed through from the page for future reverse-link queries
   * (e.g. showing Targets that reference this meeting). Currently unused here;
   * the caller (meetings/[slug]/page.tsx) still has it when that work starts.
   */
  dbMeeting?: MeetingLiveData | null;
};

export default function VereinsleitungMeetingDetail({
  dbMeeting,
}: VereinsleitungMeetingDetailProps) {
  const isDbBacked = Boolean(dbMeeting);

  return (
    <div className="space-y-5">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.85fr)_360px]">
        <div className="space-y-5">
          <VereinsleitungMeetingAgendaCard isDbBacked={isDbBacked} />
          <VereinsleitungMeetingDecisionsCard isDbBacked={isDbBacked} />
          <VereinsleitungMeetingActionsCard isDbBacked={isDbBacked} />
        </div>

        <div className="space-y-5">
          <VereinsleitungMeetingInfoCard dbMeeting={dbMeeting} />
          <VereinsleitungMeetingParticipantsCard dbMeeting={dbMeeting} />
        </div>
      </div>
    </div>
  );
}
