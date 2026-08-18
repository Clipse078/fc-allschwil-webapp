"use client";

/**
 * PERSON-UX-02 — Trainer tab.
 * PERSON-UX-07 UX-ACCEPTANCE — Distinguishes three semantically distinct states:
 *
 *   A. NO RELATIONSHIP
 *      No trainer-function PersonAssignment and no TrainerTeamMember records exist.
 *      "Noch keinem Team als Trainer/in zugeordnet" — compact neutral card.
 *
 *   B. RELATIONSHIP EXISTS BUT INCOMPLETE
 *      A PersonAssignment with a trainer-function key exists for a team,
 *      but the canonical current-season TrainerTeamMember record is absent.
 *      Team name + role as PRIMARY; "Zuordnung unvollständig" as amber badge.
 *      CTA deep-links to /dashboard/teams/:teamId#trainerteam.
 *
 *   C. COMPLETE CURRENT-SEASON RELATIONSHIP
 *      Active TrainerTeamMember record exists.
 *      Normal assignment card.
 *
 * Rendered iff the Person has current OR historical trainer evidence.
 *
 * Data source: TrainerTeamMember → TeamSeason → Season (fully persisted,
 * historically stable chain). No fabrication from isTrainer flag.
 *
 * Canonical staff/function context from PersonAssignment is surfaced
 * where available (visible in the Organisation tab for full detail).
 */

import { UserCheck, Trophy, ChevronDown, ChevronRight, ExternalLink } from "lucide-react";
import { useState } from "react";
import type { PersonTrainerMembership, PersonAssignment } from "@/lib/people/queries";
import { getPersonFunctionLabel, PERSON_FUNCTION_GROUPS } from "@/lib/people/functions";
import { EmptyState } from "@/components/ui/page";

const TRAINER_FUNCTION_KEYS = new Set<string>(PERSON_FUNCTION_GROUPS.TRAINER_STAFF);

type PersonTrainerTabProps = {
  trainerMemberships: PersonTrainerMembership[];
  /**
   * PERSON-UX-07 UX-ACCEPTANCE: PersonAssignments used to detect the
   * "relationship exists but incomplete" state (State B).
   * When provided, distinguishes State A (no relationship) from State B
   * (trainer assignment exists but no TrainerTeamMember for current season).
   */
  assignments?: PersonAssignment[];
  /**
   * PERSON-UX-07 UX-ACCEPTANCE: active season for user-facing wording.
   * Used in incomplete state description ("für die Saison X").
   */
  activeSeason?: { id: string; name: string; key: string } | null;
  /**
   * PERSON-UX-07 UX-ACCEPTANCE: first name of the person for the State B
   * description ("{firstName} ist bereits dem Team ... zugeordnet").
   */
  personFirstName?: string;
  /**
   * PERSON-UX-07 UX-ACCEPTANCE: optional callback to navigate to a sibling tab.
   * Used for State A CTA (no assignment at all — go set one up via Organisation).
   */
  onNavigateToTab?: (tab: "organisation" | "spieler") => void;
};

type SeasonTrainerSnapshot = {
  seasonId: string;
  seasonName: string;
  isActive: boolean;
  startDate: Date;
  entries: PersonTrainerMembership[];
};

function buildTrainerSeasonSnapshots(trainers: PersonTrainerMembership[]): SeasonTrainerSnapshot[] {
  const bySeasonId = new Map<string, SeasonTrainerSnapshot>();

  for (const tr of trainers) {
    const s = tr.teamSeason.season;
    if (!bySeasonId.has(s.id)) {
      bySeasonId.set(s.id, {
        seasonId: s.id,
        seasonName: s.name,
        isActive: s.isActive,
        startDate: s.startDate,
        entries: [],
      });
    }
    bySeasonId.get(s.id)!.entries.push(tr);
  }

  return Array.from(bySeasonId.values()).sort(
    (a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime(),
  );
}

function TrainerEntry({ tr }: { tr: PersonTrainerMembership }) {
  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <UserCheck className="mt-0.5 h-4 w-4 shrink-0 text-[var(--sce-primary)]" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-[var(--foreground)]">
            {tr.teamSeason.team.name}
          </span>
          <span className="rounded-full bg-[var(--sce-accent)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--sce-primary)]">
            {tr.roleLabel ?? "Trainer/in"}
          </span>
          {tr.status !== "ACTIVE" ? (
            <span className="rounded-full bg-[var(--surface-3)] px-2 py-0.5 text-[10px] font-medium text-[var(--muted)]">
              {tr.status}
            </span>
          ) : null}
        </div>
        {tr.remarks ? (
          <p className="mt-0.5 text-xs italic text-[var(--muted)]">{tr.remarks}</p>
        ) : null}
      </div>
    </div>
  );
}

