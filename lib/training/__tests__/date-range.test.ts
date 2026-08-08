import { describe, expect, it } from "vitest";
import {
  formatTrainingDayLabel,
  formatTrainingMonthLabel,
  formatTrainingWeekLabel,
  normalizeTrainingCenterView,
  parseDateParam,
  parseMonthParam,
  resolveTrainingDayWindow,
  resolveTrainingMonthWindow,
  resolveTrainingWeekWindow,
} from "../date-range";

describe("parseMonthParam", () => {
  it("parses a valid YYYY-MM param", () => {
    expect(parseMonthParam("2026-08")).toEqual({ year: 2026, month: 8 });
  });

  it("returns null for malformed input", () => {
    expect(parseMonthParam("2026-13")).toBeNull();
    expect(parseMonthParam("not-a-month")).toBeNull();
    expect(parseMonthParam(null)).toBeNull();
    expect(parseMonthParam(undefined)).toBeNull();
  });
});

describe("parseDateParam", () => {
  it("parses a valid YYYY-MM-DD param", () => {
    expect(parseDateParam("2026-08-07")).toEqual({ year: 2026, month: 8, day: 7 });
  });

  it("returns null for malformed input", () => {
    expect(parseDateParam("2026-13-40")).toBeNull();
    expect(parseDateParam("not-a-date")).toBeNull();
    expect(parseDateParam(null)).toBeNull();
  });
});

describe("resolveTrainingMonthWindow", () => {
  it("defaults to the current month (Europe/Zurich) when no param is given", () => {
    const window = resolveTrainingMonthWindow({
      now: new Date("2026-08-07T22:00:00.000Z"),
      timeZone: "Europe/Zurich",
    });
    expect(window.param).toBe("2026-08");
  });

  it("resolves a stable [from, to] window, Europe/Zurich", () => {
    const window = resolveTrainingMonthWindow({
      monthParam: "2026-08",
      timeZone: "Europe/Zurich",
    });
    expect(window.from.toISOString()).toBe("2026-07-31T22:00:00.000Z");
    expect(window.to.toISOString()).toBe("2026-08-31T21:59:59.999Z");
  });

  it("honors DST transitions across the winter boundary", () => {
    const window = resolveTrainingMonthWindow({
      monthParam: "2026-10",
      timeZone: "Europe/Zurich",
    });
    expect(window.from.toISOString()).toBe("2026-09-30T22:00:00.000Z");
    expect(window.to.toISOString()).toBe("2026-10-31T22:59:59.999Z");
  });

  it("computes correct previous/next month params, including year rollover", () => {
    const window = resolveTrainingMonthWindow({ monthParam: "2026-12" });
    expect(window.previousParam).toBe("2026-11");
    expect(window.nextParam).toBe("2027-01");
  });

  it("builds a Monday-first 6x7 calendar grid covering the whole month", () => {
    // August 2026: Aug 1 is a Saturday.
    const window = resolveTrainingMonthWindow({ monthParam: "2026-08" });
    expect(window.weeks).toHaveLength(6);
    for (const row of window.weeks) {
      expect(row).toHaveLength(7);
    }
    // First row's Monday must be the last Monday on/before Aug 1 (July 27).
    expect(window.weeks[0][0]).toEqual({ date: "2026-07-27", inMonth: false });
    // Aug 1 (Saturday) is the 6th cell of the first row.
    expect(window.weeks[0][5]).toEqual({ date: "2026-08-01", inMonth: true });
    // Aug 31 (Monday) must appear, in-month.
    const flat = window.weeks.flat();
    expect(flat.find((d) => d.date === "2026-08-31")).toEqual({
      date: "2026-08-31",
      inMonth: true,
    });
    // Every day in the grid is unique and contiguous.
    const dates = flat.map((d) => d.date);
    expect(new Set(dates).size).toBe(42);
  });
});

describe("formatTrainingMonthLabel", () => {
  it("formats a German month/year label", () => {
    expect(formatTrainingMonthLabel({ year: 2026, month: 8 }, "de-CH")).toContain("2026");
  });
});

