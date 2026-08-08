import Link from "next/link";
import { Plus } from "lucide-react";
import { notFound } from "next/navigation";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { hasPermission } from "@/lib/permissions/has-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getActiveTenant } from "@/lib/tenants/active-tenant";
import { listTrainingSeries } from "@/lib/training/training-service";
import { listTrainingSessions } from "@/lib/training/session-generation-service";
import { listAllocationSummaryByTenant } from "@/lib/training/training-allocation-service";
import {
  parseDateParam,
  parseMonthParam,
  resolveTrainingDayWindow,
  resolveTrainingMonthWindow,
  resolveTrainingWeekWindow,
  formatTrainingDayLabel,
  formatTrainingMonthLabel,
  formatTrainingWeekLabel,
  normalizeTrainingCenterView,
  TRAINING_DEFAULT_TIMEZONE,
} from "@/lib/training/date-range";
import { buildTrainingCenterViewModel, normalizeTrainingActionFilter } from "@/lib/training/view-model";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import TrainingCenterOverview from "@/components/admin/training/TrainingCenterOverview";
import TrainingSeriesListView from "@/components/admin/training/TrainingSeriesListView";
import { cn } from "@/lib/cn";

type TrainingPageSearchParams = {
  tab?: string;
  archived?: string;
  view?: string;
  month?: string;
  week?: string;
  day?: string;
  filter?: string;
};

type Props = {
  searchParams?: Promise<TrainingPageSearchParams>;
};

/** "YYYY-MM-DD" for the 1st of a "YYYY-MM" month param, or undefined if malformed. */
function firstOfMonthKey(monthParam: string | undefined): string | undefined {
  const parsed = parseMonthParam(monthParam);
  if (!parsed) return undefined;
  return `${parsed.year.toString().padStart(4, "0")}-${parsed.month.toString().padStart(2, "0")}-01`;
}

function normalizedDateKey(param: string | undefined): string | undefined {
  return parseDateParam(param) ? param : undefined;
}

const TOP_TABS: { key: "kalender" | "serien"; label: string }[] = [
  { key: "kalender", label: "Kalender" },
  { key: "serien", label: "Serien verwalten" },
];

export default async function TrainingCenterPage({ searchParams }: Props) {
  const session = await requireAnyPermission([PERMISSIONS.TRAININGS_VIEW, PERMISSIONS.TRAININGS_MANAGE]);

  const tenantContext = await getActiveTenant();
  if (!tenantContext) notFound();

  const canManage = hasPermission(session, PERMISSIONS.TRAININGS_MANAGE);
  const params: TrainingPageSearchParams = searchParams ? await searchParams : {};
  const tab = params.tab === "serien" ? "serien" : "kalender";
  const timezone = tenantContext.timezone ?? TRAINING_DEFAULT_TIMEZONE;
  const locale = tenantContext.locale ?? "de-CH";

  if (tab === "serien") {
    const showArchived = params.archived === "1";
    const allSeries = await listTrainingSeries(tenantContext.id, { includeArchived: true });

    return (
      <div className="space-y-6">
        <AdminSectionHeader
          eyebrow="Planung"
          title="TrainingCenter"
          description="Kalender und Serien-Verwaltung für alle Trainingsserien."
          actions={
            canManage ? (
              <Link href="/dashboard/training/new" className="fca-button-primary inline-flex items-center gap-1.5 text-sm">
                <Plus className="h-3.5 w-3.5" />
                Neue Trainingsserie
              </Link>
            ) : undefined
          }
        />
        <TopTabs active={tab} />
        <TrainingSeriesListView
          allSeries={allSeries}
          showArchived={showArchived}
          canManage={canManage}
        />
      </div>
    );
  }

  // ── Kalender tab: Monat | Woche | Tag operational overview ─────────────────

  const view = normalizeTrainingCenterView(params.view);
  const actionFilter = normalizeTrainingActionFilter(params.filter);

  // Derive one coherent reference date across all three windows, so
  // switching Monat/Woche/Tag always lands on a sensible date rather than
  // silently resetting to "today".
  const referenceDateKey =
    (view === "MONTH" ? firstOfMonthKey(params.month) : undefined) ??
    (view === "WEEK" ? normalizedDateKey(params.week) : undefined) ??
    (view === "DAY" ? normalizedDateKey(params.day) : undefined) ??
    normalizedDateKey(params.week) ??
    normalizedDateKey(params.day) ??
    firstOfMonthKey(params.month);

  const monthParamForWindow = view === "MONTH" ? params.month : undefined;
  const monthWindow = resolveTrainingMonthWindow({
    monthParam: monthParamForWindow ?? referenceDateKey?.slice(0, 7),
    timeZone: timezone,
  });
  const weekWindow = resolveTrainingWeekWindow({
    weekParam: view === "WEEK" ? params.week : referenceDateKey,
    timeZone: timezone,
  });
  const dayWindow = resolveTrainingDayWindow({
    dayParam: view === "DAY" ? params.day : referenceDateKey,
    timeZone: timezone,
  });

  const activeRange = view === "WEEK" ? weekWindow : view === "DAY" ? dayWindow : monthWindow;

  const [sessions, allocationSummaries] = await Promise.all([
    listTrainingSessions(tenantContext.id, { dateFrom: activeRange.from, dateTo: activeRange.to }),
    listAllocationSummaryByTenant(tenantContext.id),
  ]);

  const viewModel = buildTrainingCenterViewModel(sessions, allocationSummaries, { actionFilter });

  return (
    <div className="max-w-[1400px] space-y-6">
      <AdminSectionHeader
        eyebrow="Planung"
        title="TrainingCenter"
        description="Kalender und Serien-Verwaltung für alle Trainingsserien."
        actions={
          canManage ? (
            <Link href="/dashboard/training/new" className="fca-button-primary inline-flex items-center gap-1.5 text-sm">
              <Plus className="h-3.5 w-3.5" />
              Neue Trainingsserie
            </Link>
          ) : undefined
        }
      />

      <TopTabs active={tab} />

      <TrainingCenterOverview
        view={view}
        actionFilter={actionFilter}
        viewModel={viewModel}
        allocationSummaries={allocationSummaries}
        monthWindow={{
          param: monthWindow.param,
          label: formatTrainingMonthLabel(monthWindow, locale, timezone),
          previousParam: monthWindow.previousParam,
          nextParam: monthWindow.nextParam,
          weeks: monthWindow.weeks,
        }}
        weekWindow={{
          param: weekWindow.param,
          label: formatTrainingWeekLabel(weekWindow, locale, timezone),
          previousParam: weekWindow.previousParam,
          nextParam: weekWindow.nextParam,
          days: weekWindow.days,
        }}
        dayWindow={{
          param: dayWindow.param,
          label: formatTrainingDayLabel(dayWindow.date, locale, timezone),
          previousParam: dayWindow.previousParam,
          nextParam: dayWindow.nextParam,
          date: dayWindow.date,
        }}
        canManage={canManage}
        timezone={timezone}
        locale={locale}
      />
    </div>
  );
}

function TopTabs({ active }: { active: "kalender" | "serien" }) {
  return (
    <div role="tablist" aria-label="TrainingCenter-Bereiche" className="flex gap-1 border-b border-[var(--border)]">
      {TOP_TABS.map((item) => {
        const isActive = item.key === active;
        return (
          <Link
            key={item.key}
            href={`/dashboard/training?tab=${item.key}`}
            role="tab"
            aria-selected={isActive}
            data-testid={`trainingcenter-tab-${item.key}`}
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
  );
}
