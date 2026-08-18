"use client";

/**
 * PERSON-UX-01 — Person 360° Übersicht tab.
 * PERSON-UX-07 — Multi-capacity header: shows all active capacities compactly.
 * PERSON-UX-07 UX-ACCEPTANCE — Aktuelle Funktionen section clearly distinguishes
 *   capacity profile from actual team/season assignment.
 *
 * Shows the current canonical state of this Person across all simultaneously
 * held roles and relationships. A Person may have multiple capacities at once;
 * this tab never reduces a Person to a single "primary role".
 *
 * Aktuelle Funktionen section (key UX improvement):
 *   For each capacity flag (isPlayer, isTrainer), the section shows:
 *   • Current active team assignment(s) with team name, role, and season.
 *   • An actionable nudge when the capacity profile exists but NO current-season
 *     team assignment is present — distinguishing the two concepts clearly.
 *   PersonAssignment functions (Organisation) shown as a separate group.
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
  AlertCircle,
} from "lucide-react";
import type {
  PersonAssignment,
  PersonSquadMembership,
  PersonTrainerMembership,
} from "@/lib/people/queries";
import type { PersonDetail } from "@/lib/people/queries";
import { getPersonFunctionLabel } from "@/lib/people/functions";
import { EmptyState } from "@/components/ui/page";

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

/** Card for an active team assignment under a specific capacity */
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
 * Nudge card shown when a capacity profile exists but no current team assignment.
 * Clearly distinguishes "capacity profile present" from "actual assignment present".
 */
function UnassignedCapacityNudge({
  capacityLabel,
  explanation,
  onTabLink,
  onTabLinkLabel,
}: {
  capacityLabel: string;
  explanation: string;
  onTabLink?: () => void;
  onTabLinkLabel?: string;
}) {
  return (
    <div
      className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3"
      data-testid="unassigned-capacity-nudge"
    >
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
        <AlertCircle className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-amber-800">{capacityLabel}</p>
        <p className="mt-0.5 text-xs text-amber-700">{explanation}</p>
        {onTabLink && onTabLinkLabel ? (
          <button
            type="button"
            onClick={onTabLink}
            className="mt-2 inline-flex items-center rounded-md border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-50 transition"
          >
            {onTabLinkLabel}
          </button>
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

  // Whether actual current assignments exist
  const hasCurrentPlayerAssignment = activeSquadMemberships.length > 0;
  const hasCurrentTrainerAssignment = activeTrainerMemberships.length > 0;

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
  const hasAssignmentRows = activeAssignments.length > 0;
  const hasSomething = hasCapacityRows || hasAssignmentRows;

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
       * PERSON-UX-07 UX-ACCEPTANCE: This section answers:
       *   "Where is this Person currently a player / trainer?"
       *
       * For each capacity flag, we show either:
       *   (a) the concrete current team assignment(s), or
       *   (b) an actionable nudge distinguishing "profile exists, not yet
       *       assigned to a team for the current season."
       *
       * PersonAssignment functions (Organisation) shown below as a separate
       * group. The two concepts (capacity profile vs. team assignment) are
       * visually distinct. ──────────────────────────────────────── */}
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
                {hasCurrentPlayerAssignment ? (
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
                  </div>
                ) : (
                  <UnassignedCapacityNudge
                    capacityLabel="Spielerprofil vorhanden – noch keinem Team für die aktuelle Saison zugeordnet"
                    explanation="Das Spielerprofil ist vorhanden, aber für die aktuelle Saison besteht keine Teamzuordnung. Kader-Zuordnungen werden über das Team-Management verwaltet."
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
                  Trainer/in
                </p>
                {hasCurrentTrainerAssignment ? (
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
                  </div>
                ) : (
                  <UnassignedCapacityNudge
                    capacityLabel="Trainerprofil vorhanden – noch keinem Team für die aktuelle Saison zugeordnet"
                    explanation="Das Trainerprofil ist vorhanden, aber für die aktuelle Saison besteht keine Teamzuordnung. Trainer-Zuordnungen werden über das Team-Management verwaltet."
                    onTabLink={onNavigateToTab ? () => onNavigateToTab("trainer") : undefined}
                    onTabLinkLabel="Zum Trainer-Tab"
                  />
                )}
              </div>
            ) : null}

            {/* ─ PersonAssignment functions (Organisation) ─ */}
            {activeAssignments.length > 0 ? (
              <div>
                {(isPlayerProfile || isTrainerProfile) ? (
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
                    Weitere Funktionen
                  </p>
                ) : null}
                <div className="space-y-2">
                  {activeAssignments.map((a) => (
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
