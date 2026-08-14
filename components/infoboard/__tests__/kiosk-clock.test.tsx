/**
 * @vitest-environment jsdom
 */

/**
 * INFOBOARD-CLOCK-01 — Focused tests for the live kiosk clock.
 *
 * Covers:
 *   - correct HH:mm formatting
 *   - Europe/Zurich timezone behavior (summer UTC+2 / winter UTC+1)
 *   - clock advances after time changes (interval fires)
 *   - date changes after midnight
 *   - hidden time/date configuration remains respected (via LiveClockScreen1)
 *   - cleanup on unmount
 */

import { renderHook, act, render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  useKioskClock,
  formatKioskTime,
  formatKioskWeekday,
  formatKioskDateLine,
} from "@/components/infoboard/kiosk-clock";
import { LiveClockScreen1 } from "@/components/infoboard/screen1/LiveClockScreen1";

// ── formatKioskTime ────────────────────────────────────────────────────────────

describe("formatKioskTime — correct HH:mm formatting", () => {
  it("formats HH:mm in Europe/Zurich summer (UTC+2)", () => {
    expect(formatKioskTime("2026-08-14T08:30:00.000Z", "Europe/Zurich")).toBe("10:30");
  });

  it("formats HH:mm in Europe/Zurich winter (UTC+1)", () => {
    expect(formatKioskTime("2026-01-14T08:30:00.000Z", "Europe/Zurich")).toBe("09:30");
  });

  it("uses 24-hour format — afternoon", () => {
    expect(formatKioskTime("2026-08-14T14:05:00.000Z", "Europe/Zurich")).toBe("16:05");
  });

  it("renders 00:00 at local midnight", () => {
    // 2026-08-13 22:00 UTC = 2026-08-14 00:00 Europe/Zurich (UTC+2)
    expect(formatKioskTime("2026-08-13T22:00:00.000Z", "Europe/Zurich")).toBe("00:00");
  });

  it("pads single-digit hours with leading zero", () => {
    // 06:05 in Zurich (UTC+2) = 04:05 UTC
    expect(formatKioskTime("2026-08-14T04:05:00.000Z", "Europe/Zurich")).toBe("06:05");
  });
});

// ── formatKioskWeekday ────────────────────────────────────────────────────────

describe("formatKioskWeekday — Europe/Zurich timezone behavior", () => {
  it("returns German weekday name (Samstag for Saturday)", () => {
    // 2026-09-12 is a Saturday
    const result = formatKioskWeekday("2026-09-12T08:30:00.000Z", "Europe/Zurich");
    expect(result).toBe("Samstag");
  });

  it("returns German weekday for local date in Zurich timezone", () => {
    // 2026-08-14 is a Friday; 08:00 UTC = 10:00 Zurich (summer)
    const result = formatKioskWeekday("2026-08-14T08:00:00.000Z", "Europe/Zurich");
    expect(result).toBe("Freitag");
  });

  it("resolves weekday in Zurich timezone (not UTC)", () => {
    // 2026-08-14 23:30 UTC = 2026-08-15 01:30 Zurich — a Saturday
    const result = formatKioskWeekday("2026-08-14T23:30:00.000Z", "Europe/Zurich");
    expect(result).toBe("Samstag");
  });
});

// ── formatKioskDateLine ───────────────────────────────────────────────────────

describe("formatKioskDateLine — date changes after midnight", () => {
  it("formats date in Europe/Zurich (summer)", () => {
    const result = formatKioskDateLine("2026-08-14T08:30:00.000Z", "Europe/Zurich");
    expect(result).toMatch(/14/);
    expect(result).toMatch(/August/);
    expect(result).toMatch(/2026/);
  });

  it("date rolls over correctly at midnight in Europe/Zurich (summer)", () => {
    // 2026-08-14 21:59 UTC = 2026-08-14 23:59 Zurich — still Aug 14
    const beforeMidnight = formatKioskDateLine("2026-08-14T21:59:00.000Z", "Europe/Zurich");
    // 2026-08-14 22:00 UTC = 2026-08-15 00:00 Zurich — now Aug 15
    const afterMidnight = formatKioskDateLine("2026-08-14T22:00:00.000Z", "Europe/Zurich");
    expect(beforeMidnight).toMatch(/14/);
    expect(afterMidnight).toMatch(/15/);
  });

  it("date rolls over correctly at midnight in Europe/Zurich (winter)", () => {
    // 2026-01-14 22:59 UTC = 2026-01-14 23:59 Zurich (UTC+1) — still Jan 14
    const beforeMidnight = formatKioskDateLine("2026-01-14T22:59:00.000Z", "Europe/Zurich");
    // 2026-01-14 23:00 UTC = 2026-01-15 00:00 Zurich (UTC+1) — now Jan 15
    const afterMidnight = formatKioskDateLine("2026-01-14T23:00:00.000Z", "Europe/Zurich");
    expect(beforeMidnight).toMatch(/14/);
    expect(afterMidnight).toMatch(/15/);
  });

  it("resolves date in Zurich timezone (not UTC)", () => {
    // 2026-08-14 23:30 UTC = 2026-08-15 01:30 Zurich — should show Aug 15
    const result = formatKioskDateLine("2026-08-14T23:30:00.000Z", "Europe/Zurich");
    expect(result).toMatch(/15/);
  });
});

// ── useKioskClock ──────────────────────────────────────────────────────────────