describe("resolveTrainingWeekWindow", () => {
  it("defaults to the current week (Europe/Zurich) when no param is given", () => {
    // 2026-08-07T22:00:00Z is 2026-08-08 00:00 CEST (Saturday) — current week's Monday is Aug 3.
    const window = resolveTrainingWeekWindow({
      now: new Date("2026-08-07T22:00:00.000Z"),
      timeZone: "Europe/Zurich",
    });
    expect(window.param).toBe("2026-08-03");
    expect(window.days).toEqual([
      "2026-08-03",
      "2026-08-04",
      "2026-08-05",
      "2026-08-06",
      "2026-08-07",
      "2026-08-08",
      "2026-08-09",
    ]);
  });

  it("normalises any weekday param to that week's Monday", () => {
    // 2026-08-07 is a Friday.
    const window = resolveTrainingWeekWindow({
      weekParam: "2026-08-07",
      timeZone: "Europe/Zurich",
    });
    expect(window.param).toBe("2026-08-03"); // the Monday of that week
    expect(window.days[0]).toBe("2026-08-03");
    expect(window.days[6]).toBe("2026-08-09");
    expect(window.days).toHaveLength(7);
  });

  it("resolves a stable [from, to] window spanning exactly 7 days, Europe/Zurich", () => {
    const window = resolveTrainingWeekWindow({
      weekParam: "2026-08-03",
      timeZone: "Europe/Zurich",
    });
    expect(window.from.toISOString()).toBe("2026-08-02T22:00:00.000Z");
    expect(window.to.toISOString()).toBe("2026-08-09T21:59:59.999Z");
  });

  it("computes correct previous/next week params", () => {
    const window = resolveTrainingWeekWindow({ weekParam: "2026-08-03" });
    expect(window.previousParam).toBe("2026-07-27");
    expect(window.nextParam).toBe("2026-08-10");
  });

  it("handles a Sunday param (end of week) correctly", () => {
    const window = resolveTrainingWeekWindow({ weekParam: "2026-08-09" });
    expect(window.param).toBe("2026-08-03");
  });

  it("honors the DST spring-forward boundary (last Sunday of March)", () => {
    // 2026-03-29 is the Europe/Zurich spring DST transition (02:00 -> 03:00 CEST).
    const window = resolveTrainingWeekWindow({
      weekParam: "2026-03-30",
      timeZone: "Europe/Zurich",
    });
    expect(window.param).toBe("2026-03-30");
    expect(window.from.toISOString()).toBe("2026-03-29T22:00:00.000Z");
    expect(window.to.toISOString()).toBe("2026-04-05T21:59:59.999Z");
  });
});

describe("formatTrainingWeekLabel", () => {
  it("formats a same-month week range compactly", () => {
    const window = resolveTrainingWeekWindow({ weekParam: "2026-08-03" });
    const label = formatTrainingWeekLabel(window, "de-CH");
    expect(label).toContain("Aug");
  });
});

describe("resolveTrainingDayWindow", () => {
  it("defaults to today when no param is given", () => {
    const window = resolveTrainingDayWindow({
      now: new Date("2026-08-07T22:00:00.000Z"),
      timeZone: "Europe/Zurich",
    });
    expect(window.date).toBe("2026-08-08");
  });

  it("resolves a stable [from, to] window spanning exactly one calendar day", () => {
    const window = resolveTrainingDayWindow({
      dayParam: "2026-08-08",
      timeZone: "Europe/Zurich",
    });
    expect(window.from.toISOString()).toBe("2026-08-07T22:00:00.000Z");
    expect(window.to.toISOString()).toBe("2026-08-08T21:59:59.999Z");
  });

  it("computes correct previous/next day params, including month rollover", () => {
    const window = resolveTrainingDayWindow({ dayParam: "2026-08-31" });
    expect(window.previousParam).toBe("2026-08-30");
    expect(window.nextParam).toBe("2026-09-01");
  });

  it("honors the DST fall-back boundary (last Sunday of October)", () => {
    // 2026-10-25 is the Europe/Zurich autumn DST transition (03:00 -> 02:00 CET).
    const window = resolveTrainingDayWindow({
      dayParam: "2026-10-25",
      timeZone: "Europe/Zurich",
    });
    expect(window.from.toISOString()).toBe("2026-10-24T22:00:00.000Z");
    expect(window.to.toISOString()).toBe("2026-10-25T22:59:59.999Z");
  });
});

describe("formatTrainingDayLabel", () => {
  it("formats a full weekday/date label", () => {
    const label = formatTrainingDayLabel("2026-08-08", "de-CH");
    expect(label).toContain("2026");
    expect(label).toContain("August");
  });
});

