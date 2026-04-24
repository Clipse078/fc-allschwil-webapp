import { EventSource, EventType } from "@prisma/client";
import Link from "next/link";
import {
  createPlannerEntryAction,
  updatePlannerEntryAction,
} from "@/app/(admin)/dashboard/planner/actions";
import PlannerEntryDeleteButton from "@/components/admin/planner/PlannerEntryDeleteButton";

type PlannerCreateFormData = {
  seasons: Array<{
    id: string;
    key: string;
    name: string;
    isActive: boolean;
  }>;
  teams: Array<{
    id: string;
    name: string;
    category: string;
  }>;
  planningResources: Array<{
    id: string;
    key: string;
    name: string;
    type: "PITCH" | "DRESSING_ROOM" | "HALL" | "OTHER";
  }>;
  selectedSeasonKey: string;
  selectedSeasonId: string;
  selectedType: EventType;
  backHref: string;
  eventId?: string;
  defaults?: {
    title: string;
    source: EventSource;
    teamId: string;
    location: string;
    startAt: string;
    endAt: string;
    opponentName: string;
    organizerName: string;
    competitionLabel: string;
    description: string;
    remarks: string;
    pitchResourceId: string;
    homeDressingRoomResourceId: string;
    awayDressingRoomResourceId: string;
    websiteVisible: boolean;
    infoboardVisible: boolean;
    homepageVisible: boolean;
    wochenplanVisible: boolean;
    trainingsplanVisible: boolean;
    teamPageVisible: boolean;
  };
};

type PlannerEntryCreateFormProps = {
  data: PlannerCreateFormData;
  mode?: "create" | "edit";
};

const TYPE_OPTIONS: Array<{ value: EventType; label: string }> = [
  { value: "TRAINING", label: "Training" },
  { value: "MATCH", label: "Match" },
  { value: "TOURNAMENT", label: "Turnier" },
  { value: "OTHER", label: "Weiteres Event" },
  { value: "VACATION_PERIOD", label: "Ferienperiode" },
];

const SOURCE_OPTIONS: Array<{ value: EventSource; label: string }> = [
  { value: "MANUAL", label: "Manuell" },
  { value: "CLUBCORNER_FVNWS", label: "FVNWS API" },
  { value: "CSV_EXCEL_IMPORT", label: "CSV / Excel" },
  { value: "MUNICIPALITY_API", label: "Gemeinde API" },
];

function buildTypeHref(
  seasonKey: string,
  type: EventType,
  mode: "create" | "edit",
  eventId?: string,
) {
  const params = new URLSearchParams();

  if (seasonKey) {
    params.set("season", seasonKey);
  }

  params.set("type", type);

  if (mode === "edit" && eventId) {
    return `/dashboard/planner/edit/${eventId}?${params.toString()}`;
  }

  return `/dashboard/planner/new?${params.toString()}`;
}

