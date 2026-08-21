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
  UserCheck2,
  AlertTriangle,
  UserRoundSearch,
  Link2,
  Clock3,
  Inbox,
} from "lucide-react";
import { cn } from "@/lib/cn";
import type { RegistrationListItem } from "@/lib/registrations/queries";
import type { InboxTypeOption } from "@/lib/inbox/types";
import type { AssignableUser, OrgUnitOption, TargetGroupOption, TeamSeasonOption } from "@/lib/registrations/workflow-types";
import { STATUS_GROUPS, type StatusGroupKey } from "@/lib/registrations/status";
import { classifyRegistration, extractGenderFromPayload } from "@/lib/registrations/classification";
import { getRoutingSuggestion } from "@/lib/registrations/routing-suggestion";
import RegistrationInboxCard from "./RegistrationInboxCard";
import RegistrationDetailDrawer from "./RegistrationDetailDrawer";

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

// ── Derived helpers (REGISTRATION-01F — Goals 9/10) ─────────────────────────

function isActiveDuplicate(r: RegistrationListItem): boolean {
  const p = r.payloadJson;
  const flagged =
    !!p && typeof p === "object" && !Array.isArray(p) && (p as Record<string, unknown>).possibleDuplicate === true;
  return flagged && !r.duplicateIgnoredAt;
}

function needsPerson(r: RegistrationListItem): boolean {
  return !r.personId;
}

function isCompletedToday(r: RegistrationListItem): boolean {
  if (!(["ACCEPTED", "REJECTED", "ARCHIVED"] as string[]).includes(r.status)) return false;
  const updated = new Date(r.updatedAt);
  const now = new Date();
  return (
    updated.getFullYear() === now.getFullYear() &&
    updated.getMonth() === now.getMonth() &&
    updated.getDate() === now.getDate()
  );
}

function needsAssignment(r: RegistrationListItem): boolean {
  return !r.assignedToUserId && r.status !== "ARCHIVED";
}

// ── Group section sub-component ───────────────────────────────────────────────

