import { CalendarDays, CheckCircle2, Flag, Layers3, Plus, Trash2 } from "lucide-react";
import {
  createNextSeasonAction,
  deletePlannedSeasonAction,
} from "@/app/(admin)/dashboard/seasons/actions";
import { getSeasonsOverviewData } from "@/lib/seasons/queries";
import { getSeasonLifecycleStatusClasses } from "@/lib/seasons/status";

function formatSwissDate(value: Date) {
  return new Intl.DateTimeFormat("de-CH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(value);
}

type SeasonsPageProps = {
  searchParams?: Promise<{
    status?: string;
  }>;
};

function getFeedbackBanner(status?: string) {
  switch (status) {
    case "create-success":
      return {
        className: "border-emerald-200 bg-emerald-50 text-emerald-800",
        text: "Die nächste Saison wurde erfolgreich erstellt und ist nun In Planung.",
      };
    case "create-exists":
      return {
        className: "border-amber-200 bg-amber-50 text-amber-800",
        text: "Die nächste Saison existiert bereits und bleibt In Planung.",
      };
    case "create-invalid":
      return {
        className: "border-rose-200 bg-rose-50 text-rose-800",
        text: "Die nächste Saison konnte nicht berechnet werden.",
      };
    case "delete-success":
      return {
        className: "border-emerald-200 bg-emerald-50 text-emerald-800",
        text: "Die geplante Saison wurde erfolgreich gelöscht.",
      };
    case "delete-not-allowed":
      return {
        className: "border-rose-200 bg-rose-50 text-rose-800",
        text: "Nur Saisons mit dem Status In Planung dürfen gelöscht werden.",
      };
    case "delete-has-dependencies":
      return {
        className: "border-rose-200 bg-rose-50 text-rose-800",
        text: "Diese Saison kann nicht gelöscht werden, da bereits Teams, Events oder Importläufe damit verknüpft sind.",
      };
    case "delete-not-found":
      return {
        className: "border-rose-200 bg-rose-50 text-rose-800",
        text: "Die gewählte Saison wurde nicht gefunden.",
      };
    case "delete-missing-id":
      return {
        className: "border-rose-200 bg-rose-50 text-rose-800",
        text: "Es wurde keine Saison-ID zur Löschung übergeben.",
      };
    case "forbidden":
      return {
        className: "border-rose-200 bg-rose-50 text-rose-800",
        text: "Du hast keine Berechtigung, um Saisons zu verwalten.",
      };
    default:
      return null;
  }
}

export default async function SeasonsPage({ searchParams }: SeasonsPageProps) {
  const params = (await searchParams) ?? {};
  const seasons = await getSeasonsOverviewData();
  const feedback = getFeedbackBanner(params.status);

  return (
    <div className="space-y-5">
      {feedback ? (
        <section className={`rounded-[24px] border px-5 py-4 text-sm font-medium ${feedback.className}`}>
          {feedback.text}
        </section>
      ) : null}

      <section
        id="create-season"
        className="rounded-[30px] border border-slate-200/80 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.04)]"
      >
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h3 className="text-[1.15rem] font-semibold text-slate-900">
              Neue Saison planen
            </h3>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">
              Beim Erstellen einer neuen Saison bleibt die aktuelle Saison laufend.
              Die neue zukünftige Saison wird automatisch als <span className="font-semibold text-amber-700">In Planung</span> angelegt.
              Sobald der Saisonzeitraum beginnt, wird sie automatisch zur <span className="font-semibold text-emerald-700">laufenden</span> Saison.
            </p>
          </div>

          <form action={createNextSeasonAction}>
            <button
              type="submit"
              className="inline-flex h-11 items-center gap-2 rounded-full bg-[#0b4aa2] px-4 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-[1px] hover:bg-[#08357a]"
            >
              <Plus className="h-4 w-4" />
              Neue Saison planen
            </button>
          </form>
        </div>
      </section>

      <section className="rounded-[30px] border border-slate-200/80 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h3 className="text-[1.15rem] font-semibold text-slate-900">
              Saison-Lifecycle
            </h3>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">
              Neue zukünftige Saisons sind <span className="font-semibold text-amber-700">In Planung</span>.
              Die aktuelle Saison ist <span className="font-semibold text-emerald-700">Laufend</span>.
              Vergangene Saisons werden automatisch als <span className="font-semibold text-slate-700">Abgeschlossen</span> behandelt.
            </p>
          </div>

          <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            Löschen ist nur für <span className="font-semibold text-amber-700">In Planung</span> erlaubt und nur solange keine Abhängigkeiten existieren.
          </div>
        </div>
      </section>

      {seasons.map((season) => {
        const canDelete =
          season.lifecycleStatus === "PLANNING" &&
          season.teamSeasonCount === 0 &&
          season.eventCount === 0;

        return (
          <section
            key={season.id}
            className="rounded-[30px] border border-slate-200/80 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.04)]"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h3 className="text-[1.15rem] font-semibold text-slate-900">
                  {season.name}
                </h3>
                <p className="mt-2 text-sm text-slate-600">
                  Führende Saisonstruktur für Teams und Events.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${getSeasonLifecycleStatusClasses(
                    season.lifecycleStatus,
                  )}`}
                >
                  {season.lifecycleStatusLabel}
                </span>

                {season.shouldBeActive ? (
                  <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-[#0b4aa2]">
                    Führende Saison
                  </span>
                ) : null}

                {season.isActive !== season.shouldBeActive ? (
                  <span className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700">
                    DB-Status prüfen
                  </span>
                ) : null}
              </div>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-[22px] border border-slate-200/80 bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-slate-400">
                  Zeitraum
                </p>
                <div className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-slate-800">
                  <CalendarDays className="h-4 w-4 text-[#0b4aa2]" />
                  {formatSwissDate(season.startDate)} – {formatSwissDate(season.endDate)}
                </div>
              </div>

              <div className="rounded-[22px] border border-slate-200/80 bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-slate-400">
                  Teams
                </p>
                <div className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-slate-800">
                  <Layers3 className="h-4 w-4 text-[#0b4aa2]" />
                  {season.teamSeasonCount} Team-Saisons
                </div>
              </div>

              <div className="rounded-[22px] border border-slate-200/80 bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-slate-400">
                  Events
                </p>
                <div className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-slate-800">
                  <Flag className="h-4 w-4 text-[#0b4aa2]" />
                  {season.eventCount} Events
                </div>
              </div>

              <div className="rounded-[22px] border border-slate-200/80 bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-slate-400">
                  Aktiver DB-Flag
                </p>
                <div className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-slate-800">
                  <CheckCircle2 className="h-4 w-4 text-[#0b4aa2]" />
                  {season.isActive ? "true" : "false"}
                </div>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-[22px] border border-slate-200/80 bg-slate-50 px-4 py-4">
              <div className="text-sm text-slate-600">
                {canDelete ? (
                  <span>
                    Diese Saison kann gelöscht werden, da sie <span className="font-semibold text-amber-700">In Planung</span> ist und noch keine Abhängigkeiten hat.
                  </span>
                ) : (
                  <span>
                    Löschen ist nur für <span className="font-semibold text-amber-700">In Planung</span> möglich und nur solange keine Teams oder Events verknüpft sind.
                  </span>
                )}
              </div>

              {canDelete ? (
                <form action={deletePlannedSeasonAction}>
                  <input type="hidden" name="seasonId" value={season.id} />
                  <button
                    type="submit"
                    className="inline-flex h-11 items-center gap-2 rounded-full border border-rose-200 bg-white px-4 text-sm font-medium text-rose-600 shadow-sm transition hover:-translate-y-[1px] hover:bg-rose-50"
                  >
                    <Trash2 className="h-4 w-4" />
                    Saison löschen
                  </button>
                </form>
              ) : (
                <button
                  type="button"
                  disabled
                  className="inline-flex h-11 items-center gap-2 rounded-full border border-slate-200 bg-slate-100 px-4 text-sm font-medium text-slate-400"
                >
                  <Trash2 className="h-4 w-4" />
                  Saison löschen
                </button>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
