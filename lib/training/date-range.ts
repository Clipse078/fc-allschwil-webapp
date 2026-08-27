/**
 * lib/training/date-range.ts
 *
 * TRAININGCENTER-01 — timezone-aware Month/Week/Day window resolution for
 * the TrainingCenter operational calendar (Monat | Woche | Tag).
 *
 * Deliberately mirrors the DST-safe technique already proven for Matchcenter
 * (lib/matchcenter/month-range.ts): month/week/day boundaries are derived
 * from real IANA timezone data via Intl.DateTimeFormat rather than a
 * hardcoded UTC offset, so DST transitions (Europe/Zurich: last Sunday of
 * March/October) are always resolved correctly.
 *
 * Kept self-contained to lib/training (not shared with lib/matchcenter) per
 * the TRAININGCENTER-01 anti-drift rule against modifying unrelated
 * modules — the underlying algorithm is intentionally identical in spirit,
 * but Matchcenter's module is left untouched.
 *
 * Pure, deterministic functions: no I/O, no framework imports, no reliance
 * on the server's local timezone.
 */

export const TRAINING_DEFAULT_TIMEZONE = "Europe/Zurich";

export type TrainingCenterView = "MONTH" | "WEEK" | "DAY";

const MONTH_PARAM_PATTERN = /^(\d{4})-(\d{2})$/;
const DATE_PARAM_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export type YearMonth = { year: number; month: number /* 1-based */ };

/** Common shape returned by every resolve*Window() function below. */
export type TrainingDateWindow = {
  /** Inclusive UTC instant of the first moment of the window in the timezone. */
  from: Date;
  /** Inclusive UTC instant of the last moment of the window in the timezone. */
  to: Date;
  /** Canonical URL param identifying the resolved window. */
  param: string;
  /** URL param for the previous window of the same kind. */
  previousParam: string;
  /** URL param for the next window of the same kind. */
  nextParam: string;
};

export type TrainingMonthWindow = TrainingDateWindow &
  YearMonth & {
    /** Monday-first calendar grid: 6 rows x 7 days, including leading/trailing days. */
    weeks: { date: string; inMonth: boolean }[][];
  };

export type TrainingWeekWindow = TrainingDateWindow & {
  /** The 7 calendar dates ("YYYY-MM-DD") of this week, Monday first. */
  days: string[];
};

export type TrainingDayWindow = TrainingDateWindow & {
  /** The single calendar date ("YYYY-MM-DD") of this window. */
  date: string;
};

// ── Zoned-time helpers (same technique as lib/matchcenter/month-range.ts) ────

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

/** Resolves the calendar year/month/day a UTC instant falls on, in `timeZone`. */
function getZonedYearMonthDay(
  date: Date,
  timeZone: string,
): { year: number; month: number; day: number } {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const parts = dtf.formatToParts(date);
  const map: Record<string, string> = {};
  for (const part of parts) {
    map[part.type] = part.value;
  }

  return { year: Number(map.year), month: Number(map.month), day: Number(map.day) };
}

/** ISO weekday (1 = Monday .. 7 = Sunday) of a calendar date, timezone-agnostic (date-only math). */
function isoWeekdayOf(year: number, month: number, day: number): number {
  const jsDay = new Date(Date.UTC(year, month - 1, day)).getUTCDay(); // 0 = Sunday
  return jsDay === 0 ? 7 : jsDay;
}

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

function formatDateParam(year: number, month: number, day: number): string {
  return `${year.toString().padStart(4, "0")}-${pad2(month)}-${pad2(day)}`;
}

