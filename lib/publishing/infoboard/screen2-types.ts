/**
 * lib/publishing/infoboard/screen2-types.ts
 *
 * Canonical, presentation-ready types for Infoboard Screen 2.
 *
 * Screen 2 answers: "Where is it happening?" — it displays facility-resource
 * (pitch/field) occupancy for the current tenant-local day, with current and
 * next allocation cards per field.
 *
 * Design constraints:
 *   - No Prisma imports, no DB access, no Next.js, no React.
 *   - No raw database IDs or FacilityResource codes exposed in the feed DTO.
 *   - No CSS class names or raw color values in the feed DTO. The UI maps:
 *       TRAINING   → blue
 *       MATCH      → red
 *       TOURNAMENT → orange
 *       FREE       → green
 *   - All timestamps are UTC ISO-8601 strings.
 *   - All time labels use the tenant IANA timezone.
 *   - Output is immutable by convention (readonly).
 *
 * Relationship to event-types.ts:
 *   - Imports InfoboardTenantRef from event-types.ts (shared tenant reference).
 *   - The stub Screen 2 types in event-types.ts (PitchOccupancy, PitchEventSummary,
 *     DressingRoomAssignment, InfoboardScreen2Feed) are superseded by the types
 *     in this file. This file is the canonical source for Screen 2 types.
 */

import type { InfoboardTenantRef } from "../event-types";

// ── Re-export tenant ref so callers need only import this file ─────────────────
export type { InfoboardTenantRef };

// ── Field occupancy state ─────────────────────────────────────────────────────

/**
 * Occupancy state of a display field at the moment the feed was assembled.
 *
 *   ACTIVE          — at least one event is currently in progress on this field.
 *   FREE_WITH_NEXT  — no current event; a future event exists on today's local date.
 *   FREE_REST_OF_DAY — no current or future event for the rest of today.
 */
export type Screen2FieldState =
  | "ACTIVE"
  | "FREE_WITH_NEXT"
  | "FREE_REST_OF_DAY";

// ── Event type ────────────────────────────────────────────────────────────────

/** Infoboard-eligible event type for Screen 2 allocations. */
export type Screen2EventType = "TRAINING" | "MATCH" | "TOURNAMENT";

// ── Allocation ────────────────────────────────────────────────────────────────

/**
 * A single resolved allocation (current or next) for a Screen 2 field card.
 *
 * All fields are derived from publication-eligible events and their associated
 * team, opponent, dressing-room, and temporal data. No raw database IDs or
 * resource codes are exposed.
 */
export type InfoboardScreen2Allocation = {
  /**
   * Stable event ID for diagnostic correlation.
   * Not intended for display; may be used in diagnostics or admin tooling.
   */
  readonly eventId: string;

  /** Infoboard-eligible event type. */
  readonly eventType: Screen2EventType;

  /**
   * Visual classification for color mapping.
   * Identical to eventType in the current implementation; kept separate so
   * the UI mapping contract remains explicit and future sub-types (e.g.
   * FRIENDLY_MATCH) can be mapped to an existing visual without schema change.
   */
  readonly visualKind: Screen2EventType;

  /**
   * Event title as stored on the event record. Used as a fallback label.
   * May be used by the UI when primaryLabel is insufficient.
   */
  readonly title: string;

  /**
   * Primary display label for the map card:
   *   TRAINING   → team display name (or title when team absent)
   *   MATCH      → home-team display name (or title when team absent)
   *   TOURNAMENT → organizer or competition label (or title when absent)
   */
  readonly primaryLabel: string;

  /**
   * Secondary display label for the map card:
   *   TRAINING   → null
   *   MATCH      → opponent display name ("vs. FC Binningen")
   *   TOURNAMENT → optional age-group / category label
   */
  readonly secondaryLabel: string | null;

  /** UTC ISO-8601 start time of the event. */
  readonly startAt: string;

  /**
   * UTC ISO-8601 effective end time of the event.
   * Always present — computed via getEffectiveEndAt when event.endAt is null.
   */
  readonly endAt: string;

  /**
   * Start time formatted in the tenant's IANA timezone, e.g. "19:00".
   * HH:MM 24-hour format. Does not include a date component.
   */
  readonly startTimeLabel: string;

  /**
   * End time formatted in the tenant's IANA timezone, e.g. "20:30".
   * Null when the effective end time equals the start time (zero-duration edge case).
   */
  readonly endTimeLabel: string | null;

  /**
   * Formatted time range for display, e.g. "19:00 – 20:30".
   * Uses an en-dash separator. Includes only start when endTimeLabel is null.
   */
  readonly timeRangeLabel: string;

  /** Resolved team display name, or null when the event has no team. */
  readonly teamName: string | null;

  /**
   * Resolved opponent display name for MATCH events, e.g. "FC Binningen".
   * Null for TRAINING and TOURNAMENT events.
   */
  readonly opponentName: string | null;

  /**
   * Tournament / competition display name for TOURNAMENT events.
   * Null for TRAINING and MATCH events.
   */
  readonly tournamentName: string | null;

  /**
   * Resolved dressing-room label for the home/team allocation, e.g. "E1" or "E1 · E2".
   * Null when no dressing-room assignment exists.
   */
  readonly dressingRoomLabel: string | null;

  /**
   * True when this allocation was produced by expanding a FULL_PITCH resource
   * assignment to cover its sibling HALF_PITCH sub-fields within the same facility.
   * False for direct, explicit resource assignments.
   */
  readonly isFullResourceAllocation: boolean;
};

