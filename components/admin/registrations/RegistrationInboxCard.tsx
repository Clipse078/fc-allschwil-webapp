"use client";

import { useCallback } from "react";
import { Mail, UserCheck } from "lucide-react";
import { cn } from "@/lib/cn";
import type { RegistrationListItem } from "@/lib/registrations/queries";

// ── Type visual config ───────────────────────────────────────────────────────

const TYPE_CONFIG: Record<
  string,
  { icon: string; label: string; colorClass: string }
> = {
  PROBETRAINING: {
    icon: "⚽",
    label: "Probetraining",
    colorClass: "border-blue-200 bg-blue-50 text-blue-700",
  },
  SPIELERANMELDUNG: {
    icon: "👤",
    label: "Spieler",
    colorClass: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  TRAINERANMELDUNG: {
    icon: "🎓",
    label: "Trainer",
    colorClass: "border-orange-200 bg-orange-50 text-orange-700",
  },
  SPONSORANFRAGE: {
    icon: "🤝",
    label: "Sponsor",
    colorClass: "border-amber-200 bg-amber-50 text-amber-700",
  },
  KONTAKTANFRAGE: {
    icon: "💬",
    label: "Kontakt",
    colorClass: "border-slate-200 bg-slate-50 text-slate-600",
  },
  OTHER: {
    icon: "📋",
    label: "Andere",
    colorClass: "border-slate-200 bg-slate-50 text-slate-400",
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

// ── Urgency helpers ──────────────────────────────────────────────────────────

type Urgency = "ok" | "warn" | "alert";

function getRelativeAge(isoDate: string): { label: string; urgency: Urgency } {
  const diffMs = Date.now() - new Date(isoDate).getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return { label: "Heute", urgency: "ok" };
  if (diffDays === 1) return { label: "Vor 1 Tag", urgency: "ok" };
  if (diffDays < 7) return { label: `Vor ${diffDays} Tagen`, urgency: "warn" };
  return { label: `${diffDays} Tage offen`, urgency: "alert" };
}

const URGENCY_DOT: Record<Urgency, string> = {
  ok: "bg-emerald-400",
  warn: "bg-amber-400",
  alert: "bg-red-500",
};

function getInitials(firstName: string, lastName: string) {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

// ── Component ────────────────────────────────────────────────────────────────

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
  const statusBadgeClass = STATUS_BADGE[registration.status] ?? STATUS_BADGE.NEW;
  const statusLabel = STATUS_LABEL[registration.status] ?? registration.status;
  const age = getRelativeAge(registration.submittedAt);

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
        {/* Avatar */}
        <div className="flex-shrink-0 mt-0.5 flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface-2)] text-xs font-bold uppercase text-[var(--blue)]">
          {initials}
        </div>

        {/* Main content */}
        <div className="min-w-0 flex-1">
          {/* Row 1: name + type badge + status */}
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
              <span aria-hidden>{typeConfig.icon}</span>
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
          </div>

          {/* Row 2: email */}
          <div className="mt-1 flex items-center gap-1.5 text-xs text-[var(--muted)]">
            <Mail className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">{registration.email}</span>
          </div>

          {/* Quick actions — visible on hover (desktop) / always visible (mobile) */}
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5 sm:opacity-0 sm:group-hover/card:opacity-100 sm:transition-opacity sm:duration-150">
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

        {/* Right meta: urgency + assignee */}
        <div className="flex-shrink-0 flex flex-col items-end gap-1.5 pt-0.5">
          {/* Urgency dot + age */}
          <div className="flex items-center gap-1.5">
            <span
              className={cn(
                "h-2 w-2 rounded-full flex-shrink-0",
                URGENCY_DOT[age.urgency],
              )}
              title={
                age.urgency === "alert"
                  ? "Dringend — 7+ Tage offen"
                  : age.urgency === "warn"
                    ? "3+ Tage offen"
                    : "Neu"
              }
            />
            <span className="text-[0.7rem] text-[var(--muted)] whitespace-nowrap">
              {age.label}
            </span>
          </div>

          {/* Assignee */}
          {registration.assignedToUser ? (
            <span className="hidden sm:flex items-center gap-1 text-[0.65rem] text-[var(--muted)]">
              <UserCheck className="h-3 w-3" />
              {registration.assignedToUser.firstName}
            </span>
          ) : (
            <span className="hidden sm:block text-[0.65rem] text-[var(--muted)] italic">
              Nicht zugewiesen
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
