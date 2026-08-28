import type { TeamCockpitStandingsRow } from "@/lib/teams/team-cockpit-sporting-data";
import SportingTeamLogo from "@/components/shared/SportingTeamLogo";
import {
  formatStandingsGoalDifference,
  formatStandingsGoals,
  formatStandingsPenaltyPoints,
  formatStandingsRecord,
} from "./team-standings-formatters";

type Props = {
  row: TeamCockpitStandingsRow;
};

function resolveTeamDisplayName(row: TeamCockpitStandingsRow): string {
  return row.shortName?.trim() || row.teamName;
}

export default function TeamStandingsRow({ row }: Props) {
  const teamName = resolveTeamDisplayName(row);
  const penaltyNote = formatStandingsPenaltyPoints(row.penaltyPoints);
  const rowClassName = row.isCurrentTeam
    ? "bg-[var(--surface-2)]/70"
    : undefined;

  return (
    <tr
      className={rowClassName}
      data-testid={`team-standings-row-${row.position}`}
      data-current-team={row.isCurrentTeam ? "true" : "false"}
      aria-current={row.isCurrentTeam ? "true" : undefined}
    >
      <td className="w-10 px-3 py-3 text-sm tabular-nums text-[var(--text-2)]">
        <span className={row.isCurrentTeam ? "font-semibold text-[var(--foreground)]" : undefined}>
          {row.position}
        </span>
      </td>

      <td className="min-w-0 px-3 py-3">
        <div className="flex min-w-0 items-start gap-2">
          <SportingTeamLogo logoUrl={row.logoUrl} size="sm" />
          <div className="min-w-0 space-y-1">
            <div className="flex min-w-0 items-center gap-2">
              <p
                className={
                  row.isCurrentTeam
                    ? "truncate text-sm font-semibold text-[var(--foreground)]"
                    : "truncate text-sm text-[var(--foreground)]"
                }
                data-testid={`team-standings-team-${row.position}`}
              >
                {teamName}
              </p>
              {row.isCurrentTeam ? (
                <span
                  className="shrink-0 rounded-full bg-[var(--surface-3)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.04em] text-[var(--text-2)]"
                  data-testid={`team-standings-current-label-${row.position}`}
                >
                  Unser Team
                </span>
              ) : null}
            </div>
            <p
              className="text-xs text-[var(--muted)] md:hidden"
              data-testid={`team-standings-mobile-meta-${row.position}`}
            >
              {formatStandingsRecord(row)} ·{" "}
              {formatStandingsGoals(row.goalsFor, row.goalsAgainst)} ·{" "}
              {formatStandingsGoalDifference(row.goalDifference)}
            </p>
          </div>
        </div>
      </td>

      <td className="px-3 py-3 text-right text-sm tabular-nums text-[var(--text-2)]">
        {row.played}
      </td>
      <td className="hidden px-3 py-3 text-right text-sm tabular-nums text-[var(--text-2)] lg:table-cell">
        {row.won}
      </td>
      <td className="hidden px-3 py-3 text-right text-sm tabular-nums text-[var(--text-2)] lg:table-cell">
        {row.drawn}
      </td>
      <td className="hidden px-3 py-3 text-right text-sm tabular-nums text-[var(--text-2)] lg:table-cell">
        {row.lost}
      </td>
      <td className="px-3 py-3 text-right text-sm tabular-nums text-[var(--text-2)]">
        {formatStandingsGoals(row.goalsFor, row.goalsAgainst)}
      </td>
      <td className="hidden px-3 py-3 text-right text-sm tabular-nums text-[var(--text-2)] lg:table-cell">
        {formatStandingsGoalDifference(row.goalDifference)}
      </td>
      <td className="px-3 py-3 text-right text-sm tabular-nums">
        <div className="space-y-0.5">
          <p
            className={
              row.isCurrentTeam
                ? "font-semibold text-[var(--foreground)]"
                : "font-medium text-[var(--foreground)]"
            }
            data-testid={`team-standings-points-${row.position}`}
          >
            {row.points}
          </p>
          {penaltyNote ? (
            <p
              className="text-[10px] text-[var(--muted)]"
              title={penaltyNote}
              data-testid={`team-standings-penalty-${row.position}`}
            >
              {penaltyNote}
            </p>
          ) : null}
        </div>
      </td>
    </tr>
  );
}