// ── Display field ─────────────────────────────────────────────────────────────

/**
 * A single display field in the Screen 2 feed, corresponding to one
 * FacilityResource of type HALF_PITCH, FULL_PITCH, or OTHER (non-dressing-room).
 *
 * Fields appear on the aerial map at their configured or derived map position.
 */
export type InfoboardScreen2Field = {
  /**
   * Opaque resource identifier (FacilityResource.id).
   * Not a database ID exposed for display; used for de-duplication and diagnostics.
   */
  readonly resourceId: string;

  /** Parent facility identifier (Facility.id). */
  readonly facilityId: string;

  /** FacilityResource.name as stored in the database. */
  readonly resourceName: string;

  /**
   * Best display name for the field, resolved from FacilityResource.name.
   * Future: may be overridden by a dedicated displayName or label column.
   */
  readonly displayName: string;

  /**
   * Stable, deterministic map-placement key derived from FacilityResource.code.
   * Normalization: uppercase, non-alphanumeric characters replaced with "_",
   * consecutive underscores collapsed, leading/trailing underscores trimmed.
   *
   * Examples:
   *   code "STADION_A"      → mapKey "STADION_A"
   *   code "KUNSTRASEN_2_A" → mapKey "KUNSTRASEN_2_A"
   *   code "kr2-a"          → mapKey "KR2_A"
   *   code "Feld A"         → mapKey "FELD_A"
   *
   * Null when the resource code is blank or normalizes to an empty string.
   * The aerial-map CSS layer uses this key for field card positioning.
   *
   * Note: explicit map-position configuration (e.g. pixel coordinates or a
   * dedicated mapKey column) may be required in a later slice when multi-tenant
   * aerial images with different layouts are introduced.
   */
  readonly mapKey: string | null;

  /**
   * Display order for field cards, ascending.
   * Derived from FacilityResource.sortOrder; tie-broken by name asc then id asc.
   */
  readonly displayOrder: number;

  /** Current occupancy state of the field at the time the feed was generated. */
  readonly state: Screen2FieldState;

  /**
   * The single current (in-progress) allocation for this field, or null.
   * When multiple overlapping events exist, the deterministic primary event
   * is selected (see conflictCount). The additional events are counted but
   * not exposed to avoid map-card overflow.
   */
  readonly current: InfoboardScreen2Allocation | null;

  /**
   * The next upcoming allocation on today's local calendar date, or null.
   * Earliest by startAt; tie-broken by deterministic sort (sortOrder, id).
   * Present only when state is FREE_WITH_NEXT or ACTIVE (an upcoming event
   * exists after the current one).
   */
  readonly next: InfoboardScreen2Allocation | null;

  /**
   * Number of additional overlapping current events beyond the primary one.
   * Zero when there is no conflict. Non-zero indicates a double-booking.
   */
  readonly conflictCount: number;
};

// ── Diagnostics ───────────────────────────────────────────────────────────────

/**
 * Lightweight diagnostics for testing, logging, and future administration UI.
 *
 * All counts are deterministic; no sensitive data is exposed.
 */
export type InfoboardScreen2Diagnostics = {
  /** Total events returned by the source loader (before policy filtering). */
  readonly sourceEventCount: number;

  /** Events that passed publication policy for INFOBOARD_SCREEN_2. */
  readonly eligibleEventCount: number;

  /**
   * Total allocation candidates produced by the event mapper.
   * An event expanded to N fields produces N candidates.
   */
  readonly mappedAllocationCount: number;

  /** Number of display fields included in the feed. */
  readonly fieldCount: number;

  /**
   * Number of eligible events whose pitchCode did not match any display
   * field resource. These events are publication-eligible but cannot be
   * placed on the map.
   */
  readonly unassignedEventCount: number;

  /** Number of fields with conflictCount > 0. */
  readonly conflictingFieldCount: number;

  /**
   * Event IDs of unassigned events (pitchCode not matching any display field).
   * Stable sorted by event ID for deterministic output.
   */
  readonly unassignedEventIds: readonly string[];

  /**
   * Resource IDs of fields with at least one active conflict.
   * Stable sorted by resourceId for deterministic output.
   */
  readonly conflictingFieldResourceIds: readonly string[];
};

