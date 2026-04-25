"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import AdminListItem from "@/components/admin/shared/AdminListItem";
import AdminStatusPill from "@/components/admin/shared/AdminStatusPill";
import AdminSurfaceCard from "@/components/admin/shared/AdminSurfaceCard";

type TeamItem = {
  id: string;
  name: string;
  slug: string;
  category: string;
  genderGroup: string | null;
  ageGroup: string | null;
  sortOrder: number;
  isActive: boolean;
  websiteVisible: boolean;
  infoboardVisible: boolean;
  activeSeason: {
    seasonKey: string;
    seasonName: string;
    displayName: string;
    shortName: string | null;
    status: string;
  } | null;
};

type TeamsTableProps = {
  initialTeams: TeamItem[];
};

const CATEGORY_LABELS: Record<string, string> = {
  KINDERFUSSBALL: "Kinderfussball",
  JUNIOREN: "Junioren",
  AKTIVE: "Aktive",
  FRAUEN: "Frauen",
  SENIOREN: "Senioren",
  TRAININGSGRUPPE: "Trainingsgruppe",
};

function getCategoryLabel(category: string) {
  return CATEGORY_LABELS[category] ?? category;
}

function getTeamHref(team: TeamItem) {
  if (team.activeSeason?.seasonKey && team.slug) {
    return `/dashboard/seasons/${team.activeSeason.seasonKey}/teams/${team.slug}`;
  }

  return `/dashboard/teams/${team.id}`;
}

export default function TeamsTable({ initialTeams }: TeamsTableProps) {
  const [categoryFilter, setCategoryFilter] = useState("ALL");

  const categoryOptions = useMemo(() => {
    return Array.from(new Set(initialTeams.map((team) => team.category)));
  }, [initialTeams]);

  const filteredTeams = useMemo(() => {
    if (categoryFilter === "ALL") {
      return initialTeams;
    }

    return initialTeams.filter((team) => team.category === categoryFilter);
  }, [initialTeams, categoryFilter]);

  return (
    <div className="space-y-4">
      <AdminSurfaceCard className="p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="fca-eyebrow">Filter</p>
            <h3 className="fca-subheading mt-2">Teams nach Kategorie</h3>
            <p className="mt-3 text-sm text-slate-600">
              Premium Übersicht für alle FCA Teams mit Sichtbarkeiten, aktiver Saison und Schnellzugriff.
            </p>
          </div>

          <div className="flex flex-col gap-3 md:flex-row md:items-end">
            <label className="block space-y-2 md:w-[260px]">
              <span className="fca-label">Kategorie</span>
              <select
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value)}
                className="fca-select"
              >
                <option value="ALL">Alle Kategorien</option>
                {categoryOptions.map((category) => (
                  <option key={category} value={category}>
                    {getCategoryLabel(category)}
                  </option>
                ))}
              </select>
            </label>

            <Link href="/dashboard/teams/new" className="fca-button-primary">
              Neues Team
            </Link>
          </div>
        </div>
      </AdminSurfaceCard>

      {filteredTeams.length === 0 ? (
        <AdminSurfaceCard className="p-6">
          <p className="text-sm text-slate-600">
            Keine Teams für den aktuellen Filter gefunden.
          </p>
        </AdminSurfaceCard>
      ) : (
        <div className="space-y-4">
          {filteredTeams.map((team) => (
            <AdminListItem
              key={team.id}
              avatar={
                <div className="flex h-14 w-14 items-center justify-center rounded-full border border-slate-200 bg-gradient-to-br from-white to-slate-100 font-[var(--font-display)] text-sm font-bold uppercase tracking-[0.08em] text-[#0b4aa2] shadow-sm">
                  {team.ageGroup ?? "FCA"}
                </div>
              }
              title={team.activeSeason?.displayName ?? team.name}
              subtitle={[
                getCategoryLabel(team.category),
                team.genderGroup ?? null,
                team.ageGroup ?? null,
                team.activeSeason?.seasonName ?? null,
              ]
                .filter(Boolean)
                .join(" • ")}
              meta={
                <>
                  <AdminStatusPill
                    label={team.isActive ? "Aktiv" : "Inaktiv"}
                    tone={team.isActive ? "success" : "muted"}
                  />
                  <span className="fca-pill">
                    Website: {team.websiteVisible ? "An" : "Aus"}
                  </span>
                  <span className="fca-pill">
                    Infoboard: {team.infoboardVisible ? "An" : "Aus"}
                  </span>
                  {team.activeSeason?.status ? (
                    <span className="fca-pill">
                      Saisonstatus: {team.activeSeason.status}
                    </span>
                  ) : null}
                </>
              }
              actions={
                <Link href={getTeamHref(team)} className="fca-button-primary">
                  Öffnen
                </Link>
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
