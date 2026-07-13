/**
 * lib/integrations/sfv/__tests__/sync-schedule-window.test.ts
 *
 * Unit tests for the schedule window utility functions.
 * No mocks needed — all functions are pure and deterministic.
 */

import { describe, it, expect } from "vitest";
import {
  computeDefaultWindow,
  validateWindow,
  toSfvDateParam,
  toIsoDateString,
} from "../sync/schedule-window";
import {
  SCHEDULE_WINDOW_PAST_DAYS,
  SCHEDULE_WINDOW_FUTURE_DAYS,
} from "../sync/schedule-types";

// ── computeDefaultWindow ──────────────────────────────────────────────────────

describe("computeDefaultWindow", () => {
  it("dateFrom is PAST_DAYS before reference date", () => {
    const ref = new Date("2026-07-13T12:00:00.000Z");
    const { dateFrom } = computeDefaultWindow(ref);
    const expectedFrom = new Date("2026-07-13T00:00:00.000Z");
    expectedFrom.setUTCDate(expectedFrom.getUTCDate() - SCHEDULE_WINDOW_PAST_DAYS);
    expect(dateFrom.getTime()).toBe(expectedFrom.getTime());
  });

  it("dateTo is FUTURE_DAYS after reference date", () => {
    const ref = new Date("2026-07-13T12:00:00.000Z");
    const { dateTo } = computeDefaultWindow(ref);
    const expectedTo = new Date("2026-07-13T00:00:00.000Z");
    expectedTo.setUTCDate(expectedTo.getUTCDate() + SCHEDULE_WINDOW_FUTURE_DAYS);
    expect(dateTo.getTime()).toBe(expectedTo.getTime());
  });

  it("boundaries are truncated to UTC midnight", () => {
    const ref = new Date("2026-07-13T22:59:00.000Z");
    const { dateFrom, dateTo } = computeDefaultWindow(ref);
    expect(dateFrom.getUTCHours()).toBe(0);
    expect(dateFrom.getUTCMinutes()).toBe(0);
    expect(dateFrom.getUTCSeconds()).toBe(0);
    expect(dateTo.getUTCHours()).toBe(0);
  });

  it("dateFrom is before dateTo", () => {
    const { dateFrom, dateTo } = computeDefaultWindow();
    expect(dateFrom.getTime()).toBeLessThan(dateTo.getTime());
  });
});

// ── validateWindow ────────────────────────────────────────────────────────────

describe("validateWindow", () => {
  it("returns null for a valid window", () => {
    const from = new Date("2026-06-13T00:00:00.000Z");
    const to = new Date("2026-10-11T00:00:00.000Z");
    expect(validateWindow(from, to)).toBeNull();
  });

  it("returns error when from >= to", () => {
    const same = new Date("2026-07-13T00:00:00.000Z");
    expect(validateWindow(same, same)).toBeTruthy();

    const reversed = new Date("2026-08-01T00:00:00.000Z");
    const earlier = new Date("2026-07-01T00:00:00.000Z");
    expect(validateWindow(reversed, earlier)).toBeTruthy();
  });

  it("returns error when range exceeds maximum", () => {
    const from = new Date("2024-01-01T00:00:00.000Z");
    const to = new Date("2027-01-01T00:00:00.000Z"); // ~3 years
    expect(validateWindow(from, to)).toBeTruthy();
  });

  it("accepts the default window without error", () => {
    const { dateFrom, dateTo } = computeDefaultWindow();
    expect(validateWindow(dateFrom, dateTo)).toBeNull();
  });
});

// ── toSfvDateParam ────────────────────────────────────────────────────────────

describe("toSfvDateParam", () => {
  it("formats a UTC date as YYYY-MM-DDTHH:mm:ss", () => {
    const date = new Date("2026-07-13T00:00:00.000Z");
    expect(toSfvDateParam(date)).toBe("2026-07-13T00:00:00");
  });

  it("formats non-midnight UTC times correctly", () => {
    const date = new Date("2026-09-15T18:30:45.000Z");
    expect(toSfvDateParam(date)).toBe("2026-09-15T18:30:45");
  });
});

// ── toIsoDateString ───────────────────────────────────────────────────────────

describe("toIsoDateString", () => {
  it("returns YYYY-MM-DD for a UTC date", () => {
    const date = new Date("2026-07-13T00:00:00.000Z");
    expect(toIsoDateString(date)).toBe("2026-07-13");
  });

  it("pads month and day with leading zeros", () => {
    const date = new Date("2026-01-05T00:00:00.000Z");
    expect(toIsoDateString(date)).toBe("2026-01-05");
  });
});
