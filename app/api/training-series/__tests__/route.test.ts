/**
 * app/api/training-series/__tests__/route.test.ts
 *
 * API regression tests for TrainingSeries create route (TRAININGCENTER-03A).
 *
 * POST /api/training-series
 *
 * Tests:
 *   A. Auth / permission gating
 *   B. Body validation (teamSeasonId, title, validFrom/validUntil, weekdaySchedules)
 *   C. Success path — creates the series, generates sessions, returns both
 *   D. Domain error mapping
 *   E. RESOURCE-AVAILABILITY-UX-01-C1 / -C1-V — atomic default-allocation
 *      propagation: facilityResourceIds are persisted as TrainingAllocation
 *      rows in THIS same request (no separate client follow-up request
 *      required), a failed individual resource ROLLS BACK the newly created
 *      series/sessions (deleteTrainingSeriesPermanently) and fails the
 *      whole request instead of returning a partially-configured 201, and
 *      omitting the field entirely remains fully backward compatible
 *      (resources stay optional).
 */

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Hoisted mocks ─────────────────────────────────────────────────────────────

// ORG-ACCESS-03: route now uses auth() + planning policy instead of requireApiAnyPermission.
const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  canCreateForTeamSeason: vi.fn(),
  logAction: vi.fn(),
  createTrainingSeries: vi.fn(),
  getTrainingSeries: vi.fn(),
  generateTrainingSessions: vi.fn(),
  createTrainingAllocation: vi.fn(),
  deleteTrainingSeriesPermanently: vi.fn(),
}));

vi.mock("@/auth", () => ({
  auth: mocks.auth,
}));

vi.mock("@/lib/planning/planning-authorization-policy", () => ({
  createPlanningAuthorizationPolicy: () => ({
    canCreateForTeamSeason: mocks.canCreateForTeamSeason,
  }),
}));

vi.mock("@/lib/audit/log-action", () => ({
  logAction: mocks.logAction,
}));

vi.mock("@/lib/training/training-service", () => ({
  createTrainingSeries: mocks.createTrainingSeries,
  getTrainingSeries: mocks.getTrainingSeries,
}));

vi.mock("@/lib/training/session-generation-service", () => ({
  generateTrainingSessions: mocks.generateTrainingSessions,
}));

vi.mock("@/lib/training/training-allocation-service", () => ({
  createTrainingAllocation: mocks.createTrainingAllocation,
}));

vi.mock("@/lib/training/training-lifecycle-service", () => ({
  deleteTrainingSeriesPermanently: mocks.deleteTrainingSeriesPermanently,
}));

vi.mock("@/lib/db/prisma", () => ({ prisma: {} }));

import { POST } from "../route";
import {
  TrainingSeriesValidationError,
  TrainingSeriesConflictError,
  TrainingSeriesTeamSeasonNotFoundError,
  TrainingSeriesArchivedTeamError,
} from "@/lib/training/errors";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const TENANT_A = "tenant-a";
const SERIES_ID = "series-01";
const TEAM_SEASON_ID = "ts-01";

const VALID_BODY = {
  teamSeasonId: TEAM_SEASON_ID,
  title: "E1 Dienstagstraining",
  validFrom: "2026-08-01",
  validUntil: "2026-08-31",
  weekdaySchedules: [
    { weekday: "MONDAY", startsAt: "17:00", endsAt: "18:00" },
    { weekday: "WEDNESDAY", startsAt: "16:00", endsAt: "17:00" },
  ],
};

// ORG-ACCESS-03: auth() returns Session shape directly (no ok/status).
function makeAuthOk() {
  return { user: { id: "user-1", activeTenantId: TENANT_A } };
}

