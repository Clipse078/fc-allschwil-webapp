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
  Users,
  Shield,
  Flag,
  CalendarDays,
  AlertTriangle,
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
import { WEBSITE_SOURCE } from "@/lib/registrations/constants";

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

const STATUS_BADGE: Record<string, string> = {
  NEW: "border-blue-200 bg-blue-50 text-blue-700",
  REVIEWING: "border-amber-200 bg-amber-50 text-amber-700",
  CONTACTED: "border-violet-200 bg-violet-50 text-violet-700",
  ACCEPTED: "border-emerald-200 bg-emerald-50 text-emerald-700",
  REJECTED: "border-red-200 bg-red-50 text-red-700",
  ARCHIVED: "border-slate-200 bg-slate-50 text-slate-400",
};

const STATUS_LABEL: Record<string, string> = {
  NEW: "Neu",
  REVIEWING: "In Prüfung",
  CONTACTED: "Kontaktiert",
  ACCEPTED: "Angenommen",
  REJECTED: "Abgelehnt",
  ARCHIVED: "Archiviert",
};

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
};

export default function RegistrationInboxCard({
  registration,
  onClick,
  isSelected = false,
}: Props) {
  const initials = getInitials(registration.firstName, registration.lastName);
  const typeConfig = TYPE_CONFIG[registration.type] ?? TYPE_CONFIG.OTHER;
  const { Icon: TypeIcon } = typeConfig;
  const statusBadgeClass = STATUS_BADGE[registration.status] ?? STATUS_BADGE.NEW;
  const statusLabel = STATUS_LABEL[registration.status] ?? registration.status;
  const urgency = getUrgencyInfo(registration.submittedAt);

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

  const isWebsiteSource = registration.source === WEBSITE_SOURCE;
  const isPossibleDuplicate =
    registration.payloadJson &&
    typeof registration.payloadJson === "object" &&
    !Array.isArray(registration.payloadJson) &&
    (registration.payloadJson as Record<string, unknown>).possibleDuplicate === true;

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
          : "bg-white hover:bg-[var(--surface-2)]",
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
            {isWebsiteSource && (
              <span className="inline-flex items-center gap-1 h-5 rounded-full border border-indigo-200 bg-indigo-50 px-2 text-[0.65rem] font-semibold text-indigo-700">
                <Globe className="h-3 w-3" aria-hidden />
                Website
              </span>
            )}
          </div>

          {/* Row 2: classification metadata — Jahrgang · Geschlecht · Suggested group */}
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
            {classification.targetGroupKey !== "UNKNOWN" && (
              <>
                <span className="text-[var(--border-strong)] text-[0.65rem]">·</span>
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
              </>
            )}
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
          </div>

          {/* Possible duplicate warning */}
          {isPossibleDuplicate && (
            <div className="mt-1.5 flex items-center gap-1 text-[0.65rem] font-medium text-amber-600">
              <AlertTriangle className="h-3 w-3 flex-shrink-0" aria-hidden />
              Mögliches Duplikat
            </div>
          )}

          {/* Quick actions — hover only on desktop */}
          <div className="mt-2 flex flex-wrap items-center gap-1.5 sm:opacity-0 sm:group-hover/card:opacity-100 sm:transition-opacity sm:duration-150">
            <a
              href={`mailto:${registration.email}`}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
              className="inline-flex items-center h-6 px-2.5 rounded-md border border-[var(--border)] bg-white text-[0.7rem] font-medium text-[var(--text-2)] hover:bg-[var(--surface-2)] hover:text-[var(--foreground)] transition-colors"
            >
              Kontaktieren
            </a>
            <span className="inline-flex items-center h-6 px-2.5 rounded-md border border-[var(--border)] bg-white text-[0.7rem] font-medium text-[var(--text-2)]">
              Öffnen →
            </span>
          </div>
        </div>

        {/* Right meta: urgency dot + age label */}
        <div className="flex-shrink-0 flex flex-col items-end gap-1 pt-0.5">
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
        </div>
      </div>
    </div>
  );
}
