/**
 * WOCHENPLAN-2.0-01C — current-week boundary tests.
 */

import { describe, it, expect } from "vitest";
import {
  isInstantInWeekWindow,
  resolvePublicCurrentWeekWindow,
} from "../public-current-week";

describe("resolvePublicCurrentWeekWindow", () => {
  it("resolves Monday-first current week in Europe/Zurich", () => {
    // Saturday 29 Aug 2026 12:00 UTC => still Saturday in Zurich
    const window = resolvePublicCurrentWeekWindow({
      timeZone: "Europe/Zurich",
      now: new Date("2026-08-29T12:00:00.000Z"),
    });

    expect(window.days).toHaveLength(7);
    expect(window.days[0]).toBe("2026-08-24");
    expect(window.days[6]).toBe("2026-08-30");
    expect(window.weekId).toBe("2026-08-24");
    expect(window.calendarWeekLabel).toMatch(/^KW /);
    expect(window.rangeLabel).toContain("Aug");
  });

  it("uses tenant timezone for week boundaries (US Pacific)", () => {
    // Late Sunday UTC can still be Saturday in US — verify different Monday
    const zurich = resolvePublicCurrentWeekWindow({
      timeZone: "Europe/Zurich",
      now: new Date("2026-01-05T07:30:00.000Z"),
    });
    const pacific = resolvePublicCurrentWeekWindow({
      timeZone: "America/Los_Angeles",
      now: new Date("2026-01-05T07:30:00.000Z"),
    });

    expect(zurich.weekId).not.toBe(pacific.weekId);
  });
});

describe("isInstantInWeekWindow", () => {
  it("includes instants inside the week window", () => {
    const window = resolvePublicCurrentWeekWindow({
      timeZone: "Europe/Zurich",
      now: new Date("2026-08-26T10:00:00.000Z"),
    });

    expect(isInstantInWeekWindow(new Date("2026-08-26T10:00:00.000Z"), window)).toBe(true);
    expect(isInstantInWeekWindow(new Date("2026-08-20T10:00:00.000Z"), window)).toBe(false);
    expect(isInstantInWeekWindow(new Date("2026-09-01T10:00:00.000Z"), window)).toBe(false);
  });
});
