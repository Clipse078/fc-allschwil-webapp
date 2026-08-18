"use client";

/**
 * PERSON-UX-02 — Spieler tab (squad memberships by season).
 * PERSON-UX-07 — Integrates player development/assessment from PERSON-UX-05/06.
 *
 * Rendered iff person.isPlayer === true (PERSON-UX-07 flag-based visibility).
 *
 * Shows:
 * - Aktuelle Spieler-Zuordnungen — three states:
 *     A. No relationship: no PersonAssignment with player function, no squad membership
 *        → "Noch keinem Team als Spieler/in zugeordnet" — neutral card with action
 *     B. Incomplete: player-function PersonAssignment exists but no squad membership
 *        → Team + role as primary, "Zuordnung unvollständig" badge, precision CTA
 *        → deep-links to /dashboard/teams/:teamId#spielerkader
 *     C. Complete: active squad membership exists → normal card(s)
 * - Full historical player career by season (accordion, newest first)
 * - Player development / assessments (when viewer holds permission)
 *
 * Data source: PlayerSquadMember → TeamSeason → Season (persisted chain).
 * Assessment data from DevelopmentAssessment (PERSON-UX-05/06).
 *
 * Historical data is preserved even when isPlayer=false (the tab is hidden
 * but no data is deleted). Removing the capacity flag changes profile
 * classification only.
 *
 * Authorization: assessment section gated by canViewAssessments.
 * Removing isPlayer capacity does NOT affect assessment permissions.
 */

import { Users2, Trophy, Star, ChevronDown, ChevronRight, ExternalLink } from "lucide-react";
import { useState } from "react";
import type { PersonSquadMembership, PersonAssessmentRecord, TenantCriterion, PersonAssignment } from "@/lib/people/queries";
import { getPersonFunctionLabel, PERSON_FUNCTION_GROUPS } from "@/lib/people/functions";
import { EmptyState } from "@/components/ui/page";
import PersonAssessmentSection from "./PersonAssessmentSection";

const PLAYER_FUNCTION_KEYS = new Set<string>(PERSON_FUNCTION_GROUPS.SPIELER);

type PersonSpielerTabProps = {
  squadMemberships: PersonSquadMembership[];
  /**
   * PERSON-UX-07 UX-ACCEPTANCE: PersonAssignments used to detect the
   * "relationship exists but incomplete" state (State B).
   * When provided, distinguishes State A (no relationship) from State B
   * (player assignment exists but no squad membership for current season).
   */
  assignments?: PersonAssignment[];
  /**
   * PERSON-UX-07 UX-ACCEPTANCE: active season for user-facing wording.
   * When provided, used in incomplete state description ("für die Saison X").
   */
  activeSeason?: { id: string; name: string; key: string } | null;
  /** PERSON-UX-07: person id for assessment actions */
  personId?: string;
  /** PERSON-UX-05/07: viewer holds people.development.view */
  canViewDevelopment?: boolean;
  /** PERSON-UX-05/07: viewer holds people.assessments.view */
  canViewAssessments?: boolean;
  /** PERSON-UX-05/07: viewer holds people.assessments.manage */
  canManageAssessments?: boolean;
  /** PERSON-UX-05/07: pre-fetched assessments */
  assessments?: PersonAssessmentRecord[];
  /** PERSON-UX-05/07: active criteria */
  criteria?: TenantCriterion[];
  /**
   * PERSON-UX-07 UX-ACCEPTANCE: optional callback to navigate to a sibling tab.
   * Used for State A CTA (no assignment at all — go set one up via Organisation).
   */
  onNavigateToTab?: (tab: "organisation" | "trainer") => void;
};

type SeasonPlayerSnapshot = {
  seasonId: string;
  seasonName: string;
  isActive: boolean;
  startDate: Date;
  entries: PersonSquadMembership[];
};

function buildPlayerSeasonSnapshots(squads: PersonSquadMembership[]): SeasonPlayerSnapshot[] {
  const bySeasonId = new Map<string, SeasonPlayerSnapshot>();

  for (const sq of squads) {
    const s = sq.teamSeason.season;
    if (!bySeasonId.has(s.id)) {
      bySeasonId.set(s.id, {
        seasonId: s.id,
        seasonName: s.name,
        isActive: s.isActive,
        startDate: s.startDate,
        entries: [],
      });
    }
    bySeasonId.get(s.id)!.entries.push(sq);
  }

  return Array.from(bySeasonId.values()).sort(
    (a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime(),
  );
}

function PlayerStatusBadge({ status }: { status: string }) {
  if (status === "ACTIVE") return null;
  const label =
    status === "INJURED" ? "Verletzt" : status === "ABSENT" ? "Abwesend" : status;
  return (
    <span className="rounded-full bg-[var(--surface-3)] px-2 py-0.5 text-[10px] font-medium text-[var(--muted)]">
      {label}
    </span>
  );
}

function PlayerEntry({ sq }: { sq: PersonSquadMembership }) {
  return (
    <div className="flex items-start gap-3 px-4 py-3">
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
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
              <Star className="h-3 w-3" />
              Captain
            </span>
          ) : null}
          {sq.isViceCaptain ? (
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-600">
              Vizekapitän
            </span>
          ) : null}
          <PlayerStatusBadge status={sq.status} />
        </div>
        {sq.positionLabel != null || sq.shirtNumber != null ? (
          <p className="mt-0.5 text-xs text-[var(--muted)]">
            {[sq.positionLabel, sq.shirtNumber != null ? `#${sq.shirtNumber}` : null]
              .filter(Boolean)
              .join(" · ")}
          </p>
        ) : null}
        {sq.remarks ? (
          <p className="mt-0.5 text-xs italic text-[var(--muted)]">{sq.remarks}</p>
        ) : null}
      </div>
    </div>
  );
}

