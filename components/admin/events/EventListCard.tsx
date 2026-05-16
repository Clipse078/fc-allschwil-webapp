import { Lightbulb } from "lucide-react";
import AdminSurfaceCard from "@/components/admin/shared/AdminSurfaceCard";
import AdminStatusPill from "@/components/admin/shared/AdminStatusPill";
import { TRAINING_FOCUS_LABELS } from "@/lib/training/labels";

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
    trainingFocus: string | null;
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
            {event.type === "TRAINING" && event.trainingFocus && (
              <span className="rounded-full border border-[#0b4aa2]/25 bg-[#0b4aa2]/5 px-2.5 py-0.5 text-[11px] font-semibold text-[#0b4aa2]">
                {TRAINING_FOCUS_LABELS[event.trainingFocus as keyof typeof TRAINING_FOCUS_LABELS] ?? event.trainingFocus}
              </span>
            )}
            {event.competitionLabel ? <span className="fca-pill">{event.competitionLabel}</span> : null}
            {event.homeAway ? <span className="fca-pill">{event.homeAway}</span> : null}
            {event.resultLabel ? <span className="fca-pill">Resultat: {event.resultLabel}</span> : null}
          </div>
          {event.type === "TRAINING" && !event.trainingFocus && (
            <div className="mt-3 flex items-center gap-2 rounded-[12px] border border-amber-100 bg-amber-50/70 px-3 py-2">
              <Lightbulb className="h-3 w-3 shrink-0 text-amber-500" />
              <p className="text-[11px] text-amber-800">
                Kein Schwerpunkt gesetzt.{" "}
                <a href={`/dashboard/training/bulk-tag`} className="font-semibold underline hover:text-amber-900">
                  Schwerpunkt ergänzen
                </a>{" "}
                damit dieses Training zu Strategie-KPIs beiträgt.
              </p>
            </div>
          )}

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