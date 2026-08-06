/**
 * lib/training/recurrence.ts
 *
 * Pure, deterministic recurrence engine for the canonical Training Session
 * Engine (TRAININGCENTER-02).
 *
 * Turns a TrainingSeries recurrence rule — weekday(s) + time-of-day + IANA
 * timezone, bounded by validFrom/validUntil — into a list of concrete
 * calendar occurrences within a requested generation window.
 *
 * No database access, no framework imports, no reading of the system clock —
 * fully unit-testable and safe to call from any context (service layer,
 * scripts, future cron jobs).
 *
 * Recurrence support (per TRAININGCENTER-02):
 *   - start date / end date (validFrom / validUntil, intersected with the
 *     caller-supplied generation window)
 *   - one or more weekdays
 *   - start time / end time ("HH:mm"), resolved per-occurrence against the
 *     series timezone so DST transitions never shift the local wall-clock
 *     time of a session.
 *
 * Explicitly NOT implemented here (future extension points — see the
 * TRAININGCENTER-02 doc comment on the TrainingSession Prisma model):
 *   - holidays, skipped dates, one-off exceptions. A future caller can
 *     filter/skip returned occurrences (or consult an exception table before
 *     calling this module) without any change to the algorithm below.
 */

import type { Weekday } from "./types";

// ── Weekday <-> JS Date.getUTCDay() mapping ──────────────────────────────────

const JS_DAY_TO_WEEKDAY: readonly Weekday[] = [
  "SUNDAY",
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
];

// ── Pure calendar-date helpers (UTC-anchored date-only arithmetic) ──────────

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Normalises a "pure calendar date" DateTime (stored at UTC midnight, same
 * convention as Season.startDate/endDate and TrainingSeries.validFrom/
 * validUntil) to the UTC-midnight timestamp for that calendar date.
 *
 * Any time-of-day component on the input is ignored — only the UTC calendar
 * date (year/month/day) is used.
 */
export function toDateOnlyUtc(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/** Formats a UTC-midnight calendar date as a "YYYY-MM-DD" key. */
export function dateKeyFromDate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// ── Zoned time-of-day → UTC instant ─────────────────────────────────────────

/**
 * Returns the UTC offset (in ms) applied by `timeZone` at the given instant.
 * Positive for zones ahead of UTC (e.g. Europe/Zurich in summer is +7,200,000).
 *
 * @throws {RangeError} When `timeZone` is not a valid IANA timezone identifier.
 */
function getTimeZoneOffsetMs(instant: Date, timeZone: string): number {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const parts = formatter.formatToParts(instant);
  const map: Record<string, string> = {};
  for (const part of parts) {
    map[part.type] = part.value;
  }

  // Some ICU implementations render midnight as "24:00" instead of "00:00".
  const hour = map.hour === "24" ? 0 : Number(map.hour);

  const asUtc = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    hour,
    Number(map.minute),
    Number(map.second),
  );

  return asUtc - instant.getTime();
}

/**
 * Resolves a local wall-clock time ("HH:mm") on a given calendar date
 * ("YYYY-MM-DD") in an IANA timezone to the corresponding UTC instant.
 *
 * Correctly accounts for DST: the zone offset is resolved iteratively (at
 * most two passes) so that transitions occurring between the naive guess and
 * the corrected instant never produce an off-by-one-hour result. This is the
 * same technique used by mainstream zoned-time libraries (e.g. date-fns-tz).
 *
 * @throws {RangeError} When `timeZone` is not a valid IANA timezone identifier.
 */
export function zonedTimeToUtc(dateKey: string, time: string, timeZone: string): Date {
  const [year, month, day] = dateKey.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);

  // First guess: treat the wall-clock components as if they were UTC, then
  // correct by the zone's offset at that guessed instant.
  const naiveUtcMs = Date.UTC(year, month - 1, day, hour, minute, 0);

  const offset1 = getTimeZoneOffsetMs(new Date(naiveUtcMs), timeZone);
  const correctedMs = naiveUtcMs - offset1;

  // Re-resolve the offset at the corrected instant. If it differs from the
  // first guess, a DST transition falls between the two — recompute once
  // more using the newly observed offset.
  const offset2 = getTimeZoneOffsetMs(new Date(correctedMs), timeZone);
  const finalMs = offset2 === offset1 ? correctedMs : naiveUtcMs - offset2;

  return new Date(finalMs);
}

// ── Occurrence generation ────────────────────────────────────────────────────

/** A per-weekday time-of-day override (TRAININGCENTER-03A: separate start/end time per weekday). */
export interface WeekdayTimeOverride {
  /** Time-of-day "HH:mm" this weekday's occurrences start. */
  startsAt: string;
  /** Time-of-day "HH:mm" this weekday's occurrences end. */
  endsAt: string;
}

