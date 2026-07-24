/**
 * lib/publishing/time/__tests__/temporal-grouping.test.ts
 *
 * Unit tests for the temporal-grouping utilities.
 * All timestamps are fixed — no real clock access.
 * No mocks required: all functions under test are pure.
 */

import { describe, it, expect } from "vitest";
import {
  toLocalDateKey,
  isLocalToday,
  getEffectiveEndAt,
  partitionByTemporalGroup,
  DEFAULT_EVENT_DURATIONS_MINUTES,
} from "../temporal-grouping";

// ── toLocalDateKey ────────────────────────────────────────────────────────────

describe("toLocalDateKey", () => {
  it("Swiss summer time: 22:15 UTC on Jul 23 maps to Jul 24 in Zurich", () => {
    // Europe/Zurich is UTC+2 in summer (CEST).
    // 22:15 UTC = 00:15 CEST next day.
    expect(
      toLocalDateKey(new Date("2026-07-23T22:15:00.000Z"), "Europe/Zurich"),
    ).toBe("2026-07-24");
  });

  it("Swiss winter time: 23:15 UTC on Jan 15 maps to Jan 16 in Zurich", () => {
    // Europe/Zurich is UTC+1 in winter (CET).
    // 23:15 UTC = 00:15 CET next day.
    expect(
      toLocalDateKey(new Date("2026-01-15T23:15:00.000Z"), "Europe/Zurich"),
    ).toBe("2026-01-16");
  });

  it("daytime UTC timestamp stays on the same Swiss calendar date", () => {
    // 10:00 UTC = 12:00 CEST — still Jul 23.
    expect(
      toLocalDateKey(new Date("2026-07-23T10:00:00.000Z"), "Europe/Zurich"),
    ).toBe("2026-07-23");
  });

  it("formats the leap day 2028-02-29 correctly", () => {
    expect(
      toLocalDateKey(new Date("2028-02-29T12:00:00.000Z"), "Europe/Zurich"),
    ).toBe("2028-02-29");
  });

  it("throws for an invalid timezone identifier", () => {
    expect(() =>
      toLocalDateKey(new Date("2026-07-23T12:00:00.000Z"), "Europe/Invalid"),
    ).toThrow();
  });

  // ── DST transitions ──────────────────────────────────────────────────────

  describe("DST start (Switzerland, 29 March 2026)", () => {
    // At 02:00 CET (= 01:00 UTC) on Mar 29 2026 clocks spring forward to
    // 03:00 CEST. Both test instants are on the same local calendar date.

    it("instant before the transition (00:59 UTC) is still Mar 29 in Zurich", () => {
      // 00:59 UTC = 01:59 CET (UTC+1, before spring-forward) → Mar 29
      expect(
        toLocalDateKey(new Date("2026-03-29T00:59:00.000Z"), "Europe/Zurich"),
      ).toBe("2026-03-29");
    });

    it("instant after the transition (01:01 UTC) is still Mar 29 in Zurich", () => {
      // 01:01 UTC → clocks have sprung to CEST (UTC+2) → 03:01 CEST → Mar 29
      expect(
        toLocalDateKey(new Date("2026-03-29T01:01:00.000Z"), "Europe/Zurich"),
      ).toBe("2026-03-29");
    });
  });

  describe("DST end (Switzerland, 25 October 2026)", () => {
    // At 03:00 CEST (= 01:00 UTC) on Oct 25 2026 clocks fall back to
    // 02:00 CET. The local hour 02:00–02:59 is repeated.
    // Both test instants are on Oct 25 regardless of which repetition.

    it("00:30 UTC on Oct 25 resolves to Oct 25 in Zurich (CEST side)", () => {
      // 00:30 UTC = 02:30 CEST (before fall-back) → Oct 25
      expect(
        toLocalDateKey(new Date("2026-10-25T00:30:00.000Z"), "Europe/Zurich"),
      ).toBe("2026-10-25");
    });

    it("01:30 UTC on Oct 25 resolves to Oct 25 in Zurich (CET side)", () => {
      // 01:30 UTC = 02:30 CET (second occurrence, after fall-back) → Oct 25
      expect(
        toLocalDateKey(new Date("2026-10-25T01:30:00.000Z"), "Europe/Zurich"),
      ).toBe("2026-10-25");
    });
  });
});

// ── isLocalToday ──────────────────────────────────────────────────────────────

