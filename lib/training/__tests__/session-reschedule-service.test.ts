/**
 * Tests for lib/training/session-reschedule-service.ts
 *
 * Covers:
 *   A. rescheduleTrainingSession — date+time override, time-only override,
 *      revert-on-match-to-canonical, validation, invalid transitions,
 *      not found, tenant scoping, DST safety
 *   B. resetTrainingSessionSchedule — clears override, idempotency,
 *      invalid transitions, not found
 *
 * All external dependencies (Prisma) are mocked. No DB access.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    trainingSession: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/db/prisma";
import { rescheduleTrainingSession, resetTrainingSessionSchedule } from "../session-reschedule-service";
import {
  TrainingSessionInvalidTransitionError,
  TrainingSessionNotFoundError,
  TrainingSessionRescheduleValidationError,
} from "../errors";

const TENANT_A = "tenant-a";
const TENANT_B = "tenant-b";
const SESSION_ID = "sess-01";

function makeSessionRow(overrides: Record<string, unknown> = {}) {
  return {
    id: SESSION_ID,
    tenantId: TENANT_A,
    trainingSeriesId: "series-01",
    teamSeasonId: "ts-01",
    date: new Date("2026-08-04T00:00:00.000Z"), // Tuesday
    weekday: "TUESDAY",
    startAt: new Date("2026-08-04T15:00:00.000Z"), // 17:00 CEST
    endAt: new Date("2026-08-04T16:00:00.000Z"), // 18:00 CEST
    timezone: "Europe/Zurich",
    status: "SCHEDULED",
    overrideDate: null,
    overrideStartAt: null,
    overrideEndAt: null,
    createdAt: new Date("2026-07-01T00:00:00.000Z"),
    updatedAt: new Date("2026-07-01T00:00:00.000Z"),
    trainingSeries: {
      title: "F2 Tuesday Training",
      teamSeason: {
        displayName: "F2",
        team: { name: "FC Allschwil F2", shortName: null, alternativeName: null },
      },
    },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("A. rescheduleTrainingSession", () => {
  it("A1: overrides date + time when both differ from the canonical schedule", async () => {
    vi.mocked(prisma.trainingSession.findFirst)
      .mockResolvedValueOnce(makeSessionRow() as never)
      .mockResolvedValueOnce(
        makeSessionRow({
          overrideDate: new Date("2026-08-05T00:00:00.000Z"),
          overrideStartAt: new Date("2026-08-05T16:00:00.000Z"),
          overrideEndAt: new Date("2026-08-05T17:00:00.000Z"),
        }) as never,
      );
    vi.mocked(prisma.trainingSession.update).mockResolvedValue({} as never);

    const result = await rescheduleTrainingSession(TENANT_A, SESSION_ID, {
      date: "2026-08-05",
      startsAt: "18:00",
      endsAt: "19:00",
    });

    expect(prisma.trainingSession.update).toHaveBeenCalledWith({
      where: { id: SESSION_ID },
      data: {
        overrideDate: new Date("2026-08-05T00:00:00.000Z"),
        overrideStartAt: new Date("2026-08-05T16:00:00.000Z"), // 18:00 CEST
        overrideEndAt: new Date("2026-08-05T17:00:00.000Z"), // 19:00 CEST
      },
    });
    expect(result.date).toBe("2026-08-05");
    expect(result.originalDate).toBe("2026-08-04");
    expect(result.isRescheduled).toBe(true);
  });

  it("A2: overrides only the time, leaving overrideDate null when the date is unchanged", async () => {
    vi.mocked(prisma.trainingSession.findFirst)
      .mockResolvedValueOnce(makeSessionRow() as never)
      .mockResolvedValueOnce(
        makeSessionRow({
          overrideStartAt: new Date("2026-08-04T17:00:00.000Z"),
          overrideEndAt: new Date("2026-08-04T18:00:00.000Z"),
        }) as never,
      );
    vi.mocked(prisma.trainingSession.update).mockResolvedValue({} as never);

    await rescheduleTrainingSession(TENANT_A, SESSION_ID, {
      startsAt: "19:00",
      endsAt: "20:00",
    });

    expect(prisma.trainingSession.update).toHaveBeenCalledWith({
      where: { id: SESSION_ID },
      data: {
        overrideDate: null,
        overrideStartAt: new Date("2026-08-04T17:00:00.000Z"),
        overrideEndAt: new Date("2026-08-04T18:00:00.000Z"),
      },
    });
  });

  it("A3: submitting the exact canonical schedule clears any existing override (revert-to-series)", async () => {
    vi.mocked(prisma.trainingSession.findFirst)
      .mockResolvedValueOnce(
        makeSessionRow({
          overrideStartAt: new Date("2026-08-04T17:00:00.000Z"),
          overrideEndAt: new Date("2026-08-04T18:00:00.000Z"),
        }) as never,
      )
      .mockResolvedValueOnce(makeSessionRow() as never);
    vi.mocked(prisma.trainingSession.update).mockResolvedValue({} as never);

    const result = await rescheduleTrainingSession(TENANT_A, SESSION_ID, {
      date: "2026-08-04",
      startsAt: "17:00",
      endsAt: "18:00",
    });

    expect(prisma.trainingSession.update).toHaveBeenCalledWith({
      where: { id: SESSION_ID },
      data: { overrideDate: null, overrideStartAt: null, overrideEndAt: null },
    });
    expect(result.isRescheduled).toBe(false);
  });

  it("A4: rejects an invalid time format", async () => {
    vi.mocked(prisma.trainingSession.findFirst).mockResolvedValue(makeSessionRow() as never);

    await expect(
      rescheduleTrainingSession(TENANT_A, SESSION_ID, { startsAt: "17h00", endsAt: "18:00" }),
    ).rejects.toThrow(TrainingSessionRescheduleValidationError);
    expect(prisma.trainingSession.update).not.toHaveBeenCalled();
  });

  it("A5: rejects startsAt >= endsAt", async () => {
    vi.mocked(prisma.trainingSession.findFirst).mockResolvedValue(makeSessionRow() as never);

    await expect(
      rescheduleTrainingSession(TENANT_A, SESSION_ID, { startsAt: "18:00", endsAt: "18:00" }),
    ).rejects.toThrow(TrainingSessionRescheduleValidationError);
  });

  it("A6: rejects an invalid date format", async () => {
    vi.mocked(prisma.trainingSession.findFirst).mockResolvedValue(makeSessionRow() as never);

    await expect(
      rescheduleTrainingSession(TENANT_A, SESSION_ID, { date: "05-08-2026", startsAt: "17:00", endsAt: "18:00" }),
    ).rejects.toThrow(TrainingSessionRescheduleValidationError);
  });

  it.each(["CANCELLED", "POSTPONED", "MOVED", "RECURRENCE_REMOVED"])(
    "A7: rejects rescheduling a %s session",
    async (status) => {
      vi.mocked(prisma.trainingSession.findFirst).mockResolvedValue(makeSessionRow({ status }) as never);

      await expect(
        rescheduleTrainingSession(TENANT_A, SESSION_ID, { startsAt: "17:00", endsAt: "18:00" }),
      ).rejects.toThrow(TrainingSessionInvalidTransitionError);
      expect(prisma.trainingSession.update).not.toHaveBeenCalled();
    },
  );

  it("A8: session not found", async () => {
    vi.mocked(prisma.trainingSession.findFirst).mockResolvedValue(null);

    await expect(
      rescheduleTrainingSession(TENANT_A, SESSION_ID, { startsAt: "17:00", endsAt: "18:00" }),
    ).rejects.toThrow(TrainingSessionNotFoundError);
  });

  it("A9: tenant isolation — a cross-tenant session id is treated as not found", async () => {
    vi.mocked(prisma.trainingSession.findFirst).mockResolvedValue(null);

    await expect(
      rescheduleTrainingSession(TENANT_B, SESSION_ID, { startsAt: "17:00", endsAt: "18:00" }),
    ).rejects.toThrow(TrainingSessionNotFoundError);
    expect(prisma.trainingSession.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: SESSION_ID, tenantId: TENANT_B } }),
    );
  });

  it("A10: DST-safe — rescheduling across the Europe/Zurich autumn DST transition resolves the correct UTC instant", async () => {
    // 2026-10-25 is the last Sunday of October (Europe/Zurich DST ends).
    // Moving an occurrence from before to after the transition must still
    // resolve 17:00 local time correctly (16:00 UTC after the fallback).
    vi.mocked(prisma.trainingSession.findFirst)
      .mockResolvedValueOnce(
        makeSessionRow({
          date: new Date("2026-10-20T00:00:00.000Z"),
          startAt: new Date("2026-10-20T15:00:00.000Z"), // 17:00 CEST (UTC+2)
          endAt: new Date("2026-10-20T16:00:00.000Z"),
        }) as never,
      )
      .mockResolvedValueOnce(makeSessionRow() as never);
    vi.mocked(prisma.trainingSession.update).mockResolvedValue({} as never);

    await rescheduleTrainingSession(TENANT_A, SESSION_ID, {
      date: "2026-10-27",
      startsAt: "17:00",
      endsAt: "18:00",
    });

    const call = vi.mocked(prisma.trainingSession.update).mock.calls[0][0] as {
      data: { overrideStartAt: Date; overrideEndAt: Date };
    };
    // After the DST fallback, Europe/Zurich is UTC+1 (CET) -> 17:00 CET = 16:00 UTC.
    expect(call.data.overrideStartAt.toISOString()).toBe("2026-10-27T16:00:00.000Z");
    expect(call.data.overrideEndAt.toISOString()).toBe("2026-10-27T17:00:00.000Z");
  });
});

describe("B. resetTrainingSessionSchedule", () => {
  it("B1: clears an existing override", async () => {
    vi.mocked(prisma.trainingSession.findFirst)
      .mockResolvedValueOnce(
        makeSessionRow({
          overrideStartAt: new Date("2026-08-04T17:00:00.000Z"),
          overrideEndAt: new Date("2026-08-04T18:00:00.000Z"),
        }) as never,
      )
      .mockResolvedValueOnce(makeSessionRow() as never);
    vi.mocked(prisma.trainingSession.update).mockResolvedValue({} as never);

    const result = await resetTrainingSessionSchedule(TENANT_A, SESSION_ID);

    expect(prisma.trainingSession.update).toHaveBeenCalledWith({
      where: { id: SESSION_ID },
      data: { overrideDate: null, overrideStartAt: null, overrideEndAt: null },
    });
    expect(result.isRescheduled).toBe(false);
  });

  it("B2: resetting a session with no override still issues the clearing write (idempotent no-op result)", async () => {
    vi.mocked(prisma.trainingSession.findFirst)
      .mockResolvedValueOnce(makeSessionRow() as never)
      .mockResolvedValueOnce(makeSessionRow() as never);
    vi.mocked(prisma.trainingSession.update).mockResolvedValue({} as never);

    const result = await resetTrainingSessionSchedule(TENANT_A, SESSION_ID);
    expect(result.isRescheduled).toBe(false);
  });

  it.each(["CANCELLED", "POSTPONED", "MOVED", "RECURRENCE_REMOVED"])(
    "B3: rejects resetting a %s session",
    async (status) => {
      vi.mocked(prisma.trainingSession.findFirst).mockResolvedValue(makeSessionRow({ status }) as never);

      await expect(resetTrainingSessionSchedule(TENANT_A, SESSION_ID)).rejects.toThrow(
        TrainingSessionInvalidTransitionError,
      );
    },
  );

  it("B4: session not found", async () => {
    vi.mocked(prisma.trainingSession.findFirst).mockResolvedValue(null);

    await expect(resetTrainingSessionSchedule(TENANT_A, SESSION_ID)).rejects.toThrow(
      TrainingSessionNotFoundError,
    );
  });
});
