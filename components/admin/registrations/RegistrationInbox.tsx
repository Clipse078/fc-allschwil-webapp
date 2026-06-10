"use client";

import { useMemo, useState, useCallback } from "react";
import { Search, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";
import type { RegistrationListItem } from "@/lib/registrations/queries";
import RegistrationInboxCard from "./RegistrationInboxCard";
import RegistrationDetailDrawer, {
  type AssignableUser,
  type TargetGroupOption,
} from "./RegistrationDetailDrawer";

// ── Type filter config ───────────────────────────────────────────────────────

const TYPE_FILTER_OPTIONS: { value: string; label: string; icon?: string }[] =
  [
    { value: "ALL", label: "Alle Typen" },
    { value: "PROBETRAINING", label: "Probetraining", icon: "⚽" },
    { value: "SPIELERANMELDUNG", label: "Spieler", icon: "👤" },
    { value: "TRAINERANMELDUNG", label: "Trainer", icon: "🎓" },
    { value: "SPONSORANFRAGE", label: "Sponsor", icon: "🤝" },
    { value: "KONTAKTANFRAGE", label: "Kontakt", icon: "💬" },
    { value: "OTHER", label: "Andere", icon: "📋" },
  ];

// ── Status group config ──────────────────────────────────────────────────────

type StatusGroupKey = "ALL" | "NEW" | "REVIEWING" | "CONTACTED" | "DONE";

const STATUS_GROUPS: {
  key: StatusGroupKey;
  label: string;
  statuses: string[];
  pillClass: string;
  dotClass: string;
}[] = [
  {
    key: "NEW",
    label: "Neu",
    statuses: ["NEW"],
    pillClass:
      "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100",
    dotClass: "bg-blue-500",
  },
  {
    key: "REVIEWING",
    label: "In Bearbeitung",
    statuses: ["REVIEWING"],
    pillClass:
      "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100",
    dotClass: "bg-amber-500",
  },
  {
    key: "CONTACTED",
    label: "Kontaktiert",
    statuses: ["CONTACTED"],
    pillClass:
      "border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100",
    dotClass: "bg-violet-500",
  },
  {
    key: "DONE",
    label: "Abgeschlossen",
    statuses: ["ACCEPTED", "REJECTED", "ARCHIVED"],
    pillClass:
      "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
    dotClass: "bg-emerald-500",
  },
];

// ── Group section sub-component ──────────────────────────────────────────────

function InboxGroup({
  label,
  dotClass,
  registrations,
  selectedId,
  onSelect,
  defaultOpen = true,
}: {
  label: string;
  dotClass: string;
  registrations: RegistrationListItem[];
  selectedId: string | null;
  onSelect: (r: RegistrationListItem) => void;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  if (registrations.length === 0) return null;

  return (
    <div className="border-b border-[var(--border)] last:border-b-0">
      {/* Group header */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-2.5 bg-[var(--surface-2)] hover:bg-[var(--surface-3)] transition-colors text-left"
      >
        <span
          className={cn("h-2 w-2 rounded-full flex-shrink-0", dotClass)}
        />
        <span className="flex-1 text-xs font-semibold text-[var(--text-2)] uppercase tracking-[0.06em]">
          {label}
        </span>
        <span className="text-[0.7rem] font-semibold text-[var(--muted)]">
          {registrations.length}
        </span>
        {open ? (
          <ChevronDown className="h-3.5 w-3.5 text-[var(--muted)] flex-shrink-0" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-[var(--muted)] flex-shrink-0" />
        )}
      </button>

      {/* Cards */}
      {open && (
        <div>
          {registrations.map((reg) => (
            <RegistrationInboxCard
              key={reg.id}
              registration={reg}
              isSelected={selectedId === reg.id}
              onClick={() => onSelect(reg)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Empty state ──────────────────────────────────────────────────────────────

function EmptyInbox({ hasQuery }: { hasQuery: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center px-6">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--surface-2)]">
        <Search className="h-5 w-5 text-[var(--muted)]" />
      </div>
      <div>
        <p className="text-sm font-semibold text-[var(--foreground)]">
          {hasQuery ? "Keine Treffer" : "Keine Anmeldungen"}
        </p>
        <p className="mt-1 text-xs text-[var(--muted)]">
          {hasQuery
            ? "Suchbegriff anpassen oder Filter zurücksetzen."
            : "Noch keine Anmeldungen für diesen Tenant eingegangen."}
        </p>
      </div>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

type Props = {
  tenantSlug: string;
  initialRegistrations: RegistrationListItem[];
  canEdit: boolean;
  locale?: string;
  timezone?: string;
  assignableUsers?: AssignableUser[];
  targetGroups?: TargetGroupOption[];
};

export default function RegistrationInbox({
  tenantSlug,
  initialRegistrations,
  canEdit,
  locale = "de-CH",
  timezone = "Europe/Zurich",
  assignableUsers = [],
  targetGroups = [],
}: Props) {
  const [registrations, setRegistrations] = useState(initialRegistrations);
  const [selectedRegistration, setSelectedRegistration] =
    useState<RegistrationListItem | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusGroupKey>("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");

  // ── Counts for pills ──────────────────────────────────────────────────────

  const counts = useMemo(() => {
    const result: Record<StatusGroupKey, number> = {
      ALL: registrations.length,
      NEW: 0,
      REVIEWING: 0,
      CONTACTED: 0,
      DONE: 0,
    };
    for (const r of registrations) {
      if (r.status === "NEW") result.NEW++;
      else if (r.status === "REVIEWING") result.REVIEWING++;
      else if (r.status === "CONTACTED") result.CONTACTED++;
      else if (["ACCEPTED", "REJECTED", "ARCHIVED"].includes(r.status))
        result.DONE++;
    }
    return result;
  }, [registrations]);

  // ── Filtering ─────────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return registrations.filter((r) => {
      // Status group filter
      if (statusFilter !== "ALL") {
        const group = STATUS_GROUPS.find((g) => g.key === statusFilter);
        if (group && !group.statuses.includes(r.status)) return false;
      }
      // Type filter
      if (typeFilter !== "ALL" && r.type !== typeFilter) return false;
      // Text search
      if (q) {
        const searchable = [
          `${r.firstName} ${r.lastName}`,
          r.email,
          r.type,
          r.status,
          r.phone ?? "",
        ]
          .join(" ")
          .toLowerCase();
        if (!searchable.includes(q)) return false;
      }
      return true;
    });
  }, [registrations, statusFilter, typeFilter, query]);

  // ── Group the filtered results ─────────────────────────────────────────────

  const grouped = useMemo(() => {
    return STATUS_GROUPS.map((group) => ({
      ...group,
      items: filtered.filter((r) => group.statuses.includes(r.status)),
    }));
  }, [filtered]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleUpdate = useCallback((updated: RegistrationListItem) => {
    setRegistrations((prev) =>
      prev.map((r) => (r.id === updated.id ? updated : r)),
    );
    setSelectedRegistration(updated);
  }, []);

  const handleClose = useCallback(() => {
    setSelectedRegistration(null);
  }, []);

  const handleStatusPillClick = useCallback(
    (key: StatusGroupKey) => {
      setStatusFilter((prev) => (prev === key ? "ALL" : key));
    },
    [],
  );

  const openCount = counts.NEW;
  const hasResults = filtered.length > 0;

  return (
    <div className="flex flex-col gap-0">
      {/* ── Compact header ──────────────────────────────────────────────── */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[var(--foreground)] tracking-tight" style={{ fontFamily: "var(--font-display)", letterSpacing: "-0.01em" }}>
            Registrierungen
          </h1>
          <p className="mt-0.5 text-sm text-[var(--muted)]">
            {openCount > 0 ? (
              <>
                <span className="font-semibold text-[var(--blue)]">
                  {openCount}
                </span>{" "}
                offene Anmeldung{openCount !== 1 ? "en" : ""}
              </>
            ) : (
              `${registrations.length} Anmeldung${registrations.length !== 1 ? "en" : ""} total`
            )}
          </p>
        </div>
      </div>

      {/* ── Status pills ────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        {STATUS_GROUPS.map((group) => {
          const count = counts[group.key];
          const isActive = statusFilter === group.key;
          return (
            <button
              key={group.key}
              type="button"
              onClick={() => handleStatusPillClick(group.key)}
              className={cn(
                "inline-flex items-center gap-1.5 h-7 px-3 rounded-full border text-[0.72rem] font-semibold transition-all",
                isActive
                  ? group.pillClass + " ring-2 ring-offset-1 ring-[var(--border-strong)]"
                  : group.pillClass,
              )}
            >
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full flex-shrink-0",
                  group.dotClass,
                )}
              />
              {group.label}
              <span
                className={cn(
                  "inline-flex items-center justify-center min-w-[18px] h-4 rounded-full px-1 text-[0.65rem] font-bold",
                  isActive ? "bg-white/50" : "bg-white/70",
                )}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Filter row: search + type ────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {/* Search */}
        <div className="sce-page-search flex-1 min-w-[200px]">
          <Search className="h-4 w-4 flex-shrink-0 text-[var(--muted)]" />
          <input
            type="text"
            placeholder="Suche Anmeldungen…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="off"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="flex-shrink-0 text-xs text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
            >
              ✕
            </button>
          ) : null}
        </div>

        {/* Type filter */}
        <div className="relative">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="fca-select text-xs pr-8 appearance-none cursor-pointer"
            style={{ minWidth: "130px" }}
          >
            {TYPE_FILTER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.icon ? `${opt.icon} ` : ""}
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Result count (when filtered) ────────────────────────────────── */}
      {(query.trim() || statusFilter !== "ALL" || typeFilter !== "ALL") &&
        filtered.length > 0 && (
          <p className="mb-3 text-xs text-[var(--muted)]">
            {filtered.length} von {registrations.length} Anmeldungen
          </p>
        )}

      {/* ── Inbox list ──────────────────────────────────────────────────── */}
      <div className="rounded-[var(--radius-2xl)] border border-[var(--border)] bg-white shadow-[var(--shadow-sm)] overflow-hidden">
        {!hasResults ? (
          <EmptyInbox hasQuery={!!(query.trim() || statusFilter !== "ALL" || typeFilter !== "ALL")} />
        ) : (
          grouped.map((group, idx) => (
            <InboxGroup
              key={group.key}
              label={group.label}
              dotClass={group.dotClass}
              registrations={group.items}
              selectedId={selectedRegistration?.id ?? null}
              onSelect={setSelectedRegistration}
              defaultOpen={idx === 0 || group.items.length > 0}
            />
          ))
        )}
      </div>

      {/* ── Detail drawer ────────────────────────────────────────────────── */}
      {selectedRegistration && (
        <RegistrationDetailDrawer
          registration={selectedRegistration}
          tenantSlug={tenantSlug}
          canEdit={canEdit}
          locale={locale}
          timezone={timezone}
          assignableUsers={assignableUsers}
          targetGroups={targetGroups}
          onClose={handleClose}
          onUpdate={handleUpdate}
        />
      )}
    </div>
  );
}
