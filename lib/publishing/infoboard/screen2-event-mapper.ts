/**
 * lib/publishing/infoboard/screen2-event-mapper.ts
 *
 * Pure, synchronous event mapper for Infoboard Screen 2.
 *
 * Maps eligible Screen2SourceEvent entries to Screen2AllocationCandidate
 * objects, one per target display field. The mapper:
 *
 *   1. Resolves team/opponent/tournament display labels.
 *   2. Formats tenant-timezone-aware time labels.
 *   3. Resolves dressing-room display labels from resource codes.
 *   4. Determines the target display field(s) via pitchCode lookup.
 *   5. Expands FULL_PITCH assignments to sibling HALF_PITCH sub-fields.
 *
 * Allocation expansion rules:
 *   - Direct assignment: pitchCode matches a HALF_PITCH (or OTHER) resource
 *     code → one candidate for that resource.
 *   - FULL_PITCH assignment: pitchCode matches a FULL_PITCH resource code AND
 *     that facility has HALF_PITCH sub-fields → one candidate per HALF_PITCH
 *     sub-field, all with isFullResourceAllocation = true.
 *   - FULL_PITCH with no HALF_PITCH children → one candidate for the FULL_PITCH
 *     resource itself, isFullResourceAllocation = false (direct placement).
 *   - No pitchCode or code not in display resources → zero candidates;
 *     event is reported as unassigned in diagnostics.
 *   - No string-similarity heuristics; only explicit DB-relation-based expansion.
 *
 * Design constraints:
 *   - No Prisma imports, no DB access, no Next.js, no React.
 *   - No time access (now is supplied). No environment variable access.
 *   - Inputs are never mutated.
 *   - Deterministic: same inputs always produce same outputs.
 *   - No publication eligibility recalculation.
 */

import type { Screen2SourceEvent, Screen2AllocationCandidate, InfoboardScreen2Allocation, Screen2EventType, Screen2DisplayResource } from "./screen2-types";
import {
  buildResourcesByCode,
  buildHalfPitchResourcesByFacilityId,
} from "./screen2-resource-normalizer";
import { resolveTeamDisplayName, resolveOpponentDisplayName } from "../presentation/display-name-resolver";
import { resolveDressingRoomDisplay } from "../presentation/allocation-display-resolver";
import { getEffectiveEndAt } from "../time/temporal-grouping";

// ── Types ─────────────────────────────────────────────────────────────────────

export type MapScreen2EventInput = {
  /** All normalized display resources for this tenant. */
  readonly displayResources: readonly Screen2DisplayResource[];
  /** IANA timezone string for time label formatting. */
  readonly timeZone: string;
  /**
   * Raw resource rows including dressing rooms, for code→name resolution.
   * Key: FacilityResource.code, Value: FacilityResource.name.
   */
  readonly resourceNameByCode: ReadonlyMap<string, string>;
};

// ── Time label helpers ─────────────────────────────────────────────────────────

/**
 * Formats a UTC Date into "HH:MM" in the specified IANA timezone.
 * Uses 24-hour format without a date component.
 */
