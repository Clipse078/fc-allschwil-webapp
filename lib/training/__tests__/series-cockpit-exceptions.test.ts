/**
 * lib/training/__tests__/series-cockpit-exceptions.test.ts
 *
 * TRAININGCENTER-EDIT-01B — occurrence exception index + cockpit semantics.
 */

import { describe, expect, it } from "vitest";
import {
  buildOccurrenceExceptionIndex,
  countSeriesOccurrenceExceptions,
  summarizeOccurrenceExceptions,
} from "../series-cockpit-exceptions";
import { buildTrainingSeriesCockpitRows } from "../series-cockpit";
import type { TrainingSeriesDto } from "../types";

function makeSeries(overrides: Partial<TrainingSeriesDto> = {}): TrainingSeriesDto {
  return {
    id: "series-1",
    tenantId: "tenant-a",
    teamSeasonId: "ts-1",
    title: "Junioren D-9 D1 Training",
    description: null,
    status: "ACTIVE",
    startsAt: "18:45",
    endsAt: "20:15",
    timezone: "Europe/Zurich",
    weekdays: ["WEDNESDAY"],
    weekdaySchedules: [{ weekday: "WEDNESDAY", startsAt: "18:45", endsAt: "20:15" }],
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

function makeSessionSource(overrides: Record<string, unknown> = {}) {
  return {
    id: "session-1",
    trainingSeriesId: "series-1",
    weekday: "WEDNESDAY" as const,
    date: new Date("2026-09-02T00:00:00.000Z"),
    overrideDate: null,
    overrideStartAt: null,
    overrideEndAt: null,
    startAt: new Date("2026-09-02T16:45:00.000Z"),
    endAt: new Date("2026-09-02T18:15:00.000Z"),
    timezone: "Europe/Zurich",
    sessionAllocations: [
      {
        facilityResourceId: "dressing-o4",
        facilityResource: { name: "O4", type: "DRESSING_ROOM" },
      },
    ],
    trainingSeries: {
      allocations: [
        {
          facilityResourceId: "pitch-kr3a",
          facilityResource: { name: "Kunstrasen 3 A", type: "HALF_PITCH" },
        },
        {
          facilityResourceId: "dressing-e3",
          facilityResource: { name: "E3", type: "DRESSING_ROOM" },
        },
      ],
    },
    ...overrides,
  };
}

describe("buildOccurrenceExceptionIndex", () => {
  it("indexes a single dressing-room override with series default context", () => {
    const index = buildOccurrenceExceptionIndex([makeSessionSource()], "Europe/Zurich");
    const exceptions = index.get("series-1:WEDNESDAY");

    expect(exceptions).toHaveLength(1);
    expect(exceptions?.[0]).toMatchObject({
      sessionId: "session-1",
      date: "2026-09-02",
      overrides: [
        {
          group: "DRESSING_ROOM",
          effectiveResourceName: "O4",
          seriesDefaultResourceName: "E3",
        },
      ],
    });
  });

  it("counts multiple resource overrides on the same occurrence as one exception", () => {
    const index = buildOccurrenceExceptionIndex(
      [
        makeSessionSource({
          sessionAllocations: [
            {
              facilityResourceId: "pitch-kr3b",
              facilityResource: { name: "Kunstrasen 3 B", type: "HALF_PITCH" },
            },
            {
              facilityResourceId: "dressing-o4",
              facilityResource: { name: "O4", type: "DRESSING_ROOM" },
            },
          ],
        }),
      ],
      "Europe/Zurich",
    );

    expect(index.get("series-1:WEDNESDAY")).toHaveLength(1);
    expect(index.get("series-1:WEDNESDAY")?.[0]?.overrides).toHaveLength(2);
  });

  it("keeps multiple different occurrences as separate entries", () => {
    const index = buildOccurrenceExceptionIndex(
      [
        makeSessionSource({ id: "session-1", date: new Date("2026-09-02T00:00:00.000Z") }),
        makeSessionSource({ id: "session-2", date: new Date("2026-09-09T00:00:00.000Z") }),
      ],
      "Europe/Zurich",
    );

    expect(index.get("series-1:WEDNESDAY")).toHaveLength(2);
  });

  it("ignores sessions without occurrence-level allocations", () => {
    const index = buildOccurrenceExceptionIndex(
      [makeSessionSource({ sessionAllocations: [] })],
      "Europe/Zurich",
    );

    expect(index.size).toBe(0);
  });
});

describe("cockpit row exception summary", () => {
  it("shows zero exceptions when no index entry exists", () => {
    const rows = buildTrainingSeriesCockpitRows({
      series: [makeSeries()],
      teamDisplayNameByTeamSeasonId: new Map([["ts-1", "Junioren D-9 D1"]]),
      allocationsBySeriesId: new Map(),
    });

    expect(rows[0]?.occurrenceExceptions.occurrenceExceptionCount).toBe(0);
  });

  it("attaches occurrence-based count to the matching weekday row", () => {
    const index = buildOccurrenceExceptionIndex([makeSessionSource()], "Europe/Zurich");
    const rows = buildTrainingSeriesCockpitRows({
      series: [makeSeries()],
      teamDisplayNameByTeamSeasonId: new Map([["ts-1", "Junioren D-9 D1"]]),
      allocationsBySeriesId: new Map(),
      occurrenceExceptionsByRowKey: index,
    });

    expect(rows[0]?.occurrenceExceptions.occurrenceExceptionCount).toBe(1);
    expect(rows[0]?.occurrenceExceptions.exceptions[0]?.overrides[0]?.seriesDefaultResourceName).toBe("E3");
  });
});

describe("countSeriesOccurrenceExceptions", () => {
  it("sums exceptions across weekday rows for one series", () => {
    const index = buildOccurrenceExceptionIndex(
      [
        makeSessionSource({ id: "session-wed" }),
        makeSessionSource({
          id: "session-tue",
          weekday: "TUESDAY",
          trainingSeriesId: "series-1",
        }),
      ],
      "Europe/Zurich",
    );

    expect(countSeriesOccurrenceExceptions(index, "series-1")).toBe(2);
    expect(summarizeOccurrenceExceptions(undefined).occurrenceExceptionCount).toBe(0);
  });
});
