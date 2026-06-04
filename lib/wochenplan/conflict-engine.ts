import type { PitchAllocationCode } from "@/lib/facilities/pitches";
import { validatePitchAllocationForEventType } from "@/lib/facilities/allocation-rules";
import {
  dressingRoomConflict,
  pitchAllocationsConflict,
  timeRangesOverlap,
} from "@/lib/facilities/allocation-rules";
import type {
  WochenplanConflict,
  WochenplanEventItem,
} from "@/lib/wochenplan/types";

function getEventLabel(event: WochenplanEventItem) {
  return event.teamName ?? event.title;
}

function addConflict(
  list: WochenplanConflict[],
  conflict: WochenplanConflict,
) {
  list.push(conflict);
}

/**
 * Returns pitch capacity information for a set of events sharing the same time slot.
 *
 * A pitch can host at most:
 *   - 1 FULL event (match / tournament)
 *   - 2 HALF (A + B) training events
 *
 * When the capacity is exceeded (e.g. 3 trainings on same base pitch, or FULL + anything),
 * every event in that group is flagged PITCH_CAPACITY_EXCEEDED.
 */
function detectPitchCapacityExceeded(
  events: WochenplanEventItem[],
  conflicts: WochenplanConflict[],
) {
  // Group by base pitch code
  const byBasePitch = new Map<string, WochenplanEventItem[]>();

  for (const event of events) {
    if (!event.allocation.pitchCode) continue;
    const code = event.allocation.pitchCode;
    // Strip _A / _B suffix to get base pitch
    const base = code.replace(/_A$/, "").replace(/_B$/, "");
    if (!byBasePitch.has(base)) byBasePitch.set(base, []);
    byBasePitch.get(base)!.push(event);
  }

  for (const [basePitch, group] of byBasePitch) {
    if (group.length < 2) continue;

    const fullEvents = group.filter((e) => {
      const c = e.allocation.pitchCode ?? "";
      return !c.endsWith("_A") && !c.endsWith("_B");
    });
    const halfAEvents = group.filter((e) => e.allocation.pitchCode?.endsWith("_A"));
    const halfBEvents = group.filter((e) => e.allocation.pitchCode?.endsWith("_B"));

    const capacityExceeded =
      fullEvents.length > 1 ||
      halfAEvents.length > 1 ||
      halfBEvents.length > 1 ||
      (fullEvents.length >= 1 && (halfAEvents.length > 0 || halfBEvents.length > 0));

    if (capacityExceeded) {
      const pitchLabel = basePitch.replace(/_/g, " ");
      for (const event of group) {
        addConflict(conflicts, {
          type: "PITCH_CAPACITY_EXCEEDED",
          severity: "error",
          eventId: event.id,
          relatedEventId: null,
          message: `Platzkapazität überschritten auf "${pitchLabel}" — zu viele Events im selben Zeitslot.`,
        });
      }
    }
  }
}

export function getWochenplanConflicts(
  events: WochenplanEventItem[],
): WochenplanConflict[] {
  const conflicts: WochenplanConflict[] = [];

  for (const event of events) {
    const pitchValidation = validatePitchAllocationForEventType({
      eventType: event.eventType,
      pitchCode: event.allocation.pitchCode as PitchAllocationCode | null | undefined,
    });

    if (!event.allocation.pitchCode) {
      addConflict(conflicts, {
        type: "MISSING_PITCH",
        severity: "warning",
        eventId: event.id,
        relatedEventId: null,
        message: `Für "${getEventLabel(event)}" ist noch kein Platz zugeteilt.`,
      });
    }

    if (
      (event.eventType === "MATCH" || event.eventType === "TOURNAMENT") &&
      !event.allocation.homeDressingRoomCode
    ) {
      addConflict(conflicts, {
        type: "MISSING_DRESSING_ROOM",
        severity: "warning",
        eventId: event.id,
        relatedEventId: null,
        message: `Für "${getEventLabel(event)}" fehlt noch eine Heim-Garderobe.`,
      });
    }

    if (
      (event.eventType === "MATCH" || event.eventType === "TOURNAMENT") &&
      !event.allocation.awayDressingRoomCode
    ) {
      addConflict(conflicts, {
        type: "MISSING_DRESSING_ROOM",
        severity: "warning",
        eventId: event.id,
        relatedEventId: null,
        message: `Für "${getEventLabel(event)}" fehlt noch eine Gäste-Garderobe.`,
      });
    }

    if (!pitchValidation.ok) {
      addConflict(conflicts, {
        type: "INVALID_PITCH_MODE",
        severity: "error",
        eventId: event.id,
        relatedEventId: null,
        message: pitchValidation.reason ?? "Ungültige Platzzuordnung.",
      });
    }
  }

  // Group events by time slot for capacity checks
  const slotGroups = new Map<string, WochenplanEventItem[]>();
  for (const event of events) {
    const slotKey = `${event.startAt}|${event.endAt ?? ""}`;
    if (!slotGroups.has(slotKey)) slotGroups.set(slotKey, []);
    slotGroups.get(slotKey)!.push(event);
  }

  // Check pitch capacity per slot
  for (const group of slotGroups.values()) {
    detectPitchCapacityExceeded(group, conflicts);
  }

  // Pairwise: pitch overlap + dressing room clash
  for (let i = 0; i < events.length; i++) {
    for (let j = i + 1; j < events.length; j++) {
      const first = events[i];
      const second = events[j];

      const overlaps = timeRangesOverlap({
        startA: first.startAt,
        endA: first.endAt,
        startB: second.startAt,
        endB: second.endAt,
      });

      if (!overlaps) {
        continue;
      }

      if (
        pitchAllocationsConflict(
          first.allocation.pitchCode,
          second.allocation.pitchCode,
        )
      ) {
        addConflict(conflicts, {
          type: "PITCH_CONFLICT",
          severity: "error",
          eventId: first.id,
          relatedEventId: second.id,
          message:
            `Platzkonflikt zwischen "${getEventLabel(first)}" und "${getEventLabel(second)}".`,
        });
      }

      const roomPairs: Array<[string | null, string | null]> = [
        [first.allocation.homeDressingRoomCode, second.allocation.homeDressingRoomCode],
        [first.allocation.homeDressingRoomCode, second.allocation.awayDressingRoomCode],
        [first.allocation.awayDressingRoomCode, second.allocation.homeDressingRoomCode],
        [first.allocation.awayDressingRoomCode, second.allocation.awayDressingRoomCode],
      ];

      const hasRoomConflict = roomPairs.some(([a, b]) => dressingRoomConflict(a, b));

      if (hasRoomConflict) {
        addConflict(conflicts, {
          type: "DRESSING_ROOM_CONFLICT",
          severity: "error",
          eventId: first.id,
          relatedEventId: second.id,
          message:
            `Garderobenkonflikt zwischen "${getEventLabel(first)}" und "${getEventLabel(second)}".`,
        });
      }
    }
  }

  return conflicts;
}
