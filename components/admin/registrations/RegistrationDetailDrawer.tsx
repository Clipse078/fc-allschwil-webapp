"use client";

import { useState, useEffect, type ComponentType } from "react";
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
  Globe,
  Smartphone,
  PenLine,
  FileSpreadsheet,
  Code2,
  HelpCircle,
  Building2,
  Shield,
  Flag,
  CalendarDays,
  CheckCircle,
  Baby,
  MapPin,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/cn";
import {
  classifyRegistration,
  extractGenderFromPayload,
  getGenderLabel,
  TARGET_GROUP_COLORS,
} from "@/lib/registrations/classification";
import {
  formatDate,
  formatDateTime,
  formatDateTimeCompact,
} from "@/lib/tenant-runtime/formatters";
import type { RegistrationListItem } from "@/lib/registrations/queries";
import { getInitials } from "@/lib/inbox/types";
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
  STATUS_BADGE_CLASS,
  STATUS_DOT_CLASS,
} from "@/lib/registrations/status";
import type { AssignableUser, OrgUnitOption, TargetGroupOption, TeamSeasonOption } from "@/lib/registrations/workflow-types";
import RegistrationWorkflowPanel from "./RegistrationWorkflowPanel";
import RegistrationDeleteControl from "./RegistrationDeleteControl";

const NOT_PROVIDED = "Nicht angegeben";

// ── Types ─────────────────────────────────────────────────────────────────────

// Re-exported for backward compatibility — RegistrationInbox.tsx and other
// call sites import these from here. Source of truth is workflow-types.ts.
export type { AssignableUser, OrgUnitOption, TargetGroupOption, TeamSeasonOption };