function makeSeriesDto(overrides: Record<string, unknown> = {}) {
  return {
    id: SERIES_ID,
    tenantId: TENANT_A,
    teamSeasonId: TEAM_SEASON_ID,
    title: "E1 Dienstagstraining",
    description: null,
    status: "ACTIVE",
    startsAt: "16:00",
    endsAt: "18:00",
    timezone: "Europe/Zurich",
    weekdays: ["MONDAY", "WEDNESDAY"],
    weekdaySchedules: [
      { weekday: "MONDAY", startsAt: "17:00", endsAt: "18:00" },
      { weekday: "WEDNESDAY", startsAt: "16:00", endsAt: "17:00" },
    ],
    validFrom: "2026-08-01T00:00:00.000Z",
    validUntil: "2026-08-31T00:00:00.000Z",
    archivedAt: null,
    sessionCount: 0,
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

function makePostRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/training-series", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  // ORG-ACCESS-03: auth() and planning policy replace requireApiAnyPermission.
  mocks.auth.mockResolvedValue(makeAuthOk());
  mocks.canCreateForTeamSeason.mockResolvedValue({
    allowed: true,
    isCoordinator: true,
    isScoped: false,
    teamId: "team-e1",
  });
  mocks.logAction.mockResolvedValue(undefined);
  mocks.createTrainingSeries.mockResolvedValue(makeSeriesDto());
  mocks.generateTrainingSessions.mockResolvedValue({
    trainingSeriesId: SERIES_ID,
    occurrencesInWindow: 9,
    created: 9,
    updated: 0,
    unchanged: 0,
  });
  mocks.getTrainingSeries.mockResolvedValue(makeSeriesDto({ sessionCount: 9 }));
  mocks.createTrainingAllocation.mockResolvedValue({ id: "allocation-01" });
  mocks.deleteTrainingSeriesPermanently.mockResolvedValue({ deleted: { id: SERIES_ID }, impact: [] });
});

// ── A. Auth / permission gating ──────────────────────────────────────────────

describe("A. POST /api/training-series — auth", () => {
  it("A1. returns 401 when unauthenticated", async () => {
    mocks.auth.mockResolvedValue(null);
    const res = await POST(makePostRequest(VALID_BODY));
    expect(res.status).toBe(401);
  });

  it("A2. returns 403 when planning policy denies creation (no scope for team)", async () => {
    mocks.canCreateForTeamSeason.mockResolvedValue({
      allowed: false,
      isCoordinator: false,
      isScoped: false,
      teamId: null,
      reason: "Keine Schreibberechtigung.",
    });
    const res = await POST(makePostRequest(VALID_BODY));
    expect(res.status).toBe(403);
  });

  it("A3. returns 400 when tenant context missing", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "user-1", activeTenantId: undefined } });
    const res = await POST(makePostRequest(VALID_BODY));
    expect(res.status).toBe(400);
  });
});

// ── B. Body validation ────────────────────────────────────────────────────────

