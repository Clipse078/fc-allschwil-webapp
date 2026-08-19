"use client";

/**
 * PERSON-UX-01 — Person 360° Übersicht tab.
 * PERSON-UX-07 — Multi-capacity header: shows all active capacities compactly.
 * PERSON-UX-09 — Current function removal with confirmation dialog.
 *
 * PERSON-UX-07 UX-ACCEPTANCE: Aktuelle Funktionen section distinguishes three
 *   semantically distinct assignment states per capacity:
 *
 *   A. NO RELATIONSHIP
 *      No team/org relationship exists.
 *      "Noch kein Team" — compact neutral card with action nudge.
 *
 *   B. RELATIONSHIP EXISTS BUT INCOMPLETE
 *      A PersonAssignment for a team exists with a player/trainer functionKey,
 *      but the canonical current-season PlayerSquadMember/TrainerTeamMember
 *      record is absent.
 *      Shows team name + role as primary, "Zuordnung unvollständig" as
 *      secondary status badge, with precision CTA deep-linking to the
 *      relevant Team page section (spielerkader / trainerteam).
 *
 *   C. COMPLETE CURRENT-SEASON RELATIONSHIP
 *      Canonical squad/trainer membership exists.
 *      Normal assignment card.
 *
 * PersonAssignment functions shown as "Weitere Funktionen" ONLY when they are
 * not already surfaced in the incomplete (State B) section — preventing the
 * same team/role from appearing twice in conflicting contexts.
 *
 * PERSON-UX-09 removal semantics:
 *   - Squad membership (State C Spieler):      DELETE /api/people/[id]/squad-memberships/[sid]
 *   - Trainer membership (State C Trainer):    DELETE /api/people/[id]/trainer-memberships/[tid]
 *   - PersonAssignment (State B / Weitere):    DELETE /api/people/[id]/assignments/[aid]
 *   Each removal is confirmed via a Dialog before the request is sent.
 *   After success, router.refresh() reloads the server-rendered data.
 *
 * Security principle: this tab shows only data visible under people.view.
 * Medical, financial, and private document domains require separate
 * authorization and are intentionally excluded here.
 */

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  Users2,
  Calendar,
  UserCheck,
  ShieldCheck,
  KeyRound,
  Star,
  ExternalLink,
  FolderOpen,
  Trash2,
} from "lucide-react";
import type {
  PersonAssignment,
  PersonSquadMembership,
  PersonTrainerMembership,
} from "@/lib/people/queries";
import type { PersonDetail } from "@/lib/people/queries";
import { getPersonFunctionLabel, PERSON_FUNCTION_GROUPS } from "@/lib/people/functions";
import { EmptyState } from "@/components/ui/page";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";

/** functionKey sets for player and trainer capacities */
const PLAYER_FUNCTION_KEYS = new Set<string>(PERSON_FUNCTION_GROUPS.SPIELER);
const TRAINER_FUNCTION_KEYS = new Set<string>(PERSON_FUNCTION_GROUPS.TRAINER_STAFF);

type PersonOverviewTabProps = {
  person: PersonDetail & {
    assignments: PersonAssignment[];
    squadMemberships: PersonSquadMembership[];
    trainerMemberships: PersonTrainerMembership[];
  };
  activeSeason: { id: string; name: string; key: string } | null;
  /** Optional: callback to navigate to a different workspace tab. */
  onNavigateToTab?: (tab: "spieler" | "trainer" | "organisation" | "dokumente") => void;
  /**
   * PERSON-UX-08: Pre-computed document count for the Übersicht signal.
   * Only passed when the viewer holds people.private_documents.view.
   * null/undefined → no signal shown (viewer lacks permission or count unavailable).
   */
  documentCount?: number | null;
  /**
   * PERSON-UX-09: Whether the current viewer holds people.manage.
   * Controls visibility of removal affordances.
   */
  canManage?: boolean;
};

