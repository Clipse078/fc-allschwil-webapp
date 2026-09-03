"use client";

/**
 * components/admin/registrations/RegistrationWorkflowPanel.tsx
 *
 * REGISTRATION-01F — Assignment & Person Creation Workflow.
 *
 * Single shared panel rendered by both the inbox drawer
 * (RegistrationDetailDrawer) and the full detail page
 * (RegistrationDetailCard) so the workflow logic (team recommendation
 * actions, person lookup/creation, assignment, duplicate handling, quick
 * actions, timeline) exists in exactly one place.
 *
 * Covers:
 *   Goal 1  — Team recommendation becomes actionable
 *   Goal 2  — Person lookup (automatic, on open)
 *   Goal 3  — Create Person (copies registration data, links, provenance)
 *   Goal 4  — Assignment workflow (existing users)
 *   Goal 5  — Timeline
 *   Goal 6  — Quick actions
 *   Goal 7  — Duplicate workflow (Open original / Merge later (disabled) / Ignore)
 *   Goal 11 — Person creation safety (never silent, requires confirmation)
 *   Goal 12 — Audit (every mutation here goes through the PATCH/create-person
 *             endpoints, which write AuditLog entries — see route.ts).
 */

import { useCallback, useEffect, useState, type ComponentType } from "react";
import {
  AlertTriangle,
  Archive,
  CheckCircle2,
  ClipboardList,
  Clock,
  ExternalLink,
  Lightbulb,
  Link2,
  Loader2,
  Mail,
  Merge,
  ShieldAlert,
  User,
  UserCheck,
  UserPlus,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { AddToWaitingListDialog } from "./AddToWaitingListDialog";
import { WaitingListCoordinatorPicker } from "./WaitingListCoordinatorPicker";
import { cn } from "@/lib/cn";
import type { RegistrationListItem } from "@/lib/registrations/queries";
import type { AssignableUser, OrgUnitOption, TargetGroupOption, TeamSeasonOption } from "@/lib/registrations/workflow-types";
import type { PersonMatchCandidate } from "@/lib/registrations/person-match";
import { classifyRegistration, extractGenderFromPayload, TARGET_GROUP_COLORS } from "@/lib/registrations/classification";
import { formatDateTimeCompact } from "@/lib/tenant-runtime/formatters";
import RegistrationTimelinePanel from "./RegistrationTimelinePanel";

// ── Props ──────────────────────────────────────────────────────────────────

type Props = {
  registration: RegistrationListItem;
  tenantSlug: string;
  canEdit: boolean;
  locale?: string;
  timezone?: string;
  assignableUsers: AssignableUser[];
  eligibleCoordinators?: AssignableUser[];
  targetGroups: TargetGroupOption[];
  orgUnits?: OrgUnitOption[];
  teamSeasons?: TeamSeasonOption[];
  onUpdate: (updated: RegistrationListItem) => void;
  /** REG-WAIT-01K: drawer uses dedicated Verlauf tab; detail page keeps inline timeline. */
  showInlineTimeline?: boolean;
};

// ── Small building blocks ───────────────────────────────────────────────────

function PanelSection({
  title,
  icon: Icon,
  badge,
  children,
}: {
  title: string;
  icon: ComponentType<{ className?: string }>;
  badge?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="sce-detail-section">
      <div className="sce-detail-section-header">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-[var(--muted)]" aria-hidden />
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">{title}</p>
        </div>
        {badge}
      </div>
      <div className="sce-detail-section-body">{children}</div>
    </div>
  );
}

function QuickActionButton({
  icon: Icon,
  label,
  onClick,
  href,
  disabled,
  variant = "default",
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
  variant?: "default" | "primary" | "danger";
}) {
  const classes = cn(
    "inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border text-xs font-semibold transition-colors",
    disabled && "opacity-50 cursor-not-allowed",
    variant === "primary" && "border-[var(--tenant-primary)] bg-[var(--tenant-primary)] text-white hover:opacity-90",
    variant === "danger" && "border-red-200 bg-red-50 text-red-700 hover:bg-red-100",
    variant === "default" && "border-[var(--border)] bg-[var(--surface)] text-[var(--text-2)] hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]",
  );
  if (href && !disabled) {
    return (
      <a href={href} className={classes}>
        <Icon className="h-3.5 w-3.5" aria-hidden />
        {label}
      </a>
    );
  }
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={classes}>
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {label}
    </button>
  );
}

const MATCH_REASON_LABEL: Record<string, string> = {
  EMAIL: "E-Mail",
  PHONE: "Telefon",
  NAME: "Name",
};