/** Adds `days` calendar days to a plain (year, month, day) triple. */
function addCalendarDays(
  year: number,
  month: number,
  day: number,
  delta: number,
): { year: number; month: number; day: number } {
  const utcMs = Date.UTC(year, month - 1, day) + delta * 24 * 60 * 60 * 1000;
  const d = new Date(utcMs);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

function dayWindowFromYmd(
  year: number,
  month: number,
  day: number,
  timeZone: string,
): { from: Date; to: Date } {
  const from = zonedWallTimeToUtc(year, month, day, 0, 0, 0, timeZone);
  const next = addCalendarDays(year, month, day, 1);
  const startOfNext = zonedWallTimeToUtc(next.year, next.month, next.day, 0, 0, 0, timeZone);
  const to = new Date(startOfNext.getTime() - 1);
  return { from, to };
}

// ── Parsing ───────────────────────────────────────────────────────────────

export function parseMonthParam(param: string | null | undefined): YearMonth | null {
  if (!param) return null;
  const match = MONTH_PARAM_PATTERN.exec(param.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  return { year, month };
}

export function parseDateParam(
  param: string | null | undefined,
): { year: number; month: number; day: number } | null {
  if (!param) return null;
  const match = DATE_PARAM_PATTERN.exec(param.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { year, month, day };
}

function addMonths(yearMonth: YearMonth, delta: number): YearMonth {
  const zeroBased = yearMonth.year * 12 + (yearMonth.month - 1) + delta;
  const year = Math.floor(zeroBased / 12);
  const month = (((zeroBased % 12) + 12) % 12) + 1;
  return { year, month };
}

// ── Month window ──────────────────────────────────────────────────────────

/**
 * Resolves the Monat window for a "YYYY-MM" URL param, defaulting to the
 * current month (in `timeZone`) when absent or malformed. Includes a
 * Monday-first 6x7 calendar grid (with leading/trailing days from adjacent
 * months) suitable for an operational month overview.
 */
export function resolveTrainingMonthWindow(input: {
  monthParam?: string | null;
  now?: Date;
  timeZone?: string;
}): TrainingMonthWindow {
  const timeZone = input.timeZone ?? TRAINING_DEFAULT_TIMEZONE;
  const now = input.now ?? new Date();
  const yearMonth = parseMonthParam(input.monthParam) ?? getZonedYearMonthDay(now, timeZone);

  const from = zonedWallTimeToUtc(yearMonth.year, yearMonth.month, 1, 0, 0, 0, timeZone);
  const nextMonth = addMonths(yearMonth, 1);
  const startOfNextMonth = zonedWallTimeToUtc(nextMonth.year, nextMonth.month, 1, 0, 0, 0, timeZone);
  const to = new Date(startOfNextMonth.getTime() - 1);

  const previousMonth = addMonths(yearMonth, -1);

  // Monday-first grid: find the Monday on/before the 1st, render 6 weeks (42 days).
  const firstWeekday = isoWeekdayOf(yearMonth.year, yearMonth.month, 1);
  const leadingDays = firstWeekday - 1; // 0 when the 1st is already a Monday
  const gridStart = addCalendarDays(yearMonth.year, yearMonth.month, 1, -leadingDays);

  const weeks: { date: string; inMonth: boolean }[][] = [];
  let cursor = gridStart;
  for (let week = 0; week < 6; week++) {
    const row: { date: string; inMonth: boolean }[] = [];
    for (let day = 0; day < 7; day++) {
      row.push({
        date: formatDateParam(cursor.year, cursor.month, cursor.day),
        inMonth: cursor.year === yearMonth.year && cursor.month === yearMonth.month,
      });
      cursor = addCalendarDays(cursor.year, cursor.month, cursor.day, 1);
    }
    weeks.push(row);
  }

  return {
    ...yearMonth,
    from,
    to,
    param: formatMonthParam(yearMonth),
    previousParam: formatMonthParam(previousMonth),
    nextParam: formatMonthParam(nextMonth),
    weeks,
  };
}

export function formatMonthParam(yearMonth: YearMonth): string {
  return `${yearMonth.year.toString().padStart(4, "0")}-${pad2(yearMonth.month)}`;
}

/** Human-readable "August 2026"-style label for a resolved month window. */
export function formatTrainingMonthLabel(
  yearMonth: YearMonth,
  locale: string = "de-CH",
  timeZone: string = TRAINING_DEFAULT_TIMEZONE,
): string {
  const reference = new Date(Date.UTC(yearMonth.year, yearMonth.month - 1, 1, 12, 0, 0));
  return new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone }).format(
    reference,
  );
}

// ── Week window ───────────────────────────────────────────────────────────

/**
 * Resolves the Woche window for a "YYYY-MM-DD" URL param identifying any
 * date within the target week; the param is normalised to that week's
 * Monday. Defaults to the current week (in `timeZone`) when absent or
 * malformed.
 */
export function resolveTrainingWeekWindow(input: {
  weekParam?: string | null;
  now?: Date;
  timeZone?: string;
}): TrainingWeekWindow {
  const timeZone = input.timeZone ?? TRAINING_DEFAULT_TIMEZONE;
  const now = input.now ?? new Date();
  const parsed = parseDateParam(input.weekParam) ?? getZonedYearMonthDay(now, timeZone);

  const weekday = isoWeekdayOf(parsed.year, parsed.month, parsed.day);
  const monday = addCalendarDays(parsed.year, parsed.month, parsed.day, -(weekday - 1));

  const days: string[] = [];
  let cursor = monday;
  for (let i = 0; i < 7; i++) {
    days.push(formatDateParam(cursor.year, cursor.month, cursor.day));
    cursor = addCalendarDays(cursor.year, cursor.month, cursor.day, 1);
  }

  const from = zonedWallTimeToUtc(monday.year, monday.month, monday.day, 0, 0, 0, timeZone);
  const sunday = addCalendarDays(monday.year, monday.month, monday.day, 6);
  const nextMonday = addCalendarDays(monday.year, monday.month, monday.day, 7);
  const startOfNextWeek = zonedWallTimeToUtc(
    nextMonday.year,
    nextMonday.month,
    nextMonday.day,
    0,
    0,
    0,
    timeZone,
  );
  const to = new Date(startOfNextWeek.getTime() - 1);
  void sunday;

  const previousMonday = addCalendarDays(monday.year, monday.month, monday.day, -7);

  return {
    from,
    to,
    param: formatDateParam(monday.year, monday.month, monday.day),
    previousParam: formatDateParam(previousMonday.year, previousMonday.month, previousMonday.day),
    nextParam: formatDateParam(nextMonday.year, nextMonday.month, nextMonday.day),
    days,
  };
}

/** Human-readable "6.–12. Okt. 2026"-style label for a resolved week window. */
export function formatTrainingWeekLabel(
  window: Pick<TrainingWeekWindow, "days">,
  locale: string = "de-CH",
  timeZone: string = TRAINING_DEFAULT_TIMEZONE,
): string {
  const first = parseDateParam(window.days[0])!;
  const last = parseDateParam(window.days[window.days.length - 1])!;

  const firstRef = new Date(Date.UTC(first.year, first.month - 1, first.day, 12, 0, 0));
  const lastRef = new Date(Date.UTC(last.year, last.month - 1, last.day, 12, 0, 0));

  const dayFmt = new Intl.DateTimeFormat(locale, { day: "numeric", timeZone });
  const fullFmt = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone,
  });

  const sameMonth = first.year === last.year && first.month === last.month;
  const start = sameMonth ? dayFmt.format(firstRef) : fullFmt.format(firstRef);
  return `${start}.–${fullFmt.format(lastRef)}`;
}

