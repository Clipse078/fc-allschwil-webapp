"use client";

import { CalendarDays } from "lucide-react";
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
      <div className="sce-detail-section">
        <div className="sce-detail-section-body flex flex-col items-center justify-center gap-3 py-14 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--surface-2)]">
            <CalendarDays className="h-5 w-5 text-[var(--muted)]" />
          </div>
          <p className="text-sm text-[var(--muted)]">
            Noch keine Saisons vorhanden.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[var(--radius-2xl)] border border-[var(--border)] bg-white shadow-[var(--shadow-sm)]">
      {seasons.map((season, idx) => {
        const isLast = idx === seasons.length - 1;

        return (
          <div
            key={season.id}
            className={`flex items-center gap-4 px-5 py-4 transition hover:bg-[var(--surface-2)] ${
              !isLast ? "border-b border-[var(--border)]" : ""
            }`}
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--border)] bg-white">
              <CalendarDays className="h-4 w-4 text-[var(--blue)]" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-[var(--foreground)]">
                  {season.name}
                </span>
                <code className="rounded border border-[var(--border)] bg-[var(--surface-2)] px-1.5 py-0 text-[0.65rem] font-mono text-[var(--muted)]">
                  {season.key}
                </code>
              </div>
              <p className="mt-0.5 text-xs text-[var(--muted)]">
                {formatDate(season.startDate)} – {formatDate(season.endDate)}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <AdminStatusPill
                label={season.isActive ? "Aktiv" : "Inaktiv"}
                tone={season.isActive ? "success" : "muted"}
              />

              {canManage ? (
                <ActivateSeasonButton
                  seasonId={season.id}
                  seasonName={season.name}
                  isActive={season.isActive}
                />
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
