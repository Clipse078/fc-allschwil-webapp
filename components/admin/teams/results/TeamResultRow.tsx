import type { TeamCockpitResult } from "@/lib/teams/team-cockpit-sporting-data";
import type { TenantFormatConfig } from "@/lib/tenant-runtime/formatters";
import {
  formatFixtureDateLine,
  formatFixtureTime,
  formatResultScore,
  resolveResultHomeAwayLabel,
  resolveResultPerspectiveLabel,
  resolveResultVenueLabel,
} from "./team-results-formatters";

type Props = {
  result: TeamCockpitResult;
  formatConfig: TenantFormatConfig;
};

function teamNameClassName(isOwnTeam: boolean): string {
  return isOwnTeam
    ? "truncate text-sm font-semibold text-[var(--foreground)]"
    : "truncate text-sm text-[var(--foreground)]";
}

export default function TeamResultRow({ result, formatConfig }: Props) {
  const perspectiveLabel = resolveResultPerspectiveLabel(result.resultPerspective);
  const venueLabel = resolveResultVenueLabel(result);
  const homeAwayLabel = resolveResultHomeAwayLabel(result.side);

  return (
    <article
      className="grid gap-4 px-4 py-4 sm:grid-cols-[minmax(0,8.5rem)_minmax(0,1fr)] lg:grid-cols-[minmax(0,9rem)_minmax(0,1fr)_minmax(0,11rem)] lg:items-start lg:gap-6"
      data-testid={`team-result-${result.eventId}`}
      data-side={result.side}
      data-perspective={result.resultPerspective}
    >
      <div className="min-w-0" data-testid={`team-result-date-${result.eventId}`}>
        <p className="text-sm font-semibold text-[var(--foreground)]">
          {formatFixtureDateLine(result.startAt, formatConfig)}
        </p>
        <p className="mt-0.5 text-sm text-[var(--text-2)]">
          {formatFixtureTime(result.startAt, formatConfig)}
        </p>
      </div>

      <div className="min-w-0 space-y-1">
        <p className={teamNameClassName(result.home.isOwnTeam)} data-testid="team-result-home">
          {result.home.displayName}
        </p>

        <p
          className="text-xl font-semibold tracking-tight text-[var(--foreground)]"
          data-testid={`team-result-score-${result.eventId}`}
          aria-label={`Ergebnis ${formatResultScore(result)}`}
        >
          {formatResultScore(result)}
        </p>

        <p className={teamNameClassName(result.away.isOwnTeam)} data-testid="team-result-away">
          {result.away.displayName}
        </p>

        <p
          className="pt-1 text-xs font-medium text-[var(--text-2)]"
          data-testid={`team-result-homeaway-${result.eventId}`}
        >
          {homeAwayLabel}
        </p>
      </div>

      <div className="min-w-0 space-y-1 text-xs text-[var(--text-2)]">
        {perspectiveLabel ? (
          <p
            className="font-medium text-[var(--foreground)]"
            data-testid={`team-result-perspective-${result.eventId}`}
          >
            {perspectiveLabel}
          </p>
        ) : null}

        {venueLabel ? (
          <p data-testid={`team-result-venue-${result.eventId}`}>{venueLabel}</p>
        ) : null}

        {result.competitionName ? (
          <p
            className="text-[var(--muted)]"
            data-testid={`team-result-competition-${result.eventId}`}
          >
            {result.competitionName}
          </p>
        ) : null}
      </div>
    </article>
  );
}
