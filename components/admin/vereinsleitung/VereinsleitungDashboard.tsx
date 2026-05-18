import VereinsleitungDecisionsCard from "@/components/admin/vereinsleitung/VereinsleitungDecisionsCard";
import VereinsleitungGoalsCard from "@/components/admin/vereinsleitung/VereinsleitungGoalsCard";
import VereinsleitungInitiativesCard from "@/components/admin/vereinsleitung/VereinsleitungInitiativesCard";
import VereinsleitungKpiCard from "@/components/admin/vereinsleitung/VereinsleitungKpiCard";
import VereinsleitungMeetingsCard from "@/components/admin/vereinsleitung/VereinsleitungMeetingsCard";
import VereinsleitungTasksCard from "@/components/admin/vereinsleitung/VereinsleitungTasksCard";

/**
 * TODO: Cross-Module Linking — Dashboard integration
 *
 * Future: Vereinsleitung dashboard should show a "System Health" panel:
 * - Targets with no linked Initiatives (orphan targets — needs operationalisation)
 * - Initiatives with no parent Target (orphan initiatives — not linked to strategy)
 * - Meetings with pending action items linked to SUBMITTED Targets
 * - Cross-module nudge summary: stalled targets, overdue initiatives, unreviewed items
 *
 * TODO: AI recommendation layer entry point
 * The dashboard is the natural home for AI-surfaced cross-module recommendations:
 * "3 Targets have no data points this month — consider recording progress"
 * "Initiative 'Website Relaunch' is linked to 0 metrics — add contribution"
 */

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
