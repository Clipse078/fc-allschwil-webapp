import type { TeamCockpitMatch } from "@/lib/teams/team-cockpit-sporting-data";
import type { TenantFormatConfig } from "@/lib/tenant-runtime/formatters";
import TeamUpcomingMatchRow from "./TeamUpcomingMatchRow";

type Props = {
  matches: TeamCockpitMatch[];
  seasonName: string | null;
  formatConfig: TenantFormatConfig;
};

export default function TeamUpcomingMatchesView({
  matches,
  seasonName,
  formatConfig,
}: Props) {
  return (
    <div className="space-y-5" data-testid="team-upcoming-matches-view">
      <header className="space-y-1">
        <h2 className="text-lg font-semibold text-[var(--foreground)]">Nächste Spiele</h2>
        {seasonName ? (
          <p className="text-sm text-[var(--muted)]">
            Geplante Spiele der aktuellen Saison ({seasonName}).
          </p>
        ) : null}
      </header>

      {matches.length === 0 ? (
        <div
          className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-6"
          data-testid="team-upcoming-matches-empty"
        >
          <p className="text-sm text-[var(--muted)]">Keine nächsten Spiele geplant.</p>
          {seasonName ? (
            <p className="mt-1 text-sm text-[var(--muted)]">
              Für {seasonName} sind derzeit keine kommenden Spiele hinterlegt.
            </p>
          ) : null}
        </div>
      ) : (
        <ol
          className="divide-y divide-[var(--border)] overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]"
          data-testid="team-upcoming-matches-list"
        >
          {matches.map((match) => (
            <li key={match.eventId}>
              <TeamUpcomingMatchRow match={match} formatConfig={formatConfig} />
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
