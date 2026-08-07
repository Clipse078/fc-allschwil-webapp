import Link from "next/link";
import {
  CalendarDays,
  CheckCircle2,
  CircleAlert,
  Clock3,
  MapPin,
  Radio,
} from "lucide-react";
import type { MatchcenterMatchSummary } from "@/lib/matchcenter/types";
import type { MatchcenterOperationalAssessment } from "@/lib/matchcenter/operational-state";
import { getMatchcenterResultLabel, isMatchLive } from "@/lib/matchcenter/match-lifecycle";
import { resolveMatchcenterCompactSideName } from "@/lib/matchcenter/team-display";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import MatchTeamLogo from "./MatchTeamLogo";

const STATUS_LABELS: Record<string, string> = {
  SCHEDULED: "Geplant",
  LIVE: "Live",
  POSTPONED: "Verschoben",
  CANCELED: "Abgesagt",
  CANCELLED: "Abgesagt",
  DRAFT: "Entwurf",
  ARCHIVED: "Archiviert",
};

const STATUS_VARIANTS: Record<string, BadgeVariant> = {
  SCHEDULED: "info",
  LIVE: "success",
  POSTPONED: "warning",
  CANCELED: "danger",
  CANCELLED: "danger",
  DRAFT: "outline",
  ARCHIVED: "outline",
};

function formatMatchDate(value: Date, locale: string, timezone: string): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timezone,
  }).format(value);
}

type MatchcenterSpielplanungRowProps = {
  match: MatchcenterMatchSummary;
  assessment: MatchcenterOperationalAssessment;
  locale: string;
  timezone: string;
};

export default function MatchcenterSpielplanungRow({
  match,
  assessment,
  locale,
  timezone,
}: MatchcenterSpielplanungRowProps) {
  const normalizedHomeAway = match.homeAway?.trim().toUpperCase() ?? null;
  const homeAwayLabel =
    normalizedHomeAway === "HOME"
      ? "Heimspiel"
      : normalizedHomeAway === "AWAY"
        ? "Auswärtsspiel"
        : null;

  const statusLabel = STATUS_LABELS[match.status] ?? match.status;
  const statusVariant = STATUS_VARIANTS[match.status] ?? "default";
  const live = isMatchLive(match);
  const liveScore = getMatchcenterResultLabel(match);

  const homeName = resolveMatchcenterCompactSideName(match.home);
  const awayName = resolveMatchcenterCompactSideName(match.away);

  return (
    <article
      key={match.id}
      data-testid={`matchcenter-spielplanung-row-${match.id}`}
      className="relative grid gap-3 px-5 py-4 transition hover:bg-[var(--surface-2)] lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:gap-6"
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={statusVariant} size="sm">
            {live ? <Radio className="h-3 w-3" /> : null}
            {statusLabel}
          </Badge>

          {homeAwayLabel ? (
            <Badge
              variant={normalizedHomeAway === "HOME" ? "success" : "default"}
              size="sm"
              data-testid={`matchcenter-homeaway-${match.id}`}
            >
              {homeAwayLabel}
            </Badge>
          ) : null}

          {match.competitionLabel ? (
            <span className="text-xs font-medium text-[var(--muted)]">
              {match.competitionLabel}
            </span>
          ) : null}

          {live && liveScore ? (
            <span
              data-testid={`matchcenter-live-score-${match.id}`}
              className="rounded-md bg-[var(--foreground)] px-2 py-0.5 text-xs font-bold tabular-nums text-white"
            >
              {liveScore}
            </span>
          ) : null}
        </div>

        <div className="mt-2 flex min-w-0 items-center gap-2">
          <MatchTeamLogo
            label={homeName}
            emphasized={match.home.isOwnTeam}
            logoUrl={match.home.externalLogoUrl}
          />
          <p
            className={
              match.home.isOwnTeam
                ? "min-w-0 truncate text-sm font-semibold text-[var(--foreground)]"
                : "min-w-0 truncate text-sm text-[var(--foreground)]"
            }
          >
            {homeName}
          </p>

          <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            vs
          </span>

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

        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--muted)]">
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays className="h-3.5 w-3.5" />
            {formatMatchDate(match.startAt, locale, timezone)}
          </span>

          {match.location ? (
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" />
              {match.location}
            </span>
          ) : null}

          {match.operational.meetingTime ? (
            <span className="inline-flex items-center gap-1.5">
              <Clock3 className="h-3.5 w-3.5" />
              Treffpunkt{" "}
              {new Intl.DateTimeFormat(locale, {
                hour: "2-digit",
                minute: "2-digit",
                timeZone: timezone,
              }).format(match.operational.meetingTime)}
            </span>
          ) : null}
        </div>
      </div>

      <div
        className="flex shrink-0 flex-col items-start gap-1.5 lg:items-end"
        data-testid={`matchcenter-action-${match.id}`}
      >
        {assessment.status === "READY" ? (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Bereit
          </span>
        ) : assessment.status === "AWAY" ? (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--muted)]">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Auswärtsspiel
          </span>
        ) : assessment.status === "OPEN" ? (
          <>
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700">
              <CircleAlert className="h-3.5 w-3.5" />
              {assessment.actionCount === 1
                ? "1 Aufgabe offen"
                : `${assessment.actionCount} Aufgaben offen`}
            </span>
            <div className="flex flex-wrap justify-end gap-1">
              {assessment.actions.map((action) => (
                <Badge key={action.key} variant="warning" size="sm">
                  {action.label}
                </Badge>
              ))}
            </div>
          </>
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
