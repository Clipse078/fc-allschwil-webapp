"use client";

import AdminAvatar from "@/components/admin/shared/AdminAvatar";
import AdminListItem from "@/components/admin/shared/AdminListItem";
import AdminStatusPill from "@/components/admin/shared/AdminStatusPill";
import AdminSurfaceCard from "@/components/admin/shared/AdminSurfaceCard";

type TrainerItem = {
  id: string;
  name: string;
  teamLabel?: string | null;
  functionLabel?: string | null;
  imageSrc?: string | null;
  isActive?: boolean;
};

type TrainersListProps = {
  trainers: TrainerItem[];
};

export default function TrainersList({ trainers }: TrainersListProps) {
  if (trainers.length === 0) {
    return (
      <AdminSurfaceCard className="p-6">
        <div className="space-y-3">
          <p className="fca-subheading">Noch keine Trainer</p>
          <p className="text-sm leading-6 text-slate-600">
            Die Premium Trainerliste ist vorbereitet. Als Nächstes können wir
            Trainerdaten, Teamzuordnung, Rollen und Fotos anbinden.
          </p>
        </div>
      </AdminSurfaceCard>
    );
  }

  return (
    <div className="space-y-4">
      {trainers.map((trainer) => (
        <AdminListItem
          key={trainer.id}
          avatar={
            <AdminAvatar
              name={trainer.name}
              imageSrc={trainer.imageSrc}
              size="md"
            />
          }
          title={trainer.name}
          subtitle={
            [trainer.teamLabel, trainer.functionLabel].filter(Boolean).join(" • ") ||
            "Kein Team / keine Funktion hinterlegt"
          }
          meta={
            <>
              {trainer.functionLabel ? (
                <span className="fca-pill">{trainer.functionLabel}</span>
              ) : null}

              <AdminStatusPill
                label={trainer.isActive === false ? "Inaktiv" : "Aktiv"}
                tone={trainer.isActive === false ? "muted" : "success"}
              />
            </>
          }
          actions={<span className="text-sm text-slate-400">Trainerprofil folgt</span>}
        />
      ))}
    </div>
  );
}
