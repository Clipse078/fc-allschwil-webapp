/**
 * lib/matchcenter/month-range.ts
 *
 * MATCHCENTER-UX-01 — timezone-aware month window resolution for the
 * Matchcenter month filter/navigation.
 *
 * Pure, deterministic functions: no I/O, no framework imports, no reliance
 * on the server's local timezone. Month boundaries are derived from real
 * IANA timezone data via Intl.DateTimeFormat — the same technique already
 * proven in lib/integrations/sfv/sync/provider-time.ts — rather than a
 * hardcoded UTC+1/+2 offset, so DST transitions (Europe/Zurich: last Sunday
 * of March / October) are always resolved correctly.
 */

export const MATCHCENTER_DEFAULT_TIMEZONE = "Europe/Zurich";

const MONTH_PARAM_PATTERN = /^(\d{4})-(\d{2})$/;

export type MatchcenterYearMonth = {
  year: number;
  month: number; // 1-based
};

export type MatchcenterMonthWindow = MatchcenterYearMonth & {
  /** Canonical "YYYY-MM" URL param for the resolved month. */
  param: string;
  /** Inclusive UTC instant of the first moment of the month in the timezone. */
  from: Date;
  /** Inclusive UTC instant of the last moment of the month in the timezone. */
  to: Date;
  /** URL param for the previous month. */
  previousParam: string;
  /** URL param for the next month. */
  nextParam: string;
};

function getZonedOffsetMinutes(utcMillis: number, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const parts = dtf.formatToParts(new Date(utcMillis));
  const map: Record<string, string> = {};
  for (const part of parts) {
    map[part.type] = part.value;
  }

  const hour = map.hour === "24" ? 0 : Number(map.hour);

  const asIfUtc = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    hour,
    Number(map.minute),
    Number(map.second),
  );

  return (asIfUtc - utcMillis) / 60_000;
}

function zonedWallTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  timeZone: string,
): Date {
  const naiveUtcGuess = Date.UTC(year, month - 1, day, hour, minute, second);

  let offsetMinutes = getZonedOffsetMinutes(naiveUtcGuess, timeZone);
  let correctedMillis = naiveUtcGuess - offsetMinutes * 60_000;

  const refinedOffsetMinutes = getZonedOffsetMinutes(correctedMillis, timeZone);
  if (refinedOffsetMinutes !== offsetMinutes) {
    offsetMinutes = refinedOffsetMinutes;
    correctedMillis = naiveUtcGuess - offsetMinutes * 60_000;
  }

  return new Date(correctedMillis);
}

/** Resolves the calendar year/month a UTC instant falls on, in `timeZone`. */
export function getZonedYearMonth(
  date: Date,
  timeZone: string = MATCHCENTER_DEFAULT_TIMEZONE,
): MatchcenterYearMonth {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
  });

  const parts = dtf.formatToParts(date);
  const map: Record<string, string> = {};
  for (const part of parts) {
    map[part.type] = part.value;
  }

  return { year: Number(map.year), month: Number(map.month) };
}

export function formatMonthParam(yearMonth: MatchcenterYearMonth): string {
  return `${yearMonth.year.toString().padStart(4, "0")}-${yearMonth.month
    .toString()
    .padStart(2, "0")}`;
}

/** Parses a "YYYY-MM" URL param. Returns null for anything malformed. */
export function parseMonthParam(
  param: string | null | undefined,
): MatchcenterYearMonth | null {
  if (!param) return null;

  const match = MONTH_PARAM_PATTERN.exec(param.trim());
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);

  if (month < 1 || month > 12) return null;

  return { year, month };
}

function addMonths(
  yearMonth: MatchcenterYearMonth,
  delta: number,
): MatchcenterYearMonth {
  const zeroBased = yearMonth.year * 12 + (yearMonth.month - 1) + delta;
  const year = Math.floor(zeroBased / 12);
  const month = (((zeroBased % 12) + 12) % 12) + 1;
  return { year, month };
}

/**
 * Resolves the full Matchcenter month window (query date range + navigation
 * params) for a given "YYYY-MM" URL param, defaulting to the current month
 * (in `timeZone`) when absent or malformed.
 */
export function resolveMatchcenterMonthWindow(input: {
  monthParam?: string | null;
  now?: Date;
  timeZone?: string;
}): MatchcenterMonthWindow {
  const timeZone = input.timeZone ?? MATCHCENTER_DEFAULT_TIMEZONE;
  const now = input.now ?? new Date();
  const yearMonth =
    parseMonthParam(input.monthParam) ?? getZonedYearMonth(now, timeZone);

  const from = zonedWallTimeToUtc(
    yearMonth.year,
    yearMonth.month,
    1,
    0,
    0,
    0,
    timeZone,
  );

  const nextMonth = addMonths(yearMonth, 1);
  const startOfNextMonth = zonedWallTimeToUtc(
    nextMonth.year,
    nextMonth.month,
    1,
    0,
    0,
    0,
    timeZone,
  );
  const to = new Date(startOfNextMonth.getTime() - 1);

  const previousMonth = addMonths(yearMonth, -1);

  return {
    ...yearMonth,
    param: formatMonthParam(yearMonth),
    from,
    to,
    previousParam: formatMonthParam(previousMonth),
    nextParam: formatMonthParam(nextMonth),
  };
}

/** Human-readable "August 2026"-style label for a resolved month window. */
export function formatMonthLabel(
  yearMonth: MatchcenterYearMonth,
  locale: string = "de-CH",
  timeZone: string = MATCHCENTER_DEFAULT_TIMEZONE,
): string {
  // Noon UTC on the 1st avoids any DST-edge date rollover when formatting.
  const reference = new Date(
    Date.UTC(yearMonth.year, yearMonth.month - 1, 1, 12, 0, 0),
  );

  return new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
    timeZone,
  }).format(reference);
}
