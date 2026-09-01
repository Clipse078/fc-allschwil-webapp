/**
 * lib/training/planning-grid/projection.ts
 *
 * Pure projection from canonical training + facility data into a
 * TIME × RESOURCE × ACTIVITY planning grid. No I/O.
 */

import {
  classifyFacilityResourceType,
  type TrainingAllocationGroupKey,
} from "@/lib/training/allocation-groups";
import type { TrainingAllocationDto, TrainingSessionAllocationDto, TrainingSessionDto } from "@/lib/training/types";
import { attachConflictsToBlocks, detectResourceConflicts, type ConflictOccupancy } from "./conflicts";
import { resourceMatchesCategory, type FacilityLike } from "./resource-categories";
import type {
  PlanningGridFilters,
  PlanningGridPeriod,
  PlanningGridTimeline,
  PlanningGridViewModel,
  PlanningResourceCategoryKey,
  ResourceGroup,
  ResourceLane,
  ScheduledActivityAllocation,
  ScheduledActivityBlock,
} from "./types";

const DEFAULT_SLOT_MINUTES = 15;
const DEFAULT_GRID_START_MINUTES = 6 * 60;
const DEFAULT_GRID_END_MINUTES = 22 * 60;

export type AllocationInput = {
  seriesAllocationsBySeries: ReadonlyMap<string, readonly TrainingAllocationDto[]>;
  sessionOverridesBySession: ReadonlyMap<string, readonly TrainingSessionAllocationDto[]>;
};

function parseTimeToMinutes(iso: string, timeZone = "Europe/Zurich"): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(iso));
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? 0);
  return hour * 60 + minute;
}

/** Expands grid bounds to fit all sessions with padding. */
export function resolveTimeline(
  sessions: readonly TrainingSessionDto[],
  slotMinutes = DEFAULT_SLOT_MINUTES,
  timeZone = "Europe/Zurich",
): PlanningGridTimeline {
  let minMinutes = DEFAULT_GRID_START_MINUTES;
  let maxMinutes = DEFAULT_GRID_END_MINUTES;

  for (const session of sessions) {
    if (session.status !== "SCHEDULED") continue;
    const start = parseTimeToMinutes(session.startAt, timeZone);
    const end = parseTimeToMinutes(session.endAt, timeZone);
    minMinutes = Math.min(minMinutes, Math.floor(start / slotMinutes) * slotMinutes - slotMinutes);
    maxMinutes = Math.max(maxMinutes, Math.ceil(end / slotMinutes) * slotMinutes + slotMinutes);
  }

  minMinutes = Math.max(0, minMinutes);
  maxMinutes = Math.min(24 * 60, Math.max(maxMinutes, minMinutes + slotMinutes * 4));

  return { gridStartMinutes: minMinutes, gridEndMinutes: maxMinutes, slotMinutes };
}

export function buildResourceLanes(
  facilities: readonly FacilityLike[],
  category: PlanningResourceCategoryKey,
  filters: PlanningGridFilters,
): { lanes: ResourceLane[]; resourceGroups: ResourceGroup[] } {
  const resourceGroups: ResourceGroup[] = [];

  for (const facility of facilities) {
    if (facility.status === "ARCHIVED") continue;
    if (filters.facilityId && facility.id !== filters.facilityId) continue;

    const lanes: ResourceLane[] = [];
    for (const [index, resource] of facility.resources.entries()) {
      if (resource.status === "ARCHIVED") continue;
      if (!resourceMatchesCategory(resource.type, category)) continue;

      lanes.push({
        resourceId: resource.id,
        resourceName: resource.name,
        resourceCode: resource.code ?? "",
        resourceType: resource.type,
        facilityId: facility.id,
        facilityName: facility.name,
        sortOrder: resource.sortOrder ?? index,
      });
    }

    if (lanes.length > 0) {
      lanes.sort((a, b) => a.sortOrder - b.sortOrder || a.resourceName.localeCompare(b.resourceName));
      resourceGroups.push({ facilityId: facility.id, facilityName: facility.name, lanes });
    }
  }

  const flatLanes = resourceGroups.flatMap((group) => group.lanes);
  return { lanes: flatLanes, resourceGroups };
}

