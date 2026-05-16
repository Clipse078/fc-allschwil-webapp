import Link from "next/link";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import TrainingEventCreateForm from "@/components/admin/events/TrainingEventCreateForm";
import { requirePermission } from "@/lib/permissions/require-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";

export default async function NewTrainingEventPage() {
  await requirePermission(PERMISSIONS.EVENTS_MANAGE);

  return (
    <div className="space-y-8">
      <AdminSectionHeader
        eyebrow="Events"
        title="Training erstellen"
        description="Manuelle Erfassung eines Trainings pro Team. Dieser Flow speist später Trainingsplan, Wochenplan, Teamseiten und Infoboard direkt aus dem WebApp Backend."
        actions={
          <Link href="/dashboard/events?type=TRAINING" className="fca-button-secondary">
            Zurück zu Events
          </Link>
        }
      />

      <TrainingEventCreateForm />
    </div>
  );
}