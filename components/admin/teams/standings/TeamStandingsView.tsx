import type { TeamCockpitStandings } from "@/lib/teams/team-cockpit-sporting-data";
import { formatTeamCompetitionContextLine } from "@/lib/teams/team-competition-display";
import TeamStandingsRow from "./TeamStandingsRow";

type Props = {
  standings: TeamCockpitStandings | null;
  hasProviderMapping: boolean;
};

export default function TeamStandingsView({ standings, hasProviderMapping }: Props) {
  const competitionContext = standings
    ? formatTeamCompetitionContextLine(standings.competition)
    : null;

  return (
    <div className="space-y-5" data-testid="team-standings-view">
      <header className="space-y-1">
        <h2 className="text-lg font-semibold text-[var(--foreground)]">Rangliste</h2>
        {competitionContext ? (
          <p
            className="text-sm text-[var(--muted)]"
            data-testid="team-standings-competition-context"
          >
            {competitionContext}
          </p>
        ) : null}
      </header>

      {!hasProviderMapping ? (
        <div
          className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-6"
          data-testid="team-standings-no-mapping"
        >
          <p className="text-sm text-[var(--muted)]">
            Für dieses Team ist keine Rangliste verfügbar.
          </p>
        </div>
      ) : standings == null || standings.rows.length === 0 ? (
        <div
          className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-6"
          data-testid="team-standings-unavailable"
        >
          <p className="text-sm text-[var(--muted)]">Rangliste derzeit nicht verfügbar.</p>
        </div>
      ) : (
        <div
          className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]"
          data-testid="team-standings-table-wrapper"
        >
          <div className="overflow-x-auto">
            <table
              className="min-w-full border-collapse text-left"
              data-testid="team-standings-table"
            >
              <thead className="border-b border-[var(--border)] bg-[var(--surface-2)]/40">
                <tr>
                  <th
                    scope="col"
                    className="w-10 px-3 py-2.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--muted)]"
                    title="Position"
                  >
                    Pos.
                  </th>
                  <th
                    scope="col"
                    className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--muted)]"
                  >
                    Team
                  </th>
                  <th
                    scope="col"
                    className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--muted)]"
                    title="Spiele"
                  >
                    Sp.
                  </th>
                  <th
                    scope="col"
                    className="hidden px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--muted)] lg:table-cell"
                    title="Siege"
                  >
                    S
                  </th>
                  <th
                    scope="col"
                    className="hidden px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--muted)] lg:table-cell"
                    title="Unentschieden"
                  >
                    U
                  </th>
                  <th
                    scope="col"
                    className="hidden px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--muted)] lg:table-cell"
                    title="Niederlagen"
                  >
                    N
                  </th>
                  <th
                    scope="col"
                    className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--muted)]"
                    title="Tore"
                  >
                    Tore
                  </th>
                  <th
                    scope="col"
                    className="hidden px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--muted)] lg:table-cell"
                    title="Tordifferenz"
                  >
                    +/-
                  </th>
                  <th
                    scope="col"
                    className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--muted)]"
                    title="Punkte"
                  >
                    <span className="sr-only">Punkte</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {standings.rows.map((row) => (
                  <TeamStandingsRow key={`${row.position}-${row.teamName}`} row={row} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
