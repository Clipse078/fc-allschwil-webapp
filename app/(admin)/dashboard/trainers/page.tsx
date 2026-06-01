import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import TrainersList from "@/components/admin/trainers/TrainersList";
import { requirePermission } from "@/lib/permissions/require-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getTrainers } from "@/lib/people/queries";

export default async function TrainersPage() {
  await requirePermission(PERMISSIONS.PEOPLE_VIEW);

  const trainers = await getTrainers();

  return (
    <div className="space-y-8">
      <AdminSectionHeader
        eyebrow="Trainer"
        title="Trainer"
        description="Alle Personen mit aktivem Trainer-Flag. Trainer werden im Bereich Personen verwaltet."
      />

      <TrainersList trainers={trainers} />
    </div>
  );
}
