/**
 * lib/events/tenant-local-datetime.ts
 *
 * Canonical conversion between tenant-local wall-clock datetimes (as used by
 * HTML `datetime-local` inputs) and persisted UTC instants on Event records
 * (startAt, endAt, meetingTime).
 *
 * TournamentCenter (and future single-occurrence event editors) must use these
 * helpers so local club time is converted exactly once on write and exactly
 * once on read — never interpreted as server/browser local time.
 */

import { zonedTimeToUtc } from "@/lib/training/recurrence";

/** Platform fallback when Tenant.timezone is unset — mirrors tenant-runtime/formatters. */
export const DEFAULT_TENANT_EVENT_TIMEZONE = "Europe/Zurich";

const DATETIME_LOCAL_RE = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})$/;
const HAS_EXPLICIT_OFFSET_RE = /(?:Z|[+-]\d{2}:\d{2})$/i;

export function resolveTenantEventTimezone(timezone?: string | null): string {
  const trimmed = timezone?.trim();
  return trimmed || DEFAULT_TENANT_EVENT_TIMEZONE;
}

function partsAt(instant: Date, timeZone: string): { date: string; time: string } {
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

/**
 * Formats a persisted UTC instant for a `datetime-local` input in the given
 * tenant IANA timezone.
 */
export function utcInstantToDateTimeLocalValue(
  value: Date | string | null | undefined,
  timeZone: string,
): string {
  if (!value) return "";

  const instant = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(instant.getTime())) return "";

  const { date, time } = partsAt(instant, timeZone);
  return `${date}T${time}`;
}

/**
 * Parses a client-submitted datetime string into a UTC instant.
 *
 * - `YYYY-MM-DDTHH:mm` (datetime-local) → interpreted in `timeZone`
 * - ISO strings with `Z` or a numeric offset → treated as absolute instants
 */
export function parseTenantLocalDateTimeInput(raw: string, timeZone: string): Date | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  if (DATETIME_LOCAL_RE.test(trimmed) && !HAS_EXPLICIT_OFFSET_RE.test(trimmed)) {
    const match = trimmed.match(DATETIME_LOCAL_RE);
    if (!match) return null;
    const [, dateKey, time] = match;
    return zonedTimeToUtc(dateKey, time, timeZone);
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

export function parseTenantLocalDateTimeInputOrThrow(raw: string, timeZone: string): Date {
  const parsed = parseTenantLocalDateTimeInput(raw, timeZone);
  if (!parsed) {
    throw new RangeError(`Invalid tenant-local datetime: "${raw}"`);
  }
  return parsed;
}
