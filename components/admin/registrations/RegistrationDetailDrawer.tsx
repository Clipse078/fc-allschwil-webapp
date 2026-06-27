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
  Globe,
  Shield,
  Flag,
  CalendarDays,
  AlertTriangle,
  CheckCircle,
  Baby,
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
import { WEBSITE_SOURCE } from "@/lib/registrations/constants";

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

type WebsitePayload = {
  parentOrGuardian?: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
  };
  consent?: {
    privacyAccepted?: boolean;
    communicationAccepted?: boolean;
    photoConsent?: boolean;
  };
  football?: {
    currentClub?: string;
    previousClub?: string;
    desiredTeam?: string;
    position?: string;
    preferredTrainingDay?: string;
  };
  event?: { eventId?: string; eventName?: string };
  sponsor?: { companyName?: string; contactPerson?: string; website?: string };
  address?: { street?: string; postalCode?: string; city?: string; country?: string };
  possibleDuplicate?: boolean;
  possibleDuplicateOf?: string;
};

function getWebsitePayload(payloadJson: unknown): WebsitePayload | null {
  if (!payloadJson || typeof payloadJson !== "object" || Array.isArray(payloadJson))
    return null;
  return payloadJson as WebsitePayload;
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

  const isWebsiteSource = registration.source === WEBSITE_SOURCE;
  const websitePayload = isWebsiteSource ? getWebsitePayload(registration.payloadJson) : null;
  const isPossibleDuplicate = websitePayload?.possibleDuplicate === true;

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
              {isWebsiteSource && (
                <span className="inline-flex items-center gap-1.5 h-6 rounded-full border border-indigo-200 bg-indigo-50 px-2.5 text-[0.7rem] font-semibold text-indigo-700">
                  <Globe className="h-3.5 w-3.5" aria-hidden />
                  Website
                </span>
              )}
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

          {/* Website source banner + possible duplicate warning */}
          {isWebsiteSource && (
            <div className="px-6 pt-4 pb-4 border-b border-[var(--border)] bg-indigo-50/50">
              <div className="flex items-start gap-2.5">
                <Globe className="h-4 w-4 text-indigo-600 flex-shrink-0 mt-0.5" aria-hidden />
                <div className="flex-1 min-w-0">
                  <p className="text-[0.78rem] font-semibold text-indigo-800">
                    Website-Anmeldung
                  </p>
                  <p className="text-[0.72rem] text-indigo-600 mt-0.5">
                    Eingegangen über das öffentliche Kontaktformular (FC Allschwil Website)
                  </p>
                </div>
              </div>
              {isPossibleDuplicate && (
                <div className="mt-3 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" aria-hidden />
                  <div>
                    <p className="text-[0.75rem] font-semibold text-amber-800">
                      Mögliches Duplikat erkannt
                    </p>
                    <p className="text-[0.7rem] text-amber-700 mt-0.5">
                      Eine ähnliche Anmeldung mit dieser E-Mail-Adresse wurde bereits innerhalb
                      der letzten 24 Stunden eingereicht. Bitte prüfe, ob es sich um eine
                      Doppeleinsendung handelt.
                      {websitePayload?.possibleDuplicateOf && (
                        <span className="block mt-1 font-mono text-[0.65rem] text-amber-600">
                          Referenz-ID: {websitePayload.possibleDuplicateOf}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

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

          {/* Parent / guardian — website submissions only */}
          {websitePayload?.parentOrGuardian &&
            (websitePayload.parentOrGuardian.firstName ||
              websitePayload.parentOrGuardian.lastName ||
              websitePayload.parentOrGuardian.email ||
              websitePayload.parentOrGuardian.phone) && (
              <div className="px-6 pt-5 pb-5 border-b border-[var(--border)]">
                <SectionLabel icon={Baby}>Erziehungsberechtigte/r</SectionLabel>
                <div className="grid gap-4 sm:grid-cols-2">
                  {(websitePayload.parentOrGuardian.firstName ||
                    websitePayload.parentOrGuardian.lastName) && (
                    <DataRow label="Name">
                      <span className="sce-data-value text-sm">
                        {[
                          websitePayload.parentOrGuardian.firstName,
                          websitePayload.parentOrGuardian.lastName,
                        ]
                          .filter(Boolean)
                          .join(" ")}
                      </span>
                    </DataRow>
                  )}
                  {websitePayload.parentOrGuardian.email && (
                    <DataRow label="E-Mail">
                      <a
                        href={`mailto:${websitePayload.parentOrGuardian.email}`}
                        className="sce-link-primary flex items-center gap-1.5 text-sm"
                      >
                        <Mail className="h-3.5 w-3.5 flex-shrink-0" aria-hidden />
                        {websitePayload.parentOrGuardian.email}
                      </a>
                    </DataRow>
                  )}
                  {websitePayload.parentOrGuardian.phone && (
                    <DataRow label="Telefon">
                      <a
                        href={`tel:${websitePayload.parentOrGuardian.phone}`}
                        className="sce-link-primary flex items-center gap-1.5 text-sm"
                      >
                        <Phone className="h-3.5 w-3.5 flex-shrink-0" aria-hidden />
                        {websitePayload.parentOrGuardian.phone}
                      </a>
                    </DataRow>
                  )}
                </div>
              </div>
            )}

          {/* Consent — website submissions only */}
          {websitePayload?.consent && (
            <div className="px-6 pt-5 pb-5 border-b border-[var(--border)]">
              <SectionLabel icon={CheckCircle}>Einwilligungen</SectionLabel>
              <div className="grid gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "h-4 w-4 flex-shrink-0 rounded-full flex items-center justify-center text-[0.6rem]",
                      websitePayload.consent.privacyAccepted
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-red-100 text-red-700",
                    )}
                    aria-hidden
                  >
                    {websitePayload.consent.privacyAccepted ? "✓" : "✗"}
                  </span>
                  <span className="text-sm text-[var(--text-2)]">Datenschutzerklärung</span>
                  <span
                    className={cn(
                      "text-[0.65rem] font-semibold",
                      websitePayload.consent.privacyAccepted
                        ? "text-emerald-600"
                        : "text-red-600",
                    )}
                  >
                    {websitePayload.consent.privacyAccepted ? "Akzeptiert" : "Nicht akzeptiert"}
                  </span>
                </div>
                {websitePayload.consent.communicationAccepted !== undefined && (
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "h-4 w-4 flex-shrink-0 rounded-full flex items-center justify-center text-[0.6rem]",
                        websitePayload.consent.communicationAccepted
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-slate-100 text-slate-500",
                      )}
                      aria-hidden
                    >
                      {websitePayload.consent.communicationAccepted ? "✓" : "—"}
                    </span>
                    <span className="text-sm text-[var(--text-2)]">Kommunikation / Newsletter</span>
                    <span
                      className={cn(
                        "text-[0.65rem] font-semibold",
                        websitePayload.consent.communicationAccepted
                          ? "text-emerald-600"
                          : "text-slate-500",
                      )}
                    >
                      {websitePayload.consent.communicationAccepted ? "Ja" : "Nein"}
                    </span>
                  </div>
                )}
                {websitePayload.consent.photoConsent !== undefined && (
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "h-4 w-4 flex-shrink-0 rounded-full flex items-center justify-center text-[0.6rem]",
                        websitePayload.consent.photoConsent
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-slate-100 text-slate-500",
                      )}
                      aria-hidden
                    >
                      {websitePayload.consent.photoConsent ? "✓" : "—"}
                    </span>
                    <span className="text-sm text-[var(--text-2)]">Fotofreigabe</span>
                    <span
                      className={cn(
                        "text-[0.65rem] font-semibold",
                        websitePayload.consent.photoConsent
                          ? "text-emerald-600"
                          : "text-slate-500",
                      )}
                    >
                      {websitePayload.consent.photoConsent ? "Ja" : "Nein"}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

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
