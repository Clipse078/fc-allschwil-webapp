import { describe, expect, it } from "vitest";
import { getSeasonCurrentStatus } from "@/lib/seasons/status";

describe("getSeasonCurrentStatus", () => {
  it("is AKTUELL whenever isActive is true, regardless of dates", () => {
    expect(
      getSeasonCurrentStatus({
        isActive: true,
        endDate: new Date("2000-01-01T00:00:00Z"), // long past
        now: new Date("2026-08-10T00:00:00Z"),
      }),
    ).toBe("AKTUELL");
  });

  it("is VERGANGEN when not active and the end date is in the past", () => {
    expect(
      getSeasonCurrentStatus({
        isActive: false,
        endDate: new Date("2025-06-30T00:00:00Z"),
        now: new Date("2026-08-10T00:00:00Z"),
      }),
    ).toBe("VERGANGEN");
  });

  it("is ZUKUENFTIG when not active and the end date is not yet in the past — even if the date range covers 'today'", () => {
    // A Season whose calendar dates say "ongoing" but that the admin has
    // not explicitly chosen as current is ZUKUENFTIG, never AKTUELL.
    expect(
      getSeasonCurrentStatus({
        isActive: false,
        endDate: new Date("2027-06-30T00:00:00Z"),
        now: new Date("2026-08-10T00:00:00Z"),
      }),
    ).toBe("ZUKUENFTIG");
  });
});
