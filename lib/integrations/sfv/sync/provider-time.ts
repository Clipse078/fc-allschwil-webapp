/**
 * lib/integrations/sfv/sync/provider-time.ts
 *
 * Canonical, single-source-of-truth parser for SFV-provided kickoff/match
 * date-time strings (`ClubScheduleEntry.matchDate`, `MatchDetail.matchDate`).
 *
 * ── Proven provider semantics (2026-08-07 live verification) ────────────────
 *
 * A read-only call to the real SFV ClubCorner API (GET /api/club/schedule,
 * ClubId=483 / FC Allschwil, SeasonId=2027) returned, among others:
 *
 *   { "matchId": 4346477, "matchDate": "2026-08-07T20:30:00",
 *     "teamNameA": "FC Allschwil", "teamNameB": "SC Basel Nord Weiss",
 *     "leagueName": "Senioren 30+ Promotion" }
 *
 * This is the exact fixture reported as rendering incorrectly (SFV shows
 * "20:30", FC Allschwil website showed "22:30"). The raw SFV kickoff string
 * carries NO UTC/offset suffix ("Z" or "+02:00") whatsoever.
 *
 * The SFV Matchcenter displays "20:30" for this fixture — i.e. the naive
 * string IS the Europe/Zurich wall-clock kickoff time. It is NOT a UTC
 * timestamp with the "Z" simply omitted.
 *
 * ── Root cause of the +2h bug ────────────────────────────────────────────────
 *
 * `new Date("2026-08-07T20:30:00")` (no offset) is parsed by the JS engine as
 * local time IN THE RUNTIME'S CURRENT TIME ZONE (ECMA-262 Date Time String
 * Format). Vercel/Node serverless functions default to TZ=UTC, so the naive
 * "20:30:00" was silently treated as 20:30 **UTC** — an absolute instant that,
 * when rendered back in Europe/Zurich (UTC+2 in August/CEST), displays as
 * "22:30". That is precisely the reported +2h discrepancy.
 *
 * A previous, unrelated fix attempt in detail-persistence.ts explicitly
 * appended "Z" to offset-less matchDate strings ("those values represent UTC
 * provider timestamps") — this encoded the *same* wrong assumption and
 * produces an identical incorrect result. Both code paths are replaced by
 * this single canonical parser.
 *
 * ── Correct interpretation ───────────────────────────────────────────────────
 *
 * The offset-less SFV matchDate string is Europe/Zurich civil (wall-clock)
 * time. Converting it to the correct UTC instant requires knowing the
 * Europe/Zurich UTC offset AT THAT SPECIFIC DATE (+2h during CEST / summer,
 * +1h during CET / winter) — never a hardcoded constant, because Switzerland
 * observes DST (EU rules: last Sunday of March → last Sunday of October).
 *
 * This module performs that conversion using only `Intl.DateTimeFormat`
 * (no extra dependency), which has full IANA time zone data including DST
 * transition rules, so both summer and winter fixtures resolve correctly.
 *
 * Defensive handling: if the provider ever supplies an explicit UTC/offset
 * suffix ("Z" or "+HH:MM"/"-HH:MM"), that value is trusted as-is and never
 * reinterpreted — this parser only fills in the *missing* offset.
 *
 * No side effects. No database access. Pure and deterministic.
 */

/** Provider's presentation/civil time zone for kickoff times. */
export const SFV_PROVIDER_TIME_ZONE = "Europe/Zurich";

/** Matches a trailing "Z" or "+HH:MM"/"-HH:MM" offset. */
const EXPLICIT_OFFSET_PATTERN = /(?:Z|[+-]\d{2}:\d{2})$/i;

/** Matches "YYYY-MM-DDTHH:mm[:ss[.sss]]" with no offset. */
const NAIVE_DATE_TIME_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?$/;

/**
 * Returns the Europe/Zurich (or given IANA zone) UTC offset, in minutes, that
 * is in effect at the given UTC instant. Positive values mean the zone is
 * ahead of UTC (e.g. +120 for CEST).
 *
 * Implemented via Intl.DateTimeFormat so DST transition dates are resolved
 * from real IANA tz data — never a hardcoded +1/+2 constant.
 */
function getTimeZoneOffsetMinutesAt(utcMillis: number, timeZone: string): number {
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

  // "24" from hourCycle: "h23" formatting at exact midnight is returned as
  // "00" by V8; guard defensively in case of an unexpected "24".
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

/**
 * Converts wall-clock date/time components in `timeZone` to the correct UTC
 * instant, honoring DST transitions.
 *
 * Uses a two-pass fixed-point refinement: the first pass estimates the
 * offset from a naive UTC guess, and the second pass re-derives the offset
 * from the corrected instant. This guards against the rare case where the
 * naive guess and the true instant fall on opposite sides of a DST boundary
 * (kickoff times, which are never scheduled at 02:00–03:00 local time on the
 * one or two DST-transition nights per year, are unaffected in practice, but
 * the refinement makes the function correct regardless).
 */
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

  let offsetMinutes = getTimeZoneOffsetMinutesAt(naiveUtcGuess, timeZone);
  let correctedMillis = naiveUtcGuess - offsetMinutes * 60_000;

  const refinedOffsetMinutes = getTimeZoneOffsetMinutesAt(correctedMillis, timeZone);
  if (refinedOffsetMinutes !== offsetMinutes) {
    offsetMinutes = refinedOffsetMinutes;
    correctedMillis = naiveUtcGuess - offsetMinutes * 60_000;
  }

  return new Date(correctedMillis);
}

/**
 * Parses an SFV-provided match date-time string into the correct UTC
 * `Date` instant.
 *
 * Contract:
 *   - If `raw` already carries an explicit UTC/offset suffix ("Z" or
 *     "±HH:MM"), it is parsed as-is via `new Date()` — never reinterpreted.
 *   - Otherwise `raw` is treated as `timeZone` (default "Europe/Zurich")
 *     civil/wall-clock time and converted to the equivalent UTC instant,
 *     correctly honoring DST (never a hardcoded offset).
 *   - Unparseable input falls back to `new Date(raw)` (yields Invalid Date
 *     for garbage input, which is safer than silently guessing a value).
 *
 * @param raw       Raw `matchDate` string from the SFV API.
 * @param timeZone  IANA zone the naive string represents. Defaults to
 *                  SFV_PROVIDER_TIME_ZONE ("Europe/Zurich").
 */
export function parseSfvMatchDateTime(
  raw: string,
  timeZone: string = SFV_PROVIDER_TIME_ZONE,
): Date {
  if (EXPLICIT_OFFSET_PATTERN.test(raw)) {
    return new Date(raw);
  }

  const match = NAIVE_DATE_TIME_PATTERN.exec(raw);
  if (!match) {
    return new Date(raw);
  }

  const [, yearStr, monthStr, dayStr, hourStr, minuteStr, secondStr] = match;

  return zonedWallTimeToUtc(
    Number(yearStr),
    Number(monthStr),
    Number(dayStr),
    Number(hourStr),
    Number(minuteStr),
    Number(secondStr ?? "0"),
    timeZone,
  );
}
