import Link from "next/link";
import { ChevronLeft, ChevronRight, Plus, Volleyball } from "lucide-react";
import type { MatchcenterMatchSummary } from "@/lib/matchcenter/types";
import {
  buildMatchcenterViewModel,
  type MatchcenterActionFilter,
  type MatchcenterTab,
  type MatchcenterWochenplanFilter,
} from "@/lib/matchcenter/view-model";
import { cn } from "@/lib/cn";
import { EmptyState } from "@/components/ui/page/EmptyState";
import { SectionCard } from "@/components/ui/page/SectionCard";
import MatchcenterResultRow from "./MatchcenterResultRow";
import MatchcenterWochenplanBulkPanel from "./MatchcenterWochenplanBulkPanel";

export type MatchcenterMonthWindowLike = {
  param: string;
  label: string;
  previousParam: string;
  nextParam: string;
};

type MatchcenterOverviewProps = {
  matches: MatchcenterMatchSummary[];
  tab: MatchcenterTab;
  actionFilter: MatchcenterActionFilter;
  wochenplanFilter: MatchcenterWochenplanFilter;
  monthWindow: MatchcenterMonthWindowLike;
  basePath?: string;
  timezone?: string;
  locale?: string;
  canManage?: boolean;
};

const TABS: { key: MatchcenterTab; label: string }[] = [
  { key: "SPIELPLANUNG", label: "Spielplanung" },
  { key: "RESULTATE", label: "Resultate" },
];

const ACTION_FILTERS: { key: MatchcenterActionFilter; label: string }[] = [
  { key: "ALLE", label: "Alle" },
  { key: "OFFEN", label: "Offen" },
  { key: "ERLEDIGT", label: "Erledigt" },
];

const WOCHENPLAN_FILTERS: {
  key: MatchcenterWochenplanFilter;
  label: string;
}[] = [
  { key: "ALLE", label: "Alle" },
  { key: "IM_WOCHENPLAN", label: "Im Wochenplan" },
  { key: "NICHT_IM_WOCHENPLAN", label: "Nicht im Wochenplan" },
];

function buildHref(
  basePath: string,
  params: {
    tab: MatchcenterTab;
    month: string;
    actionFilter: MatchcenterActionFilter;
    wochenplanFilter: MatchcenterWochenplanFilter;
  },
): string {
  const search = new URLSearchParams();
  search.set("tab", params.tab.toLowerCase());
  search.set("month", params.month);
  if (params.tab === "SPIELPLANUNG") {
    search.set("filter", params.actionFilter.toLowerCase());
  }
  if (params.wochenplanFilter !== "ALLE") {
    search.set("wochenplan", params.wochenplanFilter.toLowerCase());
  }
  return `${basePath}?${search.toString()}`;
}

