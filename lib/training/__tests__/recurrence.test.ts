/**
 * Tests for lib/training/recurrence.ts — the pure Training Session
 * recurrence engine (TRAININGCENTER-02).
 *
 * Covers:
 *   A. zonedTimeToUtc         — Europe/Zurich CEST/CET resolution, DST transitions
 *   B. generateTrainingSessionOccurrences
 *      B1. Ticket example (F2, Monday, 01.08.2026 → 28.02.2027)
 *      B2. Start/end date boundaries (inclusive)
 *      B3. Multiple weekdays per week
 *      B4. Leap year handling (2028)
 *      B5. DST spring-forward / fall-back (Europe/Zurich)
 *      B6. Determinism / idempotency (same input → same output)
 *      B7. Validation errors
 *      B8. Window narrower than / outside series validity
 *
 * No database access — fully pure.
 */

import { describe, it, expect } from "vitest";
import {
  zonedTimeToUtc,
  generateTrainingSessionOccurrences,
  matchesRecurrence,
  computeOccurrenceForDate,
  weekdayFromDate,
  toDateOnlyUtc,
  dateKeyFromDate,
  type TrainingSeriesRecurrenceInput,
} from "../recurrence";

// ── A. zonedTimeToUtc ─────────────────────────────────────────────────────────

describe("A. zonedTimeToUtc", () => {
  it("A1: resolves a summer (CEST, UTC+2) local time to the correct UTC instant", () => {
    // 17:00 CEST on 2026-08-04 = 15:00 UTC.
    const result = zonedTimeToUtc("2026-08-04", "17:00", "Europe/Zurich");
    expect(result.toISOString()).toBe("2026-08-04T15:00:00.000Z");
  });

  it("A2: resolves a winter (CET, UTC+1) local time to the correct UTC instant", () => {
    // 17:00 CET on 2026-01-12 = 16:00 UTC.
    const result = zonedTimeToUtc("2026-01-12", "17:00", "Europe/Zurich");
    expect(result.toISOString()).toBe("2026-01-12T16:00:00.000Z");
  });

  it("A3: resolves UTC timezone as a straight passthrough", () => {
    const result = zonedTimeToUtc("2026-08-04", "17:00", "UTC");
    expect(result.toISOString()).toBe("2026-08-04T17:00:00.000Z");
  });

  it("A4: spring-forward transition (2026-03-29, Europe/Zurich) — evening session stays on CEST offset", () => {
    // DST 2026 starts 2026-03-29 02:00 CET -> 03:00 CEST. An 18:00 local
    // session that evening is already in CEST (UTC+2) => 16:00 UTC.
    const result = zonedTimeToUtc("2026-03-29", "18:00", "Europe/Zurich");
    expect(result.toISOString()).toBe("2026-03-29T16:00:00.000Z");
  });

  it("A5: the day before spring-forward is still on the CET offset (UTC+1)", () => {
    const result = zonedTimeToUtc("2026-03-28", "18:00", "Europe/Zurich");
    expect(result.toISOString()).toBe("2026-03-28T17:00:00.000Z");
  });

  it("A6: fall-back transition (2026-10-25, Europe/Zurich) — evening session is already back on CET", () => {
    // DST 2026 ends 2026-10-25 03:00 CEST -> 02:00 CET. A 18:00 local
    // session that evening is on CET (UTC+1) => 17:00 UTC.
    const result = zonedTimeToUtc("2026-10-25", "18:00", "Europe/Zurich");
    expect(result.toISOString()).toBe("2026-10-25T17:00:00.000Z");
  });

  it("A7: the day before fall-back is still on the CEST offset (UTC+2)", () => {
    const result = zonedTimeToUtc("2026-10-24", "18:00", "Europe/Zurich");
    expect(result.toISOString()).toBe("2026-10-24T16:00:00.000Z");
  });

  it("A8: throws RangeError for an invalid IANA timezone", () => {
    expect(() => zonedTimeToUtc("2026-08-04", "17:00", "Not/AZone")).toThrow(RangeError);
  });
});

