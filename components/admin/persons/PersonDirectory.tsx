"use client";

import { useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Search,
  Users,
  ChevronRight,
  Filter,
  X,
  Building2,
  MoreHorizontal,
  Trash2,
  UserX,
} from "lucide-react";
import AdminAvatar from "@/components/admin/shared/AdminAvatar";
import AdminStatusPill from "@/components/admin/shared/AdminStatusPill";
import { EmptyState } from "@/components/ui/page";
import { getPersonFunctionLabel } from "@/lib/people/functions";
import type { PersonDirectoryItem } from "@/lib/people/queries";
import PersonDeleteButton from "./PersonDeleteButton";

type OrgUnitOption = { id: string; name: string };
type TeamOption = { id: string; name: string; shortName?: string | null };

type PersonDirectoryProps = {
  persons: PersonDirectoryItem[];
  orgUnits: OrgUnitOption[];
  teams: TeamOption[];
  canDelete?: boolean;
  onAddPerson?: () => void;
};

type QuickFilter =
  | "alle"
  | "spieler"
  | "trainer_staff"
  | "vereinsleitung"
  | "freiwillige"
  | "ohne_zuordnung";

const QUICK_FILTERS: { key: QuickFilter; label: string }[] = [
  { key: "alle", label: "Alle" },
  { key: "spieler", label: "Spieler" },
  { key: "trainer_staff", label: "Trainer & Staff" },
  { key: "vereinsleitung", label: "Vereinsleitung" },
  { key: "freiwillige", label: "Freiwillige" },
  { key: "ohne_zuordnung", label: "Ohne Zuordnung" },
];

const FUNCTION_GROUPS: Record<string, string[]> = {
  spieler: ["SPIELER"],
  trainer_staff: ["TRAINER", "CO_TRAINER", "TORWARTTRAINER", "TEAMMANAGER", "PHYSIO"],
  vereinsleitung: ["VEREINSFUNKTIONAER", "VORSTANDSMITGLIED", "PRAESIDENT", "VIZEPRAESIDENT", "KOORDINATOR"],
  freiwillige: ["FREIWILLIGER"],
};

function matchesQuickFilter(person: PersonDirectoryItem, filter: QuickFilter): boolean {
  if (filter === "alle") return true;
  if (filter === "ohne_zuordnung") {
    return person.assignments.length === 0;
  }
  const keys = FUNCTION_GROUPS[filter] ?? [];
  return person.assignments.some(
    (a) => a.status === "ACTIVE" && a.functionKey && keys.includes(a.functionKey),
  );
}

function PersonFunctionChip({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded-full bg-[var(--sce-accent)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--sce-primary)]">
      {label}
    </span>
  );
}

function AssignmentTag({
  assignment,
}: {
  assignment: PersonDirectoryItem["assignments"][number];
}) {
  const label = assignment.team?.shortName ?? assignment.team?.name ?? assignment.orgUnit?.name ?? "";
  if (!label) return null;
  return (
    <span className="inline-flex items-center rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--text-2)]">
      {label}
    </span>
  );
}

