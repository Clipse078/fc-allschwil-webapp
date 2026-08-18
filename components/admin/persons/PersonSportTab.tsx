"use client";

/**
 * PERSON-UX-02 — Sport & Entwicklung tab.
 *
 * Visible iff the Person has any sporting evidence (player or trainer).
 *
 * Purpose: cross-role season biography + development progression placeholder.
 * Role-specific history (team detail, positions, roleLabel) lives in the
 * dedicated Spieler / Trainer tabs. This tab provides:
 *
 *   1. Saison-Biografie — all concurrent roles under each season in one view.
 *      Useful when a Person holds multiple roles (player + trainer + function)
 *      in the same season; the cross-role timeline is the canonical biography.
 *
 *   2. Entwicklungs-Profil — architectural placeholder.
 *      North star (PERSON-UX-03+): assessment snapshots → criteria → normalized
 *      0–100 → season average → multi-season progression.
 *      Category framework must be age/team-specific; do not hard-code now.
 *
 * Season-trustworthiness:
 *   PlayerSquadMember → TeamSeason → Season: TRUSTWORTHY (historically persisted)
 *   TrainerTeamMember → TeamSeason → Season: TRUSTWORTHY (historically persisted)
 *   PersonAssignment.seasonId: PARTIAL — only assignments WITH a seasonId appear
 *   in the timeline. Gap notice is shown for active unseasoned assignments.
 *
 * External-only Persons (no sporting history) never see this tab — handled by
 * the tab registry in PersonDetailTabs.
 */

import { Users2, UserCheck, ChevronDown, ChevronRight, Trophy, TrendingUp, Building2 } from "lucide-react";
import { useState } from "react";
import type { PersonSquadMembership, PersonTrainerMembership, PersonAssignment } from "@/lib/people/queries";
import { getPersonFunctionLabel } from "@/lib/people/functions";
import { EmptyState } from "@/components/ui/page";

type PersonSportTabProps = {
  squadMemberships: PersonSquadMembership[];
  trainerMemberships: PersonTrainerMembership[];
  assignments: PersonAssignment[];
  /**
   * PERSON-UX-03: Whether the viewer holds people.development.view.
   * The development/assessment section is only rendered when true — absent
   * when false, leaving no hint about the domain's existence.
   * Future individual ratings must NEVER be shown without this flag.
   */
  canViewDevelopment?: boolean;
};

type SeasonSnapshot = {
  seasonId: string;
  seasonName: string;
  seasonKey: string;
  isActive: boolean;
  startDate: Date;
  squadEntries: PersonSquadMembership[];
  trainerEntries: PersonTrainerMembership[];
  assignmentEntries: PersonAssignment[];
};