function formatTimeLabel(date: Date, timeZone: string): string {
  const formatter = new Intl.DateTimeFormat("de-CH", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return formatter.format(date);
}

/**
 * Builds a time-range label, e.g. "19:00 – 20:30".
 * Returns only the start time when start equals end (zero-duration edge case).
 */
function buildTimeRangeLabel(
  startLabel: string,
  endLabel: string | null,
): string {
  if (endLabel === null || endLabel === startLabel) return startLabel;
  return `${startLabel} – ${endLabel}`;
}

// ── mapScreen2Event ────────────────────────────────────────────────────────────

/**
 * Maps a single eligible Screen2SourceEvent to zero or more
 * Screen2AllocationCandidate entries.
 *
 * Returns an empty array when the event has no pitchCode or when the pitchCode
 * does not match any display resource.
 *
 * @pure — no side effects, deterministic.
 */
export function mapScreen2Event(
  event: Screen2SourceEvent,
  input: MapScreen2EventInput,
): Screen2AllocationCandidate[] {
  const { displayResources, timeZone, resourceNameByCode } = input;

  // ── Lazily-built lookups (computed once per call) ────────────────────────
  const resourcesByCode = buildResourcesByCode(displayResources);
  const halfPitchByFacilityId = buildHalfPitchResourcesByFacilityId(displayResources);

  // ── Event type guard ──────────────────────────────────────────────────────
  const eventType = event.type as Screen2EventType;

  // ── Team display name ──────────────────────────────────────────────────────
  const teamName = resolveTeamDisplayName(
    {
      name: event.team?.name,
      displayName: event.team?.displayName,
      shortName: event.team?.shortName,
      fallbackName: event.teamFallbackName,
    },
    "INFOBOARD",
  );

  // ── Opponent display name ─────────────────────────────────────────────────
  const opponentName = resolveOpponentDisplayName(
    {
      infoboardName: null,
      shortName: null,
      officialName: null,
      websiteName: null,
      fallbackName: event.opponentFallbackName,
    },
    "INFOBOARD",
  );

  // ── Competition/tournament display ─────────────────────────────────────────
  const tournamentName =
    eventType === "TOURNAMENT"
      ? (event.competitionLabel ?? event.organizerName ?? event.title ?? null)
      : null;

  // ── Primary and secondary labels ───────────────────────────────────────────
  let primaryLabel: string;
  let secondaryLabel: string | null;

  switch (eventType) {
    case "TRAINING":
      primaryLabel = teamName ?? event.title;
      secondaryLabel = null;
      break;
    case "MATCH":
      primaryLabel = teamName ?? event.title;
      secondaryLabel = opponentName;
      break;
    case "TOURNAMENT":
      primaryLabel = tournamentName ?? teamName ?? event.title;
      secondaryLabel = teamName !== primaryLabel ? (teamName ?? null) : null;
      break;
    default:
      primaryLabel = event.title;
      secondaryLabel = null;
  }

  // ── Time labels ────────────────────────────────────────────────────────────
  const effectiveEnd = getEffectiveEndAt(event);
  const startTimeLabel = formatTimeLabel(event.startAt, timeZone);
  const endTimeLabel = formatTimeLabel(effectiveEnd, timeZone);
  const resolvedEndTimeLabel =
    endTimeLabel === startTimeLabel ? null : endTimeLabel;
  const timeRangeLabel = buildTimeRangeLabel(startTimeLabel, resolvedEndTimeLabel);

  // ── Dressing-room label ────────────────────────────────────────────────────
  // Prefer the home/team dressing room code; resolve to name via resource map.
  let dressingRoomLabel: string | null = null;
  if (event.homeDressingRoomCode) {
    const name = resourceNameByCode.get(event.homeDressingRoomCode) ?? null;
    dressingRoomLabel = resolveDressingRoomDisplay({
      code: event.homeDressingRoomCode,
      name,
    });
  }

  // ── Build base allocation DTO ─────────────────────────────────────────────
  const buildAllocation = (
    isFullResourceAllocation: boolean,
  ): Omit<InfoboardScreen2Allocation, "eventId"> => ({
    eventType,
    visualKind: eventType,
    title: event.title,
    primaryLabel,
    secondaryLabel,
    startAt: event.startAt.toISOString(),
    endAt: effectiveEnd.toISOString(),
    startTimeLabel,
    endTimeLabel: resolvedEndTimeLabel,
    timeRangeLabel,
    teamName,
    opponentName: eventType === "MATCH" ? opponentName : null,
    tournamentName,
    dressingRoomLabel,
    isFullResourceAllocation,
  });

  // ── pitchCode lookup and expansion ────────────────────────────────────────
  if (!event.pitchCode) {
    return [];
  }

  const targetResource = resourcesByCode.get(event.pitchCode);
  if (!targetResource) {
    // pitchCode does not match any display field → unassigned
    return [];
  }

  if (targetResource.resourceType === "FULL_PITCH") {
    const halfPitches = halfPitchByFacilityId.get(targetResource.facilityId);
    if (halfPitches && halfPitches.length > 0) {
      // Expand to sibling HALF_PITCH resources in the same facility
      return halfPitches.map((subField) => ({
        resourceId: subField.id,
        allocation: {
          eventId: event.id,
          ...buildAllocation(true),
        },
      }));
    }
    // No HALF_PITCH children → assign directly to the FULL_PITCH resource
  }

  // Direct assignment (HALF_PITCH, OTHER, or FULL_PITCH with no children)
  return [
    {
      resourceId: targetResource.id,
      allocation: {
        eventId: event.id,
        ...buildAllocation(false),
      },
    },
  ];
}

// ── mapAllScreen2Events ────────────────────────────────────────────────────────

/**
 * Maps all eligible Screen2SourceEvent entries to allocation candidates.
 *
 * Deduplicates exact (resourceId, eventId) pairs to prevent double-allocation
 * when the same event is processed multiple times.
 *
 * Returns:
 *   candidates     — All allocation candidates produced.
 *   unassignedIds  — Event IDs that produced no candidates (no pitchCode match).
 *
 * @pure — no side effects, deterministic.
 */
export function mapAllScreen2Events(
  events: readonly Screen2SourceEvent[],
  input: MapScreen2EventInput,
): {
  candidates: Screen2AllocationCandidate[];
  unassignedIds: string[];
} {
  const candidates: Screen2AllocationCandidate[] = [];
  const unassignedIds: string[] = [];
  const seen = new Set<string>(); // "resourceId::eventId" de-dup key

  for (const event of events) {
    const eventCandidates = mapScreen2Event(event, input);

    if (eventCandidates.length === 0) {
      unassignedIds.push(event.id);
    } else {
      for (const candidate of eventCandidates) {
        const dedupKey = `${candidate.resourceId}::${candidate.allocation.eventId}`;
        if (!seen.has(dedupKey)) {
          seen.add(dedupKey);
          candidates.push(candidate);
        }
      }
    }
  }

  return { candidates, unassignedIds };
}