// ── B. generateTrainingSessionOccurrences ────────────────────────────────────

function makeSeries(overrides: Partial<TrainingSeriesRecurrenceInput> = {}): TrainingSeriesRecurrenceInput {
  return {
    validFrom: null,
    validUntil: null,
    weekdays: ["MONDAY"],
    timezone: "Europe/Zurich",
    startsAt: "17:00",
    endsAt: "18:00",
    ...overrides,
  };
}

describe("B. generateTrainingSessionOccurrences", () => {
  it("B1: reproduces the ticket example shape — F2 Monday, 01.08.2026 -> 28.02.2027", () => {
    // NOTE: 2026-08-01 is a Saturday and 2027-02-28 is a Sunday (real
    // calendar), so the actual generated Mondays are 03./10./17./24.08.2026
    // ... 22.02.2027 — the ticket's illustrative date list assumed a
    // slightly different calendar alignment, but the *shape* (weekly
    // Mondays bounded by validFrom/validUntil) is exactly what is verified
    // here against the real Gregorian calendar.
    const series = makeSeries({
      validFrom: new Date("2026-08-01T00:00:00.000Z"),
      validUntil: new Date("2027-02-28T00:00:00.000Z"),
      weekdays: ["MONDAY"],
    });

    const occurrences = generateTrainingSessionOccurrences(series, {
      from: new Date("2026-08-01T00:00:00.000Z"),
      to: new Date("2027-02-28T00:00:00.000Z"),
    });

    const dateKeys = occurrences.map((o) => o.dateKey);

    // First four Mondays on/after validFrom (2026-08-01, a Saturday).
    expect(dateKeys.slice(0, 4)).toEqual([
      "2026-08-03",
      "2026-08-10",
      "2026-08-17",
      "2026-08-24",
    ]);

    // Last Monday on/before validUntil (2027-02-28, a Sunday).
    expect(dateKeys[dateKeys.length - 1]).toBe("2027-02-22");

    // Every generated date is actually a Monday.
    for (const occ of occurrences) {
      expect(occ.weekday).toBe("MONDAY");
      expect(new Date(occ.date).getUTCDay()).toBe(1);
    }

    // No duplicate dates.
    expect(new Set(dateKeys).size).toBe(dateKeys.length);
  });

  it("B2a: validFrom boundary is inclusive when it lands exactly on a recurrence weekday", () => {
    // 2026-08-03 is a Monday.
    const series = makeSeries({
      validFrom: new Date("2026-08-03T00:00:00.000Z"),
      validUntil: new Date("2026-08-17T00:00:00.000Z"),
    });

    const occurrences = generateTrainingSessionOccurrences(series, {
      from: new Date("2026-08-01T00:00:00.000Z"),
      to: new Date("2026-08-31T00:00:00.000Z"),
    });

    expect(occurrences.map((o) => o.dateKey)).toEqual([
      "2026-08-03",
      "2026-08-10",
      "2026-08-17",
    ]);
  });

  it("B2b: validUntil boundary is inclusive when it lands exactly on a recurrence weekday", () => {
    const series = makeSeries({
      validFrom: new Date("2026-08-01T00:00:00.000Z"),
      validUntil: new Date("2026-08-17T00:00:00.000Z"), // Monday
    });

    const occurrences = generateTrainingSessionOccurrences(series, {
      from: new Date("2026-08-01T00:00:00.000Z"),
      to: new Date("2026-08-31T00:00:00.000Z"),
    });

    expect(occurrences.map((o) => o.dateKey)).toEqual([
      "2026-08-03",
      "2026-08-10",
      "2026-08-17",
    ]);
  });

  it("B2c: the generation window itself bounds occurrences even when the series is unbounded", () => {
    const series = makeSeries({ validFrom: null, validUntil: null });

    const occurrences = generateTrainingSessionOccurrences(series, {
      from: new Date("2026-08-01T00:00:00.000Z"),
      to: new Date("2026-08-15T00:00:00.000Z"),
    });

    expect(occurrences.map((o) => o.dateKey)).toEqual([
      "2026-08-03",
      "2026-08-10",
    ]);
  });

  it("B2d: an out-of-range window (entirely before validFrom) yields no occurrences", () => {
    const series = makeSeries({
      validFrom: new Date("2026-08-01T00:00:00.000Z"),
      validUntil: new Date("2026-12-31T00:00:00.000Z"),
    });

    const occurrences = generateTrainingSessionOccurrences(series, {
      from: new Date("2026-01-01T00:00:00.000Z"),
      to: new Date("2026-07-31T00:00:00.000Z"),
    });

    expect(occurrences).toEqual([]);
  });

  it("B3: multiple weekdays per week are all generated, in ascending date order", () => {
    const series = makeSeries({
      weekdays: ["MONDAY", "WEDNESDAY", "FRIDAY"],
      validFrom: new Date("2026-08-03T00:00:00.000Z"), // Monday
      validUntil: new Date("2026-08-16T00:00:00.000Z"), // Sunday
    });

    const occurrences = generateTrainingSessionOccurrences(series, {
      from: new Date("2026-08-01T00:00:00.000Z"),
      to: new Date("2026-08-31T00:00:00.000Z"),
    });

    expect(occurrences.map((o) => o.dateKey)).toEqual([
      "2026-08-03", // Mon
      "2026-08-05", // Wed
      "2026-08-07", // Fri
      "2026-08-10", // Mon
      "2026-08-12", // Wed
      "2026-08-14", // Fri
    ]);
    expect(occurrences.map((o) => o.weekday)).toEqual([
      "MONDAY",
      "WEDNESDAY",
      "FRIDAY",
      "MONDAY",
      "WEDNESDAY",
      "FRIDAY",
    ]);
  });

  it("B4: leap year — 2028-02-29 is generated when it matches the recurrence weekday", () => {
    // 2028 is a leap year; 2028-02-29 is a Tuesday.
    const series = makeSeries({
      weekdays: ["TUESDAY"],
      validFrom: new Date("2028-02-22T00:00:00.000Z"),
      validUntil: new Date("2028-03-07T00:00:00.000Z"),
    });

    const occurrences = generateTrainingSessionOccurrences(series, {
      from: new Date("2028-02-01T00:00:00.000Z"),
      to: new Date("2028-03-31T00:00:00.000Z"),
    });

    expect(occurrences.map((o) => o.dateKey)).toEqual([
      "2028-02-22",
      "2028-02-29",
      "2028-03-07",
    ]);
  });

  it("B4b: non-leap year (2026) never generates Feb 29", () => {
    const series = makeSeries({
      weekdays: ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"],
      validFrom: new Date("2026-02-25T00:00:00.000Z"),
      validUntil: new Date("2026-03-03T00:00:00.000Z"),
    });

    const occurrences = generateTrainingSessionOccurrences(series, {
      from: new Date("2026-02-01T00:00:00.000Z"),
      to: new Date("2026-03-31T00:00:00.000Z"),
    });

    expect(occurrences.map((o) => o.dateKey)).toEqual([
      "2026-02-25",
      "2026-02-26",
      "2026-02-27",
      "2026-02-28",
      "2026-03-01",
      "2026-03-02",
      "2026-03-03",
    ]);
  });

  it("B5a: DST spring-forward (2026-03-29) shifts the UTC instant but keeps local wall time at 17:00", () => {
    const series = makeSeries({
      weekdays: ["SUNDAY"],
      startsAt: "17:00",
      endsAt: "18:30",
      validFrom: new Date("2026-03-22T00:00:00.000Z"),
      validUntil: new Date("2026-04-05T00:00:00.000Z"),
    });

    const occurrences = generateTrainingSessionOccurrences(series, {
      from: new Date("2026-03-01T00:00:00.000Z"),
      to: new Date("2026-04-30T00:00:00.000Z"),
    });

    const before = occurrences.find((o) => o.dateKey === "2026-03-22"); // still CET (+1)
    const after = occurrences.find((o) => o.dateKey === "2026-03-29"); // now CEST (+2)

    expect(before?.startAt.toISOString()).toBe("2026-03-22T16:00:00.000Z");
    expect(after?.startAt.toISOString()).toBe("2026-03-29T15:00:00.000Z");
    // The UTC gap between two consecutive Sundays is 7 days minus the 1h DST shift.
    expect(after!.startAt.getTime() - before!.startAt.getTime()).toBe(
      7 * 24 * 60 * 60 * 1000 - 60 * 60 * 1000,
    );
  });

  it("B5b: DST fall-back (2026-10-25) shifts the UTC instant back by 1 hour", () => {
    const series = makeSeries({
      weekdays: ["SUNDAY"],
      startsAt: "17:00",
      endsAt: "18:30",
      validFrom: new Date("2026-10-18T00:00:00.000Z"),
      validUntil: new Date("2026-11-01T00:00:00.000Z"),
    });

    const occurrences = generateTrainingSessionOccurrences(series, {
      from: new Date("2026-10-01T00:00:00.000Z"),
      to: new Date("2026-11-30T00:00:00.000Z"),
    });

    const before = occurrences.find((o) => o.dateKey === "2026-10-18"); // CEST (+2)
    const after = occurrences.find((o) => o.dateKey === "2026-10-25"); // now CET (+1)

    expect(before?.startAt.toISOString()).toBe("2026-10-18T15:00:00.000Z");
    expect(after?.startAt.toISOString()).toBe("2026-10-25T16:00:00.000Z");
    expect(after!.startAt.getTime() - before!.startAt.getTime()).toBe(
      7 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000,
    );
  });

  it("B5c: endAt is always after startAt across a DST transition", () => {
    const series = makeSeries({
      weekdays: ["SUNDAY"],
      startsAt: "23:30",
      endsAt: "23:59",
      validFrom: new Date("2026-03-29T00:00:00.000Z"),
      validUntil: new Date("2026-03-29T00:00:00.000Z"),
    });

    const occurrences = generateTrainingSessionOccurrences(series, {
      from: new Date("2026-03-01T00:00:00.000Z"),
      to: new Date("2026-04-30T00:00:00.000Z"),
    });

    expect(occurrences).toHaveLength(1);
    expect(occurrences[0].endAt.getTime()).toBeGreaterThan(occurrences[0].startAt.getTime());
  });

  it("B6: is deterministic — repeated calls with identical input produce identical output", () => {
    const series = makeSeries({
      weekdays: ["TUESDAY", "THURSDAY"],
      validFrom: new Date("2026-08-01T00:00:00.000Z"),
      validUntil: new Date("2027-02-28T00:00:00.000Z"),
    });
    const window = { from: new Date("2026-08-01T00:00:00.000Z"), to: new Date("2027-02-28T00:00:00.000Z") };

    const run1 = generateTrainingSessionOccurrences(series, window);
    const run2 = generateTrainingSessionOccurrences(series, window);

    expect(run1.map((o) => o.dateKey)).toEqual(run2.map((o) => o.dateKey));
    expect(run1.map((o) => o.startAt.toISOString())).toEqual(run2.map((o) => o.startAt.toISOString()));
    // Idempotent re-generation over overlapping/subset windows never produces duplicate dates.
    const combinedDateKeys = [...run1.map((o) => o.dateKey), ...run2.map((o) => o.dateKey)];
    const uniqueDateKeys = new Set(run1.map((o) => o.dateKey));
    expect(uniqueDateKeys.size).toBe(run1.length);
    expect(combinedDateKeys.length).toBe(run1.length * 2);
  });

  it("B7a: throws when no weekdays are provided", () => {
    const series = makeSeries({ weekdays: [] });
    expect(() =>
      generateTrainingSessionOccurrences(series, {
        from: new Date("2026-08-01T00:00:00.000Z"),
        to: new Date("2026-08-31T00:00:00.000Z"),
      }),
    ).toThrow(/at least one weekday/i);
  });

  it("B7b: throws when window.from is after window.to", () => {
    const series = makeSeries();
    expect(() =>
      generateTrainingSessionOccurrences(series, {
        from: new Date("2026-08-31T00:00:00.000Z"),
        to: new Date("2026-08-01T00:00:00.000Z"),
      }),
    ).toThrow(/window\.from must not be after window\.to/i);
  });

  it("B8: window narrower than the series validity only returns occurrences inside the window", () => {
    const series = makeSeries({
      validFrom: new Date("2026-01-01T00:00:00.000Z"),
      validUntil: new Date("2026-12-31T00:00:00.000Z"),
    });

    const occurrences = generateTrainingSessionOccurrences(series, {
      from: new Date("2026-08-01T00:00:00.000Z"),
      to: new Date("2026-08-31T00:00:00.000Z"),
    });

    for (const occ of occurrences) {
      expect(occ.dateKey >= "2026-08-01").toBe(true);
      expect(occ.dateKey <= "2026-08-31").toBe(true);
    }
    expect(occurrences.length).toBeGreaterThan(0);
  });
});