describe("TRAININGCENTER-01B — default-date + per-view param isolation", () => {
  // Fixed "now": 2026-08-08T20:00:43Z == 2026-08-08 22:00 CEST (Saturday).
  const NOW = new Date("2026-08-08T20:00:43.000Z");
  const TZ = "Europe/Zurich";

  it("no day param → Day view defaults to today, regardless of other params", () => {
    const window = resolveTrainingDayWindow({ dayParam: undefined, now: NOW, timeZone: TZ });
    expect(window.date).toBe("2026-08-08");
  });

  it("no week param → Week view defaults to the current week", () => {
    const window = resolveTrainingWeekWindow({ weekParam: undefined, now: NOW, timeZone: TZ });
    expect(window.param).toBe("2026-08-03"); // Monday of the week containing Aug 8
    expect(window.days).toContain("2026-08-08");
  });

  it("no month param → Month view defaults to the current month", () => {
    const window = resolveTrainingMonthWindow({ monthParam: undefined, now: NOW, timeZone: TZ });
    expect(window.param).toBe("2026-08");
  });

  it("an explicit day param is preserved and does not leak into the week/month defaults", () => {
    const dayWindow = resolveTrainingDayWindow({ dayParam: "2026-07-27", now: NOW, timeZone: TZ });
    const weekWindow = resolveTrainingWeekWindow({ weekParam: undefined, now: NOW, timeZone: TZ });
    const monthWindow = resolveTrainingMonthWindow({ monthParam: undefined, now: NOW, timeZone: TZ });

    expect(dayWindow.date).toBe("2026-07-27");
    // Week/Month must still resolve to "current", unaffected by the Day view's explicit param.
    expect(weekWindow.param).toBe("2026-08-03");
    expect(monthWindow.param).toBe("2026-08");
  });

  it("an explicit week param is preserved and does not leak into the day/month defaults", () => {
    const weekWindow = resolveTrainingWeekWindow({ weekParam: "2026-07-27", now: NOW, timeZone: TZ });
    const dayWindow = resolveTrainingDayWindow({ dayParam: undefined, now: NOW, timeZone: TZ });
    const monthWindow = resolveTrainingMonthWindow({ monthParam: undefined, now: NOW, timeZone: TZ });

    expect(weekWindow.param).toBe("2026-07-27");
    expect(dayWindow.date).toBe("2026-08-08");
    expect(monthWindow.param).toBe("2026-08");
  });

  it("an explicit month param is preserved and does not leak into the day/week defaults", () => {
    const monthWindow = resolveTrainingMonthWindow({ monthParam: "2026-07", now: NOW, timeZone: TZ });
    const dayWindow = resolveTrainingDayWindow({ dayParam: undefined, now: NOW, timeZone: TZ });
    const weekWindow = resolveTrainingWeekWindow({ weekParam: undefined, now: NOW, timeZone: TZ });

    expect(monthWindow.param).toBe("2026-07");
    expect(dayWindow.date).toBe("2026-08-08");
    expect(weekWindow.param).toBe("2026-08-03");
  });

  it("previous/next navigation still works from an explicit Day param", () => {
    const window = resolveTrainingDayWindow({ dayParam: "2026-07-27", now: NOW, timeZone: TZ });
    expect(window.previousParam).toBe("2026-07-26");
    expect(window.nextParam).toBe("2026-07-28");
  });

  it("previous/next navigation still works from the default (today) Day window", () => {
    const window = resolveTrainingDayWindow({ dayParam: undefined, now: NOW, timeZone: TZ });
    expect(window.previousParam).toBe("2026-08-07");
    expect(window.nextParam).toBe("2026-08-09");
  });
});

describe("normalizeTrainingCenterView", () => {
  it("defaults to MONTH for missing/unknown values", () => {
    expect(normalizeTrainingCenterView(undefined)).toBe("MONTH");
    expect(normalizeTrainingCenterView(null)).toBe("MONTH");
    expect(normalizeTrainingCenterView("bogus")).toBe("MONTH");
  });

  it("recognizes WEEK/WOCHE and DAY/TAG case-insensitively", () => {
    expect(normalizeTrainingCenterView("week")).toBe("WEEK");
    expect(normalizeTrainingCenterView("WOCHE")).toBe("WEEK");
    expect(normalizeTrainingCenterView("day")).toBe("DAY");
    expect(normalizeTrainingCenterView("Tag")).toBe("DAY");
  });
});
