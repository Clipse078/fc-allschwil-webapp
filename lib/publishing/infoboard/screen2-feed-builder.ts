/**
 * lib/publishing/infoboard/screen2-feed-builder.ts
 *
 * Reusable data-composition layer for Infoboard Screen 2 — the FACILITY
 * OVERVIEW ("what is happening on each facility/resource now, and what is
 * next?").
 *
 * Builds InfoboardScreen2Feed by:
 *   1. Calling selectEventsForPublication() with channel INFOBOARD_SCREEN_2
 *      — the exact same publication policy Screen 1 uses (training, HOME
 *      match, HOME tournament; AWAY matches/tournaments are excluded before
 *      this module ever sees them).
 *   2. For each configured pitch, resolving current/next occupancy from the
 *      eligible events whose pitch allocation includes that pitch's code.
 *   3. For each configured dressing room, resolving current/next occupancy
 *      the same way, from the home/away dressing-room allocation codes.
 *   4. Collecting eligible current/upcoming activities that could not be
 *      mapped to any configured pitch into a compact `unallocated` list.
 *
 * Rolling operational horizon (INFOBOARD-INTEGRATION-01C):
 *   Screen 2 reuses the exact same SCREEN1_HORIZON_MS (4 hours) rolling
 *   look-ahead window Screen 1 already defines — imported, never
 *   redefined. For every facility resource:
 *     - current — startAt <= now < effectiveEndAt (no cap).
 *     - next    — the earliest upcoming eligible event for that resource
 *                 starting within the horizon. Only one "next" per resource
 *                 is ever shown (no long future schedule).
 *   `current` and `next` are independent: when a resource has an active
 *   event AND a further upcoming one within the horizon, BOTH are returned
 *   together (Screen 2 shows "JETZT" and "DANACH" side by side) — never
 *   collapsed into an either/or choice.
 *
 * Multi-resource allocations (full-pitch / half-pitch, INFOBOARD-INTEGRATION-01C):
 *   An activity may occupy more than one FacilityResource simultaneously
 *   (e.g. a training using two half-pitch codes at once). Occupancy is
 *   resolved independently per configured resource by checking whether that
 *   resource's code is present in the activity's full allocation code list
 *   (pitchCodes / homeDressingRoomCodes / awayDressingRoomCodes) — so the
 *   same activity correctly appears on every resource it occupies, rather
 *   than being collapsed onto a single card.
 *
 * Design constraints:
 *   - No Prisma imports, no DB access, no Next.js, no React.
 *   - `now` is always supplied by the caller.
 *   - The event loader is called exactly once (delegated to
 *     selectEventsForPublication).
 *   - Publication rules are not duplicated — delegated to PP-01B.
 *   - The rolling horizon constant is not duplicated — imported from
 *     screen1-feed-builder.ts.
 *   - Naming resolution is not duplicated — delegated to the shared
 *     presentation resolvers (Team.name-first canonical naming, identical
 *     to Screen 1).
 *   - Inputs and loaded events are never mutated.
 *   - Result arrays are always new arrays.
 */

import type {
  InfoboardScreen2Feed,
  InfoboardTenantRef,
  PitchOccupancy,
  PitchOccupancyState,
  PitchEventSummary,
  DressingRoomOccupancy,
  DressingRoomOccupancyState,
  DressingRoomAssignment,
  DressingRoomAssignmentRole,
  PublishingEventType,
  PublishingEventStatus,
} from "../event-types";
import type { PublicationEventLoader } from "../policy/event-selection";
import { selectEventsForPublication } from "../policy/event-selection";
import {
  getEffectiveEndAt,
  toLocalDateKey,
} from "../time/temporal-grouping";
import { SCREEN1_HORIZON_MS } from "./screen1-feed-builder";
import {
  resolveTeamDisplayName,
  resolveOpponentDisplayName,
} from "../presentation/display-name-resolver";
import type { Screen1SourceEvent } from "./screen1-event-mapper";

// ── Constants ─────────────────────────────────────────────────────────────────

/**
 * How many hours before `now` the loader query window extends.
 * Mirrors Screen 1's own loader query window (screen1-live-service.ts) —
 * NOT the display cutoff, which is SCREEN1_HORIZON_MS (imported below).
 * A generous query window is safe: activities outside the display horizon
 * are simply never selected for a resource's current/next slot.
 */
const OVERNIGHT_BUFFER_HOURS = 26;

