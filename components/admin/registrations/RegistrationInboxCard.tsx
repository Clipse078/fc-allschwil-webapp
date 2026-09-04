"use client";

import { useCallback, type ComponentType } from "react";
import {
  UserCheck,
  Volleyball,
  User,
  GraduationCap,
  Handshake,
  MessageSquare,
  ClipboardList,
  Globe,
  Smartphone,
  PenLine,
  FileSpreadsheet,
  Code2,
  HelpCircle,
  Users,
  Shield,
  Flag,
  CalendarDays,
  AlertTriangle,
  UserRound,
} from "lucide-react";
import { cn } from "@/lib/cn";
import type { RegistrationListItem } from "@/lib/registrations/queries";
import {
  classifyRegistration,
  extractGenderFromPayload,
  getGenderLabel,
  TARGET_GROUP_COLORS,
} from "@/lib/registrations/classification";
import { getUrgencyInfo, getInitials } from "@/lib/inbox/types";
import { formatDateShort, formatDateTimeCompact } from "@/lib/tenant-runtime/formatters";
import {
  getRegistrationSourceInfo,
  type RegistrationSourceKey,
} from "@/lib/registrations/source";
import {
  STATUS_LABELS as SHARED_STATUS_LABELS,
  STATUS_BADGE_CLASS as SHARED_STATUS_BADGE_CLASS,
} from "@/lib/registrations/status";

// Goal 6 (REGISTRATION-01E): presentation-only icon per source key — display
// only, ingestion is untouched (see lib/registrations/source.ts).
const SOURCE_ICON: Record<RegistrationSourceKey, ComponentType<{ className?: string }>> = {
  WEBSITE: Globe,
  MOBILE_APP: Smartphone,
  MANUAL: PenLine,
  CSV_IMPORT: FileSpreadsheet,
  API: Code2,
  OTHER: HelpCircle,
};

// ── Type visual config (icons replace emojis) ─────────────────────────────────

type TypeConfig = {
  Icon: ComponentType<{ className?: string }>;
  label: string;
  colorClass: string;
};

