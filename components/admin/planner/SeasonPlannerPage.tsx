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
    description: "Matchagenda pro Saison mit manuellen Einträgen und FVNWS API als Zubringer.",
    icon: Volleyball,
    accent: "border-blue-200 bg-blue-50 text-blue-700",
  },
  {
    key: "tournaments",
    title: "Turniere",
    description: "Turnieragenda pro Saison mit manuellen Einträgen und FVNWS API als Zubringer.",
    icon: Trophy,
    accent: "border-amber-200 bg-amber-50 text-amber-700",
  },
  {
    key: "otherEvents",
    title: "Weitere Events",
    description: "Weitere Vereinsanlässe wie Lager, Apéros, Versammlungen oder Reisen.",
    icon: Flag,
    accent: "border-slate-200 bg-slate-100 text-slate-700",
  },
  {
    key: "vacationPeriods",
    title: "Ferienperioden",
    description: "Saisonrelevante Ferienblöcke, später optional auch mit lokaler Gemeinde-API.",
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

function getMonthKey(value: Date) {
  return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, "0")}`;
}

function formatMonthTitle(value: Date) {
  return new Intl.DateTimeFormat("de-CH", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(value);
}

function formatShortDate(value: Date) {
  return new Intl.DateTimeFormat("de-CH", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "UTC",
  }).format(value);
}

function buildSeasonMonths(startDate?: Date | null, endDate?: Date | null) {
  const start = startDate ? new Date(startDate) : new Date();
  const end = endDate ? new Date(endDate) : new Date(start.getTime());

  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  const limit = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));
  const months: Date[] = [];

  while (cursor.getTime() <= limit.getTime()) {
    months.push(new Date(cursor.getTime()));
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }

  return months;
}

function getIsoWeekHref(date: Date, selectedSeasonKey: string) {
  const copy = new Date(date.getTime());
  const day = copy.getUTCDay() || 7;
  copy.setUTCDate(copy.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(copy.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((copy.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  const weekId = `${copy.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
  const params = new URLSearchParams();

  if (selectedSeasonKey) params.set("season", selectedSeasonKey);
  params.set("week", weekId);

  return `/dashboard/planner/week?${params.toString()}`;
}

function getDayHref(date: Date, selectedSeasonKey: string) {
  const params = new URLSearchParams();
  const isoDay = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;

  if (selectedSeasonKey) params.set("season", selectedSeasonKey);
  params.set("day", isoDay);

  return `/dashboard/planner/day?${params.toString()}`;
}

function getFeedback(status?: string) {
  switch (status) {
    case "create-success":
      return { className: "border-emerald-200 bg-emerald-50 text-emerald-800", text: "Planner-Eintrag wurde erfolgreich erstellt." };
    case "update-success":
      return { className: "border-emerald-200 bg-emerald-50 text-emerald-800", text: "Planner-Eintrag wurde erfolgreich aktualisiert." };
    case "delete-success":
      return { className: "border-emerald-200 bg-emerald-50 text-emerald-800", text: "Planner-Eintrag wurde erfolgreich gelöscht." };
    case "forbidden":
      return { className: "border-rose-200 bg-rose-50 text-rose-800", text: "Du hast keine Berechtigung für Planner-Einträge." };
    default:
      return null;
  }
}

