export type IsoWeekInfo = {
  isoYear: number;
  isoWeek: number;
  weekId: string;
  monday: Date;
  sunday: Date;
};

function toUtcDate(date: Date) {
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
}

export function getIsoWeekInfo(input: Date): IsoWeekInfo {
  const date = toUtcDate(input);
  const day = date.getUTCDay() || 7;

  date.setUTCDate(date.getUTCDate() + 4 - day);

  const isoYear = date.getUTCFullYear();
  const yearStart = new Date(Date.UTC(isoYear, 0, 1));
  const isoWeek = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);

  const monday = toUtcDate(input);
  const inputDay = monday.getUTCDay() || 7;
  monday.setUTCDate(monday.getUTCDate() - inputDay + 1);

  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);

  return {
    isoYear,
    isoWeek,
    weekId: `${isoYear}-W${String(isoWeek).padStart(2, "0")}`,
    monday,
    sunday,
  };
}

export function getWeekRangeFromWeekId(weekId: string) {
  const match = weekId.match(/^(\d{4})-W(\d{2})$/);

  if (!match) {
    throw new Error(`Invalid weekId: ${weekId}`);
  }

  const isoYear = Number(match[1]);
  const isoWeek = Number(match[2]);

  const jan4 = new Date(Date.UTC(isoYear, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7;

  const monday = new Date(jan4);
  monday.setUTCDate(jan4.getUTCDate() - jan4Day + 1 + (isoWeek - 1) * 7);

  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);

  return { isoYear, isoWeek, weekId, monday, sunday };
}
