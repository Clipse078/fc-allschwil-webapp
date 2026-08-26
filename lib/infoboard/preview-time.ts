import { zonedTimeToUtc } from "@/lib/training/recurrence";

export type InfoboardPreviewScreen = "1" | "2";

export type InfoboardPreviewMoment = {
  readonly screen: InfoboardPreviewScreen;
  readonly date: string;
  readonly time: string;
  readonly now: Date;
};

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

function partsAt(instant: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const hour = values.hour === "24" ? "00" : values.hour;
  return {
    date: `${values.year}-${values.month}-${values.day}`,
    time: `${hour}:${values.minute}`,
  };
}

export function formatPreviewMoment(instant: Date, timeZone: string) {
  return partsAt(instant, timeZone);
}

export function parseInfoboardPreviewMoment(
  params: { screen?: string; date?: string; time?: string },
  timeZone: string,
  fallbackNow = new Date(),
): InfoboardPreviewMoment {
  const fallback = partsAt(fallbackNow, timeZone);
  const screen: InfoboardPreviewScreen = params.screen === "2" ? "2" : "1";
  const date = params.date && DATE_PATTERN.test(params.date) ? params.date : fallback.date;
  const time = params.time && TIME_PATTERN.test(params.time) ? params.time : fallback.time;

  const candidate = zonedTimeToUtc(date, time, timeZone);
  const roundTrip = partsAt(candidate, timeZone);
  if (
    Number.isNaN(candidate.getTime()) ||
    roundTrip.date !== date ||
    roundTrip.time !== time
  ) {
    return { screen, ...fallback, now: fallbackNow };
  }

  return { screen, date, time, now: candidate };
}