function resolveEffectiveAllocationsForGroup(
  sessionId: string,
  seriesId: string,
  group: TrainingAllocationGroupKey,
  allocations: AllocationInput,
): ScheduledActivityAllocation[] {
  const overrides = (allocations.sessionOverridesBySession.get(sessionId) ?? []).filter(
    (row) => classifyFacilityResourceType(row.facilityResourceType) === group,
  );

  if (overrides.length > 0) {
    return overrides.map((row) => ({
      resourceId: row.facilityResourceId,
      resourceName: row.facilityResourceName,
      allocationId: row.id,
      isOccurrenceOverride: true,
    }));
  }

  const seriesRows = (allocations.seriesAllocationsBySeries.get(seriesId) ?? []).filter(
    (row) => classifyFacilityResourceType(row.facilityResourceType) === group,
  );

  return seriesRows.map((row) => ({
    resourceId: row.facilityResourceId,
    resourceName: row.facilityResourceName,
    allocationId: row.id,
    isOccurrenceOverride: false,
  }));
}

function resolveSecondaryResourceLabel(
  sessionId: string,
  seriesId: string,
  activeCategory: PlanningResourceCategoryKey,
  allocations: AllocationInput,
): string | null {
  const secondaryGroups: TrainingAllocationGroupKey[] =
    activeCategory === "PITCH_HALL"
      ? ["DRESSING_ROOM"]
      : activeCategory === "DRESSING_ROOM"
        ? ["PITCH_HALL"]
        : ["PITCH_HALL", "DRESSING_ROOM"];

  const labels: string[] = [];
  for (const group of secondaryGroups) {
    const secondary = resolveEffectiveAllocationsForGroup(sessionId, seriesId, group, allocations);
    labels.push(...secondary.map((a) => a.resourceName));
  }
  return labels.length > 0 ? labels.join(", ") : null;
}

function isUnplannedForCategory(
  session: TrainingSessionDto,
  category: PlanningResourceCategoryKey,
  effectiveAllocations: ScheduledActivityAllocation[],
): boolean {
  if (session.status !== "SCHEDULED") return false;
  if (category === "OTHER") return effectiveAllocations.length === 0;
  if (category === "PITCH_HALL") return effectiveAllocations.length === 0;
  if (category === "DRESSING_ROOM") return effectiveAllocations.length === 0;
  return false;
}

export function buildScheduledActivityBlocks(
  sessions: readonly TrainingSessionDto[],
  category: PlanningResourceCategoryKey,
  allocations: AllocationInput,
): ScheduledActivityBlock[] {
  return sessions
    .filter((session) => session.status === "SCHEDULED")
    .map((session) => {
      const effective = resolveEffectiveAllocationsForGroup(
        session.id,
        session.trainingSeriesId,
        category,
        allocations,
      );
      const primary = effective[0] ?? null;
      const unplanned = isUnplannedForCategory(session, category, effective);

      return {
        sessionId: session.id,
        session,
        startAt: session.startAt,
        endAt: session.endAt,
        resourceId: primary?.resourceId ?? null,
        resourceName: primary?.resourceName ?? null,
        allocations: effective,
        secondaryResourceLabel: resolveSecondaryResourceLabel(
          session.id,
          session.trainingSeriesId,
          category,
          allocations,
        ),
        isUnplanned: unplanned,
        conflicts: [],
        hasConflict: false,
      };
    });
}

export function deriveAdaptiveDensity(laneCount: number): "comfortable" | "normal" | "compact" {
  if (laneCount <= 5) return "comfortable";
  if (laneCount <= 15) return "normal";
  return "compact";
}