/** The recurrence-relevant subset of a TrainingSeries, decoupled from Prisma row shapes. */
export interface TrainingSeriesRecurrenceInput {
  /** Inclusive calendar-date lower bound of the series, or null for unbounded. */
  validFrom: Date | null;
  /** Inclusive calendar-date upper bound of the series, or null for unbounded. */
  validUntil: Date | null;
  /** At least one weekday is required to produce any occurrences. */
  weekdays: Weekday[];
  /** IANA timezone identifier, e.g. "Europe/Zurich". */
  timezone: string;
  /** Time-of-day "HH:mm" the session starts. Used as the fallback for any weekday without an entry in `weekdayTimes`. */
  startsAt: string;
  /** Time-of-day "HH:mm" the session ends. Used as the fallback for any weekday without an entry in `weekdayTimes`. */
  endsAt: string;
  /**
   * Optional per-weekday time overrides (TRAININGCENTER-03A). A recurring
   * series may meet at different times on different weekdays — e.g. Monday
   * 17:00–18:00, Wednesday 16:00–17:00. When a weekday has an entry here, it
   * takes precedence over `startsAt`/`endsAt` for occurrences on that
   * weekday. Weekdays without an entry fall back to `startsAt`/`endsAt`.
   */
  weekdayTimes?: Partial<Record<Weekday, WeekdayTimeOverride>>;
}

/** Bounds a single generation run. Both ends are inclusive calendar dates. */
export interface GenerationWindow {
  from: Date;
  to: Date;
}

/** One concrete, dated occurrence produced by the recurrence engine. */
export interface GeneratedTrainingOccurrence {
  /** Calendar date key "YYYY-MM-DD". */
  dateKey: string;
  /** Calendar date at UTC midnight — matches TrainingSession.date storage convention. */
  date: Date;
  weekday: Weekday;
  /** Resolved UTC instant the occurrence starts. */
  startAt: Date;
  /** Resolved UTC instant the occurrence ends. */
  endAt: Date;
}

/**
 * Generates every concrete occurrence of `series` that falls within
 * `window`, intersected with the series' own validFrom/validUntil bounds.
 *
 * Pure and deterministic: the same inputs always produce the same ordered
 * list of occurrences (ascending by date), which is what backs idempotent
 * generation at the service layer.
 *
 * Iterates day-by-day using UTC calendar-date arithmetic, which is naturally
 * correct across DST transitions and leap years:
 *   - DST changes only affect zoned wall-clock offsets (handled per-occurrence
 *     by `zonedTimeToUtc`), never the UTC calendar-date grid itself.
 *   - Leap years are handled by `Date.UTC` normalisation — Feb 28 + 1 day
 *     resolves to Feb 29 in a leap year and Mar 1 otherwise, with no special
 *     case needed here.
 *
 * @throws {Error} When `series.weekdays` is empty, or `window.from` is after `window.to`.
 * @throws {RangeError} When `series.timezone` is not a valid IANA timezone identifier.
 */
export function generateTrainingSessionOccurrences(
  series: TrainingSeriesRecurrenceInput,
  window: GenerationWindow,
): GeneratedTrainingOccurrence[] {
  if (!series.weekdays || series.weekdays.length === 0) {
    throw new Error(
      "generateTrainingSessionOccurrences: at least one weekday is required",
    );
  }

  const windowFromMs = toDateOnlyUtc(window.from).getTime();
  const windowToMs = toDateOnlyUtc(window.to).getTime();
  if (windowFromMs > windowToMs) {
    throw new Error(
      "generateTrainingSessionOccurrences: window.from must not be after window.to",
    );
  }

  const lowerBoundMs = series.validFrom
    ? Math.max(windowFromMs, toDateOnlyUtc(series.validFrom).getTime())
    : windowFromMs;
  const upperBoundMs = series.validUntil
    ? Math.min(windowToMs, toDateOnlyUtc(series.validUntil).getTime())
    : windowToMs;

  if (lowerBoundMs > upperBoundMs) {
    return [];
  }

  const weekdaySet = new Set(series.weekdays);
  const occurrences: GeneratedTrainingOccurrence[] = [];

  for (let ms = lowerBoundMs; ms <= upperBoundMs; ms += DAY_MS) {
    const jsDay = new Date(ms).getUTCDay();
    const weekday = JS_DAY_TO_WEEKDAY[jsDay];
    if (!weekdaySet.has(weekday)) continue;

    const date = new Date(ms);
    const dateKey = dateKeyFromDate(date);
    const override = series.weekdayTimes?.[weekday];
    const startsAt = override?.startsAt ?? series.startsAt;
    const endsAt = override?.endsAt ?? series.endsAt;

    occurrences.push({
      dateKey,
      date,
      weekday,
      startAt: zonedTimeToUtc(dateKey, startsAt, series.timezone),
      endAt: zonedTimeToUtc(dateKey, endsAt, series.timezone),
    });
  }

  return occurrences;
}
