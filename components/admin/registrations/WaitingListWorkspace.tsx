"use client";

/**
 * components/admin/registrations/WaitingListWorkspace.tsx
 *
 * REG-WAIT-01: Operational Warteliste overview — inbox family sibling.
 *
 * Shows WaitingListEntries in a premium operational table with:
 *   - Applicant / Person name
 *   - Birth year / age
 *   - Registration type
 *   - Waiting scope
 *   - Target category / OrgUnit / Team
 *   - Waiting since + duration
 *   - Priority
 *   - Responsible coordinator
 *   - Waiting-list status
 *
 * Filters: status, priority, scope, responsible coordinator, text search.
 * Right-side drawer for detail + operations.
 */

import { useState, useMemo } from "react";
import {
  ClipboardList,
  Clock,
  Filter,
  Search,
  UserCheck,
  X,
} from "lucide-react";
import { cn } from "@/lib/cn";
import type { WaitingListEntryItem } from "@/lib/registrations/waiting-list-queries";
import type { AssignableUser } from "@/lib/registrations/workflow-types";
import { WaitingListDetailDrawer } from "./WaitingListDetailDrawer";
import type { WaitingListStatus, WaitingListPriority } from "@prisma/client";

// ── Display helpers ───────────────────────────────────────────────────────────

const STATUS_LABELS: Record<WaitingListStatus, string> = {
  WAITING: "Wartend",
  CONTACTED: "Kontaktiert",
  OFFERED: "Angebot gemacht",
  PLACED: "Platziert",
  WITHDRAWN: "Zurückgezogen",
  REJECTED: "Abgelehnt",
  ARCHIVED: "Archiviert",
};

const STATUS_COLORS: Record<WaitingListStatus, string> = {
  WAITING: "border-amber-200 bg-amber-50 text-amber-800",
  CONTACTED: "border-blue-200 bg-blue-50 text-blue-800",
  OFFERED: "border-purple-200 bg-purple-50 text-purple-800",
  PLACED: "border-emerald-200 bg-emerald-50 text-emerald-800",
  WITHDRAWN: "border-slate-200 bg-slate-50 text-slate-600",
  REJECTED: "border-rose-200 bg-rose-50 text-rose-700",
  ARCHIVED: "border-slate-200 bg-slate-50 text-slate-500",
};

const PRIORITY_LABELS: Record<WaitingListPriority, string> = {
  NORMAL: "Normal",
  HIGH: "Hoch",
  URGENT: "Dringend",
};

