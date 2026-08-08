/**
 * Tests for lib/training/session-lifecycle-service.ts
 *
 * Covers:
 *   A. cancelTrainingSession  — SCHEDULED -> CANCELLED, idempotency, invalid transitions, not found, tenant scoping
 *   B. restoreTrainingSession — CANCELLED -> SCHEDULED, idempotency, invalid transitions, not found
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
import { cancelTrainingSession, restoreTrainingSession } from "../session-lifecycle-service";
import { TrainingSessionInvalidTransitionError, TrainingSessionNotFoundError } from "../errors";

const TENANT_A = "tenant-a";
const TENANT_B = "tenant-b";
const SESSION_ID = "sess-01";

function makeSessionRow(overrides: Record<string, unknown> = {}) {
  return {
    id: SESSION_ID,
    tenantId: TENANT_A,
    trainingSeriesId: "series-01",
    teamSeasonId: "ts-01",
    date: new Date("2026-08-03T00:00:00.000Z"),
    weekday: "MONDAY",
    startAt: new Date("2026-08-03T15:00:00.000Z"),
    endAt: new Date("2026-08-03T16:00:00.000Z"),
    timezone: "Europe/Zurich",
    status: "SCHEDULED",
    createdAt: new Date("2026-07-01T00:00:00.000Z"),
    updatedAt: new Date("2026-07-01T00:00:00.000Z"),
    trainingSeries: {
      title: "F2 Monday Training",
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

describe("A. cancelTrainingSession", () => {
  it("A1: SCHEDULED -> CANCELLED", async () => {
    vi.mocked(prisma.trainingSession.findFirst)
      .mockResolvedValueOnce(makeSessionRow() as never)
      .mockResolvedValueOnce(makeSessionRow({ status: "CANCELLED" }) as never);
    vi.mocked(prisma.trainingSession.update).mockResolvedValue({} as never);

    const result = await cancelTrainingSession(TENANT_A, SESSION_ID);

    expect(prisma.trainingSession.update).toHaveBeenCalledWith({
      where: { id: SESSION_ID },
      data: { status: "CANCELLED" },
    });
    expect(result.status).toBe("CANCELLED");
  });

  it("A2: cancelling an already-CANCELLED session is idempotent (no write issued)", async () => {
    vi.mocked(prisma.trainingSession.findFirst).mockResolvedValue(
      makeSessionRow({ status: "CANCELLED" }) as never,
    );

    const result = await cancelTrainingSession(TENANT_A, SESSION_ID);

    expect(prisma.trainingSession.update).not.toHaveBeenCalled();
    expect(result.status).toBe("CANCELLED");
  });

  it.each(["POSTPONED", "MOVED", "RECURRENCE_REMOVED"])(
    "A3: rejects cancelling a %s session",
    async (status) => {
      vi.mocked(prisma.trainingSession.findFirst).mockResolvedValue(
        makeSessionRow({ status }) as never,
      );

      await expect(cancelTrainingSession(TENANT_A, SESSION_ID)).rejects.toThrow(
        TrainingSessionInvalidTransitionError,
      );
      expect(prisma.trainingSession.update).not.toHaveBeenCalled();
    },
  );

  it("A4: session not found", async () => {
    vi.mocked(prisma.trainingSession.findFirst).mockResolvedValue(null);

    await expect(cancelTrainingSession(TENANT_A, SESSION_ID)).rejects.toThrow(
      TrainingSessionNotFoundError,
    );
  });

  it("A5: tenant isolation — a cross-tenant session id is treated as not found", async () => {
    vi.mocked(prisma.trainingSession.findFirst).mockResolvedValue(null);

    await expect(cancelTrainingSession(TENANT_B, SESSION_ID)).rejects.toThrow(
      TrainingSessionNotFoundError,
    );
    expect(prisma.trainingSession.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: SESSION_ID, tenantId: TENANT_B } }),
    );
  });
});

describe("B. restoreTrainingSession", () => {
  it("B1: CANCELLED -> SCHEDULED", async () => {
    vi.mocked(prisma.trainingSession.findFirst)
      .mockResolvedValueOnce(makeSessionRow({ status: "CANCELLED" }) as never)
      .mockResolvedValueOnce(makeSessionRow({ status: "SCHEDULED" }) as never);
    vi.mocked(prisma.trainingSession.update).mockResolvedValue({} as never);

    const result = await restoreTrainingSession(TENANT_A, SESSION_ID);

    expect(prisma.trainingSession.update).toHaveBeenCalledWith({
      where: { id: SESSION_ID },
      data: { status: "SCHEDULED" },
    });
    expect(result.status).toBe("SCHEDULED");
  });

  it("B2: restoring an already-SCHEDULED session is idempotent (no write issued)", async () => {
    vi.mocked(prisma.trainingSession.findFirst).mockResolvedValue(makeSessionRow() as never);

    const result = await restoreTrainingSession(TENANT_A, SESSION_ID);

    expect(prisma.trainingSession.update).not.toHaveBeenCalled();
    expect(result.status).toBe("SCHEDULED");
  });

  it.each(["POSTPONED", "MOVED", "RECURRENCE_REMOVED"])(
    "B3: rejects restoring a %s session",
    async (status) => {
      vi.mocked(prisma.trainingSession.findFirst).mockResolvedValue(
        makeSessionRow({ status }) as never,
      );

      await expect(restoreTrainingSession(TENANT_A, SESSION_ID)).rejects.toThrow(
        TrainingSessionInvalidTransitionError,
      );
      expect(prisma.trainingSession.update).not.toHaveBeenCalled();
    },
  );

  it("B4: session not found", async () => {
    vi.mocked(prisma.trainingSession.findFirst).mockResolvedValue(null);

    await expect(restoreTrainingSession(TENANT_A, SESSION_ID)).rejects.toThrow(
      TrainingSessionNotFoundError,
    );
  });
});