export type BuildPlanningGridInput = {
  date: string;
  period: PlanningGridPeriod;
  category: PlanningResourceCategoryKey;
  facilities: readonly FacilityLike[];
  sessions: readonly TrainingSessionDto[];
  allocations: AllocationInput;
  filters: PlanningGridFilters;
  categories: { key: PlanningResourceCategoryKey; label: string; resourceCount: number }[];
  teams: { id: string; name: string }[];
  timeZone?: string;
};

export function buildPlanningGridViewModel(input: BuildPlanningGridInput): PlanningGridViewModel {
  const daySessions = input.sessions.filter((session) => session.date === input.date);
  const filteredByTeam = input.filters.teamSeasonId
    ? daySessions.filter((session) => session.teamSeasonId === input.filters.teamSeasonId)
    : daySessions;

  const { lanes, resourceGroups } = buildResourceLanes(input.facilities, input.category, input.filters);
  const timeline = resolveTimeline(filteredByTeam, DEFAULT_SLOT_MINUTES, input.timeZone ?? "Europe/Zurich");

  let blocks = buildScheduledActivityBlocks(filteredByTeam, input.category, input.allocations);

  const occupancies: ConflictOccupancy[] = [];
  for (const block of blocks) {
    if (block.isUnplanned || !block.resourceId) continue;
    occupancies.push({
      sessionId: block.sessionId,
      teamName: block.session.teamName,
      trainingSeriesTitle: block.session.trainingSeriesTitle,
      resourceId: block.resourceId,
      resourceName: block.resourceName ?? "",
      startAt: block.startAt,
      endAt: block.endAt,
    });
  }

  const conflicts = detectResourceConflicts(occupancies);
  blocks = attachConflictsToBlocks(blocks, conflicts);

  const unplannedBlocks = blocks.filter((block) => block.isUnplanned);
  const plannedBlocks = blocks.filter((block) => !block.isUnplanned);

  let visibleBlocks = plannedBlocks;
  if (input.filters.conflictsOnly) {
    visibleBlocks = plannedBlocks.filter((block) => block.hasConflict);
  }
  if (input.filters.unallocatedOnly) {
    visibleBlocks = unplannedBlocks;
  }

  const activeFacilities = input.facilities.filter((f) => f.status !== "ARCHIVED");
  const showFacilityFilter = activeFacilities.length > 1;

  return {
    date: input.date,
    period: input.period,
    category: input.category,
    timeline,
    resourceGroups,
    lanes,
    blocks: input.filters.unallocatedOnly ? [] : visibleBlocks,
    unplannedBlocks: input.filters.unallocatedOnly ? unplannedBlocks : unplannedBlocks,
    conflicts,
    conflictCount: conflicts.length,
    categories: input.categories,
    facilities: activeFacilities.map((f) => ({ id: f.id, name: f.name })),
    teams: input.teams,
    filters: input.filters,
    showFacilityFilter,
    density: deriveAdaptiveDensity(lanes.length),
  };
}

export function blockPositionStyle(
  block: Pick<ScheduledActivityBlock, "startAt" | "endAt">,
  timeline: PlanningGridTimeline,
  timeZone = "Europe/Zurich",
): { leftPercent: number; widthPercent: number } {
  const start = parseTimeToMinutes(block.startAt, timeZone);
  const end = parseTimeToMinutes(block.endAt, timeZone);
  const span = timeline.gridEndMinutes - timeline.gridStartMinutes;
  if (span <= 0) return { leftPercent: 0, widthPercent: 100 };

  const left = ((start - timeline.gridStartMinutes) / span) * 100;
  const width = ((end - start) / span) * 100;
  return {
    leftPercent: Math.max(0, Math.min(100, left)),
    widthPercent: Math.max(1.5, Math.min(100 - left, width)),
  };
}

export function formatTimelineLabel(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function buildTimelineTicks(timeline: PlanningGridTimeline): number[] {
  const ticks: number[] = [];
  for (let m = timeline.gridStartMinutes; m <= timeline.gridEndMinutes; m += timeline.slotMinutes) {
    ticks.push(m);
  }
  return ticks;
}