/** How many hours after `now` the loader query window extends. */
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
  /**
   * Parent Facility id (INFOBOARD-UX-03 full-pitch/subdivision deduplication).
   * Used by the presentation layer to group FULL_PITCH and HALF_PITCH resources
   * that share the same physical facility.
   */
  readonly facilityId: string;
  /**
   * Whether this resource is a complete pitch or a subdivision.
   * FULL_PITCH = the whole physical pitch (e.g. Hauptplatz)
   * HALF_PITCH  = a named subdivision (e.g. Feld A, Feld B)
   */
  readonly resourceType: "FULL_PITCH" | "HALF_PITCH";
};

/** A configured dressing room as returned by the DB (minimal fields). */
export type ConfiguredDressingRoom = {
  /** Raw facility-resource code. */
  readonly code: string;
  /** Human-readable label (DB name), e.g. "Kabine 3". */
  readonly name: string;
};

export type BuildScreen2FeedInput = {
  readonly tenant: InfoboardTenantRef;
  readonly timeZone: string;
  readonly now: Date;
  readonly dateFrom?: Date;
  readonly dateTo?: Date;
  /** Canonical, ordered pitch list from the facility inventory. */
  readonly pitches: readonly ConfiguredPitch[];
  /**
   * Canonical, ordered dressing-room list from the facility inventory.
   * Optional — defaults to an empty list, in which case the dressing-room
   * section of the feed is genuinely empty (no dressing rooms configured).
   */
  readonly dressingRooms?: readonly ConfiguredDressingRoom[];
  readonly loader: PublicationEventLoader<Screen1SourceEvent>;
};

// ── Allocation-code resolution (multi-resource aware) ─────────────────────────

/**
 * Full pitch/hall resource codes this activity occupies. Falls back to the
 * singular `pitch.code` candidate when `pitchCodes` is absent — keeps every
 * existing caller that only ever supplies the singular candidate working
 * unchanged.
 */
function eventPitchCodes(event: Screen1SourceEvent): readonly string[] {
  if (event.pitchCodes && event.pitchCodes.length > 0) return event.pitchCodes;
  return event.pitch?.code ? [event.pitch.code] : [];
}

function eventHomeDressingRoomCodes(event: Screen1SourceEvent): readonly string[] {
  if (event.homeDressingRoomCodes && event.homeDressingRoomCodes.length > 0) {
    return event.homeDressingRoomCodes;
  }
  return event.homeDressingRoom?.code ? [event.homeDressingRoom.code] : [];
}

function eventAwayDressingRoomCodes(event: Screen1SourceEvent): readonly string[] {
  if (event.awayDressingRoomCodes && event.awayDressingRoomCodes.length > 0) {
    return event.awayDressingRoomCodes;
  }
  return event.awayDressingRoom?.code ? [event.awayDressingRoom.code] : [];
}

// ── Canonical Team.name-first naming (shared with Screen 1) ──────────────────

function resolveHomePartyDisplayName(event: Screen1SourceEvent): string | null {
  return resolveTeamDisplayName(
    {
      name: event.team?.name,
      displayName: event.team?.displayName,
      shortName: event.team?.shortName,
      fallbackName: event.teamFallbackName,
    },
    "INFOBOARD",
  );
}

function resolveAwayPartyDisplayName(event: Screen1SourceEvent): string | null {
  return resolveOpponentDisplayName(
    {
      infoboardName: event.opponent?.infoboardName,
      shortName: event.opponent?.shortName,
      officialName: event.opponent?.officialName,
      websiteName: event.opponent?.websiteName,
      fallbackName: event.opponentFallbackName,
    },
    "INFOBOARD",
  );
}

// ── PitchEventSummary mapping ─────────────────────────────────────────────────

function mapToPitchEventSummary(
  event: Screen1SourceEvent,
  relation: "current" | "next",
): PitchEventSummary {
  return {
    eventId: event.id,
    displayTitle: event.title,
    teamDisplayName: resolveHomePartyDisplayName(event),
    opponentDisplayName: resolveAwayPartyDisplayName(event),
    startAt: event.startAt.toISOString(),
    endAt: event.endAt ? event.endAt.toISOString() : null,
    status: event.status as PublishingEventStatus,
    type: event.type as PublishingEventType,
    temporalRelation: relation,
    dressingRooms: [],
  };
}

// ── Temporal helpers ──────────────────────────────────────────────────────────

type Classified = {
  readonly current: Screen1SourceEvent[];
  readonly next: Screen1SourceEvent[];
};

/**
 * Splits a resource's candidate events into "current" (active now) and
 * "next" (earliest upcoming within the rolling horizon), sorted by startAt.
 * Events that have already ended, or start beyond the horizon, are dropped.
 */
