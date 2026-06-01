"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Search,
  Building2,
  ChevronRight,
  Users,
  GitBranch,
  Layers,
} from "lucide-react";

type OrgUnitItem = {
  id: string;
  key: string;
  name: string;
  type: string;
  status: string;
  level: number;
  sortOrder: number;
  description: string | null;
  parentId: string | null;
  _count: { memberships: number; children: number };
};

type OrgUnitSearchableListProps = {
  orgUnits: OrgUnitItem[];
};

const TYPE_LABELS: Record<string, string> = {
  CLUB: "Verein",
  DIVISION: "Abteilung",
  DEPARTMENT: "Ressort",
  SUB_DEPARTMENT: "Unterressort",
  TEAM: "Mannschaft",
  COMMITTEE: "Ausschuss",
  PROJECT_GROUP: "Projektgruppe",
  CUSTOM: "Benutzerdefiniert",
};

const TYPE_COLORS: Record<string, string> = {
  CLUB: "border-blue-200 bg-blue-50 text-blue-700",
  DIVISION: "border-indigo-200 bg-indigo-50 text-indigo-700",
  DEPARTMENT: "border-violet-200 bg-violet-50 text-violet-700",
  SUB_DEPARTMENT: "border-purple-200 bg-purple-50 text-purple-700",
  TEAM: "border-emerald-200 bg-emerald-50 text-emerald-700",
  COMMITTEE: "border-amber-200 bg-amber-50 text-amber-700",
  PROJECT_GROUP: "border-orange-200 bg-orange-50 text-orange-700",
  CUSTOM: "border-slate-200 bg-slate-50 text-slate-600",
};

const STATUS_CLASSES: Record<string, string> = {
  ACTIVE: "border-emerald-200 bg-emerald-50 text-emerald-700",
  INACTIVE: "border-amber-200 bg-amber-50 text-amber-700",
  ARCHIVED: "border-slate-200 bg-slate-50 text-slate-400",
};

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Aktiv",
  INACTIVE: "Inaktiv",
  ARCHIVED: "Archiviert",
};

function TypeBadge({ type }: { type: string }) {
  const label = TYPE_LABELS[type] ?? type;
  const color = TYPE_COLORS[type] ?? TYPE_COLORS.CUSTOM;
  return (
    <span
      className={`inline-flex h-5 items-center rounded-full border px-2 text-[0.65rem] font-semibold uppercase tracking-[0.08em] ${color}`}
    >
      {label}
    </span>
  );
}

function LevelIndent({ level }: { level: number }) {
  if (level === 0) return null;
  return (
    <div className="flex flex-shrink-0 items-center">
      {Array.from({ length: level }).map((_, i) => (
        <span
          key={i}
          className={`block h-5 w-4 border-l ${i === level - 1 ? "border-[var(--border-strong)]" : "border-[var(--border)]"}`}
        />
      ))}
      <GitBranch className="h-3 w-3 text-[var(--muted)]" />
    </div>
  );
}

function EmptySearch({ query }: { query: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-14 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
        <Search className="h-5 w-5 text-slate-400" />
      </div>
      <div>
        <p className="font-semibold text-[var(--foreground)]">Keine Treffer</p>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Für &ldquo;{query}&rdquo; wurden keine Einheiten gefunden.
        </p>
      </div>
    </div>
  );
}

