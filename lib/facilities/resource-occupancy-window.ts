/**
 * lib/facilities/resource-occupancy-window.ts
 *
 * WOCHENPLAN-2.0-01H-E — generic resource occupancy window derivation.
 *
 * Distinguishes EVENT WINDOW (canonical startAt/endAt) from RESOURCE OCCUPANCY
 * WINDOW (effective reservation interval including optional before/after buffers).
 *
 * Persistence of occupancyBeforeMinutes/occupancyAfterMinutes per allocation
 * is stored on WeekplannerPlanAllocation (WOCHENPLAN-2.0-01H-E2).
 * This module is the shared derivation primitive — no duplicate scheduling engine.
 */

import { timeRangesOverlap } from "@/lib/facilities/allocation-rules";

export type ResourceOccupancyWindow = {
  /** Canonical event start instant. */
  eventStartAt: Date;
  /** Canonical event end instant. */
  eventEndAt: Date;
  /** Minutes reserved before event start (>= 0). */
  beforeMinutes: number;
  /** Minutes reserved after event end (>= 0). */
  afterMinutes: number;
  /** Derived occupancy start = eventStart - beforeMinutes. */
  effectiveStartAt: Date;
  /** Derived occupancy end = eventEnd + afterMinutes. */
  effectiveEndAt: Date;
};

const MS_PER_MINUTE = 60_000;

/** Clamp to non-negative integer minutes. */
export function normalizeOccupancyBufferMinutes(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const rounded = Math.round(value);
  return rounded < 0 ? 0 : rounded;
}

/**
 * Derives the effective resource occupancy window from event times and buffers.
 * Defaults 0/0 ⇒ occupancy equals the event interval.
 */
export function computeResourceOccupancyWindow(
  eventStartAt: Date | string,
  eventEndAt: Date | string,
  beforeMinutes = 0,
  afterMinutes = 0,
): ResourceOccupancyWindow {
  const eventStart = new Date(eventStartAt);
  const eventEnd = new Date(eventEndAt);
  const before = normalizeOccupancyBufferMinutes(beforeMinutes);
  const after = normalizeOccupancyBufferMinutes(afterMinutes);

  return {
    eventStartAt: eventStart,
    eventEndAt: eventEnd,
    beforeMinutes: before,
    afterMinutes: after,
    effectiveStartAt: new Date(eventStart.getTime() - before * MS_PER_MINUTE),
    effectiveEndAt: new Date(eventEnd.getTime() + after * MS_PER_MINUTE),
  };
}

/** Half-open interval overlap on effective occupancy windows. */
export function resourceOccupancyWindowsOverlap(
  a: Pick<ResourceOccupancyWindow, "effectiveStartAt" | "effectiveEndAt">,
  b: Pick<ResourceOccupancyWindow, "effectiveStartAt" | "effectiveEndAt">,
): boolean {
  return timeRangesOverlap({
    startA: a.effectiveStartAt,
    endA: a.effectiveEndAt,
    startB: b.effectiveStartAt,
    endB: b.effectiveEndAt,
  });
}