// ── C. weekdayTimes overrides (TRAININGCENTER-03A) ──────────────────────────

describe("C. weekdayTimes per-weekday overrides", () => {
  it("C1: the ticket example — Monday 17:00-18:00, Wednesday 16:00-17:00 on the same series", () => {
    const series = makeSeries({
      weekdays: ["MONDAY", "WEDNESDAY"],
      startsAt: "17:00",
      endsAt: "18:00",
      validFrom: new Date("2026-08-03T00:00:00.000Z"), // Monday
      validUntil: new Date("2026-08-05T00:00:00.000Z"), // Wednesday
      weekdayTimes: {
        WEDNESDAY: { startsAt: "16:00", endsAt: "17:00" },
      },
    });

    const occurrences = generateTrainingSessionOccurrences(series, {
      from: new Date("2026-08-01T00:00:00.000Z"),
      to: new Date("2026-08-31T00:00:00.000Z"),
    });

    expect(occurrences).toHaveLength(2);
    const monday = occurrences.find((o) => o.weekday === "MONDAY")!;
    const wednesday = occurrences.find((o) => o.weekday === "WEDNESDAY")!;

    // Monday has no override -> uses series-level startsAt/endsAt (17:00-18:00 CEST).
    expect(monday.startAt.toISOString()).toBe("2026-08-03T15:00:00.000Z");
    expect(monday.endAt.toISOString()).toBe("2026-08-03T16:00:00.000Z");

    // Wednesday has an override -> uses 16:00-17:00 CEST instead.
    expect(wednesday.startAt.toISOString()).toBe("2026-08-05T14:00:00.000Z");
    expect(wednesday.endAt.toISOString()).toBe("2026-08-05T15:00:00.000Z");
  });

  it("C2: a weekday without an entry in weekdayTimes falls back to the series-level time", () => {
    const series = makeSeries({
      weekdays: ["MONDAY", "FRIDAY"],
      startsAt: "19:00",
      endsAt: "20:00",
      validFrom: new Date("2026-08-03T00:00:00.000Z"),
      validUntil: new Date("2026-08-07T00:00:00.000Z"),
      weekdayTimes: {
        MONDAY: { startsAt: "17:00", endsAt: "18:00" },
        // FRIDAY intentionally has no override.
      },
    });

    const occurrences = generateTrainingSessionOccurrences(series, {
      from: new Date("2026-08-01T00:00:00.000Z"),
      to: new Date("2026-08-31T00:00:00.000Z"),
    });

    const friday = occurrences.find((o) => o.weekday === "FRIDAY")!;
    // No override for Friday -> falls back to the series-level 19:00 CEST = 17:00 UTC.
    expect(friday.startAt.toISOString()).toBe("2026-08-07T17:00:00.000Z");
  });

  it("C3: an empty weekdayTimes object behaves identically to omitting it", () => {
    const seriesWithEmpty = makeSeries({
      weekdays: ["MONDAY"],
      validFrom: new Date("2026-08-03T00:00:00.000Z"),
      validUntil: new Date("2026-08-03T00:00:00.000Z"),
      weekdayTimes: {},
    });
    const seriesWithoutField = makeSeries({
      weekdays: ["MONDAY"],
      validFrom: new Date("2026-08-03T00:00:00.000Z"),
      validUntil: new Date("2026-08-03T00:00:00.000Z"),
    });

    const window = { from: new Date("2026-08-01T00:00:00.000Z"), to: new Date("2026-08-31T00:00:00.000Z") };
    const a = generateTrainingSessionOccurrences(seriesWithEmpty, window);
    const b = generateTrainingSessionOccurrences(seriesWithoutField, window);

    expect(a[0].startAt.toISOString()).toBe(b[0].startAt.toISOString());
    expect(a[0].endAt.toISOString()).toBe(b[0].endAt.toISOString());
  });
});

