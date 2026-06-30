"use client";

import { useMemo, useState, useCallback } from "react";
import {
  Search,
  ChevronDown,
  ChevronRight,
  Volleyball,
  User,
  GraduationCap,
  Handshake,
  MessageSquare,
  ClipboardList,
  ListFilter,
} from "lucide-react";
import { cn } from "@/lib/cn";
import type { RegistrationListItem } from "@/lib/registrations/queries";
import type { InboxTypeOption } from "@/lib/inbox/types";
import RegistrationInboxCard from "./RegistrationInboxCard";
import RegistrationDetailDrawer, {
  type AssignableUser,
  type TargetGroupOption,
} from "./RegistrationDetailDrawer";
import { Card } from "@/components/ui";
import { EmptyState } from "@/components/ui/page";

// ── Type filter options (icons replace emojis) ────────────────────────────────

const TYPE_FILTER_OPTIONS: InboxTypeOption[] = [
  { value: "ALL", label: "Alle Typen" },
  { value: "PROBETRAINING", label: "Probetraining", Icon: Volleyball },
  { value: "SPIELERANMELDUNG", label: "Spieler", Icon: User },
  { value: "TRAINERANMELDUNG", label: "Trainer", Icon: GraduationCap },
  { value: "SPONSORANFRAGE", label: "Sponsor", Icon: Handshake },
  { value: "KONTAKTANFRAGE", label: "Kontakt", Icon: MessageSquare },
  { value: "OTHER", label: "Andere", Icon: ClipboardList },
];

// ── Status group config ───────────────────────────────────────────────────────

type StatusGroupKey = "ALL" | "NEW" | "REVIEWING" | "CONTACTED" | "DONE";

const STATUS_GROUPS: {
  key: StatusGroupKey;
  label: string;
  statuses: string[];
  pillClass: string;
  pillActiveClass: string;
  dotClass: string;
}[] = [
  {
    key: "NEW",
    label: "Neu",
    statuses: ["NEW"],
    pillClass:
      "border-blue-200 bg-white text-blue-700 hover:bg-blue-50",
    pillActiveClass:
      "border-blue-400 bg-blue-600 text-white shadow-sm",
    dotClass: "bg-blue-500",
  },
  {
    key: "REVIEWING",
    label: "Bearbeitung",
    statuses: ["REVIEWING"],
    pillClass:
      "border-amber-200 bg-white text-amber-700 hover:bg-amber-50",
    pillActiveClass:
      "border-amber-500 bg-amber-500 text-white shadow-sm",
    dotClass: "bg-amber-500",
  },
  {
    key: "CONTACTED",
    label: "Kontaktiert",
    statuses: ["CONTACTED"],
    pillClass:
      "border-violet-200 bg-white text-violet-700 hover:bg-violet-50",
    pillActiveClass:
      "border-violet-500 bg-violet-600 text-white shadow-sm",
    dotClass: "bg-violet-500",
  },
  {
    key: "DONE",
    label: "Abgeschlossen",
    statuses: ["ACCEPTED", "REJECTED", "ARCHIVED"],
    pillClass:
      "border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50",
    pillActiveClass:
      "border-emerald-600 bg-emerald-600 text-white shadow-sm",
    dotClass: "bg-emerald-500",
  },
];

// ── Group section sub-component ───────────────────────────────────────────────

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
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-2.5 bg-[var(--surface-2)] hover:bg-[var(--surface-3)] transition-colors text-left"
      >
        <span className={cn("h-2 w-2 rounded-full flex-shrink-0", dotClass)} aria-hidden />
        <span className="flex-1 text-xs font-semibold text-[var(--text-2)] uppercase tracking-[0.06em]">
          {label}
        </span>
        <span className="text-[0.7rem] font-semibold text-[var(--muted)]">
          {registrations.length}
        </span>
        {open ? (
          <ChevronDown className="h-3.5 w-3.5 text-[var(--muted)] flex-shrink-0" aria-hidden />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-[var(--muted)] flex-shrink-0" aria-hidden />
        )}
      </button>

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


// ── Type filter button ────────────────────────────────────────────────────────

