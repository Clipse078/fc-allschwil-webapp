import Link from "next/link";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import TournamentEventCreateForm from "@/components/admin/events/TournamentEventCreateForm";
import { requirePermission } from "@/lib/permissions/require-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";

export default async function NewTournamentEventPage() {
  await requirePermission(PERMISSIONS.EVENTS_MANAGE);

  return (
    <div className="space-y-8">
      <AdminSectionHeader
        eyebrow="Events"
        title="Turnier erstellen"
        description="Manuelle Erfassung eines Turniers pro Team. Dieser Flow speist später Website, Wochenplan, Teamseiten und Infoboard direkt aus dem WebApp Backend."
        actions={
          <Link href="/dashboard/events?type=TOURNAMENT" className="fca-button-secondary">
            Zurück zu Events
          </Link>
        }
      />

      <TournamentEventCreateForm />
    </div>
  );
}