"use client";

import Link from "next/link";
import { useState } from "react";
import { RegistrationStatus } from "@prisma/client";
import {
  ArrowLeft,
  Calendar,
  Clock,
  Hash,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  User,
  UserCheck,
} from "lucide-react";
import { getRoutingSuggestion } from "@/lib/registrations/routing-suggestion";
import type { RegistrationDetail } from "@/lib/registrations/queries";

type RegistrationDetailCardProps = {
  tenantSlug: string;
  initialRegistration: RegistrationDetail;
  canEdit: boolean;
};

const TYPE_LABELS: Record<string, string> = {
  PROBETRAINING: "Probetraining",
  SPIELERANMELDUNG: "Spieleranmeldung",
  TRAINERANMELDUNG: "Traineranmeldung",
  SPONSORANFRAGE: "Sponsoranfrage",
  KONTAKTANFRAGE: "Kontaktanfrage",
  OTHER: "Andere",
};

const STATUS_LABELS: Record<RegistrationStatus, string> = {
  NEW: "Neu",
  REVIEWING: "In Prüfung",
  CONTACTED: "Kontaktiert",
  ACCEPTED: "Angenommen",
  REJECTED: "Abgelehnt",
  ARCHIVED: "Archiviert",
};

const STATUS_HERO_CLASS: Record<RegistrationStatus, string> = {
  NEW: "border-blue-300/60 bg-blue-500/20 text-blue-200",
  REVIEWING: "border-amber-300/60 bg-amber-500/20 text-amber-200",
  CONTACTED: "border-violet-300/60 bg-violet-500/20 text-violet-200",
  ACCEPTED: "border-emerald-300/60 bg-emerald-500/20 text-emerald-200",
  REJECTED: "border-red-300/60 bg-red-500/20 text-red-200",
  ARCHIVED: "border-white/20 bg-white/10 text-white/50",
};

const STATUS_BADGE_CLASS: Record<RegistrationStatus, string> = {
  NEW: "border-blue-200 bg-blue-50 text-blue-700",
  REVIEWING: "border-amber-200 bg-amber-50 text-amber-700",
  CONTACTED: "border-violet-200 bg-violet-50 text-violet-700",
  ACCEPTED: "border-emerald-200 bg-emerald-50 text-emerald-700",
  REJECTED: "border-red-200 bg-red-50 text-red-700",
  ARCHIVED: "border-slate-200 bg-slate-50 text-slate-400",
};

const STATUS_OPTIONS = Object.values(RegistrationStatus);

