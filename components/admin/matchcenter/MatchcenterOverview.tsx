import Link from "next/link";
import {
  CalendarDays,
  CheckCircle2,
  CircleAlert,
  Clock3,
  MapPin,
  Plus,
  Radio,
  ShieldAlert,
  Volleyball,
} from "lucide-react";
import type { MatchcenterMatchSummary } from "@/lib/matchcenter/types";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/page/EmptyState";
import { SectionCard } from "@/components/ui/page/SectionCard";

type MatchcenterOverviewProps = {
  matches: MatchcenterMatchSummary[];
  timezone?: string;
  locale?: string;
};

const STATUS_LABELS: Record<string, string> = {
  SCHEDULED: "Geplant",
  LIVE: "Live",
  COMPLETED: "Abgeschlossen",
  POSTPONED: "Verschoben",
  CANCELED: "Abgesagt",
  CANCELLED: "Abgesagt",
  DRAFT: "Entwurf",
  ARCHIVED: "Archiviert",
};

const STATUS_VARIANTS: Record<string, BadgeVariant> = {
  SCHEDULED: "info",
  LIVE: "success",
  COMPLETED: "default",
  POSTPONED: "warning",
  CANCELED: "danger",
  CANCELLED: "danger",
  DRAFT: "outline",
  ARCHIVED: "outline",
};

function formatMatchDate(
  value: Date,
  locale: string,
  timezone: string,
): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timezone,
  }).format(value);
}

function getResult(match: MatchcenterMatchSummary): string | null {
  if (match.scoreHome !== null && match.scoreAway !== null) {
    return `${match.scoreHome}:${match.scoreAway}`;
  }

  const resultLabel = match.resultLabel?.trim();

  return resultLabel ? resultLabel : null;
}

type MatchReadiness =
  | "ready"
  | "setup-required"
  | "away-match";

export function getMatchReadiness(
  match: MatchcenterMatchSummary,
): MatchReadiness {
  const homeAway = match.homeAway?.trim().toUpperCase() ?? null;

  if (homeAway === "AWAY") {
    return "away-match";
  }

  // Home matches only require the tenant-owned home (FC Allschwil) side to
  // resolve to a canonical Team. The away side is an external opponent and
  // is intentionally allowed to remain unmapped — see getOperationalWarnings.
  const hasTeam = match.home.resolution === "RESOLVED";
  const hasPitch = Boolean(match.operational.pitchCode?.trim());
  const hasHomeDR = Boolean(match.operational.homeDressingRoomCode?.trim());
  const hasAwayDR = Boolean(match.operational.awayDressingRoomCode?.trim());
  const infoboardOn = match.visibility.infoboardVisible;

  if (homeAway === "HOME" && hasTeam && hasPitch && hasHomeDR && hasAwayDR && infoboardOn) {
    return "ready";
  }

  return "setup-required";
}

export function getOperationalWarnings(
  match: MatchcenterMatchSummary,
): string[] {
  const warnings: string[] = [];
  const homeAway = match.homeAway?.trim().toUpperCase() ?? null;
  const isAway = homeAway === "AWAY";

  // A match only requires the tenant-owned FC Allschwil side to resolve to a
  // canonical Team. `homeAway` reflects FC Allschwil's own perspective on the
  // fixture, so the FCA side is the home side for home matches and the away
  // side for away matches. The opposite side is always the external
  // opponent: it is intentionally allowed to stay unmapped
  // (canonicalTeamId === null) and its resolution state must never trigger
  // this warning on its own — see TEAM-SFV-MAPPING-05.
  const ownSide = isAway ? match.away : match.home;
  const ownSideUnresolved = ownSide.resolution === "UNRESOLVED";

  if (ownSideUnresolved) {
    warnings.push("Team nicht zugeordnet");
  }

  if (!match.operational.pitchCode?.trim()) {
    warnings.push("Spielfeld fehlt");
  }

  if (!match.operational.homeDressingRoomCode?.trim()) {
    warnings.push("Garderobe Heimteam fehlt");
  }

  if (!match.operational.awayDressingRoomCode?.trim()) {
    warnings.push("Garderobe Gastteam fehlt");
  }

  // Only show infoboard warning for home matches
  if (homeAway === "HOME" && !match.visibility.infoboardVisible) {
    warnings.push("Infoboard nicht freigegeben");
  }

  return warnings;
}

