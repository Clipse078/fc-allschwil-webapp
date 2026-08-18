"use client";

/**
 * PERSON-UX-01 — Sport & Entwicklung tab.
 *
 * Shows the Person's season-by-season sporting biography, built from
 * trustworthy persisted data: PlayerSquadMember and TrainerTeamMember records
 * (each linked to a TeamSeason → Season chain that survives season rollovers).
 *
 * Season-history capability report:
 * - PlayerSquadMember → TeamSeason → Season: TRUSTWORTHY. Each record is
 *   historically persisted; current season change does not alter past records.
 * - TrainerTeamMember → TeamSeason → Season: TRUSTWORTHY. Same chain.
 * - PersonAssignment.seasonId: PARTIAL. seasonId is optional; many assignments
 *   may have no season. Only assignments WITH a seasonId appear here.
 *
 * Gap for PERSON-UX-02: PersonAssignment records without seasonId cannot be
 * placed in a season timeline. Future work: either enforce seasonId on
 * PersonAssignment creation or introduce a separate season-snapshot model.
 *
 * Player development (0–100 north star):
 * - No assessment/rating model currently exists in the schema.
 * - The architectural integration point is established here as a placeholder.
 * - PERSON-UX-02 should introduce: AssessmentSnapshot → criteria → category
 *   scores → normalized 0–100 → season average → multi-season progression.
 * - Do NOT hard-code evaluation categories now; framework must be
 *   age/team-specific.
 */

import { Users2, UserCheck, ChevronDown, ChevronRight, Trophy, TrendingUp } from "lucide-react";
import { useState } from "react";
import type { PersonSquadMembership, PersonTrainerMembership, PersonAssignment } from "@/lib/people/queries";
import { getPersonFunctionLabel } from "@/lib/people/functions";
import { EmptyState } from "@/components/ui/page";

type PersonSportTabProps = {
  squadMemberships: PersonSquadMembership[];
  trainerMemberships: PersonTrainerMembership[];
  assignments: PersonAssignment[];
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

/** Build a season-grouped view from trustworthy persisted data. */
function buildSeasonSnapshots(
  squads: PersonSquadMembership[],
  trainers: PersonTrainerMembership[],
  assignments: PersonAssignment[],
): SeasonSnapshot[] {
  const bySeasonId = new Map<string, SeasonSnapshot>();

  function getOrCreate(season: { id: string; name: string; key: string; isActive: boolean; startDate: Date }): SeasonSnapshot {
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
  // Only include PersonAssignments that have an explicit seasonId
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
              Aktiv
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
                {(sq.positionLabel ?? sq.shirtNumber != null) ? (
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
              <UserCheck className="mt-0.5 h-4 w-4 shrink-0 text-[var(--muted)]" />
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
}: PersonSportTabProps) {
  const snapshots = buildSeasonSnapshots(squadMemberships, trainerMemberships, assignments);
  const hasSeasonData = snapshots.length > 0;

  // Assignments without a seasonId — reported as a gap, not shown in timeline
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
            description="Sobald diese Person einem Team zugeordnet wird, erscheinen hier die Saison-Einträge."
          />
        )}

        {/* Gap notice for PersonAssignment records without seasonId */}
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

      {/* ── Spieler-Entwicklung — Architektureller Platzhalter ────── */}
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
              Dieses Modul ist für PERSON-UX-02 vorgesehen. Vorgesehen ist ein
              Bewertungssystem: Einzelbewertungen → Kategorien → normierter 0–100
              Gesamtwert → saisonaler Durchschnitt → saisonübergreifende Progression.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
