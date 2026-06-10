"use client";

import { useState, useCallback, useEffect, type ComponentType } from "react";
import {
  X,
  Mail,
  Phone,
  User,
  MessageSquare,
  UserCheck,
  Users,
  Hash,
  Calendar,
  ExternalLink,
  Volleyball,
  GraduationCap,
  Handshake,
  ClipboardList,
  Lightbulb,
} from "lucide-react";
import { RegistrationStatus } from "@prisma/client";
import { cn } from "@/lib/cn";
import {
  classifyRegistration,
  extractGenderFromPayload,
  getGenderLabel,
  TARGET_GROUP_COLORS,
} from "@/lib/registrations/classification";
import { formatDate, formatDateTime } from "@/lib/tenant-runtime/formatters";
import type { RegistrationListItem } from "@/lib/registrations/queries";
import { getInitials } from "@/lib/inbox/types";

// ── Types ─────────────────────────────────────────────────────────────────────

export type AssignableUser = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
};

export type TargetGroupOption = {
  id: string;
  name: string;
  key: string;
};

type Props = {
  registration: RegistrationListItem | null;
  tenantSlug: string;
  canEdit: boolean;
  locale?: string;
  timezone?: string;
  assignableUsers?: AssignableUser[];
  targetGroups?: TargetGroupOption[];
  onClose: () => void;
  onUpdate: (updated: RegistrationListItem) => void;
};

// ── Display constants (Lucide icons replace emojis) ───────────────────────────

type TypeCfg = {
  Icon: ComponentType<{ className?: string }>;
  label: string;
  colorClass: string;
};

const TYPE_CONFIG: Record<string, TypeCfg> = {
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
};

const STATUS_OPTIONS = Object.values(RegistrationStatus);

const STATUS_LABELS: Record<RegistrationStatus, string> = {
  NEW: "Neu",
  REVIEWING: "In Prüfung",
  CONTACTED: "Kontaktiert",
  ACCEPTED: "Angenommen",
  REJECTED: "Abgelehnt",
  ARCHIVED: "Archiviert",
};

const STATUS_BADGE: Record<RegistrationStatus, string> = {
  NEW: "border-blue-200 bg-blue-50 text-blue-700",
  REVIEWING: "border-amber-200 bg-amber-50 text-amber-700",
  CONTACTED: "border-violet-200 bg-violet-50 text-violet-700",
  ACCEPTED: "border-emerald-200 bg-emerald-50 text-emerald-700",
  REJECTED: "border-red-200 bg-red-50 text-red-700",
  ARCHIVED: "border-slate-200 bg-slate-50 text-slate-400",
};

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionLabel({ icon: Icon, children }: { icon?: ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-1.5 text-[0.69rem] font-semibold uppercase tracking-[0.1em] text-[var(--muted)] mb-3">
      {Icon && <Icon className="h-3 w-3" aria-hidden />}
      {children}
    </p>
  );
}

function DataRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="sce-data-field">
      <span className="sce-data-label">{label}</span>
      <div className="mt-0.5">{children}</div>
    </div>
  );
}

function OwnerAvatar({ firstName, lastName }: { firstName: string; lastName: string }) {
  const initials = getInitials(firstName, lastName);
  return (
    <span className="inline-flex items-center gap-2">
      <span
        className="inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--tenant-primary)_14%,white)] text-[0.6rem] font-bold uppercase text-[var(--tenant-primary)]"
        aria-hidden
      >
        {initials}
      </span>
      <span className="text-sm font-medium text-[var(--foreground)]">
        {firstName} {lastName}
      </span>
    </span>
  );
}

function getContactName(payloadJson: unknown): string | null {
  if (!payloadJson || typeof payloadJson !== "object" || Array.isArray(payloadJson))
    return null;
  const contactName = (payloadJson as { contactName?: unknown }).contactName;
  return typeof contactName === "string" && contactName.trim()
    ? contactName
    : null;
}

// ── Classification section ────────────────────────────────────────────────────

