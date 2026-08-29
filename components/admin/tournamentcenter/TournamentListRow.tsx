import Link from "next/link";
import { CalendarDays, CheckCircle2, CircleAlert, MapPin, Trophy, Users } from "lucide-react";
import type { TournamentDto } from "@/lib/tournaments/types";
import type { TournamentOperationalAssessment } from "@/lib/tournaments/operational-state";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { ClubLogo } from "@/components/admin/club-directory/ClubLogo";

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Entwurf",
  SCHEDULED: "Geplant",
  LIVE: "Live",
  COMPLETED: "Abgeschlossen",
  CANCELLED: "Storniert",
  POSTPONED: "Verschoben",
  ARCHIVED: "Archiviert",
};

const STATUS_VARIANTS: Record<string, BadgeVariant> = {
  DRAFT: "outline",
  SCHEDULED: "info",
  LIVE: "success",
  COMPLETED: "default",
  CANCELLED: "danger",
  POSTPONED: "warning",
  ARCHIVED: "outline",
};

function formatTournamentDate(value: string, locale: string, timezone: string): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timezone,
  }).format(new Date(value));
}

type TournamentListRowProps = {
  tournament: TournamentDto;
  assessment: TournamentOperationalAssessment;
  locale: string;
  timezone: string;
};

export default function TournamentListRow({
  tournament,
  assessment,
  locale,
  timezone,
}: TournamentListRowProps) {
  const statusLabel = STATUS_LABELS[tournament.status] ?? tournament.status;
  const statusVariant = STATUS_VARIANTS[tournament.status] ?? "default";

  return (
    <article
      data-testid={`tournamentcenter-row-${tournament.id}`}
      className="relative grid gap-3 px-5 py-4 transition hover:bg-[var(--surface-2)] lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:gap-6"
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={statusVariant} size="sm">
            {statusLabel}
          </Badge>

          {tournament.competitionLabel ? (
            <span className="text-xs font-medium text-[var(--muted)]">
              {tournament.competitionLabel}
            </span>
          ) : null}
        </div>

        <div className="mt-2 flex min-w-0 items-center gap-2">
          <Trophy className="h-4 w-4 shrink-0 text-[var(--sce-primary)]" aria-hidden />
          <p className="min-w-0 truncate text-sm font-semibold text-[var(--foreground)]">
            {tournament.title}
          </p>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--muted)]">
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays className="h-3.5 w-3.5" />
            {formatTournamentDate(tournament.startAt, locale, timezone)}
          </span>

          {tournament.location ? (
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" />
              {tournament.location}
            </span>
          ) : null}

          {tournament.participants.length > 0 ? (
            <span className="inline-flex items-center gap-1.5" title={tournament.participants.map((p) => p.displayName).join(", ")}>
              <Users className="h-3.5 w-3.5" />
              {tournament.participants.length === 1
                ? tournament.participants[0]!.displayName
                : `${tournament.participants.length} Teams`}
            </span>
          ) : null}
        </div>

        <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--muted)]">
          {tournament.team ? (
            <span
              className="inline-flex items-center gap-1.5"
              data-testid={`tournament-team-${tournament.id}`}
            >
              <ClubLogo
                logoUrl={tournament.teamLogoUrl}
                name={tournament.team.name}
                size="sm"
                bare
                className="h-3.5 w-3.5"
              />
              <span>
                <span className="font-medium text-[var(--foreground)]">Mannschaft:</span>{" "}
                {tournament.team.name}
              </span>
            </span>
          ) : null}

          {tournament.organizerName ? (
            <span
              className="inline-flex items-center gap-1.5"
              data-testid={`tournament-organizer-${tournament.id}`}
            >
              <ClubLogo
                logoUrl={tournament.organizerLogoUrl}
                name={tournament.organizerName}
                size="sm"
                bare
                className="h-3.5 w-3.5"
              />
              <span>
                <span className="font-medium text-[var(--foreground)]">Veranstalter:</span>{" "}
                {tournament.organizerName}
              </span>
            </span>
          ) : null}
        </div>
      </div>

      <div
        className="flex shrink-0 flex-col items-start gap-1.5 lg:items-end"
        data-testid={`tournamentcenter-action-${tournament.id}`}
      >
        {assessment.status === "READY" ? (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Bereit
          </span>
        ) : assessment.status === "OPEN" ? (
          <>
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700">
              <CircleAlert className="h-3.5 w-3.5" />
              {assessment.actionCount === 1 ? "1 Angabe fehlt" : `${assessment.actionCount} Angaben fehlen`}
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
        href={`/dashboard/tournamentcenter/${tournament.id}/edit`}
        aria-label={`Details zu ${tournament.title} anzeigen`}
        className="absolute inset-0 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sce-primary)] focus-visible:ring-offset-2"
      >
        <span className="sr-only">Details zu {tournament.title} anzeigen</span>
      </Link>
    </article>
  );
}
