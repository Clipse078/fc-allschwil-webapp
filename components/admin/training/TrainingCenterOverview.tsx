import Link from "next/link";
import { ChevronLeft, ChevronRight, Dumbbell } from "lucide-react";
import { cn } from "@/lib/cn";
import { EmptyState } from "@/components/ui/page/EmptyState";
import { SectionCard } from "@/components/ui/page/SectionCard";
import type { TrainingCenterView } from "@/lib/training/date-range";
import type { TrainingActionFilter, TrainingCenterViewModel } from "@/lib/training/view-model";
import type { TrainingAllocationSummary } from "@/lib/training/operational-state";
import TrainingMonthCalendar from "./TrainingMonthCalendar";
import TrainingSessionRow from "./TrainingSessionRow";

export type TrainingCenterWindowLike = {
  /** URL param value for this window (used to preserve cross-tab context). */
  param: string;
  /** Human-readable label rendered in the date-navigation bar. */
  label: string;
  previousParam: string;
  nextParam: string;
};

type Props = {
  view: TrainingCenterView;
  actionFilter: TrainingActionFilter;
  viewModel: TrainingCenterViewModel;
  allocationSummaries: ReadonlyMap<string, TrainingAllocationSummary>;
  monthWindow: TrainingCenterWindowLike & { weeks: { date: string; inMonth: boolean }[][] };
  weekWindow: TrainingCenterWindowLike & { days: string[] };
  dayWindow: TrainingCenterWindowLike & { date: string };
  canManage: boolean;
  basePath?: string;
  timezone?: string;
  locale?: string;
};

const VIEW_TABS: { key: TrainingCenterView; label: string }[] = [
  { key: "MONTH", label: "Monat" },
  { key: "WEEK", label: "Woche" },
  { key: "DAY", label: "Tag" },
];

const ACTION_FILTERS: { key: TrainingActionFilter; label: string }[] = [
  { key: "ALLE", label: "Alle" },
  { key: "OFFEN", label: "Offen" },
  { key: "ERLEDIGT", label: "Erledigt" },
];

function paramKeyForView(view: TrainingCenterView): "month" | "week" | "day" {
  if (view === "WEEK") return "week";
  if (view === "DAY") return "day";
  return "month";
}

function buildHref(
  basePath: string,
  params: { view: TrainingCenterView; dateParam: string; actionFilter: TrainingActionFilter },
): string {
  const search = new URLSearchParams();
  search.set("tab", "kalender");
  search.set("view", params.view.toLowerCase());
  search.set(paramKeyForView(params.view), params.dateParam);
  search.set("filter", params.actionFilter.toLowerCase());
  return `${basePath}?${search.toString()}`;
}

function windowForView(
  view: TrainingCenterView,
  monthWindow: TrainingCenterWindowLike,
  weekWindow: TrainingCenterWindowLike,
  dayWindow: TrainingCenterWindowLike,
): TrainingCenterWindowLike {
  if (view === "WEEK") return weekWindow;
  if (view === "DAY") return dayWindow;
  return monthWindow;
}

