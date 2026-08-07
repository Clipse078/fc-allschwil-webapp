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
      deactivated: 0,
      reactivated: 0,
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

    const findManyCall = vi.mocked(prisma.trainingSession.findMany).mock.calls[0][0] as {
      where: Record<string, unknown>;
    };
    expect(findManyCall.where).toMatchObject({
      tenantId: TENANT_A,
      trainingSeriesId: SERIES_ID,
    });
  });
});

describe("A. generateTrainingSessions — TRAININGCENTER-03A per-weekday overrides", () => {
  it("A12: recurrenceDays with their own startsAt/endsAt override the series-level fallback", async () => {
    vi.mocked(prisma.trainingSeries.findFirst).mockResolvedValue(
      makeSeriesRow({
        recurrenceDays: [
          { weekday: "MONDAY", startsAt: null, endsAt: null },
          { weekday: "WEDNESDAY", startsAt: "16:00", endsAt: "17:00" },
        ],
      }) as never,
    );
    vi.mocked(prisma.trainingSession.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.trainingSession.createMany).mockResolvedValue({ count: 2 } as never);

    await generateTrainingSessions(TENANT_A, SERIES_ID, {
      from: new Date("2026-08-03T00:00:00.000Z"),
      to: new Date("2026-08-05T00:00:00.000Z"),
    });

    const createCall = vi.mocked(prisma.trainingSession.createMany).mock.calls[0][0];
    const rows = (createCall as { data: Array<Record<string, unknown>> }).data;

    const monday = rows.find((r) => r.weekday === "MONDAY")!;
    const wednesday = rows.find((r) => r.weekday === "WEDNESDAY")!;

    // Monday has no override -> series-level 17:00 CEST = 15:00 UTC.
    expect((monday.startAt as Date).toISOString()).toBe("2026-08-03T15:00:00.000Z");
    // Wednesday overrides to 16:00 CEST = 14:00 UTC.
    expect((wednesday.startAt as Date).toISOString()).toBe("2026-08-05T14:00:00.000Z");
    expect((wednesday.endAt as Date).toISOString()).toBe("2026-08-05T15:00:00.000Z");
  });
});

// ── B. generateTrainingSessionsForTenant ─────────────────────────────────────