function classifyForResource(
  candidates: readonly Screen1SourceEvent[],
  nowMs: number,
  horizonMs: number,
): Classified {
  const current: Screen1SourceEvent[] = [];
  const future: Screen1SourceEvent[] = [];

  for (const event of candidates) {
    const effectiveEnd = getEffectiveEndAt(event);
    if (effectiveEnd.getTime() <= nowMs) continue; // already ended

    if (event.startAt.getTime() <= nowMs) {
      current.push(event);
    } else if (event.startAt.getTime() - nowMs <= horizonMs) {
      future.push(event);
    }
  }

  const byStartAt = (a: Screen1SourceEvent, b: Screen1SourceEvent) =>
    a.startAt.getTime() - b.startAt.getTime();
  current.sort(byStartAt);
  future.sort(byStartAt);

  return { current, next: future };
}

// ── Per-pitch occupancy resolution ────────────────────────────────────────────

/**
 * Resolves occupancy state and event summary for a single pitch.
 *
 * `currentEvent` and `nextEvent` are resolved independently — when a pitch
 * has both an active event and a further upcoming one within the rolling
 * horizon, both are returned together (never collapsed to one or the
 * other). When multiple current events share the same pitch (an allocation
 * conflict), the first (by startAt) is used as currentEvent and
 * `hasAllocationConflict` is set.
 */
function resolvePitchOccupancy(
  pitch: ConfiguredPitch,
  eligibleEvents: readonly Screen1SourceEvent[],
  nowMs: number,
  horizonMs: number,
): PitchOccupancy {
  const candidates = eligibleEvents.filter((e) =>
    eventPitchCodes(e).includes(pitch.code),
  );
  const { current, next } = classifyForResource(candidates, nowMs, horizonMs);
  const hasConflict = current.length > 1;

  const currentEvent = current.length > 0 ? mapToPitchEventSummary(current[0], "current") : null;
  const nextEvent = next.length > 0 ? mapToPitchEventSummary(next[0], "next") : null;

  let state: PitchOccupancyState;
  if (currentEvent !== null) {
    state = "OCCUPIED_NOW";
  } else if (nextEvent !== null) {
    state = "UPCOMING";
  } else {
    state = "FREE_NOW";
  }

  return {
    code: pitch.code,
    displayLabel: pitch.name,
    facilityName: pitch.facilityName,
    facilityId: pitch.facilityId,
    resourceType: pitch.resourceType,
    state,
    currentEvent,
    nextEvent,
    hasAllocationConflict: hasConflict,
  };
}

// ── Per-dressing-room occupancy resolution ────────────────────────────────────

/** One (event, side) candidate for a specific dressing-room code. */
type DressingRoomCandidate = {
  readonly event: Screen1SourceEvent;
  readonly role: DressingRoomAssignmentRole;
};

/** Resolves the publication-appropriate role for a dressing-room side. */
function resolveDressingRoomRole(
  event: Screen1SourceEvent,
  side: "HOME" | "AWAY",
): DressingRoomAssignmentRole {
  if (side === "AWAY") return "AWAY";
  if (event.type === "MATCH") return "HOME";
  if (event.type === "TOURNAMENT") return "TOURNAMENT_HOST";
  return "TRAINING";
}

function resolveDressingRoomAssignedTo(
  event: Screen1SourceEvent,
  side: "HOME" | "AWAY",
): string | null {
  return side === "HOME" ? resolveHomePartyDisplayName(event) : resolveAwayPartyDisplayName(event);
}

function toDressingRoomAssignment(
  room: ConfiguredDressingRoom,
  candidate: DressingRoomCandidate,
  side: "HOME" | "AWAY",
): DressingRoomAssignment {
  return {
    code: room.code,
    displayLabel: room.name,
    role: candidate.role,
    assignedTo: resolveDressingRoomAssignedTo(candidate.event, side),
    eventId: candidate.event.id,
  };
}

/**
 * Resolves occupancy for a single dressing room from the eligible event
 * set. An event occupies a dressing room when the room's code is present
 * in either its home-side or away-side dressing-room allocation codes.
 *
 * Only canonical allocation data is used — a dressing room is never
 * inferred for an activity that has no allocation, and no assignment is
 * ever fabricated.
 */
