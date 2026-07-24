/**
 * components/infoboard/admin/InfoboardPublicationSummary.tsx
 *
 * KPI summary cards for the Infoboard Screen 1 publication state.
 *
 * Renders four counts derived from the Screen 1 live feed:
 *   - Heute sichtbar (all events in the feed)
 *   - Jetzt aktiv (current bucket)
 *   - Als Nächstes (next bucket)
 *   - Später heute (later bucket)
 *
 * Zero counts are valid and must not be presented as errors.
 *
 * Design constraints:
 *   - Uses only established SportClubEvo dashboard design tokens.
 *   - Pure presentation — no data fetching.
 *   - German UI copy throughout.
 */

import type { Screen1AdminCounts } from "@/lib/publishing/infoboard/screen1-admin-summary";

export type InfoboardPublicationSummaryProps = {
  readonly counts: Screen1AdminCounts;
  /** The display date key shown in the header (YYYY-MM-DD, tenant local). */
  readonly displayDate: string;
};

// ── KPI card ──────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  sublabel,
  colorClass,
}: {
  label: string;
  value: number;
  sublabel: string;
  colorClass: string;
}) {
  return (
    <div className="sce-kpi-card p-5">
      <p className="sce-data-label">{label}</p>
      <p
        className={`mt-2 text-[2rem] font-bold leading-none tracking-tight ${colorClass}`}
        style={{ fontFamily: "var(--font-display)" }}
      >
        {value}
      </p>
      <p className="mt-1.5 text-[0.75rem] text-[var(--text-2)]">{sublabel}</p>
    </div>
  );
}

// ── InfoboardPublicationSummary ───────────────────────────────────────────────

export function InfoboardPublicationSummary({
  counts,
  displayDate,
}: InfoboardPublicationSummaryProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[0.72rem] font-semibold uppercase tracking-[0.10em] text-[var(--muted)]">
          Publikationsstatus — Display 1
        </p>
        <span className="font-mono text-[0.72rem] text-[var(--muted)]">{displayDate}</span>
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          label="Heute sichtbar"
          value={counts.visibleToday}
          sublabel="Events im Feed"
          colorClass="text-[var(--foreground)]"
        />
        <KpiCard
          label="Jetzt aktiv"
          value={counts.currentCount}
          sublabel="Laufend"
          colorClass="text-emerald-600"
        />
        <KpiCard
          label="Als Nächstes"
          value={counts.nextCount}
          sublabel="Nächste Gruppe"
          colorClass="text-[var(--blue)]"
        />
        <KpiCard
          label="Später heute"
          value={counts.laterCount}
          sublabel="Später am Tag"
          colorClass="text-amber-600"
        />
      </div>
    </div>
  );
}
