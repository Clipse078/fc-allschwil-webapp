/**
 * lib/publishing/infoboard/screen2-feed-builder.ts
 *
 * Reusable data-composition layer for Infoboard Screen 2.
 *
 * Builds InfoboardScreen2Feed by:
 *   1. Calling selectEventsForPublication() with channel INFOBOARD_SCREEN_2.
 *   2. Grouping eligible events by pitchCode.
 *   3. For each configured pitch, applying temporal grouping.
 *   4. Determining per-pitch PitchOccupancyState:
 *        - OCCUPIED_NOW  — at least one eligible event is currently active.
 *        - UPCOMING      — no current event; at least one upcoming event exists.
 *        - FREE_NOW      — no current or upcoming events.
 *   5. Building PitchOccupancy entries preserving canonical pitch ordering.
 *   6. Populating InfoboardScreen2Feed.dressingRooms as empty — Screen 2 does
 *      not render cabin assignments (task INFOBOARD-05).
 *
 * Design constraints:
 *   - No Prisma imports, no DB access, no Next.js, no React.
 *   - `now` is always supplied by the caller.
 *   - IANA timezone is always supplied by the caller.
 *   - The event loader is called exactly once (delegated to selectEventsForPublication).
 *   - Publication rules are not duplicated — delegated to PP-01B.
 *   - Temporal grouping is not duplicated — getEffectiveEndAt is the only
 *     temporal utility called directly.
 *   - Inputs and loaded events are never mutated.
 *   - Result arrays are always new arrays.
 */

import type {
  InfoboardScreen2Feed,
  InfoboardTenantRef,
  PitchOccupancy,
  PitchOccupancyState,
  PitchEventSummary,
  PublishingEventType,
  PublishingEventStatus,
} from "../event-types";
import type { PublicationEventLoader } from "../policy/event-selection";
import { selectEventsForPublication } from "../policy/event-selection";
import {
  getEffectiveEndAt,
  toLocalDateKey,
} from "../time/temporal-grouping";
import type { Screen1SourceEvent } from "./screen1-event-mapper";

// ── Constants ─────────────────────────────────────────────────────────────────

/**
 * How many hours before `now` events are still considered potentially active.
 * Mirrors the Screen 1 overnight buffer.
 */
const OVERNIGHT_BUFFER_HOURS = 26;

/**
 * How many hours after `now` upcoming events are included.
 * Mirrors the Screen 1 forward window.
 */
const FORWARD_WINDOW_HOURS = 48;

// ── Public input types ────────────────────────────────────────────────────────

/** A configured pitch as returned by the DB (minimal fields). */
export type ConfiguredPitch = {
  /** Raw facility-resource code. */
  readonly code: string;
  /** Human-readable label (DB name or static registry label). */
  readonly name: string;
  /** Facility display name (from parent Facility). */
  readonly facilityName: string;
};

export type BuildScreen2FeedInput = {
  readonly tenant: InfoboardTenantRef;
  readonly timeZone: string;
  readonly now: Date;
  readonly dateFrom?: Date;
  readonly dateTo?: Date;
  /** Canonical, ordered pitch list from the facility inventory. */
  readonly pitches: readonly ConfiguredPitch[];
  readonly loader: PublicationEventLoader<Screen1SourceEvent>;
};

// ── Temporal classification ───────────────────────────────────────────────────

/**
 * Classifies an event relative to `now` using effective end time.
 * Returns "current" when the event is ongoing, "future" otherwise.
 * Events that have ended are excluded by the caller before this is called.
 */
function classifyEvent(
  event: Screen1SourceEvent,
  nowMs: number,
): "current" | "future" {
  const effectiveEnd = getEffectiveEndAt(event);
  if (event.startAt.getTime() <= nowMs && effectiveEnd.getTime() > nowMs) {
    return "current";
  }
  return "future";
}

// ── PitchEventSummary mapping ─────────────────────────────────────────────────

function mapToPitchEventSummary(
  event: Screen1SourceEvent,
  relation: "current" | "next",
): PitchEventSummary {
  return {
    eventId: event.id,
    displayTitle: event.title,
    teamDisplayName:
      event.team?.displayName ?? event.team?.name ?? null,
    opponentDisplayName:
      event.opponent?.officialName ??
      event.opponentFallbackName ??
      null,
    startAt: event.startAt.toISOString(),
    endAt: event.endAt ? event.endAt.toISOString() : null,
    status: event.status as PublishingEventStatus,
    type: event.type as PublishingEventType,
    temporalRelation: relation,
    dressingRooms: [],
  };
}

// ── Per-pitch occupancy resolution ────────────────────────────────────────────

