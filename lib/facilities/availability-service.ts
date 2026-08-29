/**
 * lib/facilities/availability-service.ts
 *
 * PLANNING-CREATION-UX-01A — provider-neutral live resource availability
 * for guided creation flows (TrainingCenter / MatchCenter / TournamentCenter
 * share this foundation; this slice wires it up in TournamentCenter only).
 *
 * NOT a new generic planning engine — this is a thin READ aggregator over
 * the three EXISTING canonical booking sources, reusing the same overlap
 * primitive already used by the Wochenplan conflict engine
 * (lib/facilities/allocation-rules.ts#timeRangesOverlap):
 *
 *   - TrainingSession (+ TRAININGCENTER-02 occurrence-level overrides via
 *     TrainingSessionAllocation, falling back to the TrainingSeries'
 *     TrainingAllocation default — same override-by-presence-per-group rule
 *     as lib/training/session-allocation-service.ts).
 *   - Event(type=MATCH) — still the legacy Wochenplan V1 pitchCode /
 *     homeDressingRoomCode / awayDressingRoomCode string fields (not
 *     migrated to FacilityResource ids yet — out of scope for this slice,
 *     see lib/wochenplan/conflict-engine.ts for the sibling read path).
 *   - Event(type=TOURNAMENT) via the canonical TournamentResourceAllocation
 *     (Spielfeld/Halle) and TournamentParticipantAllocation (per-participant
 *     Garderobe) — TOURNAMENTCENTER-01B.
 *
 * Security invariants:
 *   - tenantId always comes from a trusted session context — never from input.
 *   - Every query below is scoped by tenantId.
 *   - Archived FacilityResources (and resources of an archived Facility)
 *     are never returned.
 */

import { prisma } from "@/lib/db/prisma";
import type { FacilityResourceType } from "@prisma/client";
import { timeRangesOverlap } from "@/lib/facilities/allocation-rules";
import { computeResourceOccupancyWindow, isMeaningfulEventInterval } from "@/lib/facilities/resource-occupancy-window";
import { classifyFacilityResourceType, type TrainingAllocationGroupKey } from "@/lib/training/allocation-groups";
import {
  findWeekplannerPlanConflicts,
  findWeekplannerReplacedActivities,
  shouldExcludeCanonicalEvent,
  shouldExcludeCanonicalTraining,
} from "@/lib/weekplanner/availability-integration";
import type { WeekplannerActivityType } from "@/lib/weekplanner/plan-types";

// ── Public types ─────────────────────────────────────────────────────────────

/** The two allocation groups this slice's guided-creation UIs care about. */
export type AvailabilityResourceGroup = Extract<TrainingAllocationGroupKey, "PITCH_HALL" | "DRESSING_ROOM">;

export type ResourceAvailabilityStatus = "FREE" | "OCCUPIED";

export type ResourceAvailabilityConflictSource = "TRAINING" | "MATCH" | "TOURNAMENT";

export type ResourceAvailabilityConflictDetail = {
  label: string;
  startAt: string;
  endAt: string;
  sourceType: ResourceAvailabilityConflictSource;
};

export type ResourceAvailability = {
  resourceId: string;
  resourceName: string;
  /** RESOURCE-AVAILABILITY-UX-01 — the resource's canonical code, so callers that only carry legacy `code` values (e.g. MatchCenter's Event.pitchCode) can match rows without a second lookup. */
  resourceCode: string;
  facilityId: string;
  facilityName: string;
  status: ResourceAvailabilityStatus;
  conflictLabel: string | null;
  conflictStartAt: string | null;
  conflictEndAt: string | null;
  conflictSourceType: ResourceAvailabilityConflictSource | null;
  conflicts: ResourceAvailabilityConflictDetail[];
};