export default function TrainingCenterOverview({
  view,
  actionFilter,
  viewModel,
  allocationSummaries,
  monthWindow,
  weekWindow,
  dayWindow,
  canManage,
  basePath = "/dashboard/training",
  timezone = "Europe/Zurich",
  locale = "de-CH",
}: Props) {
  const activeWindow = windowForView(view, monthWindow, weekWindow, dayWindow);

  const rowsByDate = new Map<string, typeof viewModel.filteredRows>();
  for (const row of viewModel.filteredRows) {
    const list = rowsByDate.get(row.session.date) ?? [];
    list.push(row);
    rowsByDate.set(row.session.date, list);
  }

  return (
    <div className="space-y-5">
      {/* Monat / Woche / Tag ────────────────────────────────────────────── */}
      <div role="tablist" aria-label="TrainingCenter-Ansichten" className="flex gap-1 border-b border-[var(--border)]">
        {VIEW_TABS.map((item) => {
          const isActive = item.key === view;
          const itemWindow = windowForView(item.key, monthWindow, weekWindow, dayWindow);
          return (
            <Link
              key={item.key}
              href={buildHref(basePath, { view: item.key, dateParam: itemWindow.param, actionFilter })}
              role="tab"
              aria-selected={isActive}
              data-testid={`trainingcenter-view-${item.key.toLowerCase()}`}
              className={cn(
                "-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors",
                isActive
                  ? "border-[var(--sce-primary)] text-[var(--sce-primary)]"
                  : "border-transparent text-[var(--text-2)] hover:text-[var(--foreground)]",
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </div>

      {/* Date navigation ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5">
        <Link
          href={buildHref(basePath, { view, dateParam: activeWindow.previousParam, actionFilter })}
          aria-label="Vorheriger Zeitraum"
          data-testid="trainingcenter-date-previous"
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--text-2)] transition hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
        >
          <ChevronLeft className="h-4 w-4" />
        </Link>

        <span className="text-sm font-semibold text-[var(--foreground)]" data-testid="trainingcenter-date-label">
          {activeWindow.label}
        </span>

        <Link
          href={buildHref(basePath, { view, dateParam: activeWindow.nextParam, actionFilter })}
          aria-label="Nächster Zeitraum"
          data-testid="trainingcenter-date-next"
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--text-2)] transition hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
        >
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>

      {/* Operational summary ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        <SummaryCard label="Trainings" value={viewModel.kpis.gesamt} tone="default" />
        <SummaryCard label="Offen" value={viewModel.kpis.offen} tone="amber" />
        <SummaryCard label="Erledigt" value={viewModel.kpis.erledigt} tone="emerald" />
      </div>

      {/* Alle / Offen / Erledigt ─────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Aktionsfilter">
        {ACTION_FILTERS.map((item) => {
          const isActive = item.key === actionFilter;
          return (
            <Link
              key={item.key}
              href={buildHref(basePath, { view, dateParam: activeWindow.param, actionFilter: item.key })}
              data-testid={`trainingcenter-filter-${item.key.toLowerCase()}`}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-xs font-semibold transition",
                isActive
                  ? "border-[var(--sce-primary)] bg-[var(--sce-primary-light)] text-[var(--sce-primary)]"
                  : "border-[var(--border)] bg-[var(--surface)] text-[var(--text-2)] hover:bg-[var(--surface-2)]",
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </div>

      {/* View body ──────────────────────────────────────────────────────────── */}
      {viewModel.filteredRows.length === 0 ? (
        <SectionCard noPadding>
          <EmptyState
            icon={<Dumbbell className="h-8 w-8" />}
            heading="Keine Trainings gefunden"
            description="Für den ausgewählten Zeitraum und Filter gibt es keine Trainings."
          />
        </SectionCard>
      ) : view === "MONTH" ? (
        <TrainingMonthCalendar
          monthWindow={monthWindow as never}
          rowsByDate={rowsByDate}
          actionFilter={actionFilter}
          basePath={basePath}
          timezone={timezone}
        />
      ) : view === "WEEK" ? (
        <div className="space-y-3">
          {weekWindow.days.map((date) => {
            const dayRows = rowsByDate.get(date) ?? [];
            if (dayRows.length === 0) return null;
            return (
              <SectionCard key={date} noPadding>
                <div className="border-b border-[var(--border)] bg-[var(--surface-2)] px-4 py-2 text-xs font-semibold uppercase text-[var(--muted)]">
                  {new Intl.DateTimeFormat(locale, {
                    weekday: "long",
                    day: "2-digit",
                    month: "2-digit",
                    timeZone: timezone,
                  }).format(new Date(`${date}T12:00:00.000Z`))}
                </div>
                <div className="divide-y divide-[var(--border)]">
                  {dayRows.map((row) => (
                    <TrainingSessionRow
                      key={row.session.id}
                      row={row}
                      allocationSummary={allocationSummaries.get(row.session.trainingSeriesId)}
                      canManage={canManage}
                      locale={locale}
                      timezone={timezone}
                    />
                  ))}
                </div>
              </SectionCard>
            );
          })}
        </div>
      ) : (
        <SectionCard noPadding>
          <div className="divide-y divide-[var(--border)]" data-testid="trainingcenter-day-list">
            {viewModel.filteredRows.map((row) => (
              <TrainingSessionRow
                key={row.session.id}
                row={row}
                allocationSummary={allocationSummaries.get(row.session.trainingSeriesId)}
                canManage={canManage}
                locale={locale}
                timezone={timezone}
              />
            ))}
          </div>
        </SectionCard>
      )}
    </div>
  );
}

function SummaryCard({ label, value, tone }: { label: string; value: number; tone: "default" | "amber" | "emerald" }) {
  const toneClass = tone === "amber" ? "text-amber-600" : tone === "emerald" ? "text-emerald-600" : "text-[var(--blue)]";

  return (
    <div className="sce-kpi-card p-4" data-testid={`trainingcenter-kpi-${label.toLowerCase()}`}>
      <p className="sce-data-label">{label}</p>
      <p
        className={cn("mt-1.5 text-[1.75rem] font-bold leading-none tracking-tight", toneClass)}
        style={{ fontFamily: "var(--font-display)" }}
      >
        {value}
      </p>
    </div>
  );
}
