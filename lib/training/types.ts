/**
 * lib/training/types.ts
 *
 * Public TypeScript types for the canonical Training Foundation and
 * Training Plans (TRAINING-CORE-01 + TRAINING-PLANS-01).
 *
 * These types are the stable public contract for every downstream consumer:
 * Training Planner, Website Weekplanner, Team Pages, Infoboards,
 * Resource Planning, Calendar, Mobile App.
 *
 * Design decisions:
 *   - Dates/timestamps are ISO-8601 strings for easy serialisation.
 *   - startsAt/endsAt are "HH:mm" time-of-day strings, not timestamps,
 *     because a TrainingSeries recurs on weekdays rather than specific dates.
 *   - weekdays uses the Weekday enum (MONDAY … SUNDAY) for readability.
 *   - No resource allocation, weekplans, or publishing fields at this layer.
 */

export type TrainingSeriesStatus = "ACTIVE" | "INACTIVE" | "ARCHIVED";

export type Weekday =
  | "MONDAY"
  | "TUESDAY"
  | "WEDNESDAY"
  | "THURSDAY"
  | "FRIDAY"
  | "SATURDAY"
  | "SUNDAY";

// TRAINING-PLANS-01 types

export type TrainingPlanStatus = "ACTIVE" | "INACTIVE" | "ARCHIVED";

export type MissingAssignmentBehavior = "FALLBACK_TO_DEFAULT" | "NOT_SCHEDULED";

export type TrainingPlanAssignmentStatus = "SCHEDULED" | "NOT_SCHEDULED";

// ── DTOs ──────────────────────────────────────────────────────────────────────

/**
 * TRAININGCENTER-03A: a single weekday's resolved (effective) schedule.
 *
 * "Resolved" means the per-weekday override when set, else the series-level
 * startsAt/endsAt fallback — this is always the concrete time that
 * generation will use for occurrences on this weekday.
 */
export interface WeekdayScheduleDto {
  weekday: Weekday;
  /** Resolved time-of-day string "HH:mm" interpreted in `timezone`. */
  startsAt: string;
  /** Resolved time-of-day string "HH:mm" interpreted in `timezone`. */
  endsAt: string;
}

/** The resolved public shape returned by every service method. */
export interface TrainingSeriesDto {
  id: string;
  tenantId: string;
  teamSeasonId: string;
  title: string;
  description: string | null;
  status: TrainingSeriesStatus;
  /** Time-of-day string "HH:mm" interpreted in `timezone`. Fallback default for weekdays without their own override. */
  startsAt: string;
  /** Time-of-day string "HH:mm" interpreted in `timezone`. Fallback default for weekdays without their own override. */
  endsAt: string;
  /** IANA timezone identifier, e.g. "Europe/Zurich". */
  timezone: string;
  weekdays: Weekday[];
  /** TRAININGCENTER-03A: resolved per-weekday start/end times, ordered by weekday. */
  weekdaySchedules: WeekdayScheduleDto[];
  validFrom: string | null;
  validUntil: string | null;
  archivedAt: string | null;
  /** TRAININGCENTER-03A: number of canonical TrainingSession rows generated for this series. */
  sessionCount: number;
  createdAt: string;
  updatedAt: string;
}

/** Public shape for a tenant-defined training plan. */
export interface TrainingPlanDto {
  id: string;
  tenantId: string;
  seasonId: string;
  name: string;
  description: string | null;
  status: TrainingPlanStatus;
  isDefault: boolean;
  displayOrder: number;
  missingAssignmentBehavior: MissingAssignmentBehavior;
  /** Number of TrainingPlanAssignment rows for this plan. */
  assignmentCount: number;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
}

/** Public shape for a plan assignment connecting a series to a plan. */
export interface TrainingPlanAssignmentDto {
  id: string;
  tenantId: string;
  trainingPlanId: string;
  trainingSeriesId: string;
  trainingSeriesTitle: string;
  teamSeasonId: string;
  status: TrainingPlanAssignmentStatus;
  startTimeOverride: string | null;
  endTimeOverride: string | null;
  timezoneOverride: string | null;
  /** Effective start time: override ?? canonical series value. */
  effectiveStartTime: string;
  /** Effective end time: override ?? canonical series value. */
  effectiveEndTime: string;
  /** Effective timezone: override ?? canonical series value. */
  effectiveTimezone: string;
  createdAt: string;
  updatedAt: string;
}

// ── Input shapes ──────────────────────────────────────────────────────────────