function PersonCandidateRow({
  candidate,
  onLink,
  linking,
}: {
  candidate: PersonMatchCandidate;
  onLink: () => void;
  linking: boolean;
}) {
  const name = candidate.displayName || `${candidate.firstName} ${candidate.lastName}`;
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-[var(--foreground)]">{name}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-1 text-[0.7rem] text-[var(--muted)]">
          {candidate.email && <span className="break-all">{candidate.email}</span>}
          {candidate.email && candidate.phone && <span aria-hidden>·</span>}
          {candidate.phone && <span>{candidate.phone}</span>}
        </p>
        <p className="mt-1 flex items-center gap-1">
          {candidate.reasons.map((r) => (
            <span key={r} className="inline-flex h-4 items-center rounded-full bg-emerald-100 px-1.5 text-[0.6rem] font-semibold text-emerald-700">
              {MATCH_REASON_LABEL[r] ?? r}-Treffer
            </span>
          ))}
        </p>
      </div>
      <div className="flex flex-shrink-0 items-center gap-1.5">
        <a
          href={`/dashboard/persons/${candidate.id}`}
          className="inline-flex items-center gap-1 h-7 px-2 rounded-md border border-[var(--border)] bg-[var(--surface)] text-[0.7rem] font-medium text-[var(--text-2)] hover:bg-[var(--surface-2)]"
        >
          Öffnen
          <ExternalLink className="h-3 w-3" aria-hidden />
        </a>
        <button
          type="button"
          onClick={onLink}
          disabled={linking}
          className="inline-flex items-center gap-1 h-7 px-2 rounded-md border border-emerald-300 bg-emerald-50 text-[0.7rem] font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
        >
          {linking ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> : <Link2 className="h-3 w-3" aria-hidden />}
          Mit bestehender Person verknüpfen
        </button>
      </div>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export default function RegistrationWorkflowPanel({
  registration,
  tenantSlug,
  canEdit,
  locale = "de-CH",
  timezone = "Europe/Zurich",
  eligibleCoordinators = [],
  targetGroups,
  orgUnits = [],
  teamSeasons = [],
  onUpdate,
  showInlineTimeline = true,
}: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showElsewherePicker, setShowElsewherePicker] = useState(false);
  const [createPersonConfirming, setCreatePersonConfirming] = useState(false);
  const [showWaitingListDialog, setShowWaitingListDialog] = useState(false);

  const genderCode = extractGenderFromPayload(registration.payloadJson);
  const classification = classifyRegistration(registration.birthYear, genderCode, registration.type);
  const groupColors = TARGET_GROUP_COLORS[classification.colorToken];
  const recommendedGroup = targetGroups.find((g) => g.key === classification.targetGroupKey) ?? null;

  const personMatch = registration.personMatch;

  // Mirrors the (unchanged) possibleDuplicate flag written by
  // public-submission.ts — see lib/registrations/detail-view.ts for the
  // typed projection used elsewhere in the drawer/detail page.
  const isPossibleDuplicate =
    !!registration.payloadJson &&
    typeof registration.payloadJson === "object" &&
    !Array.isArray(registration.payloadJson) &&
    (registration.payloadJson as Record<string, unknown>).possibleDuplicate === true;

  const patch = useCallback(
    async (body: Record<string, unknown>, busyKey: string) => {
      setBusy(busyKey);
      setError(null);
      try {
        const res = await fetch(
          `/api/tenants/${encodeURIComponent(tenantSlug)}/registrations/${encodeURIComponent(registration.id)}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          },
        );
        const payload = await res.json();
        if (!res.ok) throw new Error(payload.error ?? "Änderung konnte nicht gespeichert werden.");
        onUpdate(payload.registration as RegistrationListItem);
        return payload.registration as RegistrationListItem;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Änderung konnte nicht gespeichert werden.");
        return null;
      } finally {
        setBusy(null);
      }
    },
    [registration.id, tenantSlug, onUpdate],
  );

  const createPerson = useCallback(
    async (confirm: boolean) => {
      setBusy("create-person");
      setError(null);
      try {
        const res = await fetch(
          `/api/tenants/${encodeURIComponent(tenantSlug)}/registrations/${encodeURIComponent(registration.id)}/create-person`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ confirm }),
          },
        );
        const payload = await res.json();
        if (!res.ok) {
          if (payload.requiresConfirmation) {
            setCreatePersonConfirming(true);
            return;
          }
          throw new Error(payload.error ?? "Person konnte nicht erstellt werden.");
        }
        setCreatePersonConfirming(false);
        if (payload.registration) onUpdate(payload.registration as RegistrationListItem);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Person konnte nicht erstellt werden.");
      } finally {
        setBusy(null);
      }
    },
    [registration.id, tenantSlug, onUpdate],
  );

  const handleCreatePersonClick = useCallback(() => {
    if (personMatch && personMatch.status !== "NONE") {
      setCreatePersonConfirming(true);
      return;
    }
    void createPerson(false);
  }, [personMatch, createPerson]);

  useEffect(() => {
    setShowElsewherePicker(false);
    setCreatePersonConfirming(false);
  }, [registration.id]);

  const isTerminal = registration.status === "ARCHIVED";
  const canAdvance = canEdit && !isTerminal;

  // Goal 1: only offer "assign to recommended team" once, and only bump
  // status forward — never regress a later-stage registration.
  const nextStatusAfterTeamAssign = ["NEW", "REVIEWING"].includes(registration.status)
    ? "ASSIGNED"
    : undefined;
  const nextStatusAfterNoRecommendation = registration.status === "NEW" ? "REVIEWING" : undefined;

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-[var(--radius-md)] border border-rose-200 bg-rose-50 px-3 py-2 text-[0.75rem] text-rose-700">
          {error}
        </div>
      )}

      {/* Goal 6: Quick actions */}
      <div className="flex flex-wrap items-center gap-2">
        <QuickActionButton icon={Mail} label="Kontaktieren" href={`mailto:${registration.email}`} />
        {registration.personId ? (
          <QuickActionButton icon={UserRound} label="In Vereinsverwaltung öffnen" href={`/dashboard/persons/${registration.personId}`} />
        ) : (
          <QuickActionButton
            icon={UserPlus}
            label="In Vereinsverwaltung aufnehmen"
            onClick={handleCreatePersonClick}
            disabled={!canEdit || busy === "create-person"}
            variant="primary"
          />
        )}
        {registration.status !== "CONTACTED" && !isTerminal && registration.status !== "WAITING" && (
          <QuickActionButton
            icon={CheckCircle2}
            label="Als kontaktiert markieren"
            onClick={() => patch({ status: "CONTACTED" }, "mark-contacted")}
            disabled={!canEdit || !!busy}
          />
        )}
        {/* REG-WAIT-01: Auf Warteliste setzen — focused action, not a status shortcut */}
        {canAdvance && registration.status !== "WAITING" && (
          <QuickActionButton
            icon={ClipboardList}
            label="Auf Warteliste setzen"
            onClick={() => setShowWaitingListDialog(true)}
            disabled={!!busy}
          />
        )}
        {registration.status === "WAITING" && (
          <a
            href={`/tenant/${tenantSlug}/cockpit/registrations/warteliste`}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-amber-300 bg-amber-50 text-xs font-semibold text-amber-800 hover:bg-amber-100"
          >
            <ClipboardList className="h-3.5 w-3.5" aria-hidden />
            Auf Warteliste — öffnen
          </a>
        )}
        {!isTerminal && (
          <QuickActionButton
            icon={Archive}
            label="Archivieren"
            onClick={() => patch({ status: "ARCHIVED" }, "archive")}
            disabled={!canEdit || !!busy}
          />
        )}
      </div>

      {/* REG-WAIT-01: Auf Warteliste setzen dialog */}
      {showWaitingListDialog && (
        <AddToWaitingListDialog
          open={showWaitingListDialog}
          onClose={() => setShowWaitingListDialog(false)}
          registration={registration}
          tenantSlug={tenantSlug}
          eligibleCoordinators={eligibleCoordinators}
          targetGroups={targetGroups}
          orgUnits={orgUnits}
          teamSeasons={teamSeasons}
          onSuccess={onUpdate}
        />
      )}

      {/* Goal 3/11: Create-person confirmation */}
      {createPersonConfirming && (
        <div className="flex items-start gap-2.5 rounded-[var(--radius-lg)] border border-amber-200 bg-amber-50 px-3.5 py-3">
          <ShieldAlert className="h-4 w-4 flex-shrink-0 mt-0.5 text-amber-600" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-amber-800">
              Es besteht ein möglicher Treffer — trotzdem eine neue Person anlegen?
            </p>
            <p className="mt-0.5 text-xs text-amber-700">
              Um Dubletten zu vermeiden: bitte zuerst prüfen, ob eine der unten gezeigten Personen bereits passt.
            </p>
            <div className="mt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={() => createPerson(true)}
                disabled={busy === "create-person"}
                className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md border border-amber-300 bg-amber-100 text-[0.72rem] font-semibold text-amber-800 hover:bg-amber-200 disabled:opacity-50"
              >
                {busy === "create-person" ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> : null}
                Trotzdem neue Person anlegen
              </button>
              <button
                type="button"
                onClick={() => setCreatePersonConfirming(false)}
                className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md border border-[var(--border)] bg-[var(--surface)] text-[0.72rem] font-medium text-[var(--text-2)] hover:bg-[var(--surface-2)]"
              >
                <X className="h-3 w-3" aria-hidden />
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Goal 1: Team recommendation actions — compact operational surface */}
      <PanelSection title="Ziel / Team" icon={Lightbulb}>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold",
              groupColors.border,
              groupColors.bg,
              groupColors.text,
            )}
          >
            <span className={cn("h-2 w-2 rounded-full", groupColors.dot)} aria-hidden />
            {classification.targetGroupLabel}
          </span>
          {registration.targetGroup ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-100 px-2 py-0.5 text-[0.65rem] font-semibold text-emerald-800">
              <CheckCircle2 className="h-3 w-3" aria-hidden />
              {registration.targetGroup.name}
            </span>
          ) : (
            <span className="text-xs text-[var(--muted)]">{classification.reasoning}</span>
          )}
        </div>

        {canAdvance && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <QuickActionButton
              icon={CheckCircle2}
              label="Team zuweisen"
              variant="primary"
              disabled={!recommendedGroup || busy === "assign-recommended"}
              onClick={() =>
                recommendedGroup &&
                patch(
                  {
                    targetGroupId: recommendedGroup.id,
                    ...(nextStatusAfterTeamAssign ? { status: nextStatusAfterTeamAssign } : {}),
                    workflowAction: "ASSIGN_RECOMMENDED_TEAM",
                  },
                  "assign-recommended",
                )
              }
            />
            <QuickActionButton
              icon={Users}
              label="Anders zuweisen"
              onClick={() => setShowElsewherePicker((v) => !v)}
              disabled={targetGroups.length === 0}
            />
            <QuickActionButton
              icon={Lightbulb}
              label="Keine Empfehlung"
              disabled={busy === "no-recommendation"}
              onClick={() =>
                patch(
                  {
                    targetGroupId: null,
                    ...(nextStatusAfterNoRecommendation ? { status: nextStatusAfterNoRecommendation } : {}),
                    workflowAction: "NO_RECOMMENDATION",
                  },
                  "no-recommendation",
                )
              }
            />
          </div>
        )}

        {!recommendedGroup && canAdvance && (
          <p className="mt-1.5 text-[0.7rem] italic text-[var(--muted)]">
            Keine passende Zielgruppe „{classification.targetGroupLabel}&rdquo; hinterlegt — bitte „Anders zuweisen&rdquo; verwenden.
          </p>
        )}

        {showElsewherePicker && canAdvance && (
          <div className="mt-2 flex items-center gap-2">
            <select
              className="fca-select text-xs"
              defaultValue=""
              disabled={busy === "assign-elsewhere"}
              onChange={(e) => {
                const id = e.target.value;
                if (!id) return;
                patch(
                  {
                    targetGroupId: id,
                    ...(nextStatusAfterTeamAssign ? { status: nextStatusAfterTeamAssign } : {}),
                    workflowAction: "ASSIGN_ELSEWHERE",
                  },
                  "assign-elsewhere",
                );
                setShowElsewherePicker(false);
              }}
            >
              <option value="">— Team wählen —</option>
              {targetGroups.map((tg) => (
                <option key={tg.id} value={tg.id}>
                  {tg.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </PanelSection>

      {/* Goal 2/3/11: Person lookup + creation */}
      <PanelSection
        title="Vereinsverwaltung"
        icon={User}
        badge={
          personMatch && (
            <span
              className={cn(
                "inline-flex h-5 items-center rounded-full border px-2 text-[0.65rem] font-semibold",
                personMatch.status === "LINKED" && "border-emerald-200 bg-emerald-50 text-emerald-700",
                personMatch.status === "CONFIRMED" && "border-blue-200 bg-blue-50 text-blue-700",
                personMatch.status === "POSSIBLE" && "border-amber-200 bg-amber-50 text-amber-700",
                personMatch.status === "NONE" && "border-slate-200 bg-slate-50 text-slate-500",
              )}
            >
              {personMatch.status === "LINKED" && "Verknüpft"}
              {personMatch.status === "CONFIRMED" && "Bestätigter Treffer"}
              {personMatch.status === "POSSIBLE" && "Möglicher Treffer"}
              {personMatch.status === "NONE" && "Kein Treffer"}
            </span>
          )
        }
      >
        {registration.person ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-[var(--foreground)]">
                {registration.person.displayName || `${registration.person.firstName} ${registration.person.lastName}`}
              </p>
              <p className="mt-0.5 text-xs text-[var(--muted)]">{registration.person.email ?? "Keine E-Mail hinterlegt"}</p>
            </div>
            <a
              href={`/dashboard/persons/${registration.person.id}`}
              className="fca-button-secondary text-xs gap-1.5"
            >
              <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              In Vereinsverwaltung öffnen
            </a>
          </div>
        ) : personMatch && personMatch.candidates.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs text-[var(--muted)]">
              {personMatch.status === "CONFIRMED"
                ? "Diese E-Mail-Adresse ist bereits als Person erfasst."
                : "Möglicherweise existiert diese Person bereits — bitte prüfen, bevor eine neue angelegt wird."}
            </p>
            {personMatch.candidates.map((candidate) => (
              <PersonCandidateRow
                key={candidate.id}
                candidate={candidate}
                linking={busy === "link-person"}
                onLink={() => canEdit && patch({ personId: candidate.id }, "link-person")}
              />
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-[var(--muted)]">Keine passende Person gefunden.</p>
            <QuickActionButton
              icon={UserPlus}
              label="In Vereinsverwaltung aufnehmen"
              variant="primary"
              disabled={!canEdit || busy === "create-person"}
              onClick={handleCreatePersonClick}
            />
          </div>
        )}
      </PanelSection>

      {/* Goal 4: Assignment workflow — canonical searchable coordinator picker */}
      <PanelSection title="Verantwortlich" icon={UserCheck}>
        {canEdit ? (
          <WaitingListCoordinatorPicker
            eligibleCoordinators={eligibleCoordinators}
            selectedUserId={registration.assignedToUserId}
            onSelect={(userId) => patch({ assignedToUserId: userId }, "assign-user")}
            disabled={busy === "assign-user"}
            placeholder="Koordinator zuweisen…"
          />
        ) : registration.assignedToUser ? (
          <span className="sce-data-value flex items-center gap-1.5 text-sm">
            <UserCheck className="h-3.5 w-3.5 text-[var(--muted)]" aria-hidden />
            {registration.assignedToUser.firstName} {registration.assignedToUser.lastName}
          </span>
        ) : (
          <span className="sce-data-value-empty text-sm">Nicht zugewiesen</span>
        )}
      </PanelSection>

      {/* Goal 7: Duplicate workflow */}
      {(isPossibleDuplicate || registration.duplicateIgnoredAt) && (
        <PanelSection title="Duplikat" icon={AlertTriangle}>
          {registration.duplicateIgnoredAt ? (
            <div className="flex items-start gap-2 text-xs text-[var(--muted)]">
              <ShieldAlert className="h-4 w-4 flex-shrink-0 text-slate-400" aria-hidden />
              <p>
                Duplikatwarnung ignoriert
                {registration.duplicateIgnoredBy
                  ? ` von ${registration.duplicateIgnoredBy.firstName} ${registration.duplicateIgnoredBy.lastName}`
                  : ""}{" "}
                am {formatDateTimeCompact(registration.duplicateIgnoredAt, { locale, timezone })}.
              </p>
            </div>
          ) : (
            <p className="text-xs text-amber-700">
              Mögliches Duplikat erkannt — bitte prüfen, ob es sich um eine Doppeleinsendung handelt.
            </p>
          )}
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            {registration.duplicateReference && (
              <QuickActionButton
                icon={ExternalLink}
                label="Original öffnen"
                href={`/tenant/${tenantSlug}/cockpit/registrations/${registration.duplicateReference.id}`}
              />
            )}
            <QuickActionButton icon={Merge} label="Später zusammenführen" disabled />
            {!registration.duplicateIgnoredAt && (
              <QuickActionButton
                icon={ShieldAlert}
                label="Duplikat ignorieren"
                disabled={!canEdit || busy === "ignore-duplicate"}
                onClick={() => patch({ duplicateIgnored: true }, "ignore-duplicate")}
              />
            )}
          </div>
        </PanelSection>
      )}

      {showInlineTimeline ? (
        <PanelSection title="Verlauf" icon={Clock}>
          <RegistrationTimelinePanel
            registrationId={registration.id}
            tenantSlug={tenantSlug}
            locale={locale}
            timezone={timezone}
            refreshKey={registration.updatedAt}
            className=""
          />
        </PanelSection>
      ) : null}
    </div>
  );
}
