import { CalendarDays, MapPin, Swords, User } from "lucide-react";

type EventListCardProps = {
  event: {
    id: string;
    title: string;
    description: string | null;
    location: string | null;
    startAt: string | Date;
    endAt: string | Date | null;
    type: string;
    source: string;
    status: string;
    websiteVisible: boolean;
    infoboardVisible: boolean;
    homepageVisible: boolean;
    wochenplanVisible: boolean;
    trainingsplanVisible: boolean;
    teamPageVisible: boolean;
    opponentName: string | null;
    organizerName: string | null;
    competitionLabel: string | null;
    homeAway: string | null;
    resultLabel: string | null;
    season: {
      id: string;
      key: string;
      name: string;
    };
    team: {
      id: string;
      name: string;
      slug: string;
      category: string;
      ageGroup: string | null;
    } | null;
  };
};

function formatDateTime(value: string | Date) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleString("de-CH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const TYPE_LABEL: Record<string, string> = {
  MATCH: "Match",
  TOURNAMENT: "Turnier",
  TRAINING: "Training",
  OTHER: "Weiteres Event",
};

const TYPE_BADGE: Record<string, string> = {
  MATCH: "border-blue-200 bg-blue-50 text-blue-700",
  TOURNAMENT: "border-amber-200 bg-amber-50 text-amber-700",
  TRAINING: "border-emerald-200 bg-emerald-50 text-emerald-700",
  OTHER: "border-violet-200 bg-violet-50 text-violet-700",
};

const SOURCE_LABEL: Record<string, string> = {
  CLUBCORNER_FVNWS: "ClubCorner / fvnws",
  MANUAL: "Manuell",
  CSV_EXCEL_IMPORT: "CSV / Excel",
};

const STATUS_BADGE: Record<string, string> = {
  SCHEDULED: "border-emerald-200 bg-emerald-50 text-emerald-700",
  DRAFT: "border-amber-200 bg-amber-50 text-amber-700",
  CANCELLED: "border-rose-200 bg-rose-50 text-rose-700",
};

function getPublicationTargets(event: EventListCardProps["event"]) {
  const targets: string[] = [];
  if (event.websiteVisible) targets.push("Website");
  if (event.infoboardVisible) targets.push("Infoboard");
  if (event.homepageVisible) targets.push("Homepage");
  if (event.wochenplanVisible) targets.push("Wochenplan");
  if (event.trainingsplanVisible) targets.push("Trainingsplan");
  if (event.teamPageVisible) targets.push("Teamseite");
  return targets;
}

export default function EventListCard({ event }: EventListCardProps) {
  const typeBadge = TYPE_BADGE[event.type] ?? "border-slate-200 bg-slate-50 text-slate-600";
  const typeLabel = TYPE_LABEL[event.type] ?? event.type;
  const statusBadge = STATUS_BADGE[event.status] ?? "border-slate-200 bg-slate-50 text-slate-500";
  const sourceLabel = SOURCE_LABEL[event.source] ?? event.source;
  const publicationTargets = getPublicationTargets(event);

  return (
    <div className="sce-detail-section">
      <div className="sce-detail-section-header">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span
            className={`inline-flex h-5 items-center rounded-full border px-2 text-[0.65rem] font-semibold ${typeBadge}`}
          >
            {typeLabel}
          </span>
          <span className="truncate text-sm font-semibold text-[var(--foreground)]">
            {event.title}
          </span>
          {event.season && (
            <span className="inline-flex h-5 items-center rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-2 text-[0.65rem] font-semibold text-[var(--muted)]">
              {event.season.name}
            </span>
          )}
          {event.team && (
            <span className="inline-flex h-5 items-center rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-2 text-[0.65rem] font-semibold text-[var(--muted)]">
              {event.team.name}
            </span>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <span
            className={`inline-flex h-5 items-center rounded-full border px-2 text-[0.65rem] font-semibold ${statusBadge}`}
          >
            {event.status}
          </span>
        </div>
      </div>

      <div className="sce-detail-section-body">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="sce-data-field">
            <p className="sce-data-label">Start</p>
            <p className="sce-data-value mt-1 flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5 shrink-0 text-[var(--blue)]" />
              {formatDateTime(event.startAt)}
            </p>
          </div>

          {event.endAt ? (
            <div className="sce-data-field">
              <p className="sce-data-label">Ende</p>
              <p className="sce-data-value mt-1 flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5 shrink-0 text-[var(--blue)]" />
                {formatDateTime(event.endAt)}
              </p>
            </div>
          ) : null}

          {event.location ? (
            <div className="sce-data-field">
              <p className="sce-data-label">Ort</p>
              <p className="sce-data-value mt-1 flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 shrink-0 text-[var(--blue)]" />
                {event.location}
              </p>
            </div>
          ) : null}

          {event.opponentName ? (
            <div className="sce-data-field">
              <p className="sce-data-label">Gegner</p>
              <p className="sce-data-value mt-1 flex items-center gap-1.5">
                <Swords className="h-3.5 w-3.5 shrink-0 text-[var(--blue)]" />
                {event.opponentName}
              </p>
            </div>
          ) : null}

          {event.organizerName ? (
            <div className="sce-data-field">
              <p className="sce-data-label">Organisator</p>
              <p className="sce-data-value mt-1 flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 shrink-0 text-[var(--blue)]" />
                {event.organizerName}
              </p>
            </div>
          ) : null}
        </div>

        {event.description ? (
          <p className="mt-4 text-sm leading-relaxed text-[var(--muted)]">
            {event.description}
          </p>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="sce-data-label">Quelle:</span>
            <span className="inline-flex h-5 items-center rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-2 text-[0.65rem] font-semibold text-[var(--muted)]">
              {sourceLabel}
            </span>
          </div>

          {event.competitionLabel ? (
            <span className="inline-flex h-5 items-center rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-2 text-[0.65rem] font-semibold text-[var(--muted)]">
              {event.competitionLabel}
            </span>
          ) : null}

          {event.resultLabel ? (
            <span className="inline-flex h-5 items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 text-[0.65rem] font-semibold text-emerald-700">
              {event.resultLabel}
            </span>
          ) : null}

          {publicationTargets.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {publicationTargets.map((target) => (
                <span
                  key={target}
                  className="inline-flex h-5 items-center rounded-full border border-blue-200 bg-blue-50 px-2 text-[0.65rem] font-semibold text-[var(--blue)]"
                >
                  {target}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