type Props = {
  registration: RegistrationListItem | null;
  tenantSlug: string;
  canEdit: boolean;
  /**
   * ADMIN-DELETE-03B: effective PERMISSIONS.REGISTRATIONS_DELETE authority.
   * When false/absent the permanent-delete section is hidden.
   */
  canDelete?: boolean;
  locale?: string;
  timezone?: string;
  assignableUsers?: AssignableUser[];
  eligibleCoordinators?: AssignableUser[];
  targetGroups?: TargetGroupOption[];
  orgUnits?: OrgUnitOption[];
  teamSeasons?: TeamSeasonOption[];
  onClose: () => void;
  onUpdate: (updated: RegistrationListItem) => void;
  /**
   * Called after successful permanent deletion. Closes the drawer and removes
   * the deleted item from the parent list without a full-page navigation.
   */
  onDeleted?: (deletedId: string) => void;
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

// REGISTRATION-01F — Goal 8: status metadata now lives in one shared module
// (lib/registrations/status.ts) so New/In Review/Assigned/Contacted/
// Waiting/Accepted/Rejected/Archived only needs to be edited once.
const STATUS_LABELS = SHARED_STATUS_LABELS;
const STATUS_BADGE = STATUS_BADGE_CLASS;
const STATUS_DOT = STATUS_DOT_CLASS;

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

// ── Sub-components ────────────────────────────────────────────────────────────

/**
 * Goal 4 (REGISTRATION-01E): one compact "at a glance" item in the
 * registration summary strip (what / where / when / status / suggested
 * allocation) shown right below the header, before the scrollable body.
 */
function SummaryItem({
  icon: Icon,
  dotClassName,
  children,
}: {
  icon?: ComponentType<{ className?: string }>;
  dotClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5 text-xs font-medium text-[var(--text-2)]">
      {dotClassName ? (
        <span className={cn("h-2 w-2 flex-shrink-0 rounded-full", dotClassName)} aria-hidden />
      ) : Icon ? (
        <Icon className="h-3.5 w-3.5 flex-shrink-0 text-[var(--muted)]" aria-hidden />
      ) : null}
      <span className="truncate">{children}</span>
    </span>
  );
}

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

/**
 * Goal 6 (REGISTRATION-01D): a label is never hidden because its value is
 * empty — it always renders, falling back to "Nicht angegeben" so admins
 * can tell "not collected" apart from a rendering bug.
 */
function FieldValue({ value, mono = false }: { value: string | null | undefined; mono?: boolean }) {
  if (!value) {
    return <span className="sce-data-value-empty text-sm">{NOT_PROVIDED}</span>;
  }
  return (
    <span className={cn("sce-data-value text-sm", mono && "font-mono text-[0.72rem] text-[var(--muted)]")}>
      {value}
    </span>
  );
}

/** Label + FieldValue in one line, for compact grids. */
function LabeledField({ label, value, mono }: { label: string; value: string | null | undefined; mono?: boolean }) {
  return (
    <DataRow label={label}>
      <FieldValue value={value} mono={mono} />
    </DataRow>
  );
}

/**
 * Tri-state consent row: true → accepted styling, false → declined styling,
 * null/undefined (never submitted/collected) → neutral "Nicht angegeben".
 * Goal 6: the label always renders regardless of state.
 */
function ConsentRow({
  label,
  value,
  trueLabel,
  falseLabel,
  unknownLabel,
}: {
  label: string;
  value: boolean | null;
  trueLabel: string;
  falseLabel: string;
  unknownLabel: string;
}) {
  const state = value === true ? "true" : value === false ? "false" : "unknown";
  return (
    <div className="flex items-center gap-2">
      <span
        className={cn(
          "h-4 w-4 flex-shrink-0 rounded-full flex items-center justify-center text-[0.6rem]",
          state === "true" && "bg-emerald-100 text-emerald-700",
          state === "false" && "bg-red-100 text-red-700",
          state === "unknown" && "bg-slate-100 text-slate-400",
        )}
        aria-hidden
      >
        {state === "true" ? "✓" : state === "false" ? "✗" : "—"}
      </span>
      <span className="text-sm text-[var(--text-2)]">{label}</span>
      <span
        className={cn(
          "text-[0.65rem] font-semibold",
          state === "true" && "text-emerald-600",
          state === "false" && "text-red-600",
          state === "unknown" && "italic text-[var(--muted)]",
        )}
      >
        {state === "true" ? trueLabel : state === "false" ? falseLabel : unknownLabel}
      </span>
    </div>
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
  classification,
  genderLabel,
}: {
  classification: ReturnType<typeof classifyRegistration>;
  genderLabel: string | null;
}) {
  const colors = TARGET_GROUP_COLORS[classification.colorToken];

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
              {/* Bugfix while touching this section (REGISTRATION-01E): avoid
                  duplicating the gender label when it's already part of the
                  reasoning string (e.g. "Jahrgang 2015 · Mädchen"). */}
              {genderLabel && !classification.reasoning.includes(genderLabel)
                ? ` · ${genderLabel}`
                : ""}
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
  canDelete = false,
  locale = "de-CH",
  timezone = "Europe/Zurich",
  assignableUsers = [],
  eligibleCoordinators = [],
  targetGroups = [],
  orgUnits = [],
  teamSeasons = [],
  onClose,
  onUpdate,
  onDeleted,
}: Props) {
  const [registration, setRegistration] = useState(initialRegistration);
  const [isVisible, setIsVisible] = useState(false);
  const [showFullData, setShowFullData] = useState(false);

  // Sync when parent changes the selected registration
  useEffect(() => {
    setRegistration(initialRegistration);
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

  const sourceInfo = getRegistrationSourceInfo(registration.source);
  const SourceIcon = sourceInfo ? SOURCE_ICON[sourceInfo.key] : null;

  // Goal 3/4 (REGISTRATION-01D): normalized read-model covering every field
  // collected across the pipeline (website → API → DB → payloadJson).
  const fields = getRegistrationDetailFields(registration);
  const genderCode = extractGenderFromPayload(registration.payloadJson);
  const isAdultForGender = registration.birthYear
    ? new Date().getFullYear() - registration.birthYear >= 18
    : false;
  const genderDisplayLabel = getGenderLabel(genderCode, isAdultForGender) ?? fields.player.gender;

  // Goal 4/2 (REGISTRATION-01E): classification computed once and reused by
  // both the summary strip and the detailed "Vorgeschlagene Zuordnung"
  // section; duplicate reference resolved server-side in queries.ts.
  const classification = classifyRegistration(registration.birthYear, genderCode, registration.type);
  const addressLines = formatCompactAddressLines(fields.address);

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
        <div className="flex-shrink-0 border-b border-[var(--border)] bg-[var(--surface)]">
          <div className="flex items-start gap-4 px-6 py-5">
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
                {sourceInfo && (
                  <span className="inline-flex items-center gap-1.5 h-6 rounded-full border border-indigo-200 bg-indigo-50 px-2.5 text-[0.7rem] font-semibold text-indigo-700">
                    {SourceIcon ? <SourceIcon className="h-3.5 w-3.5" aria-hidden /> : null}
                    {sourceInfo.label}
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-[var(--muted)] break-all">
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

          {/* Goal 4 (REGISTRATION-01E): compact registration summary — what /
              where / when / status / suggested allocation — all answered in
              one glance, right below the header, before any scrolling. */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-6 pb-4">
            <SummaryItem icon={TypeIcon}>{typeConfig.label}</SummaryItem>
            {sourceInfo && <SummaryItem icon={SourceIcon ?? Globe}>{sourceInfo.label}</SummaryItem>}
            <SummaryItem icon={Calendar}>
              {formatDateTimeCompact(registration.submittedAt, cfg)}
            </SummaryItem>
            <SummaryItem dotClassName={STATUS_DOT[registration.status]}>
              {STATUS_LABELS[registration.status]}
            </SummaryItem>
            <SummaryItem icon={Lightbulb}>{classification.targetGroupLabel}</SummaryItem>
          </div>
        </div>

        {/* ── Scrollable body ──────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">

          {/* Classification / routing suggestion */}
          <ClassificationSection classification={classification} genderLabel={genderDisplayLabel} />

          {/* REGISTRATION-01F: team recommendation actions, person lookup/
              creation, assignment workflow, duplicate workflow, timeline. */}
          <div className="px-6 pt-5 pb-5 border-b border-[var(--border)]">
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
              onUpdate={(updated) => {
                setRegistration(updated);
                onUpdate(updated);
              }}
            />
          </div>

          {/* Vollständige Angaben — expandable secondary data section */}
          <div className="border-b border-[var(--border)]">
            <button
              type="button"
              onClick={() => setShowFullData((v) => !v)}
              className="flex w-full items-center justify-between gap-2 px-6 py-3.5 text-left hover:bg-[var(--surface-2)] transition-colors"
            >
              <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
                Vollständige Angaben
              </span>
              <span className="text-[0.7rem] text-[var(--muted)]">
                {showFullData ? "▲ Ausblenden" : "▼ Einblenden"}
              </span>
            </button>

            {showFullData ? (
              <>
                {/* Spieler (Player) */}
                <div className="px-6 pt-4 pb-5 border-t border-[var(--border)]">
                  <SectionLabel icon={User}>Spieler</SectionLabel>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <LabeledField label="Vorname" value={fields.player.firstName} />
                    <LabeledField label="Nachname" value={fields.player.lastName} />
                    <LabeledField label="Geschlecht" value={genderDisplayLabel} />
                    <LabeledField
                      label="Geburtsdatum"
                      value={fields.player.birthDate ? formatDate(fields.player.birthDate, cfg) : null}
                    />
                    <LabeledField
                      label="Jahrgang"
                      value={fields.player.birthYear ? String(fields.player.birthYear) : null}
                    />
                    <LabeledField label="Nationalität" value={fields.player.nationality} />
                  </div>
                </div>

                {/* Adresse */}
                <div className="px-6 pt-4 pb-5 border-t border-[var(--border)]">
                  <SectionLabel icon={MapPin}>Adresse</SectionLabel>
                  {addressLines.length > 0 ? (
                    <address className="not-italic text-sm leading-relaxed text-[var(--foreground)] break-words">
                      {addressLines.map((line, i) => (
                        <span key={i} className="block">{line}</span>
                      ))}
                    </address>
                  ) : (
                    <span className="sce-data-value-empty text-sm">{NOT_PROVIDED}</span>
                  )}
                </div>

                {/* Kontakt */}
                <div className="px-6 pt-4 pb-5 border-t border-[var(--border)]">
                  <SectionLabel icon={Mail}>Kontakt</SectionLabel>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <DataRow label="E-Mail">
                      <a href={`mailto:${fields.contact.email}`} className="sce-link-primary flex items-center gap-1.5 text-sm break-all">
                        <Mail className="h-3.5 w-3.5 flex-shrink-0" aria-hidden />
                        {fields.contact.email}
                      </a>
                    </DataRow>
                    {fields.contact.phone ? (
                      <DataRow label="Telefon">
                        <a href={`tel:${fields.contact.phone}`} className="sce-link-primary flex items-center gap-1.5 text-sm">
                          <Phone className="h-3.5 w-3.5 flex-shrink-0" aria-hidden />
                          {fields.contact.phone}
                        </a>
                      </DataRow>
                    ) : (
                      <LabeledField label="Telefon" value={null} />
                    )}
                    {contactName ? <LabeledField label="Kontaktperson" value={contactName} /> : null}
                  </div>
                </div>

                {/* Erziehungsberechtigte/r */}
                <div className="px-6 pt-4 pb-5 border-t border-[var(--border)]">
                  <SectionLabel icon={Baby}>Erziehungsberechtigte/r</SectionLabel>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <LabeledField label="Name" value={fields.parent?.name ?? null} />
                    {fields.parent?.email ? (
                      <DataRow label="E-Mail">
                        <a href={`mailto:${fields.parent.email}`} className="sce-link-primary flex items-center gap-1.5 text-sm break-all">
                          <Mail className="h-3.5 w-3.5 flex-shrink-0" aria-hidden />
                          {fields.parent.email}
                        </a>
                      </DataRow>
                    ) : (
                      <LabeledField label="E-Mail" value={null} />
                    )}
                    {fields.parent?.phone ? (
                      <DataRow label="Telefon">
                        <a href={`tel:${fields.parent.phone}`} className="sce-link-primary flex items-center gap-1.5 text-sm">
                          <Phone className="h-3.5 w-3.5 flex-shrink-0" aria-hidden />
                          {fields.parent.phone}
                        </a>
                      </DataRow>
                    ) : (
                      <LabeledField label="Telefon" value={null} />
                    )}
                  </div>
                </div>

                {/* Fussball */}
                <div className="px-6 pt-4 pb-5 border-t border-[var(--border)]">
                  <SectionLabel icon={Volleyball}>Fussball</SectionLabel>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <LabeledField label="Gewünschtes Team" value={fields.football?.requestedTeam ?? null} />
                    <LabeledField label="Altersgruppe" value={fields.football?.requestedAgeGroup ?? null} />
                    <LabeledField label="Bevorzugtes Training" value={fields.football?.preferredTraining ?? null} />
                    <LabeledField label="Spielerfahrung" value={fields.football?.playingExperience ?? null} />
                    <LabeledField label="Aktueller Verein" value={fields.football?.currentClub ?? null} />
                    <LabeledField label="Ehemaliger Verein" value={fields.football?.previousClub ?? null} />
                    <LabeledField label="Position" value={fields.football?.position ?? null} />
                  </div>
                </div>

                {/* Zusätzliche Angaben */}
                <div className="px-6 pt-4 pb-5 border-t border-[var(--border)]">
                  <SectionLabel icon={MessageSquare}>Zusätzliche Angaben</SectionLabel>
                  <div className="grid gap-4">
                    <DataRow label="Nachricht">
                      {fields.additional.message ? (
                        <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--text-2)]">
                          {fields.additional.message}
                        </p>
                      ) : (
                        <FieldValue value={null} />
                      )}
                    </DataRow>
                    <LabeledField label="Bemerkungen" value={fields.additional.remarks} />
                    {fields.additional.additionalRawData.length > 0 ? (
                      <DataRow label="Notizen">
                        <div className="grid gap-2">
                          {fields.additional.additionalRawData.map((entry) => (
                            <div key={entry.key} className="flex items-start gap-2 text-sm">
                              <FileText className="h-3.5 w-3.5 flex-shrink-0 mt-0.5 text-[var(--muted)]" aria-hidden />
                              <span className="min-w-0 break-words text-[var(--text-2)]">
                                <span className="font-medium">{entry.label}:</span> {entry.value}
                              </span>
                            </div>
                          ))}
                        </div>
                      </DataRow>
                    ) : null}
                  </div>
                </div>

                {/* Einwilligungen */}
                <div className="px-6 pt-4 pb-5 border-t border-[var(--border)]">
                  <SectionLabel icon={CheckCircle}>Einwilligungen</SectionLabel>
                  <div className="grid gap-2">
                    <ConsentRow label="Datenschutzerklärung" value={fields.consents.privacyAccepted} trueLabel="Akzeptiert" falseLabel="Nicht akzeptiert" unknownLabel={NOT_PROVIDED} />
                    <ConsentRow label="Marketing-Einwilligung" value={fields.consents.marketingConsent} trueLabel="Ja" falseLabel="Nein" unknownLabel={NOT_PROVIDED} />
                    <ConsentRow label="Fotofreigabe" value={fields.consents.photoConsent} trueLabel="Ja" falseLabel="Nein" unknownLabel={NOT_PROVIDED} />
                  </div>
                </div>

                {/* Systemdaten */}
                <div className="px-6 pt-4 pb-5 border-t border-[var(--border)]">
                  <SectionLabel icon={Hash}>Systemdaten</SectionLabel>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <DataRow label="Registrierungs-ID">
                      <code className="font-mono text-[0.7rem] text-[var(--muted)]">{fields.technical.internalId}</code>
                    </DataRow>
                    <DataRow label="Eingegangen">
                      <span className="sce-data-value flex items-center gap-1.5 text-sm">
                        <Calendar className="h-3.5 w-3.5 text-[var(--muted)]" aria-hidden />
                        {formatDateTime(registration.submittedAt, cfg)}
                      </span>
                    </DataRow>
                    <LabeledField label="Zuletzt geändert" value={formatDate(registration.updatedAt, cfg)} />
                    <LabeledField label="Quelle" value={sourceInfo?.label ?? null} />
                    <DataRow label="Mandant">
                      <span className="sce-data-value flex items-center gap-1.5 text-sm">
                        <Building2 className="h-3.5 w-3.5 text-[var(--muted)]" aria-hidden />
                        {registration.tenant.name}
                      </span>
                    </DataRow>
                    {fields.duplicate.referenceId ? (
                      <DataRow label="Duplikat-Referenz">
                        <a href={`/tenant/${tenantSlug}/cockpit/registrations/${fields.duplicate.referenceId}`} className="sce-link-primary flex items-center gap-1.5 text-sm">
                          <ExternalLink className="h-3.5 w-3.5 flex-shrink-0" aria-hidden />
                          <code className="font-mono text-[0.7rem]">{fields.duplicate.referenceId}</code>
                        </a>
                      </DataRow>
                    ) : null}
                    <LabeledField label="Sprache" value={fields.technical.locale} />
                  </div>
                </div>
              </>
            ) : null}
          </div>

          {/* ADMIN-DELETE-03B: permanent deletion danger zone — only shown when
              the caller holds registrations.delete for this tenant. Visually
              separated at the bottom of the scrollable area so it stays out of
              the normal workflow path. */}
          {canDelete && (
            <div className="px-6 pt-5 pb-8">
              <div className="rounded-[var(--radius-lg)] border border-red-200 bg-red-50/60 p-4">
                <p className="text-[0.69rem] font-semibold uppercase tracking-[0.1em] text-red-600 mb-2">
                  Endgültig löschen
                </p>
                <p className="text-xs text-red-700 mb-3">
                  Entfernt die Anmeldung unwiderruflich aus der Datenbank.
                  Diese Aktion kann nicht rückgängig gemacht werden.
                </p>
                <RegistrationDeleteControl
                  tenantSlug={tenantSlug}
                  registrationId={registration.id}
                  registrationLabel={`${registration.firstName} ${registration.lastName}`}
                  canDelete={canDelete}
                  compact
                  onDeleted={() => {
                    onDeleted?.(registration.id);
                    onClose();
                  }}
                />
              </div>
            </div>
          )}
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
