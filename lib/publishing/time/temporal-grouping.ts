/**
 * lib/publishing/time/temporal-grouping.ts
 *
 * Tenant-timezone-aware temporal utilities for the SportClubEvo Publishing
 * Platform. All functions are pure: no database access, no framework imports,
 * no reading of the system clock. Callers must supply `now` explicitly to
 * ensure deterministic, testable behaviour.
 *
 * Timezone handling uses `Intl.DateTimeFormat` with `formatToParts()` to
 * avoid any dependency on the server's local timezone.
 */

// ── Default durations ─────────────────────────────────────────────────────────

/**
 * Operational fallback durations (minutes) used when an event has no explicit
 * `endAt`. These are heuristic assumptions only and do not affect database
 * storage or existing domain models.
 *
 * The `DEFAULT` key is the catch-all for unknown or future event types.
 */
export const DEFAULT_EVENT_DURATIONS_MINUTES = {
  MATCH: 110,
  TRAINING: 90,
  TOURNAMENT: 240,
  OTHER: 60,
  VACATION_PERIOD: 1440,
  DEFAULT: 60,
} as const;

// ── Types ─────────────────────────────────────────────────────────────────────

/**
 * Minimum shape required for temporal classification.
 * Callers typically pass richer event objects — the generic parameter T
 * preserves the full type through `TemporalGroupingResult`.
 */
export type TemporalEvent = {
  startAt: Date;
  endAt: Date | null;
  /** Must match a key in `DEFAULT_EVENT_DURATIONS_MINUTES` or fall back to DEFAULT. */
  type: string;
};

/** Options accepted by `partitionByTemporalGroup`. */
export type TemporalGroupingOptions = {
  /**
   * Override the built-in default durations.
   * Unknown keys fall back to the `DEFAULT` key in the supplied map,
   * and then to `DEFAULT_EVENT_DURATIONS_MINUTES.DEFAULT` if absent.
   */
  defaultDurationsMinutes?: Readonly<Record<string, number>>;
  /**
   * Optional rolling look-ahead window, in milliseconds, applied to future
   * events instead of the default "same tenant-local calendar day" rule.
   *
   * When supplied, a future event is eligible for `next`/`later` when
   * `startAt.getTime() - now.getTime() <= horizonMs` (inclusive upper bound).
   * The tenant-local calendar day is not considered, so the window correctly
   * spans a local midnight boundary.
   *
   * When omitted, behaviour is unchanged: future events are eligible only
   * when they fall on the same tenant-local calendar day as `now`.
   *
   * Never affects `current` (already-active) events, which are always
   * included regardless of how long ago they started.
   */
  horizonMs?: number;
};

/** Output of `partitionByTemporalGroup`. */
export type TemporalGroupingResult<T> = {
  /** Events currently in progress: started at or before `now`, end after `now`. */
  current: T[];
  /**
   * Future events whose `startAt` equals the earliest upcoming start time on
   * the tenant-local calendar day. Multiple simultaneous events are all included.
   */
  next: T[];
  /** All remaining future events for the tenant-local calendar day. */
  later: T[];
};

// ── toLocalDateKey ─────────────────────────────────────────────────────────────

/**
 * Returns the calendar date of `value` in the given IANA timezone as a
 * `YYYY-MM-DD` string, constructed via `Intl.DateTimeFormat.formatToParts()`
 * so the result is independent of the server's local timezone.
 *
 * @throws {RangeError} When `timezone` is not a valid IANA timezone identifier.
 *
 * @example
 * toLocalDateKey(new Date("2026-07-23T22:15:00.000Z"), "Europe/Zurich")
 * // → "2026-07-24"  (UTC+2 in summer, so 22:15 UTC = 00:15 next day locally)
 */
export function toLocalDateKey(value: Date, timezone: string): string {
  // The Intl.DateTimeFormat constructor validates the timezone and throws
  // RangeError for invalid identifiers such as "Europe/Invalid".
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const parts = formatter.formatToParts(value);

  let year: string | undefined;
  let month: string | undefined;
  let day: string | undefined;

  for (const part of parts) {
    if (part.type === "year") year = part.value;
    else if (part.type === "month") month = part.value;
    else if (part.type === "day") day = part.value;
  }

  if (year === undefined || month === undefined || day === undefined) {
    throw new Error(
      `toLocalDateKey: failed to extract date parts for timezone "${timezone}"`,
    );
  }

  return `${year}-${month}-${day}`;
}

// ── isLocalToday ──────────────────────────────────────────────────────────────

/**
 * Returns `true` when `value` and `now` fall on the same calendar date in the
 * given IANA timezone. Delegates entirely to `toLocalDateKey` so all timezone
 * logic is centralised.
 */
export function isLocalToday(
  value: Date,
  now: Date,
  timezone: string,
): boolean {
  return toLocalDateKey(value, timezone) === toLocalDateKey(now, timezone);
}

