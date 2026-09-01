import Link from "next/link";
import { Plus } from "lucide-react";
import { notFound } from "next/navigation";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { hasPermission } from "@/lib/permissions/has-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getActiveTenant } from "@/lib/tenants/active-tenant";
import { listTrainingSeries } from "@/lib/training/training-service";
import { buildTrainingSeriesCockpitViewModel } from "@/lib/training/series-cockpit-data";
import { getFacilitiesForTenant } from "@/lib/facilities/queries";
import type { FacilityGroup } from "@/components/admin/training/FacilityResourceSelector";
import { listTrainingSessions } from "@/lib/training/session-generation-service";
import { listAllocationSummaryByTenant } from "@/lib/training/training-allocation-service";
import { listSessionAllocationSummaryByTenant } from "@/lib/training/session-allocation-service";
import {
  resolveTrainingDayWindow,
  resolveTrainingMonthWindow,
  resolveTrainingWeekWindow,
  listTrainingSessionDateBounds,
  formatTrainingDayLabel,
  formatTrainingMonthLabel,
  formatTrainingWeekLabel,
  normalizeTrainingCenterView,
  TRAINING_DEFAULT_TIMEZONE,
} from "@/lib/training/date-range";
import { buildTrainingCenterViewModel, normalizeTrainingActionFilter } from "@/lib/training/view-model";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import TrainingCenterOverview from "@/components/admin/training/TrainingCenterOverview";
import ResourcePlanningGridClient from "@/components/admin/training/planning-grid/ResourcePlanningGridClient";
import TrainingSeriesListView from "@/components/admin/training/TrainingSeriesListView";
import { fetchPlanningGridData, normalizePlanningGridFilters } from "@/lib/training/planning-grid/data-service";
import type { PlanningResourceCategoryKey } from "@/lib/training/planning-grid/types";
import { cn } from "@/lib/cn";

type TrainingPageSearchParams = {
  tab?: string;
  archived?: string;
  view?: string;
  month?: string;
  week?: string;
  day?: string;
  filter?: string;
  category?: string;
  facility?: string;
  team?: string;
  conflicts?: string;
  unallocated?: string;
};

type Props = {
  searchParams?: Promise<TrainingPageSearchParams>;
};

const TOP_TABS: { key: "kalender" | "planungsraster" | "serien"; label: string }[] = [
  { key: "kalender", label: "Kalender" },
  { key: "planungsraster", label: "Planungsraster" },
  { key: "serien", label: "Serien" },
];

