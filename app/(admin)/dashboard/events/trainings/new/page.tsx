import Link from "next/link";
import { PageHeader, PageShell } from "@/components/shared/page";
import TrainingEventCreateForm from "@/components/admin/events/TrainingEventCreateForm";
import { requirePermission } from "@/lib/permissions/require-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";

export default async function NewTrainingEventPage() {
  await requirePermission(PERMISSIONS.EVENTS_MANAGE);

  return (
    <PageShell>
      <PageHeader
        eyebrow="Events"
        title="Training erstellen"
        description="Manuelle Erfassung eines Trainings pro Team. Dieser Flow speist später Trainingsplan, Wochenplan, Teamseiten und Infoboard direkt aus dem WebApp Backend."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Events", href: "/dashboard/events" },
          { label: "Training erstellen" },
        ]}
        actions={
          <Link href="/dashboard/events?type=TRAINING" className="fca-button-secondary">
            Zurück zu Events
          </Link>
        }
      />

      <TrainingEventCreateForm />
    </PageShell>
  );
}
