import Link from "next/link";
import { Plus, Trophy } from "lucide-react";
import type { TournamentDto } from "@/lib/tournaments/types";
import {
  buildTournamentCenterViewModel,
  type TournamentActionFilter,
  type TournamentTab,
} from "@/lib/tournaments/view-model";
import { cn } from "@/lib/cn";
import { EmptyState } from "@/components/ui/page/EmptyState";
import { SectionCard } from "@/components/ui/page/SectionCard";
import TournamentListRow from "./TournamentListRow";
import TournamentArchivRow from "./TournamentArchivRow";

type TournamentCenterOverviewProps = {
  tournaments: TournamentDto[];
  tab: TournamentTab;
  actionFilter: TournamentActionFilter;
  basePath?: string;
  timezone?: string;
  locale?: string;
};

const TABS: { key: TournamentTab; label: string }[] = [
  { key: "ANSTEHEND", label: "Anstehend" },
  { key: "ARCHIV", label: "Archiv" },
];

const ACTION_FILTERS: { key: TournamentActionFilter; label: string }[] = [
  { key: "ALLE", label: "Alle" },
  { key: "OFFEN", label: "Offen" },
  { key: "ERLEDIGT", label: "Erledigt" },
];

function buildHref(
  basePath: string,
  params: { tab: TournamentTab; actionFilter: TournamentActionFilter },
): string {
  const search = new URLSearchParams();
  search.set("tab", params.tab.toLowerCase());
  if (params.tab === "ANSTEHEND") {
    search.set("filter", params.actionFilter.toLowerCase());
  }
  return `${basePath}?${search.toString()}`;
}

export default function TournamentCenterOverview({
  tournaments,
  tab,
  actionFilter,
  basePath = "/dashboard/tournamentcenter",
  timezone = "Europe/Zurich",
  locale = "de-CH",
}: TournamentCenterOverviewProps) {
  const viewModel = buildTournamentCenterViewModel(tournaments, { actionFilter });

  return (
    <div className="space-y-5">
      {/* Anstehend / Archiv ────────────────────────────────────────────────── */}
      <div
        role="tablist"
        aria-label="TournamentCenter-Bereiche"
        className="flex gap-1 border-b border-[var(--border)]"
      >
        {TABS.map((item) => {
          const isActive = item.key === tab;
          return (
            <Link
              key={item.key}
              href={buildHref(basePath, { tab: item.key, actionFilter })}
              role="tab"
              aria-selected={isActive}
              data-testid={`tournamentcenter-tab-${item.key.toLowerCase()}`}
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

      {/* Operational summary ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SummaryCard label="Anstehend" value={viewModel.kpis.anstehend} tone="default" />
        <SummaryCard label="Offen" value={viewModel.kpis.offen} tone="amber" />
        <SummaryCard label="Bereit" value={viewModel.kpis.bereit} tone="emerald" />
        <SummaryCard label="Archiv" value={viewModel.kpis.archiv} tone="default" />
      </div>

      {tab === "ANSTEHEND" ? (
        <>
          {/* Alle / Offen / Erledigt ─────────────────────────────────────── */}
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Aktionsfilter">
            {ACTION_FILTERS.map((item) => {
              const isActive = item.key === actionFilter;
              return (
                <Link
                  key={item.key}
                  href={buildHref(basePath, { tab, actionFilter: item.key })}
                  data-testid={`tournamentcenter-filter-${item.key.toLowerCase()}`}
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

          {viewModel.anstehend.length === 0 ? (
            <SectionCard noPadding>
              <EmptyState
                icon={<Trophy className="h-8 w-8" />}
                heading="Keine Turniere gefunden"
                description="Für den ausgewählten Filter gibt es keine anstehenden Turniere."
                action={
                  <Link href="/dashboard/tournamentcenter/new" className="fca-button-primary">
                    <Plus className="h-4 w-4" />
                    Turnier erstellen
                  </Link>
                }
              />
            </SectionCard>
          ) : (
            <SectionCard noPadding>
              <div className="divide-y divide-[var(--border)]" data-testid="tournamentcenter-anstehend-list">
                {viewModel.anstehend.map((row) => (
                  <TournamentListRow
                    key={row.tournament.id}
                    tournament={row.tournament}
                    assessment={row.assessment}
                    locale={locale}
                    timezone={timezone}
                  />
                ))}
              </div>
            </SectionCard>
          )}
        </>
      ) : (
        <>
          {viewModel.archiv.length === 0 ? (
            <SectionCard noPadding>
              <EmptyState
                icon={<Trophy className="h-8 w-8" />}
                heading="Kein Archiv vorhanden"
                description="Abgeschlossene, stornierte oder archivierte Turniere erscheinen hier."
              />
            </SectionCard>
          ) : (
            <SectionCard noPadding>
              <div className="divide-y divide-[var(--border)]" data-testid="tournamentcenter-archiv-list">
                {viewModel.archiv.map((tournament) => (
                  <TournamentArchivRow
                    key={tournament.id}
                    tournament={tournament}
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
    tone === "amber" ? "text-amber-600" : tone === "emerald" ? "text-emerald-600" : "text-[var(--blue)]";

  return (
    <div className="sce-kpi-card p-4" data-testid={`tournamentcenter-kpi-${label.toLowerCase()}`}>
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
