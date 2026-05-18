/**
 * Vereinsleitung overview dashboard.
 *
 * TODO(decoupling — Organisation Builder):
 * This component renders a hardcoded dashboard for the "Vereinsleitung" org unit.
 * Target: a generic OrgUnitDashboard component that accepts orgUnitId as a prop
 * and renders the relevant cards (Goals, KPIs, Meetings, Initiatives, Tasks, Decisions)
 * based on the org unit's configuration.
 *
 * All sub-components (VereinsleitungGoalsCard, VereinsleitungKpiCard, etc.) will be
 * renamed to remove the Vereinsleitung prefix once they become reusable:
 *   VereinsleitungGoalsCard         → GoalsCard
 *   VereinsleitungKpiCard           → KpiCard
 *   VereinsleitungInitiativesCard   → InitiativesCard (links to /initiatives)
 *   VereinsleitungMeetingsCard      → MeetingsCard (links to /meetings)
 *   VereinsleitungTasksCard         → TasksCard
 *   VereinsleitungDecisionsCard     → DecisionsCard
 *
 * File move: components/admin/vereinsleitung/ → components/admin/org-unit/ (future)
 */
import VereinsleitungDecisionsCard from "@/components/admin/vereinsleitung/VereinsleitungDecisionsCard";
import VereinsleitungGoalsCard from "@/components/admin/vereinsleitung/VereinsleitungGoalsCard";
import VereinsleitungInitiativesCard from "@/components/admin/vereinsleitung/VereinsleitungInitiativesCard";
import VereinsleitungKpiCard from "@/components/admin/vereinsleitung/VereinsleitungKpiCard";
import VereinsleitungMeetingsCard from "@/components/admin/vereinsleitung/VereinsleitungMeetingsCard";
import VereinsleitungTasksCard from "@/components/admin/vereinsleitung/VereinsleitungTasksCard";

export default function VereinsleitungDashboard() {
  return (
    <div className="space-y-5">
      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.9fr)_minmax(320px,0.9fr)]">
        <VereinsleitungGoalsCard />
        <VereinsleitungKpiCard />
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.9fr)_minmax(320px,0.9fr)]">
        <VereinsleitungInitiativesCard />
        <VereinsleitungMeetingsCard />
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.9fr)_minmax(320px,0.9fr)]">
        <VereinsleitungTasksCard />
        <VereinsleitungDecisionsCard />
      </section>
    </div>
  );
}
