"use client";

import Link from "next/link";
import { useState } from "react";
import { RegistrationStatus } from "@prisma/client";
import {
  ArrowLeft,
  Baby,
  Building2,
  Calendar,
  CheckCircle,
  Clock,
  Code2,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  Globe,
  Hash,
  HelpCircle,
  Mail,
  MapPin,
  MessageSquare,
  PenLine,
  Phone,
  Smartphone,
  User,
  Users,
  Volleyball,
} from "lucide-react";
import type { ComponentType } from "react";
import { cn } from "@/lib/cn";
import { getRoutingSuggestion } from "@/lib/registrations/routing-suggestion";
import type { RegistrationDetail } from "@/lib/registrations/queries";
import {
  formatDate,
  formatDateShort,
  formatTime,
} from "@/lib/tenant-runtime/formatters";
import {
  extractGenderFromPayload,
  getGenderLabel,
} from "@/lib/registrations/classification";
import {
  formatCompactAddressLines,
  getRegistrationDetailFields,
} from "@/lib/registrations/detail-view";
import {
  getRegistrationSourceInfo,
  type RegistrationSourceKey,
} from "@/lib/registrations/source";
import {
  STATUS_ORDER,
  STATUS_LABELS as SHARED_STATUS_LABELS,
  STATUS_HERO_CLASS as SHARED_STATUS_HERO_CLASS,
  STATUS_BADGE_CLASS as SHARED_STATUS_BADGE_CLASS,
} from "@/lib/registrations/status";
import type { AssignableUser, TargetGroupOption } from "@/lib/registrations/workflow-types";
import RegistrationWorkflowPanel from "./RegistrationWorkflowPanel";

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

const NOT_PROVIDED = "Nicht angegeben";

type RegistrationDetailCardProps = {
  tenantSlug: string;
  initialRegistration: RegistrationDetail;
  canEdit: boolean;
  /** Tenant locale (e.g. "de-CH"). Falls back to "de-CH" when absent. */
  locale?: string;
  /** Tenant timezone (e.g. "Europe/Zurich"). Falls back to "Europe/Zurich" when absent. */
  timezone?: string;
  /** Active users available for assignment. */
  assignableUsers?: AssignableUser[];
  /** Active target groups for routing. */
  targetGroups?: TargetGroupOption[];
};

const TYPE_LABELS: Record<string, string> = {
  PROBETRAINING: "Probetraining",
  SPIELERANMELDUNG: "Spieleranmeldung",
  TRAINERANMELDUNG: "Traineranmeldung",
  SPONSORANFRAGE: "Sponsoranfrage",
  KONTAKTANFRAGE: "Kontaktanfrage",
  OTHER: "Andere",
  // Website-integration types
  MITGLIEDSCHAFT: "Mitgliedschaft",
  FREIWILLIGENMELDUNG: "Freiwilligenmeldung",
  SCHIEDSRICHTERANMELDUNG: "Schiedsrichteranmeldung",
  CAMP_ANMELDUNG: "Camp-Anmeldung",
  VERANSTALTUNGSANMELDUNG: "Veranstaltungsanmeldung",
};

// REGISTRATION-01F — Goal 8: status metadata now lives in one shared module
// (lib/registrations/status.ts).
const STATUS_LABELS = SHARED_STATUS_LABELS;
const STATUS_HERO_CLASS = SHARED_STATUS_HERO_CLASS;
const STATUS_BADGE_CLASS = SHARED_STATUS_BADGE_CLASS;
const STATUS_OPTIONS = STATUS_ORDER;


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
  breakAll = false,
}: {
  label: string;
  value: string | null | undefined;
  icon?: React.ReactNode;
  href?: string;
  /** Goal 7 (REGISTRATION-01E): prevent long unbroken strings (emails, URLs). */
  breakAll?: boolean;
}) {
  return (
    <div className="sce-data-field">
      <span className="sce-data-label">{label}</span>
      {value ? (
        href ? (
          <a
            href={href}
            className={cn(
              "sce-data-value flex items-center gap-1.5 text-[var(--blue)] hover:underline",
              breakAll && "break-all",
            )}
          >
            {icon ? (
              <span className="text-[var(--muted)]">{icon}</span>
            ) : null}
            {value}
          </a>
        ) : (
          <span
            className={cn(
              "sce-data-value flex items-center gap-1.5",
              breakAll && "break-all",
            )}
          >
            {icon ? (
              <span className="text-[var(--muted)]">{icon}</span>
            ) : null}
            {value}
          </span>
        )
      ) : (
        // Goal 6 (REGISTRATION-01D): never a bare dash — always distinguish
        // "not collected" from a rendering bug.
        <span className="sce-data-value-empty">{NOT_PROVIDED}</span>
      )}
    </div>
  );
}