const TYPE_CONFIG: Record<string, TypeConfig> = {
  PROBETRAINING: {
    Icon: Volleyball,
    label: "Probetraining",
    colorClass: "border-blue-200 bg-blue-50 text-blue-700",
  },
  SPIELERANMELDUNG: {
    Icon: User,
    label: "Spieler",
    colorClass: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  TRAINERANMELDUNG: {
    Icon: GraduationCap,
    label: "Trainer",
    colorClass: "border-orange-200 bg-orange-50 text-orange-700",
  },
  SPONSORANFRAGE: {
    Icon: Handshake,
    label: "Sponsor",
    colorClass: "border-amber-200 bg-amber-50 text-amber-700",
  },
  KONTAKTANFRAGE: {
    Icon: MessageSquare,
    label: "Kontakt",
    colorClass: "border-slate-200 bg-slate-50 text-slate-600",
  },
  OTHER: {
    Icon: ClipboardList,
    label: "Andere",
    colorClass: "border-slate-200 bg-slate-50 text-slate-400",
  },
  // Website-integration types
  MITGLIEDSCHAFT: {
    Icon: Users,
    label: "Mitgliedschaft",
    colorClass: "border-teal-200 bg-teal-50 text-teal-700",
  },
  FREIWILLIGENMELDUNG: {
    Icon: UserCheck,
    label: "Freiwillig",
    colorClass: "border-cyan-200 bg-cyan-50 text-cyan-700",
  },
  SCHIEDSRICHTERANMELDUNG: {
    Icon: Flag,
    label: "Schiedsrichter",
    colorClass: "border-yellow-200 bg-yellow-50 text-yellow-700",
  },
  CAMP_ANMELDUNG: {
    Icon: Shield,
    label: "Camp",
    colorClass: "border-purple-200 bg-purple-50 text-purple-700",
  },
  VERANSTALTUNGSANMELDUNG: {
    Icon: CalendarDays,
    label: "Veranstaltung",
    colorClass: "border-pink-200 bg-pink-50 text-pink-700",
  },
};

// REGISTRATION-01F — Goal 8: status metadata now lives in one shared module.
const STATUS_BADGE = SHARED_STATUS_BADGE_CLASS;
const STATUS_LABEL = SHARED_STATUS_LABELS;

const URGENCY_DOT: Record<string, string> = {
  ok: "bg-emerald-400",
  warn: "bg-amber-400",
  alert: "bg-red-500",
};

// ── Owner avatar chip ─────────────────────────────────────────────────────────

function OwnerChip({ firstName, lastName }: { firstName: string; lastName: string }) {
  const initials = getInitials(firstName, lastName);
  return (
    <span
      className="inline-flex items-center gap-1.5"
      title={`${firstName} ${lastName}`}
    >
      <span
        className="inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--tenant-primary)_14%,white)] text-[0.55rem] font-bold uppercase text-[var(--tenant-primary)]"
        aria-hidden
      >
        {initials}
      </span>
      <span className="text-[0.65rem] font-medium text-[var(--text-2)]">
        {firstName} {lastName}
      </span>
    </span>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

type Props = {
  registration: RegistrationListItem;
  onClick: () => void;
  isSelected?: boolean;
  /** Tenant locale (e.g. "de-CH"). Falls back to "de-CH" when absent. */
  locale?: string;
  /** Tenant timezone (e.g. "Europe/Zurich"). Falls back to "Europe/Zurich" when absent. */
  timezone?: string;
};

export default function RegistrationInboxCard({
  registration,
  onClick,
  isSelected = false,
  locale = "de-CH",
  timezone = "Europe/Zurich",
}: Props) {
  const initials = getInitials(registration.firstName, registration.lastName);
  const typeConfig = TYPE_CONFIG[registration.type] ?? TYPE_CONFIG.OTHER;
  const { Icon: TypeIcon } = typeConfig;
  const statusBadgeClass = STATUS_BADGE[registration.status] ?? STATUS_BADGE.NEW;
  const statusLabel = STATUS_LABEL[registration.status] ?? registration.status;
  const urgency = getUrgencyInfo(registration.submittedAt);
  // Goal 1 (REGISTRATION-01D): the exact timestamp must never disappear,
  // even alongside the relative-time label above.
  const exactTimestamp = formatDateTimeCompact(registration.submittedAt, { locale, timezone });

  const gender = extractGenderFromPayload(registration.payloadJson);
  const classification = classifyRegistration(
    registration.birthYear,
    gender,
    registration.type,
  );
  const groupColors = TARGET_GROUP_COLORS[classification.colorToken];

  const isAdult = registration.birthYear
    ? new Date().getFullYear() - registration.birthYear >= 18
    : false;
  const genderLabel = getGenderLabel(gender, isAdult);

  // Goal 6 (REGISTRATION-01E): presentation-only source label — ingestion
  // still always writes "WEBSITE" today (see lib/registrations/source.ts).
  const sourceInfo = getRegistrationSourceInfo(registration.source);
  const SourceIcon = sourceInfo ? SOURCE_ICON[sourceInfo.key] : null;
  const isPossibleDuplicate =
    registration.payloadJson &&
    typeof registration.payloadJson === "object" &&
    !Array.isArray(registration.payloadJson) &&
    (registration.payloadJson as Record<string, unknown>).possibleDuplicate === true;
  // Goal 2 (REGISTRATION-01E): show enough to identify the original at a
  // glance, without redesigning duplicate detection itself.
  const duplicateReference = registration.duplicateReference;

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onClick();
      }
    },
    [onClick],
  );

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      className={cn(
        "group/card relative w-full cursor-pointer px-4 py-3.5 border-b border-[var(--border)] last:border-b-0 transition-colors outline-none",
        "focus-visible:ring-2 focus-visible:ring-[var(--tenant-primary)] focus-visible:ring-inset",
        isSelected
          ? "bg-[color-mix(in_srgb,var(--tenant-primary)_7%,white)] border-l-[3px] border-l-[var(--tenant-primary)] pl-[13px]"
          : "bg-[var(--card)] hover:bg-[var(--surface-2)]",
      )}
    >
      <div className="flex items-start gap-3">
        {/* Applicant avatar */}
        <div className="flex-shrink-0 mt-0.5 flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface-2)] text-xs font-bold uppercase text-[var(--blue)]">
          {initials}
        </div>

        {/* Main content */}
        <div className="min-w-0 flex-1">
          {/* Row 1: name + type badge + status badge + source badge */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[0.875rem] font-semibold text-[var(--foreground)] group-hover/card:text-[var(--blue)] transition-colors">
              {registration.firstName} {registration.lastName}
            </span>
            <span
              className={cn(
                "inline-flex items-center gap-1 h-5 rounded-full border px-2 text-[0.65rem] font-semibold",
                typeConfig.colorClass,
              )}
            >
              <TypeIcon className="h-3 w-3" aria-hidden />
              <span>{typeConfig.label}</span>
            </span>
            <span
              className={cn(
                "hidden sm:inline-flex h-5 items-center rounded-full border px-2 text-[0.65rem] font-semibold",
                statusBadgeClass,
              )}
            >
              {statusLabel}
            </span>
            {sourceInfo && (
              <span className="inline-flex items-center gap-1 h-5 rounded-full border border-indigo-200 bg-indigo-50 px-2 text-[0.65rem] font-semibold text-indigo-700">
                {SourceIcon ? <SourceIcon className="h-3 w-3" aria-hidden /> : null}
                {sourceInfo.label}
              </span>
            )}
          </div>

          {/* Row 2: classification metadata — Jahrgang · Geschlecht · Suggested group.
              Goal 1 (REGISTRATION-01E): the suggested-group chip always renders
              (falling back to "Nicht zugeordnet" for UNKNOWN) so this row is
              never left visually empty when birth year/gender weren't submitted. */}
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
            {registration.birthYear ? (
              <span className="text-[0.72rem] text-[var(--text-2)] font-medium">
                Jg. {registration.birthYear}
              </span>
            ) : null}
            {genderLabel ? (
              <>
                <span className="text-[var(--border-strong)] text-[0.65rem]">·</span>
                <span className="text-[0.72rem] text-[var(--text-2)]">{genderLabel}</span>
              </>
            ) : null}
            {(registration.birthYear || genderLabel) && (
              <span className="text-[var(--border-strong)] text-[0.65rem]">·</span>
            )}
            <span
              className={cn(
                "inline-flex items-center gap-1 text-[0.65rem] font-semibold",
                groupColors.text,
              )}
            >
              <span
                className={cn("h-1.5 w-1.5 rounded-full flex-shrink-0", groupColors.dot)}
                aria-hidden
              />
              {classification.targetGroupLabel}
            </span>
          </div>

          {/* Row 3: ownership (always visible) */}
          <div className="mt-1.5 flex items-center gap-2">
            {registration.assignedToUser ? (
              <OwnerChip
                firstName={registration.assignedToUser.firstName}
                lastName={registration.assignedToUser.lastName}
              />
            ) : (
              <span className="text-[0.65rem] text-[var(--muted)] italic flex items-center gap-1">
                <UserCheck className="h-3 w-3" aria-hidden />
                Nicht zugewiesen
              </span>
            )}
            {/* Goal 2/9 (REGISTRATION-01F): person-match state at a glance. */}
            {registration.personMatch?.status === "LINKED" ? (
              <span className="inline-flex items-center gap-1 text-[0.65rem] font-medium text-emerald-600">
                <UserRound className="h-3 w-3" aria-hidden />
                Person verknüpft
              </span>
            ) : registration.personMatch?.status === "CONFIRMED" || registration.personMatch?.status === "POSSIBLE" ? (
              <span className="inline-flex items-center gap-1 text-[0.65rem] font-medium text-amber-600">
                <UserRound className="h-3 w-3" aria-hidden />
                Möglicher Treffer
              </span>
            ) : null}
          </div>

          {/* Possible duplicate warning */}
          {isPossibleDuplicate && (
            <div className="mt-1.5 flex items-center gap-1 text-[0.65rem] font-medium text-amber-600">
              <AlertTriangle className="h-3 w-3 flex-shrink-0" aria-hidden />
              <span>Mögliches Duplikat</span>
              {duplicateReference ? (
                <span className="text-amber-500">
                  · Original {formatDateShort(duplicateReference.submittedAt, { locale, timezone })}
                </span>
              ) : null}
            </div>
          )}

          {/* Quick actions — hover only on desktop */}
          <div className="mt-2 flex flex-wrap items-center gap-1.5 sm:opacity-0 sm:group-hover/card:opacity-100 sm:transition-opacity sm:duration-150">
            <a
              href={`mailto:${registration.email}`}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
              className="inline-flex items-center h-6 px-2.5 rounded-md border border-[var(--border)] bg-[var(--surface)] text-[0.7rem] font-medium text-[var(--text-2)] hover:bg-[var(--surface-2)] hover:text-[var(--foreground)] transition-colors"
            >
              Kontaktieren
            </a>
            <span className="inline-flex items-center h-6 px-2.5 rounded-md border border-[var(--border)] bg-[var(--surface)] text-[0.7rem] font-medium text-[var(--text-2)]">
              Öffnen →
            </span>
          </div>
        </div>

        {/* Right meta: urgency dot + relative label + exact timestamp (Goal 1) */}
        <div className="flex-shrink-0 flex flex-col items-end gap-0.5 pt-0.5">
          <div className="flex items-center gap-1.5">
            <span
              className={cn(
                "h-2 w-2 rounded-full flex-shrink-0",
                URGENCY_DOT[urgency.level],
              )}
              title={
                urgency.level === "alert"
                  ? "Dringend — 7+ Tage offen"
                  : urgency.level === "warn"
                    ? "3+ Tage offen"
                    : "Aktuell"
              }
            />
            <span className="text-[0.7rem] text-[var(--muted)] whitespace-nowrap">
              {urgency.label}
            </span>
          </div>
          {/* Exact timestamp — never hidden, always shown alongside the relative label */}
          <span className="text-[0.65rem] text-[var(--muted)]/80 whitespace-nowrap tabular-nums">
            {exactTimestamp}
          </span>
        </div>
      </div>
    </div>
  );
}
