import Link from "next/link";
import {
  CalendarDays,
  Globe,
  Pencil,
  Plus,
  Smartphone,
} from "lucide-react";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import PlannerEntryPublicationBadges from "@/components/admin/planner/PlannerEntryPublicationBadges";
import PlannerEntryTypeBadge from "@/components/admin/planner/PlannerEntryTypeBadge";
import SeasonContextSelector from "@/components/admin/shared/SeasonContextSelector";
import { getWeekPlannerData } from "@/lib/planner/queries";

type WeekPlannerPageProps = {
  seasonKey?: string;
  week?: string;
};

function formatWeekDate(value: Date) {
  return new Intl.DateTimeFormat("de-CH", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    timeZone: "UTC",
  }).format(value);
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

export default async function WeekPlannerPage({
  seasonKey,
  week,
}: WeekPlannerPageProps) {
  const data = await getWeekPlannerData({
    selectedSeasonKey: seasonKey,
    weekId: week,
  });

  const selectedSeasonKey = data.selectedSeason?.key ?? "";

  const dayHref = selectedSeasonKey
    ? `/dashboard/planner/day?season=${encodeURIComponent(selectedSeasonKey)}`
    : "/dashboard/planner/day";

  const newEntryHref = selectedSeasonKey
    ? `/dashboard/planner/new?season=${encodeURIComponent(selectedSeasonKey)}`
    : "/dashboard/planner/new";

  const groupedDays = Array.from({ length: 7 }).map((_, index) => {
    const dayDate = new Date(data.week.start.getTime());
    dayDate.setUTCDate(dayDate.getUTCDate() + index);

    const dayEntries = data.entries.filter((entry) => {
      const a = entry.startAt;
      return (
        a.getUTCFullYear() === dayDate.getUTCFullYear() &&
        a.getUTCMonth() === dayDate.getUTCMonth() &&
        a.getUTCDate() === dayDate.getUTCDate()
      );
    });

    return {
      dayDate,
      entries: dayEntries,
    };
  });

  return (
    <div className="space-y-8">
      <AdminSectionHeader
        eyebrow="Wochenplanner"
        title="Wochenagenda"
        description="Operative Wochenplanung pro Kalenderwoche. Diese Sicht wird live auf Website und später Mobile App ausgespielt."
      />

      <SeasonContextSelector
        title="Aktive Saison"
        description="Die Saison bleibt führend, während die Wochenansicht operativ pro Kalenderwoche herunterbricht."
        seasons={data.seasons}
        selectedSeasonKey={selectedSeasonKey}
        basePath="/dashboard/planner/week"
      />

      <section className="rounded-[30px] border border-slate-200/80 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              Kalenderwoche
            </p>
            <h3 className="mt-2 text-[1.15rem] font-semibold text-slate-900">
              {data.week.weekId}
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              Wochenansicht für operative Publikation auf Website und später Mobile App.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href={
                selectedSeasonKey
                  ? `/dashboard/planner/week?season=${encodeURIComponent(selectedSeasonKey)}&week=${encodeURIComponent(data.week.previousWeekId)}`
                  : `/dashboard/planner/week?week=${encodeURIComponent(data.week.previousWeekId)}`
              }
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
            >
              {data.week.previousWeekId}
            </Link>

            <span className="rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-[#0b4aa2]">
              {data.week.weekId}
            </span>

            <Link
              href={
                selectedSeasonKey
                  ? `/dashboard/planner/week?season=${encodeURIComponent(selectedSeasonKey)}&week=${encodeURIComponent(data.week.nextWeekId)}`
                  : `/dashboard/planner/week?week=${encodeURIComponent(data.week.nextWeekId)}`
              }
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
            >
              {data.week.nextWeekId}
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.8fr)_360px]">
        <div className="space-y-5">
          {groupedDays.map((block) => (
            <article
              key={block.dayDate.toISOString()}
              className="rounded-[28px] border border-slate-200/80 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.04)]"
            >
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-[1.05rem] font-semibold text-slate-900">
                  {formatWeekDate(block.dayDate)}
                </h3>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                  {block.entries.length} Einträge
                </span>
              </div>

              <div className="mt-4 space-y-3">
                {block.entries.length === 0 ? (
                  <div className="rounded-[20px] border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                    Keine Planner-Einträge für diesen Tag.
                  </div>
                ) : (
                  block.entries.map((entry) => (
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
          ))}
        </div>

        <div className="space-y-5">
          <article className="rounded-[28px] border border-slate-200/80 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
            <h3 className="text-[1.05rem] font-semibold text-slate-900">
              Live-Ausspielung
            </h3>

            <div className="mt-4 space-y-3">
              <div className="flex items-center gap-3 rounded-[20px] border border-slate-200 bg-slate-50 p-4">
                <Globe className="h-4 w-4 text-[#0b4aa2]" />
                <p className="text-sm text-slate-700">Website Wochenansicht live</p>
              </div>

              <div className="flex items-center gap-3 rounded-[20px] border border-slate-200 bg-slate-50 p-4">
                <Smartphone className="h-4 w-4 text-[#0b4aa2]" />
                <p className="text-sm text-slate-700">Später Mobile App Wochenansicht</p>
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
                href={dayHref}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                <CalendarDays className="h-4 w-4" />
                Zur Tagesagenda
              </Link>
            </div>
          </article>
        </div>
      </section>
    </div>
  );
}
