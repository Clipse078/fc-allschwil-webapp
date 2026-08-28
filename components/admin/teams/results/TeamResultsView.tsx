import type { TeamCockpitResult } from "@/lib/teams/team-cockpit-sporting-data";
import type { TenantFormatConfig } from "@/lib/tenant-runtime/formatters";
import TeamResultRow from "./TeamResultRow";

type Props = {
  results: TeamCockpitResult[];
  seasonName: string | null;
  formatConfig: TenantFormatConfig;
};

export default function TeamResultsView({
  results,
  seasonName,
  formatConfig,
}: Props) {
  return (
    <div className="space-y-5" data-testid="team-results-view">
      <header className="space-y-1">
        <h2 className="text-lg font-semibold text-[var(--foreground)]">Resultate</h2>
        {seasonName ? (
          <p className="text-sm text-[var(--muted)]">
            Abgeschlossene Spiele der aktuellen Saison ({seasonName}).
          </p>
        ) : null}
      </header>

      {results.length === 0 ? (
        <div
          className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-6"
          data-testid="team-results-empty"
        >
          <p className="text-sm text-[var(--muted)]">Keine Resultate vorhanden.</p>
          {seasonName ? (
            <p className="mt-1 text-sm text-[var(--muted)]">
              Für {seasonName} sind derzeit keine abgeschlossenen Spiele hinterlegt.
            </p>
          ) : null}
        </div>
      ) : (
        <ol
          className="divide-y divide-[var(--border)] overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]"
          data-testid="team-results-list"
        >
          {results.map((result) => (
            <li key={result.eventId}>
              <TeamResultRow result={result} formatConfig={formatConfig} />
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
