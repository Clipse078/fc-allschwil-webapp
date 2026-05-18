/**
 * TODO: Cross-Module Linking — Meeting detail integration
 *
 * When Meeting is promoted to a DB-backed model:
 * 1. Add a "Verknüpfte Ziele" section showing Targets that reference this Meeting
 *    (reverse query: Target.linkedMeetingRefs contains this meeting's slug/id).
 * 2. Surface action items from this meeting that are linked to Targets.
 * 3. Decision records should optionally append to Target.nudgeJson as
 *    "meeting outcome" nudges.
 * 4. Use TargetLinksPanel in reverse: MeetingLinkedTargetsPanel.
 *
 * TODO: Operational traceability
 * Meeting outcomes → Target progress notes (auto-append as TargetDataPoint
 * when a meeting agenda item is closed with a numeric resolution).
 */

import VereinsleitungMeetingActionsCard from "@/components/admin/vereinsleitung/VereinsleitungMeetingActionsCard";
import VereinsleitungMeetingAgendaCard from "@/components/admin/vereinsleitung/VereinsleitungMeetingAgendaCard";
import VereinsleitungMeetingDecisionsCard from "@/components/admin/vereinsleitung/VereinsleitungMeetingDecisionsCard";
import VereinsleitungMeetingInfoCard from "@/components/admin/vereinsleitung/VereinsleitungMeetingInfoCard";
import VereinsleitungMeetingParticipantsCard from "@/components/admin/vereinsleitung/VereinsleitungMeetingParticipantsCard";

type VereinsleitungMeetingDetailProps = {
  slug: string;
};

export default function VereinsleitungMeetingDetail({
  slug,
}: VereinsleitungMeetingDetailProps) {
  const normalizedSlug = slug.trim().toLowerCase();

  return (
    <div className="space-y-5">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.85fr)_360px]">
        <div className="space-y-5">
          <VereinsleitungMeetingAgendaCard slug={normalizedSlug} />
          <VereinsleitungMeetingDecisionsCard slug={normalizedSlug} />
          <VereinsleitungMeetingActionsCard slug={normalizedSlug} />
        </div>

        <div className="space-y-5">
          <VereinsleitungMeetingInfoCard slug={normalizedSlug} />
          <VereinsleitungMeetingParticipantsCard slug={normalizedSlug} />
        </div>
      </div>
    </div>
  );
}
