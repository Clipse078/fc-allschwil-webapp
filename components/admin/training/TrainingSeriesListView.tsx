import Link from "next/link";
import { Archive, Dumbbell } from "lucide-react";
import type { FacilityGroup } from "@/components/admin/training/FacilityResourceSelector";
import TrainingSeriesCockpitRow from "./TrainingSeriesCockpitRow";
import type { TrainingSeriesCockpitRow as CockpitRow } from "@/lib/training/series-cockpit";
import { groupCockpitRowsByWeekday } from "@/lib/training/series-cockpit";

type Props = {
  cockpitRows: CockpitRow[];
  showArchived: boolean;
  archivedCount: number;
  canManage: boolean;
  isCoordinator?: boolean;
  canDelete?: boolean;
  pitchFacilityGroups: FacilityGroup[];
  dressingRoomFacilityGroups: FacilityGroup[];
  basePath?: string;
};

/**
 * TRAINING-SERIES-PREMIUM-01 — weekday-oriented Training Series Cockpit.
 *
 * Replaces the previous card list with a compact, scannable weekday grouping
 * optimized for operational editing (time, pitch, dressing room visible and
 * editable inline). Rare/destructive actions live in a compact overflow menu.
 */
export default function TrainingSeriesListView({
  cockpitRows,
  showArchived,
  archivedCount,
  canManage,
  isCoordinator = canManage,
  canDelete = false,
  pitchFacilityGroups,
  dressingRoomFacilityGroups,
  basePath = "/dashboard/training",
}: Props) {
  const weekdayGroups = groupCockpitRowsByWeekday(cockpitRows);
  const archiveToggleHref = showArchived
    ? `${basePath}?tab=serien`
    : `${basePath}?tab=serien&archived=1`;

  return (
    <div className="space-y-5" data-testid="training-series-weekday-cockpit">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[var(--muted)]">
          Wochentags-Cockpit: Zeit, Team, Spielfeld und Garderobe auf einen Blick. Änderungen direkt in der Liste.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {archivedCount > 0 ? (
            <Link href={archiveToggleHref} className="fca-button-secondary inline-flex items-center gap-1.5 text-sm">
              <Archive className="h-3.5 w-3.5" />
              {showArchived ? "Archiv ausblenden" : "Archiv anzeigen"}
            </Link>
          ) : null}
        </div>
      </div>

      {weekdayGroups.length === 0 ? (
        <div className="sce-detail-section">
          <div className="sce-detail-section-body flex flex-col items-center justify-center gap-3 py-12 text-center">
            <Dumbbell className="h-10 w-10 text-[var(--muted)]" />
            <p className="font-semibold text-[var(--foreground)]">
              {showArchived ? "Keine Trainingsserien vorhanden" : "Keine aktiven Trainingsserien"}
            </p>
            <p className="text-sm text-[var(--muted)]">
              {showArchived
                ? "Es wurden noch keine Trainingsserien erstellt."
                : "Alle Trainingsserien sind archiviert oder es wurden noch keine erstellt."}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="hidden md:grid md:grid-cols-[5.5rem_minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,0.9fr)_auto] gap-3 px-3 text-[0.65rem] font-semibold uppercase tracking-wide text-[var(--muted)]">
            <span>Zeit</span>
            <span>Training / Team</span>
            <span>Spielfeld</span>
            <span>Garderobe</span>
            <span className="text-right">Status</span>
          </div>

          {weekdayGroups.map((group) => (
            <section
              key={group.weekday}
              className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-sm"
              data-testid={`training-series-weekday-group-${group.weekday}`}
            >
              <header className="border-b border-[var(--border)] bg-[var(--surface-2)] px-3 py-2">
                <h2 className="text-sm font-semibold tracking-wide text-[var(--foreground)]">{group.label}</h2>
              </header>
              <div>
                {group.rows.map((row) => (
                  <TrainingSeriesCockpitRow
                    key={row.rowKey}
                    row={row}
                    canManage={canManage}
                    canDelete={canDelete}
                    isCoordinator={isCoordinator}
                    pitchFacilityGroups={pitchFacilityGroups}
                    dressingRoomFacilityGroups={dressingRoomFacilityGroups}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {!showArchived && archivedCount > 0 && (
        <p className="text-xs text-[var(--muted)] text-center">
          {archivedCount} archivierte {archivedCount === 1 ? "Trainingsserie" : "Trainingsserien"} —{" "}
          <Link href={`${basePath}?tab=serien&archived=1`} className="text-[var(--blue)] hover:underline">
            Archiv anzeigen
          </Link>
        </p>
      )}
    </div>
  );
}