describe("B. generateTrainingSessionsForTenant", () => {
  it("B1: generates for every ACTIVE series and collects a result per series", async () => {
    vi.mocked(prisma.trainingSeries.findMany).mockResolvedValue([
      { id: "series-a" },
      { id: "series-b" },
    ] as never);
    // One resolved value per findFirst call, in the same order
    // generateTrainingSessionsForTenant iterates activeSeries (series-a, then series-b).
    vi.mocked(prisma.trainingSeries.findFirst)
      .mockResolvedValueOnce(makeSeriesRow({ id: "series-a" }) as never)
      .mockResolvedValueOnce(makeSeriesRow({ id: "series-b" }) as never);
    vi.mocked(prisma.trainingSession.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.trainingSession.createMany).mockResolvedValue({ count: 5 } as never);

    const { results, failures } = await generateTrainingSessionsForTenant(TENANT_A, WINDOW);

    expect(failures).toEqual([]);
    expect(results).toHaveLength(2);
    expect(results.map((r) => r.trainingSeriesId).sort()).toEqual(["series-a", "series-b"]);

    const findManyCall = vi.mocked(prisma.trainingSeries.findMany).mock.calls[0][0] as {
      where: Record<string, unknown>;
    };
    expect(findManyCall.where).toMatchObject({ tenantId: TENANT_A, status: "ACTIVE" });
  });

  it("B2: a failure in one series is collected without aborting the batch", async () => {
    vi.mocked(prisma.trainingSeries.findMany).mockResolvedValue([
      { id: "series-ok" },
      { id: "series-missing" },
    ] as never);
    // One resolved value per findFirst call, in the same order
    // generateTrainingSessionsForTenant iterates activeSeries (series-ok, then series-missing).
    vi.mocked(prisma.trainingSeries.findFirst)
      .mockResolvedValueOnce(makeSeriesRow({ id: "series-ok" }) as never)
      .mockResolvedValueOnce(null);
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

// ── D. TRAININGCENTER-03A-FIX: recurrence reconciliation ─────────────────────
//
// Regression coverage for the reconciliation defect: previously-generated
// SCHEDULED TrainingSession rows that no longer satisfy their series'
// current recurrence rule must be flagged RECURRENCE_REMOVED (never
// CANCELLED, never hard-deleted), reactivated back to SCHEDULED in place if
// the recurrence covers their date again, and must never be touched at all
// once a genuine operational status (CANCELLED / POSTPONED / MOVED) has
// been manually set.

const MONDAYS_AUG_2026 = ["2026-08-03", "2026-08-10", "2026-08-17", "2026-08-24", "2026-08-31"];
const WEDNESDAYS_AUG_2026 = ["2026-08-05", "2026-08-12", "2026-08-19", "2026-08-26"];

function makeExistingScheduleRow(
  id: string,
  dateKey: string,
  weekday: string,
  status = "SCHEDULED",
  scheduleOverrides: { startAt?: string; endAt?: string } = {},
) {
  return {
    id,
    date: new Date(`${dateKey}T00:00:00.000Z`),
    weekday,
    startAt: new Date(scheduleOverrides.startAt ?? `${dateKey}T15:00:00.000Z`),
    endAt: new Date(scheduleOverrides.endAt ?? `${dateKey}T16:00:00.000Z`),
    timezone: "Europe/Zurich",
    status,
  };
}

/** Finds the `prisma.trainingSession.update` call whose `where.id` matches. */
function updateCallFor(id: string) {
  return vi
    .mocked(prisma.trainingSession.update)
    .mock.calls.find((call) => (call[0] as { where: { id: string } }).where.id === id);
}

describe("D. TRAININGCENTER-03A-FIX — recurrence reconciliation", () => {
  it("D1: shortening validUntil deactivates (RECURRENCE_REMOVED) sessions after the new bound, even outside the regeneration window", async () => {
    vi.mocked(prisma.trainingSeries.findFirst).mockResolvedValue(
      makeSeriesRow({
        validFrom: new Date("2026-08-01T00:00:00.000Z"),
        validUntil: new Date("2026-08-17T00:00:00.000Z"), // shortened: was 2027-02-28
      }) as never,
    );

    const existingRows = MONDAYS_AUG_2026.map((d, i) =>
      makeExistingScheduleRow(`m${i + 1}`, d, "MONDAY"),
    );
    vi.mocked(prisma.trainingSession.findMany).mockResolvedValue(existingRows as never);

    // Mirrors the API route: regeneration always runs over the *new*
    // [validFrom, validUntil] — which, by construction, excludes the two
    // stranded Mondays (24th, 31st) entirely.
    const result = await generateTrainingSessions(TENANT_A, SERIES_ID, {
      from: new Date("2026-08-01T00:00:00.000Z"),
      to: new Date("2026-08-17T00:00:00.000Z"),
    });

    expect(result.occurrencesInWindow).toBe(3); // 03, 10, 17
    expect(result.unchanged).toBe(3);
    expect(result.created).toBe(0);
    expect(result.deactivated).toBe(2); // 24, 31
    expect(result.reactivated).toBe(0);

    expect(updateCallFor("m4")?.[0]).toMatchObject({ data: { status: "RECURRENCE_REMOVED" } }); // 08-24
    expect(updateCallFor("m5")?.[0]).toMatchObject({ data: { status: "RECURRENCE_REMOVED" } }); // 08-31
    expect(updateCallFor("m1")).toBeUndefined(); // still-valid rows are left alone
    expect(updateCallFor("m2")).toBeUndefined();
    expect(updateCallFor("m3")).toBeUndefined();
  });

  it("D2: moving validFrom forward deactivates sessions before the new bound", async () => {
    vi.mocked(prisma.trainingSeries.findFirst).mockResolvedValue(
      makeSeriesRow({
        validFrom: new Date("2026-08-15T00:00:00.000Z"), // moved forward: was 2026-08-01
        validUntil: new Date("2027-02-28T00:00:00.000Z"),
      }) as never,
    );

    const existingRows = MONDAYS_AUG_2026.map((d, i) =>
      makeExistingScheduleRow(`m${i + 1}`, d, "MONDAY"),
    );
    vi.mocked(prisma.trainingSession.findMany).mockResolvedValue(existingRows as never);

    const result = await generateTrainingSessions(TENANT_A, SERIES_ID, {
      from: new Date("2026-08-15T00:00:00.000Z"),
      to: new Date("2026-08-31T00:00:00.000Z"),
    });

    expect(result.occurrencesInWindow).toBe(3); // 17, 24, 31
    expect(result.unchanged).toBe(3);
    expect(result.deactivated).toBe(2); // 03, 10 — before the new validFrom
    expect(result.reactivated).toBe(0);

    expect(updateCallFor("m1")?.[0]).toMatchObject({ data: { status: "RECURRENCE_REMOVED" } }); // 08-03
    expect(updateCallFor("m2")?.[0]).toMatchObject({ data: { status: "RECURRENCE_REMOVED" } }); // 08-10
  });

  it("D3: removing a weekday deactivates only that weekday's sessions", async () => {
    vi.mocked(prisma.trainingSeries.findFirst).mockResolvedValue(
      makeSeriesRow({
        validFrom: new Date("2026-08-01T00:00:00.000Z"),
        validUntil: new Date("2027-02-28T00:00:00.000Z"),
        recurrenceDays: [{ weekday: "MONDAY", startsAt: null, endsAt: null }], // WEDNESDAY removed
      }) as never,
    );

    const existingRows = [
      ...MONDAYS_AUG_2026.map((d, i) => makeExistingScheduleRow(`mon${i + 1}`, d, "MONDAY")),
      ...WEDNESDAYS_AUG_2026.map((d, i) => makeExistingScheduleRow(`wed${i + 1}`, d, "WEDNESDAY")),
    ];
    vi.mocked(prisma.trainingSession.findMany).mockResolvedValue(existingRows as never);

    const result = await generateTrainingSessions(TENANT_A, SERIES_ID, WINDOW);

    expect(result.occurrencesInWindow).toBe(5); // Mondays only
    expect(result.unchanged).toBe(5);
    expect(result.created).toBe(0);
    expect(result.deactivated).toBe(4); // all 4 Wednesdays
    expect(result.reactivated).toBe(0);

    for (let i = 1; i <= 4; i++) {
      expect(updateCallFor(`wed${i}`)?.[0]).toMatchObject({ data: { status: "RECURRENCE_REMOVED" } });
    }
    for (let i = 1; i <= 5; i++) {
      expect(updateCallFor(`mon${i}`)).toBeUndefined();
    }
  });

  it("D4/D10: re-adding a removed weekday reactivates the existing RECURRENCE_REMOVED rows in place — no duplicates created", async () => {
    vi.mocked(prisma.trainingSeries.findFirst).mockResolvedValue(
      makeSeriesRow({
        validFrom: new Date("2026-08-01T00:00:00.000Z"),
        validUntil: new Date("2027-02-28T00:00:00.000Z"),
        recurrenceDays: [
          { weekday: "MONDAY", startsAt: null, endsAt: null },
          { weekday: "WEDNESDAY", startsAt: null, endsAt: null }, // WEDNESDAY re-added
        ],
      }) as never,
    );

    // Simulates the outcome of D3: Wednesdays were previously deactivated,
    // and (to also verify schedule re-sync on reactivation) carry a stale
    // schedule snapshot from before the removal.
    const existingRows = [
      ...MONDAYS_AUG_2026.map((d, i) => makeExistingScheduleRow(`mon${i + 1}`, d, "MONDAY")),
      ...WEDNESDAYS_AUG_2026.map((d, i) =>
        makeExistingScheduleRow(`wed${i + 1}`, d, "WEDNESDAY", "RECURRENCE_REMOVED", {
          startAt: `${d}T00:00:00.000Z`,
          endAt: `${d}T01:00:00.000Z`,
        }),
      ),
    ];
    vi.mocked(prisma.trainingSession.findMany).mockResolvedValue(existingRows as never);

    const result = await generateTrainingSessions(TENANT_A, SERIES_ID, WINDOW);

    expect(result.occurrencesInWindow).toBe(9); // 5 Mondays + 4 Wednesdays
    expect(result.unchanged).toBe(5); // Mondays were never touched
    expect(result.reactivated).toBe(4); // all 4 Wednesdays
    expect(result.deactivated).toBe(0);
    // No new row was created for any re-added Wednesday date — reconciliation
    // reused the existing (trainingSeriesId, date) rows instead.
    expect(prisma.trainingSession.createMany).not.toHaveBeenCalled();

    for (let i = 1; i <= 4; i++) {
      const call = updateCallFor(`wed${i}`)?.[0] as { data: Record<string, unknown> } | undefined;
      expect(call).toBeDefined();
      expect(call!.data.status).toBe("SCHEDULED");
      // Schedule was re-synced back to the current 15:00-16:00 UTC slot.
      expect((call!.data.startAt as Date).toISOString()).toBe(
        `${WEDNESDAYS_AUG_2026[i - 1]}T15:00:00.000Z`,
      );
    }
  });

  it("D5: an unchanged recurrence regenerates idempotently — zero deactivations/reactivations on re-run", async () => {
    vi.mocked(prisma.trainingSeries.findFirst).mockResolvedValue(makeSeriesRow() as never);

    const existingRows = MONDAYS_AUG_2026.map((d, i) =>
      makeExistingScheduleRow(`m${i + 1}`, d, "MONDAY"),
    );
    vi.mocked(prisma.trainingSession.findMany).mockResolvedValue(existingRows as never);

    const result = await generateTrainingSessions(TENANT_A, SERIES_ID, WINDOW);

    expect(result).toEqual({
      trainingSeriesId: SERIES_ID,
      occurrencesInWindow: 5,
      created: 0,
      updated: 0,
      unchanged: 5,
      deactivated: 0,
      reactivated: 0,
    });
    expect(prisma.trainingSession.update).not.toHaveBeenCalled();
    expect(prisma.trainingSession.createMany).not.toHaveBeenCalled();
  });

  it("D6: extending validUntil creates only the newly-missing sessions, leaves existing rows alone", async () => {
    vi.mocked(prisma.trainingSeries.findFirst).mockResolvedValue(
      makeSeriesRow({
        validFrom: new Date("2026-08-01T00:00:00.000Z"),
        validUntil: new Date("2026-09-07T00:00:00.000Z"), // extended to cover one more Monday
      }) as never,
    );

    const existingRows = MONDAYS_AUG_2026.map((d, i) =>
      makeExistingScheduleRow(`m${i + 1}`, d, "MONDAY"),
    );
    vi.mocked(prisma.trainingSession.findMany).mockResolvedValue(existingRows as never);
    vi.mocked(prisma.trainingSession.createMany).mockResolvedValue({ count: 1 } as never);

    const result = await generateTrainingSessions(TENANT_A, SERIES_ID, {
      from: new Date("2026-08-01T00:00:00.000Z"),
      to: new Date("2026-09-07T00:00:00.000Z"),
    });

    expect(result.occurrencesInWindow).toBe(6); // 5 existing Mondays + 2026-09-07
    expect(result.created).toBe(1);
    expect(result.unchanged).toBe(5);
    expect(result.deactivated).toBe(0);
    expect(result.reactivated).toBe(0);

    const createCall = vi.mocked(prisma.trainingSession.createMany).mock.calls[0][0];
    const rows = (createCall as { data: Array<Record<string, unknown>> }).data;
    expect(rows).toHaveLength(1);
    expect((rows[0].date as Date).toISOString().slice(0, 10)).toBe("2026-09-07");
  });

  it("D7: a CANCELLED session survives regeneration even when its weekday is removed (never deactivated, never reset)", async () => {
    vi.mocked(prisma.trainingSeries.findFirst).mockResolvedValue(
      makeSeriesRow({
        recurrenceDays: [{ weekday: "MONDAY", startsAt: null, endsAt: null }], // WEDNESDAY removed
      }) as never,
    );

    const existingRows = [
      ...MONDAYS_AUG_2026.map((d, i) => makeExistingScheduleRow(`mon${i + 1}`, d, "MONDAY")),
      makeExistingScheduleRow("wed-cancelled", "2026-08-05", "WEDNESDAY", "CANCELLED"),
    ];
    vi.mocked(prisma.trainingSession.findMany).mockResolvedValue(existingRows as never);

    const result = await generateTrainingSessions(TENANT_A, SERIES_ID, WINDOW);

    expect(result.deactivated).toBe(0);
    expect(updateCallFor("wed-cancelled")).toBeUndefined();
  });

  it("D8: a MOVED session survives regeneration even when its weekday is removed", async () => {
    vi.mocked(prisma.trainingSeries.findFirst).mockResolvedValue(
      makeSeriesRow({
        recurrenceDays: [{ weekday: "MONDAY", startsAt: null, endsAt: null }],
      }) as never,
    );

    const existingRows = [
      ...MONDAYS_AUG_2026.map((d, i) => makeExistingScheduleRow(`mon${i + 1}`, d, "MONDAY")),
      makeExistingScheduleRow("wed-moved", "2026-08-05", "WEDNESDAY", "MOVED"),
    ];
    vi.mocked(prisma.trainingSession.findMany).mockResolvedValue(existingRows as never);

    const result = await generateTrainingSessions(TENANT_A, SERIES_ID, WINDOW);

    expect(result.deactivated).toBe(0);
    expect(updateCallFor("wed-moved")).toBeUndefined();
  });

  it("D9: a POSTPONED session survives regeneration even when its weekday is removed", async () => {
    vi.mocked(prisma.trainingSeries.findFirst).mockResolvedValue(
      makeSeriesRow({
        recurrenceDays: [{ weekday: "MONDAY", startsAt: null, endsAt: null }],
      }) as never,
    );

    const existingRows = [
      ...MONDAYS_AUG_2026.map((d, i) => makeExistingScheduleRow(`mon${i + 1}`, d, "MONDAY")),
      makeExistingScheduleRow("wed-postponed", "2026-08-05", "WEDNESDAY", "POSTPONED"),
    ];
    vi.mocked(prisma.trainingSession.findMany).mockResolvedValue(existingRows as never);

    const result = await generateTrainingSessions(TENANT_A, SERIES_ID, WINDOW);

    expect(result.deactivated).toBe(0);
    expect(updateCallFor("wed-postponed")).toBeUndefined();
  });

  it("D11: reconciliation queries and writes remain scoped to the calling tenant", async () => {
    vi.mocked(prisma.trainingSeries.findFirst).mockResolvedValue(makeSeriesRow() as never);
    vi.mocked(prisma.trainingSession.findMany).mockResolvedValue([] as never);

    await generateTrainingSessions(TENANT_A, SERIES_ID, WINDOW);

    // findTrainingSeriesById (tenant-scoped) gates every subsequent query —
    // a cross-tenant seriesId is already rejected as not-found (see A3).
    const seriesFindCall = vi.mocked(prisma.trainingSeries.findFirst).mock.calls[0][0] as {
      where: Record<string, unknown>;
    };
    expect(seriesFindCall.where).toMatchObject({ id: SERIES_ID, tenantId: TENANT_A });

    // The full-series reconciliation fetch is scoped by tenantId + trainingSeriesId.
    const sessionFindCall = vi.mocked(prisma.trainingSession.findMany).mock.calls[0][0] as {
      where: Record<string, unknown>;
    };
    expect(sessionFindCall.where).toMatchObject({
      tenantId: TENANT_A,
      trainingSeriesId: SERIES_ID,
    });
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

    const call = vi.mocked(prisma.trainingSession.findMany).mock.calls[0][0] as {
      where: Record<string, unknown>;
    };
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

  it("C5: listTrainingSessions excludes RECURRENCE_REMOVED rows by default (canonical consumers never see them)", async () => {
    vi.mocked(prisma.trainingSession.findMany).mockResolvedValue([] as never);

    await listTrainingSessions(TENANT_A, { trainingSeriesId: SERIES_ID });

    const call = vi.mocked(prisma.trainingSession.findMany).mock.calls[0][0] as {
      where: Record<string, unknown>;
    };
    expect(call.where).toMatchObject({ NOT: { status: "RECURRENCE_REMOVED" } });
  });

  it("C6: listTrainingSessions with includeInactive: true does not exclude RECURRENCE_REMOVED rows", async () => {
    vi.mocked(prisma.trainingSession.findMany).mockResolvedValue([] as never);

    await listTrainingSessions(TENANT_A, { trainingSeriesId: SERIES_ID, includeInactive: true });

    const call = vi.mocked(prisma.trainingSession.findMany).mock.calls[0][0] as {
      where: Record<string, unknown>;
    };
    expect(call.where).not.toHaveProperty("NOT");
  });

  it("C7: an explicit status filter is not combined with the default RECURRENCE_REMOVED exclusion", async () => {
    vi.mocked(prisma.trainingSession.findMany).mockResolvedValue([] as never);

    await listTrainingSessions(TENANT_A, {
      trainingSeriesId: SERIES_ID,
      status: "RECURRENCE_REMOVED",
    });

    const call = vi.mocked(prisma.trainingSession.findMany).mock.calls[0][0] as {
      where: Record<string, unknown>;
    };
    expect(call.where).toMatchObject({ status: "RECURRENCE_REMOVED" });
    expect(call.where).not.toHaveProperty("NOT");
  });
});