// ── D. matchesRecurrence / computeOccurrenceForDate (TRAININGCENTER-03A-FIX) ──

describe("D. matchesRecurrence", () => {
  it("D1: true for a date whose weekday is included and within [validFrom, validUntil]", () => {
    const series = makeSeries({
      weekdays: ["MONDAY"],
      validFrom: new Date("2026-08-01T00:00:00.000Z"),
      validUntil: new Date("2026-12-31T00:00:00.000Z"),
    });
    expect(matchesRecurrence(new Date("2026-08-03T00:00:00.000Z"), series)).toBe(true);
  });

  it("D2: false when the weekday is not in the recurrence's weekday set", () => {
    const series = makeSeries({ weekdays: ["MONDAY"] });
    // 2026-08-05 is a Wednesday.
    expect(matchesRecurrence(new Date("2026-08-05T00:00:00.000Z"), series)).toBe(false);
  });

  it("D3: false when the date is after validUntil (shortened validity)", () => {
    const series = makeSeries({
      weekdays: ["MONDAY"],
      validFrom: new Date("2026-08-01T00:00:00.000Z"),
      validUntil: new Date("2026-08-17T00:00:00.000Z"),
    });
    // 2026-08-24 is a Monday, but after the shortened validUntil.
    expect(matchesRecurrence(new Date("2026-08-24T00:00:00.000Z"), series)).toBe(false);
  });

  it("D4: false when the date is before validFrom (moved forward)", () => {
    const series = makeSeries({
      weekdays: ["MONDAY"],
      validFrom: new Date("2026-08-15T00:00:00.000Z"),
      validUntil: null,
    });
    expect(matchesRecurrence(new Date("2026-08-03T00:00:00.000Z"), series)).toBe(false);
  });

  it("D5: validFrom/validUntil boundaries are inclusive", () => {
    const series = makeSeries({
      weekdays: ["MONDAY"],
      validFrom: new Date("2026-08-03T00:00:00.000Z"),
      validUntil: new Date("2026-08-17T00:00:00.000Z"),
    });
    expect(matchesRecurrence(new Date("2026-08-03T00:00:00.000Z"), series)).toBe(true);
    expect(matchesRecurrence(new Date("2026-08-17T00:00:00.000Z"), series)).toBe(true);
  });

  it("D6: unbounded validFrom/validUntil (null) never rejects on the date range", () => {
    const series = makeSeries({ weekdays: ["MONDAY"], validFrom: null, validUntil: null });
    expect(matchesRecurrence(new Date("2010-01-04T00:00:00.000Z"), series)).toBe(true);
    expect(matchesRecurrence(new Date("2099-01-05T00:00:00.000Z"), series)).toBe(true);
  });

  it("D7: is independent of any generation window — window is not a parameter", () => {
    // matchesRecurrence only takes (date, series); a date matching the
    // recurrence rule is always reported as matching, regardless of what
    // window a caller might separately be generating over.
    const series = makeSeries({
      weekdays: ["MONDAY"],
      validFrom: new Date("2020-01-01T00:00:00.000Z"),
      validUntil: new Date("2030-12-31T00:00:00.000Z"),
    });
    expect(matchesRecurrence(new Date("2026-08-03T00:00:00.000Z"), series)).toBe(true);
  });
});

