import VereinsleitungGoalsCard from "@/components/admin/vereinsleitung/VereinsleitungGoalsCard";
import VereinsleitungInitiativesCard from "@/components/admin/vereinsleitung/VereinsleitungInitiativesCard";
import VereinsleitungKpiCard from "@/components/admin/vereinsleitung/VereinsleitungKpiCard";
import VereinsleitungMeetingsCard from "@/components/admin/vereinsleitung/VereinsleitungMeetingsCard";
import GovernancePendingCard from "@/components/admin/vereinsleitung/GovernancePendingCard";
import GovernanceStaleCard from "@/components/admin/vereinsleitung/GovernanceStaleCard";
import type { TargetListItem } from "@/lib/targets/queries";
import type { MeetingListItem } from "@/lib/meetings/queries";
import type { InitiativeListItem } from "@/lib/initiatives/queries";
import type { KpiItem } from "@/components/admin/vereinsleitung/VereinsleitungKpiCard";
import type { GovernanceOverviewData } from "@/lib/dashboard/governance-overview";

type VereinsleitungDashboardProps = {
  targets?: TargetListItem[];
  meetings?: MeetingListItem[];
  initiatives?: InitiativeListItem[];
  kpis?: KpiItem[];
  governance?: GovernanceOverviewData;
};

export default function VereinsleitungDashboard({
  targets = [],
  meetings = [],
  initiatives = [],
  kpis = [],
  governance,
}: VereinsleitungDashboardProps) {
  const pending = governance?.pendingApprovals ?? [];
  const overdue = governance?.overdueActions ?? [];
  const stale = governance?.staleTargets ?? [];
  const drafts = governance?.templateDrafts ?? [];

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
        <GovernancePendingCard
          pendingApprovals={pending}
          overdueActions={overdue}
        />
        <GovernanceStaleCard
          staleTargets={stale}
          templateDrafts={drafts}
        />
      </section>
    </div>
  );
}
