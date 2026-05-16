import EventListCard from "@/components/admin/events/EventListCard";
import EventTypeFilterBar from "@/components/admin/events/EventTypeFilterBar";
import AdminSurfaceCard from "@/components/admin/shared/AdminSurfaceCard";

type EventTypeFilter = "ALL" | "MATCH" | "TOURNAMENT" | "TRAINING" | "OTHER";

type EventsListSectionProps = {
  activeFilter: EventTypeFilter;
  events: Array<{
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
  }>;
};

function getHeadline(filter: EventTypeFilter) {
  switch (filter) {
    case "MATCH":
      return "Matches";
    case "TOURNAMENT":
      return "Turniere";
    case "TRAINING":
      return "Trainings";
    case "OTHER":
      return "Weitere Events";
    case "ALL":
    default:
      return "Alle Events";
  }
}

export default function EventsListSection({
  activeFilter,
  events,
}: EventsListSectionProps) {
  return (
    <div className="space-y-6">
      <AdminSurfaceCard className="p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="fca-eyebrow">Filter</p>
            <h2 className="fca-heading mt-2">{getHeadline(activeFilter)}</h2>
            <p className="mt-3 text-sm text-slate-600">
              Erste Live-Datenansicht aus der Event-Datenbank als Grundlage für spätere Detailflows.
            </p>
          </div>

          <EventTypeFilterBar activeFilter={activeFilter} />
        </div>
      </AdminSurfaceCard>

      {events.length === 0 ? (
        <AdminSurfaceCard className="p-6">
          <div className="space-y-3">
            <p className="fca-subheading">Noch keine Events gefunden</p>
            <p className="text-sm leading-6 text-slate-600">
              Für den aktuellen Filter liegen noch keine Event-Datensätze vor.
              Als Nächstes bauen wir Create-Flows für Matches, Turniere, Trainings und weitere Events.
            </p>
          </div>
        </AdminSurfaceCard>
      ) : (
        <div className="grid gap-4">
          {events.map((event) => (
            <EventListCard key={event.id} event={event} />
          ))}
        </div>
      )}
    </div>
  );
}