export default function PersonDirectory({
  persons,
  orgUnits,
  teams,
  canDelete = false,
  onAddPerson,
}: PersonDirectoryProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("alle");
  const [filterOrgUnitId, setFilterOrgUnitId] = useState<string>("");
  const [filterTeamId, setFilterTeamId] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<"" | "active" | "inactive">("");
  const [showFilters, setShowFilters] = useState(false);
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const hasActiveFilters =
    filterOrgUnitId !== "" || filterTeamId !== "" || filterStatus !== "";

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    return persons.filter((p) => {
      if (deletedIds.has(p.id)) return false;
      // Text search
      if (q) {
        const fullName = p.name.toLowerCase();
        const email = (p.email ?? "").toLowerCase();
        if (!fullName.includes(q) && !email.includes(q)) return false;
      }

      // Quick filter
      if (!matchesQuickFilter(p, quickFilter)) return false;

      // OrgUnit filter
      if (filterOrgUnitId) {
        const hasOrgUnit = p.assignments.some(
          (a) => a.orgUnit?.id === filterOrgUnitId,
        );
        if (!hasOrgUnit) return false;
      }

      // Team filter
      if (filterTeamId) {
        const hasTeam = p.assignments.some((a) => a.team?.id === filterTeamId);
        if (!hasTeam) return false;
      }

      // Status filter
      if (filterStatus === "active" && !p.isActive) return false;
      if (filterStatus === "inactive" && p.isActive !== false) return false;

      return true;
    });
  }, [persons, query, quickFilter, filterOrgUnitId, filterTeamId, filterStatus, deletedIds]);

  const clearFilters = useCallback(() => {
    setFilterOrgUnitId("");
    setFilterTeamId("");
    setFilterStatus("");
  }, []);

  const activeCount = persons.filter((p) => p.isActive !== false).length;
  const assignedCount = persons.filter((p) => p.assignments.length > 0).length;

  return (
    <div className="space-y-5">
      {/* KPI row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="sce-kpi-card">
          <p className="sce-data-label">Gesamt</p>
          <p
            className="mt-1.5 text-2xl font-bold text-[var(--foreground)]"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {persons.length}
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">Personen</p>
        </div>
        <div className="sce-kpi-card">
          <p className="sce-data-label">Aktiv</p>
          <p
            className="mt-1.5 text-2xl font-bold text-emerald-600"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {activeCount}
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">aktive Einträge</p>
        </div>
        <div className="sce-kpi-card">
          <p className="sce-data-label">Zugeordnet</p>
          <p
            className="mt-1.5 text-2xl font-bold text-[var(--blue)]"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {assignedCount}
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">mit Zuordnung</p>
        </div>
      </div>

      {/* Search + filter row */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="sce-page-search flex-1">
          <Search className="h-4 w-4 flex-shrink-0 text-[var(--muted)]" />
          <input
            type="text"
            placeholder="Name oder E-Mail suchen…"
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
        <button
          type="button"
          onClick={() => setShowFilters((v) => !v)}
          className={`inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-sm font-medium transition ${
            showFilters || hasActiveFilters
              ? "border-[var(--sce-primary)] bg-[var(--sce-accent)] text-[var(--sce-primary)]"
              : "border-[var(--border)] bg-[var(--surface)] text-[var(--text-2)] hover:bg-[var(--surface-2)]"
          }`}
        >
          <Filter className="h-4 w-4" />
          Filter
          {hasActiveFilters ? (
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[var(--sce-primary)] text-[9px] font-bold text-white">
              {[filterOrgUnitId, filterTeamId, filterStatus].filter(Boolean).length}
            </span>
          ) : null}
        </button>
      </div>

      {/* Filter panel */}
      {showFilters ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="fca-label block">Organisationseinheit</label>
              <select
                value={filterOrgUnitId}
                onChange={(e) => setFilterOrgUnitId(e.target.value)}
                className="fca-input"
              >
                <option value="">Alle</option>
                {orgUnits.map((ou) => (
                  <option key={ou.id} value={ou.id}>
                    {ou.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="fca-label block">Team</label>
              <select
                value={filterTeamId}
                onChange={(e) => setFilterTeamId(e.target.value)}
                className="fca-input"
              >
                <option value="">Alle</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.shortName ?? t.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="fca-label block">Status</label>
              <select
                value={filterStatus}
                onChange={(e) =>
                  setFilterStatus(e.target.value as "" | "active" | "inactive")
                }
                className="fca-input"
              >
                <option value="">Alle</option>
                <option value="active">Aktiv</option>
                <option value="inactive">Inaktiv</option>
              </select>
            </div>
          </div>
          {hasActiveFilters ? (
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--muted)] hover:text-[var(--foreground)]"
              >
                <X className="h-3.5 w-3.5" />
                Filter zurücksetzen
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Quick filter chips */}
      <div className="flex flex-wrap gap-2">
        {QUICK_FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setQuickFilter(f.key)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
              quickFilter === f.key
                ? "bg-[var(--sce-primary)] text-white shadow-sm"
                : "bg-[var(--surface-2)] text-[var(--text-2)] hover:bg-[var(--surface-3)] hover:text-[var(--foreground)]"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Result count */}
      {(query.trim() || quickFilter !== "alle" || hasActiveFilters) ? (
        <p className="text-sm text-[var(--muted)]">
          {filtered.length} von {persons.length}{" "}
          {persons.length === 1 ? "Person" : "Personen"}
        </p>
      ) : null}

      {/* List */}
      {persons.length === 0 ? (
        <EmptyState
          icon={<Users className="h-10 w-10" />}
          heading="Noch keine Personen erfasst"
          description="Erfasse Spieler/innen, Trainer/innen, Funktionäre und weitere Personen und ordne sie direkt deiner Vereinsorganisation zu."
          action={
            onAddPerson ? (
              <button
                type="button"
                onClick={onAddPerson}
                className="fca-button-primary"
              >
                + Erste Person hinzufügen
              </button>
            ) : (
              <Link href="/dashboard/persons/new" className="fca-button-primary">
                + Erste Person hinzufügen
              </Link>
            )
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<UserX className="h-10 w-10" />}
          heading="Keine Treffer"
          description="Passe die Suche oder die Filter an."
        />
      ) : (
        <div className="overflow-hidden rounded-[var(--radius-2xl)] border border-[var(--border)] bg-white shadow-[var(--shadow-sm)]">
          {filtered.map((person, idx) => {
            const isLast = idx === filtered.length - 1;
            const activeAssignments = person.assignments.filter(
              (a) => a.status === "ACTIVE",
            );
            const functions = [
              ...new Set(
                activeAssignments
                  .filter((a) => a.functionKey)
                  .map((a) => getPersonFunctionLabel(a.functionKey)),
              ),
            ];
            const teamTags = activeAssignments
              .filter((a) => a.team)
              .slice(0, 3);
            const orgNames = [
              ...new Set(
                activeAssignments
                  .filter((a) => a.orgUnit && !a.team)
                  .map((a) => a.orgUnit!.name),
              ),
            ].slice(0, 2);

            return (
              <div
                key={person.id}
                className={`group flex items-center gap-4 px-5 py-4 transition hover:bg-[var(--surface-2)] ${
                  !isLast ? "border-b border-[var(--border)]" : ""
                }`}
              >
                {/* Clickable row area (navigates to detail) */}
                <Link
                  href={`/dashboard/persons/${person.id}`}
                  className="flex min-w-0 flex-1 items-center gap-4"
                >
                  {/* Avatar */}
                  <AdminAvatar
                    name={person.name}
                    imageSrc={person.imageUrl}
                    size="sm"
                  />

                  {/* Name + functions + teams */}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-semibold text-[var(--foreground)]">
                        {person.name}
                      </span>
                      {functions.length > 0 ? (
                        functions.slice(0, 2).map((fn) => (
                          <PersonFunctionChip key={fn} label={fn} />
                        ))
                      ) : (
                        <span className="text-xs text-[var(--muted)]">
                          Keine Zuordnung
                        </span>
                      )}
                    </div>

                    {/* Team tags + org names */}
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      {teamTags.map((a) => (
                        <AssignmentTag key={a.id} assignment={a} />
                      ))}
                      {orgNames.map((n) => (
                        <span
                          key={n}
                          className="inline-flex items-center gap-1 text-[10px] text-[var(--muted)]"
                        >
                          <Building2 className="h-3 w-3" />
                          {n}
                        </span>
                      ))}
                      {person.email && !teamTags.length && !orgNames.length ? (
                        <span className="truncate text-[10px] text-[var(--muted)]">
                          {person.email}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </Link>

                {/* Right: status + chevron + optional ••• menu */}
                <div className="flex flex-shrink-0 items-center gap-2">
                  {!person.isActive ? (
                    <AdminStatusPill label="Inaktiv" tone="muted" />
                  ) : null}
                  <ChevronRight className="h-4 w-4 text-[var(--muted)] transition group-hover:translate-x-0.5 group-hover:text-[var(--blue)]" />
                  {canDelete && (
                    <div className="relative">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenMenuId(openMenuId === person.id ? null : person.id);
                        }}
                        className="flex h-7 w-7 items-center justify-center rounded text-[var(--muted)] hover:bg-[var(--surface-3)] hover:text-[var(--foreground)]"
                        aria-label="Mehr Optionen"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                      {openMenuId === person.id && (
                        <>
                          <div
                            className="fixed inset-0 z-10"
                            onClick={() => setOpenMenuId(null)}
                          />
                          <div className="absolute right-0 top-8 z-20 min-w-[190px] rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] py-1 shadow-lg">
                            <PersonDeleteButton
                              personId={person.id}
                              personName={person.name}
                              onSuccess={() => {
                                setOpenMenuId(null);
                                setDeletedIds((prev) => new Set([...prev, person.id]));
                                router.refresh();
                              }}
                              renderTrigger={({ onClick }) => (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setOpenMenuId(null);
                                    onClick();
                                  }}
                                  className="flex w-full items-center gap-2.5 px-3.5 py-2 text-[0.8rem] text-red-600 hover:bg-red-50"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                  Endgültig löschen
                                </button>
                              )}
                            />
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Extra spacing */}
      {filtered.length > 0 ? (
        <p className="text-center text-xs text-[var(--muted)]">
          {filtered.length}{" "}
          {filtered.length === 1 ? "Person" : "Personen"} angezeigt
        </p>
      ) : null}
    </div>
  );
}
