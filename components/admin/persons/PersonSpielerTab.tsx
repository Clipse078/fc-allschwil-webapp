"use client";

/**
 * PERSON-UX-02 — Spieler tab.
 *
 * Rendered iff the Person has current OR historical player evidence
 * (PlayerSquadMember records exist, any status, any season).
 *
 * Shows:
 * - Current active squad memberships (Aktuell section)
 * - Full historical player career by season (accordion, newest first)
 *
 * Data source: PlayerSquadMember → TeamSeason → Season (fully persisted,
 * historically stable chain). No fabrication from isPlayer flag.
 *
 * No assessment/rating content — deferred to PERSON-UX-03.
 */

import { Users2, Trophy, Star, ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import type { PersonSquadMembership } from "@/lib/people/queries";
import { EmptyState } from "@/components/ui/page";

type PersonSpielerTabProps = {
  squadMemberships: PersonSquadMembership[];
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

export default function PersonSpielerTab({ squadMemberships }: PersonSpielerTabProps) {
  const activeSquads = squadMemberships.filter(
    (m) => m.status === "ACTIVE" || m.status === "INJURED" || m.status === "ABSENT",
  );

  const snapshots = buildPlayerSeasonSnapshots(squadMemberships);

  return (
    <div className="space-y-8">
      {/* ── Aktuell ──────────────────────────────────────────────── */}
      <div>
        <SectionHeader label="Aktuell" />
        {activeSquads.length > 0 ? (
          <div className="divide-y divide-[var(--border)] overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
            {activeSquads.map((sq) => (
              <PlayerEntry key={sq.id} sq={sq} />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
            <p className="text-sm text-[var(--muted)]">
              Kein aktiver Spielereinsatz in der laufenden Saison.
            </p>
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
    </div>
  );
}
