import Link from "next/link";
import { Plus, Volleyball } from "lucide-react";
import type { MatchcenterMatchSummary } from "@/lib/matchcenter/types";
import {
  buildMatchcenterViewModel,
  type MatchcenterActionFilter,
  type MatchcenterTab,
  type MatchcenterWochenplanFilter,
} from "@/lib/matchcenter/view-model";
import {
  buildMatchcenterHref,
  type MatchcenterTeamOption,
} from "@/lib/matchcenter/navigation";
import { cn } from "@/lib/cn";
import { EmptyState } from "@/components/ui/page/EmptyState";
import { SectionCard } from "@/components/ui/page/SectionCard";
import { CenterPeriodNavigation } from "@/components/centers/CenterPeriodNavigation";
import { CenterSummaryStrip } from "@/components/centers/CenterSummaryStrip";
import MatchcenterResultRow from "./MatchcenterResultRow";
import MatchcenterWochenplanBulkPanel from "./MatchcenterWochenplanBulkPanel";
import MatchcenterReconciliationPanel from "./MatchcenterReconciliationPanel";
import MatchcenterTeamFilter from "./MatchcenterTeamFilter";

// WOCHENPLAN_FILTERS — used by the Resultate tab filter (Spielplanung filters
// are now rendered inside MatchcenterWochenplanBulkPanel for C2 unified toolbar)
const WOCHENPLAN_FILTERS_RESULTATE: { key: MatchcenterWochenplanFilter; label: string }[] =
  [
    { key: "ALLE", label: "Alle" },
    { key: "IM_WOCHENPLAN", label: "Im Wochenplan" },
    { key: "NICHT_IM_WOCHENPLAN", label: "Nicht im Wochenplan" },
  ];

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
  teamFilter: string | null;
  teamOptions: MatchcenterTeamOption[];
  monthWindow: MatchcenterMonthWindowLike;
  basePath?: string;
  timezone?: string;
  locale?: string;
  canManage?: boolean;
  /** Current month param — used to build "Heute" navigation link. */
  currentMonthParam?: string;
  /**
   * Canonical tenant/club logo URL (Tenant.logoUrl).
   * Threaded to MatchCard, MatchInspector, and MatchcenterResultRow for
   * own-club identity resolution — MATCHCENTER-UX-03-C1.
   */
  tenantLogoUrl?: string | null;
};

const TABS: { key: MatchcenterTab; label: string }[] = [
  { key: "SPIELPLANUNG", label: "Spielplanung" },
  { key: "RESULTATE", label: "Resultate" },
];

function buildHref(
  basePath: string,
  params: {
    tab: MatchcenterTab;
    month: string;
    actionFilter: MatchcenterActionFilter;
    wochenplanFilter: MatchcenterWochenplanFilter;
    teamFilter: string | null;
  },
): string {
  return buildMatchcenterHref(basePath, params);
}

