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
  Archive,
} from "lucide-react";
import OrgUnitRestoreButton from "@/components/admin/org/OrgUnitRestoreButton";

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
  archivedAt: Date | null;
  _count: { memberships: number; children: number };
};

type OrgUnitSearchableListProps = {
  orgUnits: OrgUnitItem[];
  archivedOrgUnits?: OrgUnitItem[];
  showArchived?: boolean;
  canManage?: boolean;
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

function EmptyActive() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
        <Building2 className="h-6 w-6 text-slate-400" />
      </div>
      <div>
        <p className="text-base font-semibold text-[var(--foreground)]">
          Noch keine Organisationseinheiten
        </p>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Erstelle die erste Einheit, um die Organisationsstruktur aufzubauen.
        </p>
      </div>
      <Link
        href="/dashboard/org-units/new"
        className="mt-2 inline-flex items-center gap-2 rounded-[var(--radius-xl)] bg-[var(--blue)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
      >
        Erste Einheit erstellen
      </Link>
    </div>
  );
}

function EmptyArchived() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-14 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
        <Archive className="h-5 w-5 text-slate-400" />
      </div>
      <div>
        <p className="font-semibold text-[var(--foreground)]">Keine archivierten Einheiten</p>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Archivierte Einheiten werden hier angezeigt und können wiederhergestellt werden.
        </p>
      </div>
    </div>
  );
}

export default function OrgUnitSearchableList({
  orgUnits,
  archivedOrgUnits = [],
  showArchived = false,
  canManage = false,
}: OrgUnitSearchableListProps) {
  const [query, setQuery] = useState("");

  const activeFiltered = useMemo(() => {
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

  const archivedFiltered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return archivedOrgUnits;
    return archivedOrgUnits.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.key.toLowerCase().includes(q) ||
        (TYPE_LABELS[u.type] ?? u.type).toLowerCase().includes(q) ||
        (u.description ?? "").toLowerCase().includes(q)
    );
  }, [archivedOrgUnits, query]);

  const displayUnits = showArchived ? archivedFiltered : activeFiltered;
  const totalActive = orgUnits.length;
  const totalArchived = archivedOrgUnits.length;
  const totalMembers = useMemo(
    () => orgUnits.reduce((sum, u) => sum + u._count.memberships, 0),
    [orgUnits]
  );
  const activeCount = orgUnits.filter((u) => u.status === "ACTIVE").length;
  const rootCount = orgUnits.filter((u) => u.level === 0).length;

  return (
    <div className="space-y-4">
      {/* KPI row — active view only */}
      {!showArchived ? (
        <div className="grid grid-cols-3 gap-3">
          <div className="sce-kpi-card">
            <p className="sce-data-label">Einheiten</p>
            <p
              className="mt-1.5 text-2xl font-bold text-[var(--foreground)]"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {totalActive}
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
      ) : null}

      {/* View toggle (active ↔ archived) — only for managers */}
      {canManage && totalArchived > 0 ? (
        <div className="flex items-center gap-1 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1">
          <Link
            href="/dashboard/org-units"
            className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition ${
              !showArchived
                ? "bg-[var(--surface-2)] text-[var(--foreground)] font-semibold"
                : "text-[var(--muted)] hover:text-[var(--foreground)]"
            }`}
          >
            <Building2 className="h-4 w-4" />
            Aktiv
            <span className="ml-1 rounded-full bg-[var(--border)] px-1.5 py-0.5 text-[0.65rem] font-semibold text-[var(--muted)]">
              {totalActive}
            </span>
          </Link>
          <Link
            href="/dashboard/org-units?view=archived"
            className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition ${
              showArchived
                ? "bg-[var(--surface-2)] text-[var(--foreground)] font-semibold"
                : "text-[var(--muted)] hover:text-[var(--foreground)]"
            }`}
          >
            <Archive className="h-4 w-4" />
            Archiviert
            <span className="ml-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[0.65rem] font-semibold text-amber-700">
              {totalArchived}
            </span>
          </Link>
        </div>
      ) : null}

      {/* Search */}
      <div className="sce-page-search">
        <Search className="h-4 w-4 flex-shrink-0 text-[var(--muted)]" />
        <input
          type="text"
          placeholder={
            showArchived
              ? "Archivierte Einheit suchen…"
              : "Einheit suchen nach Name, Key oder Typ…"
          }
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
          {displayUnits.length} von {showArchived ? totalArchived : totalActive} Einheiten
        </p>
      ) : null}

      {/* List — active view */}
      {!showArchived ? (
        displayUnits.length === 0 && query.trim() ? (
          <EmptySearch query={query} />
        ) : displayUnits.length === 0 ? (
          <EmptyActive />
        ) : (
          <div className="overflow-hidden rounded-[var(--radius-2xl)] border border-[var(--border)] bg-white shadow-[var(--shadow-sm)]">
            {displayUnits.map((unit, idx) => {
              const isLast = idx === displayUnits.length - 1;
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
        )
      ) : null}

      {/* List — archived view */}
      {showArchived ? (
        displayUnits.length === 0 && query.trim() ? (
          <EmptySearch query={query} />
        ) : displayUnits.length === 0 ? (
          <EmptyArchived />
        ) : (
          <div className="space-y-3">
            {displayUnits.map((unit) => {
              const archivedDate = unit.archivedAt
                ? new Date(unit.archivedAt).toLocaleDateString("de-CH", {
                    day: "2-digit",
                    month: "long",
                    year: "numeric",
                  })
                : null;

              return (
                <div
                  key={unit.id}
                  className="overflow-hidden rounded-[var(--radius-2xl)] border border-[var(--border)] bg-white shadow-[var(--shadow-sm)]"
                >
                  <div className="flex items-center gap-3 px-5 py-3.5">
                    {/* Icon */}
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50">
                      <Archive className="h-4 w-4 text-slate-400" />
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
                        <span className="inline-flex h-5 items-center rounded-full border border-slate-200 bg-slate-50 px-2 text-[0.65rem] font-semibold text-slate-400">
                          Archiviert
                        </span>
                      </div>
                      {archivedDate ? (
                        <p className="mt-1 text-xs text-[var(--muted)]">
                          Archiviert am {archivedDate}
                        </p>
                      ) : (
                        <p className="mt-1 text-xs text-[var(--muted)]">
                          {unit._count.memberships > 0
                            ? `${unit._count.memberships} Mitgliedschaft${unit._count.memberships !== 1 ? "en" : ""}`
                            : "Keine Mitglieder"}
                        </p>
                      )}
                    </div>

                    {/* View link */}
                    <Link
                      href={`/dashboard/org-units/${unit.id}`}
                      className="flex-shrink-0 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-medium text-[var(--muted)] transition hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
                    >
                      Details
                    </Link>
                  </div>

                  {/* Restore action */}
                  {canManage ? (
                    <div className="border-t border-[var(--border)] px-5 py-3">
                      <OrgUnitRestoreButton
                        orgUnitId={unit.id}
                        orgUnitName={unit.name}
                        redirectToList={false}
                      />
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )
      ) : null}
    </div>
  );
}
