"use client";

/**
 * components/admin/registrations/WaitingListWorkspace.tsx
 *
 * REG-WAIT-01D: Premium operational Warteliste cockpit.
 */

import { useMemo, useState } from "react";
import {
  Archive,
  CheckCircle2,
  ClipboardList,
  Clock,
  Filter,
  Flag,
  Search,
  UserCheck,
  X,
} from "lucide-react";
import { cn } from "@/lib/cn";
import type { WaitingListEntryItem } from "@/lib/registrations/waiting-list-queries";
import type { AssignableUser } from "@/lib/registrations/workflow-types";
import {
  ACTIVE_WAITING_LIST_STATUSES,
  WAITING_LIST_PRIORITY_DOT,
  WAITING_LIST_PRIORITY_LABELS,
  WAITING_LIST_STATUS_COLORS,
  WAITING_LIST_STATUS_LABELS,
  formatWaitingListDate,
  getWaitingListNextStep,
  waitingListDuration,
} from "@/lib/registrations/waiting-list-ui";
import {
  WaitingListCoordinatorFilter,
  WaitingListResponsibleDisplay,
} from "./WaitingListCoordinatorPicker";
import { WaitingListDetailDrawer } from "./WaitingListDetailDrawer";
import type { WaitingListPriority, WaitingListScopeType, WaitingListStatus } from "@prisma/client";

type Props = {
  tenantSlug: string;
  initialEntries: WaitingListEntryItem[];
  canEdit: boolean;
  canDelete: boolean;
  eligibleCoordinators: AssignableUser[];
  currentUserId: string | null;
};

function MetricCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Clock;
  label: string;
  value: number;
  tone: "amber" | "blue" | "purple" | "emerald" | "slate" | "rose";
}) {
  const toneClass: Record<typeof tone, string> = {
    amber: "text-amber-600",
    blue: "text-[var(--blue)]",
    purple: "text-purple-600",
    emerald: "text-emerald-600",
    slate: "text-slate-600",
    rose: "text-rose-600",
  };

  return (
    <div className="sce-kpi-card">
      <p className="sce-data-label flex items-center gap-1.5">
        <Icon className="h-3 w-3" aria-hidden />
        {label}
      </p>
      <p
        className={cn("mt-1.5 text-2xl font-bold", toneClass[tone])}
        style={{ fontFamily: "var(--font-display)" }}
      >
        {value}
      </p>
    </div>
  );
}

function FilterChip({
  label,
  onRemove,
}: {
  label: string;
  onRemove: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onRemove}
      className="inline-flex items-center gap-1 rounded-full border border-[var(--border-strong)] bg-[var(--surface-2)] px-2.5 py-1 text-[0.68rem] font-medium text-[var(--text-2)] hover:bg-[var(--surface-3)]"
    >
      {label}
      <X className="h-3 w-3" aria-hidden />
    </button>
  );
}

