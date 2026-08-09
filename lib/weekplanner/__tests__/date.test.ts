/**
 * lib/weekplanner/__tests__/date.test.ts
 *
 * WEEKPLANNER-01A — focused tests for the pure Weekplanner date helpers.
 * Covers: Europe/Zurich calendar-day resolution for a real UTC instant,
 * ISO week number, and the "KW 33" / "10. Aug – 16. Aug 2026" labels.
 */

import { describe, expect, it } from "vitest";
import { resolveTrainingWeekWindow } from "@/lib/training/date-range";
import {
  formatWeekNumberLabel,
  formatWeekRangeLabel,
  getIsoWeekNumber,
  zonedDateKey,
} from "../date";

describe("zonedDateKey", () => {
  it("resolves the Europe/Zurich calendar date for a UTC instant that crosses midnight (CEST, +2)", () => {
    // 2026-08-09T22:00:00.000Z is Monday 2026-08-10 00:00 in Europe/Zurich (CEST).
    expect(zonedDateKey(new Date("2026-08-09T22:00:00.000Z"), "Europe/Zurich")).toBe("2026-08-10");
  });

  it("resolves correctly across the winter (CET, +1) boundary too", () => {
    // 2026-11-01T23:00:00.000Z is 2026-11-02 00:00 in Europe/Zurich (CET, +1).
    expect(zonedDateKey(new Date("2026-11-01T23:00:00.000Z"), "Europe/Zurich")).toBe("2026-11-02");
  });

  it("never falls back to a naive UTC calendar date", () => {
    // A naive `date.toISOString().slice(0, 10)` would incorrectly say "2026-08-09".
    const naiveUtcDate = new Date("2026-08-09T22:00:00.000Z").toISOString().slice(0, 10);
    expect(zonedDateKey(new Date("2026-08-09T22:00:00.000Z"), "Europe/Zurich")).not.toBe(naiveUtcDate);
  });
});

describe("getIsoWeekNumber", () => {
  it("resolves KW 33 for 2026-08-10 (Monday)", () => {
    expect(getIsoWeekNumber("2026-08-10")).toBe(33);
  });

  it("resolves week 1 for the first Monday of an ISO week-year", () => {
    // 2027-01-04 is the Monday that always falls in ISO week 1.
    expect(getIsoWeekNumber("2027-01-04")).toBe(1);
  });
});

describe("formatWeekRangeLabel / formatWeekNumberLabel", () => {
  it("formats the exact product example for the week of 2026-08-10", () => {
    const window = resolveTrainingWeekWindow({ weekParam: "2026-08-10", timeZone: "Europe/Zurich" });
    expect(formatWeekNumberLabel(window.days)).toBe("KW 33");
    expect(formatWeekRangeLabel(window.days)).toBe("10. Aug – 16. Aug 2026");
  });

  it("navigates to the previous/current/next week via resolveTrainingWeekWindow", () => {
    const current = resolveTrainingWeekWindow({ weekParam: "2026-08-10", timeZone: "Europe/Zurich" });
    const previous = resolveTrainingWeekWindow({ weekParam: current.previousParam, timeZone: "Europe/Zurich" });
    const next = resolveTrainingWeekWindow({ weekParam: current.nextParam, timeZone: "Europe/Zurich" });

    expect(formatWeekNumberLabel(previous.days)).toBe("KW 32");
    expect(formatWeekNumberLabel(current.days)).toBe("KW 33");
    expect(formatWeekNumberLabel(next.days)).toBe("KW 34");

    // Navigating forward from `previous` returns to exactly `current`, and back again — round-trip stable.
    expect(previous.nextParam).toBe(current.param);
    expect(next.previousParam).toBe(current.param);
  });

  it("resolves a Monday–Sunday week (7 consecutive calendar days)", () => {
    const window = resolveTrainingWeekWindow({ weekParam: "2026-08-12", timeZone: "Europe/Zurich" });
    expect(window.days).toEqual([
      "2026-08-10",
      "2026-08-11",
      "2026-08-12",
      "2026-08-13",
      "2026-08-14",
      "2026-08-15",
      "2026-08-16",
    ]);
  });
});