export default async function SeasonPlannerPage({ seasonKey, status }: SeasonPlannerPageProps) {
  const data = await getSeasonPlannerData(seasonKey);
  const selectedSeasonKey = data.selectedSeason?.key ?? "";
  const feedback = getFeedback(status);

  const weekHref = selectedSeasonKey ? `/dashboard/planner/week?season=${encodeURIComponent(selectedSeasonKey)}` : "/dashboard/planner/week";
  const dayHref = selectedSeasonKey ? `/dashboard/planner/day?season=${encodeURIComponent(selectedSeasonKey)}` : "/dashboard/planner/day";
  const newEntryHref = selectedSeasonKey ? `/dashboard/planner/new?season=${encodeURIComponent(selectedSeasonKey)}` : "/dashboard/planner/new";
  const reserveHref = selectedSeasonKey ? `/dashboard/planner/reserve?season=${encodeURIComponent(selectedSeasonKey)}` : "/dashboard/planner/reserve";

  const seasonMonths = buildSeasonMonths(data.selectedSeason?.startDate, data.selectedSeason?.endDate);
  const entriesByMonth = new Map<string, typeof data.entries>();

  for (const month of seasonMonths) entriesByMonth.set(getMonthKey(month), []);
  for (const entry of data.entries) {
    const key = getMonthKey(entry.startAt);
    entriesByMonth.set(key, [...(entriesByMonth.get(key) ?? []), entry]);
  }

  return (
    <div className="space-y-8">
      {feedback ? (
        <section className={`rounded-[24px] border px-5 py-4 text-sm font-medium ${feedback.className}`}>
          {feedback.text}
        </section>
      ) : null}

      <AdminSectionHeader
        eyebrow="Jahresplan"
        title="Agenda Manager"
        description="Premium-Jahresplanung als langfristiger Einstiegspunkt. Von hier drillst du in Monat, Woche oder Tag und planst wiederkehrende Events oder Platzreservationen."
      />

      <SeasonContextSelector
        title="Aktive Saison"
        description="Die gewählte Saison führt die Agenda und speist Wochenplan, Tagesplan, Website und Infoboard aus derselben Datenbasis."
        seasons={data.seasons}
        selectedSeasonKey={selectedSeasonKey}
        basePath="/dashboard/planner"
      />

      <section className="grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
        <article className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-sm">
          <div className="h-1.5 bg-gradient-to-r from-orange-400 via-red-500 to-[#0b4aa2]" />
          <div className="p-6">
            <p className="fca-eyebrow">Saison Cockpit</p>
            <h2 className="mt-2 text-3xl font-black uppercase tracking-tight text-[#0b4aa2]">
              Langfristig planen, operativ ausführen
            </h2>
            <p className="mt-3 max-w-3xl text-sm font-medium leading-6 text-slate-600">
              Jahresplan bleibt die Agenda für Koordinatoren und Leitung. Wochenplan und Tagesplan bleiben unverändert
              und zeigen automatisch die Events, sobald deren Zeitraum erreicht wird.
            </p>

            <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <Link href={reserveHref} className="rounded-[24px] border border-red-200 bg-red-50 p-4 text-red-700 transition hover:-translate-y-0.5 hover:shadow-md">
                <Plus className="h-5 w-5" />
                <p className="mt-3 text-sm font-black uppercase tracking-[0.14em]">Platz reservieren</p>
                <p className="mt-2 text-sm font-medium text-red-700/75">Event, Feld und Garderoben</p>
              </Link>

              <Link href={newEntryHref} className="rounded-[24px] border border-blue-200 bg-blue-50 p-4 text-[#0b4aa2] transition hover:-translate-y-0.5 hover:shadow-md">
                <CalendarDays className="h-5 w-5" />
                <p className="mt-3 text-sm font-black uppercase tracking-[0.14em]">Agenda-Eintrag</p>
                <p className="mt-2 text-sm font-medium text-blue-700/75">Training, Turnier, Ferien</p>
              </Link>

              <Link href={weekHref} className="rounded-[24px] border border-slate-200 bg-white p-4 text-slate-700 transition hover:-translate-y-0.5 hover:shadow-md">
                <ClipboardList className="h-5 w-5" />
                <p className="mt-3 text-sm font-black uppercase tracking-[0.14em]">Woche öffnen</p>
                <p className="mt-2 text-sm font-medium text-slate-500">Operative Planung</p>
              </Link>

              <Link href={dayHref} className="rounded-[24px] border border-slate-200 bg-white p-4 text-slate-700 transition hover:-translate-y-0.5 hover:shadow-md">
                <ClipboardList className="h-5 w-5" />
                <p className="mt-3 text-sm font-black uppercase tracking-[0.14em]">Tag öffnen</p>
                <p className="mt-2 text-sm font-medium text-slate-500">Matchday / Infoboard</p>
              </Link>
            </div>
          </div>
        </article>

        <article className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
          <p className="fca-eyebrow">Schnellsprung</p>
          <h3 className="mt-2 text-xl font-black uppercase text-[#0b4aa2]">Monate</h3>
          <div className="mt-5 grid grid-cols-2 gap-2">
            {seasonMonths.map((month) => (
              <a key={getMonthKey(month)} href={`#month-${getMonthKey(month)}`} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold capitalize text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-[#0b4aa2]">
                {formatMonthTitle(month)}
              </a>
            ))}
          </div>
        </article>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        {MODULE_META.map((item) => {
          const Icon = item.icon;
          const count = data.counts[item.key];

          return (
            <article key={item.key} className="rounded-[28px] border border-slate-200/80 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-[#0b4aa2]">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-[1.05rem] font-semibold text-slate-900">{item.title}</h3>
                    <p className="mt-2 text-sm text-slate-500">{item.description}</p>
                  </div>
                </div>
                <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${item.accent}`}>
                  {count} Einträge
                </span>
              </div>
            </article>
          );
        })}
      </section>

      <section className="rounded-[32px] border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-6 py-5">
          <p className="fca-eyebrow">Agenda</p>
          <h2 className="mt-2 text-2xl font-black uppercase tracking-tight text-[#0b4aa2]">
            Saison nach Monaten
          </h2>
          <p className="mt-2 text-sm font-medium text-slate-500">
            Drill-down: Monat → Woche → Tag. Wochenplan und Tagesplan bleiben die operativen Detailansichten.
          </p>
        </div>

        <div className="divide-y divide-slate-100">
          {seasonMonths.map((month) => {
            const key = getMonthKey(month);
            const monthEntries = entriesByMonth.get(key) ?? [];

            return (
              <div key={key} id={`month-${key}`} className="grid gap-5 px-6 py-6 xl:grid-cols-[220px_1fr]">
                <div>
                  <p className="text-lg font-black capitalize text-[#0b4aa2]">{formatMonthTitle(month)}</p>
                  <p className="mt-2 text-sm font-medium text-slate-400">{monthEntries.length} Einträge</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link href={getIsoWeekHref(month, selectedSeasonKey)} className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50">
                      Woche öffnen
                    </Link>
                    <Link href={getDayHref(month, selectedSeasonKey)} className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50">
                      Tag öffnen
                    </Link>
                  </div>
                </div>

                <div className="space-y-3">
                  {monthEntries.length === 0 ? (
                    <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50 px-5 py-4 text-sm font-medium text-slate-400">
                      Noch keine Einträge in diesem Monat.
                    </div>
                  ) : (
                    monthEntries.map((entry) => (
                      <div key={entry.id} className="rounded-[24px] border border-slate-200 bg-slate-50 p-4 transition hover:border-blue-200 hover:bg-white hover:shadow-sm">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <PlannerEntryTypeBadge type={entry.type} label={entry.typeLabel} />
                              <p className="text-sm font-black text-slate-950">{entry.title}</p>
                            </div>
                            <p className="mt-2 text-sm font-medium text-slate-600">
                              {formatShortDate(entry.startAt)} · {formatSwissDateTime(entry.startAt)}
                              {entry.location ? ` · ${entry.location}` : ""}
                              {entry.teamName ? ` · ${entry.teamName}` : ""}
                            </p>
                            <div className="mt-3 flex flex-wrap items-center gap-2">
                              <PlannerEntryPublicationBadges
                                websiteVisible={entry.websiteVisible}
                                infoboardVisible={entry.infoboardVisible}
                                wochenplanVisible={entry.wochenplanVisible}
                              />
                            </div>
                          </div>

                          <Link href={selectedSeasonKey ? `/dashboard/planner/edit/${entry.id}?season=${encodeURIComponent(selectedSeasonKey)}` : `/dashboard/planner/edit/${entry.id}`} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50">
                            <Pencil className="h-3.5 w-3.5" />
                            Bearbeiten
                          </Link>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
