/**
 * lib/training/planning-grid/resource-categories.ts
 *
 * Derives tenant-visible resource category options from canonical facility
 * data — no hard-coded pitch/dressing-room assumptions beyond the existing
 * allocation-group classifier shared with TrainingCenter.
 */

import {
  classifyFacilityResourceType,
  TRAINING_ALLOCATION_GROUP_LABELS,
  TRAINING_ALLOCATION_GROUP_ORDER,
  type TrainingAllocationGroupKey,
} from "@/lib/training/allocation-groups";

export type ResourceLike = {
  id: string;
  name: string;
  code?: string | null;
  type: string;
  status?: string;
  sortOrder?: number;
};

export type FacilityLike = {
  id: string;
  name: string;
  status?: string;
  resources: ResourceLike[];
};

export function derivePlanningCategoryOptions(
  facilities: readonly FacilityLike[],
): { key: TrainingAllocationGroupKey; label: string; resourceCount: number }[] {
  const counts: Record<TrainingAllocationGroupKey, number> = {
    PITCH_HALL: 0,
    DRESSING_ROOM: 0,
    OTHER: 0,
  };

  for (const facility of facilities) {
    if (facility.status === "ARCHIVED") continue;
    for (const resource of facility.resources) {
      if (resource.status === "ARCHIVED") continue;
      counts[classifyFacilityResourceType(resource.type)] += 1;
    }
  }

  return TRAINING_ALLOCATION_GROUP_ORDER.map((key) => ({
    key,
    label: TRAINING_ALLOCATION_GROUP_LABELS[key],
    resourceCount: counts[key],
  })).filter((option) => option.resourceCount > 0);
}

export function resourceMatchesCategory(type: string, category: TrainingAllocationGroupKey): boolean {
  return classifyFacilityResourceType(type) === category;
}
