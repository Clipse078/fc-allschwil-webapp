import Link from "next/link";
import { CalendarDays, MapPin, Trophy } from "lucide-react";
import type { TournamentDto } from "@/lib/tournaments/types";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";

const STATUS_LABELS: Record<string, string> = {
  COMPLETED: "Abgeschlossen",
  CANCELLED: "Storniert",
  ARCHIVED: "Archiviert",
};

const STATUS_VARIANTS: Record<string, BadgeVariant> = {
  COMPLETED: "default",
  CANCELLED: "danger",
  ARCHIVED: "outline",
};

function formatTournamentDate(value: string, locale: string, timezone: string): string {
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: timezone,
  }).format(new Date(value));
}

type TournamentArchivRowProps = {
  tournament: TournamentDto;
  locale: string;
  timezone: string;
};

export default function TournamentArchivRow({ tournament, locale, timezone }: TournamentArchivRowProps) {
  const statusLabel = STATUS_LABELS[tournament.status] ?? tournament.status;
  const statusVariant = STATUS_VARIANTS[tournament.status] ?? "outline";

  return (
    <article
      data-testid={`tournamentcenter-archiv-row-${tournament.id}`}
      className="relative grid gap-2 px-5 py-4 transition hover:bg-[var(--surface-2)]"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={statusVariant} size="sm">
          {statusLabel}
        </Badge>
        <Trophy className="h-4 w-4 shrink-0 text-[var(--muted)]" aria-hidden />
        <p className="min-w-0 truncate text-sm font-semibold text-[var(--foreground)]">{tournament.title}</p>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--muted)]">
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