/**
 * Tri-state consent row: true → accepted styling, false → declined styling,
 * null/undefined (never submitted/collected) → neutral "Nicht angegeben".
 */
function ConsentField({
  label,
  value,
  trueLabel,
  falseLabel,
}: {
  label: string;
  value: boolean | null;
  trueLabel: string;
  falseLabel: string;
}) {
  const state = value === true ? "true" : value === false ? "false" : "unknown";
  return (
    <div className="sce-data-field">
      <span className="sce-data-label">{label}</span>
      <span className="flex items-center gap-1.5">
        <span
          className={
            "inline-flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full text-[0.6rem] " +
            (state === "true"
              ? "bg-emerald-100 text-emerald-700"
              : state === "false"
                ? "bg-red-100 text-red-700"
                : "bg-slate-100 text-slate-400")
          }
          aria-hidden
        >
          {state === "true" ? "✓" : state === "false" ? "✗" : "—"}
        </span>
        <span
          className={
            state === "unknown"
              ? "sce-data-value-empty"
              : state === "true"
                ? "text-sm font-medium text-emerald-700"
                : "text-sm font-medium text-red-700"
          }
        >
          {state === "true" ? trueLabel : state === "false" ? falseLabel : NOT_PROVIDED}
        </span>
      </span>
    </div>
  );
}

