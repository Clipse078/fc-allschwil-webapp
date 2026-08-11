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
import { classifyFacilityResourceType, type TrainingAllocationGroupKey } from "@/lib/training/allocation-groups";

// ── Public types ─────────────────────────────────────────────────────────────

/** The two allocation groups this slice's guided-creation UIs care about. */
export type AvailabilityResourceGroup = Extract<TrainingAllocationGroupKey, "PITCH_HALL" | "DRESSING_ROOM">;

export type ResourceAvailabilityStatus = "FREE" | "OCCUPIED";

export type ResourceAvailabilityConflictSource = "TRAINING" | "MATCH" | "TOURNAMENT";

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
        label: `Training ${session.trainingSeries.title}`,
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
    if (!timeRangesOverlap({ startA: startAt, endA: endAt, startB: event.startAt, endB: event.endAt })) {
      continue;
    }

    const label = `Match ${event.opponentName ? `vs. ${event.opponentName}` : event.title}`;
    const effectiveStart = event.startAt;
    const effectiveEnd = event.endAt ?? event.startAt;

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
      if (!timeRangesOverlap({ startA: startAt, endA: endAt, startB: row.event.startAt, endB: row.event.endAt })) {
        continue;
      }
      conflicts.push({
        resourceId: row.facilityResourceId,
        label: `Turnier ${row.event.title}`,
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
      label: `Turnier ${participant.event.title} · ${participantLabel}`,
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
  const { tenantId, group, excludeEventId, excludeTrainingSessionId } = input;
  const startAt = toDate(input.startAt);
  const endAt = input.endAt ? toDate(input.endAt) : startAt;

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

  if (resources.length === 0) return [];

  const resourcesByCode = new Map(resources.map((r) => [r.code, r.id]));
  const resourceIds = resources.map((r) => r.id);

  const [trainingConflicts, matchConflicts, tournamentConflicts] = await Promise.all([
    findTrainingConflicts(tenantId, startAt, endAt, group, excludeTrainingSessionId),
    findMatchConflicts(tenantId, startAt, endAt, group, resourcesByCode, excludeEventId),
    findTournamentConflicts(tenantId, startAt, endAt, group, resourceIds, excludeEventId),
  ]);

  const conflictsByResourceId = new Map<string, ConflictWindow>();
  for (const conflict of [...trainingConflicts, ...matchConflicts, ...tournamentConflicts]) {
    const existing = conflictsByResourceId.get(conflict.resourceId);
    if (!existing || conflict.startAt.getTime() < existing.startAt.getTime()) {
      conflictsByResourceId.set(conflict.resourceId, conflict);
    }
  }

  return resources.map((resource) => {
    const conflict = conflictsByResourceId.get(resource.id);
    return {
      resourceId: resource.id,
      resourceName: resource.name,
      resourceCode: resource.code,
      facilityId: resource.facilityId,
      facilityName: resource.facility.name,
      status: conflict ? "OCCUPIED" : "FREE",
      conflictLabel: conflict?.label ?? null,
      conflictStartAt: conflict?.startAt.toISOString() ?? null,
      conflictEndAt: conflict?.endAt.toISOString() ?? null,
      conflictSourceType: conflict?.sourceType ?? null,
    } satisfies ResourceAvailability;
  });
}