describe("B. POST /api/training-series — validation", () => {
  it("B1. returns 400 when request body is missing", async () => {
    const req = new NextRequest("http://localhost/api/training-series", { method: "POST" });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("B2. returns 400 when teamSeasonId is missing", async () => {
    const res = await POST(makePostRequest({ ...VALID_BODY, teamSeasonId: undefined }));
    expect(res.status).toBe(400);
  });

  it("B3. returns 400 when title is missing", async () => {
    const res = await POST(makePostRequest({ ...VALID_BODY, title: "" }));
    expect(res.status).toBe(400);
  });

  it("B4. returns 400 when validFrom is missing", async () => {
    const res = await POST(makePostRequest({ ...VALID_BODY, validFrom: undefined }));
    expect(res.status).toBe(400);
  });

  it("B5. returns 400 when validUntil is before validFrom", async () => {
    const res = await POST(
      makePostRequest({ ...VALID_BODY, validFrom: "2026-09-01", validUntil: "2026-08-01" }),
    );
    expect(res.status).toBe(400);
  });

  it("B6. returns 400 when weekdaySchedules is empty", async () => {
    const res = await POST(makePostRequest({ ...VALID_BODY, weekdaySchedules: [] }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/weekdaySchedules/i);
  });

  it("B7. returns 400 when a weekdaySchedules entry has an invalid weekday", async () => {
    const res = await POST(
      makePostRequest({ ...VALID_BODY, weekdaySchedules: [{ weekday: "FUNDAY", startsAt: "17:00", endsAt: "18:00" }] }),
    );
    expect(res.status).toBe(400);
  });

  it("B8. returns 400 when a weekdaySchedules entry has startsAt after endsAt", async () => {
    const res = await POST(
      makePostRequest({
        ...VALID_BODY,
        weekdaySchedules: [{ weekday: "MONDAY", startsAt: "18:00", endsAt: "17:00" }],
      }),
    );
    expect(res.status).toBe(400);
  });

  it("B9. returns 400 when weekdaySchedules has duplicate weekdays", async () => {
    const res = await POST(
      makePostRequest({
        ...VALID_BODY,
        weekdaySchedules: [
          { weekday: "MONDAY", startsAt: "17:00", endsAt: "18:00" },
          { weekday: "MONDAY", startsAt: "19:00", endsAt: "20:00" },
        ],
      }),
    );
    expect(res.status).toBe(400);
  });

  it("B10. invalid JSON body returns 400", async () => {
    const req = new NextRequest("http://localhost/api/training-series", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json-{{",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});

// ── C. Success path ───────────────────────────────────────────────────────────

describe("C. POST /api/training-series — success", () => {
  it("C1. creates the series, generates sessions across [validFrom, validUntil], and returns both", async () => {
    const res = await POST(makePostRequest(VALID_BODY));

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.series.id).toBe(SERIES_ID);
    expect(body.series.sessionCount).toBe(9);
    expect(body.generation).toEqual({
      trainingSeriesId: SERIES_ID,
      occurrencesInWindow: 9,
      created: 9,
      updated: 0,
      unchanged: 0,
    });

    expect(mocks.createTrainingSeries).toHaveBeenCalledWith(
      TENANT_A,
      expect.objectContaining({
        teamSeasonId: TEAM_SEASON_ID,
        weekdays: ["MONDAY", "WEDNESDAY"],
        weekdayTimes: VALID_BODY.weekdaySchedules,
      }),
    );
    expect(mocks.generateTrainingSessions).toHaveBeenCalledWith(
      TENANT_A,
      SERIES_ID,
      { from: new Date("2026-08-01"), to: new Date("2026-08-31") },
    );
  });

  it("C2. defaults timezone to Europe/Zurich when not provided", async () => {
    await POST(makePostRequest(VALID_BODY));

    expect(mocks.createTrainingSeries).toHaveBeenCalledWith(
      TENANT_A,
      expect.objectContaining({ timezone: "Europe/Zurich" }),
    );
  });

  it("C3. derives the series-level startsAt/endsAt envelope (earliest start, latest end)", async () => {
    await POST(makePostRequest(VALID_BODY));

    expect(mocks.createTrainingSeries).toHaveBeenCalledWith(
      TENANT_A,
      expect.objectContaining({ startsAt: "16:00", endsAt: "18:00" }),
    );
  });
});

// ── D. Domain error mapping ───────────────────────────────────────────────────

describe("D. POST /api/training-series — domain error mapping", () => {
  it("D1. TrainingSeriesValidationError -> 400", async () => {
    mocks.createTrainingSeries.mockRejectedValue(new TrainingSeriesValidationError("bad input"));
    const res = await POST(makePostRequest(VALID_BODY));
    expect(res.status).toBe(400);
  });

  it("D2. TrainingSeriesTeamSeasonNotFoundError -> 404", async () => {
    mocks.createTrainingSeries.mockRejectedValue(new TrainingSeriesTeamSeasonNotFoundError(TEAM_SEASON_ID));
    const res = await POST(makePostRequest(VALID_BODY));
    expect(res.status).toBe(404);
  });

  it("D3. TrainingSeriesArchivedTeamError -> 422", async () => {
    mocks.createTrainingSeries.mockRejectedValue(new TrainingSeriesArchivedTeamError("team-1"));
    const res = await POST(makePostRequest(VALID_BODY));
    expect(res.status).toBe(422);
  });

  it("D4. TrainingSeriesConflictError -> 409", async () => {
    mocks.createTrainingSeries.mockRejectedValue(new TrainingSeriesConflictError("duplicate"));
    const res = await POST(makePostRequest(VALID_BODY));
    expect(res.status).toBe(409);
  });
});

// ── E. RESOURCE-AVAILABILITY-UX-01-C1 / -C1-V — atomic default-allocation ───
//     propagation (create + generate + allocate succeed or fail together)

describe("E. POST /api/training-series — facilityResourceIds (atomic default allocations)", () => {
  it("E1. persists each facilityResourceId as a TrainingAllocation for the newly created series, in this same request", async () => {
    const res = await POST(
      makePostRequest({ ...VALID_BODY, facilityResourceIds: ["res-pitch-1", "res-dressing-1"] }),
    );

    expect(res.status).toBe(201);
    expect(mocks.createTrainingAllocation).toHaveBeenCalledTimes(2);
    expect(mocks.createTrainingAllocation).toHaveBeenNthCalledWith(1, TENANT_A, {
      trainingSeriesId: SERIES_ID,
      facilityResourceId: "res-pitch-1",
    });
    expect(mocks.createTrainingAllocation).toHaveBeenNthCalledWith(2, TENANT_A, {
      trainingSeriesId: SERIES_ID,
      facilityResourceId: "res-dressing-1",
    });
    expect(mocks.deleteTrainingSeriesPermanently).not.toHaveBeenCalled();

    const body = await res.json();
    expect(body.series.id).toBe(SERIES_ID);
    expect(body.error).toBeUndefined();

    // The allocation attempts happen strictly AFTER the series (and its
    // sessions) already exist — proving there is no window in which the
    // series exists without its sessions ready to receive the allocation.
    const seriesCallOrder = mocks.createTrainingSeries.mock.invocationCallOrder[0];
    const allocationCallOrder = mocks.createTrainingAllocation.mock.invocationCallOrder[0];
    expect(seriesCallOrder).toBeLessThan(allocationCallOrder);
  });

  it("E2. omitting facilityResourceIds entirely creates zero allocations (backward compatible — resources stay optional)", async () => {
    const res = await POST(makePostRequest(VALID_BODY));

    expect(res.status).toBe(201);
    expect(mocks.createTrainingAllocation).not.toHaveBeenCalled();
    expect(mocks.deleteTrainingSeriesPermanently).not.toHaveBeenCalled();
    const body = await res.json();
    expect(body.series.id).toBe(SERIES_ID);
  });

  it("E3. an empty facilityResourceIds array behaves like omitting the field", async () => {
    const res = await POST(makePostRequest({ ...VALID_BODY, facilityResourceIds: [] }));

    expect(res.status).toBe(201);
    expect(mocks.createTrainingAllocation).not.toHaveBeenCalled();
  });

  it("E4. deduplicates repeated facilityResourceIds before attempting allocation", async () => {
    await POST(makePostRequest({ ...VALID_BODY, facilityResourceIds: ["res-pitch-1", "res-pitch-1"] }));

    expect(mocks.createTrainingAllocation).toHaveBeenCalledTimes(1);
  });

  it("E5. a failed individual resource (e.g. archived) rolls back the newly created series/sessions instead of returning a partial 201", async () => {
    mocks.createTrainingAllocation.mockRejectedValueOnce(
      new Error("FacilityResource is archived and cannot receive new allocations"),
    );

    const res = await POST(
      makePostRequest({ ...VALID_BODY, facilityResourceIds: ["res-archived", "res-dressing-1"] }),
    );

    // The whole request fails — never a 201 for a series missing a
    // requested default allocation.
    expect(res.status).not.toBe(201);
    const body = await res.json();
    expect(body.error).toBe("FacilityResource is archived and cannot receive new allocations");
    expect(body.series).toBeUndefined();

    // The already-created series is rolled back via the SAME hard-delete
    // service ADMIN-DELETE-02A already uses (cascades sessions + any
    // allocations already attached).
    expect(mocks.deleteTrainingSeriesPermanently).toHaveBeenCalledWith(TENANT_A, SERIES_ID);

    // Stops at the first failure — the second resource is never attempted
    // once rollback is inevitable.
    expect(mocks.createTrainingAllocation).toHaveBeenCalledTimes(1);
  });

  it("E5a. maps the underlying allocation error type to the same HTTP status the standalone allocations endpoint uses", async () => {
    const { TrainingAllocationResourceNotFoundError } = await import("@/lib/training/errors");
    mocks.createTrainingAllocation.mockRejectedValueOnce(
      new TrainingAllocationResourceNotFoundError("res-missing"),
    );

    const res = await POST(makePostRequest({ ...VALID_BODY, facilityResourceIds: ["res-missing"] }));

    expect(res.status).toBe(404);
    expect(mocks.deleteTrainingSeriesPermanently).toHaveBeenCalledWith(TENANT_A, SERIES_ID);
  });

  it("E6. returns 400 when facilityResourceIds is not an array", async () => {
    const res = await POST(makePostRequest({ ...VALID_BODY, facilityResourceIds: "not-an-array" }));
    expect(res.status).toBe(400);
    expect(mocks.createTrainingSeries).not.toHaveBeenCalled();
  });

  it("E7. returns 400 when a facilityResourceIds entry is not a non-empty string", async () => {
    const res = await POST(makePostRequest({ ...VALID_BODY, facilityResourceIds: ["res-1", ""] }));
    expect(res.status).toBe(400);
    expect(mocks.createTrainingSeries).not.toHaveBeenCalled();
  });

  it("E8. uses a fallback error message + still rolls back when an allocation rejection carries no message", async () => {
    mocks.createTrainingAllocation.mockRejectedValueOnce("boom");

    const res = await POST(makePostRequest({ ...VALID_BODY, facilityResourceIds: ["res-pitch-1"] }));

    expect(res.status).not.toBe(201);
    const body = await res.json();
    expect(body.error).toBe("Ressource konnte nicht zugewiesen werden.");
    expect(mocks.deleteTrainingSeriesPermanently).toHaveBeenCalledWith(TENANT_A, SERIES_ID);
  });
});