describe("isLocalToday", () => {
  it("two timestamps on different UTC dates but the same Swiss local date → true", () => {
    // 23:30 UTC Jul 23 = 01:30 CEST Jul 24 (local: Jul 24)
    // 00:30 UTC Jul 24 = 02:30 CEST Jul 24 (local: Jul 24)
    // Different UTC dates, but both land on Jul 24 in Zurich.
    const d1 = new Date("2026-07-23T23:30:00.000Z");
    const d2 = new Date("2026-07-24T00:30:00.000Z");
    expect(isLocalToday(d1, d2, "Europe/Zurich")).toBe(true);
  });

  it("two timestamps on the same UTC date but different Swiss local dates → false", () => {
    // 22:30 UTC Jan 15 = 23:30 CET Jan 15 (local: Jan 15)
    // 23:30 UTC Jan 15 = 00:30 CET Jan 16 (local: Jan 16)
    // Same UTC date, but different local dates.
    const d1 = new Date("2026-01-15T22:30:00.000Z");
    const d2 = new Date("2026-01-15T23:30:00.000Z");
    expect(isLocalToday(d1, d2, "Europe/Zurich")).toBe(false);
  });

  it("returns true when both values are on the same Swiss local date", () => {
    const d1 = new Date("2026-07-24T08:00:00.000Z"); // 10:00 CEST Jul 24
    const d2 = new Date("2026-07-24T12:00:00.000Z"); // 14:00 CEST Jul 24
    expect(isLocalToday(d1, d2, "Europe/Zurich")).toBe(true);
  });

  it("returns false when the two values are on different Swiss local dates", () => {
    const d1 = new Date("2026-07-24T10:00:00.000Z"); // 12:00 CEST Jul 24
    const d2 = new Date("2026-07-25T10:00:00.000Z"); // 12:00 CEST Jul 25
    expect(isLocalToday(d1, d2, "Europe/Zurich")).toBe(false);
  });
});

// ── getEffectiveEndAt ─────────────────────────────────────────────────────────

describe("getEffectiveEndAt", () => {
  const start = new Date("2026-07-24T09:00:00.000Z");

  it("returns an explicit endAt that is strictly after startAt", () => {
    const endAt = new Date("2026-07-24T11:00:00.000Z");
    const result = getEffectiveEndAt({ startAt: start, endAt, type: "MATCH" });
    expect(result.getTime()).toBe(endAt.getTime());
  });

  it("null endAt for MATCH uses 110-minute default duration", () => {
    const result = getEffectiveEndAt({ startAt: start, endAt: null, type: "MATCH" });
    expect(result.getTime()).toBe(
      start.getTime() + DEFAULT_EVENT_DURATIONS_MINUTES.MATCH * 60_000,
    );
  });

  it("null endAt for TRAINING uses 90-minute default duration", () => {
    const result = getEffectiveEndAt({ startAt: start, endAt: null, type: "TRAINING" });
    expect(result.getTime()).toBe(
      start.getTime() + DEFAULT_EVENT_DURATIONS_MINUTES.TRAINING * 60_000,
    );
  });

  it("null endAt for TOURNAMENT uses 240-minute default duration", () => {
    const result = getEffectiveEndAt({ startAt: start, endAt: null, type: "TOURNAMENT" });
    expect(result.getTime()).toBe(
      start.getTime() + DEFAULT_EVENT_DURATIONS_MINUTES.TOURNAMENT * 60_000,
    );
  });

  it("null endAt for unknown type uses DEFAULT (60-minute) fallback", () => {
    const result = getEffectiveEndAt({ startAt: start, endAt: null, type: "UNKNOWN_TYPE" });
    expect(result.getTime()).toBe(
      start.getTime() + DEFAULT_EVENT_DURATIONS_MINUTES.DEFAULT * 60_000,
    );
  });

  it("endAt equal to startAt is treated as invalid and uses duration fallback", () => {
    const result = getEffectiveEndAt({ startAt: start, endAt: start, type: "MATCH" });
    expect(result.getTime()).toBe(
      start.getTime() + DEFAULT_EVENT_DURATIONS_MINUTES.MATCH * 60_000,
    );
  });

  it("endAt before startAt is treated as invalid and uses duration fallback", () => {
    const endBefore = new Date(start.getTime() - 1_000);
    const result = getEffectiveEndAt({ startAt: start, endAt: endBefore, type: "TRAINING" });
    expect(result.getTime()).toBe(
      start.getTime() + DEFAULT_EVENT_DURATIONS_MINUTES.TRAINING * 60_000,
    );
  });

  it("custom duration map overrides built-in defaults", () => {
    const customDurations = { MATCH: 90, DEFAULT: 30 } as const;
    const result = getEffectiveEndAt(
      { startAt: start, endAt: null, type: "MATCH" },
      customDurations,
    );
    expect(result.getTime()).toBe(start.getTime() + 90 * 60_000);
  });

  it("does not mutate the input event object", () => {
    const event = { startAt: new Date(start), endAt: null, type: "MATCH" };
    const originalStartMs = event.startAt.getTime();
    getEffectiveEndAt(event);
    expect(event.endAt).toBeNull();
    expect(event.type).toBe("MATCH");
    expect(event.startAt.getTime()).toBe(originalStartMs);
  });
});

