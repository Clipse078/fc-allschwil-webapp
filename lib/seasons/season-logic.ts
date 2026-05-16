import type { SeasonLifecycleStatus } from "@/lib/seasons/status";

const SWISS_FOOTBALL_SEASON_START_MONTH_INDEX = 7;
const SWISS_FOOTBALL_SEASON_START_DAY = 1;
const SWISS_FOOTBALL_SEASON_END_MONTH_INDEX = 5;
const SWISS_FOOTBALL_SEASON_END_DAY = 30;

export type SwissFootballSeason = {
  startYear: number;
  endYear: number;
  key: string;
  label: string;
  startDate: Date;
  endDate: Date;
};

function toDate(value: string | Date): Date | null {
  const date = value instanceof Date ? new Date(value) : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function getSwissFootballSeasonStartYearFromDate(
  value: string | Date
): number | null {
  const date = toDate(value);

  if (!date) {
    return null;
  }

  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();

  if (
    month > SWISS_FOOTBALL_SEASON_START_MONTH_INDEX ||
    (month === SWISS_FOOTBALL_SEASON_START_MONTH_INDEX &&
      day >= SWISS_FOOTBALL_SEASON_START_DAY)
  ) {
    return year;
  }

  return year - 1;
}

export function getSwissFootballSeasonLabelFromStartYear(
  startYear: number
): string {
  return startYear + "/" + (startYear + 1);
}

export function getSwissFootballSeasonKeyFromStartYear(
  startYear: number
): string {
  return getSwissFootballSeasonLabelFromStartYear(startYear);
}

export function getSwissFootballSeasonDateRangeFromStartYear(
  startYear: number
) {
  return {
    startDate: new Date(
      Date.UTC(
        startYear,
        SWISS_FOOTBALL_SEASON_START_MONTH_INDEX,
        SWISS_FOOTBALL_SEASON_START_DAY
      )
    ),
    endDate: new Date(
      Date.UTC(
        startYear + 1,
        SWISS_FOOTBALL_SEASON_END_MONTH_INDEX,
        SWISS_FOOTBALL_SEASON_END_DAY
      )
    ),
  };
}

export function getSwissFootballSeasonFromDate(
  value: string | Date
): SwissFootballSeason | null {
  const startYear = getSwissFootballSeasonStartYearFromDate(value);

  if (startYear === null) {
    return null;
  }

  const range = getSwissFootballSeasonDateRangeFromStartYear(startYear);

  return {
    startYear,
    endYear: startYear + 1,
    key: getSwissFootballSeasonKeyFromStartYear(startYear),
    label: getSwissFootballSeasonLabelFromStartYear(startYear),
    startDate: range.startDate,
    endDate: range.endDate,
  };
}

export function getCurrentSwissFootballSeason(
  now: string | Date = new Date()
): SwissFootballSeason | null {
  return getSwissFootballSeasonFromDate(now);
}

export function getNextSwissFootballSeason(
  now: string | Date = new Date()
): SwissFootballSeason | null {
  const current = getSwissFootballSeasonFromDate(now);

  if (!current) {
    return null;
  }

  const nextStartYear = current.startYear + 1;
  const range = getSwissFootballSeasonDateRangeFromStartYear(nextStartYear);

  return {
    startYear: nextStartYear,
    endYear: nextStartYear + 1,
    key: getSwissFootballSeasonKeyFromStartYear(nextStartYear),
    label: getSwissFootballSeasonLabelFromStartYear(nextStartYear),
    startDate: range.startDate,
    endDate: range.endDate,
  };
}

export function getCanonicalSwissFootballSeasonLabelFromSeasonStartDate(
  seasonStartDate: string | Date
): string | null {
  const date = toDate(seasonStartDate);

  if (!date) {
    return null;
  }

  const startYear = date.getUTCFullYear();
  return getSwissFootballSeasonLabelFromStartYear(startYear);
}

export function isSeasonStartDateValidForSwissFootballSeason(
  seasonStartDate: string | Date
): boolean {
  const date = toDate(seasonStartDate);

  if (!date) {
    return false;
  }

  return (
    date.getUTCMonth() === SWISS_FOOTBALL_SEASON_START_MONTH_INDEX &&
    date.getUTCDate() === SWISS_FOOTBALL_SEASON_START_DAY
  );
}

export function isDateWithinSwissFootballSeason(args: {
  date: string | Date;
  seasonStartDate: string | Date;
}): boolean {
  const date = toDate(args.date);
  const seasonStartDate = toDate(args.seasonStartDate);

  if (!date || !seasonStartDate) {
    return false;
  }

  const startYear = seasonStartDate.getUTCFullYear();
  const range = getSwissFootballSeasonDateRangeFromStartYear(startYear);

  return date >= range.startDate && date <= range.endDate;
}

export function getSeasonLifecycleStatus(args: {
  startDate: string | Date;
  endDate: string | Date;
  now?: string | Date;
}): SeasonLifecycleStatus | null {
  const startDate = toDate(args.startDate);
  const endDate = toDate(args.endDate);
  const now = toDate(args.now ?? new Date());

  if (!startDate || !endDate || !now) {
    return null;
  }

  const normalizedStart = startOfUtcDay(startDate);
  const normalizedEnd = startOfUtcDay(endDate);
  const normalizedNow = startOfUtcDay(now);

  if (normalizedNow < normalizedStart) {
    return "PLANNING";
  }

  if (normalizedNow > normalizedEnd) {
    return "COMPLETED";
  }

  return "ONGOING";
}

export function isSeasonOngoing(args: {
  startDate: string | Date;
  endDate: string | Date;
  now?: string | Date;
}): boolean {
  return getSeasonLifecycleStatus(args) === "ONGOING";
}

export function isSeasonPlanning(args: {
  startDate: string | Date;
  endDate: string | Date;
  now?: string | Date;
}): boolean {
  return getSeasonLifecycleStatus(args) === "PLANNING";
}

export function isSeasonCompleted(args: {
  startDate: string | Date;
  endDate: string | Date;
  now?: string | Date;
}): boolean {
  return getSeasonLifecycleStatus(args) === "COMPLETED";
}