/** TRAININGCENTER-03A: a per-weekday time override supplied to create/update. */
export interface WeekdayTimeOverrideInput {
  weekday: Weekday;
  /** Time-of-day "HH:mm" this weekday starts. Must be before endsAt. */
  startsAt: string;
  /** Time-of-day "HH:mm" this weekday ends. */
  endsAt: string;
}

export interface CreateTrainingSeriesInput {
  teamSeasonId: string;
  title: string;
  description?: string | null;
  /** Time-of-day "HH:mm". Required. Fallback for any weekday without its own entry in `weekdayTimes`. */
  startsAt: string;
  /** Time-of-day "HH:mm". Required. Must be after startsAt. Fallback for any weekday without its own entry in `weekdayTimes`. */
  endsAt: string;
  /** IANA timezone. Defaults to "UTC" when omitted. */
  timezone?: string;
  /** Weekdays on which the series recurs. At least one required. */
  weekdays: Weekday[];
  /**
   * TRAININGCENTER-03A: optional per-weekday start/end time overrides — one
   * recurring series may meet at different times on different weekdays
   * (e.g. Monday 17:00–18:00, Wednesday 16:00–17:00). Every entry's weekday
   * must also appear in `weekdays`. Weekdays present in `weekdays` but
   * without an entry here fall back to `startsAt`/`endsAt`.
   */
  weekdayTimes?: WeekdayTimeOverrideInput[];
  validFrom?: Date | null;
  validUntil?: Date | null;
}

export interface UpdateTrainingSeriesInput {
  title?: string;
  description?: string | null;
  startsAt?: string;
  endsAt?: string;
  timezone?: string;
  weekdays?: Weekday[];
  /** TRAININGCENTER-03A: per-weekday time overrides. Only applied when `weekdays` is also provided (recurrence days are always fully replaced together). */
  weekdayTimes?: WeekdayTimeOverrideInput[];
  validFrom?: Date | null;
  validUntil?: Date | null;
  status?: Exclude<TrainingSeriesStatus, "ARCHIVED">;
}

export interface ListTrainingSeriesFilter {
  teamSeasonId?: string;
  status?: TrainingSeriesStatus;
  /** Include archived series in results. Defaults to false. */
  includeArchived?: boolean;
}

// TRAINING-PLANS-01 input shapes

export interface CreateTrainingPlanInput {
  seasonId: string;
  name: string;
  description?: string | null;
  status?: Exclude<TrainingPlanStatus, "ARCHIVED">;
  isDefault?: boolean;
  displayOrder?: number;
  missingAssignmentBehavior?: MissingAssignmentBehavior;
}

export interface UpdateTrainingPlanInput {
  name?: string;
  description?: string | null;
  status?: Exclude<TrainingPlanStatus, "ARCHIVED">;
  displayOrder?: number;
  missingAssignmentBehavior?: MissingAssignmentBehavior;
}

export interface CopyTrainingPlanInput {
  name: string;
  description?: string | null;
  seasonId: string;
}

export interface UpsertTrainingPlanAssignmentInput {
  trainingPlanId: string;
  trainingSeriesId: string;
  startTimeOverride?: string | null;
  endTimeOverride?: string | null;
  timezoneOverride?: string | null;
  status?: TrainingPlanAssignmentStatus;
}

export interface ListTrainingPlansFilter {
  seasonId?: string;
  status?: TrainingPlanStatus;
  /** Include archived plans. Defaults to false. */
  includeArchived?: boolean;
}

// =============================================================================
// TRAINING-ALLOCATIONS-01: Canonical facility resource allocation types
// =============================================================================

