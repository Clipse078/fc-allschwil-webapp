/**
 * lib/transport/__tests__/transport-wait-time.test.ts
 */

import { describe, expect, it } from "vitest";
import {
  computeMinutesUntil,
  formatRelativeWaitLabel,
  resolveWaitTimeTone,
  WAIT_TIME_MEDIUM_MAX_MINUTES,
  WAIT_TIME_SOON_MAX_MINUTES,
} from "@/lib/transport/transport-wait-time";

describe("resolveWaitTimeTone", () => {
  it("uses soon for Jetzt and 1–5 minutes", () => {
    expect(resolveWaitTimeTone(0)).toBe("soon");
    expect(resolveWaitTimeTone(1)).toBe("soon");
    expect(resolveWaitTimeTone(5)).toBe("soon");
  });

  it("uses medium for 6–15 minutes", () => {
    expect(resolveWaitTimeTone(6)).toBe("medium");
    expect(resolveWaitTimeTone(15)).toBe("medium");
  });

  it("uses long for 16+ minutes", () => {
    expect(resolveWaitTimeTone(16)).toBe("long");
    expect(resolveWaitTimeTone(30)).toBe("long");
  });

  it("documents the expected threshold constants", () => {
    expect(WAIT_TIME_SOON_MAX_MINUTES).toBe(5);
    expect(WAIT_TIME_MEDIUM_MAX_MINUTES).toBe(15);
  });
});

describe("formatRelativeWaitLabel", () => {
  it("formats Jetzt for zero or negative waits", () => {
    expect(formatRelativeWaitLabel(0)).toBe("Jetzt");
    expect(formatRelativeWaitLabel(-2)).toBe("Jetzt");
  });

  it("formats positive waits as N min", () => {
    expect(formatRelativeWaitLabel(3)).toBe("3 min");
    expect(formatRelativeWaitLabel(20)).toBe("20 min");
  });
});

describe("computeMinutesUntil", () => {
  it("rounds to whole minutes and never returns negative values", () => {
    const nowMs = Date.parse("2026-09-02T16:40:00.000Z");
    const departureMs = Date.parse("2026-09-02T16:42:30.000Z");

    expect(computeMinutesUntil(departureMs, nowMs)).toBe(3);
    expect(computeMinutesUntil(nowMs, nowMs)).toBe(0);
  });
});