function SeasonAccordion({ snapshot }: { snapshot: SeasonPlayerSnapshot }) {
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
          {snapshot.entries.map((sq) => (
            <PlayerEntry key={sq.id} sq={sq} />
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

export default function PersonSpielerTab({
  squadMemberships,
  assignments = [],
  activeSeason,
  personId,
  canViewDevelopment = false,
  canViewAssessments = false,
  canManageAssessments = false,
  assessments = [],
  criteria = [],
  onNavigateToTab,
}: PersonSpielerTabProps) {
  const activeSquads = squadMemberships.filter(
    (m) => m.status === "ACTIVE" || m.status === "INJURED" || m.status === "ABSENT",
  );

  // State B: active PersonAssignment with player function but no matching squad membership
  const playerCompleteTeamIds = new Set(activeSquads.map((sq) => sq.teamSeason.team.id));
  const incompletePlayerAssignments = assignments.filter(
    (a) =>
      a.status === "ACTIVE" &&
      a.functionKey !== null &&
      a.functionKey !== undefined &&
      PLAYER_FUNCTION_KEYS.has(a.functionKey) &&
      a.team != null &&
      !playerCompleteTeamIds.has(a.team.id),
  );

  const snapshots = buildPlayerSeasonSnapshots(squadMemberships);

  const seasonLabel = activeSeason?.name ?? "die aktuelle Saison";

  return (
    <div className="space-y-8">
      {/* ── Aktuelle Spieler-Zuordnungen ─────────────────────────── */}
      <div>
        <SectionHeader label="Aktuelle Spieler-Zuordnungen" />
        {activeSquads.length > 0 ? (
          /* State C: complete squad memberships */
          <div className="space-y-2">
            <div className="divide-y divide-[var(--border)] overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
              {activeSquads.map((sq) => (
                <PlayerEntry key={sq.id} sq={sq} />
              ))}
            </div>
            {/* State B alongside C: additional incomplete player assignments */}
            {incompletePlayerAssignments.map((a) => (
              <div
                key={a.id}
                className="flex items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3"
                data-testid="spieler-incomplete-assignment"
              >
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--sce-accent)] text-[var(--sce-primary)]">
                  <Users2 className="h-4 w-4" />
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
                    Das Spielerprofil ist vorhanden, aber für die Saison {a.season?.name ?? seasonLabel} besteht noch keine Kaderzuordnung.
                  </p>
                  {a.team?.id ? (
                    <a
                      href={`/dashboard/teams/${a.team.id}#spielerkader`}
                      className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-[var(--sce-primary)] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 transition"
                      data-testid="spieler-incomplete-team-link"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Jetzt Kaderzuordnung ergänzen
                    </a>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        ) : incompletePlayerAssignments.length > 0 ? (
          /* State B only: relationship exists but no squad membership */
          <div className="space-y-2">
            {incompletePlayerAssignments.map((a) => (
              <div
                key={a.id}
                className="flex items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3"
                data-testid="spieler-incomplete-assignment"
              >
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--sce-accent)] text-[var(--sce-primary)]">
                  <Users2 className="h-4 w-4" />
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
                    Das Spielerprofil ist vorhanden, aber für die Saison {a.season?.name ?? seasonLabel} besteht noch keine Kaderzuordnung.
                  </p>
                  {a.team?.id ? (
                    <a
                      href={`/dashboard/teams/${a.team.id}#spielerkader`}
                      className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-[var(--sce-primary)] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 transition"
                      data-testid="spieler-incomplete-team-link"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Jetzt Kaderzuordnung ergänzen
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
            data-testid="spieler-unassigned-nudge"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-[var(--foreground)]">
                Noch keinem Team als Spieler/in zugeordnet
              </p>
              <p className="mt-0.5 text-xs text-[var(--muted)]">
                Das Spielerprofil ist vorhanden, aber für die Saison {seasonLabel} besteht noch keine Kaderzuordnung.
                Kader-Zuordnungen werden im Team-Management hinterlegt.
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
            description="Sobald diese Person einem Kader zugeordnet wird, erscheinen hier die Saison-Einträge."
          />
        )}
      </div>

      {/* ── Entwicklung & Assessments (PERSON-UX-05/06/07) ────── */}
      {(canViewDevelopment || canViewAssessments) && personId ? (
        <div>
          <SectionHeader label="Entwicklung & Assessments" />
          <PersonAssessmentSection
            personId={personId}
            canManage={canManageAssessments}
            assessments={assessments}
            criteria={criteria}
          />
        </div>
      ) : null}
    </div>
  );
}
