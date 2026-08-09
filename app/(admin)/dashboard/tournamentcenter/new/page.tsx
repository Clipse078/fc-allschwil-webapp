import Link from "next/link";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import TournamentEventCreateForm from "@/components/admin/events/TournamentEventCreateForm";
import { requirePermission } from "@/lib/permissions/require-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";

export default async function NewTournamentCenterPage() {
  await requirePermission(PERMISSIONS.EVENTS_MANAGE);

  return (
    <div className="max-w-[1000px] space-y-8">
      <AdminSectionHeader
        eyebrow="TournamentCenter"
        title="Turnier erstellen"
        description="Manuelle Erfassung eines Turniers pro Team. Erscheint nach dem Speichern im TournamentCenter sowie – je nach Sichtbarkeit – auf Website, Wochenplan und Infoboard."
        actions={
          <Link href="/dashboard/tournamentcenter" className="fca-button-secondary">
            Zurück zum TournamentCenter
          </Link>
        }
      />

      <TournamentEventCreateForm
        redirectPath="/dashboard/tournamentcenter?submitted=1"
        cancelPath="/dashboard/tournamentcenter"
      />
    </div>
  );
}