export default function OrgUnitSearchableList({
  orgUnits,
}: OrgUnitSearchableListProps) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return orgUnits;
    return orgUnits.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.key.toLowerCase().includes(q) ||
        (TYPE_LABELS[u.type] ?? u.type).toLowerCase().includes(q) ||
        (u.description ?? "").toLowerCase().includes(q)
    );
  }, [orgUnits, query]);

  const totalMembers = useMemo(
    () => orgUnits.reduce((sum, u) => sum + u._count.memberships, 0),
    [orgUnits]
  );
  const activeCount = orgUnits.filter((u) => u.status === "ACTIVE").length;
  const rootCount = orgUnits.filter((u) => u.level === 0).length;

  return (
    <div className="space-y-4">
      {/* KPI row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="sce-kpi-card">
          <p className="sce-data-label">Einheiten</p>
          <p
            className="mt-1.5 text-2xl font-bold text-[var(--foreground)]"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {orgUnits.length}
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            {rootCount} Haupteinheit{rootCount !== 1 ? "en" : ""}
          </p>
        </div>
        <div className="sce-kpi-card">
          <p className="sce-data-label">Aktiv</p>
          <p
            className="mt-1.5 text-2xl font-bold text-emerald-600"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {activeCount}
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">aktive Einheiten</p>
        </div>
        <div className="sce-kpi-card">
          <p className="sce-data-label">Mitglieder</p>
          <p
            className="mt-1.5 text-2xl font-bold text-[var(--blue)]"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {totalMembers}
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Mitgliedschaften total
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="sce-page-search">
        <Search className="h-4 w-4 flex-shrink-0 text-[var(--muted)]" />
        <input
          type="text"
          placeholder="Einheit suchen nach Name, Key oder Typ…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoComplete="off"
        />
        {query ? (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="flex-shrink-0 text-xs font-medium text-[var(--muted)] hover:text-[var(--foreground)]"
          >
            Löschen
          </button>
        ) : null}
      </div>

      {/* Result count */}
      {query.trim() ? (
        <p className="text-sm text-[var(--muted)]">
          {filtered.length} von {orgUnits.length} Einheiten
        </p>
      ) : null}

      {/* List */}
      {filtered.length === 0 ? (
        <EmptySearch query={query} />
      ) : (
        <div className="overflow-hidden rounded-[var(--radius-2xl)] border border-[var(--border)] bg-white shadow-[var(--shadow-sm)]">
          {filtered.map((unit, idx) => {
            const isLast = idx === filtered.length - 1;
            const statusLabel = STATUS_LABELS[unit.status] ?? unit.status;
            const statusClass =
              STATUS_CLASSES[unit.status] ?? STATUS_CLASSES.ACTIVE;
            const isSearching = query.trim().length > 0;

            return (
              <Link
                key={unit.id}
                href={`/dashboard/org-units/${unit.id}`}
                className={`group flex items-center gap-3 px-5 py-3.5 transition hover:bg-[var(--surface-2)] ${
                  !isLast ? "border-b border-[var(--border)]" : ""
                }`}
              >
                {/* Level indent (only when not searching) */}
                {!isSearching && unit.level > 0 ? (
                  <LevelIndent level={unit.level} />
                ) : null}

                {/* Icon */}
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface-2)]">
                  <Building2 className="h-4 w-4 text-[var(--blue)]" />
                </div>

                {/* Name + meta */}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-[var(--foreground)]">
                      {unit.name}
                    </span>
                    <TypeBadge type={unit.type} />
                    <code className="rounded border border-[var(--border)] bg-[var(--surface-2)] px-1.5 py-0 text-[0.65rem] font-mono text-[var(--muted)]">
                      {unit.key}
                    </code>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-3">
                    {unit._count.memberships > 0 ? (
                      <span className="flex items-center gap-1 text-xs text-[var(--muted)]">
                        <Users className="h-3 w-3" />
                        {unit._count.memberships} Mitgl.
                      </span>
                    ) : (
                      <span className="text-xs text-[var(--muted)]">
                        Keine Mitglieder
                      </span>
                    )}
                    {unit._count.children > 0 ? (
                      <span className="flex items-center gap-1 text-xs text-[var(--muted)]">
                        <Layers className="h-3 w-3" />
                        {unit._count.children} Untereinheit
                        {unit._count.children !== 1 ? "en" : ""}
                      </span>
                    ) : null}
                  </div>
                </div>

                {/* Status + chevron */}
                <div className="flex flex-shrink-0 items-center gap-2">
                  <span
                    className={`inline-flex h-5 items-center rounded-full border px-2 text-[0.65rem] font-semibold ${statusClass}`}
                  >
                    {statusLabel}
                  </span>
                  <ChevronRight className="h-4 w-4 text-[var(--muted)] transition group-hover:translate-x-0.5 group-hover:text-[var(--blue)]" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
