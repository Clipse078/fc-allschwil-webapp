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
import { Badge } from "@/components/ui";
import { EmptyState } from "@/components/ui/page";
import { buttonVariants } from "@/components/ui/Button";
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

function TypeBadge({ type }: { type: string }) {
  const label = TYPE_LABELS[type] ?? type;
  return (
    <Badge variant="outline" size="sm">
      {label}
    </Badge>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: "success" | "warning" | "default" }> = {
    ACTIVE:   { label: "Aktiv",       variant: "success" },
    INACTIVE: { label: "Inaktiv",     variant: "warning" },
    ARCHIVED: { label: "Archiviert",  variant: "default" },
  };
  const { label, variant } = map[status] ?? map.ACTIVE;
  return <Badge variant={variant} size="sm">{label}</Badge>;
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
            <p className="mt-1.5 text-2xl font-bold text-[var(--foreground)]">
              {totalActive}
            </p>
            <p className="mt-1 text-xs text-[var(--muted)]">
              {rootCount} Haupteinheit{rootCount !== 1 ? "en" : ""}
            </p>
          </div>
          <div className="sce-kpi-card">
            <p className="sce-data-label">Aktiv</p>
            <p className="mt-1.5 text-2xl font-bold text-[var(--sce-success)]">
              {activeCount}
            </p>
            <p className="mt-1 text-xs text-[var(--muted)]">aktive Einheiten</p>
          </div>
          <div className="sce-kpi-card">
            <p className="sce-data-label">Mitglieder</p>
            <p className="mt-1.5 text-2xl font-bold text-[var(--sce-primary)]">
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
            <span className="ml-1 rounded-full bg-[var(--surface-2)] border border-[var(--border)] px-1.5 py-0.5 text-[0.65rem] font-semibold text-[var(--text-2)]">
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
            <span className="ml-1 rounded-full bg-[var(--sce-warning-light)] px-1.5 py-0.5 text-[0.65rem] font-semibold text-[var(--sce-warning)]">
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
          <EmptyState
            icon={<Search className="h-10 w-10" />}
            heading="Keine Treffer"
            description={`Für „${query}" wurden keine Einheiten gefunden.`}
          />
        ) : displayUnits.length === 0 ? (
          <EmptyState
            icon={<Building2 className="h-10 w-10" />}
            heading="Noch keine Organisationseinheiten"
            description="Erstelle die erste Einheit, um die Organisationsstruktur aufzubauen."
            action={
              <Link
                href="/dashboard/org-units/new"
                className={buttonVariants({ variant: "primary" })}
              >
                Erste Einheit erstellen
              </Link>
            }
          />
        ) : (
          <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-sm">
            {displayUnits.map((unit, idx) => {
              const isLast = idx === displayUnits.length - 1;
              const isSearching = query.trim().length > 0;

              return (
                <Link
                  key={unit.id}
                  href={`/dashboard/org-units/${unit.id}`}
                  className={`group flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-[var(--surface-2)] ${
                    !isLast ? "border-b border-[var(--border)]" : ""
                  }`}
                >
                  {/* Level indent (only when not searching) */}
                  {!isSearching && unit.level > 0 ? (
                    <LevelIndent level={unit.level} />
                  ) : null}

                  {/* Icon */}
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface-2)]">
                    <Building2 className="h-4 w-4 text-[var(--sce-primary)]" />
                  </div>

                  {/* Name + meta */}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-[var(--foreground)]">
                        {unit.name}
                      </span>
                      <TypeBadge type={unit.type} />
                      <code className="rounded border border-[var(--border)] bg-[var(--surface-2)] px-1.5 py-px text-[0.65rem] font-mono text-[var(--muted)]">
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
                    <StatusBadge status={unit.status} />
                    <ChevronRight className="h-4 w-4 text-[var(--muted)] transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--sce-primary)]" />
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
          <EmptyState
            icon={<Search className="h-10 w-10" />}
            heading="Keine Treffer"
            description={`Für „${query}" wurden keine archivierten Einheiten gefunden.`}
          />
        ) : displayUnits.length === 0 ? (
          <EmptyState
            icon={<Archive className="h-10 w-10" />}
            heading="Keine archivierten Einheiten"
            description="Archivierte Einheiten werden hier angezeigt und können wiederhergestellt werden."
          />
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
                  className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-sm"
                >
                  <div className="flex items-center gap-3 px-5 py-3.5">
                    {/* Icon */}
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface-2)]">
                      <Archive className="h-4 w-4 text-[var(--muted)]" />
                    </div>

                    {/* Name + meta */}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-[var(--foreground)]">
                          {unit.name}
                        </span>
                        <TypeBadge type={unit.type} />
                        <code className="rounded border border-[var(--border)] bg-[var(--surface-2)] px-1.5 py-px text-[0.65rem] font-mono text-[var(--muted)]">
                          {unit.key}
                        </code>
                        <Badge variant="default" size="sm">Archiviert</Badge>
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
                      className={buttonVariants({ variant: "secondary", size: "sm" })}
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