export type GetResourceAvailabilityInput = {
  /** Trusted tenant context — never accept this from client-supplied input. */
  tenantId: string;
  startAt: Date | string;
  endAt: Date | string | null;
  group: AvailabilityResourceGroup;
  /** Excludes bookings belonging to this Event (e.g. the Match/Tournament being edited). */
  excludeEventId?: string;
  /**
   * RESOURCE-AVAILABILITY-UX-01 — excludes this TrainingSession's OWN
   * occurrence (and its allocations/overrides) from conflict detection, so
   * editing a session's resources never flags its own existing booking as
   * a conflict with itself. TrainingSession is not an Event, so this is a
   * separate exclusion key from `excludeEventId`.
   */
  excludeTrainingSessionId?: string;
  /** WOCHENPLAN-2.0-01H-E2 — expands the query window before event start. */
  occupancyBeforeMinutes?: number;
  /** WOCHENPLAN-2.0-01H-E2 — expands the query window after event end. */
  occupancyAfterMinutes?: number;
  /** WOCHENPLAN-2.0-01H-E2 — weekplanner plan context for effective-state resolution. */
  weekplannerPlanId?: string;
  excludeWeekplannerActivityType?: WeekplannerActivityType;
  excludeWeekplannerActivityId?: string;
};

// ── Internal helpers ─────────────────────────────────────────────────────────

const RESOURCE_TYPES_BY_GROUP: Record<AvailabilityResourceGroup, FacilityResourceType[]> = {
  PITCH_HALL: ["FULL_PITCH", "HALF_PITCH"],
  DRESSING_ROOM: ["DRESSING_ROOM"],
};

type ConflictWindow = {
  resourceId: string;
  label: string;
  startAt: Date;
  endAt: Date;
  sourceType: ResourceAvailabilityConflictSource;
};

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

/**
 * Resolves training-occurrence conflicts overlapping [startAt, endAt] for
 * the given group, honoring the TRAININGCENTER-02 override-by-presence rule:
 * a session's own overrides for this group win when present, otherwise the
 * parent series' default allocation applies.
 */
async function findTrainingConflicts(
  tenantId: string,
  startAt: Date,
  endAt: Date,
  group: AvailabilityResourceGroup,
  excludeTrainingSessionId: string | undefined,
  replacedActivities: ReadonlySet<string>,
): Promise<ConflictWindow[]> {
  const sessions = await prisma.trainingSession.findMany({
    where: {
      tenantId,
      status: "SCHEDULED",
      id: excludeTrainingSessionId ? { not: excludeTrainingSessionId } : undefined,
      OR: [
        { overrideStartAt: null, startAt: { lt: endAt }, endAt: { gt: startAt } },
        {
          AND: [{ overrideStartAt: { not: null, lt: endAt } }, { overrideEndAt: { gt: startAt } }],
        },
      ],
    },
    select: {
      id: true,
      startAt: true,
      endAt: true,
      overrideStartAt: true,
      overrideEndAt: true,
      trainingSeries: {
        select: {
          title: true,
          allocations: {
            select: { facilityResourceId: true, facilityResource: { select: { type: true } } },
          },
        },
      },
      sessionAllocations: {
        select: { facilityResourceId: true, facilityResource: { select: { type: true } } },
      },
    },
  });

  const conflicts: ConflictWindow[] = [];

  for (const session of sessions) {
    if (shouldExcludeCanonicalTraining(session.id, replacedActivities)) continue;

    const effectiveStart = session.overrideStartAt ?? session.startAt;
    const effectiveEnd = session.overrideEndAt ?? session.endAt;

    const overridesForGroup = session.sessionAllocations.filter(
      (a) => classifyFacilityResourceType(a.facilityResource.type) === group,
    );
    const effectiveAllocations =
      overridesForGroup.length > 0
        ? overridesForGroup
        : session.trainingSeries.allocations.filter(
            (a) => classifyFacilityResourceType(a.facilityResource.type) === group,
          );

    for (const allocation of effectiveAllocations) {
      conflicts.push({
        resourceId: allocation.facilityResourceId,
        label: session.trainingSeries.title,
        startAt: effectiveStart,
        endAt: effectiveEnd,
        sourceType: "TRAINING",
      });
    }
  }

  return conflicts;
}

/**
 * Resolves Match conflicts overlapping [startAt, endAt] for the given group.
 * MatchCenter still books via the legacy Wochenplan V1 pitchCode /
 * home|awayDressingRoomCode string fields on Event — matched against
 * FacilityResource.code (deliberately NOT migrated in this slice, see
 * module doc comment above).
 */