/**
 * Resolves occupancy state and event summary for a single pitch.
 *
 * Classification:
 *   - OCCUPIED_NOW — event.startAt ≤ now < effectiveEndAt.
 *   - UPCOMING     — event.startAt > now (but within the window).
 *   - FREE_NOW     — no eligible events for this pitch.
 *
 * When multiple current events share the same pitch, the first (by startAt)
 * is used as currentEvent. hasAllocationConflict is set to true.
 */
function resolvePitchOccupancy(
  pitch: ConfiguredPitch,
  eligibleEvents: readonly Screen1SourceEvent[],
  nowMs: number,
  today: string,
  timeZone: string,
): PitchOccupancy {
  // Filter events assigned to this pitch.
  const pitchEvents = eligibleEvents.filter(
    (e) => e.pitch?.code === pitch.code,
  );

  const currentEvents: Screen1SourceEvent[] = [];
  const futureEvents: Screen1SourceEvent[] = [];

  for (const event of pitchEvents) {
    const effectiveEnd = getEffectiveEndAt(event);
    // Skip events that have fully ended.
    if (effectiveEnd.getTime() <= nowMs) continue;

    const cls = classifyEvent(event, nowMs);
    if (cls === "current") {
      currentEvents.push(event);
    } else {
      // Only include upcoming events that are on today's local date
      // (mirrors Screen 1 temporal grouping focus on today).
      const eventDateKey = toLocalDateKey(event.startAt, timeZone);
      if (eventDateKey === today) {
        futureEvents.push(event);
      }
    }
  }

  // Sort both lists by startAt ascending for determinism.
  currentEvents.sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
  futureEvents.sort((a, b) => a.startAt.getTime() - b.startAt.getTime());

  const hasConflict = currentEvents.length > 1;

  if (currentEvents.length > 0) {
    return {
      code: pitch.code,
      displayLabel: pitch.name,
      facilityName: pitch.facilityName,
      state: "OCCUPIED_NOW" as PitchOccupancyState,
      currentEvent: mapToPitchEventSummary(currentEvents[0], "current"),
      nextEvent: null,
      hasAllocationConflict: hasConflict,
    };
  }

  if (futureEvents.length > 0) {
    return {
      code: pitch.code,
      displayLabel: pitch.name,
      facilityName: pitch.facilityName,
      state: "UPCOMING" as PitchOccupancyState,
      currentEvent: null,
      nextEvent: mapToPitchEventSummary(futureEvents[0], "next"),
      hasAllocationConflict: false,
    };
  }

  return {
    code: pitch.code,
    displayLabel: pitch.name,
    facilityName: pitch.facilityName,
    state: "FREE_NOW" as PitchOccupancyState,
    currentEvent: null,
    nextEvent: null,
    hasAllocationConflict: false,
  };
}

// ── buildInfoboardScreen2Feed ─────────────────────────────────────────────────

/**
 * Builds a complete InfoboardScreen2Feed.
 *
 * When `pitches` is empty, returns a feed with an empty pitches array.
 * This is the "genuinely no configured pitches" state.
 *
 * @throws {RangeError} When `timeZone` is not a valid IANA identifier.
 * @throws Any error thrown by the loader propagates unchanged.
 */
export async function buildInfoboardScreen2Feed(
  input: BuildScreen2FeedInput,
): Promise<InfoboardScreen2Feed> {
  const { tenant, timeZone, now, pitches, loader } = input;

  // Validate timezone eagerly.
  const todayKey = toLocalDateKey(now, timeZone);

  const dateFrom =
    input.dateFrom ??
    new Date(now.getTime() - OVERNIGHT_BUFFER_HOURS * 60 * 60 * 1000);
  const dateTo =
    input.dateTo ??
    new Date(now.getTime() + FORWARD_WINDOW_HOURS * 60 * 60 * 1000);

  const nowMs = now.getTime();

  // ── Load and filter eligible events ────────────────────────────────────────
  const { eligible } = await selectEventsForPublication(loader, {
    tenantId: tenant.id,
    channel: "INFOBOARD_SCREEN_2",
    dateFrom,
    dateTo,
  });

  // ── Resolve per-pitch occupancy ────────────────────────────────────────────
  const pitchOccupancies: PitchOccupancy[] = pitches.map((pitch) =>
    resolvePitchOccupancy(pitch, eligible, nowMs, todayKey, timeZone),
  );

  return {
    generatedAt: now.toISOString(),
    tenant,
    displayDate: todayKey,
    isStale: false,
    facilityName:
      pitches.length > 0 ? pitches[0].facilityName : tenant.name,
    pitches: pitchOccupancies,
    // Screen 2 does not render dressing-room assignments (INFOBOARD-05).
    // The field is retained in the shared type for Screen 1 compatibility.
    dressingRooms: [],
  };
}
