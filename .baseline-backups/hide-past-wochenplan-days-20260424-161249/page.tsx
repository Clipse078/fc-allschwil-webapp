import Link from "next/link";
import WochenplanBoard from "@/components/admin/wochenplan/WochenplanBoard";
import { requirePermission } from "@/lib/permissions/require-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getWochenplanBoardData } from "@/lib/wochenplan/queries";

type WochenplanPageProps = {
  searchParams?: Promise<{
    week?: string;
  }>;
};

export default async function WochenplanPage({ searchParams }: WochenplanPageProps) {
  await requirePermission(PERMISSIONS.WOCHENPLAN_MANAGE);

  const params = (await searchParams) ?? {};
  const weekOffset = Math.max(0, Number(params.week ?? 0) || 0);
  const { events, weekWindow } = await getWochenplanBoardData({ weekOffset });

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

          <Link
            href={nextHref}
            className="inline-flex h-11 items-center rounded-full bg-[#0b4aa2] px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#08357a]"
          >
            Nächste Woche
          </Link>
        </div>
      </section>

      <WochenplanBoard initialEvents={events} />
    </div>
  );
}