async function findMatchConflicts(
  tenantId: string,
  startAt: Date,
  endAt: Date,
  group: AvailabilityResourceGroup,
  resourcesByCode: Map<string, string>,
  excludeEventId: string | undefined,
  replacedActivities: ReadonlySet<string>,
): Promise<ConflictWindow[]> {
  const events = await prisma.event.findMany({
    where: {
      tenantId,
      type: "MATCH",
      id: excludeEventId ? { not: excludeEventId } : undefined,
      startAt: { lt: endAt },
    },
    select: {
      id: true,
      title: true,
      opponentName: true,
      startAt: true,
      endAt: true,
      pitchCode: true,
      homeDressingRoomCode: true,
      awayDressingRoomCode: true,
    },
  });

  const conflicts: ConflictWindow[] = [];

  for (const event of events) {
    if (shouldExcludeCanonicalEvent(event.id, "MATCH", replacedActivities)) continue;

    if (!timeRangesOverlap({ startA: startAt, endA: endAt, startB: event.startAt, endB: event.endAt })) {
      continue;
    }

    const label = event.opponentName ? `vs. ${event.opponentName}` : event.title;
    const effectiveStart = event.startAt;
    const effectiveEnd = event.endAt ?? event.startAt;
    if (!isMeaningfulEventInterval(effectiveStart, effectiveEnd)) continue;

    const codes = group === "PITCH_HALL" ? [event.pitchCode] : [event.homeDressingRoomCode, event.awayDressingRoomCode];

    for (const code of codes) {
      if (!code) continue;
      const resourceId = resourcesByCode.get(code);
      if (!resourceId) continue;
      conflicts.push({ resourceId, label, startAt: effectiveStart, endAt: effectiveEnd, sourceType: "MATCH" });
    }
  }

  return conflicts;
}

/**
 * Resolves Tournament conflicts overlapping [startAt, endAt] for the given
 * group, via the canonical TournamentResourceAllocation (Spielfeld/Halle)
 * and TournamentParticipantAllocation (per-participant Garderobe) tables.
 */
