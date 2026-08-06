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

/** The resolved public shape returned by every service method. */
export interface TrainingSeriesDto {
  id: string;
  tenantId: string;
  teamSeasonId: string;
  title: string;
  description: string | null;
  status: TrainingSeriesStatus;
  /** Time-of-day string "HH:mm" interpreted in `timezone`. */
  startsAt: string;
  /** Time-of-day string "HH:mm" interpreted in `timezone`. */
  endsAt: string;
  /** IANA timezone identifier, e.g. "Europe/Zurich". */
  timezone: string;
  weekdays: Weekday[];
  validFrom: string | null;
  validUntil: string | null;
  archivedAt: string | null;
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

export interface CreateTrainingSeriesInput {
  teamSeasonId: string;
  title: string;
  description?: string | null;
  /** Time-of-day "HH:mm". Required. */
  startsAt: string;
  /** Time-of-day "HH:mm". Required. Must be after startsAt. */
  endsAt: string;
  /** IANA timezone. Defaults to "UTC" when omitted. */
  timezone?: string;
  /** Weekdays on which the series recurs. At least one required. */
  weekdays: Weekday[];
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
 * CANCELLED / POSTPONED / MOVED are reserved for future exception handling
 * (holidays, skipped dates, ad-hoc changes). The generator introduced in
 * this PR only ever writes/updates SCHEDULED rows.
 */
export type TrainingSessionStatus = "SCHEDULED" | "CANCELLED" | "POSTPONED" | "MOVED";

/** Public shape for a canonical generated training session. */
export interface TrainingSessionDto {
  id: string;
  tenantId: string;
  trainingSeriesId: string;
  /** Denormalised from the parent TrainingSeries for convenience. */
  trainingSeriesTitle: string;
  /** Denormalised from the parent TrainingSeries for join-free filtering. */
  teamSeasonId: string;
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
}

export interface ListTrainingSessionsFilter {
  trainingSeriesId?: string;
  teamSeasonId?: string;
  status?: TrainingSessionStatus;
  /** Inclusive lower bound (calendar date). */
  dateFrom?: Date;
  /** Inclusive upper bound (calendar date). */
  dateTo?: Date;
}
