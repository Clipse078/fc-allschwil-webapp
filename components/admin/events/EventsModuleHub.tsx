import {
  CalendarDays,
  Dumbbell,
  Trophy,
  Volleyball,
} from "lucide-react";
import EventModuleCard from "@/components/admin/events/EventModuleCard";
import AdminSurfaceCard from "@/components/admin/shared/AdminSurfaceCard";

type EventsModuleHubProps = {
  selectedSeasonName?: string;
};

export default function EventsModuleHub({
  selectedSeasonName,
}: EventsModuleHubProps) {
  return (
    <div className="space-y-6">
      <AdminSurfaceCard className="p-6">
        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr] lg:items-start">
          <div>
            <p className="fca-eyebrow">Season-led event architecture</p>
            <h2 className="fca-heading mt-2">Eine zentrale Event-Quelle</h2>
            <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-600">
              Das WebApp Events Modul wird die führende Quelle für Matches, Turniere,
              Trainings und weitere Vereinsanlässe. Daten können künftig via ClubCorner / fvnws,
              manuell oder per CSV / Excel in die WebApp kommen und von dort direkt an
              Website und Infoboard ausgespielt werden.
            </p>
          </div>

          <div className="fca-section-card p-5">
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Zielbild
            </p>
            <div className="mt-3 space-y-2 text-sm text-slate-600">
              <p>WebApp = Source of Truth</p>
              <p>Website = API Consumer</p>
              <p>Infoboard = API Consumer</p>
              <p>Änderungen in der WebApp sollen direkt sichtbar werden.</p>
              {selectedSeasonName ? (
                <p className="pt-2 font-medium text-slate-800">
                  Aktive Saison: {selectedSeasonName}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </AdminSurfaceCard>

      <div className="grid gap-5 xl:grid-cols-2">
        <EventModuleCard
          icon={Volleyball}
          eyebrow="Events"
          title="Matches pro Team"
          description="Ligaspiele, Freundschaftsspiele und weitere Matchformate pro Team. Diese Daten sollen später direkt auf Homepage, Spielplan, Wochenplan, Teamseiten und Infoboard sichtbar sein."
          sources={["ClubCorner / fvnws", "Manuell", "CSV / Excel"]}
          outputs={["Website", "Wochenplan", "Teamseiten", "Infoboard"]}
          accent="red"
        />

        <EventModuleCard
          icon={Trophy}
          eyebrow="Events"
          title="Turniere pro Team"
          description="Turnierdaten pro Team inklusive manueller Planung und später möglicher externer Übernahme. Änderungen sollen live auf Website, Wochenplan und Infoboard ankommen."
          sources={["ClubCorner / fvnws", "Manuell", "CSV / Excel"]}
          outputs={["Website", "Wochenplan", "Teamseiten", "Infoboard"]}
          accent="amber"
        />

        <EventModuleCard
          icon={Dumbbell}
          eyebrow="Events"
          title="Trainings pro Team"
          description="Trainingssessions werden zentral verwaltet und speisen später Trainingsplan, Wochenplan, Teamseiten und Infoboard direkt aus dem WebApp Backend."
          sources={["Manuell", "CSV / Excel"]}
          outputs={["Website", "Trainingsplan", "Wochenplan", "Infoboard"]}
          accent="green"
        />

        <EventModuleCard
          icon={CalendarDays}
          eyebrow="Events"
          title="Weitere Events"
          description="Weitere Vereinsanlässe wie Party, Trip, Lager, Sponsor Apéro oder Generalversammlung. Diese Daten sollen primär auf die Website Events Seite ausgespielt werden."
          sources={["Manuell", "CSV / Excel"]}
          outputs={["Website", "Events Seite"]}
          accent="blue"
        />
      </div>
    </div>
  );
}
