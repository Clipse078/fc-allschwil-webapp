import AdminSurfaceCard from "@/components/admin/shared/AdminSurfaceCard";
import AdminStatusPill from "@/components/admin/shared/AdminStatusPill";

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

function getTypeLabel(type: string) {
  switch (type) {
    case "MATCH":
      return "Match";
    case "TOURNAMENT":
      return "Turnier";
    case "TRAINING":
      return "Training";
    case "OTHER":
      return "Weiteres Event";
    default:
      return type;
  }
}

function getSourceLabel(source: string) {
  switch (source) {
    case "CLUBCORNER_FVNWS":
      return "ClubCorner / fvnws";
    case "MANUAL":
      return "Manuell";
    case "CSV_EXCEL_IMPORT":
      return "CSV / Excel";
    default:
      return source;
  }
}

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
  const publicationTargets = getPublicationTargets(event);

  return (
    <AdminSurfaceCard className="p-5">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="fca-eyebrow">{getTypeLabel(event.type)}</p>
            <span className="fca-pill">{event.season.name}</span>
            {event.team ? <span className="fca-pill">{event.team.name}</span> : null}
          </div>

          <h3 className="fca-subheading mt-3">{event.title}</h3>

          <div className="mt-3 flex flex-wrap gap-2">
            <AdminStatusPill label={event.status} tone={event.status === "SCHEDULED" ? "success" : "muted"} />
            <span className="fca-pill">Quelle: {getSourceLabel(event.source)}</span>
            {event.competitionLabel ? <span className="fca-pill">{event.competitionLabel}</span> : null}
            {event.homeAway ? <span className="fca-pill">{event.homeAway}</span> : null}
            {event.resultLabel ? <span className="fca-pill">Resultat: {event.resultLabel}</span> : null}
          </div>

          <div className="mt-4 space-y-2 text-sm text-slate-600">
            <p>
              <span className="font-semibold text-slate-900">Start:</span>{" "}
              {formatDateTime(event.startAt)}
            </p>

            {event.endAt ? (
              <p>
                <span className="font-semibold text-slate-900">Ende:</span>{" "}
                {formatDateTime(event.endAt)}
              </p>
            ) : null}

            {event.location ? (
              <p>
                <span className="font-semibold text-slate-900">Ort:</span>{" "}
                {event.location}
              </p>
            ) : null}

            {event.opponentName ? (
              <p>
                <span className="font-semibold text-slate-900">Gegner:</span>{" "}
                {event.opponentName}
              </p>
            ) : null}

            {event.organizerName ? (
              <p>
                <span className="font-semibold text-slate-900">Organisator:</span>{" "}
                {event.organizerName}
              </p>
            ) : null}

            {event.description ? (
              <p className="pt-1 leading-6">{event.description}</p>
            ) : null}
          </div>
        </div>

        <div className="xl:w-[320px]">
          <div className="fca-section-card p-4">
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Ausspielung
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              {publicationTargets.length > 0 ? (
                publicationTargets.map((target) => (
                  <span key={target} className="fca-pill">
                    {target}
                  </span>
                ))
              ) : (
                <span className="text-sm text-slate-500">Keine Ausspielung gesetzt</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </AdminSurfaceCard>
  );
}