function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("de-CH", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function calculateAge(dateOfBirth: Date | string): number {
  const birth = new Date(dateOfBirth);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

/** Section heading */
function SectionHeader({ label }: { label: string }) {
  return (
    <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-[var(--muted)]">
      {label}
    </h3>
  );
}

/**
 * PERSON-UX-09: Discreet remove button for a current function card.
 * Renders only for authorized managers.
 */
function RemoveButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="shrink-0 self-center rounded-md p-1.5 text-[var(--muted)] hover:bg-red-50 hover:text-red-600 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
      data-testid="remove-function-button"
    >
      <Trash2 className="h-3.5 w-3.5" />
    </button>
  );
}

/** Card for an active team assignment under a specific capacity (State C) */
function CapacityAssignmentCard({
  icon,
  title,
  badge,
  meta,
  onTabLink,
  onTabLinkLabel,
  onRemove,
  removeLabel,
}: {
  icon: React.ReactNode;
  title: string;
  badge?: string | null;
  meta?: Array<{ icon?: React.ReactNode; text: string }>;
  onTabLink?: () => void;
  onTabLinkLabel?: string;
  onRemove?: () => void;
  removeLabel?: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
      <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-[var(--sce-accent)] text-[var(--sce-primary)]">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-[var(--foreground)]">{title}</span>
          {badge ? (
            <span className="inline-flex items-center rounded-full bg-[var(--sce-accent)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--sce-primary)]">
              {badge}
            </span>
          ) : null}
        </div>
        {meta && meta.length > 0 ? (
          <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-[var(--muted)]">
            {meta.map((m, i) => (
              <span key={i} className="flex items-center gap-1">
                {m.icon}
                {m.text}
              </span>
            ))}
          </div>
        ) : null}
      </div>
      {onTabLink && onTabLinkLabel ? (
        <button
          type="button"
          onClick={onTabLink}
          className="shrink-0 self-center rounded-md px-2 py-1 text-xs font-medium text-[var(--sce-primary)] hover:bg-[var(--sce-accent)] transition"
        >
          {onTabLinkLabel} →
        </button>
      ) : null}
      {onRemove && removeLabel ? (
        <RemoveButton label={removeLabel} onClick={onRemove} />
      ) : null}
    </div>
  );
}

/**
 * State A nudge: capacity profile exists but no team relationship at all.
 * Compact neutral card — not alarming, just informational.
 */
function UnassignedCapacityNudge({
  explanation,
  onTabLink,
  onTabLinkLabel,
}: {
  explanation: string;
  onTabLink?: () => void;
  onTabLinkLabel?: string;
}) {
  return (
    <div
      className="flex items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3"
      data-testid="unassigned-capacity-nudge"
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-[var(--foreground)]">Noch kein Team</p>
        <p className="mt-0.5 text-xs text-[var(--muted)]">{explanation}</p>
        {onTabLink && onTabLinkLabel ? (
          <button
            type="button"
            onClick={onTabLink}
            className="mt-2 inline-flex items-center rounded-md px-2 py-1 text-xs font-semibold text-[var(--sce-primary)] hover:bg-[var(--sce-accent)] transition"
          >
            {onTabLinkLabel} →
          </button>
        ) : null}
      </div>
    </div>
  );
}

/**
 * State B card: a PersonAssignment exists for a team but the canonical
 * current-season squad/trainer membership is missing.
 */
