"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Globe, Monitor, ChevronRight } from "lucide-react";
import AdminAvatar from "@/components/admin/shared/AdminAvatar";
import AdminStatusPill from "@/components/admin/shared/AdminStatusPill";

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

type TeamsOverviewGridProps = {
  teams: TeamItem[];
  selectedSeasonName?: string;
};

const CATEGORY_CONFIG: Record<
  string,
  { label: string; accent: string; accentDot: string }
> = {
  KINDERFUSSBALL: {
    label: "Kinderfussball",
    accent: "bg-amber-50 border-amber-200",
    accentDot: "bg-amber-400",
  },
  JUNIOREN: {
    label: "Junioren",
    accent: "bg-blue-50 border-blue-200",
    accentDot: "bg-blue-500",
  },
  FRAUEN: {
    label: "Frauen",
    accent: "bg-rose-50 border-rose-200",
    accentDot: "bg-rose-500",
  },
  AKTIVE: {
    label: "Aktive",
    accent: "bg-orange-50 border-orange-200",
    accentDot: "bg-orange-500",
  },
  SENIOREN: {
    label: "Senioren",
    accent: "bg-slate-100 border-slate-200",
    accentDot: "bg-slate-500",
  },
  TRAININGSGRUPPE: {
    label: "Trainingsgruppe",
    accent: "bg-purple-50 border-purple-200",
    accentDot: "bg-purple-500",
  },
};

function getCategoryConfig(category: string) {
  return (
    CATEGORY_CONFIG[category] ?? {
      label: category,
      accent: "bg-slate-100 border-slate-200",
      accentDot: "bg-slate-400",
    }
  );
}

function VisibilityIndicator({
  label,
  active,
  icon,
}: {
  label: string;
  active: boolean;
  icon: React.ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.69rem] font-semibold ${
        active
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-slate-200 bg-slate-50 text-slate-400"
      }`}
    >
      {icon}
      {label}
    </span>
  );
}

export default function TeamsOverviewGrid({
  teams,
  selectedSeasonName,
}: TeamsOverviewGridProps) {
  const grouped = useMemo(() => {
    const map = new Map<string, TeamItem[]>();

    for (const team of teams) {
      const existing = map.get(team.category) ?? [];
      existing.push(team);
      map.set(team.category, existing);
    }

    return Array.from(map.entries()).map(([category, items]) => ({
      category,
      config: getCategoryConfig(category),
      teams: items,
      activeCount: items.filter((t) => t.isActive).length,
      withSeason: items.filter((t) => t.activeSeason !== null).length,
    }));
  }, [teams]);

  if (teams.length === 0) {
    return (
      <div className="sce-detail-section">
        <div className="sce-detail-section-body flex flex-col items-center justify-center gap-3 py-12 text-center">
          <p className="font-semibold text-[var(--foreground)]">
            Keine Teams gefunden
          </p>
          <p className="text-sm text-[var(--muted)]">
            {selectedSeasonName
              ? `Für die Saison „${selectedSeasonName}" sind noch keine Teams erfasst.`
              : "Noch keine Teams im System erfasst."}
          </p>
          <Link href="/dashboard/teams/new" className="fca-button-primary mt-2">
            Erstes Team anlegen
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {grouped.map(({ category, config, teams: categoryTeams, activeCount, withSeason }) => (
        <section key={category}>
          {/* Category header */}
          <div className="mb-4 flex items-center gap-3">
            <span className={`h-3 w-3 flex-shrink-0 rounded-full ${config.accentDot}`} />
            <h3 className="text-sm font-semibold text-[var(--foreground)]">
              {config.label}
            </h3>
            <span className="sce-count-badge">{categoryTeams.length}</span>
            {activeCount < categoryTeams.length ? (
              <span className="text-xs text-[var(--muted)]">
                · {activeCount} aktiv
              </span>
            ) : null}
            {selectedSeasonName && withSeason > 0 ? (
              <span className="text-xs text-[var(--muted)]">
                · {withSeason} in Saison
              </span>
            ) : null}
          </div>

          {/* Team cards */}
          <div className="overflow-hidden rounded-[var(--radius-2xl)] border border-[var(--border)] bg-white shadow-[var(--shadow-sm)]">
            {categoryTeams.map((team, idx) => {
              const isLast = idx === categoryTeams.length - 1;
              const displayName =
                team.activeSeason?.displayName ?? team.name;

              return (
                <Link
                  key={team.id}
                  href={`/dashboard/teams/${team.id}`}
                  className={`group flex items-center gap-4 px-5 py-4 transition hover:bg-[var(--surface-2)] ${
                    !isLast ? "border-b border-[var(--border)]" : ""
                  }`}
                >
                  {/* Team avatar */}
                  <AdminAvatar name={team.ageGroup ?? team.name} size="sm" />

                  {/* Name + meta */}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-semibold text-[var(--foreground)]">
                        {displayName}
                      </span>
                      {team.activeSeason?.seasonName ? (
                        <span className="fca-pill">
                          {team.activeSeason.seasonName}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-0.5 text-xs text-[var(--muted)]">
                      {[
                        config.label,
                        team.genderGroup,
                        team.ageGroup,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>

                  {/* Status + visibility + chevron */}
                  <div className="flex flex-shrink-0 flex-wrap items-center gap-2">
                    <AdminStatusPill
                      label={team.isActive ? "Aktiv" : "Inaktiv"}
                      tone={team.isActive ? "success" : "muted"}
                    />
                    <VisibilityIndicator
                      label="Web"
                      active={team.websiteVisible}
                      icon={<Globe className="h-3 w-3" />}
                    />
                    <VisibilityIndicator
                      label="Board"
                      active={team.infoboardVisible}
                      icon={<Monitor className="h-3 w-3" />}
                    />
                    <ChevronRight className="h-4 w-4 text-[var(--muted)] transition group-hover:translate-x-0.5 group-hover:text-[var(--blue)]" />
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