export default function MatchcenterOverview({
  matches,
  timezone = "Europe/Zurich",
  locale = "de-CH",
}: MatchcenterOverviewProps) {
  if (matches.length === 0) {
    return (
      <SectionCard noPadding>
        <EmptyState
          icon={<Volleyball className="h-8 w-8" />}
          heading="Keine Matches vorhanden"
          description="Im aktuellen Matchcenter-Zeitraum wurden keine Spiele gefunden."
          action={
            <Link
              href="/dashboard/events/matches/new"
              className="fca-button-primary"
            >
              <Plus className="h-4 w-4" />
              Match erstellen
            </Link>
          }
        />
      </SectionCard>
    );
  }

  return (
    <SectionCard
      title="Matches"
      description="Chronologische Übersicht der vergangenen und kommenden Spiele."
      noPadding
    >
      <div
        className="divide-y divide-[var(--border)]"
        data-testid="matchcenter-list"
      >
        {matches.map((match) => {
          const result = getResult(match);
          const warnings = getOperationalWarnings(match);
          const readiness = getMatchReadiness(match);
          const statusLabel =
            STATUS_LABELS[match.status] ?? match.status;
          const statusVariant =
            STATUS_VARIANTS[match.status] ?? "default";
          const normalizedHomeAway =
            match.homeAway?.trim().toUpperCase() ?? null;
          const homeAwayLabel =
            normalizedHomeAway === "HOME"
              ? "Heimspiel"
              : normalizedHomeAway === "AWAY"
                ? "Auswärtsspiel"
                : null;

          return (
            <article
              key={match.id}
              data-testid={`matchcenter-row-${match.id}`}
              className="relative px-5 py-4 transition hover:bg-[var(--surface-2)]"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface-2)]">
                    <Volleyball className="h-4 w-4 text-[var(--muted)]" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant={statusVariant}
                        size="sm"
                      >
                        {match.status === "LIVE" ? (
                          <Radio className="h-3 w-3" />
                        ) : null}
                        {statusLabel}
                      </Badge>

                      {homeAwayLabel ? (
                        <Badge
                          variant={
                            normalizedHomeAway === "HOME"
                              ? "success"
                              : "default"
                          }
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
                    </div>

                    <div className="mt-2 grid gap-1 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-center sm:gap-4">
                      <p
                        className={
                          match.home.isOwnTeam
                            ? "truncate text-sm font-semibold text-[var(--foreground)]"
                            : "truncate text-sm text-[var(--foreground)]"
                        }
                      >
                        {match.home.displayName}
                      </p>

                      <div className="flex items-center gap-2 sm:justify-center">
                        {result ? (
                          <span
                            data-testid={`matchcenter-result-${match.id}`}
                            className="rounded-lg bg-[var(--foreground)] px-3 py-1 text-sm font-bold tabular-nums text-white"
                          >
                            {result}
                          </span>
                        ) : (
                          <span className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                            vs.
                          </span>
                        )}
                      </div>

                      <p
                        className={
                          match.away.isOwnTeam
                            ? "truncate text-sm font-semibold text-[var(--foreground)] sm:text-right"
                            : "truncate text-sm text-[var(--foreground)] sm:text-right"
                        }
                      >
                        {match.away.displayName}
                      </p>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--muted)]">
                      <span className="inline-flex items-center gap-1.5">
                        <CalendarDays className="h-3.5 w-3.5" />
                        {formatMatchDate(
                          match.startAt,
                          locale,
                          timezone,
                        )}
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
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-2 lg:max-w-xs lg:justify-end">
                  {/* Infoboard readiness badge */}
                  {readiness === "ready" ? (
                    <span
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700"
                      data-testid={`matchcenter-readiness-${match.id}`}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Bereit für Infoboard
                    </span>
                  ) : readiness === "away-match" ? (
                    <span
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--muted)]"
                      data-testid={`matchcenter-readiness-${match.id}`}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Auswärtsspiel
                    </span>
                  ) : warnings.length === 0 ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Operativ vollständig
                    </span>
                  ) : (
                    <>
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700">
                        <CircleAlert className="h-3.5 w-3.5" />
                        Einrichtung erforderlich
                      </span>

                      <div
                        className="flex flex-wrap gap-1.5"
                        aria-label="Operative Hinweise"
                      >
                        {warnings.map((warning) => (
                          <Badge
                            key={warning}
                            variant="warning"
                            size="sm"
                          >
                            <ShieldAlert className="h-3 w-3" />
                            {warning}
                          </Badge>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                <Link
                  href={`/dashboard/matchcenter/${match.id}`}
                  aria-label={`Details zu ${match.title} anzeigen`}
                  className="absolute inset-0 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sce-primary)] focus-visible:ring-offset-2"
                >
                  <span className="sr-only">
                    Details zu {match.title} anzeigen
                  </span>
                </Link>
              </div>
            </article>
          );
        })}
      </div>
    </SectionCard>
  );
}