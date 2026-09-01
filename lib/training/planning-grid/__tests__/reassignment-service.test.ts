/**
 * lib/training/planning-grid/__tests__/reassignment-service.test.ts
 *
 * TRAINING-CENTER-PREMIUM-03A — canonical reassignment authority tests.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  trainingSessionFindFirst: vi.fn(),
  trainingSessionFindMany: vi.fn(),
  facilityResourceFindFirst: vi.fn(),
  getResourceAvailability: vi.fn(),
  listAllocationsByTrainingSession: vi.fn(),
  deleteTrainingSessionAllocation: vi.fn(),
  createTrainingSessionAllocation: vi.fn(),
  listAllocationsByTrainingSeries: vi.fn(),
  deleteTrainingAllocation: vi.fn(),
  createTrainingAllocation: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    trainingSession: {
      findFirst: mocks.trainingSessionFindFirst,
      findMany: mocks.trainingSessionFindMany,
    },
    facilityResource: {
      findFirst: mocks.facilityResourceFindFirst,
    },
  },
}));

vi.mock("@/lib/facilities/availability-service", () => ({
  getResourceAvailability: mocks.getResourceAvailability,
}));

vi.mock("@/lib/training/session-allocation-service", () => ({
  listAllocationsByTrainingSession: mocks.listAllocationsByTrainingSession,
  deleteTrainingSessionAllocation: mocks.deleteTrainingSessionAllocation,
  createTrainingSessionAllocation: mocks.createTrainingSessionAllocation,
}));

vi.mock("@/lib/training/training-allocation-service", () => ({
  listAllocationsByTrainingSeries: mocks.listAllocationsByTrainingSeries,
  deleteTrainingAllocation: mocks.deleteTrainingAllocation,
  createTrainingAllocation: mocks.createTrainingAllocation,
}));

import { reassignPlanningGridResource } from "../reassignment-service";
import { TrainingSessionNotFoundError } from "@/lib/training/errors";

const TENANT = "tenant-a";
const SESSION_ID = "session-1";
const SERIES_ID = "series-1";
const TARGET_RESOURCE = "resource-target";

function makeSession(overrides: Record<string, unknown> = {}) {
  return {
    id: SESSION_ID,
    trainingSeriesId: SERIES_ID,
    date: "2026-09-02",
    status: "SCHEDULED",
    startAt: new Date("2026-09-02T15:15:00.000Z"),
    endAt: new Date("2026-09-02T16:45:00.000Z"),
    overrideStartAt: null,
    overrideEndAt: null,
    ...overrides,
  };
}

function makeResource(type = "FULL_PITCH") {
  return {
    id: TARGET_RESOURCE,
    type,
    facility: { status: "ACTIVE" },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.trainingSessionFindFirst.mockResolvedValue(makeSession());
  mocks.facilityResourceFindFirst.mockResolvedValue(makeResource());
  mocks.getResourceAvailability.mockResolvedValue([
    { resourceId: TARGET_RESOURCE, status: "FREE", conflictLabel: null },
  ]);
  mocks.listAllocationsByTrainingSession.mockResolvedValue([]);
  mocks.createTrainingSessionAllocation.mockResolvedValue({});
  mocks.listAllocationsByTrainingSeries.mockResolvedValue([]);
  mocks.createTrainingAllocation.mockResolvedValue({});
});

describe("reassignPlanningGridResource — server authority", () => {
  it("rejects when session is missing", async () => {
    mocks.trainingSessionFindFirst.mockResolvedValue(null);
    await expect(
      reassignPlanningGridResource({
        tenantId: TENANT,
        sessionId: SESSION_ID,
        targetResourceId: TARGET_RESOURCE,
        category: "PITCH_HALL",
        scope: "occurrence",
      }),
    ).rejects.toBeInstanceOf(TrainingSessionNotFoundError);
  });

  it("rejects non-scheduled sessions", async () => {
    mocks.trainingSessionFindFirst.mockResolvedValue(makeSession({ status: "CANCELLED" }));
    await expect(
      reassignPlanningGridResource({
        tenantId: TENANT,
        sessionId: SESSION_ID,
        targetResourceId: TARGET_RESOURCE,
        category: "PITCH_HALL",
        scope: "occurrence",
      }),
    ).rejects.toThrow("Nur geplante Trainings");
  });

  it("rejects when canonical availability marks the target OCCUPIED (training conflict)", async () => {
    mocks.getResourceAvailability.mockResolvedValue([
      {
        resourceId: TARGET_RESOURCE,
        status: "OCCUPIED",
        conflictLabel: "Team Beta",
        conflictSourceType: "TRAINING",
      },
    ]);

    await expect(
      reassignPlanningGridResource({
        tenantId: TENANT,
        sessionId: SESSION_ID,
        targetResourceId: TARGET_RESOURCE,
        category: "PITCH_HALL",
        scope: "occurrence",
      }),
    ).rejects.toThrow("Konflikt — Team Beta");

    expect(mocks.createTrainingSessionAllocation).not.toHaveBeenCalled();
  });

  it("rejects when canonical availability marks the target OCCUPIED (match conflict)", async () => {
    mocks.getResourceAvailability.mockResolvedValue([
      {
        resourceId: TARGET_RESOURCE,
        status: "OCCUPIED",
        conflictLabel: "vs. FC Muttenz",
        conflictSourceType: "MATCH",
      },
    ]);

    await expect(
      reassignPlanningGridResource({
        tenantId: TENANT,
        sessionId: SESSION_ID,
        targetResourceId: TARGET_RESOURCE,
        category: "PITCH_HALL",
        scope: "occurrence",
      }),
    ).rejects.toThrow("Konflikt — vs. FC Muttenz");
  });

  it("excludes the moved session from availability checks", async () => {
    await reassignPlanningGridResource({
      tenantId: TENANT,
      sessionId: SESSION_ID,
      targetResourceId: TARGET_RESOURCE,
      category: "PITCH_HALL",
      scope: "occurrence",
    });

    expect(mocks.getResourceAvailability).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: TENANT,
        excludeTrainingSessionId: SESSION_ID,
        group: "PITCH_HALL",
      }),
    );
  });

  it("creates an occurrence override when scope is occurrence", async () => {
    await reassignPlanningGridResource({
      tenantId: TENANT,
      sessionId: SESSION_ID,
      targetResourceId: TARGET_RESOURCE,
      category: "PITCH_HALL",
      scope: "occurrence",
    });

    expect(mocks.createTrainingSessionAllocation).toHaveBeenCalledWith(TENANT, {
      trainingSessionId: SESSION_ID,
      facilityResourceId: TARGET_RESOURCE,
    });
    expect(mocks.createTrainingAllocation).not.toHaveBeenCalled();
  });

  it("mutates the series allocation when scope is series", async () => {
    mocks.listAllocationsByTrainingSeries.mockResolvedValue([
      {
        id: "alloc-1",
        facilityResourceType: "FULL_PITCH",
      },
    ]);

    await reassignPlanningGridResource({
      tenantId: TENANT,
      sessionId: SESSION_ID,
      targetResourceId: TARGET_RESOURCE,
      category: "PITCH_HALL",
      scope: "series",
    });

    expect(mocks.deleteTrainingAllocation).toHaveBeenCalledWith(TENANT, "alloc-1");
    expect(mocks.createTrainingAllocation).toHaveBeenCalledWith(TENANT, {
      trainingSeriesId: SERIES_ID,
      facilityResourceId: TARGET_RESOURCE,
    });
    expect(mocks.createTrainingSessionAllocation).not.toHaveBeenCalled();
  });

  it("uses training-only overlap checks for OTHER resources", async () => {
    mocks.facilityResourceFindFirst.mockResolvedValue(makeResource("OTHER"));
    mocks.trainingSessionFindMany.mockResolvedValue([
      {
        id: "session-other",
        startAt: new Date("2026-09-02T15:15:00.000Z"),
        endAt: new Date("2026-09-02T16:45:00.000Z"),
        overrideStartAt: null,
        overrideEndAt: null,
        trainingSeries: {
          title: "Fitness Block",
          allocations: [{ facilityResourceId: TARGET_RESOURCE, facilityResource: { type: "OTHER" } }],
        },
        sessionAllocations: [],
      },
    ]);

    await expect(
      reassignPlanningGridResource({
        tenantId: TENANT,
        sessionId: SESSION_ID,
        targetResourceId: TARGET_RESOURCE,
        category: "OTHER",
        scope: "occurrence",
      }),
    ).rejects.toThrow("Konflikt — Fitness Block");

    expect(mocks.getResourceAvailability).not.toHaveBeenCalled();
  });
});