/** Public shape for a canonical training resource allocation. */
export interface TrainingAllocationDto {
  id: string;
  tenantId: string;
  trainingSeriesId: string;
  facilityResourceId: string;
  /** Human-readable resource name, denormalised from FacilityResource. */
  facilityResourceName: string;
  /** Resource code, denormalised from FacilityResource. */
  facilityResourceCode: string;
  /** Resource type, denormalised from FacilityResource. */
  facilityResourceType: string;
  /** Facility id owning the resource. */
  facilityId: string;
  /** Facility name, denormalised from Facility. */
  facilityName: string;
  notes: string | null;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTrainingAllocationInput {
  trainingSeriesId: string;
  facilityResourceId: string;
  notes?: string | null;
  displayOrder?: number;
}

export interface UpdateTrainingAllocationInput {
  notes?: string | null;
  displayOrder?: number;
}

export interface ListTrainingAllocationsFilter {
  trainingSeriesId?: string;
  facilityResourceId?: string;
}

// =============================================================================
// TRAININGCENTER-02: Canonical Training Session Engine types
//
// TrainingSession is the canonical, dated occurrence generated from a
// recurring TrainingSeries. It is the stable public contract every
// downstream consumer (Weekplanner, Dayplanner, Website, Infoboard,
// Attendance, Weather, Communication) reads from.
// =============================================================================

/**
 * Lifecycle status of a generated TrainingSession.
 *
 * SCHEDULED           — canonical, active occurrence. Default consumer-facing state.
 * CANCELLED           — a genuine, manually-set operational status: "this actual
 *                        scheduled training was cancelled". Never written or
 *                        cleared by reconciliation.
 * POSTPONED / MOVED    — reserved for future exception handling (ad-hoc changes).
 *                        Same non-interference guarantee as CANCELLED.
 * RECURRENCE_REMOVED  — reconciliation-owned: "this generated occurrence is no
 *                        longer part of the TrainingSeries recurrence definition"
 *                        (weekday removed, validFrom/validUntil narrowed, ...).
 *                        Distinct from CANCELLED — see session-generation-service.ts.
 *                        Excluded from listTrainingSessions() by default; opt in
 *                        with `includeInactive: true` or an explicit `status` filter.
 */
export type TrainingSessionStatus =
  | "SCHEDULED"
  | "CANCELLED"
  | "POSTPONED"
  | "MOVED"
  | "RECURRENCE_REMOVED";

/** Public shape for a canonical generated training session. */
export interface TrainingSessionDto {
  id: string;
  tenantId: string;
  trainingSeriesId: string;
  /** Denormalised from the parent TrainingSeries for convenience. */
  trainingSeriesTitle: string;
  /** Denormalised from the parent TrainingSeries for join-free filtering. */
  teamSeasonId: string;
  /**
   * TRAININGCENTER-01: resolved team display name (TeamSeason.displayName
   * → Team.name → Team.alternativeName, via lib/teams/team-naming.ts) for
   * Month/Week/Day operational views.
   */
  teamName: string;
  /** Calendar date of this occurrence, "YYYY-MM-DD". */
  date: string;
  weekday: Weekday;
  /** ISO-8601 UTC instant the session starts. */
  startAt: string;
  /** ISO-8601 UTC instant the session ends. */
  endAt: string;
  /** IANA timezone snapshot used to resolve startAt/endAt for this occurrence. */
  timezone: string;
  status: TrainingSessionStatus;
  createdAt: string;
  updatedAt: string;
}

/** Input to generateTrainingSessions(): bounds the generation window. */
export interface GenerateTrainingSessionsInput {
  /** Inclusive lower bound of the generation window (calendar date). */
  from: Date;
  /** Inclusive upper bound of the generation window (calendar date). */
  to: Date;
}

/** Result of a single generateTrainingSessions() run. Always accurate, never estimated. */
export interface GenerateTrainingSessionsResult {
  trainingSeriesId: string;
  /** Total occurrences the recurrence rule produced within the requested window. */
  occurrencesInWindow: number;
  /** Newly-created TrainingSession rows. */
  created: number;
  /** Existing rows whose derived schedule (weekday/startAt/endAt/timezone) changed. */
  updated: number;
  /** Existing rows that already matched the derived schedule exactly (no write issued). */
  unchanged: number;
  /**
   * TRAININGCENTER-03A-FIX: previously SCHEDULED rows transitioned to
   * RECURRENCE_REMOVED because their date no longer matches the series'
   * recurrence rule. Never applied to CANCELLED/POSTPONED/MOVED rows.
   */
  deactivated: number;
  /**
   * TRAININGCENTER-03A-FIX: previously RECURRENCE_REMOVED rows transitioned
   * back to SCHEDULED because their date matches the recurrence rule again
   * (e.g. a removed weekday was re-added). Reuses the existing row — never
   * creates a duplicate for the same (trainingSeriesId, date).
   */
  reactivated: number;
}

export interface ListTrainingSessionsFilter {
  trainingSeriesId?: string;
  teamSeasonId?: string;
  status?: TrainingSessionStatus;
  /** Inclusive lower bound (calendar date). */
  dateFrom?: Date;
  /** Inclusive upper bound (calendar date). */
  dateTo?: Date;
  /**
   * TRAININGCENTER-03A-FIX: canonical reads (Weekplanner, Dayplanner,
   * Website, Infoboard) exclude RECURRENCE_REMOVED rows by default. Set to
   * `true` for historical/admin access that needs to see them too. Has no
   * effect when `status` is explicitly provided — an explicit status filter
   * is itself an opt-in to that specific status.
   */
  includeInactive?: boolean;
}