// ── Day window ────────────────────────────────────────────────────────────

/**
 * Resolves the Tag window for a "YYYY-MM-DD" URL param, defaulting to
 * today (in `timeZone`) when absent or malformed.
 */
export function resolveTrainingDayWindow(input: {
  dayParam?: string | null;
  now?: Date;
  timeZone?: string;
}): TrainingDayWindow {
  const timeZone = input.timeZone ?? TRAINING_DEFAULT_TIMEZONE;
  const now = input.now ?? new Date();
  const parsed = parseDateParam(input.dayParam) ?? getZonedYearMonthDay(now, timeZone);

  const { from, to } = dayWindowFromYmd(parsed.year, parsed.month, parsed.day, timeZone);
  const previous = addCalendarDays(parsed.year, parsed.month, parsed.day, -1);
  const next = addCalendarDays(parsed.year, parsed.month, parsed.day, 1);

  return {
    from,
    to,
    date: formatDateParam(parsed.year, parsed.month, parsed.day),
    param: formatDateParam(parsed.year, parsed.month, parsed.day),
    previousParam: formatDateParam(previous.year, previous.month, previous.day),
    nextParam: formatDateParam(next.year, next.month, next.day),
  };
}

/** Human-readable "Montag, 6. Oktober 2026"-style label for a resolved day window. */
export function formatTrainingDayLabel(
  dateParam: string,
  locale: string = "de-CH",
  timeZone: string = TRAINING_DEFAULT_TIMEZONE,
): string {
  const parsed = parseDateParam(dateParam);
  if (!parsed) return dateParam;
  const reference = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day, 12, 0, 0));
  return new Intl.DateTimeFormat(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone,
  }).format(reference);
}

/**
 * Derives inclusive UTC-midnight [dateFrom, dateTo] bounds for
 * listTrainingSessions() from a resolved Monat/Woche/Tag window.
 *
 * TrainingSession.date is a pure calendar-date key (UTC-midnight convention),
 * NOT a timezone-zoned instant. Bounds must therefore be built directly from
 * the tenant-local YYYY-MM-DD keys — never by truncating window.from/to
 * instants via toDateOnlyUtc(), which would silently include the previous
 * UTC calendar day for positive-offset zones like Europe/Zurich.
 */
export function listTrainingSessionDateBounds(
  view: TrainingCenterView,
  windows: {
    month: Pick<TrainingMonthWindow, "year" | "month">;
    week: Pick<TrainingWeekWindow, "days">;
    day: Pick<TrainingDayWindow, "date">;
  },
): { dateFrom: Date; dateTo: Date } {
  const toUtcMidnight = (dateKey: string) => new Date(`${dateKey}T00:00:00.000Z`);

  if (view === "DAY") {
    const bound = toUtcMidnight(windows.day.date);
    return { dateFrom: bound, dateTo: bound };
  }

  if (view === "WEEK") {
    return {
      dateFrom: toUtcMidnight(windows.week.days[0]),
      dateTo: toUtcMidnight(windows.week.days[windows.week.days.length - 1]),
    };
  }

  const lastDay = new Date(Date.UTC(windows.month.year, windows.month.month, 0)).getUTCDate();
  return {
    dateFrom: toUtcMidnight(formatDateParam(windows.month.year, windows.month.month, 1)),
    dateTo: toUtcMidnight(formatDateParam(windows.month.year, windows.month.month, lastDay)),
  };
}

/** Normalises a free-form view param to a known TrainingCenterView, defaulting to MONTH. */
export function normalizeTrainingCenterView(
  value: string | null | undefined,
): TrainingCenterView {
  const upper = value?.trim().toUpperCase() ?? "";
  if (upper === "WEEK" || upper === "WOCHE") return "WEEK";
  if (upper === "DAY" || upper === "TAG") return "DAY";
  return "MONTH";
}