describe("useKioskClock — clock advances after time changes", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns initialTimeIso on first render (hydration-safe)", () => {
    const initialTimeIso = "2026-08-14T08:05:00.000Z";
    const { result } = renderHook(() => useKioskClock(initialTimeIso));
    expect(result.current).toBe(initialTimeIso);
  });

  it("syncs to real client time after 1 second", () => {
    const initialTimeIso = "2026-08-14T08:05:00.000Z";
    vi.setSystemTime(new Date("2026-08-14T10:17:00.000Z"));

    const { result } = renderHook(() => useKioskClock(initialTimeIso));
    expect(result.current).toBe(initialTimeIso);

    act(() => {
      vi.advanceTimersByTime(1_001);
    });

    // Now reflects the real client time (compare formatted minutes, not raw ISO)
    expect(formatKioskTime(result.current, "Europe/Zurich")).toBe("12:17");
  });

  it("updates again when the 30 s interval fires", () => {
    const initialTimeIso = "2026-08-14T08:05:00.000Z";
    vi.setSystemTime(new Date("2026-08-14T10:17:00.000Z"));

    const { result } = renderHook(() => useKioskClock(initialTimeIso));

    // Advance past 1 s sync
    act(() => { vi.advanceTimersByTime(1_001); });
    expect(formatKioskTime(result.current, "Europe/Zurich")).toBe("12:17");

    // Advance 30 s; update fake time
    vi.setSystemTime(new Date("2026-08-14T10:18:00.000Z"));
    act(() => { vi.advanceTimersByTime(30_000); });

    expect(formatKioskTime(result.current, "Europe/Zurich")).toBe("12:18");
  });

  it("updates display minute after the 1 s sync (no 30-minute freeze)", () => {
    // Simulates kiosk opened at 10:05 Zurich, real time is 10:17 Zurich
    const initialTimeIso = "2026-08-14T08:05:00.000Z"; // 10:05 Zurich (UTC+2)
    vi.setSystemTime(new Date("2026-08-14T08:17:00.000Z")); // 10:17 Zurich (UTC+2)

    const { result } = renderHook(() => useKioskClock(initialTimeIso));
    expect(formatKioskTime(result.current, "Europe/Zurich")).toBe("10:05");

    act(() => { vi.advanceTimersByTime(1_001); });
    expect(formatKioskTime(result.current, "Europe/Zurich")).toBe("10:17");
  });

  it("date changes after midnight when clock ticks past midnight in Europe/Zurich", () => {
    const initialTimeIso = "2026-08-14T21:55:00.000Z"; // 23:55 Zurich
    vi.setSystemTime(new Date("2026-08-14T22:01:00.000Z")); // 00:01 next day in Zurich

    const { result } = renderHook(() => useKioskClock(initialTimeIso));

    act(() => { vi.advanceTimersByTime(1_001); });

    const dateLine = formatKioskDateLine(result.current, "Europe/Zurich");
    expect(dateLine).toMatch(/15/); // Now shows August 15
  });

  it("cleans up both timeout and interval on unmount", () => {
    const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout");
    const clearIntervalSpy = vi.spyOn(globalThis, "clearInterval");

    const { unmount } = renderHook(() =>
      useKioskClock("2026-08-14T08:05:00.000Z"),
    );
    unmount();

    expect(clearTimeoutSpy).toHaveBeenCalled();
    expect(clearIntervalSpy).toHaveBeenCalled();
  });
});

// ── LiveClockScreen1 — hidden time/date configuration ─────────────────────────

describe("LiveClockScreen1 — hidden time/date configuration remains respected", () => {
  const INITIAL_ISO = "2026-09-12T08:30:00.000Z"; // 10:30 Europe/Zurich (summer)
  const TZ = "Europe/Zurich";

  it("renders time when showTime=true and showDate=false", () => {
    render(
      <LiveClockScreen1
        initialTimeIso={INITIAL_ISO}
        timezone={TZ}
        showTime={true}
        showDate={false}
      />,
    );
    const timeEl = document.querySelector("time");
    expect(timeEl).not.toBeNull();
    expect(timeEl?.textContent).toContain("10:30");
  });

  it("does not render date separator or date block when showDate=false", () => {
    const { container } = render(
      <LiveClockScreen1
        initialTimeIso={INITIAL_ISO}
        timezone={TZ}
        showTime={true}
        showDate={false}
      />,
    );
    expect(container.textContent).not.toContain("|");
    expect(container.textContent).not.toContain("September");
  });

  it("renders both time and date when showTime=true and showDate=true", () => {
    const { container } = render(
      <LiveClockScreen1
        initialTimeIso={INITIAL_ISO}
        timezone={TZ}
        showTime={true}
        showDate={true}
      />,
    );
    expect(container.textContent).toContain("10:30");
    expect(container.textContent).toContain("Samstag");
    expect(container.textContent).toContain("September");
  });

  it("renders only date (fallback style) when showTime=false and showDate=true", () => {
    const { container } = render(
      <LiveClockScreen1
        initialTimeIso={INITIAL_ISO}
        timezone={TZ}
        showTime={false}
        showDate={true}
      />,
    );
    expect(container.querySelector("time")).toBeNull();
    expect(container.textContent).toContain("September");
  });

  it("renders nothing when both showTime=false and showDate=false", () => {
    const { container } = render(
      <LiveClockScreen1
        initialTimeIso={INITIAL_ISO}
        timezone={TZ}
        showTime={false}
        showDate={false}
      />,
    );
    expect(container.firstChild).toBeNull();
  });
});