export function WaitingListWorkspace({
  tenantSlug,
  initialEntries,
  canEdit,
  canDelete,
  eligibleCoordinators,
  currentUserId,
}: Props) {
  const [entries, setEntries] = useState<WaitingListEntryItem[]>(initialEntries);
  const [selectedEntry, setSelectedEntry] = useState<WaitingListEntryItem | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"active" | "all" | WaitingListStatus>("active");
  const [priorityFilter, setPriorityFilter] = useState<WaitingListPriority | "">("");
  const [scopeFilter, setScopeFilter] = useState<WaitingListScopeType | "">("");
  const [responsibleFilter, setResponsibleFilter] = useState<string>("");

  const metrics = useMemo(() => {
    return {
      waiting: entries.filter((entry) => entry.status === "WAITING").length,
      contacted: entries.filter((entry) => entry.status === "CONTACTED").length,
      offered: entries.filter((entry) => entry.status === "OFFERED").length,
      placed: entries.filter((entry) => entry.status === "PLACED").length,
      ended: entries.filter((entry) => ["WITHDRAWN", "REJECTED"].includes(entry.status)).length,
      archived: entries.filter((entry) => entry.status === "ARCHIVED").length,
    };
  }, [entries]);

  const filtered = useMemo(() => {
    let result = entries;

    if (statusFilter === "active") {
      result = result.filter((entry) => ACTIVE_WAITING_LIST_STATUSES.includes(entry.status));
    } else if (statusFilter !== "all") {
      result = result.filter((entry) => entry.status === statusFilter);
    }

    if (priorityFilter) {
      result = result.filter((entry) => entry.priority === priorityFilter);
    }

    if (scopeFilter) {
      result = result.filter((entry) => entry.scopeType === scopeFilter);
    }

    if (responsibleFilter) {
      result = result.filter((entry) => entry.responsibleUserId === responsibleFilter);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((entry) => {
        const name = `${entry.registration.firstName} ${entry.registration.lastName}`.toLowerCase();
        const personName = entry.person
          ? `${entry.person.firstName} ${entry.person.lastName}`.toLowerCase()
          : "";
        const email = entry.registration.email.toLowerCase();
        return name.includes(q) || personName.includes(q) || email.includes(q);
      });
    }

    return result;
  }, [entries, statusFilter, priorityFilter, scopeFilter, responsibleFilter, search]);

  const scopeLabel = (entry: WaitingListEntryItem) =>
    entry.targetGroup?.name ??
    entry.orgUnit?.name ??
    (entry.teamSeason
      ? `${entry.teamSeason.team.name} — ${entry.teamSeason.displayName}`
      : "—");

const SCOPE_TYPE_LABELS: Record<WaitingListScopeType, string> = {
  TARGET_GROUP: "Zielgruppe",
  ORG_UNIT: "Abteilung",
  TEAM_SEASON: "Team",
};

function scopeTypeLabel(entry: Pick<WaitingListEntryItem, "scopeType">) {
  return SCOPE_TYPE_LABELS[entry.scopeType];
}

  const personName = (entry: WaitingListEntryItem) =>
    entry.person
      ? entry.person.displayName || `${entry.person.firstName} ${entry.person.lastName}`
      : `${entry.registration.firstName} ${entry.registration.lastName}`;

  const birthYear = (entry: WaitingListEntryItem) =>
    entry.person?.dateOfBirth
      ? new Date(entry.person.dateOfBirth).getFullYear()
      : entry.registration.birthYear;

  const handleUpdate = (updated: WaitingListEntryItem) => {
    setEntries((prev) => prev.map((entry) => (entry.id === updated.id ? updated : entry)));
    setSelectedEntry(updated);
  };

  const handleDelete = () => {
    setEntries((prev) => prev.filter((entry) => entry.id !== selectedEntry?.id));
    setSelectedEntry(null);
  };

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("active");
    setPriorityFilter("");
    setScopeFilter("");
    setResponsibleFilter("");
  };

  const hasActiveFilters = Boolean(
    search.trim() ||
      statusFilter !== "active" ||
      priorityFilter ||
      scopeFilter ||
      responsibleFilter,
  );

  const activeFilterChips = [
    statusFilter !== "active"
      ? {
          key: "status",
          label:
            statusFilter === "all"
              ? "Status: Alle"
              : `Status: ${WAITING_LIST_STATUS_LABELS[statusFilter as WaitingListStatus]}`,
          onRemove: () => setStatusFilter("active"),
        }
      : null,
    priorityFilter
      ? {
          key: "priority",
          label: `Priorität: ${WAITING_LIST_PRIORITY_LABELS[priorityFilter]}`,
          onRemove: () => setPriorityFilter(""),
        }
      : null,
    scopeFilter
      ? {
          key: "scope",
          label: `Ebene: ${SCOPE_TYPE_LABELS[scopeFilter]}`,
          onRemove: () => setScopeFilter(""),
        }
      : null,
    responsibleFilter
      ? {
          key: "responsible",
          label:
            responsibleFilter === currentUserId
              ? "Mir zugewiesen"
              : `Koordinator: ${
                  eligibleCoordinators.find((user) => user.id === responsibleFilter)?.firstName ?? ""
                } ${
                  eligibleCoordinators.find((user) => user.id === responsibleFilter)?.lastName ?? ""
                }`.trim(),
          onRemove: () => setResponsibleFilter(""),
        }
      : null,
    search.trim()
      ? {
          key: "search",
          label: `Suche: ${search.trim()}`,
          onRemove: () => setSearch(""),
        }
      : null,
  ].filter(Boolean) as { key: string; label: string; onRemove: () => void }[];

  return (
    <div className="flex h-full min-h-0">
      <div
        className={cn(
          "flex min-w-0 flex-1 flex-col transition-all",
          selectedEntry ? "hidden lg:flex" : "flex",
        )}
      >
        <div className="border-b border-[var(--border)] bg-white px-6 py-4">
          <div className="mb-4">
            <h1
              className="flex items-center gap-2 text-xl font-bold text-[var(--foreground)]"
              style={{ fontFamily: "var(--font-display)" }}
            >
              <ClipboardList className="h-5 w-5 text-[var(--tenant-primary)]" aria-hidden />
              Warteliste
            </h1>
            <p className="mt-0.5 text-sm text-[var(--muted)]">
              Übersicht und Verwaltung der Wartelisten-Einträge
            </p>
          </div>

          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
            <MetricCard icon={Clock} label="Wartend" value={metrics.waiting} tone="amber" />
            <MetricCard icon={UserCheck} label="Kontaktiert" value={metrics.contacted} tone="blue" />
            <MetricCard icon={Flag} label="Angebot gemacht" value={metrics.offered} tone="purple" />
            <MetricCard icon={CheckCircle2} label="Platziert" value={metrics.placed} tone="emerald" />
            <MetricCard icon={X} label="Abgesagt / beendet" value={metrics.ended} tone="rose" />
            <MetricCard icon={Archive} label="Archiviert" value={metrics.archived} tone="slate" />
          </div>

          <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-2)] p-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-[220px] flex-1">
                <Search
                  className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--muted)]"
                  aria-hidden
                />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Name, E-Mail suchen…"
                  className="fca-input h-8 w-full pl-8 text-xs"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
                className="fca-select h-8 min-w-[150px] text-xs"
              >
                <option value="active">Aktive Einträge</option>
                <option value="all">Alle Status</option>
                {(Object.entries(WAITING_LIST_STATUS_LABELS) as [WaitingListStatus, string][]).map(
                  ([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ),
                )}
              </select>

              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value as WaitingListPriority | "")}
                className="fca-select h-8 min-w-[130px] text-xs"
              >
                <option value="">Alle Prioritäten</option>
                {(Object.entries(WAITING_LIST_PRIORITY_LABELS) as [WaitingListPriority, string][]).map(
                  ([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ),
                )}
              </select>

              <select
                value={scopeFilter}
                onChange={(e) => setScopeFilter(e.target.value as WaitingListScopeType | "")}
                className="fca-select h-8 min-w-[130px] text-xs"
              >
                <option value="">Alle Ebenen</option>
                <option value="TARGET_GROUP">Zielgruppe</option>
                <option value="ORG_UNIT">Abteilung</option>
                <option value="TEAM_SEASON">Team / Saison</option>
              </select>

              <WaitingListCoordinatorFilter
                eligibleCoordinators={eligibleCoordinators}
                value={responsibleFilter}
                onChange={setResponsibleFilter}
                currentUserId={currentUserId}
              />

              {hasActiveFilters ? (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="inline-flex h-8 items-center gap-1 rounded-lg border border-[var(--border)] bg-white px-2.5 text-xs text-[var(--muted)] hover:bg-white hover:text-[var(--foreground)]"
                >
                  <X className="h-3 w-3" aria-hidden />
                  Zurücksetzen
                </button>
              ) : null}
            </div>

            {activeFilterChips.length > 0 ? (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="text-[0.68rem] font-semibold uppercase tracking-wide text-[var(--muted)]">
                  Aktive Filter
                </span>
                {activeFilterChips.map((chip) => (
                  <FilterChip key={chip.key} label={chip.label} onRemove={chip.onRemove} />
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 px-6 py-20 text-center">
              {entries.length === 0 ? (
                <>
                  <ClipboardList className="h-10 w-10 text-[var(--muted)]" aria-hidden />
                  <div>
                    <p className="font-semibold text-[var(--foreground)]">Warteliste ist leer</p>
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      Anmeldungen können über den Workflow-Bereich auf die Warteliste gesetzt werden.
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <Filter className="h-8 w-8 text-[var(--muted)]" aria-hidden />
                  <div>
                    <p className="font-semibold text-[var(--foreground)]">Keine Einträge gefunden</p>
                    <p className="mt-1 text-sm text-[var(--muted)]">Bitte Filter anpassen.</p>
                  </div>
                </>
              )}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 border-b border-[var(--border)] bg-[var(--surface-2)]">
                <tr>
                  <th className="px-4 py-2.5 text-left text-[0.68rem] font-semibold uppercase tracking-wider text-[var(--muted)]">
                    Bewerber/in
                  </th>
                  <th className="px-4 py-2.5 text-left text-[0.68rem] font-semibold uppercase tracking-wider text-[var(--muted)]">
                    Typ / Jg.
                  </th>
                  <th className="px-4 py-2.5 text-left text-[0.68rem] font-semibold uppercase tracking-wider text-[var(--muted)]">
                    Scope / Ziel
                  </th>
                  <th className="px-4 py-2.5 text-left text-[0.68rem] font-semibold uppercase tracking-wider text-[var(--muted)]">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" aria-hidden /> Seit
                    </span>
                  </th>
                  <th className="px-4 py-2.5 text-left text-[0.68rem] font-semibold uppercase tracking-wider text-[var(--muted)]">
                    Priorität
                  </th>
                  <th className="px-4 py-2.5 text-left text-[0.68rem] font-semibold uppercase tracking-wider text-[var(--muted)]">
                    <span className="flex items-center gap-1">
                      <UserCheck className="h-3 w-3" aria-hidden /> Verantwortlich
                    </span>
                  </th>
                  <th className="px-4 py-2.5 text-left text-[0.68rem] font-semibold uppercase tracking-wider text-[var(--muted)]">
                    Status
                  </th>
                  <th className="px-4 py-2.5 text-left text-[0.68rem] font-semibold uppercase tracking-wider text-[var(--muted)]">
                    Nächster Schritt
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {filtered.map((entry) => {
                  const isSelected = selectedEntry?.id === entry.id;
                  return (
                    <tr
                      key={entry.id}
                      onClick={() => setSelectedEntry(entry)}
                      className={cn(
                        "cursor-pointer transition-colors hover:bg-[var(--surface-2)]",
                        isSelected &&
                          "border-l-[3px] border-l-[var(--tenant-primary)] bg-[var(--tenant-primary)]/5 hover:bg-[var(--tenant-primary)]/8",
                      )}
                    >
                      <td className="px-4 py-3">
                        <p className="font-semibold text-[var(--foreground)]">{personName(entry)}</p>
                        <p className="text-xs text-[var(--muted)]">{entry.registration.email}</p>
                        {entry.person ? (
                          <p className="mt-0.5 text-[0.68rem] text-emerald-700">Person verknüpft</p>
                        ) : (
                          <p className="mt-0.5 text-[0.68rem] italic text-[var(--muted)]">Noch keine Person</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-xs text-[var(--foreground)]">{entry.registration.type}</p>
                        {birthYear(entry) ? (
                          <p className="text-xs text-[var(--muted)]">Jg. {birthYear(entry)}</p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-xs font-medium text-[var(--foreground)]">{scopeLabel(entry)}</p>
                        <p className="text-[0.68rem] text-[var(--muted)]">{scopeTypeLabel(entry)}</p>
                      </td>
                      <td className="px-4 py-3 text-xs">
                        <p className="text-[var(--foreground)]">{formatWaitingListDate(entry.addedAt)}</p>
                        <p className="text-[var(--muted)]">{waitingListDuration(entry.addedAt)}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5 text-xs">
                          <span
                            className={cn("h-2 w-2 rounded-full", WAITING_LIST_PRIORITY_DOT[entry.priority])}
                            aria-hidden
                          />
                          {WAITING_LIST_PRIORITY_LABELS[entry.priority]}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {entry.responsibleUser ? (
                          <WaitingListResponsibleDisplay
                            firstName={entry.responsibleUser.firstName}
                            lastName={entry.responsibleUser.lastName}
                            email={entry.responsibleUser.email}
                            compact
                          />
                        ) : (
                          <span className="text-xs italic text-[var(--muted)]">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "inline-flex h-5 items-center rounded-full border px-2 text-[0.65rem] font-semibold",
                            WAITING_LIST_STATUS_COLORS[entry.status],
                          )}
                        >
                          {WAITING_LIST_STATUS_LABELS[entry.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-[var(--foreground)]">
                        {getWaitingListNextStep(entry.status)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {selectedEntry ? (
        <div className="w-full flex-shrink-0 overflow-hidden border-l border-[var(--border)] bg-white lg:w-[480px]">
          <WaitingListDetailDrawer
            key={selectedEntry.id}
            entry={selectedEntry}
            tenantSlug={tenantSlug}
            canEdit={canEdit}
            canDelete={canDelete}
            eligibleCoordinators={eligibleCoordinators}
            onClose={() => setSelectedEntry(null)}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
          />
        </div>
      ) : null}
    </div>
  );
}
