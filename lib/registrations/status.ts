/**
 * lib/registrations/status.ts
 *
 * REGISTRATION-01F — Goal 8: single source of truth for the registration
 * status set (New, In Review, Assigned, Contacted, Waiting, Accepted,
 * Rejected, Archived) and its display metadata (label / colors).
 *
 * Every component that previously hardcoded its own
 * `Record<RegistrationStatus, ...>` (drawer, detail card, inbox table,
 * inbox card, inbox filters) now reads from here instead, so adding a new
 * status only requires one edit.
 *
 * Client-safe: `RegistrationStatus` is a plain string-enum re-exported by
 * `@prisma/client`'s generated JS (no DB/server code is pulled in).
 */

import { RegistrationStatus } from "@prisma/client";

/** Canonical display order — matches the workflow sequence, not enum declaration order. */
export const STATUS_ORDER: RegistrationStatus[] = [
  RegistrationStatus.NEW,
  RegistrationStatus.REVIEWING,
  RegistrationStatus.ASSIGNED,
  RegistrationStatus.CONTACTED,
  RegistrationStatus.WAITING,
  RegistrationStatus.ACCEPTED,
  RegistrationStatus.REJECTED,
  RegistrationStatus.ARCHIVED,
];

export const STATUS_LABELS: Record<RegistrationStatus, string> = {
  NEW: "Neu",
  REVIEWING: "In Prüfung",
  ASSIGNED: "Zugewiesen",
  CONTACTED: "Kontaktiert",
  WAITING: "Wartend",
  ACCEPTED: "Angenommen",
  REJECTED: "Abgelehnt",
  ARCHIVED: "Archiviert",
};

/** Light pill badge — used on white/light surfaces (drawer, cards, tables). */
export const STATUS_BADGE_CLASS: Record<RegistrationStatus, string> = {
  NEW: "border-blue-200 bg-blue-50 text-blue-700",
  REVIEWING: "border-amber-200 bg-amber-50 text-amber-700",
  ASSIGNED: "border-indigo-200 bg-indigo-50 text-indigo-700",
  CONTACTED: "border-violet-200 bg-violet-50 text-violet-700",
  WAITING: "border-orange-200 bg-orange-50 text-orange-700",
  ACCEPTED: "border-emerald-200 bg-emerald-50 text-emerald-700",
  REJECTED: "border-red-200 bg-red-50 text-red-700",
  ARCHIVED: "border-slate-200 bg-slate-50 text-slate-400",
};

/** Dark-hero variant — used on the gradient hero of the full detail page. */
export const STATUS_HERO_CLASS: Record<RegistrationStatus, string> = {
  NEW: "border-blue-300/60 bg-blue-500/20 text-blue-200",
  REVIEWING: "border-amber-300/60 bg-amber-500/20 text-amber-200",
  ASSIGNED: "border-indigo-300/60 bg-indigo-500/20 text-indigo-200",
  CONTACTED: "border-violet-300/60 bg-violet-500/20 text-violet-200",
  WAITING: "border-orange-300/60 bg-orange-500/20 text-orange-200",
  ACCEPTED: "border-emerald-300/60 bg-emerald-500/20 text-emerald-200",
  REJECTED: "border-red-300/60 bg-red-500/20 text-red-200",
  ARCHIVED: "border-white/20 bg-white/10 text-white/50",
};

/** Small coloured dot — inbox rows / summary strips. */
export const STATUS_DOT_CLASS: Record<RegistrationStatus, string> = {
  NEW: "bg-blue-500",
  REVIEWING: "bg-amber-500",
  ASSIGNED: "bg-indigo-500",
  CONTACTED: "bg-violet-500",
  WAITING: "bg-orange-500",
  ACCEPTED: "bg-emerald-500",
  REJECTED: "bg-red-500",
  ARCHIVED: "bg-slate-400",
};

export const STATUS_OPTIONS: RegistrationStatus[] = STATUS_ORDER;

// ── Lifecycle workspace projections (REG-WAIT-01H) ────────────────────────