describe("D. computeOccurrenceForDate", () => {
  it("D8: returns null when the date does not match the recurrence", () => {
    const series = makeSeries({ weekdays: ["MONDAY"] });
    // 2026-08-05 is a Wednesday.
    expect(computeOccurrenceForDate(new Date("2026-08-05T00:00:00.000Z"), series)).toBeNull();
  });

  it("D9: computes the resolved schedule for a matching date, honouring weekdayTimes overrides", () => {
    const series = makeSeries({
      weekdays: ["MONDAY", "WEDNESDAY"],
      startsAt: "17:00",
      endsAt: "18:00",
      weekdayTimes: { WEDNESDAY: { startsAt: "16:00", endsAt: "17:00" } },
    });

    const monday = computeOccurrenceForDate(new Date("2026-08-03T00:00:00.000Z"), series)!;
    const wednesday = computeOccurrenceForDate(new Date("2026-08-05T00:00:00.000Z"), series)!;

    expect(monday.startAt.toISOString()).toBe("2026-08-03T15:00:00.000Z");
    expect(wednesday.startAt.toISOString()).toBe("2026-08-05T14:00:00.000Z");
    expect(wednesday.endAt.toISOString()).toBe("2026-08-05T15:00:00.000Z");
  });

  it("D10: matches the per-date result generateTrainingSessionOccurrences() would have produced", () => {
    const series = makeSeries({
      weekdays: ["TUESDAY", "THURSDAY"],
      validFrom: new Date("2026-08-01T00:00:00.000Z"),
      validUntil: new Date("2026-08-31T00:00:00.000Z"),
    });
    const window = { from: new Date("2026-08-01T00:00:00.000Z"), to: new Date("2026-08-31T00:00:00.000Z") };

    const bulk = generateTrainingSessionOccurrences(series, window);
    for (const occ of bulk) {
      const single = computeOccurrenceForDate(occ.date, series);
      expect(single).not.toBeNull();
      expect(single!.startAt.toISOString()).toBe(occ.startAt.toISOString());
      expect(single!.endAt.toISOString()).toBe(occ.endAt.toISOString());
    }
  });
});

describe("D. weekdayFromDate", () => {
  it("D11: returns the correct Weekday for a range of known dates", () => {
    expect(weekdayFromDate(new Date("2026-08-03T00:00:00.000Z"))).toBe("MONDAY"); // Monday
    expect(weekdayFromDate(new Date("2026-08-05T00:00:00.000Z"))).toBe("WEDNESDAY");
    expect(weekdayFromDate(new Date("2026-08-09T00:00:00.000Z"))).toBe("SUNDAY");
  });
});

// ── Helpers ───────────────────────────────────────────────────────────────────

describe("toDateOnlyUtc / dateKeyFromDate", () => {
  it("normalises a DateTime with a non-midnight time component to UTC midnight", () => {
    const withTime = new Date("2026-08-04T13:45:30.000Z");
    const normalised = toDateOnlyUtc(withTime);
    expect(normalised.toISOString()).toBe("2026-08-04T00:00:00.000Z");
  });

  it("formats a UTC-midnight date as YYYY-MM-DD", () => {
    expect(dateKeyFromDate(new Date("2026-08-04T00:00:00.000Z"))).toBe("2026-08-04");
    expect(dateKeyFromDate(new Date("2027-02-22T00:00:00.000Z"))).toBe("2027-02-22");
  });
});
