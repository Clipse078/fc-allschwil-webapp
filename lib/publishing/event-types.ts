/**
 * Publishing Platform — Infoboard event DTO types.
 *
 * Canonical, presentation-ready types for the SportClubEvo Publishing Platform.
 * Intentionally decoupled from Prisma models and ORM runtime imports.
 * All date fields use UTC ISO-8601 strings (JSON-serializable).
 *
 * Screen 1: Temporal event schedule feed (current / next / later buckets).
 * Screen 2: Pitch-and-dressing-room occupancy feed.
 */

/**
 * Event type values that mirror the Prisma EventType enum.
 * String literal union avoids importing `@prisma/client` at runtime.
 */
export type PublishingEventType =
  | "MATCH"
  | "TOURNAMENT"
  | "TRAINING"
  | "OTHER"
  | "VACATION_PERIOD";

/**
 * Event status values that mirror the Prisma EventStatus enum.
 */
export type PublishingEventStatus =
  | "DRAFT"
  | "SCHEDULED"
  | "LIVE"
  | "COMPLETED"
  | "CANCELLED"
  | "POSTPONED"
  | "ARCHIVED";

/** Lightweight tenant reference embedded in feed payloads. */
export type InfoboardTenantRef = {
  id: string;
  key: string;
  name: string;
  /** IANA timezone string, e.g. "Europe/Zurich". */
  timezone: string;
};

/** Position of an event relative to the current moment on the tenant's calendar day. */
export type TemporalBucket = "current" | "next" | "later";

/**
 * Resolved display labels for facility allocations.
 * Raw allocation codes are intentionally excluded from Screen 1 DTOs.
 */
export type InfoboardAllocationDisplay = {
  pitchLabel: string | null;
  homeDressingRoomLabel: string | null;
  awayDressingRoomLabel: string | null;
  refereeDressingRoomLabel: string | null;
};

/**
 * A single event entry in the Screen 1 temporal feed.
 * All timestamps are UTC ISO-8601 strings.
 */
export type InfoboardScreen1Event = {
  id: string;
  type: PublishingEventType;
  displayTitle: string;
  teamDisplayName: string | null;
  opponentDisplayName: string | null;
  /** Organizer name for external/municipal events. */
  organizerDisplayName: string | null;
  competitionLabel: string | null;
  /** UTC ISO-8601. */
  startAt: string;
  /** UTC ISO-8601, or null when no explicit end time is stored. */
  endAt: string | null;
  /** UTC ISO-8601 meeting time, or null. */
  meetingTime: string | null;
  status: PublishingEventStatus;
  resultLabel: string | null;
  intermediateResultLabel: string | null;
  temporalBucket: TemporalBucket;
  allocation: InfoboardAllocationDisplay;
  /** Season key, e.g. "2025-26". */
  seasonKey: string;
};

/**
 * Reason for an empty Screen 1 feed.
 *
 * NO_EVENTS_TODAY  — No eligible events exist for the evaluated local calendar
 *                    day. The board has nothing to show and nothing ended.
 * DAY_COMPLETED    — Eligible events existed for today but all display windows
 *                    have ended. The day is over.
 */
export type EmptyStateReason = "NO_EVENTS_TODAY" | "DAY_COMPLETED";

/** Complete payload for Infoboard Screen 1. */
export type InfoboardScreen1Feed = {
  /** UTC ISO-8601 timestamp when the feed was assembled. */
  generatedAt: string;
  tenant: InfoboardTenantRef;
  /** Tenant-local calendar date being displayed, YYYY-MM-DD. */
  displayDate: string;
  /** True when the feed may be serving stale cached data. */
  isStale: boolean;
  /** Optional Wochenplan variant badge label. */
  wochenplanVariantBadge: string | null;
  /**
   * Currently active events: started at or before now, effective end after now.
   * All active events are always included (no count cap).
   */
  current: InfoboardScreen1Event[];
  /**
   * Upcoming eligible events sharing the earliest startAt within the
   * Screen 1 rolling operational horizon (next ~4 hours from now).
   * Events starting beyond the horizon are excluded entirely.
   */
  next: InfoboardScreen1Event[];
  /**
   * Remaining eligible upcoming events within the same rolling operational
   * horizon, ordered by startAt ascending, beyond the earliest group
   * selected for the "next" bucket.
   */
  later: InfoboardScreen1Event[];
  /** True when all three buckets are empty. */
  isEmpty: boolean;
  /**
   * Reason for the empty state. Present only when isEmpty is true.
   * null when isEmpty is false.
   */
  emptyStateReason: EmptyStateReason | null;
};

/** Occupancy state of a pitch at the moment the feed was assembled. */
export type PitchOccupancyState =
  | "OCCUPIED_NOW"
  | "FREE_NOW"
  | "UPCOMING"
  | "UNKNOWN";

/** Role that identifies why a team or referee is assigned to a dressing room. */
export type DressingRoomAssignmentRole =
  | "HOME"
  | "AWAY"
  | "TRAINING"
  | "REFEREE"
  | "TOURNAMENT_HOST"
  | "TOURNAMENT_GUEST";

/** A single dressing-room assignment resolved for Screen 2 display. */
export type DressingRoomAssignment = {
  /** Raw facility-resource code, e.g. "DR-A". */
  code: string;
  /** Human-readable label, e.g. "Kabine A". */
  displayLabel: string;
  role: DressingRoomAssignmentRole;
  /** Display name of the assigned team, or null when unassigned. */
  assignedTo: string | null;
  /** Event id that created this assignment, or null for unassigned entries. */
  eventId: string | null;
};

/** Summary of an event associated with a pitch in Screen 2. */
export type PitchEventSummary = {
  eventId: string;
  displayTitle: string;
  teamDisplayName: string | null;
  opponentDisplayName: string | null;
  /** UTC ISO-8601. */
  startAt: string;
  /** UTC ISO-8601 or null. */
  endAt: string | null;
  status: PublishingEventStatus;
  type: PublishingEventType;
  /** Whether the event is currently ongoing or the next upcoming. */
  temporalRelation: "current" | "next";
  dressingRooms: DressingRoomAssignment[];
};

/** Occupancy entry for a single pitch in Screen 2. */
export type PitchOccupancy = {
  /** Raw facility-resource code, e.g. "P-1". */
  code: string;
  /** Human-readable label, e.g. "Platz 1". */
  displayLabel: string;
  /** Display name of the parent facility. */
  facilityName: string;
  state: PitchOccupancyState;
  currentEvent: PitchEventSummary | null;
  nextEvent: PitchEventSummary | null;
  /** True when two or more events overlap on this pitch in the display window. */
  hasAllocationConflict: boolean;
};

/** Complete payload for Infoboard Screen 2. */
export type InfoboardScreen2Feed = {
  /** UTC ISO-8601 timestamp when the feed was assembled. */
  generatedAt: string;
  tenant: InfoboardTenantRef;
  /** Tenant-local calendar date being displayed, YYYY-MM-DD. */
  displayDate: string;
  /** True when the feed may be serving stale cached data. */
  isStale: boolean;
  /** Display name of the facility (e.g. "Brüelstadion"). */
  facilityName: string;
  pitches: PitchOccupancy[];
  dressingRooms: DressingRoomAssignment[];
};
