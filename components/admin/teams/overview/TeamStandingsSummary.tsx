import Link from "next/link";
import type { TeamCockpitStandings } from "@/lib/teams/team-cockpit-sporting-data";
import { formatTeamCompetitionDisplayLabel } from "@/lib/teams/team-competition-display";

type Props = {
  teamId: string;
  standings: TeamCockpitStandings | null;
};

export default function TeamStandingsSummary({ teamId, standings }: Props) {
  const href = `/dashboard/teams/${teamId}/rangliste`;
  const currentRow = standings?.rows.find((row) => row.isCurrentTeam) ?? null;
  const teamCount = standings?.rows.length ?? 0;
  const competitionLabel = standings
    ? formatTeamCompetitionDisplayLabel(standings.competition)
    : null;

  return (
    <Link
      href={href}
      className="group flex min-w-0 flex-col gap-3 p-4 transition-colors hover:bg-[var(--surface-2)]/60"
      aria-label="Rangliste — Details in Rangliste"
      data-testid="team-standings-summary"
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--muted)]">
          Rangliste
        </h3>
        <span className="text-xs font-medium text-[var(--blue)] group-hover:underline">
          Tabelle
        </span>
      </div>

      {currentRow ? (
        <>
          <p className="text-2xl font-semibold tracking-tight text-[var(--foreground)]">
            {currentRow.position}.
            {teamCount > 0 ? (
              <span className="ml-2 text-sm font-medium text-[var(--text-2)]">
                von {teamCount} Teams
              </span>
            ) : null}
          </p>

          <div className="space-y-1 text-sm text-[var(--text-2)]">
            {competitionLabel ? <p className="truncate">{competitionLabel}</p> : null}
            <p className="font-medium text-[var(--foreground)]">
              {currentRow.points} Punkte
            </p>
          </div>
        </>
      ) : (
        <p className="text-sm text-[var(--muted)]" data-testid="team-standings-empty">
          Rangliste derzeit nicht verfügbar.
        </p>
      )}
    </Link>
  );
}
