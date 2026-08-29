/**
 * lib/wochenplan/public-current-week.ts
 *
 * WOCHENPLAN-2.0-01C — deterministic current-calendar-week resolution for
 * the public Wochenplan contract.
 *
 * Uses the tenant's configured IANA timezone (fallback: Europe/Zurich) via
 * resolveTrainingWeekWindow — the same Monday-first, DST-safe week boundary
 * algorithm TrainingCenter and Weekplanner already rely on.
 */

import { TRAINING_DEFAULT_TIMEZONE } from "@/lib/training/date-range";
import { resolveTrainingWeekWindow } from "@/lib/training/date-range";
import {
  formatWeekNumberLabel,
  formatWeekRangeLabel,
  getIsoWeekNumber,
} from "@/lib/weekplanner/date";

export type PublicCurrentWeekWindow = {
  /** Monday "YYYY-MM-DD" param identifying the resolved week. */
  weekId: string;
  /** Inclusive UTC instant of Monday 00:00 in the tenant timezone. */
  from: Date;
  /** Inclusive UTC instant of Sunday 23:59:59.999 in the tenant timezone. */
  to: Date;
  /** Seven "YYYY-MM-DD" day keys, Monday first. */
  days: string[];
  /** e.g. "KW 35" */
  calendarWeekLabel: string;
  /** e.g. "24. Aug – 30. Aug 2026" */
  rangeLabel: string;
  /** ISO week number (1–53). */
  calendarWeek: number;
  timeZone: string;
};

/**
 * Resolves the current calendar week for a tenant using its configured timezone.
 * When `now` is omitted, uses the current instant.
 */
export function resolvePublicCurrentWeekWindow(input: {
  timeZone?: string | null;
  now?: Date;
}): PublicCurrentWeekWindow {
  const timeZone = input.timeZone?.trim() || TRAINING_DEFAULT_TIMEZONE;
  const window = resolveTrainingWeekWindow({
    now: input.now,
    timeZone,
  });

  return {
    weekId: window.param,
    from: window.from,
    to: window.to,
    days: window.days,
    calendarWeekLabel: formatWeekNumberLabel(window.days),
    rangeLabel: formatWeekRangeLabel(window.days),
    calendarWeek: getIsoWeekNumber(window.days[0] ?? ""),
    timeZone,
  };
}

/**
 * Returns true when `instant` falls inside the resolved week window
 * [from, to] (inclusive).
 */
export function isInstantInWeekWindow(
  instant: Date,
  window: Pick<PublicCurrentWeekWindow, "from" | "to">,
): boolean {
  const time = instant.getTime();
  return time >= window.from.getTime() && time <= window.to.getTime();
}
