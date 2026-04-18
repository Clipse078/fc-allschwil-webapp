import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import PlayersList from "@/components/admin/players/PlayersList";
import { requirePermission } from "@/lib/permissions/require-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";

export default async function PlayersPage() {
  await requirePermission(PERMISSIONS.PEOPLE_VIEW);

  const players: {
    id: string;
    name: string;
    teamLabel?: string | null;
    positionLabel?: string | null;
    birthYear?: string | null;
    imageSrc?: string | null;
    isActive?: boolean;
  }[] = [];

  return (
    <div className="space-y-8">
      <AdminSectionHeader
        eyebrow="Spieler"
        title="Spieler"
        description="Foto-first Spielerübersicht im FCA Premium UX Stil – vorbereitet für spätere Kader-, Team- und Website-Publikationslogik."
      />

      <PlayersList players={players} />
    </div>
  );
}
