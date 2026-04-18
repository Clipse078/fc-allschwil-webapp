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
