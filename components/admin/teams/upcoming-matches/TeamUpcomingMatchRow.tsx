import type { TeamCockpitMatch } from "@/lib/teams/team-cockpit-sporting-data";
import type { TenantFormatConfig } from "@/lib/tenant-runtime/formatters";
import {
  formatFixtureDateLine,
  formatFixtureTime,
  resolveFixtureStatusLabel,
  resolveFixtureVenueLabel,
  resolveHomeAwayLabel,
} from "./team-upcoming-matches-formatters";

type Props = {
  match: TeamCockpitMatch;
  formatConfig: TenantFormatConfig;
};

function teamNameClassName(isOwnTeam: boolean): string {
  return isOwnTeam
    ? "truncate text-sm font-semibold text-[var(--foreground)]"
    : "truncate text-sm text-[var(--foreground)]";
}

export default function TeamUpcomingMatchRow({ match, formatConfig }: Props) {
  const statusLabel = resolveFixtureStatusLabel(match);
  const venueLabel = resolveFixtureVenueLabel(match);
  const homeAwayLabel = resolveHomeAwayLabel(match.side);
  const isPostponed =
    match.lifecycle === "POSTPONED" ||
    match.status.trim().toUpperCase() === "POSTPONED";
  const isLive =
    match.lifecycle === "LIVE" || match.status.trim().toUpperCase() === "LIVE";

  return (
    <article
      className="grid gap-4 px-4 py-4 sm:grid-cols-[minmax(0,8.5rem)_minmax(0,1fr)] lg:grid-cols-[minmax(0,9rem)_minmax(0,1fr)_minmax(0,11rem)] lg:items-start lg:gap-6"
      data-testid={`team-upcoming-match-${match.eventId}`}
      data-side={match.side}
      data-status={match.status}
      data-lifecycle={match.lifecycle}
    >
      <div className="min-w-0" data-testid={`team-upcoming-match-date-${match.eventId}`}>
        <p className="text-sm font-semibold text-[var(--foreground)]">
          {formatFixtureDateLine(match.startAt, formatConfig)}
        </p>
        <p className="mt-0.5 text-sm text-[var(--text-2)]">
          {formatFixtureTime(match.startAt, formatConfig)}
        </p>
      </div>

      <div className="min-w-0 space-y-1">
        <p className={teamNameClassName(match.home.isOwnTeam)} data-testid="team-upcoming-home">
          {match.home.displayName}
        </p>
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">vs</p>
        <p className={teamNameClassName(match.away.isOwnTeam)} data-testid="team-upcoming-away">
          {match.away.displayName}
        </p>
        <p
          className="pt-1 text-xs font-medium text-[var(--text-2)]"
          data-testid={`team-upcoming-homeaway-${match.eventId}`}
        >
          {homeAwayLabel}
        </p>
      </div>

      <div className="min-w-0 space-y-1 text-xs text-[var(--text-2)]">
        {statusLabel ? (
          <p
            className={
              isPostponed
                ? "font-medium text-[var(--sce-warning)]"
                : isLive
                  ? "font-medium text-[var(--sce-success)]"
                  : "font-medium text-[var(--foreground)]"
            }
            data-testid={`team-upcoming-status-${match.eventId}`}
          >
            {statusLabel}
          </p>
        ) : null}

        {venueLabel ? (
          <p data-testid={`team-upcoming-venue-${match.eventId}`}>{venueLabel}</p>
        ) : null}

        {match.competitionName ? (
          <p
            className="text-[var(--muted)]"
            data-testid={`team-upcoming-competition-${match.eventId}`}
          >
            {match.competitionName}
          </p>
        ) : null}
      </div>
    </article>
  );
}
