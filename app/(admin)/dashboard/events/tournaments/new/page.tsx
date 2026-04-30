import Link from "next/link";
import { PageHeader, PageShell } from "@/components/shared/page";
import TournamentEventCreateForm from "@/components/admin/events/TournamentEventCreateForm";
import { requirePermission } from "@/lib/permissions/require-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";

export default async function NewTournamentEventPage() {
  await requirePermission(PERMISSIONS.EVENTS_MANAGE);

  return (
    <PageShell>
      <PageHeader
        eyebrow="Events"
        title="Turnier erstellen"
        description="Manuelle Erfassung eines Turniers pro Team. Dieser Flow speist später Website, Wochenplan, Teamseiten und Infoboard direkt aus dem WebApp Backend."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Events", href: "/dashboard/events" },
          { label: "Turnier erstellen" },
        ]}
        actions={
          <Link href="/dashboard/events?type=TOURNAMENT" className="fca-button-secondary">
            Zurück zu Events
          </Link>
        }
      />

      <TournamentEventCreateForm />
    </PageShell>
  );
}
