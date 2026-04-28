"use client";

import Link from "next/link";

import AdminAvatar from "@/components/admin/shared/AdminAvatar";
import AdminListItem from "@/components/admin/shared/AdminListItem";
import AdminStatusPill from "@/components/admin/shared/AdminStatusPill";
import AdminSurfaceCard from "@/components/admin/shared/AdminSurfaceCard";

type PlayerItem = {
  id: string;
  name: string;
  teamLabel?: string | null;
  positionLabel?: string | null;
  birthYear?: string | null;
  imageSrc?: string | null;
  isActive?: boolean;
};

type PlayersListProps = {
  players: PlayerItem[];
};

export default function PlayersList({ players }: PlayersListProps) {
  if (players.length === 0) {
    return (
      <AdminSurfaceCard className="p-6">
        <div className="space-y-3">
          <p className="fca-subheading">Noch keine Spieler</p>
          <p className="text-sm leading-6 text-slate-600">
            Die Premium Spielerliste ist vorbereitet. Als Nächstes können wir
            echte Kaderdaten, Teamzuordnung, Fotos und Website-Toggles anbinden.
          </p>
        </div>
      </AdminSurfaceCard>
    );
  }

  return (
    <div className="space-y-4">
      {players.map((player) => (
        <AdminListItem
          key={player.id}
          avatar={
            <AdminAvatar
              name={player.name}
              imageSrc={player.imageSrc}
              size="md"
            />
          }
          title={player.name}
          subtitle={
            [player.teamLabel, player.positionLabel].filter(Boolean).join(" • ") ||
            "Kein Team / keine Position hinterlegt"
          }
          meta={
            <>
              {player.birthYear ? (
                <span className="fca-pill">Jahrgang {player.birthYear}</span>
              ) : null}

              <AdminStatusPill
                label={player.isActive === false ? "Inaktiv" : "Aktiv"}
                tone={player.isActive === false ? "muted" : "success"}
              />
            </>
          }
          actions={<Link href={`/dashboard/players/${player.id}`} className="rounded-full border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50">Profil öffnen</Link>}
        />
      ))}
    </div>
  );
}