// ── partitionByTemporalGroup ──────────────────────────────────────────────────

describe("partitionByTemporalGroup", () => {
  // Reference: "now" = 2026-07-24T08:00:00.000Z = 10:00 CEST Jul 24
  // (Swiss summer time, UTC+2)
  const TZ = "Europe/Zurich";
  const now = new Date("2026-07-24T08:00:00.000Z");

  it("returns empty buckets for an empty input array", () => {
    const result = partitionByTemporalGroup([], now, TZ);
    expect(result.current).toEqual([]);
    expect(result.next).toEqual([]);
    expect(result.later).toEqual([]);
  });

  it("places a currently active event (explicit endAt) in current", () => {
    const event = {
      startAt: new Date("2026-07-24T07:00:00.000Z"), // 09:00 CEST — before now
      endAt: new Date("2026-07-24T10:00:00.000Z"),   // 12:00 CEST — after now
      type: "MATCH",
    };
    const result = partitionByTemporalGroup([event], now, TZ);
    expect(result.current).toHaveLength(1);
    expect(result.current[0]).toBe(event);
    expect(result.next).toHaveLength(0);
    expect(result.later).toHaveLength(0);
  });

  it("includes a TRAINING with null endAt in current when within 90-minute fallback", () => {
    // Started 30 minutes before now; effective end is 60 minutes from now.
    const event = {
      startAt: new Date("2026-07-24T07:30:00.000Z"), // 09:30 CEST — 30 min before now
      endAt: null,
      type: "TRAINING",
    };
    const result = partitionByTemporalGroup([event], now, TZ);
    expect(result.current).toHaveLength(1);
    expect(result.current[0]).toBe(event);
    expect(result.next).toHaveLength(0);
  });

  it("omits an ended event from all buckets", () => {
    const event = {
      startAt: new Date("2026-07-24T05:00:00.000Z"), // 07:00 CEST
      endAt: new Date("2026-07-24T06:00:00.000Z"),   // 08:00 CEST — ended 2 h before now
      type: "MATCH",
    };
    const result = partitionByTemporalGroup([event], now, TZ);
    expect(result.current).toHaveLength(0);
    expect(result.next).toHaveLength(0);
    expect(result.later).toHaveLength(0);
  });

  it("places a single future event today in next with an empty later", () => {
    const event = {
      startAt: new Date("2026-07-24T12:00:00.000Z"), // 14:00 CEST — future today
      endAt: null,
      type: "TRAINING",
    };
    const result = partitionByTemporalGroup([event], now, TZ);
    expect(result.next).toHaveLength(1);
    expect(result.next[0]).toBe(event);
    expect(result.later).toHaveLength(0);
  });

  it("places two simultaneously starting future events both in next", () => {
    const futureStart = new Date("2026-07-24T12:00:00.000Z"); // 14:00 CEST
    const e1 = { startAt: futureStart, endAt: null, type: "MATCH" };
    const e2 = { startAt: futureStart, endAt: null, type: "TRAINING" };
    const result = partitionByTemporalGroup([e1, e2], now, TZ);
    expect(result.next).toHaveLength(2);
    expect(result.later).toHaveLength(0);
  });

  it("next gets earliest-start group, later gets the rest", () => {
    const start1 = new Date("2026-07-24T12:00:00.000Z"); // 14:00 CEST
    const start2 = new Date("2026-07-24T14:00:00.000Z"); // 16:00 CEST
    const e1 = { startAt: start1, endAt: null, type: "MATCH" };
    const e2 = { startAt: start1, endAt: null, type: "TRAINING" };
    const e3 = { startAt: start2, endAt: null, type: "MATCH" };
    const result = partitionByTemporalGroup([e1, e2, e3], now, TZ);
    expect(result.next).toHaveLength(2);
    expect(result.later).toHaveLength(1);
    expect(result.next[0]).toBe(e1);
    expect(result.next[1]).toBe(e2);
    expect(result.later[0]).toBe(e3);
  });

  it("excludes a future event on the next Swiss local day", () => {
    // Jul 25 in Zurich — tomorrow relative to now (Jul 24).
    const tomorrowEvent = {
      startAt: new Date("2026-07-25T08:00:00.000Z"), // 10:00 CEST Jul 25
      endAt: null,
      type: "MATCH",
    };
    const result = partitionByTemporalGroup([tomorrowEvent], now, TZ);
    expect(result.next).toHaveLength(0);
    expect(result.later).toHaveLength(0);
    expect(result.current).toHaveLength(0);
  });

  it("groups by Swiss local date, not UTC date (UTC boundary test)", () => {
    // now = 23:30 CEST Jul 23 = 21:30 UTC Jul 23
    const nowBoundary = new Date("2026-07-23T21:30:00.000Z");

    // 21:45 UTC Jul 23 = 23:45 CEST Jul 23 → today (Jul 23 local) → in next
    const todayEvent = {
      startAt: new Date("2026-07-23T21:45:00.000Z"),
      endAt: null,
      type: "TRAINING",
    };

    // 22:30 UTC Jul 23 = 00:30 CEST Jul 24 → tomorrow (Jul 24 local) → excluded
    const tomorrowEvent = {
      startAt: new Date("2026-07-23T22:30:00.000Z"),
      endAt: null,
      type: "MATCH",
    };

    const result = partitionByTemporalGroup(
      [todayEvent, tomorrowEvent],
      nowBoundary,
      TZ,
    );
    expect(result.next).toHaveLength(1);
    expect(result.next[0]).toBe(todayEvent);
    expect(result.later).toHaveLength(0);
  });

  it("includes an overnight event (started previous local day, still running) in current", () => {
    // Event started 19:00 UTC Jul 23 = 21:00 CEST Jul 23 (previous local day).
    // Ends 09:00 UTC Jul 24 = 11:00 CEST Jul 24 → after now (10:00 CEST).
    const overnight = {
      startAt: new Date("2026-07-23T19:00:00.000Z"),
      endAt: new Date("2026-07-24T09:00:00.000Z"),
      type: "OTHER",
    };
    const result = partitionByTemporalGroup([overnight], now, TZ);
    expect(result.current).toHaveLength(1);
    expect(result.current[0]).toBe(overnight);
    expect(result.next).toHaveLength(0);
    expect(result.later).toHaveLength(0);
  });

  it("omits an overnight event that ended before now", () => {
    // Event started Jul 23, ended 06:00 UTC Jul 24 = 08:00 CEST (before now 10:00 CEST).
    const overnightEnded = {
      startAt: new Date("2026-07-23T19:00:00.000Z"),
      endAt: new Date("2026-07-24T06:00:00.000Z"), // 08:00 CEST — ended before now
      type: "OTHER",
    };
    const result = partitionByTemporalGroup([overnightEnded], now, TZ);
    expect(result.current).toHaveLength(0);
    expect(result.next).toHaveLength(0);
    expect(result.later).toHaveLength(0);
  });

  it("preserves stable input order for events with equal startAt", () => {
    const sharedStart = new Date("2026-07-24T12:00:00.000Z");
    const e1 = { startAt: sharedStart, endAt: null, type: "MATCH" };
    const e2 = { startAt: sharedStart, endAt: null, type: "TRAINING" };
    const e3 = { startAt: sharedStart, endAt: null, type: "OTHER" };
    const result = partitionByTemporalGroup([e1, e2, e3], now, TZ);
    expect(result.next[0]).toBe(e1);
    expect(result.next[1]).toBe(e2);
    expect(result.next[2]).toBe(e3);
  });

  it("does not mutate the input array", () => {
    const futureStart = new Date("2026-07-24T12:00:00.000Z");
    const events = [
      { startAt: futureStart, endAt: null, type: "MATCH" },
      { startAt: new Date("2026-07-24T14:00:00.000Z"), endAt: null, type: "TRAINING" },
    ];
    const snapshot = [...events];
    partitionByTemporalGroup(events, now, TZ);
    expect(events).toHaveLength(snapshot.length);
    expect(events[0]).toBe(snapshot[0]);
    expect(events[1]).toBe(snapshot[1]);
  });

  it("does not mutate event objects", () => {
    const event = {
      startAt: new Date("2026-07-24T07:00:00.000Z"),
      endAt: null,
      type: "MATCH",
    };
    const originalStartMs = event.startAt.getTime();
    partitionByTemporalGroup([event], now, TZ);
    expect(event.startAt.getTime()).toBe(originalStartMs);
    expect(event.endAt).toBeNull();
    expect(event.type).toBe("MATCH");
  });

  it("throws a RangeError for an invalid IANA timezone", () => {
    expect(() =>
      partitionByTemporalGroup([], now, "Not/ATimezone"),
    ).toThrow(RangeError);
  });
});
