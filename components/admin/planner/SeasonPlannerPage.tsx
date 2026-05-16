import Link from "next/link";
import {
  CalendarDays,
  ClipboardList,
  Dumbbell,
  Flag,
  Pencil,
  Plane,
  Plus,
  Trophy,
  Volleyball,
} from "lucide-react";
import PlannerEntryPublicationBadges from "@/components/admin/planner/PlannerEntryPublicationBadges";
import PlannerEntryTypeBadge from "@/components/admin/planner/PlannerEntryTypeBadge";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import SeasonContextSelector from "@/components/admin/shared/SeasonContextSelector";
import { getSeasonPlannerData } from "@/lib/planner/queries";

const MODULE_META = [
  {
    key: "trainings",
    title: "Trainings",
    description: "Manuelle Trainingsplanung über die ganze Saison.",
    icon: Dumbbell,
    accent: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  {
    key: "matches",
    title: "Matches",
    description:
      "Matchagenda pro Saison mit manuellen Einträgen und FVNWS API als Zubringer.",
    icon: Volleyball,
    accent: "border-blue-200 bg-blue-50 text-blue-700",
  },
  {
    key: "tournaments",
    title: "Turniere",
    description:
      "Turnieragenda pro Saison mit manuellen Einträgen und FVNWS API als Zubringer.",
    icon: Trophy,
    accent: "border-amber-200 bg-amber-50 text-amber-700",
  },
  {
    key: "otherEvents",
    title: "Weitere Events",
    description:
      "Weitere Vereinsanlässe wie Lager, Apéros, Versammlungen oder Reisen.",
    icon: Flag,
    accent: "border-slate-200 bg-slate-100 text-slate-700",
  },
  {
    key: "vacationPeriods",
    title: "Ferienperioden",
    description:
      "Saisonrelevante Ferienblöcke, später optional auch mit lokaler Gemeinde-API.",
    icon: Plane,
    accent: "border-rose-200 bg-rose-50 text-rose-700",
  },
] as const;

type SeasonPlannerPageProps = {
  seasonKey?: string;
  status?: string;
};

function formatSwissDateTime(value: Date) {
  return new Intl.DateTimeFormat("de-CH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(value);
}

function getFeedback(status?: string) {
  switch (status) {
    case "create-success":
      return {
        className: "border-emerald-200 bg-emerald-50 text-emerald-800",
        text: "Planner-Eintrag wurde erfolgreich erstellt.",
      };
    case "update-success":
      return {
        className: "border-emerald-200 bg-emerald-50 text-emerald-800",
        text: "Planner-Eintrag wurde erfolgreich aktualisiert.",
      };
    case "delete-success":
      return {
        className: "border-emerald-200 bg-emerald-50 text-emerald-800",
        text: "Planner-Eintrag wurde erfolgreich gelöscht.",
      };
    case "create-missing-fields":
    case "update-missing-fields":
      return {
        className: "border-rose-200 bg-rose-50 text-rose-800",
        text: "Bitte fülle alle Pflichtfelder für den Planner-Eintrag aus.",
      };
    case "create-invalid-type":
    case "update-invalid-type":
      return {
        className: "border-rose-200 bg-rose-50 text-rose-800",
        text: "Der gewählte Planner-Typ ist ungültig.",
      };
    case "create-invalid-source":
    case "update-invalid-source":
      return {
        className: "border-rose-200 bg-rose-50 text-rose-800",
        text: "Die gewählte Quelle ist ungültig.",
      };
    case "create-invalid-date-range":
    case "update-invalid-date-range":
      return {
        className: "border-rose-200 bg-rose-50 text-rose-800",
        text: "Das Ende darf nicht vor dem Start liegen.",
      };
    case "create-invalid-season":
    case "update-invalid-season":
      return {
        className: "border-rose-200 bg-rose-50 text-rose-800",
        text: "Die gewählte Saison ist ungültig.",
      };
    case "create-invalid-team":
    case "update-invalid-team":
      return {
        className: "border-rose-200 bg-rose-50 text-rose-800",
        text: "Das gewählte Team ist ungültig.",
      };
    case "update-invalid-event":
      return {
        className: "border-rose-200 bg-rose-50 text-rose-800",
        text: "Der zu bearbeitende Planner-Eintrag wurde nicht gefunden.",
      };
    case "delete-invalid-event":
      return {
        className: "border-rose-200 bg-rose-50 text-rose-800",
        text: "Der zu löschende Planner-Eintrag wurde nicht gefunden.",
      };
    case "forbidden":
      return {
        className: "border-rose-200 bg-rose-50 text-rose-800",
        text: "Du hast keine Berechtigung für Planner-Einträge.",
      };
    default:
      return null;
  }
}

export default async function SeasonPlannerPage({
  seasonKey,
  status,
}: SeasonPlannerPageProps) {
  const data = await getSeasonPlannerData(seasonKey);
  const selectedSeasonKey = data.selectedSeason?.key ?? "";
  const feedback = getFeedback(status);

  const weekHref = selectedSeasonKey
    ? `/dashboard/planner/week?season=${encodeURIComponent(selectedSeasonKey)}`
    : "/dashboard/planner/week";

  const dayHref = selectedSeasonKey
    ? `/dashboard/planner/day?season=${encodeURIComponent(selectedSeasonKey)}`
    : "/dashboard/planner/day";

  const newEntryHref = selectedSeasonKey
    ? `/dashboard/planner/new?season=${encodeURIComponent(selectedSeasonKey)}`
    : "/dashboard/planner/new";

  return (
    <div className="space-y-8">
      {feedback ? (
        <section
          className={`rounded-[24px] border px-5 py-4 text-sm font-medium ${feedback.className}`}
        >
          {feedback.text}
        </section>
      ) : null}

      <AdminSectionHeader
        eyebrow="Saisonplanner"
        title="Saisonagenda"
        description="Führende Saisonplanung mit Trainings, Matches, Turnieren, weiteren Events und Ferienperioden."
      />

      <SeasonContextSelector
        title="Aktive Saison"
        description="Die gewählte Saison führt die gesamte Saisonagenda und bildet die Grundlage für Wochen- und Tagesplanner."
        seasons={data.seasons}
        selectedSeasonKey={selectedSeasonKey}
        basePath="/dashboard/planner"
      />

      <section className="grid gap-5 xl:grid-cols-3">
        <article className="rounded-[28px] border border-slate-200/80 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
          <p className="fca-eyebrow">Flow</p>
          <h3 className="mt-2 text-[1.05rem] font-semibold text-slate-900">
            Planner-Hierarchie
          </h3>
          <div className="mt-4 space-y-3 text-sm text-slate-600">
            <p>Saisonplanner = führende Jahresagenda</p>
            <p>Wochenplanner = operative Wochenansicht</p>
            <p>Tagesplanner = operative Tagesansicht für Infoboard</p>
          </div>
        </article>

        <article className="rounded-[28px] border border-slate-200/80 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
          <p className="fca-eyebrow">Publikation</p>
          <h3 className="mt-2 text-[1.05rem] font-semibold text-slate-900">
            Ausspielung
          </h3>
          <div className="mt-4 space-y-3 text-sm text-slate-600">
            <p>Wochenplanner → Website live</p>
            <p>Wochenplanner → später Mobile App</p>
            <p>Tagesplanner → Infoboard live</p>
          </div>
        </article>

        <article className="rounded-[28px] border border-slate-200/80 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
          <p className="fca-eyebrow">Aktion</p>
          <h3 className="mt-2 text-[1.05rem] font-semibold text-slate-900">
            Neuer Eintrag
          </h3>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href={newEntryHref}
              className="inline-flex items-center gap-2 rounded-full bg-[#0b4aa2] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#08357a]"
            >
              <Plus className="h-4 w-4" />
              Planner-Eintrag erstellen
            </Link>

            <Link
              href={weekHref}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              <CalendarDays className="h-4 w-4" />
              Wochenplanner öffnen
            </Link>

            <Link
              href={dayHref}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              <ClipboardList className="h-4 w-4" />
              Tagesplanner öffnen
            </Link>
          </div>
        </article>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        {MODULE_META.map((item) => {
          const Icon = item.icon;
          const count = data.counts[item.key];

          return (
            <article
              key={item.key}
              className="rounded-[28px] border border-slate-200/80 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.04)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-[#0b4aa2]">
                    <Icon className="h-5 w-5" />
                  </div>

                  <div>
                    <h3 className="text-[1.05rem] font-semibold text-slate-900">
                      {item.title}
                    </h3>
                    <p className="mt-2 text-sm text-slate-500">
                      {item.description}
                    </p>
                  </div>
                </div>

                <span
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${item.accent}`}
                >
                  {count} Einträge
                </span>
              </div>
            </article>
          );
        })}
      </section>

      <section className="rounded-[28px] border border-slate-200/80 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="fca-eyebrow">Live Daten</p>
            <h3 className="mt-2 text-[1.05rem] font-semibold text-slate-900">
              Letzte Saison-Einträge
            </h3>
          </div>

          <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
            {data.latestEntries.length} sichtbar
          </span>
        </div>

        <div className="mt-4 space-y-3">
          {data.latestEntries.length === 0 ? (
            <div className="rounded-[20px] border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
              Für diese Saison existieren aktuell noch keine Planner-Einträge.
            </div>
          ) : (
            data.latestEntries.map((entry) => (
              <div
                key={entry.id}
                className="rounded-[20px] border border-slate-200 bg-slate-50 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-slate-900">
                        {entry.title}
                      </p>
                      <PlannerEntryTypeBadge
                        type={entry.type}
                        label={entry.typeLabel}
                      />
                    </div>

                    <p className="mt-2 text-sm text-slate-600">
                      {formatSwissDateTime(entry.startAt)}
                      {entry.location ? ` · ${entry.location}` : ""}
                      {entry.teamName ? ` · ${entry.teamName}` : ""}
                    </p>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold text-slate-600">
                        {entry.sourceLabel}
                      </span>
                      <PlannerEntryPublicationBadges
                        websiteVisible={entry.websiteVisible}
                        infoboardVisible={entry.infoboardVisible}
                        wochenplanVisible={entry.wochenplanVisible}
                      />
                    </div>
                  </div>

                  <Link
                    href={
                      selectedSeasonKey
                        ? `/dashboard/planner/edit/${entry.id}?season=${encodeURIComponent(selectedSeasonKey)}`
                        : `/dashboard/planner/edit/${entry.id}`
                    }
                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Bearbeiten
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
