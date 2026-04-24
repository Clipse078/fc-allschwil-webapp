import Link from "next/link";
import WochenplanBoard from "@/components/admin/wochenplan/WochenplanBoard";
import { requirePermission } from "@/lib/permissions/require-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getWochenplanBoardData } from "@/lib/wochenplan/queries";
import type { WochenplanBoardDayKey } from "@/lib/wochenplan/types";

type WochenplanPageProps = {
  searchParams?: Promise<{
    week?: string;
  }>;
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

export default async function WochenplanPage({ searchParams }: WochenplanPageProps) {
  await requirePermission(PERMISSIONS.WOCHENPLAN_MANAGE);

  const params = (await searchParams) ?? {};
  const weekOffset = Math.max(0, Number(params.week ?? 0) || 0);
  const { events, weekWindow } = await getWochenplanBoardData({ weekOffset });
  const visibleDayKeys = getVisibleDayKeys(weekWindow.start, weekWindow.end);
  const currentDayKey = getCurrentDayKey(weekOffset);

  const previousHref =
    weekWindow.previousWeekOffset === null
      ? null
      : `/dashboard/wochenplan?week=${weekWindow.previousWeekOffset}`;
  const nextHref = `/dashboard/wochenplan?week=${weekWindow.nextWeekOffset}`;

  return (
    <div className="space-y-8">
      <section>
        <p className="fca-eyebrow">Wochenplan</p>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h1 className="fca-heading">Feld-/Garderobenplanung</h1>

          <span className="inline-flex items-center rounded-full border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 shadow-sm">
            {weekWindow.weekOffset === 0
              ? "Aktuelle Woche · heute bis Sonntag"
              : "Woche · Montag bis Sonntag"}
          </span>

          <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm">
            {weekWindow.label}
          </span>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          {previousHref ? (
            <Link
              href={previousHref}
              className="inline-flex h-11 items-center rounded-full border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              Vorherige Woche
            </Link>
          ) : null}

          {weekWindow.weekOffset > 0 ? (
            <Link
              href="/dashboard/wochenplan?week=0"
              className="inline-flex h-11 items-center rounded-full border border-blue-200 bg-blue-50 px-5 text-sm font-semibold text-[#0b4aa2] shadow-sm transition hover:bg-blue-100"
            >
              Zur aktuellen Woche
            </Link>
          ) : null}

          <Link
            href={nextHref}
            className="inline-flex h-11 items-center rounded-full bg-[#0b4aa2] px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#08357a]"
          >
            Nächste Woche
          </Link>
        </div>
      </section>

      <WochenplanBoard
        initialEvents={events}
        visibleDayKeys={visibleDayKeys}
        currentDayKey={currentDayKey}
      />
    </div>
  );
}