function IncompleteAssignmentCard({
  teamName,
  roleLabel,
  teamId,
  seasonName,
  incompleteDescription,
  ctaLabel,
  anchor,
  icon,
  onRemove,
  removeLabel,
}: {
  teamName: string;
  roleLabel: string;
  teamId: string | null | undefined;
  seasonName?: string | null;
  incompleteDescription: string;
  ctaLabel: string;
  anchor: "spielerkader" | "trainerteam";
  icon: React.ReactNode;
  onRemove?: () => void;
  removeLabel?: string;
}) {
  return (
    <div
      className="flex items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3"
      data-testid="incomplete-assignment-card"
    >
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--sce-accent)] text-[var(--sce-primary)]">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-[var(--foreground)]">{teamName}</span>
          <span className="inline-flex items-center rounded-full bg-[var(--sce-accent)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--sce-primary)]">
            {roleLabel}
          </span>
          <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-700">
            Zuordnung unvollständig
          </span>
        </div>
        {seasonName ? (
          <div className="mt-1 flex items-center gap-1 text-xs text-[var(--muted)]">
            <Calendar className="h-3 w-3" />
            {seasonName}
          </div>
        ) : null}
        <p className="mt-1 text-xs text-[var(--text-2)]">{incompleteDescription}</p>
        {teamId ? (
          <a
            href={`/dashboard/teams/${teamId}#${anchor}`}
            className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-[var(--sce-primary)] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 transition"
            data-testid="incomplete-assignment-team-link"
          >
            <ExternalLink className="h-3 w-3" />
            {ctaLabel}
          </a>
        ) : null}
      </div>
      {onRemove && removeLabel ? (
        <RemoveButton label={removeLabel} onClick={onRemove} />
      ) : null}
    </div>
  );
}

/** Info row for the identity section */
function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 text-sm">
      <span className="shrink-0 text-[var(--muted)]">{label}</span>
      <span className="text-right font-medium text-[var(--foreground)]">
        {value || <span className="italic text-[var(--muted)]">Nicht erfasst</span>}
      </span>
    </div>
  );
}

/**
 * PERSON-UX-07: Compact capacity badge row for the Identity & Status section.
 */