export default function PlannerEntryCreateForm({
  data,
  mode = "create",
}: PlannerEntryCreateFormProps) {
  const defaults = data.defaults;
  const formAction =
    mode === "edit" ? updatePlannerEntryAction : createPlannerEntryAction;
  const pitchResources = data.planningResources.filter(
    (resource) => resource.type === "PITCH",
  );
  const dressingRoomResources = data.planningResources.filter(
    (resource) => resource.type === "DRESSING_ROOM",
  );

  return (
    <div className="space-y-8">
      <section className="rounded-[30px] border border-slate-200/80 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="fca-eyebrow">Planner</p>
            <h1 className="fca-heading mt-2">
              {mode === "edit"
                ? "Planner-Eintrag bearbeiten"
                : "Neuen Planner-Eintrag erstellen"}
            </h1>
            <p className="mt-3 max-w-2xl text-sm text-slate-500">
              {mode === "edit"
                ? "Passe einen saisongebundenen Planner-Eintrag an."
                : "Erstelle einen saisongebundenen Eintrag für Saisonagenda, Wochenplanner und Tagesplanner."}
            </p>
          </div>

          <Link
            href={data.backHref}
            className="inline-flex h-11 items-center rounded-full border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            Zurück zum Planner
          </Link>
        </div>
      </section>

      <section className="rounded-[30px] border border-slate-200/80 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
          Eintragstyp
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          {TYPE_OPTIONS.map((option) => {
            const isSelected = option.value === data.selectedType;

            return (
              <Link
                key={option.value}
                href={buildTypeHref(
                  data.selectedSeasonKey,
                  option.value,
                  mode,
                  data.eventId,
                )}
                className={
                  isSelected
                    ? "rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-[#0b4aa2]"
                    : "rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
                }
              >
                {option.label}
              </Link>
            );
          })}
        </div>
      </section>

      <form action={formAction} className="space-y-8">
        {mode === "edit" && data.eventId ? (
          <input type="hidden" name="eventId" value={data.eventId} />
        ) : null}
        <input type="hidden" name="seasonId" value={data.selectedSeasonId} />
        <input type="hidden" name="seasonKey" value={data.selectedSeasonKey} />
        <input type="hidden" name="type" value={data.selectedType} />

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_420px]">
          <div className="space-y-5">
            <article className="rounded-[28px] border border-slate-200/80 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
              <h2 className="text-[1.05rem] font-semibold text-slate-900">
                Stammdaten
              </h2>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label className="text-sm font-medium text-slate-700">Titel</label>
                  <input
                    name="title"
                    required
                    defaultValue={defaults?.title ?? ""}
                    className="mt-2 h-11 w-full rounded-[16px] border border-slate-200 px-4 text-sm text-slate-900 outline-none transition focus:border-blue-300"
                    placeholder="Zum Beispiel Training E4"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-700">Saison</label>
                  <input
                    value={
                      data.seasons.find(
                        (season) => season.key === data.selectedSeasonKey,
                      )?.name ?? ""
                    }
                    readOnly
                    className="mt-2 h-11 w-full rounded-[16px] border border-slate-200 bg-slate-50 px-4 text-sm text-slate-700"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-700">Quelle</label>
                  <select
                    name="source"
                    defaultValue={defaults?.source ?? "MANUAL"}
                    className="mt-2 h-11 w-full rounded-[16px] border border-slate-200 px-4 text-sm text-slate-900 outline-none transition focus:border-blue-300"
                  >
                    {SOURCE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-700">Team</label>
                  <select
                    name="teamId"
                    defaultValue={defaults?.teamId ?? ""}
                    className="mt-2 h-11 w-full rounded-[16px] border border-slate-200 px-4 text-sm text-slate-900 outline-none transition focus:border-blue-300"
                  >
                    <option value="">Kein Team</option>
                    {data.teams.map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-700">Ort</label>
                  <input
                    name="location"
                    defaultValue={defaults?.location ?? ""}
                    className="mt-2 h-11 w-full rounded-[16px] border border-slate-200 px-4 text-sm text-slate-900 outline-none transition focus:border-blue-300"
                    placeholder="Zum Beispiel Hauptplatz"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-700">Start</label>
                  <input
                    type="datetime-local"
                    name="startAt"
                    required
                    defaultValue={defaults?.startAt ?? ""}
                    className="mt-2 h-11 w-full rounded-[16px] border border-slate-200 px-4 text-sm text-slate-900 outline-none transition focus:border-blue-300"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-700">Ende</label>
                  <input
                    type="datetime-local"
                    name="endAt"
                    defaultValue={defaults?.endAt ?? ""}
                    className="mt-2 h-11 w-full rounded-[16px] border border-slate-200 px-4 text-sm text-slate-900 outline-none transition focus:border-blue-300"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-700">Gegner</label>
                  <input
                    name="opponentName"
                    defaultValue={defaults?.opponentName ?? ""}
                    className="mt-2 h-11 w-full rounded-[16px] border border-slate-200 px-4 text-sm text-slate-900 outline-none transition focus:border-blue-300"
                    placeholder="Optional"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-700">
                    Organisator
                  </label>
                  <input
                    name="organizerName"
                    defaultValue={defaults?.organizerName ?? ""}
                    className="mt-2 h-11 w-full rounded-[16px] border border-slate-200 px-4 text-sm text-slate-900 outline-none transition focus:border-blue-300"
                    placeholder="Optional"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="text-sm font-medium text-slate-700">
                    Wettbewerb / Label
                  </label>
                  <input
                    name="competitionLabel"
                    defaultValue={defaults?.competitionLabel ?? ""}
                    className="mt-2 h-11 w-full rounded-[16px] border border-slate-200 px-4 text-sm text-slate-900 outline-none transition focus:border-blue-300"
                    placeholder="Zum Beispiel BRACK.CH PlayMore"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="text-sm font-medium text-slate-700">
                    Beschreibung
                  </label>
                  <textarea
                    name="description"
                    rows={4}
                    defaultValue={defaults?.description ?? ""}
                    className="mt-2 w-full rounded-[16px] border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-300"
                    placeholder="Optionale Beschreibung"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="text-sm font-medium text-slate-700">
                    Bemerkungen
                  </label>
                  <textarea
                    name="remarks"
                    rows={3}
                    defaultValue={defaults?.remarks ?? ""}
                    className="mt-2 w-full rounded-[16px] border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-300"
                    placeholder="Interne Bemerkungen"
                  />
                </div>
              </div>
            </article>
          </div>

          <div className="space-y-5">
            <article className="rounded-[28px] border border-slate-200/80 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
              <h2 className="text-[1.05rem] font-semibold text-slate-900">
                Planung & Ressourcen
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                Weise Spielfeld und Garderoben zu. Diese Daten bilden die Grundlage für Wochenplan, Tagesplan und Infoboard.
              </p>

              <div className="mt-5 space-y-4">
                <div>
                  <label className="text-sm font-medium text-slate-700">
                    Spielfeld
                  </label>
                  <select
                    name="pitchResourceId"
                    defaultValue={defaults?.pitchResourceId ?? ""}
                    className="mt-2 h-11 w-full rounded-[16px] border border-slate-200 px-4 text-sm text-slate-900 outline-none transition focus:border-blue-300"
                  >
                    <option value="">Noch kein Spielfeld zugewiesen</option>
                    {pitchResources.map((resource) => (
                      <option key={resource.id} value={resource.id}>
                        {resource.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-700">
                    Garderobe Team / Heim
                  </label>
                  <select
                    name="homeDressingRoomResourceId"
                    defaultValue={defaults?.homeDressingRoomResourceId ?? ""}
                    className="mt-2 h-11 w-full rounded-[16px] border border-slate-200 px-4 text-sm text-slate-900 outline-none transition focus:border-blue-300"
                  >
                    <option value="">Noch keine Garderobe</option>
                    {dressingRoomResources.map((resource) => (
                      <option key={resource.id} value={resource.id}>
                        {resource.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-700">
                    Garderobe Gegner
                  </label>
                  <select
                    name="awayDressingRoomResourceId"
                    defaultValue={defaults?.awayDressingRoomResourceId ?? ""}
                    className="mt-2 h-11 w-full rounded-[16px] border border-slate-200 px-4 text-sm text-slate-900 outline-none transition focus:border-blue-300"
                  >
                    <option value="">Nur bei Match / Turnier</option>
                    {dressingRoomResources.map((resource) => (
                      <option key={resource.id} value={resource.id}>
                        {resource.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </article>

            <article className="rounded-[28px] border border-slate-200/80 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
              <h2 className="text-[1.05rem] font-semibold text-slate-900">
                Publikation
              </h2>

              <div className="mt-5 space-y-3">
                <label className="flex items-center gap-3 rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    name="websiteVisible"
                    defaultChecked={defaults?.websiteVisible ?? true}
                  />
                  Website
                </label>

                <label className="flex items-center gap-3 rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    name="wochenplanVisible"
                    defaultChecked={defaults?.wochenplanVisible ?? true}
                  />
                  Wochenplanner
                </label>

                <label className="flex items-center gap-3 rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    name="infoboardVisible"
                    defaultChecked={defaults?.infoboardVisible ?? false}
                  />
                  Infoboard
                </label>

                <label className="flex items-center gap-3 rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    name="homepageVisible"
                    defaultChecked={defaults?.homepageVisible ?? false}
                  />
                  Homepage
                </label>

                <label className="flex items-center gap-3 rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    name="trainingsplanVisible"
                    defaultChecked={defaults?.trainingsplanVisible ?? false}
                  />
                  Trainingsplan
                </label>

                <label className="flex items-center gap-3 rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    name="teamPageVisible"
                    defaultChecked={defaults?.teamPageVisible ?? false}
                  />
                  Teamseite
                </label>
              </div>
            </article>

            <article className="rounded-[28px] border border-slate-200/80 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
              <h2 className="text-[1.05rem] font-semibold text-slate-900">
                Aktion
              </h2>

              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="submit"
                  className="inline-flex h-11 items-center rounded-full bg-[#0b4aa2] px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#08357a]"
                >
                  {mode === "edit"
                    ? "Änderungen speichern"
                    : "Planner-Eintrag erstellen"}
                </button>

                <Link
                  href={data.backHref}
                  className="inline-flex h-11 items-center rounded-full border border-slate-200 bg-white px-5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
                >
                  Abbrechen
                </Link>

                {mode === "edit" && data.eventId ? (
                  <PlannerEntryDeleteButton
                    eventId={data.eventId}
                    seasonKey={data.selectedSeasonKey}
                  />
                ) : null}
              </div>
            </article>
          </div>
        </section>
      </form>
    </div>
  );
}
