import { describe, expect, it } from "vitest";
import {
  buildTrainingCenterViewModel,
  normalizeTrainingActionFilter,
} from "../view-model";
import type { TrainingAllocationSummary } from "../operational-state";
import type { TrainingSessionDto } from "../types";

function session(overrides: Partial<TrainingSessionDto> = {}): TrainingSessionDto {
  return {
    id: "session-1",
    tenantId: "tenant-1",
    trainingSeriesId: "series-1",
    trainingSeriesTitle: "E1 Dienstagstraining",
    teamSeasonId: "team-season-1",
    teamName: "E1",
    date: "2026-08-11",
    weekday: "TUESDAY",
    startAt: "2026-08-11T16:00:00.000Z",
    endAt: "2026-08-11T17:30:00.000Z",
    timezone: "Europe/Zurich",
    status: "SCHEDULED",
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

const FULLY_ALLOCATED: TrainingAllocationSummary = {
  hasPitchAllocation: true,
  hasDressingRoomAllocation: true,
};
const UNALLOCATED: TrainingAllocationSummary = {
  hasPitchAllocation: false,
  hasDressingRoomAllocation: false,
};

describe("normalizeTrainingActionFilter", () => {
  it("defaults to ALLE for missing/unknown values", () => {
    expect(normalizeTrainingActionFilter(undefined)).toBe("ALLE");
    expect(normalizeTrainingActionFilter(null)).toBe("ALLE");
    expect(normalizeTrainingActionFilter("bogus")).toBe("ALLE");
  });

  it("recognizes OFFEN/ERLEDIGT case-insensitively", () => {
    expect(normalizeTrainingActionFilter("offen")).toBe("OFFEN");
    expect(normalizeTrainingActionFilter("ERLEDIGT")).toBe("ERLEDIGT");
  });
});

describe("buildTrainingCenterViewModel", () => {
  it("sorts rows ascending by start time regardless of input order", () => {
    const sessions = [
      session({ id: "s2", startAt: "2026-08-12T16:00:00.000Z" }),
      session({ id: "s1", startAt: "2026-08-11T16:00:00.000Z" }),
    ];
    const model = buildTrainingCenterViewModel(sessions, new Map([["series-1", FULLY_ALLOCATED]]));
    expect(model.rows.map((r) => r.session.id)).toEqual(["s1", "s2"]);
  });

  it("computes KPI counts from the FULL window, independent of the active filter", () => {
    const sessions = [
      session({ id: "ready", trainingSeriesId: "series-ready" }),
      session({ id: "open", trainingSeriesId: "series-open" }),
      session({ id: "cancelled", trainingSeriesId: "series-open", status: "CANCELLED" }),
    ];
    const allocations = new Map<string, TrainingAllocationSummary>([
      ["series-ready", FULLY_ALLOCATED],
      ["series-open", UNALLOCATED],
    ]);

    const model = buildTrainingCenterViewModel(sessions, allocations, { actionFilter: "OFFEN" });

    expect(model.kpis).toEqual({ gesamt: 3, offen: 1, erledigt: 2 });
    // Filter only changes filteredRows, never the KPI population.
    expect(model.filteredRows).toHaveLength(1);
    expect(model.filteredRows[0].session.id).toBe("open");
  });

  it("ALLE returns every row unfiltered", () => {
    const sessions = [
      session({ id: "ready", trainingSeriesId: "series-ready" }),
      session({ id: "open", trainingSeriesId: "series-open" }),
    ];
    const allocations = new Map<string, TrainingAllocationSummary>([
      ["series-ready", FULLY_ALLOCATED],
      ["series-open", UNALLOCATED],
    ]);
    const model = buildTrainingCenterViewModel(sessions, allocations, { actionFilter: "ALLE" });
    expect(model.filteredRows).toHaveLength(2);
  });

  it("ERLEDIGT includes READY and NOT_APPLICABLE rows but excludes OPEN rows", () => {
    const sessions = [
      session({ id: "ready", trainingSeriesId: "series-ready" }),
      session({ id: "open", trainingSeriesId: "series-open" }),
      session({ id: "cancelled", trainingSeriesId: "series-open", status: "CANCELLED" }),
    ];
    const allocations = new Map<string, TrainingAllocationSummary>([
      ["series-ready", FULLY_ALLOCATED],
      ["series-open", UNALLOCATED],
    ]);
    const model = buildTrainingCenterViewModel(sessions, allocations, {
      actionFilter: "ERLEDIGT",
    });
    expect(model.filteredRows.map((r) => r.session.id).sort()).toEqual(["cancelled", "ready"]);
  });

  it("defaults to ALLE when no actionFilter option is given", () => {
    const sessions = [session()];
    const model = buildTrainingCenterViewModel(sessions, new Map());
    expect(model.filteredRows).toHaveLength(1);
  });
});
