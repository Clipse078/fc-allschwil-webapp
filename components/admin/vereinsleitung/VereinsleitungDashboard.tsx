import VereinsleitungDecisionsCard from "@/components/admin/vereinsleitung/VereinsleitungDecisionsCard";
import VereinsleitungGoalsCard from "@/components/admin/vereinsleitung/VereinsleitungGoalsCard";
import VereinsleitungInitiativesCard from "@/components/admin/vereinsleitung/VereinsleitungInitiativesCard";
import VereinsleitungKpiCard from "@/components/admin/vereinsleitung/VereinsleitungKpiCard";
import VereinsleitungMeetingsCard from "@/components/admin/vereinsleitung/VereinsleitungMeetingsCard";
import VereinsleitungTasksCard from "@/components/admin/vereinsleitung/VereinsleitungTasksCard";
import type { TargetListItem } from "@/lib/targets/queries";
import type { MeetingListItem } from "@/lib/meetings/queries";

/**
 * TODO: Cross-Module Linking — System Health Panel
 * - Targets with no linked Initiatives
 * - Meetings with open Actions linked to SUBMITTED Targets
 * - Smart nudges: stalled targets, overdue initiatives, unreviewed items
 * No AI — deterministic operational intelligence only.
 *
 * TODO: initiatives prop once VereinsleitungInitiativesCard is upgraded to accept DB data
 */

type VereinsleitungDashboardProps = {
  targets?: TargetListItem[];
  meetings?: MeetingListItem[];
};

export default function VereinsleitungDashboard({
  targets = [],
  meetings = [],
}: VereinsleitungDashboardProps) {
  return (
    <div className="space-y-5">
      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.9fr)_minmax(320px,0.9fr)]">
        <VereinsleitungGoalsCard targets={targets} />
        <VereinsleitungKpiCard />
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.9fr)_minmax(320px,0.9fr)]">
        <VereinsleitungInitiativesCard />
        <VereinsleitungMeetingsCard meetings={meetings} />
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.9fr)_minmax(320px,0.9fr)]">
        <VereinsleitungTasksCard />
        <VereinsleitungDecisionsCard />
      </section>
    </div>
  );
}
