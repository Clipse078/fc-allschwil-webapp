"use client";

/**
 * PERSON-UX-01 — Person 360° Übersicht tab.
 * PERSON-UX-07 — Multi-capacity header: shows all active capacities compactly.
 *
 * Shows the current canonical state of this Person across all simultaneously
 * held roles and relationships. A Person may have multiple capacities at once;
 * this tab never reduces a Person to a single "primary role".
 *
 * Header capacity row shows: Spieler/in, Trainer/in, Funktionär/in,
 * Schiedsrichter/in, Freiwillige/r, Sponsor-/Partner-Kontakt — compactly.
 * Custom functions (Weitere Funktion) shown in a separate "Profile & Funktionen" row.
 *
 * Security principle: this tab shows only data visible under people.view.
 * Medical, financial, and private document domains require separate
 * authorization and are intentionally excluded here.
 */

import { Building2, Users2, Calendar, UserCheck, ShieldCheck, KeyRound, Star } from "lucide-react";
import type { PersonAssignment, PersonSquadMembership, PersonTrainerMembership } from "@/lib/people/queries";
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

/** Card for an active role/function */
function RoleCard({
  icon,
  title,
  subtitle,
  badge,
  meta,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string | null;
  badge?: string | null;
  meta?: Array<{ icon?: React.ReactNode; text: string }>;
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
        {subtitle ? (
          <p className="mt-0.5 text-xs text-[var(--muted)]">{subtitle}</p>
        ) : null}
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
}: PersonOverviewTabProps) {
  const activeAssignments = person.assignments.filter((a) => a.status === "ACTIVE");
  const activeSquadMemberships = person.squadMemberships.filter(
    (m) => m.status === "ACTIVE" || m.status === "INJURED" || m.status === "ABSENT",
  );
  const activeTrainerMemberships = person.trainerMemberships.filter((m) => m.status === "ACTIVE");

  // Collect all unique active teams from all sources
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

  const hasAnything =
    activeAssignments.length > 0 ||
    activeSquadMemberships.length > 0 ||
    activeTrainerMemberships.length > 0;

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

      {/* ── Aktuelle Rollen & Funktionen ──────────────────────────── */}
      <div>
        <SectionHeader label="Aktuelle Rollen & Funktionen" />

        {!hasAnything ? (
          <EmptyState
            icon={<Users2 className="h-8 w-8" />}
            heading="Noch keine Zuordnung"
            description="Diese Person hat noch keine aktiven Rollen oder Zuordnungen."
          />
        ) : (
          <div className="space-y-2">
            {/* Squad (player) memberships */}
            {activeSquadMemberships.map((sm) => (
              <RoleCard
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
              />
            ))}

            {/* Trainer memberships */}
            {activeTrainerMemberships.map((tm) => (
              <RoleCard
                key={tm.id}
                icon={<UserCheck className="h-4 w-4" />}
                title={tm.teamSeason.team.name}
                badge={tm.roleLabel ?? "Trainer/in"}
                meta={[
                  { icon: <Calendar className="h-3 w-3" />, text: tm.teamSeason.season.name },
                ]}
              />
            ))}

            {/* PersonAssignment functions */}
            {activeAssignments.map((a) => (
              <RoleCard
                key={a.id}
                icon={a.team ? <Users2 className="h-4 w-4" /> : <Building2 className="h-4 w-4" />}
                title={a.team?.name ?? a.orgUnit?.name ?? "—"}
                badge={getPersonFunctionLabel(a.functionKey)}
                subtitle={a.team && a.orgUnit ? a.orgUnit.name : undefined}
                meta={[
                  ...(a.season ? [{ icon: <Calendar className="h-3 w-3" />, text: a.season.name }] : []),
                ]}
              />
            ))}
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
