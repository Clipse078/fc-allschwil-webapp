import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import VereinsleitungKpiCard from "@/components/admin/vereinsleitung/VereinsleitungKpiCard";
import VereinsleitungTasksCard from "@/components/admin/vereinsleitung/VereinsleitungTasksCard";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { ROUTE_PERMISSION_SETS } from "@/lib/permissions/route-permission-sets";

export default async function VereinsleitungCockpitPage() {
  await requireAnyPermission(ROUTE_PERMISSION_SETS.VEREINSLEITUNG_COCKPIT_READ);

  return (
    <div className="space-y-8">
      <AdminSectionHeader
        eyebrow="Vereinsleitung"
        title="Cockpit"
        description="Zentrale Übersicht für KPI und Pendenzen der Vereinsleitung."
      />

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <VereinsleitungKpiCard />
        <VereinsleitungTasksCard />
      </section>
    </div>
  );
}
