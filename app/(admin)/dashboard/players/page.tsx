import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import PlayersList from "@/components/admin/players/PlayersList";
import { requirePermission } from "@/lib/permissions/require-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getPlayers } from "@/lib/people/queries";

export default async function PlayersPage() {
  await requirePermission(PERMISSIONS.PEOPLE_VIEW);

  const players = await getPlayers();

  return (
    <div className="space-y-8">
      <AdminSectionHeader
        eyebrow="Spieler"
        title="Spieler"
        description="Alle Personen mit aktivem Spieler-Flag. Spieler werden im Bereich Personen verwaltet."
      />

      <PlayersList players={players} />
    </div>
  );
}