// ── Feed ─────────────────────────────────────────────────────────────────────

/**
 * Complete payload for Infoboard Screen 2.
 *
 * Canonical type for the Screen 2 feed builder output. Supersedes the stub
 * InfoboardScreen2Feed in event-types.ts.
 *
 * Fields are ordered consistently with InfoboardScreen1Feed (generatedAt, tenant,
 * displayDate, isStale) for consumer symmetry.
 */
export type InfoboardScreen2Feed = {
  /** UTC ISO-8601 timestamp when the feed was assembled. */
  readonly generatedAt: string;

  /** Tenant reference including IANA timezone. */
  readonly tenant: InfoboardTenantRef;

  /** Tenant-local calendar date being displayed, YYYY-MM-DD. */
  readonly displayDate: string;

  /** IANA timezone string used for all local-time derivations, e.g. "Europe/Zurich". */
  readonly timeZone: string;

  /** True when the feed may be serving stale cached data. */
  readonly isStale: boolean;

  /**
   * Display fields ordered by displayOrder ascending.
   * Each field corresponds to one non-dressing-room FacilityResource.
   */
  readonly fields: readonly InfoboardScreen2Field[];

  /** Diagnostic metadata. Always present (not optional) for testability. */
  readonly diagnostics: InfoboardScreen2Diagnostics;
};

// ── Internal allocation candidate ─────────────────────────────────────────────

/**
 * Intermediate type used by the mapper and occupancy resolver.
 *
 * Not exported from the feed builder; used only within the pipeline.
 * Associates a resolved allocation with the target resource ID.
 */
export type Screen2AllocationCandidate = {
  /**
   * The FacilityResource.id this candidate targets.
   * Identifies which display field this allocation applies to.
   */
  readonly resourceId: string;

  /** Resolved allocation DTO, ready for placement in a field card. */
  readonly allocation: InfoboardScreen2Allocation;
};

// ── Source event ──────────────────────────────────────────────────────────────

/**
 * Structural source type for a Screen 2 event.
 *
 * Satisfies PublicationPolicyEvent (tenantId, type, status, infoboardVisible,
 * websiteVisible, trainingsplanVisible, homeAway) and TemporalEvent (startAt,
 * endAt, type) via structural subtyping.
 *
 * All resource codes are raw FacilityResource.code strings.
 * All team/opponent naming candidates are optional.
 */
export type Screen2SourceEvent = {
  // ── PublicationPolicyEvent fields ───────────────────────────────────────
  readonly tenantId: string | null;
  readonly type: string;
  readonly status: string;
  readonly infoboardVisible: boolean;
  readonly websiteVisible: boolean;
  readonly trainingsplanVisible: boolean;
  readonly homeAway: string | null;

  // ── TemporalEvent fields ─────────────────────────────────────────────────
  readonly startAt: Date;
  readonly endAt: Date | null;

  // ── Identity / ordering ──────────────────────────────────────────────────
  readonly id: string;
  readonly sortOrder: number;

  // ── Display title ─────────────────────────────────────────────────────────
  readonly title: string;

  // ── Team naming candidates ────────────────────────────────────────────────
  readonly team?: {
    readonly name?: string | null;
    readonly displayName?: string | null;
    readonly shortName?: string | null;
  } | null;
  readonly teamFallbackName?: string | null;

  // ── Opponent naming ───────────────────────────────────────────────────────
  readonly opponentFallbackName?: string | null;

  // ── Competition / organizer ───────────────────────────────────────────────
  readonly competitionLabel?: string | null;
  readonly organizerName?: string | null;

  // ── Resource codes ────────────────────────────────────────────────────────
  /** Raw FacilityResource.code for the assigned pitch/field. Nullable. */
  readonly pitchCode: string | null;
  /** Raw FacilityResource.code for the home/team dressing room. Nullable. */
  readonly homeDressingRoomCode: string | null;
  /** Raw FacilityResource.code for the away/opponent dressing room. Nullable. */
  readonly awayDressingRoomCode: string | null;
};

// ── Display resource ───────────────────────────────────────────────────────────

/**
 * Normalized representation of a FacilityResource that should appear as a
 * display field on the Screen 2 aerial map.
 *
 * Produced by the resource normalizer from raw DB rows.
 * Does NOT include dressing rooms.
 */
export type Screen2DisplayResource = {
  readonly id: string;
  readonly tenantId: string;
  readonly facilityId: string;
  readonly facilityName: string;
  readonly name: string;
  readonly code: string;
  /**
   * FacilityResourceType as a string literal.
   * The normalizer passes through the string so no Prisma enum import is required.
   */
  readonly resourceType: string;
  readonly sortOrder: number;
  readonly mapKey: string | null;
};
