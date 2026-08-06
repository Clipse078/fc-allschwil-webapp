import { notFound } from "next/navigation";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { findTeamSeasonsForTenant } from "@/lib/training/queries";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import TrainingSeriesForm from "@/components/admin/training/TrainingSeriesForm";

export default async function NewTrainingSeriesPage() {
  const session = await requireAnyPermission([PERMISSIONS.TRAININGS_MANAGE]);

  const tenantId = session.user?.activeTenantId;
  if (!tenantId) notFound();

  const teamSeasons = await findTeamSeasonsForTenant(tenantId);

  return (
    <div className="space-y-6">
      <AdminSectionHeader
        eyebrow="TrainingCenter"
        title="Neue Trainingsserie"
        description="Definiere Team, Wochentage und Zeiten. Nach dem Speichern werden die konkreten Trainingstermine automatisch generiert."
      />

      <TrainingSeriesForm mode="create" teamSeasons={teamSeasons} />
    </div>
  );
}
