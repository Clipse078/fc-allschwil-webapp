import Link from "next/link";
import { MapPin } from "lucide-react";
import type { MatchcenterMatchSummary } from "@/lib/matchcenter/types";
import { getMatchcenterResultLabel } from "@/lib/matchcenter/match-lifecycle";
import { resolveMatchcenterCompactSideName } from "@/lib/matchcenter/team-display";
import { ClubLogo } from "@/components/admin/club-directory/ClubLogo";
import { resolveClubIdentityLogoUrl } from "@/lib/matchcenter/club-identity";

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
  /**
   * Canonical tenant/club logo URL (Tenant.logoUrl).
   * Used for internal (isOwnTeam) sides — MATCHCENTER-UX-03-C1.
   */
  tenantLogoUrl?: string | null;
};

/**
 * A single Resultate row.
 *
 * Uses an explicit 3-column grid (home team / score / away team) so the
 * score stays geometrically centered regardless of team-name length —
 * MATCHCENTER-UX-01 §11/§19 ("stable central score column").
 *
 * MATCHCENTER-UX-03: uses ClubLogo with bare=true for dominant logo display.
 */
export default function MatchcenterResultRow({
  match,
  locale,
  timezone,
  tenantLogoUrl = null,
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

  // Canonical logo resolution — same rule as MatchCard and MatchInspector
  const homeLogoUrl = resolveClubIdentityLogoUrl(match.home, tenantLogoUrl);
  const awayLogoUrl = resolveClubIdentityLogoUrl(match.away, tenantLogoUrl);

  return (
    <article
      key={match.id}
      data-testid={`matchcenter-result-row-${match.id}`}
      className="relative px-5 py-4 transition hover:bg-[var(--surface-2)]"
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-4">
        {/* Home side */}
        <div className="flex min-w-0 items-center justify-end gap-3">
          <p
            className={
              match.home.isOwnTeam
                ? "min-w-0 truncate text-right text-sm font-semibold text-[var(--foreground)]"
                : "min-w-0 truncate text-right text-sm text-[var(--text-2)]"
            }
          >
            {homeName}
          </p>
          <ClubLogo
            logoUrl={homeLogoUrl}
            name={homeName}
            size="md"
            bare
            className="shrink-0"
          />
        </div>

        {/* Score */}
        <div
          className="shrink-0 rounded-lg bg-[var(--foreground)] px-3 py-1.5 text-center text-sm font-bold tabular-nums text-white"
          data-testid={`matchcenter-result-${match.id}`}
        >
          {result ?? "–"}
        </div>

        {/* Away side */}
        <div className="flex min-w-0 items-center gap-3">
          <ClubLogo
            logoUrl={awayLogoUrl}
            name={awayName}
            size="md"
            bare
            className="shrink-0"
          />
          <p
            className={
              match.away.isOwnTeam
                ? "min-w-0 truncate text-sm font-semibold text-[var(--foreground)]"
                : "min-w-0 truncate text-sm text-[var(--text-2)]"
            }
          >
            {awayName}
          </p>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-[var(--muted)]">
        <time dateTime={match.startAt.toISOString()}>
          {formatMatchDate(match.startAt, locale, timezone)}
        </time>

        {match.competitionLabel ? <span>{match.competitionLabel}</span> : null}

        {match.location ? (
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
            {match.location}
          </span>
        ) : null}

        {homeAwayLabel ? (
          <span className="font-medium text-[var(--text-2)]">{homeAwayLabel}</span>
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