function CapacitiesRow({ person }: { person: PersonOverviewTabProps["person"] }) {
  const standardCapacities: string[] = [];
  if (person.isPlayer) standardCapacities.push("Spieler/in");
  if (person.isTrainer) standardCapacities.push("Trainer/in");
  if ("isFunctionary" in person && person.isFunctionary) standardCapacities.push("Funktionär/in");
  if ("isReferee" in person && person.isReferee) standardCapacities.push("Schiedsrichter/in");
  if ("isVolunteer" in person && person.isVolunteer) standardCapacities.push("Freiwillige/r");
  if ("isSponsorContact" in person && person.isSponsorContact) standardCapacities.push("Sponsor-/Partner-Kontakt");

  const customFunctions: string[] =
    "customFunctions" in person && Array.isArray(person.customFunctions)
      ? (person.customFunctions as string[])
      : [];

  if (standardCapacities.length === 0 && customFunctions.length === 0) return null;

  return (
    <div className="flex items-start justify-between gap-4 py-2 text-sm">
      <span className="shrink-0 text-[var(--muted)]">Profile</span>
      <div className="flex flex-wrap justify-end gap-1.5">
        {standardCapacities.map((c) => (
          <span
            key={c}
            className="inline-flex items-center rounded-full bg-[var(--sce-accent)] px-2 py-0.5 text-[10px] font-semibold text-[var(--sce-primary)]"
          >
            {c}
          </span>
        ))}
        {customFunctions.map((fn) => (
          <span
            key={fn}
            className="inline-flex items-center rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-2 py-0.5 text-[10px] font-medium text-[var(--text-2)]"
          >
            {fn}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Removal confirmation dialog ───────────────────────────────────────────────

type RemovalTarget =
  | { type: "squad"; squadMemberId: string; teamName: string; seasonName: string }
  | { type: "trainer"; trainerMemberId: string; teamName: string; seasonName: string }
  | { type: "assignment"; assignmentId: string; label: string };

function buildConfirmTitle(target: RemovalTarget): string {
  if (target.type === "squad") {
    return `Spieler-Zuordnung zu ${target.teamName} entfernen?`;
  }
  if (target.type === "trainer") {
    return `Trainer-Zuordnung zu ${target.teamName} entfernen?`;
  }
  return `Zuordnung entfernen?`;
}

function buildConfirmDescription(target: RemovalTarget, personFirstName: string): string {
  if (target.type === "squad") {
    return `Nur die Kader-Zuordnung zu ${target.teamName} (${target.seasonName}) wird entfernt. ${personFirstName} bleibt als Person erhalten. Andere Teams, Trainer-Zuordnungen und historische Saisons bleiben unberührt.`;
  }
  if (target.type === "trainer") {
    return `Nur die Trainer-Zuordnung zu ${target.teamName} (${target.seasonName}) wird entfernt. ${personFirstName} bleibt als Person erhalten. Andere Teams, Spieler-Zuordnungen und historische Saisons bleiben unberührt.`;
  }
  return `Nur diese Zuordnung (${target.label}) wird entfernt. ${personFirstName} bleibt als Person erhalten. Andere Zuordnungen, Team-Mitgliedschaften und historische Saisons bleiben unberührt.`;
}

export default function PersonWorkspaceOverviewTab({
  person,
  activeSeason,
  onNavigateToTab,
  documentCount = null,
  canManage = false,
}: PersonOverviewTabProps) {
  const router = useRouter();

  const [removalTarget, setRemovalTarget] = useState<RemovalTarget | null>(null);
  const [removing, setRemoving] = useState(false);
  const [removalError, setRemovalError] = useState<string | null>(null);

  const activeAssignments = person.assignments.filter((a) => a.status === "ACTIVE");
  const activeSquadMemberships = person.squadMemberships.filter(
    (m) => m.status === "ACTIVE" || m.status === "INJURED" || m.status === "ABSENT",
  );
  const activeTrainerMemberships = person.trainerMemberships.filter((m) => m.status === "ACTIVE");

  const isPlayerProfile = person.isPlayer === true;
  const isTrainerProfile = person.isTrainer === true;

  const playerCompleteTeamIds = new Set(activeSquadMemberships.map((sm) => sm.teamSeason.team.id));
  const trainerCompleteTeamIds = new Set(activeTrainerMemberships.map((tm) => tm.teamSeason.team.id));

  const incompletePlayerAssignments = activeAssignments.filter(
    (a) =>
      a.functionKey !== null &&
      a.functionKey !== undefined &&
      PLAYER_FUNCTION_KEYS.has(a.functionKey) &&
      a.team != null &&
      !playerCompleteTeamIds.has(a.team.id),
  );
  const incompleteTrainerAssignments = activeAssignments.filter(
    (a) =>
      a.functionKey !== null &&
      a.functionKey !== undefined &&
      TRAINER_FUNCTION_KEYS.has(a.functionKey) &&
      a.team != null &&
      !trainerCompleteTeamIds.has(a.team.id),
  );

  const suppressedFromWeitere = new Set<string>([
    ...incompletePlayerAssignments.map((a) => a.id),
    ...incompleteTrainerAssignments.map((a) => a.id),
  ]);

  const weitereAssignments = activeAssignments.filter((a) => !suppressedFromWeitere.has(a.id));

  const activeTeamIds = new Set<string>();
  const activeTeamNames: string[] = [];
  for (const sm of activeSquadMemberships) {
    const id = sm.teamSeason.team.id;
    if (!activeTeamIds.has(id)) { activeTeamIds.add(id); activeTeamNames.push(sm.teamSeason.team.name); }
  }
  for (const tm of activeTrainerMemberships) {
    const id = tm.teamSeason.team.id;
    if (!activeTeamIds.has(id)) { activeTeamIds.add(id); activeTeamNames.push(tm.teamSeason.team.name); }
  }
  for (const a of activeAssignments) {
    if (a.team && !activeTeamIds.has(a.team.id)) {
      activeTeamIds.add(a.team.id);
      activeTeamNames.push(a.team.name);
    }
  }

  const orgUnitIds = new Set<string>();
  const orgUnitNames: string[] = [];
  for (const a of activeAssignments) {
    if (a.orgUnit && !orgUnitIds.has(a.orgUnit.id)) {
      orgUnitIds.add(a.orgUnit.id);
      orgUnitNames.push(a.orgUnit.name);
    }
  }

  const hasCapacityRows = isPlayerProfile || isTrainerProfile;
  const hasWeitereRows = weitereAssignments.length > 0;
  const hasSomething = hasCapacityRows || hasWeitereRows;
  const seasonName = activeSeason?.name ?? null;

  // ── Removal handlers ────────────────────────────────────────────────────────

  const openRemoval = useCallback((target: RemovalTarget) => {
    setRemovalError(null);
    setRemovalTarget(target);
  }, []);

  const closeRemoval = useCallback(() => {
    if (!removing) setRemovalTarget(null);
  }, [removing]);

  const handleConfirmRemoval = useCallback(async () => {
    if (!removalTarget) return;
    setRemoving(true);
    setRemovalError(null);

    try {
      let url: string;
      if (removalTarget.type === "squad") {
        url = `/api/people/${encodeURIComponent(person.id)}/squad-memberships/${encodeURIComponent(removalTarget.squadMemberId)}`;
      } else if (removalTarget.type === "trainer") {
        url = `/api/people/${encodeURIComponent(person.id)}/trainer-memberships/${encodeURIComponent(removalTarget.trainerMemberId)}`;
      } else {
        url = `/api/people/${encodeURIComponent(person.id)}/assignments/${encodeURIComponent(removalTarget.assignmentId)}`;
      }

      const res = await fetch(url, { method: "DELETE" });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setRemovalError(data?.error ?? "Entfernen nicht möglich.");
        return;
      }

      setRemovalTarget(null);
      router.refresh();
    } catch {
      setRemovalError("Netzwerkfehler. Bitte erneut versuchen.");
    } finally {
      setRemoving(false);
    }
  }, [removalTarget, person.id, router]);

  const personFirstName = person.firstName;

  return (
    <div className="space-y-8">
      {/* ── Removal confirmation dialog ────────────────────────────── */}
      {removalTarget ? (
        <Dialog
          open
          onClose={closeRemoval}
          title={buildConfirmTitle(removalTarget)}
          size="sm"
          footer={
            <div className="flex flex-col gap-2 w-full">
              {removalError ? (
                <p className="text-sm text-red-600">{removalError}</p>
              ) : null}
              <div className="flex items-center justify-end gap-3">
                <Button variant="secondary" onClick={closeRemoval} disabled={removing}>
                  Abbrechen
                </Button>
                <Button
                  variant="danger"
                  onClick={handleConfirmRemoval}
                  loading={removing}
                >
                  Entfernen
                </Button>
              </div>
            </div>
          }
        >
          <p className="text-sm text-[var(--text-2)]">
            {buildConfirmDescription(removalTarget, personFirstName)}
          </p>
        </Dialog>
      ) : null}

      {/* ── Identity & Status ─────────────────────────────────────── */}
      <div>
        <SectionHeader label="Identität & Status" />
        <div className="divide-y divide-[var(--border)] overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4">
          <InfoRow
            label="Status"
            value={person.isActive ? "Aktiv" : "Inaktiv"}
          />
          {person.dateOfBirth ? (
            <InfoRow
              label="Geburtsdatum"
              value={`${formatDate(person.dateOfBirth)} (${calculateAge(person.dateOfBirth)} Jahre)`}
            />
          ) : null}
          <CapacitiesRow person={person} />
          {activeTeamNames.length > 0 ? (
            <InfoRow label="Aktuelle Teams" value={activeTeamNames.join(", ")} />
          ) : null}
          {orgUnitNames.length > 0 ? (
            <InfoRow label="Organisationseinheiten" value={orgUnitNames.join(", ")} />
          ) : null}
          {activeSeason ? (
            <InfoRow label="Aktuelle Saison" value={activeSeason.name} />
          ) : null}
        </div>
      </div>

      {/* ── Aktuelle Funktionen ──────────────────────────────────────
       * PERSON-UX-07 UX-ACCEPTANCE: three states per capacity.
       * PERSON-UX-09: removal affordance for authorized managers. */}
      <div>
        <SectionHeader label="Aktuelle Funktionen" />

        {!hasSomething ? (
          <EmptyState
            icon={<Users2 className="h-8 w-8" />}
            heading="Noch keine Zuordnung"
            description="Diese Person hat noch keine aktiven Profile oder Zuordnungen."
          />
        ) : (
          <div className="space-y-3">
            {/* ─ Spieler/in capacity ─ */}
            {isPlayerProfile ? (
              <div>
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
                  Spieler/in
                </p>
                {activeSquadMemberships.length > 0 ? (
                  <div className="space-y-2">
                    {activeSquadMemberships.map((sm) => (
                      <CapacityAssignmentCard
                        key={sm.id}
                        icon={<Users2 className="h-4 w-4" />}
                        title={sm.teamSeason.team.name}
                        badge="Spieler/in"
                        meta={[
                          { icon: <Calendar className="h-3 w-3" />, text: sm.teamSeason.season.name },
                          ...(sm.positionLabel ? [{ text: sm.positionLabel }] : []),
                          ...(sm.shirtNumber != null ? [{ text: `#${sm.shirtNumber}` }] : []),
                          ...(sm.isCaptain ? [{ icon: <Star className="h-3 w-3" />, text: "Captain" }] : []),
                        ]}
                        onTabLink={onNavigateToTab ? () => onNavigateToTab("spieler") : undefined}
                        onTabLinkLabel="Zum Spieler-Tab"
                        onRemove={canManage ? () => openRemoval({
                          type: "squad",
                          squadMemberId: sm.id,
                          teamName: sm.teamSeason.team.name,
                          seasonName: sm.teamSeason.season.name,
                        }) : undefined}
                        removeLabel={canManage ? `Spieler-Zuordnung zu ${sm.teamSeason.team.name} entfernen` : undefined}
                      />
                    ))}
                    {incompletePlayerAssignments.map((a) => (
                      <IncompleteAssignmentCard
                        key={a.id}
                        icon={<Users2 className="h-4 w-4" />}
                        teamName={a.team!.name}
                        roleLabel={getPersonFunctionLabel(a.functionKey)}
                        teamId={a.team!.id}
                        seasonName={a.season?.name ?? seasonName}
                        incompleteDescription={`Das Spielerprofil ist vorhanden, aber für die Saison ${a.season?.name ?? seasonName ?? "die aktuelle Saison"} besteht noch keine Kaderzuordnung.`}
                        ctaLabel="Jetzt Kaderzuordnung ergänzen"
                        anchor="spielerkader"
                        onRemove={canManage ? () => openRemoval({
                          type: "assignment",
                          assignmentId: a.id,
                          label: `${a.team!.name} (${getPersonFunctionLabel(a.functionKey)})`,
                        }) : undefined}
                        removeLabel={canManage ? `Zuordnung zu ${a.team!.name} entfernen` : undefined}
                      />
                    ))}
                  </div>
                ) : incompletePlayerAssignments.length > 0 ? (
                  <div className="space-y-2">
                    {incompletePlayerAssignments.map((a) => (
                      <IncompleteAssignmentCard
                        key={a.id}
                        icon={<Users2 className="h-4 w-4" />}
                        teamName={a.team!.name}
                        roleLabel={getPersonFunctionLabel(a.functionKey)}
                        teamId={a.team!.id}
                        seasonName={a.season?.name ?? seasonName}
                        incompleteDescription={`Das Spielerprofil ist vorhanden, aber für die Saison ${a.season?.name ?? seasonName ?? "die aktuelle Saison"} besteht noch keine Kaderzuordnung.`}
                        ctaLabel="Jetzt Kaderzuordnung ergänzen"
                        anchor="spielerkader"
                        onRemove={canManage ? () => openRemoval({
                          type: "assignment",
                          assignmentId: a.id,
                          label: `${a.team!.name} (${getPersonFunctionLabel(a.functionKey)})`,
                        }) : undefined}
                        removeLabel={canManage ? `Zuordnung zu ${a.team!.name} entfernen` : undefined}
                      />
                    ))}
                  </div>
                ) : (
                  <UnassignedCapacityNudge
                    explanation={`Das Spielerprofil ist vorhanden, aber für die Saison ${seasonName ?? "die aktuelle Saison"} besteht noch keine Kaderzuordnung.`}
                    onTabLink={onNavigateToTab ? () => onNavigateToTab("spieler") : undefined}
                    onTabLinkLabel="Zum Spieler-Tab"
                  />
                )}
              </div>
            ) : null}

            {/* ─ Trainer/in capacity ─ */}
            {isTrainerProfile ? (
              <div>
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
                  Trainer & Staff
                </p>
                {activeTrainerMemberships.length > 0 ? (
                  <div className="space-y-2">
                    {activeTrainerMemberships.map((tm) => (
                      <CapacityAssignmentCard
                        key={tm.id}
                        icon={<UserCheck className="h-4 w-4" />}
                        title={tm.teamSeason.team.name}
                        badge={tm.roleLabel ?? "Trainer/in"}
                        meta={[
                          { icon: <Calendar className="h-3 w-3" />, text: tm.teamSeason.season.name },
                        ]}
                        onTabLink={onNavigateToTab ? () => onNavigateToTab("trainer") : undefined}
                        onTabLinkLabel="Zum Trainer-Tab"
                        onRemove={canManage ? () => openRemoval({
                          type: "trainer",
                          trainerMemberId: tm.id,
                          teamName: tm.teamSeason.team.name,
                          seasonName: tm.teamSeason.season.name,
                        }) : undefined}
                        removeLabel={canManage ? `Trainer-Zuordnung zu ${tm.teamSeason.team.name} entfernen` : undefined}
                      />
                    ))}
                    {incompleteTrainerAssignments.map((a) => (
                      <IncompleteAssignmentCard
                        key={a.id}
                        icon={<UserCheck className="h-4 w-4" />}
                        teamName={a.team!.name}
                        roleLabel={getPersonFunctionLabel(a.functionKey)}
                        teamId={a.team!.id}
                        seasonName={a.season?.name ?? seasonName}
                        incompleteDescription={`${person.firstName} ist bereits dem Team ${a.team!.name} zugeordnet, aber noch nicht im Trainerteam der Saison ${a.season?.name ?? seasonName ?? "die aktuelle Saison"} hinterlegt.`}
                        ctaLabel="Trainer-Zuordnung vervollständigen"
                        anchor="trainerteam"
                        onRemove={canManage ? () => openRemoval({
                          type: "assignment",
                          assignmentId: a.id,
                          label: `${a.team!.name} (${getPersonFunctionLabel(a.functionKey)})`,
                        }) : undefined}
                        removeLabel={canManage ? `Zuordnung zu ${a.team!.name} entfernen` : undefined}
                      />
                    ))}
                  </div>
                ) : incompleteTrainerAssignments.length > 0 ? (
                  <div className="space-y-2">
                    {incompleteTrainerAssignments.map((a) => (
                      <IncompleteAssignmentCard
                        key={a.id}
                        icon={<UserCheck className="h-4 w-4" />}
                        teamName={a.team!.name}
                        roleLabel={getPersonFunctionLabel(a.functionKey)}
                        teamId={a.team!.id}
                        seasonName={a.season?.name ?? seasonName}
                        incompleteDescription={`${person.firstName} ist bereits dem Team ${a.team!.name} zugeordnet, aber noch nicht im Trainerteam der Saison ${a.season?.name ?? seasonName ?? "die aktuelle Saison"} hinterlegt.`}
                        ctaLabel="Trainer-Zuordnung vervollständigen"
                        anchor="trainerteam"
                        onRemove={canManage ? () => openRemoval({
                          type: "assignment",
                          assignmentId: a.id,
                          label: `${a.team!.name} (${getPersonFunctionLabel(a.functionKey)})`,
                        }) : undefined}
                        removeLabel={canManage ? `Zuordnung zu ${a.team!.name} entfernen` : undefined}
                      />
                    ))}
                  </div>
                ) : (
                  <UnassignedCapacityNudge
                    explanation={`Das Trainerprofil ist vorhanden, aber für die Saison ${seasonName ?? "die aktuelle Saison"} besteht noch keine Trainer-Zuordnung.`}
                    onTabLink={onNavigateToTab ? () => onNavigateToTab("trainer") : undefined}
                    onTabLinkLabel="Zum Trainer-Tab"
                  />
                )}
              </div>
            ) : null}

            {/* ─ Weitere Funktionen ─ */}
            {weitereAssignments.length > 0 ? (
              <div>
                {(isPlayerProfile || isTrainerProfile) ? (
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
                    Weitere Funktionen
                  </p>
                ) : null}
                <div className="space-y-2">
                  {weitereAssignments.map((a) => (
                    <CapacityAssignmentCard
                      key={a.id}
                      icon={
                        a.team ? (
                          <Users2 className="h-4 w-4" />
                        ) : (
                          <Building2 className="h-4 w-4" />
                        )
                      }
                      title={a.team?.name ?? a.orgUnit?.name ?? "—"}
                      badge={getPersonFunctionLabel(a.functionKey)}
                      meta={[
                        ...(a.team && a.orgUnit
                          ? [{ icon: <Building2 className="h-3 w-3" />, text: a.orgUnit.name }]
                          : []),
                        ...(a.season
                          ? [{ icon: <Calendar className="h-3 w-3" />, text: a.season.name }]
                          : []),
                      ]}
                      onTabLink={onNavigateToTab ? () => onNavigateToTab("organisation") : undefined}
                      onTabLinkLabel="Zur Organisation"
                      onRemove={canManage ? () => openRemoval({
                        type: "assignment",
                        assignmentId: a.id,
                        label: `${a.team?.name ?? a.orgUnit?.name ?? "Zuordnung"} (${getPersonFunctionLabel(a.functionKey)})`,
                      }) : undefined}
                      removeLabel={canManage ? `Zuordnung ${getPersonFunctionLabel(a.functionKey)} entfernen` : undefined}
                    />
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* ── Dokumente signal ────────────────────────────────────────
           PERSON-UX-08: Only shown to authorized viewers. */}
      {documentCount !== null && documentCount !== undefined ? (
        <div>
          <SectionHeader label="Dokumente" />
          <button
            type="button"
            onClick={onNavigateToTab ? () => onNavigateToTab("dokumente") : undefined}
            disabled={!onNavigateToTab}
            className="flex w-full items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-left transition hover:bg-[var(--surface-2)] disabled:cursor-default disabled:hover:bg-[var(--surface)]"
          >
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-[var(--surface-2)] text-[var(--muted)]">
              <FolderOpen className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-sm font-medium text-[var(--foreground)]">
                {documentCount === 0
                  ? "Noch keine Dokumente"
                  : `${documentCount} ${documentCount === 1 ? "Dokument" : "Dokumente"}`}
              </span>
              {onNavigateToTab ? (
                <p className="text-xs text-[var(--muted)]">Zum Dokumente-Tab wechseln</p>
              ) : null}
            </div>
            {onNavigateToTab ? (
              <ExternalLink className="h-3.5 w-3.5 flex-shrink-0 text-[var(--muted)]" />
            ) : null}
          </button>
        </div>
      ) : null}

      {/* ── Zugang & Konto ────────────────────────────────────────── */}
      <div>
        <SectionHeader label="Zugang & Konto" />
        <div className="flex items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
          <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-[var(--surface-2)] text-[var(--muted)]">
            {person.user ? (
              <ShieldCheck className="h-4 w-4" />
            ) : (
              <KeyRound className="h-4 w-4" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            {person.user ? (
              <>
                <span className="text-sm font-semibold text-[var(--foreground)]">
                  Benutzerkonto verknüpft
                </span>
                <p className="mt-0.5 text-xs text-[var(--muted)]">{person.user.email}</p>
                {!person.user.isActive ? (
                  <p className="mt-1 text-xs font-medium text-amber-600">
                    Konto deaktiviert
                  </p>
                ) : null}
              </>
            ) : (
              <>
                <span className="text-sm font-medium text-[var(--muted)]">
                  Kein Benutzerkonto verknüpft
                </span>
                <p className="mt-0.5 text-xs text-[var(--muted)]">
                  Diese Person hat keinen digitalen Zugang zur Plattform.
                </p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Notes ────────────────────────────────────────────────── */}
      {person.notes ? (
        <div>
          <SectionHeader label="Notizen" />
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--text-2)]">
              {person.notes}
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
