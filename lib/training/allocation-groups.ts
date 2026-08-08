/**
 * lib/training/allocation-groups.ts
 *
 * TRAININGCENTER-01B — UI-only classification of existing FacilityResource
 * types into the TrainingCenter allocation groups shown in the allocation
 * editor:
 *
 *   Spielfeld/Halle  (FULL_PITCH, HALF_PITCH)
 *   Garderobe        (DRESSING_ROOM)
 *   Weitere Ressourcen (everything else, e.g. OTHER)
 *
 * Deliberately reuses the existing FacilityResourceType enum verbatim — no
 * schema change, no new resource model, no change to allocation
 * persistence. This mirrors the exact split already used by
 * lib/training/training-allocation-service.ts (listAllocationSummaryByTenant)
 * and lib/training/operational-state.ts for the "pitch/hall assigned" /
 * "dressing room assigned" open-action checks, so the UI grouping and the
 * operational-state evaluation can never disagree.
 *
 * Pure, synchronous, no I/O.
 */

export type TrainingAllocationGroupKey = "PITCH_HALL" | "DRESSING_ROOM" | "OTHER";

const PITCH_HALL_RESOURCE_TYPES: ReadonlySet<string> = new Set(["FULL_PITCH", "HALF_PITCH"]);
const DRESSING_ROOM_RESOURCE_TYPES: ReadonlySet<string> = new Set(["DRESSING_ROOM"]);

/**
 * Classifies a FacilityResourceType (denormalised as a plain string on
 * TrainingAllocationDto/ResourceOption) into one of the three allocation UI
 * groups. Any type that is not a recognised pitch/hall or dressing-room
 * type — "OTHER", or any future addition — falls into "OTHER" so new
 * resource types never silently disappear from the allocation UI.
 */
export function classifyFacilityResourceType(type: string): TrainingAllocationGroupKey {
  if (PITCH_HALL_RESOURCE_TYPES.has(type)) return "PITCH_HALL";
  if (DRESSING_ROOM_RESOURCE_TYPES.has(type)) return "DRESSING_ROOM";
  return "OTHER";
}

export const TRAINING_ALLOCATION_GROUP_LABELS: Record<TrainingAllocationGroupKey, string> = {
  PITCH_HALL: "Spielfeld / Halle",
  DRESSING_ROOM: "Garderobe",
  OTHER: "Weitere Ressourcen",
};

export const TRAINING_ALLOCATION_GROUP_ORDER: TrainingAllocationGroupKey[] = [
  "PITCH_HALL",
  "DRESSING_ROOM",
  "OTHER",
];

type FacilityGroupLike<R extends { type: string }> = {
  facilityId: string;
  facilityName: string;
  resources: R[];
};

/**
 * Splits facility-grouped resources into the three allocation UI groups,
 * preserving per-facility grouping (via `optgroup`-style rendering) within
 * each. A facility with no matching resources for a given group is dropped
 * from that group's list rather than rendered empty.
 */
export function splitFacilityGroupsByAllocationGroup<R extends { type: string }>(
  facilityGroups: FacilityGroupLike<R>[],
): Record<TrainingAllocationGroupKey, FacilityGroupLike<R>[]> {
  const result = {
    PITCH_HALL: [] as FacilityGroupLike<R>[],
    DRESSING_ROOM: [] as FacilityGroupLike<R>[],
    OTHER: [] as FacilityGroupLike<R>[],
  };

  for (const key of TRAINING_ALLOCATION_GROUP_ORDER) {
    result[key] = facilityGroups
      .map((fg) => ({
        ...fg,
        resources: fg.resources.filter((r) => classifyFacilityResourceType(r.type) === key),
      }))
      .filter((fg) => fg.resources.length > 0);
  }

  return result;
}

/** Splits a flat list of already-allocated resources into the three allocation UI groups. */
export function groupAllocationsByAllocationGroup<A extends { facilityResourceType: string }>(
  allocations: A[],
): Record<TrainingAllocationGroupKey, A[]> {
  const result = { PITCH_HALL: [] as A[], DRESSING_ROOM: [] as A[], OTHER: [] as A[] };
  for (const allocation of allocations) {
    result[classifyFacilityResourceType(allocation.facilityResourceType)].push(allocation);
  }
  return result;
}