/** Active operational inbox — registrations requiring club action. */
export const ACTIVE_INBOX_STATUSES: RegistrationStatus[] = [
  RegistrationStatus.NEW,
  RegistrationStatus.REVIEWING,
  RegistrationStatus.ASSIGNED,
  RegistrationStatus.CONTACTED,
];

/** Terminal / historical registrations shown in the Archiv workspace. */
export const ARCHIVE_STATUSES: RegistrationStatus[] = [
  RegistrationStatus.ACCEPTED,
  RegistrationStatus.REJECTED,
  RegistrationStatus.ARCHIVED,
];

/** Statuses managed exclusively in the Warteliste workspace. */
export const WAITING_LIST_REGISTRATION_STATUSES: RegistrationStatus[] = [
  RegistrationStatus.WAITING,
];

/** Statuses that count as "final" for KPI / archive purposes. */
export const TERMINAL_STATUSES: RegistrationStatus[] = ARCHIVE_STATUSES;

export function isActiveInboxRegistrationStatus(status: RegistrationStatus): boolean {
  return ACTIVE_INBOX_STATUSES.includes(status);
}

export function isArchiveRegistrationStatus(status: RegistrationStatus): boolean {
  return ARCHIVE_STATUSES.includes(status);
}

// ── Inbox filter/status groups (Goal 9 / REG-WAIT-01H) ────────────────────

export type InboxStatusGroupKey = "NEW" | "REVIEWING" | "CONTACTED";
export type ArchiveStatusGroupKey = "ACCEPTED" | "REJECTED" | "ARCHIVED";
export type StatusGroupKey = InboxStatusGroupKey | ArchiveStatusGroupKey;

type StatusGroupDefinition = {
  key: StatusGroupKey;
  label: string;
  statuses: RegistrationStatus[];
  pillClass: string;
  pillActiveClass: string;
  dotClass: string;
};

export const INBOX_STATUS_GROUPS: StatusGroupDefinition[] = [
  {
    key: "NEW",
    label: "Neu",
    statuses: [RegistrationStatus.NEW],
    pillClass: "border-blue-200 bg-white text-blue-700 hover:bg-blue-50",
    pillActiveClass: "border-blue-400 bg-blue-600 text-white shadow-sm",
    dotClass: "bg-blue-500",
  },
  {
    key: "REVIEWING",
    label: "In Bearbeitung",
    statuses: [RegistrationStatus.REVIEWING, RegistrationStatus.ASSIGNED],
    pillClass: "border-amber-200 bg-white text-amber-700 hover:bg-amber-50",
    pillActiveClass: "border-amber-500 bg-amber-500 text-white shadow-sm",
    dotClass: "bg-amber-500",
  },
  {
    key: "CONTACTED",
    label: "Kontaktiert",
    statuses: [RegistrationStatus.CONTACTED],
    pillClass: "border-violet-200 bg-white text-violet-700 hover:bg-violet-50",
    pillActiveClass: "border-violet-500 bg-violet-600 text-white shadow-sm",
    dotClass: "bg-violet-500",
  },
];

export const ARCHIVE_STATUS_GROUPS: StatusGroupDefinition[] = [
  {
    key: "ACCEPTED",
    label: "Angenommen",
    statuses: [RegistrationStatus.ACCEPTED],
    pillClass: "border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50",
    pillActiveClass: "border-emerald-600 bg-emerald-600 text-white shadow-sm",
    dotClass: "bg-emerald-500",
  },
  {
    key: "REJECTED",
    label: "Abgelehnt",
    statuses: [RegistrationStatus.REJECTED],
    pillClass: "border-red-200 bg-white text-red-700 hover:bg-red-50",
    pillActiveClass: "border-red-600 bg-red-600 text-white shadow-sm",
    dotClass: "bg-red-500",
  },
  {
    key: "ARCHIVED",
    label: "Archiviert",
    statuses: [RegistrationStatus.ARCHIVED],
    pillClass: "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
    pillActiveClass: "border-slate-500 bg-slate-600 text-white shadow-sm",
    dotClass: "bg-slate-400",
  },
];

/** Active inbox filter pills — alias kept for existing imports. */
export const STATUS_GROUPS = INBOX_STATUS_GROUPS;