// ── getEffectiveEndAt ─────────────────────────────────────────────────────────

/**
 * Returns the effective end time for an event:
 *
 * 1. If `event.endAt` is a valid `Date` that is strictly after `event.startAt`,
 *    return it unchanged.
 * 2. Otherwise (null, equal to, or before `startAt`) fall back to the configured
 *    duration for the event type. Unknown types use the `DEFAULT` key.
 *
 * The input object is never mutated; a new `Date` is always returned.
 */
export function getEffectiveEndAt(
  event: {
    readonly startAt: Date;
    readonly endAt: Date | null;
    readonly type: string;
  },
  defaultDurationsMinutes: Readonly<
    Record<string, number>
  > = DEFAULT_EVENT_DURATIONS_MINUTES,
): Date {
  if (event.endAt !== null && event.endAt.getTime() > event.startAt.getTime()) {
    return event.endAt;
  }

  const durationMinutes =
    defaultDurationsMinutes[event.type] ??
    defaultDurationsMinutes["DEFAULT"] ??
    DEFAULT_EVENT_DURATIONS_MINUTES.DEFAULT;

  return new Date(event.startAt.getTime() + durationMinutes * 60_000);
}

// ── partitionByTemporalGroup ──────────────────────────────────────────────────

/**
 * Partitions events into three temporal buckets relative to the tenant-local
 * calendar day of `now`:
 *
 * - **current** — started at or before `now`; effective end time is after `now`.
 * - **next** — all future events sharing the earliest upcoming `startAt`
 *   among the eligible future events. Multiple simultaneous events are all
 *   included.
 * - **later** — all other eligible future events.
 *
 * Future-event eligibility defaults to "same tenant-local calendar day as
 * `now`". Passing `options.horizonMs` replaces this with a rolling
 * look-ahead window measured from `now` (see `TemporalGroupingOptions`).
 *
 * Events whose effective end time is at or before `now` are excluded entirely.
 * Overnight events (started on a prior local day, still running) appear in
 * `current` because `startAt <= now && effectiveEnd > now`.
 *
 * Ordering:
 * - `current` is sorted by `startAt` ascending (stable for equal timestamps).
 * - `next` and `later` are sorted by `startAt` ascending (stable for equal
 *   timestamps), preserving original input order as the tiebreaker.
 *
 * Input arrays and event objects are never mutated.
 *
 * @throws {RangeError} When `timezone` is not a valid IANA timezone identifier.
 */
export function partitionByTemporalGroup<T extends TemporalEvent>(
  events: readonly T[],
  now: Date,
  timezone: string,
  options?: TemporalGroupingOptions,
): TemporalGroupingResult<T> {
  const durations =
    options?.defaultDurationsMinutes ?? DEFAULT_EVENT_DURATIONS_MINUTES;

  // Validate timezone eagerly (toLocalDateKey throws RangeError for invalid tz).
  const todayKey = toLocalDateKey(now, timezone);

  const nowMs = now.getTime();

  type Indexed = { event: T; idx: number };

  const current: Indexed[] = [];
  const futureCandidates: Indexed[] = [];

  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    const effectiveEnd = getEffectiveEndAt(event, durations);

    // Skip events that have already ended.
    if (effectiveEnd.getTime() <= nowMs) continue;

    if (event.startAt.getTime() <= nowMs) {
      // Started in the past (or exactly now) and still running → current.
      current.push({ event, idx: i });
    } else if (options?.horizonMs !== undefined) {
      // Rolling look-ahead window: include only when the start time falls
      // within horizonMs of now. Calendar-day boundaries are irrelevant here.
      if (event.startAt.getTime() - nowMs <= options.horizonMs) {
        futureCandidates.push({ event, idx: i });
      }
    } else {
      // Future event: include only when it falls on today's local date.
      const eventDateKey = toLocalDateKey(event.startAt, timezone);
      if (eventDateKey === todayKey) {
        futureCandidates.push({ event, idx: i });
      }
    }
  }

  // Stable sort: primary key is startAt ms, secondary is original index.
  const stableSort = (a: Indexed, b: Indexed): number =>
    a.event.startAt.getTime() - b.event.startAt.getTime() || a.idx - b.idx;

  current.sort(stableSort);
  futureCandidates.sort(stableSort);

  // Partition future candidates into next (earliest start group) and later.
  const next: Indexed[] = [];
  const later: Indexed[] = [];

  if (futureCandidates.length > 0) {
    const earliestMs = futureCandidates[0].event.startAt.getTime();
    for (const item of futureCandidates) {
      if (item.event.startAt.getTime() === earliestMs) {
        next.push(item);
      } else {
        later.push(item);
      }
    }
  }

  return {
    current: current.map((x) => x.event),
    next: next.map((x) => x.event),
    later: later.map((x) => x.event),
  };
}
