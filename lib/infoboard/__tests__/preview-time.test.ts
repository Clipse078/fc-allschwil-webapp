import { describe, expect, it } from "vitest";
import {
  formatPreviewMoment,
  parseInfoboardPreviewMoment,
} from "@/lib/infoboard/preview-time";

describe("Infoboard Preview Studio time handling", () => {
  const fallback = new Date("2026-08-26T16:35:00.000Z");

  it("interprets URL wall-clock values in Europe/Zurich", () => {
    const result = parseInfoboardPreviewMoment(
      { screen: "2", date: "2026-08-29", time: "08:30" },
      "Europe/Zurich",
      fallback,
    );
    expect(result.screen).toBe("2");
    expect(result.now.toISOString()).toBe("2026-08-29T06:30:00.000Z");
  });

  it("falls back safely for invalid screen, date, and time values", () => {
    const result = parseInfoboardPreviewMoment(
      { screen: "admin", date: "2026-02-31", time: "25:90" },
      "Europe/Zurich",
      fallback,
    );
    expect(result).toMatchObject({
      screen: "1",
      date: "2026-08-26",
      time: "18:35",
      now: fallback,
    });
  });

  it("formats day-boundary changes in the tenant timezone", () => {
    expect(
      formatPreviewMoment(
        new Date("2026-08-26T22:05:00.000Z"),
        "Europe/Zurich",
      ),
    ).toEqual({ date: "2026-08-27", time: "00:05" });
  });
});