export default function RegistrationDetailCard({
  tenantSlug,
  initialRegistration,
  canEdit,
  locale = "de-CH",
  timezone = "Europe/Zurich",
  assignableUsers = [],
  targetGroups = [],
}: RegistrationDetailCardProps) {
  const [registration, setRegistration] = useState(initialRegistration);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);

  const cfg = { locale, timezone };

  const routingSuggestion = getRoutingSuggestion(registration.birthYear);
  const contactName = getContactName(registration.payloadJson);
  const initials = getInitials(registration.firstName, registration.lastName);
  const typeLabel = TYPE_LABELS[registration.type] ?? registration.type;
  const backHref = `/tenant/${tenantSlug}/cockpit/registrations`;

  // Goal 3/4 (REGISTRATION-01D): normalized read-model covering every field
  // collected across the pipeline (website → API → DB → payloadJson).
  const fields = getRegistrationDetailFields(registration);
  const genderCode = extractGenderFromPayload(registration.payloadJson);
  const isAdultForGender = registration.birthYear
    ? new Date().getFullYear() - registration.birthYear >= 18
    : false;
  const genderDisplayLabel = getGenderLabel(genderCode, isAdultForGender) ?? fields.player.gender;

  // Goal 6 (REGISTRATION-01E): presentation-only source label — ingestion
  // still always writes "WEBSITE" today (see lib/registrations/source.ts).
  const sourceInfo = getRegistrationSourceInfo(registration.source);
  const SourceIcon = sourceInfo ? SOURCE_ICON[sourceInfo.key] : null;
  const addressLines = formatCompactAddressLines(fields.address);

  async function patchRegistration(patch: Record<string, unknown>) {
    setIsUpdating(true);
    setUpdateError(null);
    try {
      const response = await fetch(
        `/api/tenants/${encodeURIComponent(tenantSlug)}/registrations/${encodeURIComponent(registration.id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        },
      );

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(
          payload.error ?? "Änderung konnte nicht gespeichert werden.",
        );
      }

      setRegistration(payload.registration);
    } catch (error) {
      setUpdateError(
        error instanceof Error
          ? error.message
          : "Änderung konnte nicht gespeichert werden.",
      );
    } finally {
      setIsUpdating(false);
    }
  }

  function updateStatus(status: RegistrationStatus) {
    return patchRegistration({ status });
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
                {/* Target group badge (if assigned) */}
                {registration.targetGroup ? (
                  <span className="inline-flex h-5 items-center gap-1 rounded-full border border-emerald-300/60 bg-emerald-500/20 px-2.5 text-[0.65rem] font-semibold text-emerald-200">
                    <Users className="h-2.5 w-2.5" />
                    {registration.targetGroup.name}
                  </span>
                ) : routingSuggestion ? (
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
          <div className="flex min-w-0 items-center gap-2 text-sm text-white/80">
            <Mail className="h-4 w-4 flex-shrink-0 text-white/60" />
            <span className="break-all">{registration.email}</span>
          </div>
          {/* Goal 2 (REGISTRATION-01D): "Registriert" — date + time immediately
              visible in the hero, never requires scrolling to Systemdaten. */}
          <div className="flex items-center gap-2 text-sm text-white/80">
            <Clock className="h-4 w-4 text-white/60" />
            <span>
              Registriert:{" "}
              <span className="font-semibold text-white tabular-nums">
                {formatDateShort(registration.submittedAt, cfg)}
              </span>{" "}
              <span className="text-white/50" aria-hidden>
                ·
              </span>{" "}
              <span className="font-semibold text-white tabular-nums">
                {formatTime(registration.submittedAt, cfg)}
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
          {/* Goal 6 (REGISTRATION-01E): presentation-only source label. */}
          {sourceInfo && (
            <div className="flex items-center gap-2 text-sm text-white/80">
              {SourceIcon ? <SourceIcon className="h-4 w-4 text-white/60" /> : null}
              <span>
                Quelle: <span className="font-semibold text-white">{sourceInfo.label}</span>
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Content grid ──────────────────────────────────────────────────── */}
      <div className="grid gap-5 xl:grid-cols-[1fr_320px]">
        {/* Main column */}
        <div className="space-y-5">
          {/* REGISTRATION-01F: team recommendation actions, person lookup/
              creation, assignment workflow, duplicate workflow, timeline. */}
          <RegistrationWorkflowPanel
            registration={registration}
            tenantSlug={tenantSlug}
            canEdit={canEdit}
            locale={locale}
            timezone={timezone}
            assignableUsers={assignableUsers}
            targetGroups={targetGroups}
            onUpdate={setRegistration}
          />

          {/* Spieler (Player) */}
          <div className="sce-detail-section">
            <div className="sce-detail-section-header">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-[var(--muted)]" />
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
                  Spieler
                </p>
              </div>
            </div>
            <div className="sce-detail-section-body grid gap-5 sm:grid-cols-2">
              <DataField label="Vorname" value={fields.player.firstName} />
              <DataField label="Nachname" value={fields.player.lastName} />
              <DataField label="Geschlecht" value={genderDisplayLabel} />
              <DataField
                label="Geburtsdatum"
                value={fields.player.birthDate ? formatDate(fields.player.birthDate, cfg) : null}
              />
              <DataField
                label="Jahrgang"
                value={fields.player.birthYear ? String(fields.player.birthYear) : null}
              />
              <DataField label="Nationalität" value={fields.player.nationality} />
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
            </div>
          </div>

          {/* Adresse (Address) — Goal 3 (REGISTRATION-01E): compact block
              instead of five separate rows. Underlying fields are unchanged. */}
          <div className="sce-detail-section">
            <div className="sce-detail-section-header">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-[var(--muted)]" />
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
                  Adresse
                </p>
              </div>
            </div>
            <div className="sce-detail-section-body">
              {addressLines.length > 0 ? (
                <address className="not-italic text-sm leading-relaxed text-[var(--foreground)] break-words">
                  {addressLines.map((line, i) => (
                    <span key={i} className="block">
                      {line}
                    </span>
                  ))}
                </address>
              ) : (
                <span className="sce-data-value-empty">{NOT_PROVIDED}</span>
              )}
            </div>
          </div>

          {/* Kontakt (Contact) */}
          <div className="sce-detail-section">
            <div className="sce-detail-section-header">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-[var(--muted)]" />
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
                  Kontakt
                </p>
              </div>
            </div>
            <div className="sce-detail-section-body grid gap-5 sm:grid-cols-2">
              <DataField
                label="E-Mail"
                value={fields.contact.email}
                icon={<Mail className="h-3.5 w-3.5" />}
                href={`mailto:${fields.contact.email}`}
                breakAll
              />
              <DataField
                label="Telefon"
                value={fields.contact.phone}
                icon={<Phone className="h-3.5 w-3.5" />}
                href={fields.contact.phone ? `tel:${fields.contact.phone}` : undefined}
              />
              <DataField label="Kontaktperson" value={contactName} />
            </div>
          </div>

          {/* Erziehungsberechtigte/r (Parent / Guardian) */}
          <div className="sce-detail-section">
            <div className="sce-detail-section-header">
              <div className="flex items-center gap-2">
                <Baby className="h-4 w-4 text-[var(--muted)]" />
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
                  Erziehungsberechtigte/r
                </p>
              </div>
            </div>
            <div className="sce-detail-section-body grid gap-5 sm:grid-cols-2">
              <DataField label="Name" value={fields.parent?.name ?? null} />
              <DataField
                label="E-Mail"
                value={fields.parent?.email ?? null}
                icon={fields.parent?.email ? <Mail className="h-3.5 w-3.5" /> : undefined}
                href={fields.parent?.email ? `mailto:${fields.parent.email}` : undefined}
                breakAll
              />
              <DataField
                label="Telefon"
                value={fields.parent?.phone ?? null}
                icon={fields.parent?.phone ? <Phone className="h-3.5 w-3.5" /> : undefined}
                href={fields.parent?.phone ? `tel:${fields.parent.phone}` : undefined}
              />
            </div>
          </div>

          {/* Fussball (Football) */}
          <div className="sce-detail-section">
            <div className="sce-detail-section-header">
              <div className="flex items-center gap-2">
                <Volleyball className="h-4 w-4 text-[var(--muted)]" />
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
                  Fussball
                </p>
              </div>
            </div>
            <div className="sce-detail-section-body grid gap-5 sm:grid-cols-2">
              <DataField label="Gewünschtes Team" value={fields.football?.requestedTeam ?? null} />
              <DataField label="Gewünschte Altersgruppe" value={fields.football?.requestedAgeGroup ?? null} />
              <DataField label="Bevorzugtes Training" value={fields.football?.preferredTraining ?? null} />
              <DataField label="Spielerfahrung" value={fields.football?.playingExperience ?? null} />
              <DataField label="Aktueller Verein" value={fields.football?.currentClub ?? null} />
              <DataField label="Ehemaliger Verein" value={fields.football?.previousClub ?? null} />
              <DataField label="Position" value={fields.football?.position ?? null} />
            </div>
          </div>

          {/* Zusätzliche Angaben (Additional Information) */}
          <div className="sce-detail-section">
            <div className="sce-detail-section-header">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-[var(--muted)]" />
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
                  Zusätzliche Angaben
                </p>
              </div>
            </div>
            <div className="sce-detail-section-body space-y-4">
              <div className="sce-data-field">
                <span className="sce-data-label">Nachricht</span>
                {fields.additional.message ? (
                  <p className="mt-0.5 whitespace-pre-wrap text-sm leading-relaxed text-[var(--text-2)]">
                    {fields.additional.message}
                  </p>
                ) : (
                  <span className="sce-data-value-empty">{NOT_PROVIDED}</span>
                )}
              </div>
              <DataField label="Bemerkungen" value={fields.additional.remarks} />
              <div className="sce-data-field">
                <span className="sce-data-label">Notizen von der Website</span>
                {fields.additional.additionalRawData.length > 0 ? (
                  <div className="mt-1 grid gap-2">
                    {fields.additional.additionalRawData.map((entry) => (
                      <div key={entry.key} className="flex items-start gap-2 text-sm">
                        <FileText className="h-3.5 w-3.5 flex-shrink-0 mt-0.5 text-[var(--muted)]" />
                        <span className="min-w-0 break-words text-[var(--text-2)]">
                          <span className="font-medium">{entry.label}:</span> {entry.value}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <span className="sce-data-value-empty">{NOT_PROVIDED}</span>
                )}
              </div>
            </div>
          </div>

          {/* Einwilligungen (Consents) */}
          <div className="sce-detail-section">
            <div className="sce-detail-section-header">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-[var(--muted)]" />
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
                  Einwilligungen
                </p>
              </div>
            </div>
            <div className="sce-detail-section-body grid gap-4 sm:grid-cols-2">
              <ConsentField
                label="Datenschutzerklärung"
                value={fields.consents.privacyAccepted}
                trueLabel="Akzeptiert"
                falseLabel="Nicht akzeptiert"
              />
              <ConsentField
                label="Marketing-Einwilligung"
                value={fields.consents.marketingConsent}
                trueLabel="Ja"
                falseLabel="Nein"
              />
              <ConsentField
                label="Fotofreigabe"
                value={fields.consents.photoConsent}
                trueLabel="Ja"
                falseLabel="Nein"
              />
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

              {/* Error */}
              {updateError ? (
                <div className="rounded-[var(--radius-md)] border border-rose-200 bg-rose-50 px-3 py-2 text-[0.75rem] text-rose-700">
                  {updateError}
                </div>
              ) : null}

              {/* Status */}
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

              {isUpdating ? (
                <p className="text-xs text-[var(--muted)]">
                  Wird gespeichert…
                </p>
              ) : null}
            </div>
          </div>

          {/* Systemdaten — Goal 5 (REGISTRATION-01E): admin-relevant fields
              only (ID, timestamps, source, tenant, duplicate reference).
              Never expose raw internal implementation details. */}
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
                <span className="sce-data-label">Registrierungs-ID</span>
                <code className="font-mono text-[0.72rem] text-[var(--muted)]">
                  {fields.technical.internalId}
                </code>
              </div>
              {/* Goal 2/4 (REGISTRATION-01D): exact registration timestamp —
                  date and time, always visible, never just relative time. */}
              <div className="sce-data-field">
                <span className="sce-data-label">Eingegangen</span>
                <span className="sce-data-value flex items-center gap-1.5 tabular-nums">
                  <Calendar className="h-3.5 w-3.5 text-[var(--muted)]" />
                  {formatDateShort(registration.submittedAt, cfg)}
                  <span className="text-[var(--border-strong)]" aria-hidden>
                    ·
                  </span>
                  {formatTime(registration.submittedAt, cfg)}
                </span>
              </div>
              <div className="sce-data-field">
                <span className="sce-data-label">Zuletzt geändert</span>
                <span className="sce-data-value">
                  {formatDate(registration.updatedAt, cfg)}
                </span>
              </div>
              <DataField label="Quelle" value={sourceInfo?.label ?? null} />
              {fields.technical.websiteVersion && (
                <DataField
                  label="Website-Version"
                  value={fields.technical.websiteVersion}
                />
              )}
              <div className="sce-data-field">
                <span className="sce-data-label">Mandant</span>
                <span className="sce-data-value flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5 text-[var(--muted)]" />
                  {registration.tenant.name}
                </span>
              </div>
              {fields.duplicate.referenceId && (
                <div className="sce-data-field">
                  <span className="sce-data-label">Duplikat-Referenz</span>
                  <Link
                    href={`/tenant/${tenantSlug}/cockpit/registrations/${fields.duplicate.referenceId}`}
                    className="sce-data-value flex items-center gap-1.5 text-[var(--blue)] hover:underline"
                  >
                    <ExternalLink className="h-3.5 w-3.5 flex-shrink-0" />
                    <code className="font-mono text-[0.72rem]">{fields.duplicate.referenceId}</code>
                  </Link>
                </div>
              )}
              <DataField label="Sprache" value={fields.technical.locale} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
