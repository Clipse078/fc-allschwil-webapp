/**
 * lib/training/series-request-helpers.ts
 *
 * TRAININGCENTER-03A: shared request-body parsing for the TrainingSeries
 * create/update API routes.
 *
 * The create/edit form always submits one explicit start/end time per
 * selected weekday (`weekdaySchedules`) rather than a single series-wide
 * time — this module derives the legacy series-level `startsAt`/`endsAt`
 * fallback (the envelope: earliest start, latest end) plus the `weekdays`
 * list and `weekdayTimes` overrides that `training-service.ts` expects.
 *
 * Pure parsing/validation only — no DB access, no permission checks. Route
 * handlers own auth and tenant scoping.
 */

import type { Weekday, WeekdayTimeOverrideInput } from "./types";

const WEEKDAYS: readonly Weekday[] = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
];

function isWeekday(value: unknown): value is Weekday {
  return typeof value === "string" && (WEEKDAYS as readonly string[]).includes(value);
}

function isTimeString(value: unknown): value is string {
  return typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function timeMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export type ParsedWeekdaySchedules = {
  weekdays: Weekday[];
  weekdayTimes: WeekdayTimeOverrideInput[];
  /** Envelope fallback for the series-level startsAt/endsAt columns: earliest start, latest end. */
  startsAt: string;
  endsAt: string;
};

/**
 * Parses and validates the `weekdaySchedules` field of a create/update
 * request body: `[{ weekday, startsAt, endsAt }, ...]`, at least one entry,
 * no duplicate weekdays, each entry's startsAt strictly before endsAt.
 *
 * Returns an error string (safe to surface to the client) on failure, or
 * the parsed result on success.
 */
export function parseWeekdaySchedules(
  raw: unknown,
): { ok: true; value: ParsedWeekdaySchedules } | { ok: false; error: string } {
  if (!Array.isArray(raw) || raw.length === 0) {
    return { ok: false, error: "weekdaySchedules must be a non-empty array" };
  }

  const weekdays: Weekday[] = [];
  const weekdayTimes: WeekdayTimeOverrideInput[] = [];
  const seen = new Set<Weekday>();

  for (const entry of raw) {
    if (typeof entry !== "object" || entry === null) {
      return { ok: false, error: "Each weekdaySchedules entry must be an object" };
    }
    const { weekday, startsAt, endsAt } = entry as Record<string, unknown>;

    if (!isWeekday(weekday)) {
      return { ok: false, error: `Invalid weekday: ${String(weekday)}` };
    }
    if (seen.has(weekday)) {
      return { ok: false, error: `Duplicate weekday in weekdaySchedules: ${weekday}` };
    }
    if (!isTimeString(startsAt) || !isTimeString(endsAt)) {
      return {
        ok: false,
        error: `startsAt/endsAt for ${weekday} must be "HH:mm" time strings`,
      };
    }
    if (timeMinutes(startsAt) >= timeMinutes(endsAt)) {
      return {
        ok: false,
        error: `startsAt (${startsAt}) must be before endsAt (${endsAt}) for ${weekday}`,
      };
    }

    seen.add(weekday);
    weekdays.push(weekday);
    weekdayTimes.push({ weekday, startsAt, endsAt });
  }

  const startsAt = weekdayTimes.reduce(
    (min, s) => (timeMinutes(s.startsAt) < timeMinutes(min) ? s.startsAt : min),
    weekdayTimes[0].startsAt,
  );
  const endsAt = weekdayTimes.reduce(
    (max, s) => (timeMinutes(s.endsAt) > timeMinutes(max) ? s.endsAt : max),
    weekdayTimes[0].endsAt,
  );

  return { ok: true, value: { weekdays, weekdayTimes, startsAt, endsAt } };
}

/**
 * RESOURCE-AVAILABILITY-UX-01-C1: parses the optional `facilityResourceIds`
 * field of the TrainingSeries create request body — the Spielfeld/Halle +
 * Garderobe resources selected during guided creation, persisted as the
 * series' default TrainingAllocation rows in the SAME request that creates
 * the series (see app/api/training-series/route.ts). Deduplicated and
 * order-preserving; absent/empty input is valid (resources are optional at
 * creation — see TrainingSeriesCreateForm).
 *
 * Pure validation only — does not check tenant ownership, archival status,
 * or resource existence; those remain the responsibility of
 * createTrainingAllocation() (lib/training/training-allocation-service.ts),
 * which the route calls per id.
 */
export function parseFacilityResourceIds(
  raw: unknown,
): { ok: true; value: string[] } | { ok: false; error: string } {
  if (raw === undefined || raw === null) {
    return { ok: true, value: [] };
  }
  if (!Array.isArray(raw)) {
    return { ok: false, error: "facilityResourceIds must be an array of strings" };
  }

  const seen = new Set<string>();
  const ids: string[] = [];
  for (const entry of raw) {
    if (typeof entry !== "string" || !entry.trim()) {
      return { ok: false, error: "Each facilityResourceIds entry must be a non-empty string" };
    }
    const id = entry.trim();
    if (!seen.has(id)) {
      seen.add(id);
      ids.push(id);
    }
  }

  return { ok: true, value: ids };
}

/** Parses a required "YYYY-MM-DD" (or full ISO) date string from a request body field. */
export function parseRequiredDate(
  value: unknown,
  fieldName: string,
): { ok: true; value: Date } | { ok: false; error: string } {
  if (typeof value !== "string" || !value.trim()) {
    return { ok: false, error: `${fieldName} is required` };
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return { ok: false, error: `${fieldName} must be a valid date` };
  }
  return { ok: true, value: date };
}
