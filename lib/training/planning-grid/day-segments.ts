/**
 * lib/training/planning-grid/day-segments.ts
 *
 * Operational day-part (Tagesabschnitt) model for the planning grid.
 * Four primary 4-hour segments replace the compressed full-day timeline.
 */

import type { PlanningGridTimeline } from "./types";
import { formatTimelineLabel, parseTimeToMinutes } from "./projection";

export const DAY_SEGMENT_SLOT_MINUTES = 15;

export type PrimaryDaySegmentKey = "08-12" | "12-16" | "16-20" | "20-00";
export type DaySegmentKey = PrimaryDaySegmentKey | "before-08";

export type DaySegmentDefinition = {
  key: DaySegmentKey;
  startMinutes: number;
  endMinutes: number;
  label: string;
};

export const PRIMARY_DAY_SEGMENTS: readonly DaySegmentDefinition[] = [
  { key: "08-12", startMinutes: 8 * 60, endMinutes: 12 * 60, label: "08:00–12:00" },
  { key: "12-16", startMinutes: 12 * 60, endMinutes: 16 * 60, label: "12:00–16:00" },
  { key: "16-20", startMinutes: 16 * 60, endMinutes: 20 * 60, label: "16:00–20:00" },
  { key: "20-00", startMinutes: 20 * 60, endMinutes: 24 * 60, label: "20:00–00:00" },
] as const;

export const BEFORE_MORNING_SEGMENT: DaySegmentDefinition = {
  key: "before-08",
  startMinutes: 0,
  endMinutes: 8 * 60,
  label: "Vor 08:00",
};

export function getDaySegmentDefinition(key: DaySegmentKey): DaySegmentDefinition {
  if (key === "before-08") return BEFORE_MORNING_SEGMENT;
  const found = PRIMARY_DAY_SEGMENTS.find((segment) => segment.key === key);
  if (!found) return PRIMARY_DAY_SEGMENTS[1];
  return found;
}

export function isValidDaySegmentKey(value: string | null | undefined): value is DaySegmentKey {
  if (!value) return false;
  if (value === "before-08") return true;
  return PRIMARY_DAY_SEGMENTS.some((segment) => segment.key === value);
}

export function buildDaySegmentTimeline(segment: DaySegmentKey): PlanningGridTimeline {
  const definition = getDaySegmentDefinition(segment);
  return {
    gridStartMinutes: definition.startMinutes,
    gridEndMinutes: definition.endMinutes,
    slotMinutes: DAY_SEGMENT_SLOT_MINUTES,
  };
}

export function minutesToPercent(minutes: number, timeline: PlanningGridTimeline): number {
  const span = timeline.gridEndMinutes - timeline.gridStartMinutes;
  if (span <= 0) return 0;
  return ((minutes - timeline.gridStartMinutes) / span) * 100;
}

/** Major hour labels — every 60 minutes within the segment. */
export function buildMajorTimelineTicks(timeline: PlanningGridTimeline): number[] {
  const ticks: number[] = [];
  for (let m = timeline.gridStartMinutes; m <= timeline.gridEndMinutes; m += 60) {
    ticks.push(m);
  }
  return ticks;
}

/** Subtle 30-minute markers excluding major hour lines. */
export function buildMinorTimelineMarkers(timeline: PlanningGridTimeline): number[] {
  const majors = new Set(buildMajorTimelineTicks(timeline));
  const markers: number[] = [];
  for (let m = timeline.gridStartMinutes; m < timeline.gridEndMinutes; m += 30) {
    if (!majors.has(m)) markers.push(m);
  }
  return markers;
}

/** Internal 15-minute snap grid used for positioning precision. */
export function buildSnapTimelineTicks(timeline: PlanningGridTimeline): number[] {
  const ticks: number[] = [];
  for (let m = timeline.gridStartMinutes; m <= timeline.gridEndMinutes; m += timeline.slotMinutes) {
    ticks.push(m);
  }
  return ticks;
}

export function formatDaySegmentLabel(key: DaySegmentKey): string {
  return getDaySegmentDefinition(key).label;
}

export function activityOverlapsSegment(
  startAt: string,
  endAt: string,
  segment: DaySegmentKey,
  timeZone = "Europe/Zurich",
): boolean {
  const definition = getDaySegmentDefinition(segment);
  const start = parseTimeToMinutes(startAt, timeZone);
  const end = parseTimeToMinutes(endAt, timeZone);
  return start < definition.endMinutes && end > definition.startMinutes;
}