function ClassificationSection({
  registration,
}: {
  registration: RegistrationListItem;
}) {
  const gender = extractGenderFromPayload(registration.payloadJson);
  const classification = classifyRegistration(
    registration.birthYear,
    gender,
    registration.type,
  );
  const colors = TARGET_GROUP_COLORS[classification.colorToken];

  const isAdult = registration.birthYear
    ? new Date().getFullYear() - registration.birthYear >= 18
    : false;
  const genderLabel = getGenderLabel(gender, isAdult);

  return (
    <div className="px-5 pt-5 pb-4 border-b border-[var(--border)]">
      <SectionLabel icon={Lightbulb}>Vorgeschlagene Zuordnung</SectionLabel>

      <div
        className={cn(
          "rounded-[var(--radius-lg)] border p-3.5",
          colors.border,
          colors.bg,
        )}
      >
        {/* Target group */}
        <div className="flex items-center gap-2 mb-2">
          <span
            className={cn("h-2.5 w-2.5 rounded-full flex-shrink-0", colors.dot)}
            aria-hidden
          />
          <span className={cn("text-sm font-bold", colors.text)}>
            {classification.targetGroupLabel}
          </span>
        </div>

        <div className="grid gap-2 text-xs">
          {/* Reasoning */}
          <div className="flex gap-1.5">
            <span className="text-[0.68rem] font-semibold uppercase tracking-wide opacity-60 w-20 flex-shrink-0">
              Begründung
            </span>
            <span className={cn("font-medium", colors.text)}>
              {classification.reasoning}
              {genderLabel ? ` · ${genderLabel}` : ""}
            </span>
          </div>

          {/* Responsible coordinator */}
          <div className="flex gap-1.5">
            <span className="text-[0.68rem] font-semibold uppercase tracking-wide opacity-60 w-20 flex-shrink-0">
              Zuständig
            </span>
            <span className={cn("font-medium", colors.text)}>
              {classification.coordinatorRole}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main drawer ───────────────────────────────────────────────────────────────

export default function RegistrationDetailDrawer({
  registration: initialRegistration,
  tenantSlug,
  canEdit,
  locale = "de-CH",
  timezone = "Europe/Zurich",
  assignableUsers = [],
  targetGroups = [],
  onClose,
  onUpdate,
}: Props) {
  const [registration, setRegistration] = useState(initialRegistration);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  // Sync when parent changes the selected registration
  useEffect(() => {
    setRegistration(initialRegistration);
    setUpdateError(null);
  }, [initialRegistration]);

  // Slide-in animation: mount → animate in
  useEffect(() => {
    if (initialRegistration) {
      const raf = requestAnimationFrame(() => setIsVisible(true));
      return () => cancelAnimationFrame(raf);
    } else {
      setIsVisible(false);
    }
  }, [initialRegistration]);

  const cfg = { locale, timezone };

  const patchRegistration = useCallback(
    async (patch: Record<string, unknown>) => {
      if (!registration) return;
      setIsUpdating(true);
      setUpdateError(null);
      try {
        const res = await fetch(
          `/api/tenants/${encodeURIComponent(tenantSlug)}/registrations/${encodeURIComponent(registration.id)}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(patch),
          },
        );
        const payload = await res.json();
        if (!res.ok) {
          throw new Error(
            payload.error ?? "Änderung konnte nicht gespeichert werden.",
          );
        }
        const updated = payload.registration as RegistrationListItem;
        setRegistration(updated);
        onUpdate(updated);
      } catch (err) {
        setUpdateError(
          err instanceof Error
            ? err.message
            : "Änderung konnte nicht gespeichert werden.",
        );
      } finally {
        setIsUpdating(false);
      }
    },
    [registration, tenantSlug, onUpdate],
  );

  // Keyboard: close on Escape
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  if (!registration) return null;

  const initials = getInitials(registration.firstName, registration.lastName);
  const typeConfig = TYPE_CONFIG[registration.type] ?? TYPE_CONFIG.OTHER;
  const { Icon: TypeIcon } = typeConfig;
  const contactName = getContactName(registration.payloadJson);
  const detailHref = `/tenant/${tenantSlug}/cockpit/registrations/${registration.id}`;

  return (
    <>
      {/* Backdrop — subtle on desktop, dark on mobile */}
      <div
        className={cn(
          "fixed inset-0 z-40 transition-opacity duration-200",
          "bg-black/15 sm:bg-black/5",
          isVisible ? "opacity-100" : "opacity-0",
        )}
        onClick={onClose}
        aria-hidden
      />

      {/* Drawer panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${registration.firstName} ${registration.lastName} — Details`}
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex flex-col",
          // Width: generous workspace surface — 580px on desktop
          "w-full sm:max-w-[580px] lg:max-w-[620px]",
          "border-l border-[var(--border)] bg-[var(--surface)]",
          "shadow-[var(--shadow-xl)]",
          "overflow-hidden",
          // Slide-in animation
          "transition-transform duration-250 ease-out",
          isVisible ? "translate-x-0" : "translate-x-full",
        )}
        style={{ transitionDuration: "220ms" }}
      >
        {/* ── Header ───────────────────────────────────────────────────────── */}
        <div className="flex-shrink-0 flex items-start gap-4 px-6 py-5 border-b border-[var(--border)] bg-[var(--surface)]">
          {/* Applicant avatar */}
          <div className="flex-shrink-0 h-11 w-11 rounded-full border-2 border-[color-mix(in_srgb,var(--tenant-primary)_20%,white)] bg-[color-mix(in_srgb,var(--tenant-primary)_10%,white)] flex items-center justify-center text-sm font-bold uppercase text-[var(--tenant-primary)]">
            {initials}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-base font-semibold text-[var(--foreground)]">
                {registration.firstName} {registration.lastName}
              </span>
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 h-6 rounded-full border px-2.5 text-[0.7rem] font-semibold",
                  typeConfig.colorClass,
                )}
              >
                <TypeIcon className="h-3.5 w-3.5" aria-hidden />
                <span>{typeConfig.label}</span>
              </span>
              <span
                className={cn(
                  "inline-flex h-6 items-center rounded-full border px-2.5 text-[0.7rem] font-semibold",
                  STATUS_BADGE[registration.status],
                )}
              >
                {STATUS_LABELS[registration.status]}
              </span>
            </div>
            <p className="mt-1 text-xs text-[var(--muted)]">
              {registration.email}
            </p>
          </div>

          <div className="flex-shrink-0 flex items-center gap-1">
            <a
              href={detailHref}
              className="sce-icon-button"
              title="Vollansicht öffnen"
              tabIndex={0}
            >
              <ExternalLink className="h-4 w-4" />
            </a>
            <button
              type="button"
              onClick={onClose}
              className="sce-icon-button"
              aria-label="Schließen"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* ── Scrollable body ──────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">

          {/* Classification / routing suggestion */}
          <ClassificationSection registration={registration} />

          {/* Status + workflow */}
          <div className="px-6 pt-5 pb-5 border-b border-[var(--border)]">
            <SectionLabel icon={UserCheck}>Bearbeitung</SectionLabel>

            {updateError && (
              <div className="mb-4 rounded-[var(--radius-md)] border border-rose-200 bg-rose-50 px-3 py-2 text-[0.75rem] text-rose-700">
                {updateError}
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              {/* Status */}
              <div>
                <p className="sce-data-label mb-1.5">Status</p>
                {canEdit ? (
                  <select
                    value={registration.status}
                    disabled={isUpdating}
                    onChange={(e) =>
                      patchRegistration({ status: e.target.value })
                    }
                    className="fca-select text-xs"
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {STATUS_LABELS[s]}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span
                    className={cn(
                      "inline-flex h-6 items-center rounded-full border px-2.5 text-[0.7rem] font-semibold",
                      STATUS_BADGE[registration.status],
                    )}
                  >
                    {STATUS_LABELS[registration.status]}
                  </span>
                )}
              </div>

              {/* Assignee */}
              <div>
                <p className="sce-data-label mb-1.5">Zugewiesen an</p>
                {canEdit && assignableUsers.length > 0 ? (
                  <select
                    value={registration.assignedToUserId ?? ""}
                    disabled={isUpdating}
                    onChange={(e) =>
                      patchRegistration({
                        assignedToUserId: e.target.value || null,
                      })
                    }
                    className="fca-select text-xs"
                  >
                    <option value="">— Nicht zugewiesen —</option>
                    {assignableUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.firstName} {u.lastName}
                      </option>
                    ))}
                  </select>
                ) : registration.assignedToUser ? (
                  <OwnerAvatar
                    firstName={registration.assignedToUser.firstName}
                    lastName={registration.assignedToUser.lastName}
                  />
                ) : (
                  <span className="sce-data-value-empty text-sm">
                    Nicht zugewiesen
                  </span>
                )}
              </div>

              {/* Target group */}
              {(canEdit && targetGroups.length > 0) ||
              registration.targetGroup ? (
                <div className="sm:col-span-2">
                  <p className="sce-data-label mb-1.5 flex items-center gap-1">
                    <Users className="h-3 w-3" aria-hidden />
                    Zielgruppe
                  </p>
                  {canEdit && targetGroups.length > 0 ? (
                    <select
                      value={registration.targetGroupId ?? ""}
                      disabled={isUpdating}
                      onChange={(e) =>
                        patchRegistration({
                          targetGroupId: e.target.value || null,
                        })
                      }
                      className="fca-select text-xs"
                    >
                      <option value="">— Keine Zielgruppe —</option>
                      {targetGroups.map((tg) => (
                        <option key={tg.id} value={tg.id}>
                          {tg.name}
                        </option>
                      ))}
                    </select>
                  ) : registration.targetGroup ? (
                    <span className="sce-data-value flex items-center gap-1.5 text-sm">
                      <Users className="h-3.5 w-3.5 text-[var(--muted)]" aria-hidden />
                      {registration.targetGroup.name}
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>

            {isUpdating && (
              <p className="mt-3 text-xs text-[var(--muted)]">Wird gespeichert…</p>
            )}
          </div>

          {/* Stammdaten / contact */}
          <div className="px-6 pt-5 pb-5 border-b border-[var(--border)]">
            <SectionLabel icon={User}>Stammdaten</SectionLabel>

            <div className="grid gap-4 sm:grid-cols-2">
              <DataRow label="E-Mail">
                <a
                  href={`mailto:${registration.email}`}
                  className="sce-link-primary flex items-center gap-1.5 text-sm"
                >
                  <Mail className="h-3.5 w-3.5 flex-shrink-0" aria-hidden />
                  {registration.email}
                </a>
              </DataRow>

              {registration.phone ? (
                <DataRow label="Telefon">
                  <a
                    href={`tel:${registration.phone}`}
                    className="sce-link-primary flex items-center gap-1.5 text-sm"
                  >
                    <Phone className="h-3.5 w-3.5 flex-shrink-0" aria-hidden />
                    {registration.phone}
                  </a>
                </DataRow>
              ) : null}

              {registration.birthYear ? (
                <DataRow label="Jahrgang">
                  <span className="sce-data-value text-sm">
                    {registration.birthYear}
                  </span>
                </DataRow>
              ) : null}

              {contactName ? (
                <DataRow label="Kontaktperson">
                  <span className="sce-data-value text-sm">{contactName}</span>
                </DataRow>
              ) : null}

              {registration.source ? (
                <DataRow label="Quelle">
                  <span className="sce-data-value text-sm">
                    {registration.source}
                  </span>
                </DataRow>
              ) : null}
            </div>
          </div>

          {/* Message */}
          <div className="px-6 pt-5 pb-5 border-b border-[var(--border)]">
            <SectionLabel icon={MessageSquare}>Nachricht</SectionLabel>
            {registration.message ? (
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--text-2)]">
                {registration.message}
              </p>
            ) : (
              <p className="text-sm italic text-[var(--muted)]">
                Keine Nachricht hinterlegt.
              </p>
            )}
          </div>

          {/* System metadata */}
          <div className="px-6 pt-5 pb-8">
            <SectionLabel icon={Hash}>Systemdaten</SectionLabel>
            <div className="grid gap-4 sm:grid-cols-2">
              <DataRow label="Eingegangen">
                <span className="sce-data-value flex items-center gap-1.5 text-sm">
                  <Calendar className="h-3.5 w-3.5 text-[var(--muted)]" aria-hidden />
                  {formatDateTime(registration.submittedAt, cfg)}
                </span>
              </DataRow>
              <DataRow label="Zuletzt geändert">
                <span className="sce-data-value text-sm">
                  {formatDate(registration.updatedAt, cfg)}
                </span>
              </DataRow>
              <DataRow label="ID">
                <code className="font-mono text-[0.7rem] text-[var(--muted)]">
                  {registration.id}
                </code>
              </DataRow>
            </div>
          </div>
        </div>

        {/* ── Footer ──────────────────────────────────────────────────────── */}
        <div className="flex-shrink-0 flex items-center justify-between gap-3 px-6 py-4 border-t border-[var(--border)] bg-[var(--surface-2)]">
          <a
            href={`mailto:${registration.email}`}
            className="fca-button-secondary text-xs gap-1.5"
          >
            <Mail className="h-3.5 w-3.5" aria-hidden />
            Kontaktieren
          </a>
          <a
            href={detailHref}
            className="fca-button-primary text-xs gap-1.5"
          >
            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            Vollansicht
          </a>
        </div>
      </div>
    </>
  );
}