function resolveDressingRoomOccupancy(
  room: ConfiguredDressingRoom,
  eligibleEvents: readonly Screen1SourceEvent[],
  nowMs: number,
  horizonMs: number,
): DressingRoomOccupancy {
  const candidateEntries: Array<{ event: Screen1SourceEvent; side: "HOME" | "AWAY" }> = [];
  for (const event of eligibleEvents) {
    if (eventHomeDressingRoomCodes(event).includes(room.code)) {
      candidateEntries.push({ event, side: "HOME" });
    }
    if (eventAwayDressingRoomCodes(event).includes(room.code)) {
      candidateEntries.push({ event, side: "AWAY" });
    }
  }

  const candidateEvents = candidateEntries.map((entry) => entry.event);
  const { current, next } = classifyForResource(candidateEvents, nowMs, horizonMs);

  const findEntry = (event: Screen1SourceEvent) =>
    candidateEntries.find((entry) => entry.event === event)!;

  const currentAssignment =
    current.length > 0
      ? (() => {
          const entry = findEntry(current[0]);
          return toDressingRoomAssignment(
            room,
            { event: entry.event, role: resolveDressingRoomRole(entry.event, entry.side) },
            entry.side,
          );
        })()
      : null;

  const nextAssignment =
    currentAssignment === null && next.length > 0
      ? (() => {
          const entry = findEntry(next[0]);
          return toDressingRoomAssignment(
            room,
            { event: entry.event, role: resolveDressingRoomRole(entry.event, entry.side) },
            entry.side,
          );
        })()
      : null;

  let state: DressingRoomOccupancyState;
  if (currentAssignment !== null) {
    state = "OCCUPIED_NOW";
  } else if (nextAssignment !== null) {
    state = "UPCOMING";
  } else {
    state = "FREE_NOW";
  }

  return {
    code: room.code,
    displayLabel: room.name,
    state,
    current: currentAssignment,
    next: nextAssignment,
  };
}

// ── Unallocated activities ────────────────────────────────────────────────────

/**
 * Eligible current/upcoming activities that cannot be mapped to any
 * configured pitch — either no pitch allocation exists at all, or the
 * allocated resource code is not part of the configured pitch inventory.
 * Restrained by design: only current/next-within-horizon activities are
 * considered, never a long backlog.
 */
function resolveUnallocatedActivities(
  eligibleEvents: readonly Screen1SourceEvent[],
  configuredPitchCodes: ReadonlySet<string>,
  nowMs: number,
  horizonMs: number,
): PitchEventSummary[] {
  const unmapped = eligibleEvents.filter((event) => {
    const codes = eventPitchCodes(event);
    return !codes.some((code) => configuredPitchCodes.has(code));
  });

  const { current, next } = classifyForResource(unmapped, nowMs, horizonMs);

  return [
    ...current.map((event) => mapToPitchEventSummary(event, "current")),
    ...next.map((event) => mapToPitchEventSummary(event, "next")),
  ];
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
  const dressingRooms = input.dressingRooms ?? [];

  // Validate timezone eagerly; also produces the display-date key.
  const todayKey = toLocalDateKey(now, timeZone);

  const dateFrom =
    input.dateFrom ??
    new Date(now.getTime() - OVERNIGHT_BUFFER_HOURS * 60 * 60 * 1000);
  const dateTo =
    input.dateTo ??
    new Date(now.getTime() + FORWARD_WINDOW_HOURS * 60 * 60 * 1000);

  const nowMs = now.getTime();

  // ── Load and filter eligible events (same channel as Screen 1's shared
  // publication policy — training, HOME match, HOME tournament only) ────────
  const { eligible } = await selectEventsForPublication(loader, {
    tenantId: tenant.id,
    channel: "INFOBOARD_SCREEN_2",
    dateFrom,
    dateTo,
  });

  // ── Resolve per-pitch occupancy (current + next, independently) ──────────
  const pitchOccupancies: PitchOccupancy[] = pitches.map((pitch) =>
    resolvePitchOccupancy(pitch, eligible, nowMs, SCREEN1_HORIZON_MS),
  );

  // ── Resolve per-dressing-room occupancy ───────────────────────────────────
  const dressingRoomOccupancies: DressingRoomOccupancy[] = dressingRooms.map((room) =>
    resolveDressingRoomOccupancy(room, eligible, nowMs, SCREEN1_HORIZON_MS),
  );

  // ── Unallocated activities (compact, restrained — never a warning flood) ──
  const configuredPitchCodes = new Set(pitches.map((p) => p.code));
  const unallocated = resolveUnallocatedActivities(
    eligible,
    configuredPitchCodes,
    nowMs,
    SCREEN1_HORIZON_MS,
  );

  return {
    generatedAt: now.toISOString(),
    tenant,
    displayDate: todayKey,
    isStale: false,
    facilityName:
      pitches.length > 0 ? pitches[0].facilityName : tenant.name,
    pitches: pitchOccupancies,
    dressingRooms: dressingRoomOccupancies,
    unallocated,
  };
}
