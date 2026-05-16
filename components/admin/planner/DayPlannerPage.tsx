import Link from "next/link";
import {
  CalendarDays,
  MonitorSmartphone,
  Pencil,
  Plus,
} from "lucide-react";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import PlannerEntryPublicationBadges from "@/components/admin/planner/PlannerEntryPublicationBadges";
import PlannerEntryTypeBadge from "@/components/admin/planner/PlannerEntryTypeBadge";
import SeasonContextSelector from "@/components/admin/shared/SeasonContextSelector";
import { getDayPlannerData } from "@/lib/planner/queries";

type DayPlannerPageProps = {
  seasonKey?: string;
  day?: string;
};

function formatDayLabel(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);

  return new Intl.DateTimeFormat("de-CH", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function formatTime(value: Date) {
  return new Intl.DateTimeFormat("de-CH", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(value);
}

function buildEditHref(eventId: string, seasonKey: string, type: string) {
  const params = new URLSearchParams();

  if (seasonKey) {
    params.set("season", seasonKey);
  }

  if (type) {
    params.set("type", type);
  }

  const query = params.toString();
  return query
    ? `/dashboard/planner/edit/${eventId}?${query}`
    : `/dashboard/planner/edit/${eventId}`;
}

export default async function DayPlannerPage({
  seasonKey,
  day,
}: DayPlannerPageProps) {
  const data = await getDayPlannerData({
    selectedSeasonKey: seasonKey,
    day,
  });

  const selectedSeasonKey = data.selectedSeason?.key ?? "";

  const weekHref = selectedSeasonKey
    ? `/dashboard/planner/week?season=${encodeURIComponent(selectedSeasonKey)}`
    : "/dashboard/planner/week";

  const newEntryHref = selectedSeasonKey
    ? `/dashboard/planner/new?season=${encodeURIComponent(selectedSeasonKey)}`
    : "/dashboard/planner/new";

  return (
    <div className="space-y-8">
      <AdminSectionHeader
        eyebrow="Tagesplanner"
        title="Tagesagenda"
        description="Operative Tagesplanung für den Live-Betrieb. Diese Sicht speist das Infoboard direkt."
      />

      <SeasonContextSelector
        title="Aktive Saison"
        description="Auch die Tagesagenda bleibt saisongeführt und bricht aus dem Saisonplanner bis auf den einzelnen Tag herunter."
        seasons={data.seasons}
        selectedSeasonKey={selectedSeasonKey}
        basePath="/dashboard/planner/day"
      />

      <section className="rounded-[30px] border border-slate-200/80 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              Aktiver Tag
            </p>
            <h3 className="mt-2 text-[1.15rem] font-semibold text-slate-900">
              {formatDayLabel(data.day.day)}
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              Live-Ansicht für Infoboard, Tagesbetrieb und kurzfristige Änderungen.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href={
                selectedSeasonKey
                  ? `/dashboard/planner/day?season=${encodeURIComponent(selectedSeasonKey)}&day=${encodeURIComponent(data.day.previousDay)}`
                  : `/dashboard/planner/day?day=${encodeURIComponent(data.day.previousDay)}`
              }
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
            >
              {data.day.previousDay}
            </Link>

            <span className="rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-[#0b4aa2]">
              {data.day.day}
            </span>

            <Link
              href={
                selectedSeasonKey
                  ? `/dashboard/planner/day?season=${encodeURIComponent(selectedSeasonKey)}&day=${encodeURIComponent(data.day.nextDay)}`
                  : `/dashboard/planner/day?day=${encodeURIComponent(data.day.nextDay)}`
              }
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
            >
              {data.day.nextDay}
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.8fr)_360px]">
        <article className="rounded-[28px] border border-slate-200/80 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-[1.05rem] font-semibold text-slate-900">
              Tagesablauf
            </h3>
            <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-[#0b4aa2]">
              Infoboard live
            </span>
          </div>

          <div className="mt-4 space-y-3">
            {data.entries.length === 0 ? (
              <div className="rounded-[20px] border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                Keine Planner-Einträge für diesen Tag.
              </div>
            ) : (
              data.entries.map((entry) => (
                <div
                  key={entry.id}
                  className="rounded-[20px] border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-slate-900">
                          {formatTime(entry.startAt)} · {entry.title}
                        </p>
                        <PlannerEntryTypeBadge type={entry.type} label={entry.typeLabel} />
                      </div>

                      <p className="mt-2 text-sm text-slate-600">
                        {entry.location ? `${entry.location}` : "Ohne Ort"}
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
                      href={buildEditHref(entry.id, selectedSeasonKey, entry.type)}
                      className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Bearbeiten
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </article>

        <div className="space-y-5">
          <article className="rounded-[28px] border border-slate-200/80 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
            <h3 className="text-[1.05rem] font-semibold text-slate-900">
              Live Feed
            </h3>

            <div className="mt-4 space-y-3">
              <div className="flex items-center gap-3 rounded-[20px] border border-slate-200 bg-slate-50 p-4">
                <MonitorSmartphone className="h-4 w-4 text-[#0b4aa2]" />
                <p className="text-sm text-slate-700">Infoboard Tagesfeed live</p>
              </div>

              <div className="flex items-center gap-3 rounded-[20px] border border-slate-200 bg-slate-50 p-4">
                <CalendarDays className="h-4 w-4 text-[#0b4aa2]" />
                <p className="text-sm text-slate-700">Kurzfristige Tagesänderungen sichtbar</p>
              </div>
            </div>
          </article>

          <article className="rounded-[28px] border border-slate-200/80 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
            <h3 className="text-[1.05rem] font-semibold text-slate-900">
              Aktionen
            </h3>

            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href={newEntryHref}
                className="inline-flex items-center gap-2 rounded-full bg-[#0b4aa2] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#08357a]"
              >
                <Plus className="h-4 w-4" />
                Neuer Eintrag
              </Link>

              <Link
                href={weekHref}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                <CalendarDays className="h-4 w-4" />
                Zur Wochenagenda
              </Link>
            </div>
          </article>
        </div>
      </section>
    </div>
  );
}
