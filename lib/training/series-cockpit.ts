/**
 * lib/training/series-cockpit.ts
 *
 * TRAINING-SERIES-PREMIUM-01 — weekday-oriented Training Series Cockpit
 * grouping, sorting, and allocation display resolution.
 *
 * Pure functions only — no I/O.
 */

import { classifyFacilityResourceType } from "@/lib/training/allocation-groups";
import type { SeriesCockpitExceptionSummary, SeriesCockpitOccurrenceException } from "@/lib/training/series-cockpit-exceptions";
import { summarizeOccurrenceExceptions } from "@/lib/training/series-cockpit-exceptions";
import type { TrainingAllocationDto, TrainingSeriesDto, TrainingSeriesStatus, Weekday, WeekdayScheduleDto } from "@/lib/training/types";

export const COCKPIT_WEEKDAY_ORDER: Weekday[] = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
];

export const COCKPIT_WEEKDAY_LABELS: Record<Weekday, string> = {
  MONDAY: "Montag",
  TUESDAY: "Dienstag",
  WEDNESDAY: "Mittwoch",
  THURSDAY: "Donnerstag",
  FRIDAY: "Freitag",
  SATURDAY: "Samstag",
  SUNDAY: "Sonntag",
};

export type TrainingSeriesAllocationDisplay = {
  pitchName: string | null;
  dressingRoomName: string | null;
  pitchAllocationId: string | null;
  dressingRoomAllocationId: string | null;
  pitchResourceId: string | null;
  dressingRoomResourceId: string | null;
};

/** Canonical admin route for editing a training series. */
export function buildTrainingSeriesEditHref(seriesId: string): string {
  return `/dashboard/training/series/${seriesId}/edit`;
}

/**
 * Shared desktop grid for the Training Series Cockpit header + rows.
 * Fixed-width exception/status/action columns keep pitch and dressing room
 * aligned across rows regardless of badge content.
 */
export const TRAINING_SERIES_COCKPIT_GRID_CLASS =
  "grid grid-cols-1 md:grid md:grid-cols-[5.5rem_minmax(0,1.15fr)_minmax(6.5rem,0.85fr)_minmax(5rem,0.65fr)_5.75rem_4.5rem_minmax(6.25rem,0.65fr)_1.75rem_1.75rem] md:items-center gap-x-3 gap-y-1.5 md:gap-y-0";

export type TrainingSeriesCockpitRow = {
  rowKey: string;
  seriesId: string;
  teamSeasonId: string;
  teamDisplayName: string;
  weekday: Weekday;
  startsAt: string;
  endsAt: string;
  title: string;
  status: TrainingSeriesStatus;
  planningStage: string;
  validFrom: string | null;
  validUntil: string | null;
  timezone: string;
  /** Full resolved weekday schedules for canonical PUT /api/training-series updates. */
  seriesWeekdaySchedules: WeekdayScheduleDto[];
  sessionCount: number;
  pitchName: string | null;
  dressingRoomName: string | null;
  pitchAllocationId: string | null;
  dressingRoomAllocationId: string | null;
  pitchResourceId: string | null;
  dressingRoomResourceId: string | null;
  occurrenceExceptions: SeriesCockpitExceptionSummary;
};

function compareDressingRoomAllocations(
  a: TrainingAllocationDto,
  b: TrainingAllocationDto,
): number {
  const orderDiff = a.displayOrder - b.displayOrder;
  if (orderDiff !== 0) return orderDiff;
  return a.createdAt.localeCompare(b.createdAt);
}

function resolveDressingRoomAllocations(
  allocations: readonly TrainingAllocationDto[],
): TrainingAllocationDto[] {
  const dressingRooms = allocations
    .filter((allocation) => classifyFacilityResourceType(allocation.facilityResourceType) === "DRESSING_ROOM")
    .sort(compareDressingRoomAllocations);

  const seen = new Set<string>();
  const deduped: TrainingAllocationDto[] = [];
  for (const allocation of dressingRooms) {
    if (seen.has(allocation.facilityResourceId)) continue;
    seen.add(allocation.facilityResourceId);
    deduped.push(allocation);
  }
  return deduped;
}

export function formatDressingRoomDisplayNames(allocations: readonly TrainingAllocationDto[]): string | null {
  const names = resolveDressingRoomAllocations(allocations)
    .map((allocation) => allocation.facilityResourceName.trim())
    .filter((name) => name.length > 0);
  return names.length > 0 ? names.join(" · ") : null;
}

