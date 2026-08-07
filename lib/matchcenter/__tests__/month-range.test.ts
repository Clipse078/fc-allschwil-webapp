import { describe, expect, it } from "vitest";
import {
  formatMonthLabel,
  formatMonthParam,
  parseMonthParam,
  resolveMatchcenterMonthWindow,
} from "../month-range";

describe("parseMonthParam", () => {
  it("parses a valid YYYY-MM param", () => {
    expect(parseMonthParam("2026-08")).toEqual({ year: 2026, month: 8 });
  });

  it("returns null for malformed input", () => {
    expect(parseMonthParam("2026-13")).toBeNull();
    expect(parseMonthParam("not-a-month")).toBeNull();
    expect(parseMonthParam(null)).toBeNull();
    expect(parseMonthParam(undefined)).toBeNull();
    expect(parseMonthParam("")).toBeNull();
  });
});

describe("formatMonthParam", () => {
  it("pads month and year", () => {
    expect(formatMonthParam({ year: 2026, month: 8 })).toBe("2026-08");
    expect(formatMonthParam({ year: 2026, month: 1 })).toBe("2026-01");
  });
});

describe("resolveMatchcenterMonthWindow", () => {
  it("defaults to the current month (Europe/Zurich) when no param is given", () => {
    const window = resolveMatchcenterMonthWindow({
      now: new Date("2026-08-07T22:00:00.000Z"), // late evening UTC — still Aug 8 CEST
      timeZone: "Europe/Zurich",
    });

    expect(window.param).toBe("2026-08");
  });

  it("resolves a stable [from, to] window for a given month, Europe/Zurich", () => {
    const window = resolveMatchcenterMonthWindow({
      monthParam: "2026-08",
      timeZone: "Europe/Zurich",
    });

    // Aug 1 2026 00:00 CEST (+2h) == July 31 2026 22:00 UTC
    expect(window.from.toISOString()).toBe("2026-07-31T22:00:00.000Z");
    // Sep 1 2026 00:00 CEST (+2h) minus 1ms == Aug 31 2026 21:59:59.999 UTC
    expect(window.to.toISOString()).toBe("2026-08-31T21:59:59.999Z");
  });

  it("honors DST transitions across the winter boundary (October → November)", () => {
    const window = resolveMatchcenterMonthWindow({
      monthParam: "2026-10",
      timeZone: "Europe/Zurich",
    });

    // Oct 1 2026 00:00 CEST (+2h)
    expect(window.from.toISOString()).toBe("2026-09-30T22:00:00.000Z");
    // Nov 1 2026 00:00 CET (+1h) minus 1ms (DST ends last Sunday of October)
    expect(window.to.toISOString()).toBe("2026-10-31T22:59:59.999Z");
  });

  it("computes correct previous/next month params, including year rollover", () => {
    const window = resolveMatchcenterMonthWindow({ monthParam: "2026-12" });
    expect(window.previousParam).toBe("2026-11");
    expect(window.nextParam).toBe("2027-01");

    const januaryWindow = resolveMatchcenterMonthWindow({
      monthParam: "2027-01",
    });
    expect(januaryWindow.previousParam).toBe("2026-12");
    expect(januaryWindow.nextParam).toBe("2027-02");
  });

  it("falls back to the current month for a malformed param", () => {
    const window = resolveMatchcenterMonthWindow({
      monthParam: "garbage",
      now: new Date("2026-08-07T12:00:00.000Z"),
      timeZone: "Europe/Zurich",
    });

    expect(window.param).toBe("2026-08");
  });
});

describe("formatMonthLabel", () => {
  it("renders a German long month label", () => {
    expect(formatMonthLabel({ year: 2026, month: 8 }, "de-CH")).toBe(
      "August 2026",
    );
  });
});
