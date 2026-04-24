export type PlanningWeekWindow = {
  weekOffset: number;
  start: Date;
  end: Date;
  label: string;
  previousWeekOffset: number | null;
  nextWeekOffset: number;
};

function getMonday(date: Date) {
  const copy = new Date(date);
  const day = copy.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;

  copy.setDate(copy.getDate() + diffToMonday);
  copy.setHours(0, 0, 0, 0);

  return copy;
}

function getSunday(date: Date) {
  const sunday = new Date(date);
  const day = sunday.getDay();
  const diffToSunday = day === 0 ? 0 : 7 - day;

  sunday.setDate(sunday.getDate() + diffToSunday);
  sunday.setHours(23, 59, 59, 999);

  return sunday;
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("de-CH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Europe/Zurich",
  }).format(date);
}

export function getPlanningWeekWindow(args?: {
  weekOffset?: number | null;
  today?: Date;
}): PlanningWeekWindow {
  const weekOffset = Math.max(0, Number(args?.weekOffset ?? 0) || 0);
  const today = args?.today ? new Date(args.today) : new Date();

  const currentMonday = getMonday(today);
  const targetMonday = new Date(currentMonday);
  targetMonday.setDate(currentMonday.getDate() + weekOffset * 7);

  const start =
    weekOffset === 0
      ? new Date(today)
      : new Date(targetMonday);

  start.setHours(0, 0, 0, 0);

  const end = getSunday(targetMonday);

  return {
    weekOffset,
    start,
    end,
    label: formatDate(start) + " – " + formatDate(end),
    previousWeekOffset: weekOffset > 0 ? weekOffset - 1 : null,
    nextWeekOffset: weekOffset + 1,
  };
}
