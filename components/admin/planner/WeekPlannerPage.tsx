import Link from "next/link";
import { CalendarDays, ClipboardList, Plus } from "lucide-react";
import WochenplanBoard from "@/components/admin/wochenplan/WochenplanBoard";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import SeasonContextSelector from "@/components/admin/shared/SeasonContextSelector";
import { getWeekPlannerData } from "@/lib/planner/queries";
import { getWochenplanBoardData } from "@/lib/wochenplan/queries";
import type { WochenplanBoardDayKey } from "@/lib/wochenplan/types";

type WeekPlannerPageProps = {
  seasonKey?: string;
  week?: string;
};

function getVisibleDayKeys(start: Date, end: Date): WochenplanBoardDayKey[] {
  const keys: WochenplanBoardDayKey[] = [];
  const cursor = new Date(start);

  cursor.setHours(12, 0, 0, 0);

  while (cursor.getTime() <= end.getTime()) {
    const day = cursor.getDay();

    if (day === 1) keys.push("MONDAY");
    if (day === 2) keys.push("TUESDAY");
    if (day === 3) keys.push("WEDNESDAY");
    if (day === 4) keys.push("THURSDAY");
    if (day === 5) keys.push("FRIDAY");
    if (day === 6) keys.push("SATURDAY");
    if (day === 0) keys.push("SUNDAY");

    cursor.setDate(cursor.getDate() + 1);
  }

  return keys;
}

function getCurrentDayKey(weekOffset: number): WochenplanBoardDayKey | null {
  if (weekOffset !== 0) return null;

  const day = new Date().getDay();

  if (day === 1) return "MONDAY";
  if (day === 2) return "TUESDAY";
  if (day === 3) return "WEDNESDAY";
  if (day === 4) return "THURSDAY";
  if (day === 5) return "FRIDAY";
  if (day === 6) return "SATURDAY";
  if (day === 0) return "SUNDAY";

  return null;
}

function parseWeekOffset(week?: string) {
  if (!week) return 0;

  const numeric = Number(week);
  if (Number.isFinite(numeric)) {
    return Math.max(0, numeric);
  }

  return 0;
}

function withSeason(href: string, seasonKey: string) {
  if (!seasonKey) {
    return href;
  }

  const separator = href.includes("?") ? "&" : "?";
  return `${href}${separator}season=${encodeURIComponent(seasonKey)}`;
}

export default async function WeekPlannerPage({
  seasonKey,
  week,
}: WeekPlannerPageProps) {
  const weekOffset = parseWeekOffset(week);

  const [plannerData, boardData] = await Promise.all([
    getWeekPlannerData({
      selectedSeasonKey: seasonKey,
      weekId: null,
    }),
    getWochenplanBoardData({ weekOffset }),
  ]);

  const selectedSeasonKey = plannerData.selectedSeason?.key ?? "";
  const visibleDayKeys = getVisibleDayKeys(boardData.weekWindow.start, boardData.weekWindow.end);
  const currentDayKey = getCurrentDayKey(weekOffset);

  const previousHref =
    boardData.weekWindow.previousWeekOffset === null
      ? null
      : withSeason(
          `/dashboard/planner/week?week=${boardData.weekWindow.previousWeekOffset}`,
          selectedSeasonKey,
        );

  const nextHref = withSeason(
    `/dashboard/planner/week?week=${boardData.weekWindow.nextWeekOffset}`,
    selectedSeasonKey,
  );

  const currentHref = withSeason("/dashboard/planner/week?week=0", selectedSeasonKey);
  const yearlyHref = withSeason("/dashboard/planner", selectedSeasonKey);
  const dayHref = withSeason("/dashboard/planner/day", selectedSeasonKey);
  const reserveHref = withSeason("/dashboard/planner/reserve", selectedSeasonKey);

  return (
    <div className="space-y-8">
      <AdminSectionHeader
        eyebrow="Wochenplan"
        title="Website-Wochenraster"
        description="Operative Wochenplanung im gleichen Raster wie die Website. Du arbeitest hier direkt auf der später sichtbaren Wochenplan-Logik, ergänzt um Drag & Drop, Garderoben und Publikationssteuerung."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href={reserveHref} className="fca-button-primary">
              <Plus className="h-4 w-4" />
              Platz reservieren
            </Link>
            <Link href={yearlyHref} className="fca-button-secondary">
              <ClipboardList className="h-4 w-4" />
              Jahresplan
            </Link>
            <Link href={dayHref} className="fca-button-secondary">
              <CalendarDays className="h-4 w-4" />
              Tagesplan
            </Link>
          </div>
        }
      />

      <SeasonContextSelector
        title="Aktive Saison"
        description="Die Saison bleibt führend. Diese Wochenansicht zeigt den operativen Ausschnitt als Website-nahes Planungsraster."
        seasons={plannerData.seasons}
        selectedSeasonKey={selectedSeasonKey}
        basePath="/dashboard/planner/week"
      />

      <section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="fca-eyebrow">Kalenderwoche</p>
            <h3 className="mt-2 text-2xl font-black uppercase tracking-tight text-[#0b4aa2]">
              {boardData.weekWindow.label}
            </h3>
            <p className="mt-2 text-sm font-medium text-slate-600">
              Gleiche visuelle Logik wie die Website: Tage, Felder, Zeiten und Eventkarten.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {previousHref ? (
              <Link
                href={previousHref}
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                Vorherige Woche
              </Link>
            ) : null}

            {weekOffset > 0 ? (
              <Link
                href={currentHref}
                className="rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-[#0b4aa2] transition hover:bg-blue-100"
              >
                Aktuelle Woche
              </Link>
            ) : null}

            <Link
              href={nextHref}
              className="rounded-full bg-[#0b4aa2] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#08357a]"
            >
              Nächste Woche
            </Link>
          </div>
        </div>
      </section>

      <WochenplanBoard
        initialEvents={boardData.events}
        visibleDayKeys={visibleDayKeys}
        currentDayKey={currentDayKey}
      />
    </div>
  );
}
