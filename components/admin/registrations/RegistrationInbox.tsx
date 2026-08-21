"use client";

/**
 * RegistrationInbox — REG-WAIT-01F
 *
 * Converged operational inbox matching the Warteliste grammar:
 * KPI summary → compact filter toolbar → dense table rows.
 */

import { useMemo, useState, useCallback, useRef } from "react";
import {
  Search,
  ChevronDown,
  Volleyball,
  User,
  GraduationCap,
  Handshake,
  MessageSquare,
  ClipboardList,
  UserCheck2,
  AlertTriangle,
  UserRoundSearch,
  Inbox,
  Filter,
  X,
  SlidersHorizontal,
  CheckCircle2,
  Archive,
} from "lucide-react";
import { PopoverContent } from "@/components/ui/Popover";
import { cn } from "@/lib/cn";
import type { RegistrationListItem } from "@/lib/registrations/queries";
import type { InboxTypeOption } from "@/lib/inbox/types";
import type { AssignableUser, OrgUnitOption, TargetGroupOption, TeamSeasonOption } from "@/lib/registrations/workflow-types";
import {
  INBOX_STATUS_GROUPS,
  ARCHIVE_STATUS_GROUPS,
  STATUS_BADGE_CLASS,
  STATUS_LABELS,
  isActiveInboxRegistrationStatus,
  isArchiveRegistrationStatus,
  type InboxStatusGroupKey,
  type ArchiveStatusGroupKey,
} from "@/lib/registrations/status";
import { classifyRegistration, extractGenderFromPayload } from "@/lib/registrations/classification";
import { getRegistrationApplicantMetadata } from "@/lib/registrations/applicant-metadata";
import { getRoutingSuggestion } from "@/lib/registrations/routing-suggestion";
import { getRegistrationNextStep } from "@/lib/registrations/registration-workflow-ui";
import {
  CoordinatorFilterBar,
  WaitingListResponsibleDisplay,
} from "./WaitingListCoordinatorPicker";
import RegistrationDetailDrawer from "./RegistrationDetailDrawer";
import { RegistrationApplicantIdentity } from "./RegistrationApplicantIdentity";
import { formatDateTimeCompact } from "@/lib/tenant-runtime/formatters";

const TYPE_FILTER_OPTIONS: InboxTypeOption[] = [
  { value: "ALL", label: "Alle Typen" },
  { value: "PROBETRAINING", label: "Probetraining", Icon: Volleyball },
  { value: "SPIELERANMELDUNG", label: "Spieler", Icon: User },
  { value: "TRAINERANMELDUNG", label: "Trainer", Icon: GraduationCap },
  { value: "SPONSORANFRAGE", label: "Sponsor", Icon: Handshake },
  { value: "KONTAKTANFRAGE", label: "Kontakt", Icon: MessageSquare },
  { value: "OTHER", label: "Andere", Icon: ClipboardList },
];

const TYPE_LABELS: Record<string, string> = Object.fromEntries(
  TYPE_FILTER_OPTIONS.filter((o) => o.value !== "ALL").map((o) => [o.value, o.label]),
);

type ToggleFilterKey = "ASSIGNED_TO_ME" | "HAS_DUPLICATE" | "NEEDS_PERSON" | "ALREADY_LINKED";

function isActiveDuplicate(r: RegistrationListItem): boolean {
  const p = r.payloadJson;
  const flagged =
    !!p && typeof p === "object" && !Array.isArray(p) && (p as Record<string, unknown>).possibleDuplicate === true;
  return flagged && !r.duplicateIgnoredAt;
}

function needsPerson(r: RegistrationListItem): boolean {
  return !r.personId;
}

function needsAssignment(r: RegistrationListItem): boolean {
  return !r.assignedToUserId && isActiveInboxRegistrationStatus(r.status);
}

export type RegistrationWorkspaceMode = "inbox" | "archive";

function belongsInWorkspace(registration: RegistrationListItem, mode: RegistrationWorkspaceMode): boolean {
  return mode === "archive"
    ? isArchiveRegistrationStatus(registration.status)
    : isActiveInboxRegistrationStatus(registration.status);
}

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
      <p className={cn("mt-1.5 text-2xl font-bold", toneClass[tone])} style={{ fontFamily: "var(--font-display)" }}>
        {value}
      </p>
    </div>
  );
}

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
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