export function hasPreMorningActivity(
  blocks: readonly { startAt: string; endAt: string }[],
  timeZone = "Europe/Zurich",
): boolean {
  return blocks.some((block) => {
    const start = parseTimeToMinutes(block.startAt, timeZone);
    const end = parseTimeToMinutes(block.endAt, timeZone);
    return start < BEFORE_MORNING_SEGMENT.endMinutes && end > BEFORE_MORNING_SEGMENT.startMinutes;
  });
}

export function listAvailableDaySegments(
  blocks: readonly { startAt: string; endAt: string }[],
  timeZone = "Europe/Zurich",
): DaySegmentDefinition[] {
  const segments: DaySegmentDefinition[] = [...PRIMARY_DAY_SEGMENTS];
  if (hasPreMorningActivity(blocks, timeZone)) {
    segments.unshift(BEFORE_MORNING_SEGMENT);
  }
  return segments;
}

function segmentForMinutes(minutes: number): DaySegmentKey {
  for (const segment of PRIMARY_DAY_SEGMENTS) {
    if (minutes >= segment.startMinutes && minutes < segment.endMinutes) {
      return segment.key;
    }
  }
  if (minutes >= 20 * 60) return "20-00";
  if (minutes < 8 * 60) return "08-12";
  return "12-16";
}

export type ResolveDefaultDaySegmentInput = {
  date: string;
  blocks: readonly { startAt: string; endAt: string }[];
  now?: Date;
  timeZone?: string;
  daypartParam?: string | null;
};

/**
 * Default segment selection:
 * 1. Valid explicit daypart URL param
 * 2. Today's current time segment (when viewing today)
 * 3. Segment containing earliest activity
 * 4. Neutral midday default (12:00–16:00)
 */
export function resolveDefaultDaySegment(input: ResolveDefaultDaySegmentInput): DaySegmentKey {
  const timeZone = input.timeZone ?? "Europe/Zurich";
  const available = listAvailableDaySegments(input.blocks, timeZone);

  if (input.daypartParam && isValidDaySegmentKey(input.daypartParam)) {
    if (input.daypartParam === "before-08" && !available.some((s) => s.key === "before-08")) {
      return resolveDefaultDaySegment({ ...input, daypartParam: null });
    }
    return input.daypartParam;
  }

  const now = input.now ?? new Date();
  const todayParam = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);

  if (input.date === todayParam) {
    const currentMinutes = parseTimeToMinutes(now.toISOString(), timeZone);
    if (currentMinutes < BEFORE_MORNING_SEGMENT.endMinutes && available.some((s) => s.key === "before-08")) {
      return "before-08";
    }
    return segmentForMinutes(currentMinutes);
  }

  const scheduled = input.blocks
    .map((block) => ({
      start: parseTimeToMinutes(block.startAt, timeZone),
      end: parseTimeToMinutes(block.endAt, timeZone),
    }))
    .filter((range) => range.end > range.start)
    .sort((a, b) => a.start - b.start);

  if (scheduled.length > 0) {
    const earliest = scheduled[0].start;
    if (earliest < BEFORE_MORNING_SEGMENT.endMinutes && available.some((s) => s.key === "before-08")) {
      return "before-08";
    }
    return segmentForMinutes(earliest);
  }

  return "12-16";
}

export type BlockSegmentFragment = {
  leftPercent: number;
  widthPercent: number;
  continuesBefore: boolean;
  continuesAfter: boolean;
};

/**
 * Maps an activity onto the visible portion within a day segment.
 * Header and blocks must share this geometry.
 */
export function blockSegmentFragment(
  block: Pick<{ startAt: string; endAt: string }, "startAt" | "endAt">,
  segment: DaySegmentKey,
  timeZone = "Europe/Zurich",
): BlockSegmentFragment | null {
  const definition = getDaySegmentDefinition(segment);
  const start = parseTimeToMinutes(block.startAt, timeZone);
  const end = parseTimeToMinutes(block.endAt, timeZone);

  const visibleStart = Math.max(start, definition.startMinutes);
  const visibleEnd = Math.min(end, definition.endMinutes);
  if (visibleEnd <= visibleStart) return null;

  const timeline = buildDaySegmentTimeline(segment);
  const span = timeline.gridEndMinutes - timeline.gridStartMinutes;
  if (span <= 0) return null;

  const leftPercent = ((visibleStart - timeline.gridStartMinutes) / span) * 100;
  const widthPercent = ((visibleEnd - visibleStart) / span) * 100;

  return {
    leftPercent: Math.max(0, Math.min(100, leftPercent)),
    widthPercent: Math.max(1.5, Math.min(100 - leftPercent, widthPercent)),
    continuesBefore: start < definition.startMinutes,
    continuesAfter: end > definition.endMinutes,
  };
}

export { formatTimelineLabel };