async function findTournamentConflicts(
  tenantId: string,
  startAt: Date,
  endAt: Date,
  group: AvailabilityResourceGroup,
  candidateResourceIds: string[],
  excludeEventId: string | undefined,
  replacedActivities: ReadonlySet<string>,
): Promise<ConflictWindow[]> {
  if (candidateResourceIds.length === 0) return [];

  const conflicts: ConflictWindow[] = [];

  if (group === "PITCH_HALL") {
    const rows = await prisma.tournamentResourceAllocation.findMany({
      where: {
        tenantId,
        facilityResourceId: { in: candidateResourceIds },
        event: excludeEventId ? { id: { not: excludeEventId } } : undefined,
      },
      select: {
        facilityResourceId: true,
        event: { select: { id: true, title: true, startAt: true, endAt: true } },
      },
    });

    for (const row of rows) {
      if (shouldExcludeCanonicalEvent(row.event.id, "TOURNAMENT", replacedActivities)) continue;

      if (!timeRangesOverlap({ startA: startAt, endA: endAt, startB: row.event.startAt, endB: row.event.endAt })) {
        continue;
      }
      conflicts.push({
        resourceId: row.facilityResourceId,
        label: row.event.title,
        startAt: row.event.startAt,
        endAt: row.event.endAt ?? row.event.startAt,
        sourceType: "TOURNAMENT",
      });
    }

    return conflicts;
  }

  // DRESSING_ROOM — per tournament PARTICIPANT allocation.
  const rows = await prisma.tournamentParticipantAllocation.findMany({
    where: {
      tenantId,
      facilityResourceId: { in: candidateResourceIds },
      tournamentParticipant: excludeEventId ? { event: { id: { not: excludeEventId } } } : undefined,
    },
    select: {
      facilityResourceId: true,
      tournamentParticipant: {
        select: {
          team: { select: { name: true } },
          externalTeam: { select: { name: true } },
          externalClub: { select: { name: true } },
          displayName: true,
          manualLabel: true,
          event: { select: { id: true, title: true, startAt: true, endAt: true } },
        },
      },
    },
  });

  for (const row of rows) {
    const participant = row.tournamentParticipant;
    if (shouldExcludeCanonicalEvent(participant.event.id, "TOURNAMENT", replacedActivities)) continue;

    if (!timeRangesOverlap({
      startA: startAt,
      endA: endAt,
      startB: participant.event.startAt,
      endB: participant.event.endAt,
    })) {
      continue;
    }
    const participantLabel =
      participant.team?.name ??
      participant.externalTeam?.name ??
      (participant.displayName?.trim() || participant.externalClub?.name) ??
      participant.manualLabel ??
      participant.event.title;
    conflicts.push({
      resourceId: row.facilityResourceId,
      label: `${participantLabel} · ${participant.event.title}`,
      startAt: participant.event.startAt,
      endAt: participant.event.endAt ?? participant.event.startAt,
      sourceType: "TOURNAMENT",
    });
  }

  return conflicts;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Answers, for every non-archived FacilityResource of the given group
 * belonging to the tenant, whether it is FREE or OCCUPIED for the supplied
 * [startAt, endAt] interval — and if OCCUPIED, by what (label, window,
 * source type).
 *
 * When more than one conflicting booking exists for a resource, the
 * earliest-starting conflict is surfaced (deterministic, simple — this is a
 * display aggregator, not a scheduling engine).
 */
export async function getResourceAvailability(
  input: GetResourceAvailabilityInput,
): Promise<ResourceAvailability[]> {
  const {
    tenantId,
    group,
    excludeEventId,
    excludeTrainingSessionId,
    weekplannerPlanId,
    excludeWeekplannerActivityType,
    excludeWeekplannerActivityId,
  } = input;
  const eventStartAt = toDate(input.startAt);
  const eventEndAt = input.endAt ? toDate(input.endAt) : eventStartAt;

  if (!isMeaningfulEventInterval(eventStartAt, eventEndAt)) {
    const resources = await prisma.facilityResource.findMany({
      where: {
        tenantId,
        type: { in: RESOURCE_TYPES_BY_GROUP[group] },
        status: { not: "ARCHIVED" },
        facility: { status: { not: "ARCHIVED" } },
      },
      select: {
        id: true,
        name: true,
        code: true,
        facilityId: true,
        facility: { select: { name: true } },
      },
      orderBy: [{ facility: { sortOrder: "asc" } }, { sortOrder: "asc" }, { name: "asc" }],
    });

    return resources.map((resource) => ({
      resourceId: resource.id,
      resourceName: resource.name,
      resourceCode: resource.code,
      facilityId: resource.facilityId,
      facilityName: resource.facility.name,
      status: "FREE" as const,
      conflictLabel: null,
      conflictStartAt: null,
      conflictEndAt: null,
      conflictSourceType: null,
      conflicts: [],
    }));
  }

  const queryWindow = computeResourceOccupancyWindow(
    eventStartAt,
    eventEndAt,
    input.occupancyBeforeMinutes ?? 0,
    input.occupancyAfterMinutes ?? 0,
  );
  const startAt = queryWindow.effectiveStartAt;
  const endAt = queryWindow.effectiveEndAt;

  const replacedActivities =
    weekplannerPlanId != null
      ? await findWeekplannerReplacedActivities(tenantId, weekplannerPlanId, group)
      : new Set<string>();

  const resources = await prisma.facilityResource.findMany({
    where: {
      tenantId,
      type: { in: RESOURCE_TYPES_BY_GROUP[group] },
      status: { not: "ARCHIVED" },
      facility: { status: { not: "ARCHIVED" } },
    },
    select: {
      id: true,
      name: true,
      code: true,
      type: true,
      facilityId: true,
      facility: { select: { name: true } },
    },
    orderBy: [{ facility: { sortOrder: "asc" } }, { sortOrder: "asc" }, { name: "asc" }],
  });

  if (resources.length === 0) return [];

  const resourcesByCode = new Map(resources.map((r) => [r.code, r.id]));
  const resourceRefsByCode = new Map(
    resources.map((r) => [
      r.code,
      {
        facilityResourceId: r.id,
        code: r.code,
        name: r.name,
        facilityName: r.facility.name,
        occupancyBeforeMinutes: 0,
        occupancyAfterMinutes: 0,
      },
    ]),
  );
  const resourceIds = resources.map((r) => r.id);

  const useEffectivePlanOccupancy = weekplannerPlanId != null;

  const [trainingConflicts, matchConflicts, tournamentConflicts, weekplannerConflicts] = await Promise.all([
    useEffectivePlanOccupancy
      ? Promise.resolve([])
      : findTrainingConflicts(tenantId, startAt, endAt, group, excludeTrainingSessionId, replacedActivities),
    useEffectivePlanOccupancy
      ? Promise.resolve([])
      : findMatchConflicts(tenantId, startAt, endAt, group, resourcesByCode, excludeEventId, replacedActivities),
    useEffectivePlanOccupancy
      ? Promise.resolve([])
      : findTournamentConflicts(tenantId, startAt, endAt, group, resourceIds, excludeEventId, replacedActivities),
    weekplannerPlanId
      ? findWeekplannerPlanConflicts(tenantId, startAt, endAt, group, {
          weekplannerPlanId,
          excludeActivityType: excludeWeekplannerActivityType,
          excludeActivityId: excludeWeekplannerActivityId,
        }, resourceRefsByCode)
      : Promise.resolve([]),
  ]);

  const conflictsByResourceId = new Map<string, ConflictWindow[]>();
  for (const conflict of [
    ...trainingConflicts,
    ...matchConflicts,
    ...tournamentConflicts,
    ...weekplannerConflicts,
  ]) {
    const list = conflictsByResourceId.get(conflict.resourceId) ?? [];
    list.push(conflict);
    conflictsByResourceId.set(conflict.resourceId, list);
  }

  for (const [resourceId, list] of conflictsByResourceId) {
    list.sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
    conflictsByResourceId.set(resourceId, list);
  }

  // FULL/HALF pitch derived availability rules (PLANNING-RESOURCE-UX-01-C2):
  //   - FULL_PITCH occupied → all sibling HALF_PITCH in the same facility unavailable
  //   - Any HALF_PITCH occupied → sibling FULL_PITCH in the same facility unavailable
  //   - A occupied → B may remain free (and vice versa)
  // Only applies to PITCH_HALL group where both resource types can coexist.
  if (group === "PITCH_HALL") {
    // Group resources by facility
    const byFacility = new Map<string, typeof resources>();
    for (const r of resources) {
      const list = byFacility.get(r.facilityId) ?? [];
      list.push(r);
      byFacility.set(r.facilityId, list);
    }

    for (const facilityResources of byFacility.values()) {
      const fullPitches = facilityResources.filter((r) => r.type === "FULL_PITCH");
      const halfPitches = facilityResources.filter((r) => r.type === "HALF_PITCH");

      // Only apply rules when both FULL and HALF resources exist in the facility
      if (fullPitches.length === 0 || halfPitches.length === 0) continue;

      for (const full of fullPitches) {
        const fullConflicts = conflictsByResourceId.get(full.id) ?? [];
        if (fullConflicts.length > 0) {
          const representative = fullConflicts[0]!;
          for (const half of halfPitches) {
            if ((conflictsByResourceId.get(half.id) ?? []).length === 0) {
              conflictsByResourceId.set(half.id, [
                {
                  ...representative,
                  resourceId: half.id,
                  label: `${representative.label} (ganzes Feld belegt)`,
                },
              ]);
            }
          }
        }
      }

      const occupiedHalves = halfPitches.filter((h) => (conflictsByResourceId.get(h.id) ?? []).length > 0);
      if (occupiedHalves.length > 0) {
        for (const full of fullPitches) {
          if ((conflictsByResourceId.get(full.id) ?? []).length === 0) {
            const representative = conflictsByResourceId.get(occupiedHalves[0]!.id)![0]!;
            conflictsByResourceId.set(full.id, [
              {
                ...representative,
                resourceId: full.id,
                label: `${representative.label} (Hälfte belegt)`,
              },
            ]);
          }
        }
      }
    }
  }

  return resources.map((resource) => {
    const conflictList = conflictsByResourceId.get(resource.id) ?? [];
    const primary = conflictList[0];
    const conflicts = conflictList.map((conflict) => ({
      label: conflict.label,
      startAt: conflict.startAt.toISOString(),
      endAt: conflict.endAt.toISOString(),
      sourceType: conflict.sourceType,
    }));
    return {
      resourceId: resource.id,
      resourceName: resource.name,
      resourceCode: resource.code,
      facilityId: resource.facilityId,
      facilityName: resource.facility.name,
      status: primary ? "OCCUPIED" : "FREE",
      conflictLabel: primary?.label ?? null,
      conflictStartAt: primary?.startAt.toISOString() ?? null,
      conflictEndAt: primary?.endAt.toISOString() ?? null,
      conflictSourceType: primary?.sourceType ?? null,
      conflicts,
    } satisfies ResourceAvailability;
  });
}
