/**
 * lib/training/__tests__/series-cockpit.test.ts
 *
 * TRAINING-SERIES-PREMIUM-01 — weekday grouping and ordering tests.
 */

import { describe, expect, it } from "vitest";
import {
  buildTrainingSeriesCockpitRows,
  groupCockpitRowsByWeekday,
  resolveSeriesAllocationDisplay,
  sortTrainingSeriesCockpitRows,
} from "../series-cockpit";
import type { TrainingAllocationDto, TrainingSeriesDto } from "../types";

function makeSeries(overrides: Partial<TrainingSeriesDto> = {}): TrainingSeriesDto {
  return {
    id: "series-1",
    tenantId: "tenant-a",
    teamSeasonId: "ts-1",
    title: "Junioren E1 Training",
    description: null,
    status: "ACTIVE",
    startsAt: "17:15",
    endsAt: "18:45",
    timezone: "Europe/Zurich",
    weekdays: ["MONDAY"],
    weekdaySchedules: [{ weekday: "MONDAY", startsAt: "17:15", endsAt: "18:45" }],
    validFrom: null,
    validUntil: null,
    archivedAt: null,
    sessionCount: 4,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    planningStage: "APPROVED",
    planningSubmittedAt: null,
    planningSubmittedById: null,
    planningValidatedAt: null,
    planningValidatedById: null,
    createdByUserId: null,
    ...overrides,
  };
}

function makeAllocation(overrides: Partial<TrainingAllocationDto> = {}): TrainingAllocationDto {
  return {
    id: "alloc-1",
    tenantId: "tenant-a",
    trainingSeriesId: "series-1",
    facilityResourceId: "res-1",
    facilityResourceName: "Kunstrasen 3 B",
    facilityResourceCode: "KR3B",
    facilityResourceType: "HALF_PITCH",
    facilityId: "facility-1",
    facilityName: "Sportanlage",
    notes: null,
    displayOrder: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("series cockpit grouping", () => {
  it("groups by weekday and sorts by start time then title", () => {
    const rows = buildTrainingSeriesCockpitRows({
      series: [
        makeSeries({
          id: "series-late",
          title: "Z Training",
          weekdaySchedules: [{ weekday: "MONDAY", startsAt: "19:00", endsAt: "20:00" }],
        }),
        makeSeries({
          id: "series-early",
          title: "A Training",
          weekdaySchedules: [{ weekday: "MONDAY", startsAt: "17:15", endsAt: "18:45" }],
        }),
        makeSeries({
          id: "series-tue",
          title: "D-7 D1 Training",
          weekdaySchedules: [{ weekday: "TUESDAY", startsAt: "17:15", endsAt: "18:45" }],
        }),
      ],
      teamDisplayNameByTeamSeasonId: new Map([["ts-1", "Junioren E1"]]),
      allocationsBySeriesId: new Map(),
    });

    const grouped = groupCockpitRowsByWeekday(rows);
    expect(grouped.map((group) => group.weekday)).toEqual(["MONDAY", "TUESDAY"]);
    expect(grouped[0]?.rows.map((row) => row.seriesId)).toEqual(["series-early", "series-late"]);
  });

  it("exposes pitch and dressing room from canonical series allocations", () => {
    const rows = buildTrainingSeriesCockpitRows({
      series: [makeSeries()],
      teamDisplayNameByTeamSeasonId: new Map([["ts-1", "Junioren D-7 D1"]]),
      allocationsBySeriesId: new Map([
        [
          "series-1",
          [
            makeAllocation({ facilityResourceType: "HALF_PITCH", facilityResourceName: "Kunstrasen 3 B" }),
            makeAllocation({
              id: "alloc-room",
              facilityResourceId: "res-room",
              facilityResourceType: "DRESSING_ROOM",
              facilityResourceName: "E4",
            }),
          ],
        ],
      ]),
    });

    expect(rows[0]?.pitchName).toBe("Kunstrasen 3 B");
    expect(rows[0]?.dressingRoomName).toBe("E4");
  });

  it("keeps archived series rows when included in input", () => {
    const rows = buildTrainingSeriesCockpitRows({
      series: [makeSeries({ status: "ARCHIVED" })],
      teamDisplayNameByTeamSeasonId: new Map([["ts-1", "Team"]]),
      allocationsBySeriesId: new Map(),
    });

    expect(rows[0]?.status).toBe("ARCHIVED");
  });
});

describe("resolveSeriesAllocationDisplay", () => {
  it("returns nulls when no allocations exist", () => {
    expect(resolveSeriesAllocationDisplay([])).toEqual({
      pitchName: null,
      dressingRoomName: null,
      pitchAllocationId: null,
      dressingRoomAllocationId: null,
      pitchResourceId: null,
      dressingRoomResourceId: null,
    });
  });
});

describe("sortTrainingSeriesCockpitRows", () => {
  it("orders weekdays Montag through Sonntag", () => {
    const sorted = sortTrainingSeriesCockpitRows([
      {
        ...buildTrainingSeriesCockpitRows({
          series: [makeSeries({ weekdaySchedules: [{ weekday: "FRIDAY", startsAt: "18:00", endsAt: "19:00" }] })],
          teamDisplayNameByTeamSeasonId: new Map([["ts-1", "Team"]]),
          allocationsBySeriesId: new Map(),
        })[0]!,
        weekday: "FRIDAY",
      },
      {
        ...buildTrainingSeriesCockpitRows({
          series: [makeSeries({ weekdaySchedules: [{ weekday: "MONDAY", startsAt: "18:00", endsAt: "19:00" }] })],
          teamDisplayNameByTeamSeasonId: new Map([["ts-1", "Team"]]),
          allocationsBySeriesId: new Map(),
        })[0]!,
        weekday: "MONDAY",
      },
    ]);

    expect(sorted.map((row) => row.weekday)).toEqual(["MONDAY", "FRIDAY"]);
  });
});
