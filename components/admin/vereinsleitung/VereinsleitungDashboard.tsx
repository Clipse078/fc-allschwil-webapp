import VereinsleitungDecisionsCard from "@/components/admin/vereinsleitung/VereinsleitungDecisionsCard";
import VereinsleitungGoalsCard from "@/components/admin/vereinsleitung/VereinsleitungGoalsCard";
import VereinsleitungInitiativesCard from "@/components/admin/vereinsleitung/VereinsleitungInitiativesCard";
import VereinsleitungKpiCard from "@/components/admin/vereinsleitung/VereinsleitungKpiCard";
import VereinsleitungMeetingsCard from "@/components/admin/vereinsleitung/VereinsleitungMeetingsCard";
import VereinsleitungTasksCard from "@/components/admin/vereinsleitung/VereinsleitungTasksCard";
import type { TargetListItem } from "@/lib/targets/queries";
import type { MeetingListItem } from "@/lib/meetings/queries";
import type { InitiativeListItem } from "@/lib/initiatives/queries";
import type { KpiItem } from "@/components/admin/vereinsleitung/VereinsleitungKpiCard";

/**
 * TODO: Cross-Module Linking — System Health Panel
 * - Targets with no linked Initiatives
 * - Meetings with open Actions linked to SUBMITTED Targets
 * - Smart nudges: stalled targets, overdue initiatives, unreviewed items
 * No AI — deterministic operational intelligence only.
 */

type VereinsleitungDashboardProps = {
  targets?: TargetListItem[];
  meetings?: MeetingListItem[];
  initiatives?: InitiativeListItem[];
  kpis?: KpiItem[];
};

export default function VereinsleitungDashboard({
  targets = [],
  meetings = [],
  initiatives = [],
  kpis = [],
}: VereinsleitungDashboardProps) {
  return (
    <div className="space-y-5">
      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.9fr)_minmax(320px,0.9fr)]">
        <VereinsleitungGoalsCard targets={targets} />
        <VereinsleitungKpiCard items={kpis} />
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.9fr)_minmax(320px,0.9fr)]">
        <VereinsleitungInitiativesCard initiatives={initiatives} />
        <VereinsleitungMeetingsCard meetings={meetings} />
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.9fr)_minmax(320px,0.9fr)]">
        <VereinsleitungTasksCard />
        <VereinsleitungDecisionsCard />
      </section>
    </div>
  );
}
