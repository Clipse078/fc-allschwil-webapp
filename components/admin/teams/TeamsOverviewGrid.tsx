"use client";

import { useMemo, useState, useId } from "react";
import Link from "next/link";
import {
  Globe,
  Monitor,
  ChevronRight,
  Search,
  X,
  Users,
  Plus,
} from "lucide-react";
import AdminStatusPill from "@/components/admin/shared/AdminStatusPill";

// ─── Types ────────────────────────────────────────────────────────────────────

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

// ─── Category config ──────────────────────────────────────────────────────────

const CATEGORY_CONFIG: Record<
  string,
  { label: string; accent: string; dot: string; chipActive: string }
> = {
  KINDERFUSSBALL: {
    label: "Kinderfussball",
    accent: "bg-amber-50 border-amber-200",
    dot: "bg-amber-400",
    chipActive: "bg-amber-100 border-amber-300 text-amber-800",
  },
  JUNIOREN: {
    label: "Junioren",
    accent: "bg-blue-50 border-blue-200",
    dot: "bg-blue-500",
    chipActive: "bg-blue-100 border-blue-300 text-blue-800",
  },
  FRAUEN: {
    label: "Frauen",
    accent: "bg-rose-50 border-rose-200",
    dot: "bg-rose-500",
    chipActive: "bg-rose-100 border-rose-300 text-rose-800",
  },
  AKTIVE: {
    label: "Aktive",
    accent: "bg-orange-50 border-orange-200",
    dot: "bg-orange-500",
    chipActive: "bg-orange-100 border-orange-300 text-orange-800",
  },
  SENIOREN: {
    label: "Senioren",
    accent: "bg-slate-100 border-slate-200",
    dot: "bg-slate-500",
    chipActive: "bg-slate-200 border-slate-400 text-slate-800",
  },
  TRAININGSGRUPPE: {
    label: "Trainingsgruppe",
    accent: "bg-purple-50 border-purple-200",
    dot: "bg-purple-500",
    chipActive: "bg-purple-100 border-purple-300 text-purple-800",
  },
};