function buildSeasonSnapshots(
  squads: PersonSquadMembership[],
  trainers: PersonTrainerMembership[],
  assignments: PersonAssignment[],
): SeasonSnapshot[] {
  const bySeasonId = new Map<string, SeasonSnapshot>();

  function getOrCreate(season: {
    id: string;
    name: string;
    key: string;
    isActive: boolean;
    startDate: Date;
  }): SeasonSnapshot {
    if (!bySeasonId.has(season.id)) {
      bySeasonId.set(season.id, {
        seasonId: season.id,
        seasonName: season.name,
        seasonKey: season.key,
        isActive: season.isActive,
        startDate: season.startDate,
        squadEntries: [],
        trainerEntries: [],
        assignmentEntries: [],
      });
    }
    return bySeasonId.get(season.id)!;
  }

  for (const sq of squads) {
    getOrCreate(sq.teamSeason.season).squadEntries.push(sq);
  }
  for (const tr of trainers) {
    getOrCreate(tr.teamSeason.season).trainerEntries.push(tr);
  }
  for (const a of assignments) {
    if (a.season) {
      getOrCreate(a.season as { id: string; name: string; key: string; isActive: boolean; startDate: Date }).assignmentEntries.push(a);
    }
  }

  return Array.from(bySeasonId.values()).sort(
    (a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime(),
  );
}

function SeasonAccordion({ snapshot }: { snapshot: SeasonSnapshot }) {
  const [open, setOpen] = useState(snapshot.isActive);
  const totalRoles =
    snapshot.squadEntries.length +
    snapshot.trainerEntries.length +
    snapshot.assignmentEntries.length;

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left transition hover:bg-[var(--surface-2)]"
        aria-expanded={open}
      >
        <div className="flex items-center gap-3">
          <Trophy className="h-4 w-4 shrink-0 text-[var(--sce-primary)]" />
          <span className="text-sm font-semibold text-[var(--foreground)]">
            {snapshot.seasonName}
          </span>
          {snapshot.isActive ? (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
              Aktuell
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-3 text-xs text-[var(--muted)]">
          <span>{totalRoles} {totalRoles === 1 ? "Rolle" : "Rollen"}</span>
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </div>
      </button>

      {open ? (
        <div className="divide-y divide-[var(--border)] border-t border-[var(--border)]">
          {snapshot.squadEntries.map((sq) => (
            <div key={sq.id} className="flex items-start gap-3 px-4 py-3">
              <Users2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--sce-primary)]" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-[var(--foreground)]">
                    {sq.teamSeason.team.name}
                  </span>
                  <span className="rounded-full bg-[var(--sce-accent)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--sce-primary)]">
                    Spieler/in
                  </span>
                  {sq.isCaptain ? (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                      Captain
                    </span>
                  ) : null}
                  {sq.status !== "ACTIVE" ? (
                    <span className="rounded-full bg-[var(--surface-3)] px-2 py-0.5 text-[10px] font-medium text-[var(--muted)]">
                      {sq.status === "INJURED" ? "Verletzt" : sq.status === "ABSENT" ? "Abwesend" : sq.status}
                    </span>
                  ) : null}
                </div>
                {(sq.positionLabel != null || sq.shirtNumber != null) ? (
                  <p className="mt-0.5 text-xs text-[var(--muted)]">
                    {[sq.positionLabel, sq.shirtNumber != null ? `#${sq.shirtNumber}` : null]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                ) : null}
              </div>
            </div>
          ))}

          {snapshot.trainerEntries.map((tr) => (
            <div key={tr.id} className="flex items-start gap-3 px-4 py-3">
              <UserCheck className="mt-0.5 h-4 w-4 shrink-0 text-[var(--sce-primary)]" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-[var(--foreground)]">
                    {tr.teamSeason.team.name}
                  </span>
                  <span className="rounded-full bg-[var(--sce-accent)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--sce-primary)]">
                    {tr.roleLabel ?? "Trainer/in"}
                  </span>
                </div>
              </div>
            </div>
          ))}

          {snapshot.assignmentEntries.map((a) => (
            <div key={a.id} className="flex items-start gap-3 px-4 py-3">
              <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--muted)]" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-[var(--foreground)]">
                    {a.team?.name ?? a.orgUnit?.name ?? "—"}
                  </span>
                  <span className="rounded-full bg-[var(--sce-accent)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--sce-primary)]">
                    {getPersonFunctionLabel(a.functionKey)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function PersonSportTab({
  squadMemberships,
  trainerMemberships,
  assignments,
  canViewDevelopment = false,
}: PersonSportTabProps) {
  const snapshots = buildSeasonSnapshots(squadMemberships, trainerMemberships, assignments);
  const hasSeasonData = snapshots.length > 0;

  const unseasoned = assignments.filter((a) => a.status === "ACTIVE" && !a.season);

  return (
    <div className="space-y-8">
      {/* ── Saison-Biografie ──────────────────────────────────────── */}
      <div>
        <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-[var(--muted)]">
          Saison-Biografie
        </h3>

        {hasSeasonData ? (
          <div className="space-y-3">
            {snapshots.map((s) => (
              <SeasonAccordion key={s.seasonId} snapshot={s} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<Trophy className="h-8 w-8" />}
            heading="Noch keine Saison-Einträge"
            description="Sobald diese Person einem Team oder Kader zugeordnet wird, erscheinen hier die Saison-Einträge."
          />
        )}

        {unseasoned.length > 0 ? (
          <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3">
            <p className="text-xs font-medium text-[var(--muted)]">
              Hinweis: {unseasoned.length}{" "}
              {unseasoned.length === 1 ? "aktive Zuordnung hat" : "aktive Zuordnungen haben"}{" "}
              keine Saison-Verknüpfung und {unseasoned.length === 1 ? "erscheint" : "erscheinen"}{" "}
              nicht in der Saison-Biografie. Details unter &quot;Organisation&quot;.
            </p>
          </div>
        ) : null}
      </div>

      {/* ── Spieler-Entwicklung — gated by people.development.view ─── */}
      {/* PERSON-UX-03: development section is absent when canViewDevelopment=false.
          No locked state, no existence hint. Future ratings must NEVER inherit
          generic people.view — this flag is the sole gate. */}
      {canViewDevelopment ? (
        <div>
          <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-[var(--muted)]">
            Spieler-Entwicklung
          </h3>
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface)] px-6 py-8 text-center">
            <TrendingUp className="h-8 w-8 text-[var(--muted)]" />
            <div>
              <p className="text-sm font-semibold text-[var(--foreground)]">
                Entwicklungs-Bewertungen
              </p>
              <p className="mt-1 max-w-sm text-xs leading-relaxed text-[var(--muted)]">
                Dieses Modul ist für PERSON-UX-03 vorgesehen. Geplant ist ein
                Bewertungssystem: Einzelbewertungen → Kategorien → normierter 0–100
                Gesamtwert → saisonaler Durchschnitt → saisonübergreifende Progression.
                Das Kategorie-Framework wird alters- und teamspezifisch sein.
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
