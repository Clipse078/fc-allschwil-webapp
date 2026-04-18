"use client";

import AdminSurfaceCard from "@/components/admin/shared/AdminSurfaceCard";
import AdminStatusPill from "@/components/admin/shared/AdminStatusPill";
import ActivateSeasonButton from "@/components/admin/seasons/ActivateSeasonButton";

type SeasonItem = {
  id: string;
  key: string;
  name: string;
  isActive: boolean;
  startDate: string | Date;
  endDate: string | Date;
};

type SeasonsTableProps = {
  seasons: SeasonItem[];
  canManage: boolean;
};

function formatDate(value: string | Date) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleDateString("de-CH");
}

export default function SeasonsTable({
  seasons,
  canManage,
}: SeasonsTableProps) {
  if (seasons.length === 0) {
    return (
      <AdminSurfaceCard className="p-6">
        <p className="text-sm text-slate-600">Noch keine Saisons vorhanden.</p>
      </AdminSurfaceCard>
    );
  }

  return (
    <div className="space-y-4">
      {seasons.map((season) => (
        <AdminSurfaceCard key={season.id} className="p-5">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="fca-eyebrow">Saison</p>
              <h3 className="fca-subheading mt-2">{season.name}</h3>
              <p className="mt-3 text-sm text-slate-600">
                {formatDate(season.startDate)} - {formatDate(season.endDate)}
              </p>
            </div>

            <div className="flex flex-col gap-3 lg:items-end">
              <div className="flex flex-wrap gap-2">
                <span className="fca-pill">Key: {season.key}</span>
                <AdminStatusPill
                  label={season.isActive ? "Aktiv" : "Nicht aktiv"}
                  tone={season.isActive ? "success" : "muted"}
                />
              </div>

              {canManage ? (
                <ActivateSeasonButton
                  seasonId={season.id}
                  seasonName={season.name}
                  isActive={season.isActive}
                />
              ) : null}
            </div>
          </div>
        </AdminSurfaceCard>
      ))}
    </div>
  );
}
