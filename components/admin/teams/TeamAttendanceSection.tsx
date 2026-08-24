"use client";

import { useCallback, useState } from "react";
import { ClipboardCheck, UserRound } from "lucide-react";
import { SectionCard } from "@/components/ui/page";
import type { TeamAttendanceOverview } from "@/lib/attendance/types";
import TeamAttendancePlayerDrawer from "./TeamAttendancePlayerDrawer";
import TeamAttendanceEventSheet from "./TeamAttendanceEventSheet";

type Props = {
  teamId: string;
  teamSeasonId: string;
  initialOverview: TeamAttendanceOverview;
  canManage: boolean;
};

export default function TeamAttendanceSection({
  teamId,
  teamSeasonId,
  initialOverview,
  canManage,
}: Props) {
  const [overview, setOverview] = useState(initialOverview);
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [eventSheetOpen, setEventSheetOpen] = useState(false);

  const refreshOverview = useCallback(async () => {
    const response = await fetch(
      `/api/teams/${teamId}/team-seasons/${teamSeasonId}/attendance`,
      { cache: "no-store" },
    );
    if (!response.ok) {
      return;
    }
    const data = (await response.json()) as TeamAttendanceOverview;
    setOverview(data);
  }, [teamId, teamSeasonId]);

  const selectedPlayer = overview.players.find((player) => player.personId === selectedPersonId) ?? null;

  return (
    <>
      <SectionCard
        title="Anwesenheit"
        description="Übersicht der Spieler-Anwesenheit über relevante Events."
        headerActions={
          canManage ? (
            <button
              type="button"
              onClick={() => setEventSheetOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-medium text-[var(--foreground)] transition hover:bg-[var(--surface-2)]"
              data-testid="team-attendance-record-button"
            >
              <ClipboardCheck className="h-3.5 w-3.5" />
              Anwesenheit erfassen
            </button>
          ) : null
        }
        noPadding
      >
        <div data-testid="team-attendance-section">
        {overview.players.length === 0 ? (
          <div className="px-4 py-6 text-sm text-[var(--muted)]">
            Kein Spielerkader für die aktuelle Saison vorhanden.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm" data-testid="team-attendance-table">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--surface-2)]/60 text-left text-[11px] uppercase tracking-[0.04em] text-[var(--muted)]">
                  <th className="px-4 py-2.5 font-medium">Spieler</th>
                  <th className="px-3 py-2.5 font-medium text-right">Events</th>
                  <th className="px-3 py-2.5 font-medium text-right">Anw.</th>
                  <th className="px-3 py-2.5 font-medium text-right">Entsch.</th>
                  <th className="px-3 py-2.5 font-medium text-right">Abw.</th>
                  <th className="px-3 py-2.5 font-medium text-right">Verl.</th>
                  <th className="px-4 py-2.5 font-medium text-right">Quote</th>
                </tr>
              </thead>
              <tbody>
                {overview.players.map((player) => (
                  <tr
                    key={player.personId}
                    className="border-b border-[var(--border)]/70 transition hover:bg-[var(--surface-2)]/40"
                  >
                    <td className="px-4 py-2.5">
                      <button
                        type="button"
                        onClick={() => setSelectedPersonId(player.personId)}
                        className="inline-flex min-w-0 items-center gap-2 text-left text-[var(--foreground)] hover:text-[var(--sce-primary)]"
                        data-testid={`team-attendance-player-${player.personId}`}
                      >
                        <UserRound className="h-3.5 w-3.5 shrink-0 text-[var(--muted)]" />
                        <span className="truncate font-medium">
                          {player.shirtNumber != null ? `#${player.shirtNumber} ` : ""}
                          {player.displayName}
                        </span>
                      </button>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{player.eventCount}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{player.counts.present}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{player.counts.excused}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{player.counts.absent}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{player.counts.injured}</td>
                    <td className="px-4 py-2.5 text-right font-semibold tabular-nums">
                      {player.percentageLabel}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        </div>
      </SectionCard>

      <TeamAttendancePlayerDrawer
        open={selectedPersonId !== null}
        onClose={() => setSelectedPersonId(null)}
        teamId={teamId}
        teamSeasonId={teamSeasonId}
        player={selectedPlayer}
      />

      <TeamAttendanceEventSheet
        open={eventSheetOpen}
        onClose={() => setEventSheetOpen(false)}
        teamId={teamId}
        teamSeasonId={teamSeasonId}
        onSaved={refreshOverview}
      />
    </>
  );
}