function formatDate(value: string) {
  return new Intl.DateTimeFormat("de-CH", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatDateShort(value: string) {
  return new Intl.DateTimeFormat("de-CH", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(value));
}

function getInitials(firstName: string, lastName: string) {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

function getContactName(payloadJson: unknown): string | null {
  if (
    !payloadJson ||
    typeof payloadJson !== "object" ||
    Array.isArray(payloadJson)
  ) {
    return null;
  }
  const contactName = (payloadJson as { contactName?: unknown }).contactName;
  return typeof contactName === "string" && contactName.trim()
    ? contactName
    : null;
}

function DataField({
  label,
  value,
  icon,
  href,
}: {
  label: string;
  value: string | null | undefined;
  icon?: React.ReactNode;
  href?: string;
}) {
  return (
    <div className="sce-data-field">
      <span className="sce-data-label">{label}</span>
      {value ? (
        href ? (
          <a
            href={href}
            className="sce-data-value flex items-center gap-1.5 text-[var(--blue)] hover:underline"
          >
            {icon ? (
              <span className="text-[var(--muted)]">{icon}</span>
            ) : null}
            {value}
          </a>
        ) : (
          <span className="sce-data-value flex items-center gap-1.5">
            {icon ? (
              <span className="text-[var(--muted)]">{icon}</span>
            ) : null}
            {value}
          </span>
        )
      ) : (
        <span className="sce-data-value-empty">—</span>
      )}
    </div>
  );
}

export default function RegistrationDetailCard({
  tenantSlug,
  initialRegistration,
  canEdit,
}: RegistrationDetailCardProps) {
  const [registration, setRegistration] = useState(initialRegistration);
  const [isUpdating, setIsUpdating] = useState(false);

  const routingSuggestion = getRoutingSuggestion(registration.birthYear);
  const contactName = getContactName(registration.payloadJson);
  const initials = getInitials(registration.firstName, registration.lastName);
  const typeLabel = TYPE_LABELS[registration.type] ?? registration.type;
  const backHref = `/tenant/${tenantSlug}/cockpit/registrations`;

  async function updateStatus(status: RegistrationStatus) {
    setIsUpdating(true);

    try {
      const response = await fetch(
        `/api/tenants/${encodeURIComponent(tenantSlug)}/registrations/${encodeURIComponent(registration.id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        },
      );

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(
          payload.error ?? "Status konnte nicht aktualisiert werden.",
        );
      }

      setRegistration(payload.registration);
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Status konnte nicht aktualisiert werden.",
      );
    } finally {
      setIsUpdating(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <div className="sce-entity-hero">
        <div className="relative z-10 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          {/* Identity */}
          <div className="flex items-center gap-5">
            <div className="sce-avatar-xl">{initials}</div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/60">
                {typeLabel}
              </p>
              <h1
                className="mt-1 text-2xl font-bold text-white"
                style={{
                  fontFamily: "var(--font-display)",
                  letterSpacing: "-0.01em",
                }}
              >
                {registration.firstName} {registration.lastName}
              </h1>
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                {/* Status badge — reactive to state updates */}
                <span
                  className={`inline-flex h-5 items-center rounded-full border px-2.5 text-[0.65rem] font-semibold ${STATUS_HERO_CLASS[registration.status]}`}
                >
                  {STATUS_LABELS[registration.status]}
                </span>
                {/* Routing suggestion */}
                {routingSuggestion ? (
                  <span className="inline-flex h-5 items-center gap-1 rounded-full border border-white/20 bg-white/10 px-2.5 text-[0.65rem] font-semibold text-white/80">
                    <MapPin className="h-2.5 w-2.5" />
                    {routingSuggestion}
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          {/* Back action */}
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={backHref}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-white/80 backdrop-blur-sm transition hover:bg-white/20 hover:text-white"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Zurück zur Inbox
            </Link>
          </div>
        </div>

        {/* Quick-info strip */}
        <div className="relative z-10 mt-6 flex flex-wrap gap-6 border-t border-white/15 pt-4">
          <div className="flex items-center gap-2 text-sm text-white/80">
            <Mail className="h-4 w-4 text-white/60" />
            <span>{registration.email}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-white/80">
            <Clock className="h-4 w-4 text-white/60" />
            <span>
              Eingegangen:{" "}
              <span className="font-semibold text-white">
                {formatDate(registration.submittedAt)}
              </span>
            </span>
          </div>
          {registration.birthYear ? (
            <div className="flex items-center gap-2 text-sm text-white/80">
              <User className="h-4 w-4 text-white/60" />
              <span>
                Jahrgang{" "}
                <span className="font-semibold text-white">
                  {registration.birthYear}
                </span>
              </span>
            </div>
          ) : null}
        </div>
      </div>

      {/* ── Content grid ──────────────────────────────────────────────────── */}
      <div className="grid gap-5 xl:grid-cols-[1fr_320px]">
        {/* Main column */}
        <div className="space-y-5">
          {/* Kontaktdaten */}
          <div className="sce-detail-section">
            <div className="sce-detail-section-header">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-[var(--muted)]" />
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
                  Kontaktdaten
                </p>
              </div>
            </div>
            <div className="sce-detail-section-body grid gap-5 sm:grid-cols-2">
              <DataField
                label="E-Mail"
                value={registration.email}
                icon={<Mail className="h-3.5 w-3.5" />}
                href={`mailto:${registration.email}`}
              />
              <DataField
                label="Telefon"
                value={registration.phone}
                icon={<Phone className="h-3.5 w-3.5" />}
                href={registration.phone ? `tel:${registration.phone}` : undefined}
              />
              <DataField
                label="Jahrgang"
                value={
                  registration.birthYear
                    ? String(registration.birthYear)
                    : null
                }
              />
              <DataField label="Kontaktperson" value={contactName} />
              {routingSuggestion ? (
                <div className="sce-data-field">
                  <span className="sce-data-label">Routing-Vorschlag</span>
                  <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--blue)]">
                    <MapPin className="h-3.5 w-3.5" />
                    {routingSuggestion}
                  </span>
                </div>
              ) : (
                <DataField label="Routing-Vorschlag" value={null} />
              )}
              <DataField label="Quelle" value={registration.source} />
            </div>
          </div>

          {/* Nachricht */}
          <div className="sce-detail-section">
            <div className="sce-detail-section-header">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-[var(--muted)]" />
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
                  Nachricht
                </p>
              </div>
            </div>
            <div className="sce-detail-section-body">
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
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-5">
          {/* Bearbeitung */}
          <div className="sce-detail-section">
            <div className="sce-detail-section-header">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
                Bearbeitung
              </p>
              <span
                className={`inline-flex h-5 items-center rounded-full border px-2 text-[0.65rem] font-semibold ${STATUS_BADGE_CLASS[registration.status]}`}
              >
                {STATUS_LABELS[registration.status]}
              </span>
            </div>
            <div className="sce-detail-section-body space-y-4">
              <div className="sce-data-field">
                <span className="sce-data-label">Status</span>
                {canEdit ? (
                  <select
                    value={registration.status}
                    disabled={isUpdating}
                    onChange={(e) =>
                      updateStatus(e.target.value as RegistrationStatus)
                    }
                    className="fca-select mt-1"
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {STATUS_LABELS[s]}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span
                    className={`mt-1 inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${STATUS_BADGE_CLASS[registration.status]}`}
                  >
                    {STATUS_LABELS[registration.status]}
                  </span>
                )}
              </div>

              <div className="sce-data-field">
                <span className="sce-data-label">Zugewiesen an</span>
                {registration.assignedToUser ? (
                  <span className="sce-data-value flex items-center gap-1.5">
                    <UserCheck className="h-3.5 w-3.5 text-[var(--muted)]" />
                    {registration.assignedToUser.firstName}{" "}
                    {registration.assignedToUser.lastName}
                  </span>
                ) : (
                  <span className="sce-data-value-empty">Nicht zugewiesen</span>
                )}
              </div>

              {isUpdating ? (
                <p className="text-xs text-[var(--muted)]">
                  Status wird gespeichert…
                </p>
              ) : null}
            </div>
          </div>

          {/* Systemdaten */}
          <div className="sce-detail-section">
            <div className="sce-detail-section-header">
              <div className="flex items-center gap-2">
                <Hash className="h-4 w-4 text-[var(--muted)]" />
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
                  Systemdaten
                </p>
              </div>
            </div>
            <div className="sce-detail-section-body space-y-4">
              <div className="sce-data-field">
                <span className="sce-data-label">Eingegangen</span>
                <span className="sce-data-value flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-[var(--muted)]" />
                  {formatDateShort(registration.submittedAt)}
                </span>
              </div>
              <div className="sce-data-field">
                <span className="sce-data-label">Erstellt</span>
                <span className="sce-data-value">
                  {formatDateShort(registration.createdAt)}
                </span>
              </div>
              <div className="sce-data-field">
                <span className="sce-data-label">Zuletzt geändert</span>
                <span className="sce-data-value">
                  {formatDateShort(registration.updatedAt)}
                </span>
              </div>
              <div className="sce-data-field">
                <span className="sce-data-label">ID</span>
                <code className="font-mono text-[0.72rem] text-[var(--muted)]">
                  {registration.id}
                </code>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
