/**
 * lib/training/series-cockpit-exceptions.ts
 *
 * TRAININGCENTER-EDIT-01B — occurrence allocation exception metadata for the
 * weekday Training Series Cockpit. Pure functions only — no I/O.
 */

import {
  classifyFacilityResourceType,
  TRAINING_ALLOCATION_GROUP_LABELS,
  type TrainingAllocationGroupKey,
} from "@/lib/training/allocation-groups";
import type { Weekday } from "@/lib/training/types";

export type SeriesCockpitExceptionOverride = {
  group: Extract<TrainingAllocationGroupKey, "PITCH_HALL" | "DRESSING_ROOM">;
  groupLabel: string;
  effectiveResourceName: string;
  seriesDefaultResourceName: string | null;
};

export type SeriesCockpitOccurrenceException = {
  sessionId: string;
  /** Effective calendar date "YYYY-MM-DD". */
  date: string;
  /** Effective start time "HH:mm" in the occurrence timezone. */
  startsAt: string;
  /** Effective end time "HH:mm" in the occurrence timezone. */
  endsAt: string;
  overrides: SeriesCockpitExceptionOverride[];
};

export type SeriesCockpitExceptionSummary = {
  /** Occurrence-based count — one session with multiple resource overrides still counts as 1. */
  occurrenceExceptionCount: number;
  exceptions: SeriesCockpitOccurrenceException[];
};

type AllocationResourceRow = {
  facilityResourceId: string;
  facilityResource: { name: string; type: string };
};

type SessionExceptionSource = {
  id: string;
  trainingSeriesId: string;
  weekday: Weekday;
  date: Date;
  overrideDate: Date | null;
  overrideStartAt: Date | null;
  overrideEndAt: Date | null;
  startAt: Date;
  endAt: Date;
  timezone: string;
  sessionAllocations: readonly AllocationResourceRow[];
  trainingSeries: {
    allocations: readonly AllocationResourceRow[];
  };
};

function formatDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function formatWallTime(iso: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: timezone,
  }).format(iso);
}

function pickPrimaryResourceName(
  rows: readonly AllocationResourceRow[],
  group: Extract<TrainingAllocationGroupKey, "PITCH_HALL" | "DRESSING_ROOM">,
): string | null {
  const match = rows.find((row) => classifyFacilityResourceType(row.facilityResource.type) === group);
  return match?.facilityResource.name ?? null;
}

function resolveEffectiveDate(session: SessionExceptionSource): string {
  return formatDateKey(session.overrideDate ?? session.date);
}

function resolveEffectiveStartAt(session: SessionExceptionSource): Date {
  return session.overrideStartAt ?? session.startAt;
}

function resolveEffectiveEndAt(session: SessionExceptionSource): Date {
  return session.overrideEndAt ?? session.endAt;
}

function buildOverridesForSession(session: SessionExceptionSource): SeriesCockpitExceptionOverride[] {
  const overrides: SeriesCockpitExceptionOverride[] = [];
  const groups: Extract<TrainingAllocationGroupKey, "PITCH_HALL" | "DRESSING_ROOM">[] = [
    "PITCH_HALL",
    "DRESSING_ROOM",
  ];

  for (const group of groups) {
    const sessionRows = session.sessionAllocations.filter(
      (row) => classifyFacilityResourceType(row.facilityResource.type) === group,
    );
    if (sessionRows.length === 0) continue;

    const effectiveName = pickPrimaryResourceName(sessionRows, group);
    if (!effectiveName) continue;

    overrides.push({
      group,
      groupLabel: TRAINING_ALLOCATION_GROUP_LABELS[group],
      effectiveResourceName: effectiveName,
      seriesDefaultResourceName: pickPrimaryResourceName(session.trainingSeries.allocations, group),
    });
  }

  return overrides;
}

export function buildSeriesCockpitRowKey(seriesId: string, weekday: Weekday): string {
  return `${seriesId}:${weekday}`;
}

/**
 * Builds an index keyed by cockpit row (`seriesId:weekday`) to the relevant
 * occurrence allocation exceptions for that recurring slot.
 */
export function buildOccurrenceExceptionIndex(
  sessions: readonly SessionExceptionSource[],
  timezone: string,
): Map<string, SeriesCockpitOccurrenceException[]> {
  const index = new Map<string, SeriesCockpitOccurrenceException[]>();

  for (const session of sessions) {
    const overrides = buildOverridesForSession(session);
    if (overrides.length === 0) continue;

    const rowKey = buildSeriesCockpitRowKey(session.trainingSeriesId, session.weekday);
    const entry: SeriesCockpitOccurrenceException = {
      sessionId: session.id,
      date: resolveEffectiveDate(session),
      startsAt: formatWallTime(resolveEffectiveStartAt(session), session.timezone || timezone),
      endsAt: formatWallTime(resolveEffectiveEndAt(session), session.timezone || timezone),
      overrides,
    };

    const bucket = index.get(rowKey) ?? [];
    bucket.push(entry);
    index.set(rowKey, bucket);
  }

  for (const [key, entries] of index) {
    entries.sort((a, b) => a.date.localeCompare(b.date) || a.startsAt.localeCompare(b.startsAt));
    index.set(key, entries);
  }

  return index;
}

export function summarizeOccurrenceExceptions(
  exceptions: readonly SeriesCockpitOccurrenceException[] | undefined,
): SeriesCockpitExceptionSummary {
  const list = exceptions ?? [];
  return {
    occurrenceExceptionCount: list.length,
    exceptions: [...list],
  };
}

export function countSeriesOccurrenceExceptions(
  index: ReadonlyMap<string, readonly SeriesCockpitOccurrenceException[]>,
  seriesId: string,
): number {
  let count = 0;
  for (const [key, exceptions] of index) {
    if (key.startsWith(`${seriesId}:`)) {
      count += exceptions.length;
    }
  }
  return count;
}