function CompactFilterSelect<T extends string>({
  label,
  value,
  onChange,
  options,
  active,
}: {
  label: string;
  value: T | "";
  onChange: (v: T | "") => void;
  options: { value: T; label: string }[];
  active?: boolean;
}) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const currentLabel = options.find((o) => o.value === value)?.label ?? null;

  return (
    <div ref={anchorRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition-colors",
          active || value
            ? "border-[var(--tenant-primary)] bg-[var(--tenant-primary)]/10 text-[var(--tenant-primary)]"
            : "border-[var(--border)] bg-white text-[var(--text-2)] hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]",
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
      >
        <span className="max-w-[120px] truncate">{currentLabel ?? label}</span>
        <ChevronDown className="h-3 w-3 flex-shrink-0 opacity-60" aria-hidden />
        {value ? (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              onChange("" as T | "");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.stopPropagation();
                onChange("" as T | "");
              }
            }}
            className="flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center rounded-full hover:bg-[var(--tenant-primary)]/20"
            aria-label="Filter entfernen"
          >
            <X className="h-2.5 w-2.5" />
          </span>
        ) : null}
      </button>

      <PopoverContent open={open} onOpenChange={setOpen} anchorRef={anchorRef} matchAnchorWidth={false} className="min-w-[160px]">
        <ul role="listbox" className="py-0">
          <li role="option" aria-selected={!value}>
            <button
              type="button"
              onMouseDown={() => {
                onChange("" as T | "");
                setOpen(false);
              }}
              className={cn(
                "flex w-full items-start px-3 py-2 text-left text-xs transition-colors hover:bg-[var(--surface-2)]",
                !value && "bg-[var(--surface-2)] font-semibold",
              )}
            >
              Alle
            </button>
          </li>
          {options.map((opt) => (
            <li key={opt.value} role="option" aria-selected={value === opt.value}>
              <button
                type="button"
                onMouseDown={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-start px-3 py-2 text-left text-xs transition-colors hover:bg-[var(--surface-2)]",
                  value === opt.value && "bg-[var(--surface-2)] font-semibold",
                )}
              >
                {opt.label}
              </button>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </div>
  );
}

type Props = {
  tenantSlug: string;
  initialRegistrations: RegistrationListItem[];
  workspaceMode?: RegistrationWorkspaceMode;
  canEdit: boolean;
  canDelete?: boolean;
  locale?: string;
  timezone?: string;
  assignableUsers?: AssignableUser[];
  eligibleCoordinators?: AssignableUser[];
  targetGroups?: TargetGroupOption[];
  orgUnits?: OrgUnitOption[];
  teamSeasons?: TeamSeasonOption[];
  currentUserId?: string | null;
};

