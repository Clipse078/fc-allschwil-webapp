import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import SeasonContextSelector from "@/components/admin/shared/SeasonContextSelector";
import EventsModuleHub from "@/components/admin/events/EventsModuleHub";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getAvailableTeamSeasons } from "@/lib/teams/queries";

const EVENT_GROUPS = [
  {
    title: "Matches",
    description: "Ligaspiele, Friendly Matches und offizielle Matchdaten",
    items: ["Friendly Matches", "FVNWS Matches"],
    accent: "bg-blue-50 border-blue-200 text-blue-700",
  },
  {
    title: "Turniere",
    description: "PlayMore, Hallenturniere und interne Turniere",
    items: ["FVNWS / BRACK.CH PlayMore Turniere", "Hallenturniere", "Interne Turniere"],
    accent: "bg-amber-50 border-amber-200 text-amber-700",
  },
  {
    title: "Training Sessions",
    description: "Trainings der Teams innerhalb der gewählten Saison",
    items: ["Trainingsblöcke", "Spezialtrainings", "Ferien-Trainings"],
    accent: "bg-emerald-50 border-emerald-200 text-emerald-700",
  },
  {
    title: "Other Events",
    description: "Weitere saisonabhängige Vereinsereignisse",
    items: ["Generalversammlung", "Lager", "Party", "Weitere Events"],
    accent: "bg-slate-100 border-slate-200 text-slate-700",
  },
];

type EventsPageProps = {
  searchParams?: Promise<{
    season?: string;
    submitted?: string;
    count?: string;
  }>;
};

function getSubmittedMessage(submitted?: string, count?: string) {
  if (submitted !== "1") {
    return null;
  }

  const parsedCount = Number(count ?? "1");
  const safeCount = Number.isFinite(parsedCount) && parsedCount > 0 ? parsedCount : 1;

  if (safeCount === 1) {
    return "Event wurde zur Prüfung eingereicht.";
  }

  return String(safeCount) + " Trainings wurden zur Prüfung eingereicht.";
}

export default async function EventsPage({ searchParams }: EventsPageProps) {
  await requireAnyPermission([
    PERMISSIONS.EVENTS_VIEW,
    PERMISSIONS.EVENTS_MANAGE,
  ]);

  const params = (await searchParams) ?? {};
  const availableSeasons = await getAvailableTeamSeasons();

  const fallbackSeason =
    availableSeasons.find((season) => season.isActive)?.key ??
    availableSeasons[0]?.key ??
    "";

  const selectedSeasonKey =
    params.season && availableSeasons.some((season) => season.key === params.season)
      ? params.season
      : fallbackSeason;

  const selectedSeason =
    availableSeasons.find((season) => season.key === selectedSeasonKey) ?? null;

  const submittedMessage = getSubmittedMessage(params.submitted, params.count);

  return (
    <div className="space-y-8">
      <AdminSectionHeader
        eyebrow="Events"
        title="Events pro Saison"
        description="Saisongeführte Eventverwaltung. Die gewählte Saison ist führend; darunter werden Eventtypen dynamisch strukturiert."
      />

      {submittedMessage ? (
        <div className="fca-status-box fca-status-box-success">
          {submittedMessage}
        </div>
      ) : null}

      <SeasonContextSelector
        title="Aktive Saison"
        description="Events werden innerhalb der gewählten Saison nach Eventtyp geführt."
        seasons={availableSeasons}
        selectedSeasonKey={selectedSeasonKey}
        basePath="/dashboard/events"
      />

      <section className="grid gap-5 xl:grid-cols-2">
        {EVENT_GROUPS.map((group) => (
          <article
            key={group.title}
            className="rounded-[28px] border border-slate-200/80 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.04)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-[1.05rem] font-semibold text-slate-900">
                  {group.title}
                </h3>
                <p className="mt-2 text-sm text-slate-500">{group.description}</p>
              </div>

              <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${group.accent}`}>
                {group.items.length} Typen
              </span>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {group.items.map((item) => (
                <span
                  key={item}
                  className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700"
                >
                  {item}
                </span>
              ))}
            </div>
          </article>
        ))}
      </section>

      <section className="space-y-6">
        <AdminSectionHeader
          eyebrow="Detaildaten"
          title={`Eventverwaltung ${selectedSeason?.name ?? ""}`.trim()}
          description="Bestehende Eventfunktionen bleiben erhalten und werden im saisongeführten Kontext dargestellt."
        />

        <EventsModuleHub selectedSeasonName={selectedSeason?.name} />
      </section>
    </div>
  );
}
