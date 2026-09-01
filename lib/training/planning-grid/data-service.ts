/**
 * lib/training/planning-grid/data-service.ts
 *
 * Server-side batched fetch for the planning grid — one round-trip per view.
 */

import { getFacilitiesForTenant } from "@/lib/facilities/queries";
import { resolveTrainingDayWindow, TRAINING_DEFAULT_TIMEZONE } from "@/lib/training/date-range";
import { listTrainingSessions } from "@/lib/training/session-generation-service";
import { listSessionAllocationsGroupedBySession } from "@/lib/training/session-allocation-service";
import { listAllocationsGroupedBySeries } from "@/lib/training/training-allocation-service";
import { derivePlanningCategoryOptions } from "./resource-categories";
import { buildPlanningGridViewModel } from "./projection";
import type { PlanningGridFilters, PlanningGridPeriod, PlanningResourceCategoryKey } from "./types";
import { classifyFacilityResourceType, TRAINING_ALLOCATION_GROUP_ORDER } from "@/lib/training/allocation-groups";

export type FetchPlanningGridInput = {
  tenantId: string;
  timezone?: string;
  dateParam?: string | null;
  period?: PlanningGridPeriod;
  category?: PlanningResourceCategoryKey | null;
  filters?: Partial<PlanningGridFilters>;
  now?: Date;
};

export function normalizePlanningCategory(
  value: string | null | undefined,
  available: { key: PlanningResourceCategoryKey }[],
): PlanningResourceCategoryKey {
  const upper = value?.trim().toUpperCase() as PlanningResourceCategoryKey | undefined;
  if (upper && available.some((a) => a.key === upper)) return upper;
  return available[0]?.key ?? "PITCH_HALL";
}

export function normalizePlanningGridFilters(
  params: Partial<PlanningGridFilters> = {},
): PlanningGridFilters {
  return {
    facilityId: params.facilityId ?? null,
    teamSeasonId: params.teamSeasonId ?? null,
    conflictsOnly: Boolean(params.conflictsOnly),
    unallocatedOnly: Boolean(params.unallocatedOnly),
  };
}

export async function fetchPlanningGridData(input: FetchPlanningGridInput) {
  const timezone = input.timezone ?? TRAINING_DEFAULT_TIMEZONE;
  const now = input.now ?? new Date();
  const dayWindow = resolveTrainingDayWindow({
    dayParam: input.dateParam,
    now,
    timeZone: timezone,
  });

  const dayBound = new Date(`${dayWindow.date}T00:00:00.000Z`);

  const [facilities, sessions, seriesAllocations, sessionOverrides] = await Promise.all([
    getFacilitiesForTenant(input.tenantId),
    listTrainingSessions(input.tenantId, { dateFrom: dayBound, dateTo: dayBound }),
    listAllocationsGroupedBySeries(input.tenantId),
    listSessionAllocationsGroupedBySession(input.tenantId),
  ]);

  const facilityInput = facilities.map((facility) => ({
    id: facility.id,
    name: facility.name,
    status: facility.status,
    resources: facility.resources.map((resource) => ({
      id: resource.id,
      name: resource.name,
      code: resource.code,
      type: resource.type,
      status: resource.status,
      sortOrder: resource.sortOrder,
    })),
  }));

  const categories = derivePlanningCategoryOptions(facilityInput);
  const category = normalizePlanningCategory(input.category ?? null, categories);
  const filters = normalizePlanningGridFilters(input.filters);

  const teamMap = new Map<string, string>();
  for (const session of sessions) {
    if (!teamMap.has(session.teamSeasonId)) {
      teamMap.set(session.teamSeasonId, session.teamName);
    }
  }
  const teams = [...teamMap.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const viewModel = buildPlanningGridViewModel({
    date: dayWindow.date,
    period: input.period ?? "DAY",
    category,
    facilities: facilityInput,
    sessions,
    allocations: {
      seriesAllocationsBySeries: seriesAllocations,
      sessionOverridesBySession: sessionOverrides,
    },
    filters,
    categories,
    teams,
    timeZone: timezone,
  });

  return {
    viewModel,
    dayWindow: {
      param: dayWindow.param,
      previousParam: dayWindow.previousParam,
      nextParam: dayWindow.nextParam,
      label: dayWindow.date,
    },
    categories,
    defaultCategory: category,
  };
}

export function isValidPlanningCategory(value: string): value is PlanningResourceCategoryKey {
  return (TRAINING_ALLOCATION_GROUP_ORDER as readonly string[]).includes(value);
}

export function categoryMatchesResourceType(category: PlanningResourceCategoryKey, resourceType: string): boolean {
  return classifyFacilityResourceType(resourceType) === category;
}
