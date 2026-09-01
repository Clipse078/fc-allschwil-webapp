/**
 * lib/training/planning-grid/types.ts
 *
 * TRAINING-CENTER-PREMIUM-03 — generic multi-tenant resource planning grid
 * types. Tenant-facing labels come from configuration; these names are
 * internal/architectural only.
 */

import type { TrainingAllocationGroupKey } from "@/lib/training/allocation-groups";
import type { TrainingSessionDto } from "@/lib/training/types";

/** Which allocatable resource category the grid is showing as vertical lanes. */
export type PlanningResourceCategoryKey = TrainingAllocationGroupKey;

export type PlanningGridPeriod = "DAY" | "WEEK";

export type ResourceLane = {
  resourceId: string;
  resourceName: string;
  resourceCode: string;
  resourceType: string;
  facilityId: string;
  facilityName: string;
  sortOrder: number;
};

export type ResourceGroup = {
  facilityId: string;
  facilityName: string;
  lanes: ResourceLane[];
};

export type ScheduledActivityAllocation = {
  resourceId: string;
  resourceName: string;
  allocationId: string | null;
  isOccurrenceOverride: boolean;
};

export type ResourceConflictType = "RESOURCE_OVERLAP" | "SECONDARY_RESOURCE";

export type ResourceConflict = {
  id: string;
  type: ResourceConflictType;
  resourceId: string;
  resourceName: string;
  startAt: string;
  endAt: string;
  sessionIds: string[];
  activityLabels: string[];
};

export type ScheduledActivityBlock = {
  sessionId: string;
  session: TrainingSessionDto;
  startAt: string;
  endAt: string;
  resourceId: string | null;
  resourceName: string | null;
  allocations: ScheduledActivityAllocation[];
  secondaryResourceLabel: string | null;
  isUnplanned: boolean;
  conflicts: ResourceConflict[];
  hasConflict: boolean;
};

export type PlanningGridFilters = {
  facilityId: string | null;
  teamSeasonId: string | null;
  conflictsOnly: boolean;
  unallocatedOnly: boolean;
};

export type PlanningGridTimeline = {
  /** Minutes from midnight for the left edge of the grid. */
  gridStartMinutes: number;
  /** Minutes from midnight for the right edge of the grid. */
  gridEndMinutes: number;
  slotMinutes: number;
};

export type PlanningGridCategoryOption = {
  key: PlanningResourceCategoryKey;
  label: string;
  resourceCount: number;
};

export type PlanningGridViewModel = {
  date: string;
  period: PlanningGridPeriod;
  category: PlanningResourceCategoryKey;
  timeline: PlanningGridTimeline;
  resourceGroups: ResourceGroup[];
  lanes: ResourceLane[];
  blocks: ScheduledActivityBlock[];
  unplannedBlocks: ScheduledActivityBlock[];
  conflicts: ResourceConflict[];
  conflictCount: number;
  categories: PlanningGridCategoryOption[];
  facilities: { id: string; name: string }[];
  teams: { id: string; name: string }[];
  filters: PlanningGridFilters;
  showFacilityFilter: boolean;
  density: "comfortable" | "normal" | "compact";
};

export type ResourceDropTargetState = "AVAILABLE" | "CONFLICT" | "INVALID_TYPE" | "UNAVAILABLE";

export type ResourceReassignmentScope = "occurrence" | "series";