export default async function TrainingCenterPage({ searchParams }: Props) {
  // ADMIN-DELETE-02A-C1: a delegated user may hold trainings.delete without
  // trainings.view/trainings.manage — they must still be able to reach the
  // actual Serien-Verwaltung list to exercise the permanent-delete action
  // gated below (mirrors app/(admin)/dashboard/training/series/[seriesId]/
  // edit/page.tsx, ADMIN-DELETE-02A).
  const session = await requireAnyPermission([
    PERMISSIONS.TRAININGS_VIEW,
    PERMISSIONS.TRAININGS_MANAGE,
    PERMISSIONS.TRAININGS_DELETE,
  ]);

  const tenantContext = await getActiveTenant();
  if (!tenantContext) notFound();

  const canManage = hasPermission(session, PERMISSIONS.TRAININGS_MANAGE);
  // ORG-ACCESS-03: canCreate is broader than canManage — includes users with
  // TRAININGS_VIEW at tenant level who may have OrgUnit-scoped write capability.
  // The create page will show a "no teams" message if no writable teams exist.
  const canCreate = canManage || hasPermission(session, PERMISSIONS.TRAININGS_VIEW);
  // ADMIN-DELETE-02A-C1: permanent "Endgültig löschen" gating in the actual
  // Serien-Verwaltung list — deliberately independent of trainings.manage
  // (manage alone must never authorize permanent deletion).
  const canDelete = hasPermission(session, PERMISSIONS.TRAININGS_DELETE);
  const params: TrainingPageSearchParams = searchParams ? await searchParams : {};
  const tab =
    params.tab === "serien" ? "serien" : params.tab === "planungsraster" ? "planungsraster" : "kalender";
  const timezone = tenantContext.timezone ?? TRAINING_DEFAULT_TIMEZONE;
  const locale = tenantContext.locale ?? "de-CH";

  if (tab === "planungsraster") {
    const planningData = await fetchPlanningGridData({
      tenantId: tenantContext.id,
      timezone,
      dateParam: params.day,
      category: (params.category?.toUpperCase() as PlanningResourceCategoryKey | undefined) ?? null,
      filters: normalizePlanningGridFilters({
        facilityId: params.facility ?? null,
        teamSeasonId: params.team ?? null,
        conflictsOnly: params.conflicts === "1",
        unallocatedOnly: params.unallocated === "1",
      }),
    });

    return (
      <div className="max-w-[1600px] space-y-6">
        <AdminSectionHeader
          eyebrow="Planung"
          title="TrainingCenter"
          description="Kalender, Planungsraster und Serien für alle Trainingsserien."
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
        <ResourcePlanningGridClient
          viewModel={planningData.viewModel}
          dayLabel={formatTrainingDayLabel(planningData.viewModel.date, locale, timezone)}
          dayParam={planningData.dayWindow.param}
          previousDayParam={planningData.dayWindow.previousParam}
          nextDayParam={planningData.dayWindow.nextParam}
          canManage={canManage}
          locale={locale}
          timezone={timezone}
        />
      </div>
    );
  }

  if (tab === "serien") {
    const showArchived = params.archived === "1";
    const allSeries = await listTrainingSeries(tenantContext.id, { includeArchived: true });
    const displayedSeries = showArchived ? allSeries : allSeries.filter((series) => series.status !== "ARCHIVED");
    const archivedCount = allSeries.filter((series) => series.status === "ARCHIVED").length;

    const [cockpitRows, facilities] = await Promise.all([
      buildTrainingSeriesCockpitViewModel(tenantContext.id, displayedSeries),
      getFacilitiesForTenant(tenantContext.id),
    ]);

    function facilityGroupsForTypes(types: readonly string[]): FacilityGroup[] {
      return facilities
        .filter((facility) => facility.status !== "ARCHIVED")
        .map((facility) => ({
          facilityId: facility.id,
          facilityName: facility.name,
          facilityType: facility.type as string,
          resources: facility.resources
            .filter((resource) => resource.status !== "ARCHIVED" && types.includes(resource.type))
            .map((resource) => ({
              id: resource.id,
              name: resource.name,
              code: resource.code,
              type: resource.type,
              facilityId: facility.id,
              facilityName: facility.name,
              facilityType: facility.type as string,
            })),
        }))
        .filter((group) => group.resources.length > 0);
    }

    const pitchFacilityGroups = facilityGroupsForTypes(["FULL_PITCH", "HALF_PITCH"]);
    const dressingRoomFacilityGroups = facilityGroupsForTypes(["DRESSING_ROOM"]);

    return (
      <div className="space-y-6">
        <AdminSectionHeader
          eyebrow="Planung"
          title="TrainingCenter"
          description="Kalender, Planungsraster und Serien für alle Trainingsserien."
          actions={
            canCreate ? (
              <Link href="/dashboard/training/new" className="fca-button-primary inline-flex items-center gap-1.5 text-sm">
                <Plus className="h-3.5 w-3.5" />
                Neue Trainingsserie
              </Link>
            ) : undefined
          }
        />
        <TopTabs active={tab} />
        <TrainingSeriesListView
          cockpitRows={cockpitRows}
          showArchived={showArchived}
          archivedCount={archivedCount}
          canManage={canManage}
          isCoordinator={canManage}
          canDelete={canDelete}
          pitchFacilityGroups={pitchFacilityGroups}
          dressingRoomFacilityGroups={dressingRoomFacilityGroups}
        />
      </div>
    );
  }

  // ── Kalender tab: Monat | Woche | Tag operational overview ─────────────────

  const view = normalizeTrainingCenterView(params.view);
  const actionFilter = normalizeTrainingActionFilter(params.filter);

  // TRAININGCENTER-01B: each window resolves strictly from its own URL
  // param — Month/Week/Day never borrow a reference date from one another.
  // Per the product rule, an absent param always defaults to the current
  // Europe/Zurich month/week/day ("today"), and an explicit param is always
  // preserved as-is. A single shared `now` keeps all three windows (and any
  // cross-tab links built from them) consistent within one request.
  const now = new Date();
  const monthWindow = resolveTrainingMonthWindow({
    monthParam: params.month,
    now,
    timeZone: timezone,
  });
  const weekWindow = resolveTrainingWeekWindow({
    weekParam: params.week,
    now,
    timeZone: timezone,
  });
  const dayWindow = resolveTrainingDayWindow({
    dayParam: params.day,
    now,
    timeZone: timezone,
  });

  const sessionDateBounds = listTrainingSessionDateBounds(view, {
    month: monthWindow,
    week: weekWindow,
    day: dayWindow,
  });

  const [sessions, allocationSummaries, sessionAllocationOverrides] = await Promise.all([
    listTrainingSessions(tenantContext.id, sessionDateBounds),
    listAllocationSummaryByTenant(tenantContext.id),
    listSessionAllocationSummaryByTenant(tenantContext.id),
  ]);

  const viewModel = buildTrainingCenterViewModel(sessions, allocationSummaries, {
    actionFilter,
    sessionAllocationOverrides,
  });

  return (
    <div className="max-w-[1400px] space-y-6">
      <AdminSectionHeader
        eyebrow="Planung"
        title="TrainingCenter"
        description="Kalender, Planungsraster und Serien für alle Trainingsserien."
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

function TopTabs({ active }: { active: "kalender" | "planungsraster" | "serien" }) {
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
