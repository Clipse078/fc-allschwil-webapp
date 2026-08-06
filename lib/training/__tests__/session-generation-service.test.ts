/**
 * Tests for lib/training/session-generation-service.ts
 *
 * Covers:
 *   A. generateTrainingSessions — validation, not-found, INACTIVE/ARCHIVED
 *      no-op, first-run creation, idempotent re-run (no writes), schedule
 *      drift re-sync, status preservation, tenant scoping
 *   B. generateTrainingSessionsForTenant — batch generation across a tenant
 *   C. listTrainingSessions / getTrainingSession — canonical read API
 *
 * All external dependencies (Prisma) are mocked. No DB access.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    trainingSeries: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    trainingSession: {
      findMany: vi.fn(),
      createMany: vi.fn(),
      update: vi.fn(),
      findFirst: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/db/prisma";
import {
  generateTrainingSessions,
  generateTrainingSessionsForTenant,
  listTrainingSessions,
  getTrainingSession,
} from "../session-generation-service";
import {
  TrainingSeriesNotFoundError,
  TrainingSessionGenerationWindowError,
  TrainingSessionNotFoundError,
} from "../errors";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const TENANT_A = "tenant-a";
const SERIES_ID = "series-01";
const TEAM_SEASON_ID = "ts-01";

function makeSeriesRow(overrides: Record<string, unknown> = {}) {
  return {
    id: SERIES_ID,
    tenantId: TENANT_A,
    teamSeasonId: TEAM_SEASON_ID,
    title: "F2 Monday Training",
    description: null,
    status: "ACTIVE",
    startsAt: "17:00",
    endsAt: "18:00",
    timezone: "Europe/Zurich",
    validFrom: new Date("2026-08-01T00:00:00.000Z"),
    validUntil: new Date("2027-02-28T00:00:00.000Z"),
    archivedAt: null,
    createdAt: new Date("2026-07-01T00:00:00.000Z"),
    updatedAt: new Date("2026-07-01T00:00:00.000Z"),
    recurrenceDays: [{ weekday: "MONDAY" }],
    ...overrides,
  };
}

const WINDOW = {
  from: new Date("2026-08-01T00:00:00.000Z"),
  to: new Date("2026-08-31T00:00:00.000Z"),
};

// Real Mondays in August 2026 within [2026-08-01, 2026-08-31]: 03, 10, 17, 24, 31.

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.trainingSession.createMany).mockResolvedValue({ count: 0 } as never);
});

// ── A. generateTrainingSessions ──────────────────────────────────────────────

describe("A. generateTrainingSessions", () => {
  it("A1: throws TrainingSessionGenerationWindowError when from is after to", async () => {
    await expect(
      generateTrainingSessions(TENANT_A, SERIES_ID, {
        from: new Date("2026-08-31T00:00:00.000Z"),
        to: new Date("2026-08-01T00:00:00.000Z"),
      }),
    ).rejects.toThrow(TrainingSessionGenerationWindowError);
    expect(prisma.trainingSeries.findFirst).not.toHaveBeenCalled();
  });

  it("A2: throws TrainingSessionGenerationWindowError for invalid Date objects", async () => {
    await expect(
      generateTrainingSessions(TENANT_A, SERIES_ID, {
        from: new Date("not-a-date"),
        to: WINDOW.to,
      }),
    ).rejects.toThrow(TrainingSessionGenerationWindowError);
  });

  it("A3: throws TrainingSeriesNotFoundError when the series does not exist (or belongs to another tenant)", async () => {
    vi.mocked(prisma.trainingSeries.findFirst).mockResolvedValue(null);

    await expect(generateTrainingSessions(TENANT_A, SERIES_ID, WINDOW)).rejects.toThrow(
      TrainingSeriesNotFoundError,
    );
  });

  it("A4: INACTIVE series generates zero occurrences and issues no writes", async () => {
    vi.mocked(prisma.trainingSeries.findFirst).mockResolvedValue(
      makeSeriesRow({ status: "INACTIVE" }) as never,
    );

    const result = await generateTrainingSessions(TENANT_A, SERIES_ID, WINDOW);

    expect(result).toEqual({
      trainingSeriesId: SERIES_ID,
      occurrencesInWindow: 0,
      created: 0,
      updated: 0,
      unchanged: 0,
    });
    expect(prisma.trainingSession.findMany).not.toHaveBeenCalled();
    expect(prisma.trainingSession.createMany).not.toHaveBeenCalled();
    expect(prisma.trainingSession.update).not.toHaveBeenCalled();
  });

  it("A5: ARCHIVED series generates zero occurrences and issues no writes", async () => {
    vi.mocked(prisma.trainingSeries.findFirst).mockResolvedValue(
      makeSeriesRow({ status: "ARCHIVED", archivedAt: new Date() }) as never,
    );

    const result = await generateTrainingSessions(TENANT_A, SERIES_ID, WINDOW);

    expect(result.created).toBe(0);
    expect(result.updated).toBe(0);
    expect(prisma.trainingSession.createMany).not.toHaveBeenCalled();
  });

  it("A6: first run creates one row per generated occurrence, all as SCHEDULED", async () => {
    vi.mocked(prisma.trainingSeries.findFirst).mockResolvedValue(makeSeriesRow() as never);
    vi.mocked(prisma.trainingSession.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.trainingSession.createMany).mockResolvedValue({ count: 5 } as never);

    const result = await generateTrainingSessions(TENANT_A, SERIES_ID, WINDOW);

    expect(result.occurrencesInWindow).toBe(5); // Mondays: 03, 10, 17, 24, 31
    expect(result.created).toBe(5);
    expect(result.updated).toBe(0);
    expect(result.unchanged).toBe(0);
    expect(prisma.trainingSession.update).not.toHaveBeenCalled();

    const createCall = vi.mocked(prisma.trainingSession.createMany).mock.calls[0][0];
    const rows = (createCall as { data: Array<Record<string, unknown>> }).data;
    expect(rows).toHaveLength(5);
    for (const row of rows) {
      expect(row.status).toBe("SCHEDULED");
      expect(row.tenantId).toBe(TENANT_A);
      expect(row.trainingSeriesId).toBe(SERIES_ID);
      expect(row.teamSeasonId).toBe(TEAM_SEASON_ID);
    }
    expect(rows.map((r) => (r.date as Date).toISOString().slice(0, 10))).toEqual([
      "2026-08-03",
      "2026-08-10",
      "2026-08-17",
      "2026-08-24",
      "2026-08-31",
    ]);
  });

  it("A7: idempotent re-run against fully up-to-date rows issues no create/update writes", async () => {
    vi.mocked(prisma.trainingSeries.findFirst).mockResolvedValue(makeSeriesRow() as never);

    // Simulate that all 5 Mondays already exist with exactly the schedule
    // the generator would compute (17:00 CEST = 15:00 UTC for all these
    // August dates).
    const existingRows = ["2026-08-03", "2026-08-10", "2026-08-17", "2026-08-24", "2026-08-31"].map(
      (dateKey, i) => ({
        id: `s${i + 1}`,
        date: new Date(`${dateKey}T00:00:00.000Z`),
        weekday: "MONDAY",
        startAt: new Date(`${dateKey}T15:00:00.000Z`),
        endAt: new Date(`${dateKey}T16:00:00.000Z`),
        timezone: "Europe/Zurich",
        status: "SCHEDULED",
      }),
    );

    vi.mocked(prisma.trainingSession.findMany).mockResolvedValue(existingRows as never);

    const result = await generateTrainingSessions(TENANT_A, SERIES_ID, WINDOW);

    expect(result.occurrencesInWindow).toBe(5);
    expect(result.created).toBe(0);
    expect(result.updated).toBe(0);
    expect(result.unchanged).toBe(5);
    expect(prisma.trainingSession.createMany).not.toHaveBeenCalled();
    expect(prisma.trainingSession.update).not.toHaveBeenCalled();
  });

  it("A8: re-run after the series' time changed updates only the schedule fields, never `status`", async () => {
    vi.mocked(prisma.trainingSeries.findFirst).mockResolvedValue(
      makeSeriesRow({ startsAt: "19:00", endsAt: "20:30" }) as never,
    );

    // Existing row still has the OLD 17:00-18:00 schedule for 2026-08-03.
    const existing = [
      {
        id: "existing-1",
        date: new Date("2026-08-03T00:00:00.000Z"),
        weekday: "MONDAY",
        startAt: new Date("2026-08-03T15:00:00.000Z"), // old 17:00 CEST
        endAt: new Date("2026-08-03T16:00:00.000Z"),
        timezone: "Europe/Zurich",
        status: "SCHEDULED",
      },
    ];
    vi.mocked(prisma.trainingSession.findMany).mockResolvedValue(existing as never);
    vi.mocked(prisma.trainingSession.createMany).mockResolvedValue({ count: 4 } as never);

    const result = await generateTrainingSessions(TENANT_A, SERIES_ID, WINDOW);

    expect(result.updated).toBe(1);
    expect(result.created).toBe(4); // the other 4 Mondays are brand new
    expect(prisma.trainingSession.update).toHaveBeenCalledOnce();

    const updateCall = vi.mocked(prisma.trainingSession.update).mock.calls[0][0];
    expect(updateCall.where).toEqual({ id: "existing-1" });
    // startAt for 19:00 CEST on 2026-08-03 = 17:00 UTC.
    expect((updateCall.data as { startAt: Date }).startAt.toISOString()).toBe(
      "2026-08-03T17:00:00.000Z",
    );
    // `status` must never appear in the update payload — regeneration must
    // never overwrite future exception handling (CANCELLED/POSTPONED/MOVED).
    expect(updateCall.data).not.toHaveProperty("status");
  });

  it("A9: a CANCELLED (future-state) row is left untouched by regeneration when its schedule matches", async () => {
    vi.mocked(prisma.trainingSeries.findFirst).mockResolvedValue(makeSeriesRow() as never);

    const existing = [
      {
        id: "cancelled-1",
        date: new Date("2026-08-03T00:00:00.000Z"),
        weekday: "MONDAY",
        startAt: new Date("2026-08-03T15:00:00.000Z"),
        endAt: new Date("2026-08-03T16:00:00.000Z"),
        timezone: "Europe/Zurich",
        status: "CANCELLED", // hypothetical future exception state
      },
    ];
    vi.mocked(prisma.trainingSession.findMany).mockResolvedValue(existing as never);
    vi.mocked(prisma.trainingSession.createMany).mockResolvedValue({ count: 4 } as never);

    await generateTrainingSessions(TENANT_A, SERIES_ID, WINDOW);

    // The row's schedule already matches -> counted unchanged, no update issued
    // (and in particular, status is never reset back toward SCHEDULED).
    expect(prisma.trainingSession.update).not.toHaveBeenCalled();
  });

  it("A10: never issues createMany with an empty array (call is skipped, count stays 0)", async () => {
    vi.mocked(prisma.trainingSeries.findFirst).mockResolvedValue(
      makeSeriesRow({
        validFrom: new Date("2026-09-01T00:00:00.000Z"),
        validUntil: new Date("2026-09-30T00:00:00.000Z"),
      }) as never,
    );
    // Window (August) does not overlap the series' September validity at all.
    vi.mocked(prisma.trainingSession.findMany).mockResolvedValue([] as never);

    const result = await generateTrainingSessions(TENANT_A, SERIES_ID, WINDOW);

    expect(result.occurrencesInWindow).toBe(0);
    expect(result.created).toBe(0);
    expect(prisma.trainingSession.createMany).not.toHaveBeenCalled();
  });

  it("A11: findTrainingSessionsForSeriesInWindow is scoped by tenantId and trainingSeriesId", async () => {
    vi.mocked(prisma.trainingSeries.findFirst).mockResolvedValue(makeSeriesRow() as never);
    vi.mocked(prisma.trainingSession.findMany).mockResolvedValue([] as never);

    await generateTrainingSessions(TENANT_A, SERIES_ID, WINDOW);

    const findManyCall = vi.mocked(prisma.trainingSession.findMany).mock.calls[0][0];
    expect(findManyCall.where).toMatchObject({
      tenantId: TENANT_A,
      trainingSeriesId: SERIES_ID,
    });
  });
});

// ── B. generateTrainingSessionsForTenant ─────────────────────────────────────

describe("B. generateTrainingSessionsForTenant", () => {
  it("B1: generates for every ACTIVE series and collects a result per series", async () => {
    vi.mocked(prisma.trainingSeries.findMany).mockResolvedValue([
      { id: "series-a" },
      { id: "series-b" },
    ] as never);
    vi.mocked(prisma.trainingSeries.findFirst).mockImplementation(
      async (args) =>
        makeSeriesRow({
          id: (args as { where: { id: string } }).where.id,
        }) as never,
    );
    vi.mocked(prisma.trainingSession.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.trainingSession.createMany).mockResolvedValue({ count: 5 } as never);

    const { results, failures } = await generateTrainingSessionsForTenant(TENANT_A, WINDOW);

    expect(failures).toEqual([]);
    expect(results).toHaveLength(2);
    expect(results.map((r) => r.trainingSeriesId).sort()).toEqual(["series-a", "series-b"]);

    const findManyCall = vi.mocked(prisma.trainingSeries.findMany).mock.calls[0][0];
    expect(findManyCall.where).toMatchObject({ tenantId: TENANT_A, status: "ACTIVE" });
  });

  it("B2: a failure in one series is collected without aborting the batch", async () => {
    vi.mocked(prisma.trainingSeries.findMany).mockResolvedValue([
      { id: "series-ok" },
      { id: "series-missing" },
    ] as never);
    vi.mocked(prisma.trainingSeries.findFirst).mockImplementation(async (args) => {
      const id = (args as { where: { id: string } }).where.id;
      return id === "series-ok" ? (makeSeriesRow({ id }) as never) : null;
    });
    vi.mocked(prisma.trainingSession.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.trainingSession.createMany).mockResolvedValue({ count: 5 } as never);

    const { results, failures } = await generateTrainingSessionsForTenant(TENANT_A, WINDOW);

    expect(results).toHaveLength(1);
    expect(results[0].trainingSeriesId).toBe("series-ok");
    expect(failures).toHaveLength(1);
    expect(failures[0].trainingSeriesId).toBe("series-missing");
    expect(failures[0].error).toMatch(/not found/i);
  });
});

// ── C. listTrainingSessions / getTrainingSession ─────────────────────────────

function makeSessionRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "sess-1",
    tenantId: TENANT_A,
    trainingSeriesId: SERIES_ID,
    teamSeasonId: TEAM_SEASON_ID,
    date: new Date("2026-08-03T00:00:00.000Z"),
    weekday: "MONDAY",
    startAt: new Date("2026-08-03T15:00:00.000Z"),
    endAt: new Date("2026-08-03T16:00:00.000Z"),
    timezone: "Europe/Zurich",
    status: "SCHEDULED",
    createdAt: new Date("2026-07-01T00:00:00.000Z"),
    updatedAt: new Date("2026-07-01T00:00:00.000Z"),
    trainingSeries: { title: "F2 Monday Training" },
    ...overrides,
  };
}

describe("C. listTrainingSessions / getTrainingSession", () => {
  it("C1: listTrainingSessions maps rows to the public DTO shape", async () => {
    vi.mocked(prisma.trainingSession.findMany).mockResolvedValue([makeSessionRow()] as never);

    const result = await listTrainingSessions(TENANT_A, { trainingSeriesId: SERIES_ID });

    expect(result).toEqual([
      {
        id: "sess-1",
        tenantId: TENANT_A,
        trainingSeriesId: SERIES_ID,
        trainingSeriesTitle: "F2 Monday Training",
        teamSeasonId: TEAM_SEASON_ID,
        date: "2026-08-03",
        weekday: "MONDAY",
        startAt: "2026-08-03T15:00:00.000Z",
        endAt: "2026-08-03T16:00:00.000Z",
        timezone: "Europe/Zurich",
        status: "SCHEDULED",
        createdAt: "2026-07-01T00:00:00.000Z",
        updatedAt: "2026-07-01T00:00:00.000Z",
      },
    ]);
  });

  it("C2: listTrainingSessions passes filters through to the tenant-scoped query", async () => {
    vi.mocked(prisma.trainingSession.findMany).mockResolvedValue([] as never);

    await listTrainingSessions(TENANT_A, {
      teamSeasonId: TEAM_SEASON_ID,
      status: "SCHEDULED",
      dateFrom: new Date("2026-08-01T00:00:00.000Z"),
      dateTo: new Date("2026-08-31T00:00:00.000Z"),
    });

    const call = vi.mocked(prisma.trainingSession.findMany).mock.calls[0][0];
    expect(call.where).toMatchObject({
      tenantId: TENANT_A,
      teamSeasonId: TEAM_SEASON_ID,
      status: "SCHEDULED",
    });
  });

  it("C3: getTrainingSession returns the DTO for an existing, tenant-owned session", async () => {
    vi.mocked(prisma.trainingSession.findFirst).mockResolvedValue(makeSessionRow() as never);

    const result = await getTrainingSession(TENANT_A, "sess-1");

    expect(result.id).toBe("sess-1");
    expect(result.trainingSeriesTitle).toBe("F2 Monday Training");
  });

  it("C4: getTrainingSession throws TrainingSessionNotFoundError when missing or cross-tenant", async () => {
    vi.mocked(prisma.trainingSession.findFirst).mockResolvedValue(null);

    await expect(getTrainingSession(TENANT_A, "nonexistent")).rejects.toThrow(
      TrainingSessionNotFoundError,
    );
  });
});
