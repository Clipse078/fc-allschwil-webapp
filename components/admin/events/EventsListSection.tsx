import { CalendarDays } from "lucide-react";
import EventListCard from "@/components/admin/events/EventListCard";
import EventTypeFilterBar from "@/components/admin/events/EventTypeFilterBar";

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

const FILTER_LABEL: Record<EventTypeFilter, string> = {
  ALL: "Alle Events",
  MATCH: "Matches",
  TOURNAMENT: "Turniere",
  TRAINING: "Trainings",
  OTHER: "Weitere Events",
};

export default function EventsListSection({
  activeFilter,
  events,
}: EventsListSectionProps) {
  return (
    <div className="space-y-4">
      {/* Filter + header */}
      <div className="sce-detail-section">
        <div className="sce-detail-section-header">
          <span className="text-sm font-semibold text-[var(--foreground)]">
            {FILTER_LABEL[activeFilter]}
          </span>
          <span className="sce-count-badge">{events.length}</span>
        </div>

        <div className="sce-detail-section-body">
          <EventTypeFilterBar activeFilter={activeFilter} />
        </div>
      </div>

      {/* Event list */}
      {events.length === 0 ? (
        <div className="sce-detail-section">
          <div className="sce-detail-section-body flex flex-col items-center justify-center gap-3 py-14 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--surface-2)]">
              <CalendarDays className="h-5 w-5 text-[var(--muted)]" />
            </div>
            <p className="font-semibold text-[var(--foreground)]">
              Noch keine Events gefunden
            </p>
            <p className="text-sm text-[var(--muted)]">
              Für den aktuellen Filter liegen noch keine Event-Datensätze vor.
            </p>
          </div>
        </div>
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
