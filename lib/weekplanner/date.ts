/**
 * lib/weekplanner/date.ts
 *
 * WEEKPLANNER-01A — pure, self-contained date helpers for the canonical
 * Weekplanner foundation.
 *
 * The Monday–Sunday week window itself (DST-safe, Europe/Zurich) is resolved
 * via the already-tested `resolveTrainingWeekWindow()` from
 * lib/training/date-range.ts — TrainingSession is one of Weekplanner's three
 * canonical inputs, and that resolver is a generic, publicly-exported
 * Monday-first week boundary utility (not TrainingCenter-specific business
 * logic), so reusing it here avoids re-implementing DST-sensitive zoned-time
 * math a second time. See TrainingCenter's own "Woche" tab for the identical
 * technique.
 *
 * Only the pieces genuinely specific to Weekplanner's presentation (ISO week
 * number, the "10. Aug – 16. Aug 2026" range label, and resolving a Zurich
 * calendar-day key for a real UTC instant such as Event.startAt) live here.
 *
 * Pure, deterministic, no I/O.
 */

export const WEEKPLANNER_DEFAULT_TIMEZONE = "Europe/Zurich";

/** Dot-free German month abbreviations — mirrors the list already used by app/(admin)/dashboard/page.tsx. */
const MONTHS_DE = [
  "Jan",
  "Feb",
  "Mär",
  "Apr",
  "Mai",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Okt",
  "Nov",
  "Dez",
];

/**
 * Resolves the Europe/Zurich calendar date ("YYYY-MM-DD") a real UTC instant
 * falls on. Uses the `en-CA` locale, which formats dates as "YYYY-MM-DD" by
 * convention — a standard, dependency-free technique for extracting a
 * timezone-correct calendar day from an `Intl.DateTimeFormat` without any
 * naive UTC-offset arithmetic.
 */
export function zonedDateKey(
  date: Date,
  timeZone: string = WEEKPLANNER_DEFAULT_TIMEZONE,
): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** Parses a "YYYY-MM-DD" day key into its numeric components. Returns null when malformed. */
export function parseDayKey(
  dayKey: string,
): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dayKey.trim());
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

/**
 * ISO-8601 week number (1–53) of a plain calendar date, computed via pure
 * date-only arithmetic (the ISO week definition depends only on the
 * calendar date, never on a timezone) — mirrors the well-known
 * "nearest Thursday" algorithm.
 */
/** Returns the Thursday of the ISO week containing `date` (pure UTC-anchored date-only math). */
function thursdayOfIsoWeek(date: Date): Date {
  const jsWeekday = date.getUTCDay(); // 0 = Sunday
  const isoWeekday = jsWeekday === 0 ? 7 : jsWeekday;
  const thursday = new Date(date.getTime());
  thursday.setUTCDate(thursday.getUTCDate() + (4 - isoWeekday));
  return thursday;
}

export function getIsoWeekNumber(dayKey: string): number {
  const parsed = parseDayKey(dayKey);
  if (!parsed) return 0;

  const date = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day));
  const thursday = thursdayOfIsoWeek(date);

  // January 4 always falls in ISO week 1 of its calendar year by definition
  // — anchoring on it (rather than January 1, which may itself belong to
  // the PREVIOUS ISO year's last week) is what makes this correct at every
  // year boundary.
  const jan4 = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 4));
  const firstThursday = thursdayOfIsoWeek(jan4);

  const diffMs = thursday.getTime() - firstThursday.getTime();
  return 1 + Math.round(diffMs / (7 * 24 * 60 * 60 * 1000));
}

/**
 * Human-readable "10. Aug – 16. Aug 2026"-style range label for a resolved
 * Monday-first week (7 "YYYY-MM-DD" day keys).
 */
export function formatWeekRangeLabel(days: readonly string[]): string {
  const first = parseDayKey(days[0] ?? "");
  const last = parseDayKey(days[days.length - 1] ?? "");
  if (!first || !last) return "";

  const firstLabel = `${first.day}. ${MONTHS_DE[first.month - 1]}`;
  const lastLabel = `${last.day}. ${MONTHS_DE[last.month - 1]}`;

  return `${firstLabel} – ${lastLabel} ${last.year}`;
}

/** "KW 33"-style ISO week label for a resolved Monday-first week. */
export function formatWeekNumberLabel(days: readonly string[]): string {
  const weekNumber = getIsoWeekNumber(days[0] ?? "");
  return `KW ${weekNumber}`;
}