function InboxGroup({
  label,
  dotClass,
  registrations,
  selectedId,
  onSelect,
  defaultOpen = true,
  locale,
  timezone,
}: {
  label: string;
  dotClass: string;
  registrations: RegistrationListItem[];
  selectedId: string | null;
  onSelect: (r: RegistrationListItem) => void;
  defaultOpen?: boolean;
  locale: string;
  timezone: string;
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
              locale={locale}
              timezone={timezone}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyInbox({ hasQuery }: { hasQuery: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center px-6">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--surface-2)]">
        <Search className="h-5 w-5 text-[var(--muted)]" aria-hidden />
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

// ── Goal 10: dashboard metrics ────────────────────────────────────────────────

function MetricCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof AlertTriangle;
  label: string;
  value: number;
  tone: "blue" | "amber" | "violet" | "red" | "orange" | "emerald";
}) {
  const toneClass: Record<typeof tone, string> = {
    blue: "text-[var(--blue)]",
    amber: "text-amber-600",
    violet: "text-violet-600",
    red: "text-red-600",
    orange: "text-orange-600",
    emerald: "text-emerald-600",
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

// ── Goal 9: toggle filter chip ───────────────────────────────────────────────

function ToggleFilterChip({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: typeof AlertTriangle;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 h-7 px-3 rounded-full border text-[0.72rem] font-medium transition-all",
        active
          ? "border-[var(--tenant-primary)] bg-[var(--tenant-primary)] text-white"
          : "border-[var(--border)] bg-white text-[var(--text-2)] hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]",
      )}
    >
      <Icon className="h-3 w-3" aria-hidden />
      {label}
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

type Props = {
  tenantSlug: string;
  initialRegistrations: RegistrationListItem[];
  canEdit: boolean;
  /**
   * ADMIN-DELETE-03B: effective PERMISSIONS.REGISTRATIONS_DELETE authority.
   * When false/absent the permanent-delete section in the drawer is hidden.
   */
  canDelete?: boolean;
  locale?: string;
  timezone?: string;
  assignableUsers?: AssignableUser[];
  eligibleCoordinators?: AssignableUser[];
  targetGroups?: TargetGroupOption[];
  orgUnits?: OrgUnitOption[];
  teamSeasons?: TeamSeasonOption[];
  /** REGISTRATION-01F — Goal 9: drives the "Assigned to me" filter. */
  currentUserId?: string | null;
};

type ToggleFilterKey = "ASSIGNED_TO_ME" | "HAS_DUPLICATE" | "NEEDS_PERSON" | "ALREADY_LINKED";

export default function RegistrationInbox({
  tenantSlug,
  initialRegistrations,
  canEdit,
  canDelete = false,
  locale = "de-CH",
  timezone = "Europe/Zurich",
  assignableUsers = [],
  eligibleCoordinators = [],
  targetGroups = [],
  orgUnits = [],
  teamSeasons = [],
  currentUserId = null,
}: Props) {
  const [registrations, setRegistrations] = useState(initialRegistrations);
  const [selectedRegistration, setSelectedRegistration] =
    useState<RegistrationListItem | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusGroupKey | "ALL">("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [toggleFilters, setToggleFilters] = useState<Set<ToggleFilterKey>>(new Set());
  const [ageGroupFilter, setAgeGroupFilter] = useState("ALL");
  const [recommendedTeamFilter, setRecommendedTeamFilter] = useState("ALL");
  const [ageDropdownOpen, setAgeDropdownOpen] = useState(false);
  const [teamDropdownOpen, setTeamDropdownOpen] = useState(false);

  // ── Classification cache (Goal 9: Age group / Recommended team filters) ───

  const classified = useMemo(() => {
    const map = new Map<string, { ageGroup: string | null; team: string }>();
    for (const r of registrations) {
      const gender = extractGenderFromPayload(r.payloadJson);
      const classification = classifyRegistration(r.birthYear, gender, r.type);
      map.set(r.id, {
        ageGroup: getRoutingSuggestion(r.birthYear),
        team: classification.targetGroupLabel,
      });
    }
    return map;
  }, [registrations]);

  const ageGroupOptions = useMemo(
    () =>
      Array.from(new Set(Array.from(classified.values()).map((c) => c.ageGroup).filter((v): v is string => !!v))).sort(),
    [classified],
  );
  const recommendedTeamOptions = useMemo(
    () => Array.from(new Set(Array.from(classified.values()).map((c) => c.team))).sort(),
    [classified],
  );

  // ── Goal 10: dashboard metrics ─────────────────────────────────────────────

  const metrics = useMemo(() => {
    return {
      new: registrations.filter((r) => r.status === "NEW").length,
      needsAssignment: registrations.filter(needsAssignment).length,
      needsPerson: registrations.filter(needsPerson).length,
      duplicates: registrations.filter(isActiveDuplicate).length,
      waiting: registrations.filter((r) => r.status === "WAITING").length,
      completedToday: registrations.filter(isCompletedToday).length,
    };
  }, [registrations]);

  // ── Counts for status pills ────────────────────────────────────────────────

  const statusCounts = useMemo(() => {
    const result: Record<StatusGroupKey, number> = {
      ALL: registrations.length,
      NEW: 0,
      REVIEWING: 0,
      CONTACTED: 0,
      WAITING: 0,
      DONE: 0,
    };
    for (const r of registrations) {
      const group = STATUS_GROUPS.find((g) => (g.statuses as string[]).includes(r.status));
      if (group) result[group.key]++;
    }
    return result;
  }, [registrations]);

  // ── Filtering ─────────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return registrations.filter((r) => {
      if (statusFilter !== "ALL") {
        const group = STATUS_GROUPS.find((g) => g.key === statusFilter);
        if (group && !(group.statuses as string[]).includes(r.status)) return false;
      }
      if (typeFilter !== "ALL" && r.type !== typeFilter) return false;

      if (toggleFilters.has("ASSIGNED_TO_ME") && r.assignedToUserId !== currentUserId) return false;
      if (toggleFilters.has("HAS_DUPLICATE") && !isActiveDuplicate(r)) return false;
      if (toggleFilters.has("NEEDS_PERSON") && !needsPerson(r)) return false;
      if (toggleFilters.has("ALREADY_LINKED") && !r.personId) return false;

      if (ageGroupFilter !== "ALL" && classified.get(r.id)?.ageGroup !== ageGroupFilter) return false;
      if (recommendedTeamFilter !== "ALL" && classified.get(r.id)?.team !== recommendedTeamFilter) return false;

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
  }, [registrations, statusFilter, typeFilter, toggleFilters, ageGroupFilter, recommendedTeamFilter, classified, currentUserId, query]);

  // ── Group the filtered results ─────────────────────────────────────────────

  const grouped = useMemo(() => {
    return STATUS_GROUPS.map((group) => ({
      ...group,
      items: filtered.filter((r) => (group.statuses as string[]).includes(r.status)),
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

  // ADMIN-DELETE-03B: remove the permanently deleted item from the local list
  // and close the drawer. router.refresh() in RegistrationDeleteControl already
  // triggers a server revalidation so the list stays in sync after navigation.
  const handleDeleted = useCallback((deletedId: string) => {
    setRegistrations((prev) => prev.filter((r) => r.id !== deletedId));
    setSelectedRegistration(null);
  }, []);

  const handleStatusPillClick = useCallback(
    (key: StatusGroupKey) => {
      setStatusFilter((prev) => (prev === key ? "ALL" : key));
    },
    [],
  );

  const toggleFilter = useCallback((key: ToggleFilterKey) => {
    setToggleFilters((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const openCount = statusCounts.NEW;
  const hasResults = filtered.length > 0;
  const hasActiveFilter = !!(
    query.trim() ||
    statusFilter !== "ALL" ||
    typeFilter !== "ALL" ||
    toggleFilters.size > 0 ||
    ageGroupFilter !== "ALL" ||
    recommendedTeamFilter !== "ALL"
  );

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

      {/* ── Goal 10: dashboard metrics ───────────────────────────────────── */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <MetricCard icon={Inbox} label="Neu" value={metrics.new} tone="blue" />
        <MetricCard icon={UserCheck2} label="Braucht Zuweisung" value={metrics.needsAssignment} tone="amber" />
        <MetricCard icon={UserRoundSearch} label="Braucht Person" value={metrics.needsPerson} tone="violet" />
        <MetricCard icon={AlertTriangle} label="Duplikate" value={metrics.duplicates} tone="red" />
        <MetricCard icon={Clock3} label="Wartend" value={metrics.waiting} tone="orange" />
        <MetricCard icon={Link2} label="Heute abgeschlossen" value={metrics.completedToday} tone="emerald" />
      </div>

      {/* ── Status filter pills ───────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        {STATUS_GROUPS.map((group) => {
          const count = statusCounts[group.key];
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

      {/* ── Goal 9: workflow filter chips ────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <ToggleFilterChip
          icon={UserCheck2}
          label="Mir zugewiesen"
          active={toggleFilters.has("ASSIGNED_TO_ME")}
          onClick={() => toggleFilter("ASSIGNED_TO_ME")}
        />
        <ToggleFilterChip
          icon={AlertTriangle}
          label="Hat Duplikat"
          active={toggleFilters.has("HAS_DUPLICATE")}
          onClick={() => toggleFilter("HAS_DUPLICATE")}
        />
        <ToggleFilterChip
          icon={UserRoundSearch}
          label="Braucht Person"
          active={toggleFilters.has("NEEDS_PERSON")}
          onClick={() => toggleFilter("NEEDS_PERSON")}
        />
        <ToggleFilterChip
          icon={Link2}
          label="Bereits verknüpft"
          active={toggleFilters.has("ALREADY_LINKED")}
          onClick={() => toggleFilter("ALREADY_LINKED")}
        />

        {ageGroupOptions.length > 0 && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setAgeDropdownOpen((v) => !v)}
              onBlur={() => setTimeout(() => setAgeDropdownOpen(false), 150)}
              className={cn(
                "inline-flex h-7 items-center gap-1.5 rounded-full border px-3 text-[0.72rem] font-medium transition-all",
                ageGroupFilter !== "ALL"
                  ? "border-[var(--tenant-primary)] bg-[var(--tenant-primary)] text-white"
                  : "border-[var(--border)] bg-white text-[var(--text-2)] hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]",
              )}
              aria-haspopup="listbox"
              aria-expanded={ageDropdownOpen}
              aria-label="Altersgruppe filtern"
            >
              {ageGroupFilter !== "ALL" ? `Jg.: ${ageGroupFilter}` : "Altersgruppe"}
              {ageGroupFilter !== "ALL" ? (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => { e.stopPropagation(); setAgeGroupFilter("ALL"); }}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.stopPropagation(); setAgeGroupFilter("ALL"); } }}
                  className="ml-1 opacity-80 hover:opacity-100"
                  aria-label="Filter entfernen"
                >✕</span>
              ) : null}
            </button>
            {ageDropdownOpen ? (
              <ul
                role="listbox"
                className="absolute left-0 top-full z-50 mt-1 min-w-[140px] rounded-[var(--radius-xl)] border border-[var(--border-strong)] bg-[var(--surface)] py-1 shadow-[var(--shadow-lg)]"
              >
                {ageGroupOptions.map((g) => (
                  <li key={g} role="option" aria-selected={ageGroupFilter === g}>
                    <button
                      type="button"
                      onMouseDown={() => { setAgeGroupFilter(g); setAgeDropdownOpen(false); }}
                      className="flex w-full px-3 py-2 text-left text-[0.72rem] hover:bg-[var(--surface-2)]"
                    >
                      {g}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        )}

        {recommendedTeamOptions.length > 0 && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setTeamDropdownOpen((v) => !v)}
              onBlur={() => setTimeout(() => setTeamDropdownOpen(false), 150)}
              className={cn(
                "inline-flex h-7 items-center gap-1.5 rounded-full border px-3 text-[0.72rem] font-medium transition-all",
                recommendedTeamFilter !== "ALL"
                  ? "border-[var(--tenant-primary)] bg-[var(--tenant-primary)] text-white"
                  : "border-[var(--border)] bg-white text-[var(--text-2)] hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]",
              )}
              aria-haspopup="listbox"
              aria-expanded={teamDropdownOpen}
              aria-label="Empfohlenes Team filtern"
            >
              {recommendedTeamFilter !== "ALL" ? `Team: ${recommendedTeamFilter}` : "Empf. Team"}
              {recommendedTeamFilter !== "ALL" ? (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => { e.stopPropagation(); setRecommendedTeamFilter("ALL"); }}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.stopPropagation(); setRecommendedTeamFilter("ALL"); } }}
                  className="ml-1 opacity-80 hover:opacity-100"
                  aria-label="Filter entfernen"
                >✕</span>
              ) : null}
            </button>
            {teamDropdownOpen ? (
              <ul
                role="listbox"
                className="absolute left-0 top-full z-50 mt-1 min-w-[160px] rounded-[var(--radius-xl)] border border-[var(--border-strong)] bg-[var(--surface)] py-1 shadow-[var(--shadow-lg)]"
              >
                {recommendedTeamOptions.map((t) => (
                  <li key={t} role="option" aria-selected={recommendedTeamFilter === t}>
                    <button
                      type="button"
                      onMouseDown={() => { setRecommendedTeamFilter(t); setTeamDropdownOpen(false); }}
                      className="flex w-full px-3 py-2 text-left text-[0.72rem] hover:bg-[var(--surface-2)]"
                    >
                      {t}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        )}
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
      <div className="rounded-[var(--radius-2xl)] border border-[var(--border)] bg-white shadow-[var(--shadow-sm)] overflow-hidden">
        {!hasResults ? (
          <EmptyInbox hasQuery={hasActiveFilter} />
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
              locale={locale}
              timezone={timezone}
            />
          ))
        )}
      </div>

      {/* ── Detail drawer ─────────────────────────────────────────────────── */}
      {selectedRegistration && (
        <RegistrationDetailDrawer
          registration={selectedRegistration}
          tenantSlug={tenantSlug}
          canEdit={canEdit}
          canDelete={canDelete}
          locale={locale}
          timezone={timezone}
          assignableUsers={assignableUsers}
          eligibleCoordinators={eligibleCoordinators}
          targetGroups={targetGroups}
          orgUnits={orgUnits}
          teamSeasons={teamSeasons}
          onClose={handleClose}
          onUpdate={handleUpdate}
          onDeleted={handleDeleted}
        />
      )}
    </div>
  );
}