function SeasonAccordion({ snapshot }: { snapshot: SeasonTrainerSnapshot }) {
  const [open, setOpen] = useState(snapshot.isActive);

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
          <span>
            {snapshot.entries.length}{" "}
            {snapshot.entries.length === 1 ? "Team" : "Teams"}
          </span>
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </div>
      </button>

      {open ? (
        <div className="divide-y divide-[var(--border)] border-t border-[var(--border)]">
          {snapshot.entries.map((tr) => (
            <TrainerEntry key={tr.id} tr={tr} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function SectionHeader({ label }: { label: string }) {
  return (
    <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-[var(--muted)]">
      {label}
    </h3>
  );
}

export default function PersonTrainerTab({
  trainerMemberships,
  assignments = [],
  activeSeason,
  personFirstName,
  onNavigateToTab,
}: PersonTrainerTabProps) {
  const activeTrainers = trainerMemberships.filter((m) => m.status === "ACTIVE");
  const snapshots = buildTrainerSeasonSnapshots(trainerMemberships);

  // State B: active PersonAssignment with trainer function but no matching TrainerTeamMember
  const trainerCompleteTeamIds = new Set(activeTrainers.map((tm) => tm.teamSeason.team.id));
  const incompleteTrainerAssignments = assignments.filter(
    (a) =>
      a.status === "ACTIVE" &&
      a.functionKey !== null &&
      a.functionKey !== undefined &&
      TRAINER_FUNCTION_KEYS.has(a.functionKey) &&
      a.team != null &&
      !trainerCompleteTeamIds.has(a.team.id),
  );

  const seasonLabel = activeSeason?.name ?? "die aktuelle Saison";
  const name = personFirstName ?? "Diese Person";

  function trainerIncompleteDescription(teamName: string, assignmentSeasonName?: string | null): string {
    const season = assignmentSeasonName ?? seasonLabel;
    return `${name} ist bereits dem Team ${teamName} zugeordnet, aber noch nicht im Trainerteam der Saison ${season} hinterlegt.`;
  }

  return (
    <div className="space-y-8">
      {/* ── Aktuelle Trainerteams ─────────────────────────────────── */}
      <div>
        <SectionHeader label="Aktuelle Trainerteams" />
        {activeTrainers.length > 0 ? (
          /* State C: complete trainer memberships */
          <div className="space-y-2">
            <div className="divide-y divide-[var(--border)] overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
              {activeTrainers.map((tr) => (
                <TrainerEntry key={tr.id} tr={tr} />
              ))}
            </div>
            {/* State B alongside C: additional incomplete trainer assignments */}
            {incompleteTrainerAssignments.map((a) => (
              <div
                key={a.id}
                className="flex items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3"
                data-testid="trainer-incomplete-assignment"
              >
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--sce-accent)] text-[var(--sce-primary)]">
                  <UserCheck className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-[var(--foreground)]">{a.team!.name}</span>
                    <span className="inline-flex items-center rounded-full bg-[var(--sce-accent)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--sce-primary)]">
                      {getPersonFunctionLabel(a.functionKey)}
                    </span>
                    <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-700">
                      Zuordnung unvollständig
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-[var(--text-2)]">
                    {trainerIncompleteDescription(a.team!.name, a.season?.name)}
                  </p>
                  {a.team?.id ? (
                    <a
                      href={`/dashboard/teams/${a.team.id}#trainerteam`}
                      className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-[var(--sce-primary)] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 transition"
                      data-testid="trainer-incomplete-team-link"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Trainer-Zuordnung vervollständigen
                    </a>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        ) : incompleteTrainerAssignments.length > 0 ? (
          /* State B only: relationship exists but no TrainerTeamMember */
          <div className="space-y-2">
            {incompleteTrainerAssignments.map((a) => (
              <div
                key={a.id}
                className="flex items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3"
                data-testid="trainer-incomplete-assignment"
              >
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--sce-accent)] text-[var(--sce-primary)]">
                  <UserCheck className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-[var(--foreground)]">{a.team!.name}</span>
                    <span className="inline-flex items-center rounded-full bg-[var(--sce-accent)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--sce-primary)]">
                      {getPersonFunctionLabel(a.functionKey)}
                    </span>
                    <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-700">
                      Zuordnung unvollständig
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-[var(--text-2)]">
                    {trainerIncompleteDescription(a.team!.name, a.season?.name)}
                  </p>
                  {a.team?.id ? (
                    <a
                      href={`/dashboard/teams/${a.team.id}#trainerteam`}
                      className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-[var(--sce-primary)] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 transition"
                      data-testid="trainer-incomplete-team-link"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Trainer-Zuordnung vervollständigen
                    </a>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* State A: no relationship at all — profile exists but no team assignment */
          <div
            className="flex items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-4"
            data-testid="trainer-unassigned-nudge"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-[var(--foreground)]">
                Noch keinem Team als Trainer/in zugeordnet
              </p>
              <p className="mt-0.5 text-xs text-[var(--muted)]">
                Das Trainerprofil ist vorhanden, aber für die Saison {seasonLabel} besteht noch keine Trainer-Zuordnung.
                Trainer-Zuordnungen werden im Team-Management hinterlegt.
              </p>
              {onNavigateToTab ? (
                <button
                  type="button"
                  onClick={() => onNavigateToTab("organisation")}
                  className="mt-2 inline-flex items-center rounded-md px-2 py-1 text-xs font-semibold text-[var(--sce-primary)] hover:bg-[var(--sce-accent)] transition"
                >
                  Zur Organisation →
                </button>
              ) : null}
            </div>
          </div>
        )}
      </div>

      {/* ── Saison-Geschichte ──────────────────────────────────── */}
      <div>
        <SectionHeader label="Saison-Geschichte" />
        {snapshots.length > 0 ? (
          <div className="space-y-3">
            {snapshots.map((s) => (
              <SeasonAccordion key={s.seasonId} snapshot={s} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<Trophy className="h-8 w-8" />}
            heading="Noch keine Saison-Einträge"
            description="Sobald diese Person als Trainer/in zugeordnet wird, erscheinen hier die Saison-Einträge."
          />
        )}
      </div>
    </div>
  );
}