export default function MatchcenterOverview({
  matches,
  tab,
  actionFilter,
  wochenplanFilter,
  teamFilter,
  teamOptions,
  monthWindow,
  basePath = "/dashboard/matchcenter",
  timezone = "Europe/Zurich",
  locale = "de-CH",
  canManage = false,
  currentMonthParam,
  tenantLogoUrl = null,
}: MatchcenterOverviewProps) {
  const viewModel = buildMatchcenterViewModel(matches, {
    actionFilter,
    wochenplanFilter,
    teamFilter,
  });

  // Build "Heute" href that navigates to today's month with filters preserved
  const todayHref = currentMonthParam
    ? buildHref(basePath, {
        tab,
        month: currentMonthParam,
        actionFilter,
        wochenplanFilter,
        teamFilter,
      })
    : undefined;

  // Summary strip metrics (actionable: Offen and Erledigt link to filters)
  const summaryMetrics =
    tab === "SPIELPLANUNG"
      ? [
          {
            key: "anstehend",
            label: "Anstehend",
            value: viewModel.kpis.anstehend,
            tone: "default" as const,
            "data-testid": "matchcenter-kpi-anstehend",
          },
          {
            key: "offen",
            label: "Offen",
            value: viewModel.kpis.offen,
            tone: "amber" as const,
            href: buildHref(basePath, {
              tab,
              month: monthWindow.param,
              actionFilter: "OFFEN",
              wochenplanFilter,
              teamFilter,
            }),
            active: actionFilter === "OFFEN",
            "data-testid": "matchcenter-kpi-offen",
          },
          {
            key: "bereit",
            label: "Bereit",
            value: viewModel.kpis.bereit,
            tone: "emerald" as const,
            href: buildHref(basePath, {
              tab,
              month: monthWindow.param,
              actionFilter: "ERLEDIGT",
              wochenplanFilter,
              teamFilter,
            }),
            active: actionFilter === "ERLEDIGT",
            "data-testid": "matchcenter-kpi-bereit",
          },
          {
            key: "resultate",
            label: "Resultate",
            value: viewModel.kpis.resultate,
            tone: "muted" as const,
            "data-testid": "matchcenter-kpi-resultate",
          },
        ]
      : [
          {
            key: "anstehend",
            label: "Anstehend",
            value: viewModel.kpis.anstehend,
            tone: "muted" as const,
            "data-testid": "matchcenter-kpi-anstehend",
          },
          {
            key: "resultate",
            label: "Resultate",
            value: viewModel.kpis.resultate,
            tone: "default" as const,
            "data-testid": "matchcenter-kpi-resultate",
          },
        ];

  return (
    <div className="space-y-4">
      {/* ── Spielplanung / Resultate tabs ──────────────────────────────────── */}
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
                teamFilter,
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

      {/* ── Period navigation + summary strip ─────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <CenterPeriodNavigation
          label={monthWindow.label}
          previousHref={buildHref(basePath, {
            tab,
            month: monthWindow.previousParam,
            actionFilter,
            wochenplanFilter,
            teamFilter,
          })}
          nextHref={buildHref(basePath, {
            tab,
            month: monthWindow.nextParam,
            actionFilter,
            wochenplanFilter,
            teamFilter,
          })}
          todayHref={todayHref}
          data-testid-label="matchcenter-month-label"
          data-testid-previous="matchcenter-month-previous"
          data-testid-next="matchcenter-month-next"
        />

        <MatchcenterTeamFilter
          teams={teamOptions}
          teamFilter={teamFilter}
          basePath={basePath}
          tab={tab}
          month={monthWindow.param}
          actionFilter={actionFilter}
          wochenplanFilter={wochenplanFilter}
        />
      </div>

      {/* ── Operational summary ─────────────────────────────────────────────── */}
      <CenterSummaryStrip metrics={summaryMetrics} />

      <MatchcenterReconciliationPanel
        rows={viewModel.needsReconciliation}
        locale={locale}
        timezone={timezone}
      />

      {tab === "SPIELPLANUNG" ? (
        <>
          {/* ── Match list (filter toolbar is inside BulkPanel — C2) ──────── */}
          {viewModel.spielplanung.length === 0 ? (
            <>
              {/* Empty state still needs a minimal filter strip for navigation */}
              <div className="flex flex-wrap items-center gap-2">
                <div
                  className="flex items-center gap-0.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-0.5"
                  role="group"
                  aria-label="Status"
                >
                  {(
                    [
                      { key: "ALLE" as const, label: "Alle" },
                      { key: "OFFEN" as const, label: "Offen" },
                      { key: "ERLEDIGT" as const, label: "Bereit" },
                    ] as { key: MatchcenterActionFilter; label: string }[]
                  ).map((item) => {
                    const isActive = item.key === actionFilter;
                    return (
                      <Link
                        key={item.key}
                        href={buildHref(basePath, {
                          tab,
                          month: monthWindow.param,
                          actionFilter: item.key,
                          wochenplanFilter,
                          teamFilter,
                        })}
                        data-testid={`matchcenter-filter-${item.key.toLowerCase()}`}
                        aria-current={isActive ? "true" : undefined}
                        className={cn(
                          "rounded-md px-3 py-1.5 text-xs font-medium transition",
                          isActive
                            ? "bg-[var(--foreground)] text-white"
                            : "text-[var(--text-2)] hover:text-[var(--foreground)]",
                        )}
                      >
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
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
            </>
          ) : (
            <MatchcenterWochenplanBulkPanel
              rows={viewModel.spielplanung}
              locale={locale}
              timezone={timezone}
              canManage={canManage}
              tenantLogoUrl={tenantLogoUrl}
              basePath={basePath}
              tab={tab}
              monthParam={monthWindow.param}
              actionFilter={actionFilter}
              wochenplanFilter={wochenplanFilter}
              teamFilter={teamFilter}
            />
          )}
        </>
      ) : (
        <>
          {/* ── Wochenplan filter for Resultate ──────────────────────────── */}
          <div
            className="flex items-center gap-0.5 self-start rounded-lg border border-[var(--border)] bg-[var(--surface)] p-0.5"
            role="group"
            aria-label="Wochenplan-Filter"
          >
            {WOCHENPLAN_FILTERS_RESULTATE.map((item) => {
              const isActive = item.key === wochenplanFilter;
              return (
                <Link
                  key={item.key}
                  href={buildHref(basePath, {
                    tab,
                    month: monthWindow.param,
                    actionFilter,
                    wochenplanFilter: item.key,
                    teamFilter,
                  })}
                  data-testid={`matchcenter-wochenplan-filter-resultate-${item.key.toLowerCase()}`}
                  aria-current={isActive ? "true" : undefined}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-xs font-medium transition",
                    isActive
                      ? "bg-[var(--foreground)] text-white"
                      : "text-[var(--text-2)] hover:text-[var(--foreground)]",
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
              <div
                className="divide-y divide-[var(--border)]"
                data-testid="matchcenter-resultate-list"
              >
                {viewModel.resultate.map((match) => (
                  <MatchcenterResultRow
                    key={match.id}
                    match={match}
                    locale={locale}
                    timezone={timezone}
                    tenantLogoUrl={tenantLogoUrl}
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
