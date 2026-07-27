/**
 * lib/training/types.ts
 *
 * Public TypeScript types for the canonical Training Foundation.
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