export function resolveSeriesAllocationDisplay(
  allocations: readonly TrainingAllocationDto[],
): TrainingSeriesAllocationDisplay {
  const pitch = allocations.find(
    (allocation) => classifyFacilityResourceType(allocation.facilityResourceType) === "PITCH_HALL",
  );
  const dressingRooms = resolveDressingRoomAllocations(allocations);
  const primaryDressingRoom = dressingRooms[0];

  return {
    pitchName: pitch?.facilityResourceName ?? null,
    dressingRoomName: formatDressingRoomDisplayNames(allocations),
    pitchAllocationId: pitch?.id ?? null,
    dressingRoomAllocationId: primaryDressingRoom?.id ?? null,
    pitchResourceId: pitch?.facilityResourceId ?? null,
    dressingRoomResourceId: primaryDressingRoom?.facilityResourceId ?? null,
  };
}

export function buildTrainingSeriesCockpitRows(input: {
  series: readonly TrainingSeriesDto[];
  teamDisplayNameByTeamSeasonId: ReadonlyMap<string, string>;
  allocationsBySeriesId: ReadonlyMap<string, readonly TrainingAllocationDto[]>;
  occurrenceExceptionsByRowKey?: ReadonlyMap<string, readonly SeriesCockpitOccurrenceException[]>;
}): TrainingSeriesCockpitRow[] {
  const rows: TrainingSeriesCockpitRow[] = [];

  for (const series of input.series) {
    const teamDisplayName = input.teamDisplayNameByTeamSeasonId.get(series.teamSeasonId) ?? "—";
    const allocationDisplay = resolveSeriesAllocationDisplay(
      input.allocationsBySeriesId.get(series.id) ?? [],
    );

    for (const schedule of series.weekdaySchedules) {
      rows.push({
        rowKey: `${series.id}:${schedule.weekday}`,
        seriesId: series.id,
        teamSeasonId: series.teamSeasonId,
        teamDisplayName,
        weekday: schedule.weekday,
        startsAt: schedule.startsAt,
        endsAt: schedule.endsAt,
        title: series.title,
        status: series.status,
        planningStage: series.planningStage,
        validFrom: series.validFrom,
        validUntil: series.validUntil,
        timezone: series.timezone,
        seriesWeekdaySchedules: series.weekdaySchedules,
        sessionCount: series.sessionCount,
        ...allocationDisplay,
        occurrenceExceptions: summarizeOccurrenceExceptions(
          input.occurrenceExceptionsByRowKey?.get(`${series.id}:${schedule.weekday}`),
        ),
      });
    }
  }

  return sortTrainingSeriesCockpitRows(rows);
}

export function sortTrainingSeriesCockpitRows(rows: TrainingSeriesCockpitRow[]): TrainingSeriesCockpitRow[] {
  return [...rows].sort((a, b) => {
    const weekdayDiff = COCKPIT_WEEKDAY_ORDER.indexOf(a.weekday) - COCKPIT_WEEKDAY_ORDER.indexOf(b.weekday);
    if (weekdayDiff !== 0) return weekdayDiff;
    const timeDiff = a.startsAt.localeCompare(b.startsAt);
    if (timeDiff !== 0) return timeDiff;
    const titleDiff = a.title.localeCompare(b.title, "de-CH");
    if (titleDiff !== 0) return titleDiff;
    return a.seriesId.localeCompare(b.seriesId);
  });
}

export function groupCockpitRowsByWeekday(
  rows: readonly TrainingSeriesCockpitRow[],
): { weekday: Weekday; label: string; rows: TrainingSeriesCockpitRow[] }[] {
  const grouped = new Map<Weekday, TrainingSeriesCockpitRow[]>();

  for (const row of rows) {
    const bucket = grouped.get(row.weekday) ?? [];
    bucket.push(row);
    grouped.set(row.weekday, bucket);
  }

  return COCKPIT_WEEKDAY_ORDER.flatMap((weekday) => {
    const weekdayRows = grouped.get(weekday);
    if (!weekdayRows || weekdayRows.length === 0) return [];
    return [{ weekday, label: COCKPIT_WEEKDAY_LABELS[weekday], rows: weekdayRows }];
  });
}
