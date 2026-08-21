"use client";

import Link from "next/link";
import { useState } from "react";
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
  STATUS_LABELS as SHARED_STATUS_LABELS,
  STATUS_BADGE_CLASS as SHARED_STATUS_BADGE_CLASS,
} from "@/lib/registrations/status";
import type { AssignableUser, OrgUnitOption, TargetGroupOption, TeamSeasonOption } from "@/lib/registrations/workflow-types";
import RegistrationWorkflowPanel from "./RegistrationWorkflowPanel";
import RegistrationDeleteControl from "./RegistrationDeleteControl";

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
  /**
   * ADMIN-DELETE-03B: effective PERMISSIONS.REGISTRATIONS_DELETE authority.
   * When false/absent the delete control is hidden entirely.
   */
  canDelete?: boolean;
  /** Tenant locale (e.g. "de-CH"). Falls back to "de-CH" when absent. */
  locale?: string;
  /** Tenant timezone (e.g. "Europe/Zurich"). Falls back to "Europe/Zurich" when absent. */
  timezone?: string;
  /** Active users available for assignment. */
  assignableUsers?: AssignableUser[];
  eligibleCoordinators?: AssignableUser[];
  targetGroups?: TargetGroupOption[];
  orgUnits?: OrgUnitOption[];
  teamSeasons?: TeamSeasonOption[];
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
const STATUS_BADGE_CLASS = SHARED_STATUS_BADGE_CLASS;


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
  canDelete = false,
  locale = "de-CH",
  timezone = "Europe/Zurich",
  assignableUsers = [],
  eligibleCoordinators = [],
  targetGroups = [],
  orgUnits = [],
  teamSeasons = [],
}: RegistrationDetailCardProps) {
  const [registration, setRegistration] = useState(initialRegistration);

  const cfg = { locale, timezone };

  const routingSuggestion = getRoutingSuggestion(registration.birthYear);
  const contactName = getContactName(registration.payloadJson);
  const initials = getInitials(registration.firstName, registration.lastName);
  const typeLabel = TYPE_LABELS[registration.type] ?? registration.type;
  const backHref = `/tenant/${tenantSlug}/cockpit/registrations`;

  const fields = getRegistrationDetailFields(registration);
  const genderCode = extractGenderFromPayload(registration.payloadJson);
  const isAdultForGender = registration.birthYear
    ? new Date().getFullYear() - registration.birthYear >= 18
    : false;
  const genderDisplayLabel = getGenderLabel(genderCode, isAdultForGender) ?? fields.player.gender;

  const sourceInfo = getRegistrationSourceInfo(registration.source);
  const SourceIcon = sourceInfo ? SOURCE_ICON[sourceInfo.key] : null;
  const addressLines = formatCompactAddressLines(fields.address);

  return (
    <div className="space-y-5">
      {/* ── Page header ────────────────────────────────────────────────────── */}
      <div className="rounded-[var(--radius-2xl)] border border-[var(--border)] bg-white shadow-[var(--shadow-sm)]">
        <div className="flex items-start gap-4 px-6 py-5">
          {/* Avatar */}
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full border-2 bg-gradient-to-br from-[color-mix(in_srgb,var(--tenant-primary)_10%,white)] to-[color-mix(in_srgb,var(--tenant-primary)_20%,white)] font-bold uppercase tracking-wide text-[var(--tenant-primary)] border-[color-mix(in_srgb,var(--tenant-primary)_20%,white)]">
            {initials}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1
                className="text-xl font-bold text-[var(--foreground)]"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {registration.firstName} {registration.lastName}
              </h1>
              <span
                className={`inline-flex h-6 items-center rounded-full border px-2.5 text-[0.7rem] font-semibold ${STATUS_BADGE_CLASS[registration.status]}`}
              >
                {STATUS_LABELS[registration.status]}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[0.68rem] font-semibold text-slate-600">
                {typeLabel}
              </span>
              {sourceInfo && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-0.5 text-[0.68rem] font-semibold text-indigo-700">
                  {SourceIcon ? <SourceIcon className="h-3 w-3" aria-hidden /> : null}
                  {sourceInfo.label}
                </span>
              )}
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--muted)]">
              <span className="flex items-center gap-1">
                <Mail className="h-3 w-3" aria-hidden />
                {registration.email}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" aria-hidden />
                {formatDateShort(registration.submittedAt, cfg)} · {formatTime(registration.submittedAt, cfg)}
              </span>
              {registration.birthYear ? (
                <span className="flex items-center gap-1">
                  <User className="h-3 w-3" aria-hidden />
                  Jahrgang {registration.birthYear}
                </span>
              ) : null}
              {registration.targetGroup ? (
                <span className="flex items-center gap-1 text-emerald-700">
                  <Users className="h-3 w-3" aria-hidden />
                  {registration.targetGroup.name}
                </span>
              ) : routingSuggestion ? (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" aria-hidden />
                  {routingSuggestion}
                </span>
              ) : null}
            </div>
          </div>

          <Link
            href={backHref}
            className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-xs font-medium text-[var(--text-2)] hover:bg-[var(--surface-2)]"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            Zurück zur Inbox
          </Link>
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
            eligibleCoordinators={eligibleCoordinators}
            targetGroups={targetGroups}
            orgUnits={orgUnits}
            teamSeasons={teamSeasons}
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
          {/* Status overview */}
          <div className="sce-detail-section">
            <div className="sce-detail-section-header">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
                Status
              </p>
              <span
                className={`inline-flex h-5 items-center rounded-full border px-2 text-[0.65rem] font-semibold ${STATUS_BADGE_CLASS[registration.status]}`}
              >
                {STATUS_LABELS[registration.status]}
              </span>
            </div>
            <div className="sce-detail-section-body">
              <p className="text-xs text-[var(--muted)]">
                Statusübergänge erfolgen über die Schnellaktionen im Workflow-Bereich links.
              </p>
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

          {/* ADMIN-DELETE-03B: permanent deletion — only shown when the caller
              holds registrations.delete for this tenant. Renders below
              Systemdaten in the sidebar so it stays out of the main workflow
              path while remaining accessible for authorized users. */}
          <RegistrationDeleteControl
            tenantSlug={tenantSlug}
            registrationId={registration.id}
            registrationLabel={`${registration.firstName} ${registration.lastName}`}
            canDelete={canDelete}
          />
        </div>
      </div>
    </div>
  );
}
