/**
 * TRAINING-URGENT-01H — regression coverage for TrainingCenter Day-view
 * cross-date leakage (Europe/Zurich UTC-offset widening).
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import { prisma } from "@/lib/db/prisma";
import {
  listTrainingSessionDateBounds,
  resolveTrainingDayWindow,
  resolveTrainingMonthWindow,
  resolveTrainingWeekWindow,
} from "../date-range";
import { listTrainingSessions } from "../session-generation-service";
import { buildTrainingCenterViewModel } from "../view-model";
import type { TrainingSessionDto } from "../types";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    trainingSession: {
      findMany: vi.fn(),
    },
  },
}));

const TZ = "Europe/Zurich";
const TENANT = "tenant-a";

function session(overrides: Partial<TrainingSessionDto> = {}): TrainingSessionDto {
  return {
    id: overrides.id ?? "session-default",
    tenantId: TENANT,
    trainingSeriesId: "series-default",
    trainingSeriesTitle: "Training",
    teamSeasonId: "team-season-default",
    teamName: overrides.teamName ?? "Team",
    date: "2026-08-28",
    weekday: "FRIDAY",
    startAt: "2026-08-28T16:00:00.000Z",
    endAt: "2026-08-28T17:30:00.000Z",
    timezone: TZ,
    status: "SCHEDULED",
    originalDate: overrides.date ?? "2026-08-28",
    originalStartAt: overrides.startAt ?? "2026-08-28T16:00:00.000Z",
    originalEndAt: overrides.endAt ?? "2026-08-28T17:30:00.000Z",
    isRescheduled: false,
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeDbRowFromDto(dto: TrainingSessionDto) {
  return {
    id: dto.id,
    tenantId: dto.tenantId,
    trainingSeriesId: dto.trainingSeriesId,
    teamSeasonId: dto.teamSeasonId,
    date: new Date(`${dto.originalDate}T00:00:00.000Z`),
    weekday: dto.weekday,
    startAt: new Date(dto.originalStartAt),
    endAt: new Date(dto.originalEndAt),
    timezone: dto.timezone,
    status: dto.status,
    overrideDate: dto.isRescheduled && dto.date !== dto.originalDate ? new Date(`${dto.date}T00:00:00.000Z`) : null,
    overrideStartAt: null,
    overrideEndAt: null,
    createdAt: new Date(dto.createdAt),
    updatedAt: new Date(dto.updatedAt),
    trainingSeries: {
      title: dto.trainingSeriesTitle,
      teamSeason: {
        displayName: dto.teamName,
        team: { name: dto.teamName, shortName: null, alternativeName: null },
      },
    },
  };
}

function filterRowsByQuery(
  rows: ReturnType<typeof makeDbRowFromDto>[],
  where: {
    dateFrom?: Date;
    dateTo?: Date;
  },
) {
  return rows.filter((row) => {
    const effective = row.overrideDate ?? row.date;
    if (where.dateFrom && effective.getTime() < where.dateFrom.getTime()) return false;
    if (where.dateTo && effective.getTime() > where.dateTo.getTime()) return false;
    return true;
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("listTrainingSessionDateBounds — TRAINING-URGENT-01H", () => {
  it("A: Europe/Zurich day 2026-08-28 bounds exclude 2026-08-27 (no UTC widening)", () => {
    const dayWindow = resolveTrainingDayWindow({ dayParam: "2026-08-28", timeZone: TZ });
    expect(dayWindow.from.toISOString()).toBe("2026-08-27T22:00:00.000Z");

    const bounds = listTrainingSessionDateBounds("DAY", {
      month: resolveTrainingMonthWindow({ monthParam: "2026-08", timeZone: TZ }),
      week: resolveTrainingWeekWindow({ weekParam: "2026-08-25", timeZone: TZ }),
      day: dayWindow,
    });

    expect(bounds.dateFrom.toISOString()).toBe("2026-08-28T00:00:00.000Z");
    expect(bounds.dateTo.toISOString()).toBe("2026-08-28T00:00:00.000Z");
    expect(bounds.dateFrom.toISOString()).not.toBe("2026-08-27T00:00:00.000Z");
  });

  it("F: Aug 29 day bounds do not include Aug 28", () => {
    const dayWindow = resolveTrainingDayWindow({ dayParam: "2026-08-29", timeZone: TZ });
    const bounds = listTrainingSessionDateBounds("DAY", {
      month: resolveTrainingMonthWindow({ monthParam: "2026-08", timeZone: TZ }),
      week: resolveTrainingWeekWindow({ weekParam: "2026-08-25", timeZone: TZ }),
      day: dayWindow,
    });

    expect(bounds.dateFrom.toISOString()).toBe("2026-08-29T00:00:00.000Z");
    expect(bounds.dateTo.toISOString()).toBe("2026-08-29T00:00:00.000Z");
  });

  it("H: week bounds use Monday–Sunday calendar keys, not zoned instants", () => {
    const weekWindow = resolveTrainingWeekWindow({ weekParam: "2026-08-25", timeZone: TZ });
    const bounds = listTrainingSessionDateBounds("WEEK", {
      month: resolveTrainingMonthWindow({ monthParam: "2026-08", timeZone: TZ }),
      week: weekWindow,
      day: resolveTrainingDayWindow({ dayParam: "2026-08-28", timeZone: TZ }),
    });

    expect(bounds.dateFrom.toISOString()).toBe("2026-08-24T00:00:00.000Z");
    expect(bounds.dateTo.toISOString()).toBe("2026-08-30T00:00:00.000Z");
  });

  it("I: month bounds use first/last in-month calendar keys", () => {
    const monthWindow = resolveTrainingMonthWindow({ monthParam: "2026-08", timeZone: TZ });
    const bounds = listTrainingSessionDateBounds("MONTH", {
      month: monthWindow,
      week: resolveTrainingWeekWindow({ weekParam: "2026-08-25", timeZone: TZ }),
      day: resolveTrainingDayWindow({ dayParam: "2026-08-28", timeZone: TZ }),
    });

    expect(bounds.dateFrom.toISOString()).toBe("2026-08-01T00:00:00.000Z");
    expect(bounds.dateTo.toISOString()).toBe("2026-08-31T00:00:00.000Z");
  });
});

describe("listTrainingSessions day-window query — TRAINING-URGENT-01H", () => {
  const aug27B1 = session({
    id: "b1-aug27",
    teamName: "Junioren B1",
    date: "2026-08-27",
    originalDate: "2026-08-27",
    weekday: "THURSDAY",
    startAt: "2026-08-27T16:00:00.000Z",
    endAt: "2026-08-27T17:30:00.000Z",
    originalStartAt: "2026-08-27T16:00:00.000Z",
    originalEndAt: "2026-08-27T17:30:00.000Z",
    trainingSeriesId: "series-b1",
  });
  const aug28B1 = session({
    id: "b1-aug28",
    teamName: "Junioren B1",
    date: "2026-08-28",
    originalDate: "2026-08-28",
    weekday: "FRIDAY",
    startAt: "2026-08-28T16:00:00.000Z",
    endAt: "2026-08-28T17:30:00.000Z",
    originalStartAt: "2026-08-28T16:00:00.000Z",
    originalEndAt: "2026-08-28T17:30:00.000Z",
    trainingSeriesId: "series-b1",
  });
  const aug28C1 = session({
    id: "c1-aug28",
    teamName: "Junioren C1",
    date: "2026-08-28",
    trainingSeriesId: "series-c1",
  });
  const aug28Second = session({
    id: "second-aug28",
    teamName: "2. Mannschaft",
    date: "2026-08-28",
    trainingSeriesId: "series-second",
  });
  const aug28Aug29 = session({
    id: "b1-aug29",
    teamName: "Junioren B1",
    date: "2026-08-29",
    originalDate: "2026-08-29",
    weekday: "SATURDAY",
    startAt: "2026-08-29T16:00:00.000Z",
    endAt: "2026-08-29T17:30:00.000Z",
    originalStartAt: "2026-08-29T16:00:00.000Z",
    originalEndAt: "2026-08-29T17:30:00.000Z",
    trainingSeriesId: "series-b1",
  });

  const allRows = [aug27B1, aug28B1, aug28C1, aug28Second, aug28Aug29].map(makeDbRowFromDto);

  it("A/B/C/D: Aug 28 day query excludes Aug 27 and keeps Aug 28 teams once each", async () => {
    const dayWindow = resolveTrainingDayWindow({ dayParam: "2026-08-28", timeZone: TZ });
    const bounds = listTrainingSessionDateBounds("DAY", {
      month: resolveTrainingMonthWindow({ monthParam: "2026-08", timeZone: TZ }),
      week: resolveTrainingWeekWindow({ weekParam: "2026-08-25", timeZone: TZ }),
      day: dayWindow,
    });

    vi.mocked(prisma.trainingSession.findMany).mockResolvedValue(
      filterRowsByQuery(allRows, bounds) as never,
    );

    const results = await listTrainingSessions(TENANT, bounds);

    expect(results.map((row) => row.date)).not.toContain("2026-08-27");
    expect(results.map((row) => row.teamName).sort()).toEqual(["2. Mannschaft", "Junioren B1", "Junioren C1"]);
    expect(results.filter((row) => row.teamName === "Junioren B1")).toHaveLength(1);
    expect(results.filter((row) => row.teamName === "Junioren C1")).toHaveLength(1);
    expect(results.filter((row) => row.teamName === "2. Mannschaft")).toHaveLength(1);
  });

  it("C: Friday day view shows only Friday B1, not Thursday B1 at the same local time", async () => {
    const fridayBounds = listTrainingSessionDateBounds("DAY", {
      month: resolveTrainingMonthWindow({ monthParam: "2026-08", timeZone: TZ }),
      week: resolveTrainingWeekWindow({ weekParam: "2026-08-25", timeZone: TZ }),
      day: resolveTrainingDayWindow({ dayParam: "2026-08-28", timeZone: TZ }),
    });

    vi.mocked(prisma.trainingSession.findMany).mockResolvedValue(
      filterRowsByQuery(allRows, fridayBounds) as never,
    );

    const fridayResults = await listTrainingSessions(TENANT, fridayBounds);
    expect(fridayResults.filter((row) => row.teamName === "Junioren B1")).toEqual([
      expect.objectContaining({ id: "b1-aug28", date: "2026-08-28" }),
    ]);

    const thursdayBounds = listTrainingSessionDateBounds("DAY", {
      month: resolveTrainingMonthWindow({ monthParam: "2026-08", timeZone: TZ }),
      week: resolveTrainingWeekWindow({ weekParam: "2026-08-25", timeZone: TZ }),
      day: resolveTrainingDayWindow({ dayParam: "2026-08-27", timeZone: TZ }),
    });

    vi.mocked(prisma.trainingSession.findMany).mockResolvedValue(
      filterRowsByQuery(allRows, thursdayBounds) as never,
    );

    const thursdayResults = await listTrainingSessions(TENANT, thursdayBounds);
    expect(thursdayResults.filter((row) => row.teamName === "Junioren B1")).toEqual([
      expect.objectContaining({ id: "b1-aug27", date: "2026-08-27" }),
    ]);
  });

  it("F: Aug 29 day query does not replay Aug 28 sessions", async () => {
    const bounds = listTrainingSessionDateBounds("DAY", {
      month: resolveTrainingMonthWindow({ monthParam: "2026-08", timeZone: TZ }),
      week: resolveTrainingWeekWindow({ weekParam: "2026-08-25", timeZone: TZ }),
      day: resolveTrainingDayWindow({ dayParam: "2026-08-29", timeZone: TZ }),
    });

    vi.mocked(prisma.trainingSession.findMany).mockResolvedValue(
      filterRowsByQuery(allRows, bounds) as never,
    );

    const results = await listTrainingSessions(TENANT, bounds);
    expect(results.map((row) => row.date)).toEqual(["2026-08-29"]);
    expect(results.some((row) => row.date === "2026-08-28")).toBe(false);
  });

  it("G: a session with multi-group allocation still appears once in the day list", async () => {
    const multiAllocSession = session({
      id: "multi-alloc-aug28",
      teamName: "Junioren B1",
      trainingSeriesId: "series-multi",
    });
    const rows = [multiAllocSession].map(makeDbRowFromDto);
    const bounds = listTrainingSessionDateBounds("DAY", {
      month: resolveTrainingMonthWindow({ monthParam: "2026-08", timeZone: TZ }),
      week: resolveTrainingWeekWindow({ weekParam: "2026-08-25", timeZone: TZ }),
      day: resolveTrainingDayWindow({ dayParam: "2026-08-28", timeZone: TZ }),
    });

    vi.mocked(prisma.trainingSession.findMany).mockResolvedValue(rows as never);

    const results = await listTrainingSessions(TENANT, bounds);
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe("multi-alloc-aug28");
  });

  it("H: week query includes all seven days without UTC widening at week start", async () => {
    const weekWindow = resolveTrainingWeekWindow({ weekParam: "2026-08-25", timeZone: TZ });
    const bounds = listTrainingSessionDateBounds("WEEK", {
      month: resolveTrainingMonthWindow({ monthParam: "2026-08", timeZone: TZ }),
      week: weekWindow,
      day: resolveTrainingDayWindow({ dayParam: "2026-08-28", timeZone: TZ }),
    });

    vi.mocked(prisma.trainingSession.findMany).mockResolvedValue(
      filterRowsByQuery(allRows, bounds) as never,
    );

    const results = await listTrainingSessions(TENANT, bounds);
    expect(results.map((row) => row.date).sort()).toEqual([
      "2026-08-27",
      "2026-08-28",
      "2026-08-28",
      "2026-08-28",
      "2026-08-29",
    ]);
  });

  it("I: month query spans August calendar keys only", async () => {
    const bounds = listTrainingSessionDateBounds("MONTH", {
      month: resolveTrainingMonthWindow({ monthParam: "2026-08", timeZone: TZ }),
      week: resolveTrainingWeekWindow({ weekParam: "2026-08-25", timeZone: TZ }),
      day: resolveTrainingDayWindow({ dayParam: "2026-08-28", timeZone: TZ }),
    });

    vi.mocked(prisma.trainingSession.findMany).mockResolvedValue(
      filterRowsByQuery(allRows, bounds) as never,
    );

    const results = await listTrainingSessions(TENANT, bounds);
    expect(results.every((row) => row.date.startsWith("2026-08-"))).toBe(true);
    expect(results.some((row) => row.date === "2026-08-27")).toBe(true);
    expect(results.some((row) => row.date === "2026-08-29")).toBe(true);
  });

  it("documents the broken legacy path: truncating dayWindow.from via UTC would widen to Aug 27", () => {
    const dayWindow = resolveTrainingDayWindow({ dayParam: "2026-08-28", timeZone: TZ });
    const brokenFrom = new Date(
      Date.UTC(
        dayWindow.from.getUTCFullYear(),
        dayWindow.from.getUTCMonth(),
        dayWindow.from.getUTCDate(),
      ),
    );
    expect(brokenFrom.toISOString()).toBe("2026-08-27T00:00:00.000Z");

    const fixedBounds = listTrainingSessionDateBounds("DAY", {
      month: resolveTrainingMonthWindow({ monthParam: "2026-08", timeZone: TZ }),
      week: resolveTrainingWeekWindow({ weekParam: "2026-08-25", timeZone: TZ }),
      day: dayWindow,
    });
    expect(fixedBounds.dateFrom.toISOString()).toBe("2026-08-28T00:00:00.000Z");
  });
});

describe("buildTrainingCenterViewModel day KPI alignment — TRAINING-URGENT-01H", () => {
  it("E: day-scoped row count matches gesamt when upstream query is already scoped", () => {
    const sessions = [
      session({ id: "aug28-b1", teamName: "Junioren B1", date: "2026-08-28", trainingSeriesId: "s1" }),
      session({ id: "aug28-c1", teamName: "Junioren C1", date: "2026-08-28", trainingSeriesId: "s2" }),
    ];
    const model = buildTrainingCenterViewModel(sessions, new Map());
    expect(model.kpis.gesamt).toBe(model.filteredRows.length);
    expect(model.kpis.gesamt).toBe(2);
  });
});
