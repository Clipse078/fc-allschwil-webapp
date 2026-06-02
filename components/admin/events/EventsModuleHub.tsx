import {
  CalendarDays,
  Dumbbell,
  Trophy,
  Volleyball,
} from "lucide-react";

type EventTypeInfo = {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  description: string;
  sources: string[];
  outputs: string[];
  iconColor: string;
  iconBg: string;
  badgeClass: string;
};

const EVENT_TYPES: EventTypeInfo[] = [
  {
    icon: Volleyball,
    label: "Matches",
    description:
      "Ligaspiele, Freundschaftsspiele und weitere Matchformate pro Team. Speist Homepage, Spielplan, Wochenplan, Teamseiten und Infoboard.",
    sources: ["ClubCorner / fvnws", "Manuell", "CSV / Excel"],
    outputs: ["Website", "Wochenplan", "Teamseiten", "Infoboard"],
    iconColor: "text-blue-600",
    iconBg: "border-blue-200 bg-blue-50",
    badgeClass: "border-blue-200 bg-blue-50 text-blue-700",
  },
  {
    icon: Trophy,
    label: "Turniere",
    description:
      "Turnierdaten pro Team — PlayMore, Hallenturniere und interne Turniere. Wird auf Website, Wochenplan und Infoboard ausgespielt.",
    sources: ["ClubCorner / fvnws", "Manuell", "CSV / Excel"],
    outputs: ["Website", "Wochenplan", "Teamseiten", "Infoboard"],
    iconColor: "text-amber-600",
    iconBg: "border-amber-200 bg-amber-50",
    badgeClass: "border-amber-200 bg-amber-50 text-amber-700",
  },
  {
    icon: Dumbbell,
    label: "Trainings",
    description:
      "Trainingssessions werden zentral verwaltet und speisen Trainingsplan, Wochenplan, Teamseiten und Infoboard.",
    sources: ["Manuell", "CSV / Excel"],
    outputs: ["Website", "Trainingsplan", "Wochenplan", "Infoboard"],
    iconColor: "text-emerald-600",
    iconBg: "border-emerald-200 bg-emerald-50",
    badgeClass: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  {
    icon: CalendarDays,
    label: "Weitere Events",
    description:
      "Vereinsanlässe wie Generalversammlung, Lager, Party oder Sponsor-Apéro. Primär auf der Website Events-Seite ausgespielt.",
    sources: ["Manuell", "CSV / Excel"],
    outputs: ["Website", "Events Seite"],
    iconColor: "text-violet-600",
    iconBg: "border-violet-200 bg-violet-50",
    badgeClass: "border-violet-200 bg-violet-50 text-violet-700",
  },
];

type EventsModuleHubProps = {
  selectedSeasonName?: string;
};

export default function EventsModuleHub({
  selectedSeasonName,
}: EventsModuleHubProps) {
  return (
    <div className="space-y-5">
      {/* Architecture intro */}
      <div className="sce-detail-section">
        <div className="sce-detail-section-header">
          <div>
            <span className="text-sm font-semibold text-[var(--foreground)]">
              Zielbild: WebApp als Source of Truth
            </span>
            {selectedSeasonName ? (
              <span className="ml-2 sce-count-badge">{selectedSeasonName}</span>
            ) : null}
          </div>
        </div>

        <div className="sce-detail-section-body">
          <p className="text-sm text-[var(--muted)]">
            Das WebApp Events Modul wird die führende Quelle für alle
            Vereins-Events. Änderungen in der WebApp werden direkt auf Website,
            Infoboard und Wochenplan ausgespielt.
          </p>

          <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-3">
            {["WebApp", "Website", "Infoboard"].map((node, idx) => (
              <div
                key={node}
                className="sce-data-field rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-3 text-center"
              >
                <p className="sce-data-label">{idx === 0 ? "Source" : "Consumer"}</p>
                <p className="sce-data-value mt-1 font-semibold">{node}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Event type overview grid */}
      <div className="grid gap-4 xl:grid-cols-2">
        {EVENT_TYPES.map((eventType) => {
          const Icon = eventType.icon;

          return (
            <div key={eventType.label} className="sce-detail-section">
              <div className="sce-detail-section-header">
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${eventType.iconBg}`}
                  >
                    <Icon className={`h-4 w-4 ${eventType.iconColor}`} />
                  </div>
                  <span className="text-sm font-semibold text-[var(--foreground)]">
                    {eventType.label}
                  </span>
                </div>
              </div>

              <div className="sce-detail-section-body space-y-4">
                <p className="text-sm text-[var(--muted)]">
                  {eventType.description}
                </p>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="sce-data-label mb-1.5">Datenquellen</p>
                    <div className="flex flex-wrap gap-1.5">
                      {eventType.sources.map((source) => (
                        <span
                          key={source}
                          className={`inline-flex h-5 items-center rounded-full border px-2 text-[0.65rem] font-semibold ${eventType.badgeClass}`}
                        >
                          {source}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="sce-data-label mb-1.5">Ausspielung</p>
                    <div className="flex flex-wrap gap-1.5">
                      {eventType.outputs.map((output) => (
                        <span
                          key={output}
                          className="inline-flex h-5 items-center rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-2 text-[0.65rem] font-semibold text-[var(--muted)]"
                        >
                          {output}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
