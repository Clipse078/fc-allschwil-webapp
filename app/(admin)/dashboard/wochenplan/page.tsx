import Link from "next/link";
import { ChevronLeft, ChevronRight, CalendarDays, AlertCircle } from "lucide-react";
import WochenplanBoard from "@/components/admin/wochenplan/WochenplanBoard";
import { requirePermission } from "@/lib/permissions/require-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getWochenplanBoardData } from "@/lib/wochenplan/queries";
import { getWeekWindow, getIsoWeekNumber, startOfIsoWeek } from "@/lib/planner/date-utils";
import { getWochenplanPitchRowLabels } from "@/lib/facilities/queries";
import { getWochenplanPublication } from "@/lib/wochenplan/publication-queries";
import type { WochenplanBoardPitchRowKey } from "@/lib/wochenplan/types";

type PageProps = {
  searchParams: Promise<{ week?: string }>;
};

export default async function WochenplanPage({ searchParams }: PageProps) {
  const session = await requirePermission(PERMISSIONS.WOCHENPLAN_MANAGE);
  const tenantId = session?.user?.tenantId ?? null;

  const { week } = await searchParams;
  const { weekId, start, end, previousWeekId, nextWeekId } = getWeekWindow(week);

  // Load real events + active publication in parallel (scoped to actor's tenant)
  const [boardData, publication] = await Promise.all([
    getWochenplanBoardData(start, end, weekId, tenantId),
    tenantId ? getWochenplanPublication(tenantId, weekId) : Promise.resolve(null),
  ]);

  // Resolve pitch row labels via the canonical facility/resource display helper.
  const defaultPitchRows: Array<{ key: WochenplanBoardPitchRowKey; label: string }> = [
    { key: "STADION", label: "Stadion" },
    { key: "KUNSTRASEN_2", label: "KR 2" },
    { key: "KUNSTRASEN_3", label: "KR 3" },
  ];
  const pitchRows = await getWochenplanPitchRowLabels(tenantId, defaultPitchRows);

  const weekNumber = getIsoWeekNumber(start);
  const weekYear = startOfIsoWeek(start).getUTCFullYear();
  const weekLabel = `KW ${weekNumber} / ${weekYear}`;
  const dateRange = [start, new Date(end.getTime() - 1)]
    .map((d) =>
      d.toLocaleDateString("de-CH", {
        day: "2-digit",
        month: "2-digit",
      }),
    )
    .join(" – ");

  return (
    <div className="space-y-6">
      {/* Header + week navigation */}
      <section>
        <p className="text-xs font-medium tracking-wide text-[var(--muted)]">Wochenplan</p>

        <div className="mt-2 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-[var(--foreground)] leading-tight">Feld-/Garderobenplanung</h1>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--blue)]/30 bg-[var(--blue-light)] px-4 py-1.5 text-sm font-semibold text-[var(--blue)]">
              <CalendarDays className="h-3.5 w-3.5" />
              {weekLabel}
            </span>
            <span className="hidden text-[0.78rem] text-[var(--muted)] sm:block">
              {dateRange}
            </span>
          </div>

          {/* Week navigation */}
          <div className="flex items-center gap-2">
            <Link
              href={`/dashboard/wochenplan?week=${previousWeekId}`}
              className="fca-button-secondary flex items-center gap-1"
              title="Vorherige Woche"
            >
              <ChevronLeft className="h-4 w-4" />
              Vorherige
            </Link>
            <Link
              href="/dashboard/wochenplan"
              className="fca-button-secondary text-[0.78rem]"
              title="Aktuelle Woche"
            >
              Heute
            </Link>
            <Link
              href={`/dashboard/wochenplan?week=${nextWeekId}`}
              className="fca-button-secondary flex items-center gap-1"
              title="Nächste Woche"
            >
              Nächste
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Summary of unplaced events */}
      {boardData.unplaced.length > 0 ? (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <div>
            <p className="text-sm font-semibold text-amber-800">
              {boardData.unplaced.length} Event{boardData.unplaced.length !== 1 ? "s" : ""} kann nicht auf dem Grid platziert werden
            </p>
            <p className="mt-0.5 text-[0.75rem] text-amber-700">
              Wochenend-Events oder ungewöhnliche Zeiten werden hier nicht angezeigt —{" "}
              sie erscheinen aber in der Saisonplaner-Ansicht.
            </p>
            <ul className="mt-1 flex flex-wrap gap-2">
              {boardData.unplaced.slice(0, 5).map((e) => (
                <li
                  key={e.id}
                  className="inline-flex items-center rounded-full border border-amber-200 bg-amber-100 px-2 py-0.5 text-[0.68rem] font-semibold text-amber-800"
                >
                  {e.title}
                  {e.teamName ? ` (${e.teamName})` : ""}
                </li>
              ))}
              {boardData.unplaced.length > 5 ? (
                <li className="text-[0.68rem] text-amber-600">
                  + {boardData.unplaced.length - 5} weitere
                </li>
              ) : null}
            </ul>
          </div>
        </div>
      ) : null}

      {/* Real-data board with canonical pitch labels + active variant publication */}
      <WochenplanBoard
        initialEvents={boardData.placed}
        weekId={weekId}
        pitchRows={pitchRows}
        activeVariantLabel={publication?.isPublished ? publication.variantLabel : null}
      />
    </div>
  );
}