export default function MatchcenterOverview({
  matches,
  tab,
  actionFilter,
  wochenplanFilter,
  monthWindow,
  basePath = "/dashboard/matchcenter",
  timezone = "Europe/Zurich",
  locale = "de-CH",
  canManage = false,
}: MatchcenterOverviewProps) {
  const viewModel = buildMatchcenterViewModel(matches, {
    actionFilter,
    wochenplanFilter,
  });

  return (
    <div className="space-y-5">
      {/* Spielplanung / Resultate ────────────────────────────────────────── */}
      <div
        role="tablist"
        aria-label="Matchcenter-Bereiche"
        className="flex gap-1 border-b border-[var(--border)]"
      >
        {TABS.map((item) => {
          const isActive = item.key === tab;
          return (
            <Link
              key={item.key}
              href={buildHref(basePath, {
                tab: item.key,
                month: monthWindow.param,
                actionFilter,
                wochenplanFilter,
              })}
              role="tab"
              aria-selected={isActive}
              data-testid={`matchcenter-tab-${item.key.toLowerCase()}`}
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

      {/* Month navigation ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5">
        <Link
          href={buildHref(basePath, {
            tab,
            month: monthWindow.previousParam,
            actionFilter,
            wochenplanFilter,
          })}
          aria-label="Vorheriger Monat"
          data-testid="matchcenter-month-previous"
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--text-2)] transition hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
        >
          <ChevronLeft className="h-4 w-4" />
        </Link>

        <span
          className="text-sm font-semibold text-[var(--foreground)]"
          data-testid="matchcenter-month-label"
        >
          {monthWindow.label}
        </span>

        <Link
          href={buildHref(basePath, {
            tab,
            month: monthWindow.nextParam,
            actionFilter,
            wochenplanFilter,
          })}
          aria-label="Nächster Monat"
          data-testid="matchcenter-month-next"
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--text-2)] transition hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
        >
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>

      {/* Operational summary ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SummaryCard label="Anstehend" value={viewModel.kpis.anstehend} tone="default" />
        <SummaryCard label="Offen" value={viewModel.kpis.offen} tone="amber" />
        <SummaryCard label="Bereit" value={viewModel.kpis.bereit} tone="emerald" />
        <SummaryCard label="Resultate" value={viewModel.kpis.resultate} tone="default" />
      </div>

      {tab === "SPIELPLANUNG" ? (
        <>
          {/* Operational action filter ───────────────────────────────────── */}
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Aktionsfilter">
            {ACTION_FILTERS.map((item) => {
              const isActive = item.key === actionFilter;
              return (
                <Link
                  key={item.key}
                  href={buildHref(basePath, {
                    tab,
                    month: monthWindow.param,
                    actionFilter: item.key,
                    wochenplanFilter,
                  })}
                  data-testid={`matchcenter-filter-${item.key.toLowerCase()}`}
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

          {/* Wochenplan publication filter ───────────────────────────────── */}
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Wochenplan-Filter">
            <span className="text-xs font-medium text-[var(--muted)]">Wochenplan:</span>
            {WOCHENPLAN_FILTERS.map((item) => {
              const isActive = item.key === wochenplanFilter;
              return (
                <Link
                  key={item.key}
                  href={buildHref(basePath, {
                    tab,
                    month: monthWindow.param,
                    actionFilter,
                    wochenplanFilter: item.key,
                  })}
                  data-testid={`matchcenter-wochenplan-filter-${item.key.toLowerCase()}`}
                  className={cn(
                    "rounded-full border px-3.5 py-1.5 text-xs font-semibold transition",
                    isActive
                      ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                      : "border-[var(--border)] bg-[var(--surface)] text-[var(--text-2)] hover:bg-[var(--surface-2)]",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>

          {/* Spielplanung list with bulk wochenplan management ───────────── */}
          {viewModel.spielplanung.length === 0 ? (
            <SectionCard noPadding>
              <EmptyState
                icon={<Volleyball className="h-8 w-8" />}
                heading="Keine Matches gefunden"
                description="Für den ausgewählten Monat und Filter gibt es keine anstehenden Spiele."
                action={
                  <Link href="/dashboard/events/matches/new" className="fca-button-primary">
                    <Plus className="h-4 w-4" />
                    Match erstellen
                  </Link>
                }
              />
            </SectionCard>
          ) : (
            <MatchcenterWochenplanBulkPanel
              rows={viewModel.spielplanung}
              locale={locale}
              timezone={timezone}
              canManage={canManage}
            />
          )}
        </>
      ) : (
        <>
          {/* Wochenplan publication filter for Resultate ─────────────────── */}
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Wochenplan-Filter">
            <span className="text-xs font-medium text-[var(--muted)]">Wochenplan:</span>
            {WOCHENPLAN_FILTERS.map((item) => {
              const isActive = item.key === wochenplanFilter;
              return (
                <Link
                  key={item.key}
                  href={buildHref(basePath, {
                    tab,
                    month: monthWindow.param,
                    actionFilter,
                    wochenplanFilter: item.key,
                  })}
                  data-testid={`matchcenter-wochenplan-filter-resultate-${item.key.toLowerCase()}`}
                  className={cn(
                    "rounded-full border px-3.5 py-1.5 text-xs font-semibold transition",
                    isActive
                      ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                      : "border-[var(--border)] bg-[var(--surface)] text-[var(--text-2)] hover:bg-[var(--surface-2)]",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>

          {viewModel.resultate.length === 0 ? (
            <SectionCard noPadding>
              <EmptyState
                icon={<Volleyball className="h-8 w-8" />}
                heading="Keine Resultate vorhanden"
                description="Für den ausgewählten Monat wurden noch keine Spiele abgeschlossen."
              />
            </SectionCard>
          ) : (
            <SectionCard noPadding>
              <div className="divide-y divide-[var(--border)]" data-testid="matchcenter-resultate-list">
                {viewModel.resultate.map((match) => (
                  <MatchcenterResultRow
                    key={match.id}
                    match={match}
                    locale={locale}
                    timezone={timezone}
                  />
                ))}
              </div>
            </SectionCard>
          )}
        </>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "default" | "amber" | "emerald";
}) {
  const toneClass =
    tone === "amber"
      ? "text-amber-600"
      : tone === "emerald"
        ? "text-emerald-600"
        : "text-[var(--blue)]";

  return (
    <div className="sce-kpi-card p-4" data-testid={`matchcenter-kpi-${label.toLowerCase()}`}>
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