const PRIORITY_DOT: Record<WaitingListPriority, string> = {
  NORMAL: "bg-slate-400",
  HIGH: "bg-amber-400",
  URGENT: "bg-rose-500",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function waitingDuration(addedAt: string) {
  const ms = Date.now() - new Date(addedAt).getTime();
  const days = Math.floor(ms / 86400000);
  if (days === 0) return "Heute";
  if (days === 1) return "Gestern";
  if (days < 7) return `${days} Tage`;
  if (days < 30) return `${Math.floor(days / 7)} Wo.`;
  return `${Math.floor(days / 30)} Mon.`;
}

// ── Props ─────────────────────────────────────────────────────────────────────

type Props = {
  tenantSlug: string;
  initialEntries: WaitingListEntryItem[];
  canEdit: boolean;
  canDelete: boolean;
  assignableUsers: AssignableUser[];
  currentUserId: string | null;
};

// ── Active statuses for default filter ───────────────────────────────────────

const ACTIVE_STATUSES: WaitingListStatus[] = ["WAITING", "CONTACTED", "OFFERED"];

// ── Component ─────────────────────────────────────────────────────────────────

export function WaitingListWorkspace({
  tenantSlug,
  initialEntries,
  canEdit,
  canDelete,
  assignableUsers,
  currentUserId,
}: Props) {
  const [entries, setEntries] = useState<WaitingListEntryItem[]>(initialEntries);
  const [selectedEntry, setSelectedEntry] = useState<WaitingListEntryItem | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"active" | "all" | WaitingListStatus>("active");
  const [priorityFilter, setPriorityFilter] = useState<WaitingListPriority | "">("");
  const [responsibleFilter, setResponsibleFilter] = useState<string>("");

  const filtered = useMemo(() => {
    let result = entries;

    // Status
    if (statusFilter === "active") {
      result = result.filter((e) => ACTIVE_STATUSES.includes(e.status));
    } else if (statusFilter !== "all") {
      result = result.filter((e) => e.status === statusFilter);
    }

    // Priority
    if (priorityFilter) {
      result = result.filter((e) => e.priority === priorityFilter);
    }

    // Responsible
    if (responsibleFilter) {
      result = result.filter((e) => e.responsibleUserId === responsibleFilter);
    }

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((e) => {
        const name = `${e.registration.firstName} ${e.registration.lastName}`.toLowerCase();
        const personName = e.person
          ? `${e.person.firstName} ${e.person.lastName}`.toLowerCase()
          : "";
        const email = e.registration.email.toLowerCase();
        return name.includes(q) || personName.includes(q) || email.includes(q);
      });
    }

    return result;
  }, [entries, statusFilter, priorityFilter, responsibleFilter, search]);

  const scopeLabel = (entry: WaitingListEntryItem) =>
    entry.targetGroup?.name ??
    entry.orgUnit?.name ??
    (entry.teamSeason
      ? `${entry.teamSeason.team.name} — ${entry.teamSeason.displayName}`
      : "—");

  const scopeTypeLabel = (entry: WaitingListEntryItem) =>
    entry.scopeType === "TARGET_GROUP" ? "Zielgruppe" :
    entry.scopeType === "ORG_UNIT" ? "Abteilung" : "Team";

  const personName = (entry: WaitingListEntryItem) =>
    entry.person
      ? (entry.person.displayName || `${entry.person.firstName} ${entry.person.lastName}`)
      : `${entry.registration.firstName} ${entry.registration.lastName}`;

  const birthYear = (entry: WaitingListEntryItem) =>
    entry.person?.dateOfBirth
      ? new Date(entry.person.dateOfBirth).getFullYear()
      : entry.registration.birthYear;

  const handleUpdate = (updated: WaitingListEntryItem) => {
    setEntries((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
    setSelectedEntry(updated);
  };

  const handleDelete = () => {
    setEntries((prev) => prev.filter((e) => e.id !== selectedEntry?.id));
    setSelectedEntry(null);
  };

  const activeCount = entries.filter((e) => ACTIVE_STATUSES.includes(e.status)).length;

  return (
    <div className="flex h-full min-h-0">
      {/* Main area */}
      <div className={cn("flex flex-col flex-1 min-w-0 transition-all", selectedEntry ? "hidden lg:flex" : "flex")}>
        {/* Header */}
        <div className="border-b border-[var(--border)] bg-white px-6 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold text-[var(--foreground)] flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-[var(--tenant-primary)]" aria-hidden />
                Warteliste
              </h1>
              <p className="mt-0.5 text-sm text-[var(--muted)]">
                {activeCount} aktive Einträge
              </p>
            </div>
          </div>

          {/* Filters */}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative min-w-[200px] flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--muted)]" aria-hidden />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Name, E-Mail suchen…"
                className="fca-input pl-8 text-xs h-8 w-full"
              />
            </div>

            {/* Status filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
              className="fca-select text-xs h-8"
            >
              <option value="active">Aktive (Wartend + Kontaktiert + Angebot)</option>
              <option value="all">Alle Status</option>
              {(Object.entries(STATUS_LABELS) as [WaitingListStatus, string][]).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>

            {/* Priority filter */}
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value as WaitingListPriority | "")}
              className="fca-select text-xs h-8"
            >
              <option value="">Alle Prioritäten</option>
              {(Object.entries(PRIORITY_LABELS) as [WaitingListPriority, string][]).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>

            {/* Responsible filter */}
            <select
              value={responsibleFilter}
              onChange={(e) => setResponsibleFilter(e.target.value)}
              className="fca-select text-xs h-8"
            >
              <option value="">Alle Koordinatoren</option>
              {currentUserId && <option value={currentUserId}>Mir zugewiesen</option>}
              {assignableUsers
                .filter((u) => u.id !== currentUserId)
                .map((u) => (
                  <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>
                ))}
            </select>

            {/* Clear filters */}
            {(search || statusFilter !== "active" || priorityFilter || responsibleFilter) && (
              <button
                type="button"
                onClick={() => { setSearch(""); setStatusFilter("active"); setPriorityFilter(""); setResponsibleFilter(""); }}
                className="inline-flex items-center gap-1 h-8 px-2.5 rounded-lg border border-[var(--border)] bg-white text-xs text-[var(--muted)] hover:bg-[var(--surface-2)]"
              >
                <X className="h-3 w-3" aria-hidden />
                Filter zurücksetzen
              </button>
            )}
          </div>
        </div>

        {/* Table / List */}
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-20 text-center px-6">
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
                  <th className="px-4 py-2.5 text-left text-[0.68rem] font-semibold uppercase tracking-wider text-[var(--muted)]">Bewerber/in</th>
                  <th className="px-4 py-2.5 text-left text-[0.68rem] font-semibold uppercase tracking-wider text-[var(--muted)]">Typ / Jg.</th>
                  <th className="px-4 py-2.5 text-left text-[0.68rem] font-semibold uppercase tracking-wider text-[var(--muted)]">Scope / Ziel</th>
                  <th className="px-4 py-2.5 text-left text-[0.68rem] font-semibold uppercase tracking-wider text-[var(--muted)]">
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" aria-hidden /> Seit</span>
                  </th>
                  <th className="px-4 py-2.5 text-left text-[0.68rem] font-semibold uppercase tracking-wider text-[var(--muted)]">Priorität</th>
                  <th className="px-4 py-2.5 text-left text-[0.68rem] font-semibold uppercase tracking-wider text-[var(--muted)]">
                    <span className="flex items-center gap-1"><UserCheck className="h-3 w-3" aria-hidden /> Verantwortlich</span>
                  </th>
                  <th className="px-4 py-2.5 text-left text-[0.68rem] font-semibold uppercase tracking-wider text-[var(--muted)]">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {filtered.map((entry) => (
                  <tr
                    key={entry.id}
                    onClick={() => setSelectedEntry(entry)}
                    className={cn(
                      "cursor-pointer transition-colors hover:bg-[var(--surface-2)]",
                      selectedEntry?.id === entry.id && "bg-[var(--surface-2)]",
                    )}
                  >
                    <td className="px-4 py-3">
                      <p className="font-semibold text-[var(--foreground)]">{personName(entry)}</p>
                      <p className="text-xs text-[var(--muted)]">{entry.registration.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-xs text-[var(--foreground)]">{entry.registration.type}</p>
                      {birthYear(entry) && <p className="text-xs text-[var(--muted)]">Jg. {birthYear(entry)}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-xs font-medium text-[var(--foreground)]">{scopeLabel(entry)}</p>
                      <p className="text-[0.68rem] text-[var(--muted)]">{scopeTypeLabel(entry)}</p>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <p className="text-[var(--foreground)]">{formatDate(entry.addedAt)}</p>
                      <p className="text-[var(--muted)]">{waitingDuration(entry.addedAt)}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5 text-xs">
                        <span className={cn("h-2 w-2 rounded-full", PRIORITY_DOT[entry.priority])} aria-hidden />
                        {PRIORITY_LABELS[entry.priority]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-[var(--foreground)]">
                      {entry.responsibleUser
                        ? `${entry.responsibleUser.firstName} ${entry.responsibleUser.lastName}`
                        : <span className="text-[var(--muted)] italic">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn("inline-flex h-5 items-center rounded-full border px-2 text-[0.65rem] font-semibold", STATUS_COLORS[entry.status])}>
                        {STATUS_LABELS[entry.status]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Detail drawer */}
      {selectedEntry && (
        <div className="w-full lg:w-[480px] flex-shrink-0 border-l border-[var(--border)] bg-white overflow-hidden">
          <WaitingListDetailDrawer
            key={selectedEntry.id}
            entry={selectedEntry}
            tenantSlug={tenantSlug}
            canEdit={canEdit}
            canDelete={canDelete}
            assignableUsers={assignableUsers}
            onClose={() => setSelectedEntry(null)}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
          />
        </div>
      )}
    </div>
  );
}
