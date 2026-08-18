"use client";

/**
 * PERSON-UX-02 — Trainer tab.
 *
 * Rendered iff the Person has current OR historical trainer evidence
 * (TrainerTeamMember records exist, any status, any season).
 *
 * Shows:
 * - Current active trainer roles (Aktuell section)
 * - Full historical trainer career by season (accordion, newest first)
 *
 * Data source: TrainerTeamMember → TeamSeason → Season (fully persisted,
 * historically stable chain). No fabrication from isTrainer flag.
 *
 * Canonical staff/function context from PersonAssignment is surfaced
 * where available (visible in the Organisation tab for full detail).
 */

import { UserCheck, Trophy, ChevronDown, ChevronRight, AlertCircle } from "lucide-react";
import { useState } from "react";
import type { PersonTrainerMembership } from "@/lib/people/queries";
import { EmptyState } from "@/components/ui/page";

type PersonTrainerTabProps = {
  trainerMemberships: PersonTrainerMembership[];
  /**
   * PERSON-UX-07 UX-ACCEPTANCE: optional callback to navigate to a sibling tab.
   * Used for deep-link CTAs in empty/nudge states.
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

export default function PersonTrainerTab({ trainerMemberships, onNavigateToTab }: PersonTrainerTabProps) {
  const activeTrainers = trainerMemberships.filter((m) => m.status === "ACTIVE");
  const snapshots = buildTrainerSeasonSnapshots(trainerMemberships);

  return (
    <div className="space-y-8">
      {/* ── Aktuell ──────────────────────────────────────────────── */}
      <div>
        <SectionHeader label="Aktuell" />
        {activeTrainers.length > 0 ? (
          <div className="divide-y divide-[var(--border)] overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
            {activeTrainers.map((tr) => (
              <TrainerEntry key={tr.id} tr={tr} />
            ))}
          </div>
        ) : (
          /* PERSON-UX-07 UX-ACCEPTANCE: Actionable nudge instead of passive message.
           * The Trainerprofil exists (otherwise this tab would be hidden) but no
           * current-season team assignment is present. Admin needs guidance. */
          <div
            className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-4"
            data-testid="trainer-unassigned-nudge"
          >
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
              <AlertCircle className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-amber-800">
                Noch keinem Team als Trainer/in zugeordnet
              </p>
              <p className="mt-0.5 text-xs text-amber-700">
                Das Trainerprofil ist vorhanden, aber für die aktuelle Saison besteht keine Teamzuordnung.
                Trainer-Zuordnungen werden über das Team-Management verwaltet.
              </p>
              {onNavigateToTab ? (
                <button
                  type="button"
                  onClick={() => onNavigateToTab("organisation")}
                  className="mt-2 inline-flex items-center rounded-md border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-50 transition"
                >
                  Zur Organisation
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
