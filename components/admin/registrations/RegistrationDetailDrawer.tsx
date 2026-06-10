"use client";

import { useState, useCallback, useEffect } from "react";
import {
  X,
  Mail,
  Phone,
  User,
  MessageSquare,
  MapPin,
  UserCheck,
  Users,
  Hash,
  Calendar,
  ExternalLink,
} from "lucide-react";
import { RegistrationStatus } from "@prisma/client";
import { cn } from "@/lib/cn";
import { getRoutingSuggestion } from "@/lib/registrations/routing-suggestion";
import { formatDate, formatDateTime } from "@/lib/tenant-runtime/formatters";
import type { RegistrationListItem } from "@/lib/registrations/queries";

// ── Types ────────────────────────────────────────────────────────────────────

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

// ── Display constants ────────────────────────────────────────────────────────

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

// ── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(firstName: string, lastName: string) {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

function getContactName(payloadJson: unknown): string | null {
  if (!payloadJson || typeof payloadJson !== "object" || Array.isArray(payloadJson))
    return null;
  const contactName = (payloadJson as { contactName?: unknown }).contactName;
  return typeof contactName === "string" && contactName.trim()
    ? contactName
    : null;
}

// ── Sub-components ───────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[0.69rem] font-semibold uppercase tracking-[0.1em] text-[var(--muted)] mb-3">
      {children}
    </p>
  );
}

function DataRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="sce-data-field">
      <span className="sce-data-label">{label}</span>
      <div className="mt-0.5">{children}</div>
    </div>
  );
}

// ── Main drawer ──────────────────────────────────────────────────────────────

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

  // Sync when parent changes the selected registration
  useEffect(() => {
    setRegistration(initialRegistration);
    setUpdateError(null);
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
  const contactName = getContactName(registration.payloadJson);
  const routingSuggestion = getRoutingSuggestion(registration.birthYear);
  const detailHref = `/tenant/${tenantSlug}/cockpit/registrations/${registration.id}`;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/10 sm:bg-transparent"
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
          "w-full max-w-[480px]",
          "border-l border-[var(--border)] bg-[var(--surface)]",
          "shadow-[var(--shadow-xl)]",
          "overflow-hidden",
        )}
      >
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex-shrink-0 flex items-start gap-3 px-5 py-4 border-b border-[var(--border)] bg-[var(--surface)]">
          {/* Avatar */}
          <div className="flex-shrink-0 h-10 w-10 rounded-full border border-[var(--border)] bg-[color-mix(in_srgb,var(--tenant-primary)_10%,white)] flex items-center justify-center text-sm font-bold uppercase text-[var(--tenant-primary)]">
            {initials}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-[var(--foreground)]">
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
            </div>
            <p className="mt-0.5 text-xs text-[var(--muted)]">
              {registration.email}
            </p>
          </div>

          <div className="flex-shrink-0 flex items-center gap-1.5">
            {/* Open full detail page */}
            <a
              href={detailHref}
              className="sce-icon-button"
              title="Vollansicht öffnen"
              tabIndex={0}
            >
              <ExternalLink className="h-4 w-4" />
            </a>
            {/* Close */}
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

          {/* Status + workflow section */}
          <div className="px-5 pt-5 pb-4 border-b border-[var(--border)]">
            <SectionLabel>Bearbeitung</SectionLabel>

            {updateError && (
              <div className="mb-3 rounded-[var(--radius-md)] border border-rose-200 bg-rose-50 px-3 py-2 text-[0.75rem] text-rose-700">
                {updateError}
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              {/* Status */}
              <div>
                <p className="sce-data-label mb-1">Status</p>
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
                <p className="sce-data-label mb-1 flex items-center gap-1">
                  <UserCheck className="h-3 w-3" />
                  Zugewiesen an
                </p>
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
                  <span className="sce-data-value flex items-center gap-1.5 text-sm">
                    <UserCheck className="h-3.5 w-3.5 text-[var(--muted)]" />
                    {registration.assignedToUser.firstName}{" "}
                    {registration.assignedToUser.lastName}
                  </span>
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
                  <p className="sce-data-label mb-1 flex items-center gap-1">
                    <Users className="h-3 w-3" />
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
                      <Users className="h-3.5 w-3.5 text-[var(--muted)]" />
                      {registration.targetGroup.name}
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>

            {isUpdating && (
              <p className="mt-2 text-xs text-[var(--muted)]">
                Wird gespeichert…
              </p>
            )}
          </div>

          {/* Contact section */}
          <div className="px-5 pt-5 pb-4 border-b border-[var(--border)]">
            <SectionLabel>
              <User className="inline h-3 w-3 mr-1" />
              Stammdaten
            </SectionLabel>

            <div className="grid gap-3 sm:grid-cols-2">
              <DataRow label="E-Mail">
                <a
                  href={`mailto:${registration.email}`}
                  className="sce-link-primary flex items-center gap-1.5 text-sm"
                >
                  <Mail className="h-3.5 w-3.5 flex-shrink-0" />
                  {registration.email}
                </a>
              </DataRow>

              {registration.phone ? (
                <DataRow label="Telefon">
                  <a
                    href={`tel:${registration.phone}`}
                    className="sce-link-primary flex items-center gap-1.5 text-sm"
                  >
                    <Phone className="h-3.5 w-3.5 flex-shrink-0" />
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

              {routingSuggestion ? (
                <DataRow label="Routing-Vorschlag">
                  <span className="flex items-center gap-1.5 text-sm font-semibold text-[var(--blue)]">
                    <MapPin className="h-3.5 w-3.5" />
                    {routingSuggestion}
                  </span>
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

          {/* Message section */}
          <div className="px-5 pt-5 pb-4 border-b border-[var(--border)]">
            <SectionLabel>
              <MessageSquare className="inline h-3 w-3 mr-1" />
              Nachricht
            </SectionLabel>
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
          <div className="px-5 pt-5 pb-6">
            <SectionLabel>
              <Hash className="inline h-3 w-3 mr-1" />
              Systemdaten
            </SectionLabel>
            <div className="grid gap-3 sm:grid-cols-2">
              <DataRow label="Eingegangen">
                <span className="sce-data-value flex items-center gap-1.5 text-sm">
                  <Calendar className="h-3.5 w-3.5 text-[var(--muted)]" />
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
        <div className="flex-shrink-0 flex items-center justify-between gap-3 px-5 py-3 border-t border-[var(--border)] bg-[var(--surface-2)]">
          <a
            href={`mailto:${registration.email}`}
            className="fca-button-secondary text-xs gap-1.5"
          >
            <Mail className="h-3.5 w-3.5" />
            Kontaktieren
          </a>
          <a
            href={detailHref}
            className="fca-button-primary text-xs gap-1.5"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Vollansicht
          </a>
        </div>
      </div>
    </>
  );
}