function TypeFilterButton({
  option,
  isActive,
  onClick,
}: {
  option: InboxTypeOption;
  isActive: boolean;
  onClick: () => void;
}) {
  const { Icon } = option;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 h-7 px-3 rounded-full border text-[0.72rem] font-medium transition-all",
        isActive
          ? "border-[var(--border-strong)] bg-[var(--foreground)] text-white"
          : "border-[var(--border)] bg-white text-[var(--text-2)] hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]",
      )}
    >
      {Icon && <Icon className="h-3 w-3" aria-hidden />}
      {option.label}
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

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
      if (statusFilter !== "ALL") {
        const group = STATUS_GROUPS.find((g) => g.key === statusFilter);
        if (group && !group.statuses.includes(r.status)) return false;
      }
      if (typeFilter !== "ALL" && r.type !== typeFilter) return false;
      if (q) {
        const searchable = [
          `${r.firstName} ${r.lastName}`,
          r.email,
          r.type,
          r.status,
          r.phone ?? "",
          r.birthYear ? String(r.birthYear) : "",
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
  const hasActiveFilter = !!(query.trim() || statusFilter !== "ALL" || typeFilter !== "ALL");

  return (
    <div className="flex flex-col gap-0">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1
            className="text-xl font-bold text-[var(--foreground)] tracking-tight"
            style={{ fontFamily: "var(--font-display)", letterSpacing: "-0.01em" }}
          >
            Registrierungen
          </h1>
          <p className="mt-0.5 text-sm text-[var(--muted)]">
            {openCount > 0 ? (
              <>
                <span className="font-semibold text-[var(--blue)]">{openCount}</span>{" "}
                offene Anmeldung{openCount !== 1 ? "en" : ""}
              </>
            ) : (
              `${registrations.length} Anmeldung${registrations.length !== 1 ? "en" : ""} total`
            )}
          </p>
        </div>
      </div>

      {/* ── Status filter pills ───────────────────────────────────────────── */}
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
                isActive ? group.pillActiveClass : group.pillClass,
              )}
            >
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full flex-shrink-0 transition-colors",
                  isActive ? "bg-white/70" : group.dotClass,
                )}
                aria-hidden
              />
              {group.label}
              <span
                className={cn(
                  "inline-flex items-center justify-center min-w-[18px] h-4 rounded-full px-1 text-[0.62rem] font-bold transition-colors",
                  isActive ? "bg-white/20" : "bg-[var(--surface-2)]",
                  !isActive && count > 0 ? "text-[var(--foreground)]" : "",
                  !isActive && count === 0 ? "text-[var(--muted)]" : "",
                )}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Search + type filter row ──────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {/* Search */}
        <div className="sce-page-search flex-1 min-w-[200px]">
          <Search className="h-4 w-4 flex-shrink-0 text-[var(--muted)]" aria-hidden />
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

        {/* Type filter pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          {typeFilter !== "ALL" && (
            <button
              type="button"
              onClick={() => setTypeFilter("ALL")}
              className="inline-flex items-center gap-1 h-7 px-2.5 rounded-full border border-[var(--border)] bg-white text-[0.7rem] text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
              title="Filter zurücksetzen"
            >
              <ListFilter className="h-3 w-3" aria-hidden />
              ✕
            </button>
          )}
          {TYPE_FILTER_OPTIONS.filter((o) => o.value !== "ALL").map((opt) => (
            <TypeFilterButton
              key={opt.value}
              option={opt}
              isActive={typeFilter === opt.value}
              onClick={() =>
                setTypeFilter((prev) => (prev === opt.value ? "ALL" : opt.value))
              }
            />
          ))}
        </div>
      </div>

      {/* ── Result count when filtered ────────────────────────────────────── */}
      {hasActiveFilter && filtered.length > 0 && (
        <p className="mb-3 text-xs text-[var(--muted)]">
          {filtered.length} von {registrations.length} Anmeldungen
        </p>
      )}

      {/* ── Inbox list ────────────────────────────────────────────────────── */}
      <Card variant="section" noPadding>
        {!hasResults ? (
          <EmptyState
            icon={<Search className="h-10 w-10" />}
            heading={hasActiveFilter ? "Keine Treffer" : "Keine Anmeldungen"}
            description={
              hasActiveFilter
                ? "Suchbegriff anpassen oder Filter zurücksetzen."
                : "Noch keine Anmeldungen für diesen Tenant eingegangen."
            }
          />
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
      </Card>

      {/* ── Detail drawer ─────────────────────────────────────────────────── */}
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
