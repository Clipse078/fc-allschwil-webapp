import { describe, expect, it, vi, afterEach } from "vitest";
import {
  BEFORE_MORNING_SEGMENT,
  PRIMARY_DAY_SEGMENTS,
  activityOverlapsSegment,
  blockSegmentFragment,
  buildDaySegmentTimeline,
  buildMajorTimelineTicks,
  buildMinorTimelineMarkers,
  buildSnapTimelineTicks,
  hasPreMorningActivity,
  listAvailableDaySegments,
  minutesToPercent,
  resolveDefaultDaySegment,
} from "../day-segments";
import { makeSession } from "./fixtures";

const TZ = "Europe/Zurich";

describe("day segments", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("exposes four primary day segments", () => {
    expect(PRIMARY_DAY_SEGMENTS).toHaveLength(4);
    expect(PRIMARY_DAY_SEGMENTS.map((segment) => segment.label)).toEqual([
      "08:00–12:00",
      "12:00–16:00",
      "16:00–20:00",
      "20:00–00:00",
    ]);
  });

  it("builds a 4-hour segment timeline with 15-minute precision", () => {
    const timeline = buildDaySegmentTimeline("16-20");
    expect(timeline).toEqual({ gridStartMinutes: 16 * 60, gridEndMinutes: 20 * 60, slotMinutes: 15 });
    expect(buildSnapTimelineTicks(timeline)).toEqual([960, 975, 990, 1005, 1020, 1035, 1050, 1065, 1080, 1095, 1110, 1125, 1140, 1155, 1170, 1185, 1200]);
  });

  it("renders major hour labels and 30-minute minor markers", () => {
    const timeline = buildDaySegmentTimeline("16-20");
    expect(buildMajorTimelineTicks(timeline).map((m) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`)).toEqual([
      "16:00",
      "17:00",
      "18:00",
      "19:00",
      "20:00",
    ]);
    expect(buildMinorTimelineMarkers(timeline)).toEqual([990, 1050, 1110, 1170]);
  });

  it("positions 17:15–18:45 correctly within 16:00–20:00", () => {
    const block = makeSession({
      startAt: "2026-09-02T15:15:00.000Z",
      endAt: "2026-09-02T16:45:00.000Z",
    });
    const fragment = blockSegmentFragment(block, "16-20", TZ);
    expect(fragment).toEqual({
      leftPercent: 31.25,
      widthPercent: 37.5,
      continuesBefore: false,
      continuesAfter: false,
    });
  });

  it("uses the same scale for header ticks and block geometry", () => {
    const timeline = buildDaySegmentTimeline("16-20");
    const block = makeSession({
      startAt: "2026-09-02T15:15:00.000Z",
      endAt: "2026-09-02T16:45:00.000Z",
    });
    const fragment = blockSegmentFragment(block, "16-20", TZ)!;
    expect(minutesToPercent(17 * 60 + 15, timeline)).toBe(fragment.leftPercent);
    expect(minutesToPercent(18 * 60 + 45, timeline) - minutesToPercent(17 * 60 + 15, timeline)).toBe(fragment.widthPercent);
  });

  it("clips cross-segment activities without duplicating domain state", () => {
    const block = makeSession({
      id: "cross-segment",
      startAt: "2026-09-02T17:30:00.000Z",
      endAt: "2026-09-02T18:30:00.000Z",
    });

    const evening = blockSegmentFragment(block, "16-20", TZ);
    const night = blockSegmentFragment(block, "20-00", TZ);

    expect(evening).toMatchObject({
      continuesAfter: true,
      continuesBefore: false,
    });
    expect(night).toMatchObject({
      continuesBefore: true,
      continuesAfter: false,
    });
    expect(evening!.leftPercent).toBeGreaterThan(80);
    expect(night!.leftPercent).toBe(0);
  });

  it("selects current-time segment when viewing today", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-02T14:30:00.000Z"));

    const segment = resolveDefaultDaySegment({
      date: "2026-09-02",
      blocks: [],
      timeZone: TZ,
    });

    expect(segment).toBe("16-20");
  });

  it("selects segment from earliest activity when not today", () => {
    const block = makeSession({
      date: "2026-09-03",
      startAt: "2026-09-03T08:30:00.000Z",
      endAt: "2026-09-03T09:30:00.000Z",
    });

    const segment = resolveDefaultDaySegment({
      date: "2026-09-03",
      blocks: [block],
      now: new Date("2026-09-02T12:00:00.000Z"),
      timeZone: TZ,
    });

    expect(segment).toBe("08-12");
  });

  it("uses neutral midday default on empty days", () => {
    const segment = resolveDefaultDaySegment({
      date: "2026-09-03",
      blocks: [],
      now: new Date("2026-09-02T12:00:00.000Z"),
      timeZone: TZ,
    });
    expect(segment).toBe("12-16");
  });

  it("exposes Vor 08:00 only when pre-morning activity exists", () => {
    const earlyBlock = makeSession({
      startAt: "2026-09-02T04:00:00.000Z",
      endAt: "2026-09-02T05:00:00.000Z",
    });

    expect(hasPreMorningActivity([earlyBlock], TZ)).toBe(true);
    const segments = listAvailableDaySegments([earlyBlock], TZ);
    expect(segments[0]).toEqual(BEFORE_MORNING_SEGMENT);
    expect(segments).toHaveLength(5);

    const defaultSegment = resolveDefaultDaySegment({
      date: "2026-09-03",
      blocks: [earlyBlock],
      timeZone: TZ,
    });
    expect(defaultSegment).toBe("before-08");
  });

  it("respects explicit daypart URL param when valid", () => {
    const segment = resolveDefaultDaySegment({
      date: "2026-09-02",
      blocks: [makeSession()],
      daypartParam: "08-12",
      timeZone: TZ,
    });
    expect(segment).toBe("08-12");
  });

  it("detects segment overlap for filtering", () => {
    const block = makeSession({
      startAt: "2026-09-02T15:15:00.000Z",
      endAt: "2026-09-02T16:45:00.000Z",
    });
    expect(activityOverlapsSegment(block.startAt, block.endAt, "16-20", TZ)).toBe(true);
    expect(activityOverlapsSegment(block.startAt, block.endAt, "08-12", TZ)).toBe(false);
  });
});
