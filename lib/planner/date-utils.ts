function toUtcDate(value: string | Date): Date {
  if (value instanceof Date) {
    return new Date(value.getTime());
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T00:00:00.000Z`);
  }

  return new Date(value);
}

export function startOfUtcDay(value: string | Date): Date {
  const date = toUtcDate(value);

  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
}

export function endOfUtcDay(value: string | Date): Date {
  const date = startOfUtcDay(value);
  date.setUTCDate(date.getUTCDate() + 1);
  date.setUTCMilliseconds(-1);
  return date;
}

export function getIsoWeekday(date: Date): number {
  const weekday = date.getUTCDay();
  return weekday === 0 ? 7 : weekday;
}

export function startOfIsoWeek(value: string | Date): Date {
  const date = startOfUtcDay(value);
  const isoWeekday = getIsoWeekday(date);
  date.setUTCDate(date.getUTCDate() - (isoWeekday - 1));
  return date;
}

export function endOfIsoWeek(value: string | Date): Date {
  const start = startOfIsoWeek(value);
  const end = new Date(start.getTime());
  end.setUTCDate(end.getUTCDate() + 7);
  end.setUTCMilliseconds(-1);
  return end;
}

export function formatIsoDay(value: string | Date): string {
  const date = startOfUtcDay(value);
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, "0");
  const day = `${date.getUTCDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getIsoWeekNumber(value: string | Date): number {
  const date = startOfUtcDay(value);
  const thursday = new Date(date.getTime());
  thursday.setUTCDate(thursday.getUTCDate() + (4 - getIsoWeekday(date)));

  const yearStart = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 1));
  const yearStartWeekday = getIsoWeekday(yearStart);
  const firstThursday = new Date(yearStart.getTime());
  firstThursday.setUTCDate(firstThursday.getUTCDate() + (4 - yearStartWeekday));

  const diffMs = thursday.getTime() - firstThursday.getTime();
  return 1 + Math.round(diffMs / 604800000);
}

export function formatIsoWeekId(value: string | Date): string {
  const date = startOfUtcDay(value);
  const week = `${getIsoWeekNumber(date)}`.padStart(2, "0");

  let year = date.getUTCFullYear();
  const month = date.getUTCMonth();

  if (month === 0 && getIsoWeekNumber(date) > 50) {
    year -= 1;
  }

  if (month === 11 && getIsoWeekNumber(date) === 1) {
    year += 1;
  }

  return `${year}-W${week}`;
}

export function parseIsoWeekId(weekId?: string | null): Date | null {
  if (!weekId || !/^\d{4}-W\d{2}$/.test(weekId)) {
    return null;
  }

  const year = Number(weekId.slice(0, 4));
  const week = Number(weekId.slice(6, 8));

  if (!Number.isFinite(year) || !Number.isFinite(week) || week < 1 || week > 53) {
    return null;
  }

  const jan4 = new Date(Date.UTC(year, 0, 4));
  const weekStart = startOfIsoWeek(jan4);
  weekStart.setUTCDate(weekStart.getUTCDate() + (week - 1) * 7);
  return weekStart;
}

export function getWeekWindow(weekId?: string | null) {
  const parsed = parseIsoWeekId(weekId);
  const reference = parsed ?? new Date();
  const start = startOfIsoWeek(reference);
  const end = endOfIsoWeek(reference);

  return {
    weekId: formatIsoWeekId(start),
    start,
    end,
    previousWeekId: formatIsoWeekId(
      new Date(start.getTime() - 7 * 24 * 60 * 60 * 1000)
    ),
    nextWeekId: formatIsoWeekId(
      new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000)
    ),
  };
}

export function getDayWindow(day?: string | null) {
  const start = startOfUtcDay(day ?? new Date());
  const end = endOfUtcDay(start);

  const previous = new Date(start.getTime());
  previous.setUTCDate(previous.getUTCDate() - 1);

  const next = new Date(start.getTime());
  next.setUTCDate(next.getUTCDate() + 1);

  return {
    day: formatIsoDay(start),
    start,
    end,
    previousDay: formatIsoDay(previous),
    nextDay: formatIsoDay(next),
  };
}
