"use client";

import { useEffect, useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import type { PlayerAttendanceHistoryEntry, PlayerAttendanceSummary } from "@/lib/attendance/types";

type Props = {
  open: boolean;
  onClose: () => void;
  teamId: string;
  teamSeasonId: string;
  player: PlayerAttendanceSummary | null;
};

export default function TeamAttendancePlayerDrawer({
  open,
  onClose,
  teamId,
  teamSeasonId,
  player,
}: Props) {
  const [history, setHistory] = useState<PlayerAttendanceHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !player) {
      return;
    }

    let cancelled = false;
    setLoading(true);

    fetch(
      `/api/teams/${teamId}/team-seasons/${teamSeasonId}/attendance/players/${player.personId}`,
      { cache: "no-store" },
    )
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("history fetch failed");
        }
        const data = (await response.json()) as { history: PlayerAttendanceHistoryEntry[] };
        if (!cancelled) {
          setHistory(data.history);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setHistory([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open, player, teamId, teamSeasonId]);

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={player ? `Anwesenheit — ${player.displayName}` : "Anwesenheit"}
      description="Verlauf der erfassten Anwesenheit für diesen Spieler."
    >
      <div data-testid="team-attendance-player-drawer" className="space-y-4">
        {player ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Stat label="Events" value={String(player.eventCount)} />
            <Stat label="Anwesend" value={String(player.counts.present)} />
            <Stat label="Quote" value={player.percentageLabel} prominent />
          </div>
        ) : null}

        {loading ? (
          <p className="text-sm text-[var(--muted)]">Lade Verlauf…</p>
        ) : history.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">Noch keine Anwesenheit erfasst.</p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-[var(--border)]">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--surface-2)]/60 text-left text-[11px] uppercase tracking-[0.04em] text-[var(--muted)]">
                  <th className="px-3 py-2 font-medium">Datum</th>
                  <th className="px-3 py-2 font-medium">Typ</th>
                  <th className="px-3 py-2 font-medium">Event</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {history.map((entry) => (
                  <tr key={entry.id} className="border-b border-[var(--border)]/70">
                    <td className="px-3 py-2 tabular-nums">{entry.date}</td>
                    <td className="px-3 py-2">{entry.eventKindLabel}</td>
                    <td className="px-3 py-2">
                      <div className="font-medium">{entry.eventTitle}</div>
                      {entry.note ? (
                        <div className="mt-0.5 text-xs text-[var(--muted)]">{entry.note}</div>
                      ) : null}
                    </td>
                    <td className="px-3 py-2">
                      <span data-testid={`attendance-status-${entry.status}`}>{entry.statusLabel}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Sheet>
  );
}

function Stat({
  label,
  value,
  prominent = false,
}: {
  label: string;
  value: string;
  prominent?: boolean;
}) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5">
      <p className="text-[11px] font-medium uppercase tracking-[0.04em] text-[var(--muted)]">{label}</p>
      <p className={`mt-0.5 ${prominent ? "text-base font-semibold" : "text-sm font-medium"}`}>{value}</p>
    </div>
  );
}
