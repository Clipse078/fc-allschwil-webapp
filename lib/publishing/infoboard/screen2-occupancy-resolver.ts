/**
 * lib/publishing/infoboard/screen2-occupancy-resolver.ts
 *
 * Pure, synchronous occupancy resolver for Infoboard Screen 2.
 *
 * For each display field, calculates:
 *   - current allocation (in-progress at `now`);
 *   - next allocation (earliest upcoming on today's local date);
 *   - field occupancy state;
 *   - conflict count.
 *
 * Temporal conventions:
 *   - An event is "current" when: startAt <= now < effectiveEndAt.
 *   - An event ending exactly at now is NOT current (strictly before rule).
 *   - An event starting exactly at now IS current.
 *   - The effective end time is computed via getEffectiveEndAt() from the
 *     existing temporal-grouping utility — no second duration algorithm.
 *   - "Next" is the single earliest upcoming event on today's local date.
 *   - "Today's local date" is derived from `now` + tenant `timeZone`.
 *
 * Conflict handling:
 *   When multiple events are "current" on the same field:
 *     - The deterministic primary event is chosen (see below).
 *     - conflictCount = number of additional overlapping current events.
 *
 * Deterministic priority for conflict resolution:
 *   1. Earliest startAt (UTC ms).
 *   2. Lowest sortOrder.
 *   3. eventId ascending (final tie-breaker for full determinism).
 *
 * Design constraints:
 *   - No Prisma imports, no DB access, no Next.js, no React.
 *   - No time access (now and timeZone are supplied).
 *   - Inputs are never mutated.
 *   - Result arrays are always new arrays.
 *   - No publication eligibility recalculation.
 */

import type {
  Screen2DisplayResource,
  Screen2AllocationCandidate,
  InfoboardScreen2Field,
  Screen2FieldState,
} from "./screen2-types";
import { getEffectiveEndAt, isLocalToday } from "../time/temporal-grouping";

// ── OccupancyResolverInput ─────────────────────────────────────────────────────

export type OccupancyResolverInput = {
  /** Normalized display resources in display order. */
  readonly displayResources: readonly Screen2DisplayResource[];
  /** All allocation candidates produced by the event mapper. */
  readonly candidates: readonly Screen2AllocationCandidate[];
  /** The reference moment for occupancy calculation. */
  readonly now: Date;
  /** IANA timezone string for local-date comparison. */
  readonly timeZone: string;
};

// ── Internal candidate with parsed time fields ────────────────────────────────

type ParsedCandidate = {
  readonly resourceId: string;
  readonly eventId: string;
  readonly startAtMs: number;
  readonly effectiveEndAtMs: number;
  readonly sortOrder: number;
  readonly startAt: Date;
  readonly endAt: Date | null;
  readonly eventType: string;
  readonly candidate: Screen2AllocationCandidate;
};

// ── resolveScreen2Occupancy ────────────────────────────────────────────────────

/**
 * Resolves occupancy for all display fields.
 *
 * Returns an ordered InfoboardScreen2Field array aligned with the input
 * displayResources order (i.e. sorted by displayOrder).
 *
 * @pure — no side effects, deterministic.
 * @throws {RangeError} When timeZone is not a valid IANA timezone identifier.
 */
export function resolveScreen2Occupancy(
  input: OccupancyResolverInput,
): InfoboardScreen2Field[] {
  const { displayResources, candidates, now, timeZone } = input;
  const nowMs = now.getTime();

  // ── Parse candidates ─────────────────────────────────────────────────────
  const parsed: ParsedCandidate[] = candidates.map((c) => {
    const startAt = new Date(c.allocation.startAt);
    const endAt = c.allocation.endAt ? new Date(c.allocation.endAt) : null;
    const effectiveEnd = getEffectiveEndAt(
      { startAt, endAt, type: c.allocation.eventType },
    );
    return {
      resourceId: c.resourceId,
      eventId: c.allocation.eventId,
      startAtMs: startAt.getTime(),
      effectiveEndAtMs: effectiveEnd.getTime(),
      sortOrder: 0, // sortOrder not in allocation DTO; use event ID tie-breaker
      startAt,
      endAt,
      eventType: c.allocation.eventType,
      candidate: c,
    };
  });

  // ── Group candidates by resourceId ────────────────────────────────────────
  const byResource = new Map<string, ParsedCandidate[]>();
  for (const p of parsed) {
    const existing = byResource.get(p.resourceId);
    if (existing) {
      existing.push(p);
    } else {
      byResource.set(p.resourceId, [p]);
    }
  }

  // ── Deterministic comparator ──────────────────────────────────────────────
  const compareCandidates = (a: ParsedCandidate, b: ParsedCandidate): number => {
    if (a.startAtMs !== b.startAtMs) return a.startAtMs - b.startAtMs;
    // eventId as final tie-breaker (lexicographic)
    return a.eventId.localeCompare(b.eventId);
  };

  // ── Resolve each display resource ─────────────────────────────────────────
  return displayResources.map((resource, idx) => {
    const resourceCandidates = byResource.get(resource.id) ?? [];

    // Partition into current (in-progress) and upcoming (future today).
    const currentCandidates: ParsedCandidate[] = [];
    const upcomingCandidates: ParsedCandidate[] = [];

    for (const p of resourceCandidates) {
      // Ended at or before now → skip entirely.
      if (p.effectiveEndAtMs <= nowMs) continue;

      if (p.startAtMs <= nowMs) {
        // Started at or before now, still running → current.
        currentCandidates.push(p);
      } else {
        // Future event: include only when it falls on today's local date.
        if (isLocalToday(p.startAt, now, timeZone)) {
          upcomingCandidates.push(p);
        }
      }
    }

    // Sort both partitions deterministically.
    currentCandidates.sort(compareCandidates);
    upcomingCandidates.sort(compareCandidates);

    // ── Current allocation ─────────────────────────────────────────────────
    const primaryCurrent = currentCandidates[0] ?? null;
    const conflictCount = Math.max(0, currentCandidates.length - 1);

    // ── Next allocation ────────────────────────────────────────────────────
    // Pick the single earliest upcoming candidate.
    const nextCandidate = upcomingCandidates[0] ?? null;

    // ── Field state ────────────────────────────────────────────────────────
    let state: Screen2FieldState;
    if (primaryCurrent !== null) {
      state = "ACTIVE";
    } else if (nextCandidate !== null) {
      state = "FREE_WITH_NEXT";
    } else {
      state = "FREE_REST_OF_DAY";
    }

    return {
      resourceId: resource.id,
      facilityId: resource.facilityId,
      resourceName: resource.name,
      displayName: resource.name,
      mapKey: resource.mapKey,
      displayOrder: idx,
      state,
      current: primaryCurrent ? primaryCurrent.candidate.allocation : null,
      next: nextCandidate ? nextCandidate.candidate.allocation : null,
      conflictCount,
    };
  });
}
