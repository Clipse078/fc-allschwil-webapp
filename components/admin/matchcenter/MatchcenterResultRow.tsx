import Link from "next/link";
import { CalendarDays, MapPin } from "lucide-react";
import type { MatchcenterMatchSummary } from "@/lib/matchcenter/types";
import { getMatchcenterResultLabel } from "@/lib/matchcenter/match-lifecycle";
import { resolveMatchcenterCompactSideName } from "@/lib/matchcenter/team-display";
import { Badge } from "@/components/ui/Badge";
import MatchTeamLogo from "./MatchTeamLogo";

function formatMatchDate(value: Date, locale: string, timezone: string): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    timeZone: timezone,
  }).format(value);
}

type MatchcenterResultRowProps = {
  match: MatchcenterMatchSummary;
  locale: string;
  timezone: string;
};

/**
 * A single Resultate row.
 *
 * Uses an explicit 3-column grid (home team / score / away team) so the
 * score stays geometrically centered regardless of team-name length —
 * MATCHCENTER-UX-01 §11/§19 ("stable central score column").
 */
export default function MatchcenterResultRow({
  match,
  locale,
  timezone,
}: MatchcenterResultRowProps) {
  const result = getMatchcenterResultLabel(match);
  const normalizedHomeAway = match.homeAway?.trim().toUpperCase() ?? null;
  const homeAwayLabel =
    normalizedHomeAway === "HOME"
      ? "Heimspiel"
      : normalizedHomeAway === "AWAY"
        ? "Auswärtsspiel"
        : null;

  const homeName = resolveMatchcenterCompactSideName(match.home);
  const awayName = resolveMatchcenterCompactSideName(match.away);

  return (
    <article
      key={match.id}
      data-testid={`matchcenter-result-row-${match.id}`}
      className="relative px-5 py-4 transition hover:bg-[var(--surface-2)]"
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3">
        <div className="flex min-w-0 items-center justify-end gap-2">
          <p
            className={
              match.home.isOwnTeam
                ? "min-w-0 truncate text-right text-sm font-semibold text-[var(--foreground)]"
                : "min-w-0 truncate text-right text-sm text-[var(--foreground)]"
            }
          >
            {homeName}
          </p>
          <MatchTeamLogo
            label={homeName}
            emphasized={match.home.isOwnTeam}
            logoUrl={match.home.externalLogoUrl}
          />
        </div>

        <div
          className="shrink-0 rounded-lg bg-[var(--foreground)] px-3 py-1 text-center text-sm font-bold tabular-nums text-white"
          data-testid={`matchcenter-result-${match.id}`}
        >
          {result ?? "–"}
        </div>

        <div className="flex min-w-0 items-center gap-2">
          <MatchTeamLogo
            label={awayName}
            emphasized={match.away.isOwnTeam}
            logoUrl={match.away.externalLogoUrl}
          />
          <p
            className={
              match.away.isOwnTeam
                ? "min-w-0 truncate text-sm font-semibold text-[var(--foreground)]"
                : "min-w-0 truncate text-sm text-[var(--foreground)]"
            }
          >
            {awayName}
          </p>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-[var(--muted)]">
        <span className="inline-flex items-center gap-1.5">
          <CalendarDays className="h-3.5 w-3.5" />
          {formatMatchDate(match.startAt, locale, timezone)}
        </span>

        {match.competitionLabel ? <span>{match.competitionLabel}</span> : null}

        {match.location ? (
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5" />
            {match.location}
          </span>
        ) : null}

        {homeAwayLabel ? (
          <Badge variant="outline" size="sm">
            {homeAwayLabel}
          </Badge>
        ) : null}
      </div>

      <Link
        href={`/dashboard/matchcenter/${match.id}`}
        aria-label={`Details zu ${match.title} anzeigen`}
        className="absolute inset-0 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sce-primary)] focus-visible:ring-offset-2"
      >
        <span className="sr-only">Details zu {match.title} anzeigen</span>
      </Link>
    </article>
  );
}