export default function RegistrationInbox({
  tenantSlug,
  initialRegistrations,
  workspaceMode = "inbox",
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
  const [registrations, setRegistrations] = useState(() =>
    initialRegistrations.filter((registration) => belongsInWorkspace(registration, workspaceMode)),
  );
  const [selectedRegistration, setSelectedRegistration] = useState<RegistrationListItem | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<InboxStatusGroupKey | ArchiveStatusGroupKey | "">("");
  const [typeFilter, setTypeFilter] = useState("");
  const [coordinatorFilter, setCoordinatorFilter] = useState("");
  const [toggleFilters, setToggleFilters] = useState<Set<ToggleFilterKey>>(new Set());
  const [ageGroupFilter, setAgeGroupFilter] = useState("");
  const [recommendedTeamFilter, setRecommendedTeamFilter] = useState("");
  const [moreFiltersOpen, setMoreFiltersOpen] = useState(false);
  const moreFiltersRef = useRef<HTMLDivElement>(null);

  const statusGroups = workspaceMode === "archive" ? ARCHIVE_STATUS_GROUPS : INBOX_STATUS_GROUPS;

  const classified = useMemo(() => {
    const map = new Map<string, { ageGroup: string | null; team: string; birthYear: number | null }>();
    for (const r of registrations) {
      const gender = extractGenderFromPayload(r.payloadJson);
      const { birthYear } = getRegistrationApplicantMetadata(r);
      const classification = classifyRegistration(birthYear, gender, r.type);
      map.set(r.id, {
        ageGroup: getRoutingSuggestion(birthYear),
        team: classification.targetGroupLabel,
        birthYear,
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

  const metrics = useMemo(() => {
    if (workspaceMode === "archive") {
      return {
        accepted: registrations.filter((r) => r.status === "ACCEPTED").length,
        rejected: registrations.filter((r) => r.status === "REJECTED").length,
        archived: registrations.filter((r) => r.status === "ARCHIVED").length,
      };
    }

    return {
      new: registrations.filter((r) => r.status === "NEW").length,
      needsAssignment: registrations.filter(needsAssignment).length,
      needsPerson: registrations.filter(needsPerson).length,
      duplicates: registrations.filter(isActiveDuplicate).length,
    };
  }, [registrations, workspaceMode]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return registrations.filter((r) => {
      if (statusFilter) {
        const group = statusGroups.find((g) => g.key === statusFilter);
        if (group && !(group.statuses as string[]).includes(r.status)) return false;
      }
      if (typeFilter && r.type !== typeFilter) return false;
      if (coordinatorFilter && r.assignedToUserId !== coordinatorFilter) return false;
      if (toggleFilters.has("ASSIGNED_TO_ME") && r.assignedToUserId !== currentUserId) return false;
      if (toggleFilters.has("HAS_DUPLICATE") && !isActiveDuplicate(r)) return false;
      if (toggleFilters.has("NEEDS_PERSON") && !needsPerson(r)) return false;
      if (toggleFilters.has("ALREADY_LINKED") && !r.personId) return false;
      if (ageGroupFilter && classified.get(r.id)?.ageGroup !== ageGroupFilter) return false;
      if (recommendedTeamFilter && classified.get(r.id)?.team !== recommendedTeamFilter) return false;

      if (q) {
        const metadata = getRegistrationApplicantMetadata(r);
        const searchable = [
          `${r.firstName} ${r.lastName}`,
          r.email,
          r.type,
          STATUS_LABELS[r.status],
          r.phone ?? "",
          metadata.birthYear ? String(metadata.birthYear) : "",
          metadata.postalCode ?? "",
          metadata.city ?? "",
        ]
          .join(" ")
          .toLowerCase();
        if (!searchable.includes(q)) return false;
      }
      return true;
    });
  }, [
    registrations,
    statusFilter,
    typeFilter,
    coordinatorFilter,
    toggleFilters,
    ageGroupFilter,
    recommendedTeamFilter,
    statusGroups,
    classified,
    currentUserId,
    query,
  ]);

  const handleUpdate = useCallback(
    (updated: RegistrationListItem) => {
      if (!belongsInWorkspace(updated, workspaceMode)) {
        setRegistrations((prev) => prev.filter((r) => r.id !== updated.id));
        setSelectedRegistration(null);
        return;
      }

      setRegistrations((prev) => {
        const exists = prev.some((r) => r.id === updated.id);
        if (exists) {
          return prev.map((r) => (r.id === updated.id ? updated : r));
        }
        return [updated, ...prev];
      });
      setSelectedRegistration(updated);
    },
    [workspaceMode],
  );

  const handleClose = useCallback(() => setSelectedRegistration(null), []);

  const handleDeleted = useCallback((deletedId: string) => {
    setRegistrations((prev) => prev.filter((r) => r.id !== deletedId));
    setSelectedRegistration(null);
  }, []);

  const toggleFilter = useCallback((key: ToggleFilterKey) => {
    setToggleFilters((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const clearFilters = () => {
    setQuery("");
    setStatusFilter("");
    setTypeFilter("");
    setCoordinatorFilter("");
    setToggleFilters(new Set());
    setAgeGroupFilter("");
    setRecommendedTeamFilter("");
  };

  const hasActiveFilters = Boolean(
    query.trim() ||
      statusFilter ||
      typeFilter ||
      coordinatorFilter ||
      toggleFilters.size > 0 ||
      ageGroupFilter ||
      recommendedTeamFilter,
  );

  const statusOptions = statusGroups.map((group) => ({ value: group.key, label: group.label }));
  const typeOptions = TYPE_FILTER_OPTIONS.filter((o) => o.value !== "ALL").map((o) => ({
    value: o.value,
    label: o.label,
  }));

  const secondaryFilterLabels: Record<ToggleFilterKey, string> = {
    ASSIGNED_TO_ME: "Mir zugewiesen",
    HAS_DUPLICATE: "Hat Duplikat",
    NEEDS_PERSON: "Braucht Vereinsverwaltung",
    ALREADY_LINKED: "In Vereinsverwaltung",
  };

  const activeFilterChips = [
    statusFilter
      ? {
          key: "status",
          label: `Status: ${statusGroups.find((g) => g.key === statusFilter)?.label ?? statusFilter}`,
          onRemove: () => setStatusFilter(""),
        }
      : null,
    typeFilter
      ? {
          key: "type",
          label: `Typ: ${TYPE_LABELS[typeFilter] ?? typeFilter}`,
          onRemove: () => setTypeFilter(""),
        }
      : null,
    coordinatorFilter
      ? {
          key: "coordinator",
          label:
            coordinatorFilter === currentUserId
              ? "Verantwortlich: Mir zugewiesen"
              : `Verantwortlich: ${
                  eligibleCoordinators.find((u) => u.id === coordinatorFilter)?.firstName ?? ""
                } ${eligibleCoordinators.find((u) => u.id === coordinatorFilter)?.lastName ?? ""}`.trim(),
          onRemove: () => setCoordinatorFilter(""),
        }
      : null,
    ...Array.from(toggleFilters).map((key) => ({
      key,
      label: secondaryFilterLabels[key],
      onRemove: () => toggleFilter(key),
    })),
    ageGroupFilter
      ? { key: "age", label: `Altersgruppe: ${ageGroupFilter}`, onRemove: () => setAgeGroupFilter("") }
      : null,
    recommendedTeamFilter
      ? { key: "team", label: `Empf. Team: ${recommendedTeamFilter}`, onRemove: () => setRecommendedTeamFilter("") }
      : null,
    query.trim() ? { key: "search", label: `Suche: ${query.trim()}`, onRemove: () => setQuery("") } : null,
  ].filter(Boolean) as { key: string; label: string; onRemove: () => void }[];

  const openCount = workspaceMode === "inbox" ? registrations.filter((r) => r.status === "NEW").length : 0;
  const isArchive = workspaceMode === "archive";

  return (
    <div className="flex flex-col gap-0">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1
            className="text-xl font-bold text-[var(--foreground)] tracking-tight"
            style={{ fontFamily: "var(--font-display)", letterSpacing: "-0.01em" }}
          >
            {isArchive ? "Archiv" : "Registrierungen"}
          </h1>
          <p className="mt-0.5 text-sm text-[var(--muted)]">
            {isArchive ? (
              `${registrations.length} abgeschlossene Anmeldung${registrations.length !== 1 ? "en" : ""}`
            ) : openCount > 0 ? (
              <>
                <span className="font-semibold text-[var(--blue)]">{openCount}</span> offene Anmeldung
                {openCount !== 1 ? "en" : ""}
              </>
            ) : (
              `${registrations.length} aktive Anmeldung${registrations.length !== 1 ? "en" : ""}`
            )}
          </p>
        </div>
      </div>

      <div className={cn("mb-5 grid grid-cols-2 gap-3", isArchive ? "sm:grid-cols-3" : "sm:grid-cols-2 lg:grid-cols-4")}>
        {isArchive ? (
          <>
            <MetricCard icon={CheckCircle2} label="Angenommen" value={metrics.accepted ?? 0} tone="emerald" />
            <MetricCard icon={AlertTriangle} label="Abgelehnt" value={metrics.rejected ?? 0} tone="red" />
            <MetricCard icon={Archive} label="Archiviert" value={metrics.archived ?? 0} tone="blue" />
          </>
        ) : (
          <>
            <MetricCard icon={Inbox} label="Neu" value={metrics.new ?? 0} tone="blue" />
            <MetricCard icon={UserCheck2} label="Braucht Zuweisung" value={metrics.needsAssignment ?? 0} tone="amber" />
            <MetricCard icon={UserRoundSearch} label="Braucht Vereinsverwaltung" value={metrics.needsPerson ?? 0} tone="violet" />
            <MetricCard icon={AlertTriangle} label="Duplikate" value={metrics.duplicates ?? 0} tone="red" />
          </>
        )}
      </div>

      <div className="mb-4 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-2)] p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--muted)]" aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Suche Anmeldungen…"
              className="fca-input h-8 w-full pl-8 text-xs"
              aria-label="Suche Anmeldungen"
            />
          </div>

          <CompactFilterSelect<InboxStatusGroupKey | ArchiveStatusGroupKey>
            label="Status"
            value={statusFilter}
            onChange={setStatusFilter}
            options={statusOptions}
            active={!!statusFilter}
          />

          <CompactFilterSelect
            label="Typ"
            value={typeFilter}
            onChange={setTypeFilter}
            options={typeOptions}
            active={!!typeFilter}
          />

          <CoordinatorFilterBar
            eligibleCoordinators={eligibleCoordinators}
            value={coordinatorFilter}
            onChange={setCoordinatorFilter}
            currentUserId={currentUserId}
          />

          <div ref={moreFiltersRef} className="relative">
            {!isArchive ? (
              <>
            <button
              type="button"
              onClick={() => setMoreFiltersOpen((v) => !v)}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition-colors",
                toggleFilters.size > 0 || ageGroupFilter || recommendedTeamFilter
                  ? "border-[var(--tenant-primary)] bg-[var(--tenant-primary)]/10 text-[var(--tenant-primary)]"
                  : "border-[var(--border)] bg-white text-[var(--text-2)] hover:bg-[var(--surface-2)]",
              )}
              aria-expanded={moreFiltersOpen}
              aria-label="Weitere Filter"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden />
              Weitere Filter
            </button>

            <PopoverContent
              open={moreFiltersOpen}
              onOpenChange={setMoreFiltersOpen}
              anchorRef={moreFiltersRef}
              matchAnchorWidth={false}
              maxHeight={320}
              className="min-w-[240px] p-3"
              role="dialog"
            >
              <p className="mb-2 text-[0.68rem] font-semibold uppercase tracking-wide text-[var(--muted)]">
                Zusätzliche Filter
              </p>
              <div className="space-y-1.5">
                {(Object.keys(secondaryFilterLabels) as ToggleFilterKey[]).map((key) => (
                  <label key={key} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-[var(--surface-2)]">
                    <input
                      type="checkbox"
                      checked={toggleFilters.has(key)}
                      onChange={() => toggleFilter(key)}
                      className="rounded border-[var(--border)]"
                    />
                    <span className="text-xs text-[var(--foreground)]">{secondaryFilterLabels[key]}</span>
                  </label>
                ))}
              </div>

              {ageGroupOptions.length > 0 ? (
                <div className="mt-3">
                  <label className="mb-1 block text-[0.68rem] font-semibold uppercase tracking-wide text-[var(--muted)]">
                    Altersgruppe
                  </label>
                  <select
                    value={ageGroupFilter}
                    onChange={(e) => setAgeGroupFilter(e.target.value)}
                    className="fca-select h-8 w-full text-xs"
                  >
                    <option value="">Alle</option>
                    {ageGroupOptions.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              {recommendedTeamOptions.length > 0 ? (
                <div className="mt-3">
                  <label className="mb-1 block text-[0.68rem] font-semibold uppercase tracking-wide text-[var(--muted)]">
                    Empfohlenes Team
                  </label>
                  <select
                    value={recommendedTeamFilter}
                    onChange={(e) => setRecommendedTeamFilter(e.target.value)}
                    className="fca-select h-8 w-full text-xs"
                  >
                    <option value="">Alle</option>
                    {recommendedTeamOptions.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
            </PopoverContent>
              </>
            ) : null}
          </div>

          {hasActiveFilters ? (
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex h-8 items-center gap-1 rounded-lg border border-[var(--border)] bg-white px-2.5 text-xs text-[var(--muted)] hover:text-[var(--foreground)]"
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

      <div className="overflow-hidden rounded-[var(--radius-2xl)] border border-[var(--border)] bg-white shadow-[var(--shadow-sm)]">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
            <Filter className="h-8 w-8 text-[var(--muted)]" aria-hidden />
            <div>
              <p className="text-sm font-semibold text-[var(--foreground)]">
                {hasActiveFilters ? "Keine Treffer" : isArchive ? "Keine archivierten Anmeldungen" : "Keine aktiven Anmeldungen"}
              </p>
              <p className="mt-1 text-xs text-[var(--muted)]">
                {hasActiveFilters
                  ? "Suchbegriff anpassen oder Filter zurücksetzen."
                  : isArchive
                    ? "Abgeschlossene oder abgelehnte Anmeldungen erscheinen hier."
                    : "Neue Anmeldungen erscheinen hier, sobald sie eingehen."}
              </p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-[var(--border)] bg-[var(--surface-2)]">
                <tr>
                  <th className="px-4 py-2.5 text-left text-[0.68rem] font-semibold uppercase tracking-wider text-[var(--muted)]">
                    Bewerber/in
                  </th>
                  <th className="px-4 py-2.5 text-left text-[0.68rem] font-semibold uppercase tracking-wider text-[var(--muted)]">
                    Typ
                  </th>
                  <th className="px-4 py-2.5 text-left text-[0.68rem] font-semibold uppercase tracking-wider text-[var(--muted)]">
                    Ziel / Empfehlung
                  </th>
                  <th className="px-4 py-2.5 text-left text-[0.68rem] font-semibold uppercase tracking-wider text-[var(--muted)]">
                    Verantwortlich
                  </th>
                  <th className="px-4 py-2.5 text-left text-[0.68rem] font-semibold uppercase tracking-wider text-[var(--muted)]">
                    Status
                  </th>
                  <th className="px-4 py-2.5 text-left text-[0.68rem] font-semibold uppercase tracking-wider text-[var(--muted)]">
                    {isArchive ? "Abschluss" : "Nächster Schritt"}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {filtered.map((registration) => {
                  const gender = extractGenderFromPayload(registration.payloadJson);
                  const { birthYear } = getRegistrationApplicantMetadata(registration);
                  const classification = classifyRegistration(birthYear, gender, registration.type);
                  const isSelected = selectedRegistration?.id === registration.id;
                  const duplicate = isActiveDuplicate(registration);
                  const completionAt = registration.archivedAt ?? registration.updatedAt;

                  return (
                    <tr
                      key={registration.id}
                      onClick={() => setSelectedRegistration(registration)}
                      className={cn(
                        "cursor-pointer transition-colors hover:bg-[var(--surface-2)]",
                        isSelected &&
                          "border-l-[3px] border-l-[var(--tenant-primary)] bg-[var(--tenant-primary)]/5 hover:bg-[var(--tenant-primary)]/8",
                      )}
                    >
                      <td className="px-4 py-3">
                        <RegistrationApplicantIdentity
                          firstName={registration.firstName}
                          lastName={registration.lastName}
                          registration={registration}
                          personId={registration.personId}
                          locale={locale}
                          timezone={timezone}
                          showClubManagementState
                        />
                        {duplicate && !isArchive ? (
                          <p className="mt-0.5 pl-[2.625rem] text-[0.65rem] font-medium text-amber-600">Duplikat</p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-xs text-[var(--foreground)]">{TYPE_LABELS[registration.type] ?? registration.type}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-xs font-medium text-[var(--foreground)]">
                          {registration.targetGroup?.name ?? classification.targetGroupLabel}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        {registration.assignedToUser ? (
                          <WaitingListResponsibleDisplay
                            firstName={registration.assignedToUser.firstName}
                            lastName={registration.assignedToUser.lastName}
                            email={registration.assignedToUser.email}
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
                            STATUS_BADGE_CLASS[registration.status],
                          )}
                        >
                          {STATUS_LABELS[registration.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-[var(--foreground)]">
                        {isArchive
                          ? formatDateTimeCompact(completionAt, { locale, timezone })
                          : getRegistrationNextStep(registration)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedRegistration ? (
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
      ) : null}
    </div>
  );
}