function getCategoryConfig(category: string) {
  return (
    CATEGORY_CONFIG[category] ?? {
      label: category,
      accent: "bg-slate-100 border-slate-200",
      dot: "bg-slate-400",
      chipActive: "bg-slate-200 border-slate-400 text-slate-800",
    }
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function VisibilityBadge({
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
      aria-label={`${label}: ${active ? "sichtbar" : "ausgeblendet"}`}
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[0.68rem] font-medium ${
        active
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-slate-200 bg-slate-50 text-slate-400"
      }`}
    >
      {icon}
      <span>{label}</span>
    </span>
  );
}

function NoSeasonBadge() {
  return (
    <span
      aria-label="Keine Saisondaten für diese Saison"
      className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[0.68rem] font-medium text-amber-700"
    >
      Keine Saison
    </span>
  );
}

// ─── Toolbar ──────────────────────────────────────────────────────────────────

type ToolbarProps = {
  searchValue: string;
  onSearchChange: (v: string) => void;
  categoryFilter: string;
  onCategoryChange: (v: string) => void;
  statusFilter: "ALL" | "ACTIVE" | "INACTIVE";
  onStatusChange: (v: "ALL" | "ACTIVE" | "INACTIVE") => void;
  visibilityFilter: "ALL" | "WEB" | "BOARD";
  onVisibilityChange: (v: "ALL" | "WEB" | "BOARD") => void;
  availableCategories: string[];
  hasActiveFilters: boolean;
  onReset: () => void;
  searchInputId: string;
};

function TeamsToolbar({
  searchValue,
  onSearchChange,
  categoryFilter,
  onCategoryChange,
  statusFilter,
  onStatusChange,
  visibilityFilter,
  onVisibilityChange,
  availableCategories,
  hasActiveFilters,
  onReset,
  searchInputId,
}: ToolbarProps) {
  return (
    <div className="rounded-[var(--radius-2xl)] border border-[var(--border)] bg-[var(--surface)] p-3 shadow-[var(--shadow-sm)]">
      <div className="flex flex-wrap items-center gap-2">
        {/* Search */}
        <div className="relative min-w-[200px] flex-1">
          <label htmlFor={searchInputId} className="sr-only">
            Teams suchen
          </label>
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]"
            aria-hidden="true"
          />
          <input
            id={searchInputId}
            type="search"
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Team suchen …"
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] py-2 pl-9 pr-3 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:border-[var(--tenant-primary)] focus:outline-none focus:ring-2 focus:ring-[color-mix(in_srgb,var(--tenant-primary)_15%,transparent)]"
            autoComplete="off"
          />
        </div>

        {/* Category filter */}
        <div>
          <label className="sr-only" htmlFor="teams-category-filter">
            Kategorie
          </label>
          <select
            id="teams-category-filter"
            value={categoryFilter}
            onChange={(e) => onCategoryChange(e.target.value)}
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] py-2 pl-3 pr-8 text-sm text-[var(--foreground)] focus:border-[var(--tenant-primary)] focus:outline-none focus:ring-2 focus:ring-[color-mix(in_srgb,var(--tenant-primary)_15%,transparent)]"
          >
            <option value="ALL">Alle Kategorien</option>
            {availableCategories.map((cat) => (
              <option key={cat} value={cat}>
                {getCategoryConfig(cat).label}
              </option>
            ))}
          </select>
        </div>

        {/* Status filter */}
        <div>
          <label className="sr-only" htmlFor="teams-status-filter">
            Status
          </label>
          <select
            id="teams-status-filter"
            value={statusFilter}
            onChange={(e) =>
              onStatusChange(e.target.value as "ALL" | "ACTIVE" | "INACTIVE")
            }
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] py-2 pl-3 pr-8 text-sm text-[var(--foreground)] focus:border-[var(--tenant-primary)] focus:outline-none focus:ring-2 focus:ring-[color-mix(in_srgb,var(--tenant-primary)_15%,transparent)]"
          >
            <option value="ALL">Alle Status</option>
            <option value="ACTIVE">Aktiv</option>
            <option value="INACTIVE">Inaktiv</option>
          </select>
        </div>

        {/* Visibility filter */}
        <div>
          <label className="sr-only" htmlFor="teams-visibility-filter">
            Sichtbarkeit
          </label>
          <select
            id="teams-visibility-filter"
            value={visibilityFilter}
            onChange={(e) =>
              onVisibilityChange(e.target.value as "ALL" | "WEB" | "BOARD")
            }
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] py-2 pl-3 pr-8 text-sm text-[var(--foreground)] focus:border-[var(--tenant-primary)] focus:outline-none focus:ring-2 focus:ring-[color-mix(in_srgb,var(--tenant-primary)_15%,transparent)]"
          >
            <option value="ALL">Alle Sichtbarkeiten</option>
            <option value="WEB">Website sichtbar</option>
            <option value="BOARD">Infoboard sichtbar</option>
          </select>
        </div>

        {/* Reset */}
        {hasActiveFilters && (
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-medium text-[var(--muted)] transition hover:border-[var(--border-strong)] hover:text-[var(--foreground)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tenant-primary)]"
            aria-label="Filter zurücksetzen"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
            Zurücksetzen
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Team row ─────────────────────────────────────────────────────────────────

function TeamRow({
  team,
  isLast,
}: {
  team: TeamItem;
  isLast: boolean;
}) {
  const config = getCategoryConfig(team.category);
  const displayName = team.activeSeason?.displayName ?? team.name;
  const classification = [team.genderGroup, team.ageGroup]
    .filter(Boolean)
    .join(" · ");

  return (
    <Link
      href={`/dashboard/teams/${team.id}`}
      className={`group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-[var(--surface-2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--tenant-primary)] ${
        !isLast ? "border-b border-[var(--border)]" : ""
      }`}
      aria-label={`${displayName} öffnen`}
    >
      {/* Category accent bar + initials */}
      <div
        className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border text-xs font-bold uppercase tracking-wide text-[var(--foreground)] ${config.accent}`}
        aria-hidden="true"
      >
        {team.ageGroup
          ? team.ageGroup.slice(0, 3)
          : team.name.slice(0, 2).toUpperCase()}
      </div>

      {/* Primary info */}
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="truncate text-sm font-semibold text-[var(--foreground)]">
            {displayName}
          </span>
          {team.activeSeason === null && (
            <NoSeasonBadge />
          )}
        </div>
        {classification && (
          <p className="mt-0.5 text-xs text-[var(--muted)]">{classification}</p>
        )}
      </div>

      {/* Right side: status + visibility + chevron */}
      <div className="flex flex-shrink-0 flex-wrap items-center gap-1.5 sm:gap-2">
        <AdminStatusPill
          label={team.isActive ? "Aktiv" : "Inaktiv"}
          tone={team.isActive ? "success" : "muted"}
        />
        <VisibilityBadge
          label="Web"
          active={team.websiteVisible}
          icon={<Globe className="h-3 w-3" aria-hidden="true" />}
        />
        <VisibilityBadge
          label="Board"
          active={team.infoboardVisible}
          icon={<Monitor className="h-3 w-3" aria-hidden="true" />}
        />
        <ChevronRight
          className="h-4 w-4 text-[var(--muted)] transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--blue)]"
          aria-hidden="true"
        />
      </div>
    </Link>
  );
}

// ─── Category group ───────────────────────────────────────────────────────────

function CategoryGroup({
  category,
  teams,
}: {
  category: string;
  teams: TeamItem[];
}) {
  const config = getCategoryConfig(category);
  const activeCount = teams.filter((t) => t.isActive).length;

  return (
    <section aria-label={config.label}>
      {/* Category header */}
      <div className="mb-3 flex items-center gap-2.5">
        <span
          className={`h-2.5 w-2.5 flex-shrink-0 rounded-full ${config.dot}`}
          aria-hidden="true"
        />
        <h3 className="text-sm font-semibold text-[var(--foreground)]">
          {config.label}
        </h3>
        <span className="sce-count-badge" aria-label={`${teams.length} Teams`}>
          {teams.length}
        </span>
        {activeCount < teams.length && (
          <span className="text-xs text-[var(--muted)]">
            · {activeCount} aktiv
          </span>
        )}
      </div>

      {/* Team rows */}
      <div className="overflow-hidden rounded-[var(--radius-2xl)] border border-[var(--border)] bg-white shadow-[var(--shadow-sm)]">
        {teams.map((team, idx) => (
          <TeamRow key={team.id} team={team} isLast={idx === teams.length - 1} />
        ))}
      </div>
    </section>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function TeamsOverviewGrid({
  teams,
  selectedSeasonName,
}: TeamsOverviewGridProps) {
  const searchId = useId();

  const [searchValue, setSearchValue] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");
  const [visibilityFilter, setVisibilityFilter] = useState<"ALL" | "WEB" | "BOARD">("ALL");

  const availableCategories = useMemo(
    () => Array.from(new Set(teams.map((t) => t.category))),
    [teams],
  );

  const filteredTeams = useMemo(() => {
    const q = searchValue.trim().toLowerCase();

    return teams.filter((team) => {
      // Search match
      if (q) {
        const displayName = (team.activeSeason?.displayName ?? "").toLowerCase();
        const shortName = (team.activeSeason?.shortName ?? "").toLowerCase();
        const match =
          team.name.toLowerCase().includes(q) ||
          displayName.includes(q) ||
          (team.ageGroup ?? "").toLowerCase().includes(q) ||
          shortName.includes(q) ||
          getCategoryConfig(team.category).label.toLowerCase().includes(q);
        if (!match) return false;
      }

      // Category
      if (categoryFilter !== "ALL" && team.category !== categoryFilter) return false;

      // Status
      if (statusFilter === "ACTIVE" && !team.isActive) return false;
      if (statusFilter === "INACTIVE" && team.isActive) return false;

      // Visibility
      if (visibilityFilter === "WEB" && !team.websiteVisible) return false;
      if (visibilityFilter === "BOARD" && !team.infoboardVisible) return false;

      return true;
    });
  }, [teams, searchValue, categoryFilter, statusFilter, visibilityFilter]);

  const hasActiveFilters =
    searchValue.trim().length > 0 ||
    categoryFilter !== "ALL" ||
    statusFilter !== "ALL" ||
    visibilityFilter !== "ALL";

  const handleReset = () => {
    setSearchValue("");
    setCategoryFilter("ALL");
    setStatusFilter("ALL");
    setVisibilityFilter("ALL");
  };

  const grouped = useMemo(() => {
    const map = new Map<string, TeamItem[]>();
    for (const team of filteredTeams) {
      const existing = map.get(team.category) ?? [];
      existing.push(team);
      map.set(team.category, existing);
    }
    return Array.from(map.entries());
  }, [filteredTeams]);

  // ── Empty: no teams at all ──────────────────────────────────────────────────
  if (teams.length === 0) {
    return (
      <div className="overflow-hidden rounded-[var(--radius-2xl)] border border-[var(--border)] bg-white shadow-[var(--shadow-sm)]">
        <div className="flex flex-col items-center gap-4 px-6 py-16 text-center">
          <div
            className="flex h-16 w-16 items-center justify-center rounded-2xl"
            style={{ background: "var(--sce-accent)", color: "var(--sce-primary)" }}
          >
            <Users className="h-8 w-8" aria-hidden="true" />
          </div>
          <div className="space-y-1.5">
            <p className="text-sm font-semibold text-[var(--foreground)]">
              Keine Teams vorhanden
            </p>
            <p className="max-w-xs text-sm text-[var(--text-2)]">
              {selectedSeasonName
                ? `Für die Saison „${selectedSeasonName}" sind noch keine Teams erfasst.`
                : "Noch keine Teams im System erfasst."}
            </p>
          </div>
          <Link href="/dashboard/teams/new" className="fca-button-primary mt-2">
            <Plus className="h-4 w-4" aria-hidden="true" />
            Erstes Team anlegen
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <TeamsToolbar
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        categoryFilter={categoryFilter}
        onCategoryChange={setCategoryFilter}
        statusFilter={statusFilter}
        onStatusChange={setStatusFilter}
        visibilityFilter={visibilityFilter}
        onVisibilityChange={setVisibilityFilter}
        availableCategories={availableCategories}
        hasActiveFilters={hasActiveFilters}
        onReset={handleReset}
        searchInputId={searchId}
      />

      {/* No filter results */}
      {filteredTeams.length === 0 ? (
        <div className="overflow-hidden rounded-[var(--radius-2xl)] border border-[var(--border)] bg-white shadow-[var(--shadow-sm)]">
          <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
            <Search
              className="h-8 w-8 text-[var(--muted)]"
              aria-hidden="true"
            />
            <div className="space-y-1">
              <p className="text-sm font-semibold text-[var(--foreground)]">
                Keine Ergebnisse
              </p>
              <p className="max-w-xs text-sm text-[var(--text-2)]">
                Für die aktiven Filter wurden keine Teams gefunden.
              </p>
            </div>
            <button
              type="button"
              onClick={handleReset}
              className="fca-button-secondary mt-1"
            >
              Filter zurücksetzen
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(([category, categoryTeams]) => (
            <CategoryGroup key={category} category={category} teams={categoryTeams} />
          ))}
        </div>
      )}
    </div>
  );
}
