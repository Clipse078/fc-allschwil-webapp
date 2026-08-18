"use client";

/**
 * PERSON-UX-01 — Person 360° Übersicht tab.
 * PERSON-UX-07 — Multi-capacity header: shows all active capacities compactly.
 * PERSON-UX-07 UX-ACCEPTANCE — Aktuelle Funktionen section distinguishes three
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
 * Security principle: this tab shows only data visible under people.view.
 * Medical, financial, and private document domains require separate
 * authorization and are intentionally excluded here.
 */

import {
  Building2,
  Users2,
  Calendar,
  UserCheck,
  ShieldCheck,
  KeyRound,
  Star,
  ExternalLink,
} from "lucide-react";
import type {
  PersonAssignment,
  PersonSquadMembership,
  PersonTrainerMembership,
} from "@/lib/people/queries";
import type { PersonDetail } from "@/lib/people/queries";
import { getPersonFunctionLabel, PERSON_FUNCTION_GROUPS } from "@/lib/people/functions";
import { EmptyState } from "@/components/ui/page";

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
  onNavigateToTab?: (tab: "spieler" | "trainer" | "organisation") => void;
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

/** Card for an active team assignment under a specific capacity (State C) */
function CapacityAssignmentCard({
  icon,
  title,
  badge,
  meta,
  onTabLink,
  onTabLinkLabel,
}: {
  icon: React.ReactNode;
  title: string;
  badge?: string | null;
  meta?: Array<{ icon?: React.ReactNode; text: string }>;
  onTabLink?: () => void;
  onTabLinkLabel?: string;
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
 *
 * Operational UX: team name + role are PRIMARY. "Zuordnung unvollständig"
 * is a secondary amber status badge. The CTA deep-links directly to the
 * relevant section on the Team page (spielerkader / trainerteam).
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
}: {
  teamName: string;
  roleLabel: string;
  teamId: string | null | undefined;
  seasonName?: string | null;
  incompleteDescription: string;
  ctaLabel: string;
  anchor: "spielerkader" | "trainerteam";
  icon: React.ReactNode;
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
 * Shows all active standard capacities as inline badges.
 * Custom functions (Weitere Funktion) rendered in a separate line below.
 * When no capacities are active, renders nothing (zero DOM cost).
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

export default function PersonWorkspaceOverviewTab({
  person,
  activeSeason,
  onNavigateToTab,
}: PersonOverviewTabProps) {
  const activeAssignments = person.assignments.filter((a) => a.status === "ACTIVE");
  const activeSquadMemberships = person.squadMemberships.filter(
    (m) => m.status === "ACTIVE" || m.status === "INJURED" || m.status === "ABSENT",
  );
  const activeTrainerMemberships = person.trainerMemberships.filter((m) => m.status === "ACTIVE");

  // Capacity flags (from PersonDetail)
  const isPlayerProfile = person.isPlayer === true;
  const isTrainerProfile = person.isTrainer === true;

  // Team IDs with complete current-season memberships
  const playerCompleteTeamIds = new Set(activeSquadMemberships.map((sm) => sm.teamSeason.team.id));
  const trainerCompleteTeamIds = new Set(activeTrainerMemberships.map((tm) => tm.teamSeason.team.id));

  // State B: active PersonAssignment with player/trainer function but no matching canonical membership
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

  // Assignments to suppress from "Weitere Funktionen" (already surfaced as State B)
  const suppressedFromWeitere = new Set<string>([
    ...incompletePlayerAssignments.map((a) => a.id),
    ...incompleteTrainerAssignments.map((a) => a.id),
  ]);

  const weitereAssignments = activeAssignments.filter((a) => !suppressedFromWeitere.has(a.id));

  // Collect all unique active teams from all sources (for identity section)
  const activeTeamIds = new Set<string>();
  const activeTeamNames: string[] = [];
  for (const sm of activeSquadMemberships) {
    const id = sm.teamSeason.team.id;
    if (!activeTeamIds.has(id)) {
      activeTeamIds.add(id);
      activeTeamNames.push(sm.teamSeason.team.name);
    }
  }
  for (const tm of activeTrainerMemberships) {
    const id = tm.teamSeason.team.id;
    if (!activeTeamIds.has(id)) {
      activeTeamIds.add(id);
      activeTeamNames.push(tm.teamSeason.team.name);
    }
  }
  for (const a of activeAssignments) {
    if (a.team && !activeTeamIds.has(a.team.id)) {
      activeTeamIds.add(a.team.id);
      activeTeamNames.push(a.team.name);
    }
  }

  // Collect all unique OrgUnit names from assignments
  const orgUnitIds = new Set<string>();
  const orgUnitNames: string[] = [];
  for (const a of activeAssignments) {
    if (a.orgUnit && !orgUnitIds.has(a.orgUnit.id)) {
      orgUnitIds.add(a.orgUnit.id);
      orgUnitNames.push(a.orgUnit.name);
    }
  }

  // For the "Aktuelle Funktionen" section: check if there is anything to show
  const hasCapacityRows = isPlayerProfile || isTrainerProfile;
  const hasWeitereRows = weitereAssignments.length > 0;
  const hasSomething = hasCapacityRows || hasWeitereRows;

  const seasonName = activeSeason?.name ?? null;

  return (
    <div className="space-y-8">
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
          {/* PERSON-UX-07: Multi-capacity row — shows all active profile capacities compactly */}
          <CapacitiesRow person={person} />
          {activeTeamNames.length > 0 ? (
            <InfoRow
              label="Aktuelle Teams"
              value={activeTeamNames.join(", ")}
            />
          ) : null}
          {orgUnitNames.length > 0 ? (
            <InfoRow
              label="Organisationseinheiten"
              value={orgUnitNames.join(", ")}
            />
          ) : null}
          {activeSeason ? (
            <InfoRow label="Aktuelle Saison" value={activeSeason.name} />
          ) : null}
        </div>
      </div>

      {/* ── Aktuelle Funktionen ────────────────────────────────────
       * PERSON-UX-07 UX-ACCEPTANCE: Operational first — shows WHERE this
       * person is a player/trainer, with incomplete status as secondary.
       *
       * Three states per capacity:
       *   A. No relationship → compact neutral nudge ("Noch kein Team")
       *   B. Relationship exists but incomplete → team+role as primary,
       *      "Zuordnung unvollständig" badge, precision CTA to team section
       *   C. Complete current-season membership → assignment card
       *
       * PersonAssignment functions NOT already surfaced in State B are shown
       * as "Weitere Funktionen". ────────────────────────────────── */}
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
                {/* State C: complete squad memberships */}
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
                      />
                    ))}
                    {/* State B: additional incomplete assignments alongside complete ones */}
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
                      />
                    ))}
                  </div>
                ) : incompletePlayerAssignments.length > 0 ? (
                  /* State B only: relationship exists but canonical membership is missing */
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
                      />
                    ))}
                  </div>
                ) : (
                  /* State A: no relationship at all */
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
                {/* State C: complete trainer memberships */}
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
                      />
                    ))}
                    {/* State B: additional incomplete assignments alongside complete ones */}
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
                      />
                    ))}
                  </div>
                ) : incompleteTrainerAssignments.length > 0 ? (
                  /* State B only: relationship exists but canonical membership is missing */
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
                      />
                    ))}
                  </div>
                ) : (
                  /* State A: no relationship at all */
                  <UnassignedCapacityNudge
                    explanation={`Das Trainerprofil ist vorhanden, aber für die Saison ${seasonName ?? "die aktuelle Saison"} besteht noch keine Trainer-Zuordnung.`}
                    onTabLink={onNavigateToTab ? () => onNavigateToTab("trainer") : undefined}
                    onTabLinkLabel="Zum Trainer-Tab"
                  />
                )}
              </div>
            ) : null}

            {/* ─ Weitere Funktionen (PersonAssignment functions not already shown above) ─ */}
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
                    />
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>

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
