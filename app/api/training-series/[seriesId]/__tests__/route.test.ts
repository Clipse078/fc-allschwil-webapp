/**
 * app/api/training-series/[seriesId]/__tests__/route.test.ts
 *
 * API regression tests for TrainingSeries update/archive routes (TRAININGCENTER-03A).
 *
 * PUT    /api/training-series/:seriesId
 * DELETE /api/training-series/:seriesId
 *
 * Tests:
 *   A. PUT — auth, validation, success (regeneration), domain error mapping
 *   B. DELETE — auth, success (archive preserves history), tenant isolation (not found)
 */

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Hoisted mocks ─────────────────────────────────────────────────────────────

// ORG-ACCESS-03: route now uses auth() + planning policy instead of requireApiAnyPermission.
const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  canEditPlanningRecord: vi.fn(),
  seriesFindFirst: vi.fn(),
  updateTrainingSeries: vi.fn(),
  archiveTrainingSeries: vi.fn(),
  getTrainingSeries: vi.fn(),
  generateTrainingSessions: vi.fn(),
}));

vi.mock("@/auth", () => ({
  auth: mocks.auth,
}));

vi.mock("@/lib/planning/planning-authorization-policy", () => ({
  createPlanningAuthorizationPolicy: () => ({
    canEditPlanningRecord: mocks.canEditPlanningRecord,
  }),
}));

vi.mock("@/lib/training/training-service", () => ({
  updateTrainingSeries: mocks.updateTrainingSeries,
  archiveTrainingSeries: mocks.archiveTrainingSeries,
  getTrainingSeries: mocks.getTrainingSeries,
}));

vi.mock("@/lib/training/session-generation-service", () => ({
  generateTrainingSessions: mocks.generateTrainingSessions,
}));

// ORG-ACCESS-03: route loads the series for scope check; mock findFirst.
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    trainingSeries: { findFirst: mocks.seriesFindFirst },
  },
}));

import { PUT, DELETE } from "../route";
import { TrainingSeriesNotFoundError, TrainingSeriesValidationError, TrainingSeriesConflictError } from "@/lib/training/errors";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const TENANT_A = "tenant-a";
const TENANT_B = "tenant-b";
const SERIES_ID = "series-01";

const VALID_BODY = {
  title: "E1 Dienstagstraining",
  validFrom: "2026-08-01",
  validUntil: "2026-09-30",
  weekdaySchedules: [
    { weekday: "MONDAY", startsAt: "17:00", endsAt: "18:00" },
    { weekday: "WEDNESDAY", startsAt: "16:00", endsAt: "17:00" },
  ],
};

// ORG-ACCESS-03: auth() returns Session shape directly.
function makeAuthOk(tenantId = TENANT_A) {
  return { user: { id: "user-1", activeTenantId: tenantId } };
}

// Fixture for the series row returned by the scope check DB call.
function makeSeriesRow(overrides: Record<string, unknown> = {}) {
  return {
    id: SERIES_ID,
    planningStage: "DRAFT",
    teamSeason: { teamId: "team-e1" },
    ...overrides,
  };
}

function makeSeriesDto(overrides: Record<string, unknown> = {}) {
  return {
    id: SERIES_ID,
    tenantId: TENANT_A,
    teamSeasonId: "ts-01",
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
    validUntil: "2026-09-30T00:00:00.000Z",
    archivedAt: null,
    sessionCount: 18,
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

function makePutRequest(body: unknown): NextRequest {
  return new NextRequest(`http://localhost/api/training-series/${SERIES_ID}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeParams(seriesId: string) {
  return { params: Promise.resolve({ seriesId }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  // ORG-ACCESS-03: auth() and planning policy replace requireApiAnyPermission.
  mocks.auth.mockResolvedValue(makeAuthOk());
  mocks.seriesFindFirst.mockResolvedValue(makeSeriesRow());
  mocks.canEditPlanningRecord.mockResolvedValue(true);
  mocks.updateTrainingSeries.mockResolvedValue(makeSeriesDto());
  mocks.archiveTrainingSeries.mockResolvedValue(makeSeriesDto({ status: "ARCHIVED", archivedAt: "2026-09-01T00:00:00.000Z" }));
  mocks.generateTrainingSessions.mockResolvedValue({
    trainingSeriesId: SERIES_ID,
    occurrencesInWindow: 18,
    created: 9,
    updated: 0,
    unchanged: 9,
  });
  mocks.getTrainingSeries.mockResolvedValue(makeSeriesDto());
});

// ── A. PUT ────────────────────────────────────────────────────────────────────

describe("A. PUT /api/training-series/:seriesId", () => {
  it("A1. returns 401 when unauthenticated", async () => {
    mocks.auth.mockResolvedValue(null);
    const res = await PUT(makePutRequest(VALID_BODY), makeParams(SERIES_ID));
    expect(res.status).toBe(401);
  });

  it("A2. returns 403 when planning policy denies edit (no scope)", async () => {
    mocks.canEditPlanningRecord.mockResolvedValue(false);
    const res = await PUT(makePutRequest(VALID_BODY), makeParams(SERIES_ID));
    expect(res.status).toBe(403);
  });

  it("A3. returns 400 when title is missing", async () => {
    const res = await PUT(makePutRequest({ ...VALID_BODY, title: "" }), makeParams(SERIES_ID));
    expect(res.status).toBe(400);
  });

  it("A4. returns 400 when weekdaySchedules is empty", async () => {
    const res = await PUT(makePutRequest({ ...VALID_BODY, weekdaySchedules: [] }), makeParams(SERIES_ID));
    expect(res.status).toBe(400);
  });

  it("A5. returns 404 when series does not exist (or cross-tenant)", async () => {
    // ORG-ACCESS-03: scope check loads series first; null → 404 before updateTrainingSeries.
    mocks.seriesFindFirst.mockResolvedValue(null);
    const res = await PUT(makePutRequest(VALID_BODY), makeParams(SERIES_ID));
    expect(res.status).toBe(404);
  });

  it("A6. returns 400 on TrainingSeriesValidationError from the service", async () => {
    mocks.updateTrainingSeries.mockRejectedValue(new TrainingSeriesValidationError("bad input"));
    const res = await PUT(makePutRequest(VALID_BODY), makeParams(SERIES_ID));
    expect(res.status).toBe(400);
  });

  it("A7. returns 409 on TrainingSeriesConflictError from the service", async () => {
    mocks.updateTrainingSeries.mockRejectedValue(new TrainingSeriesConflictError("duplicate"));
    const res = await PUT(makePutRequest(VALID_BODY), makeParams(SERIES_ID));
    expect(res.status).toBe(409);
  });

  it("A8. success — re-generates sessions across the (possibly extended) window and returns series + generation", async () => {
    const res = await PUT(makePutRequest(VALID_BODY), makeParams(SERIES_ID));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.series.id).toBe(SERIES_ID);
    expect(body.generation).toEqual({
      trainingSeriesId: SERIES_ID,
      occurrencesInWindow: 18,
      created: 9,
      updated: 0,
      unchanged: 9,
    });

    expect(mocks.generateTrainingSessions).toHaveBeenCalledWith(
      TENANT_A,
      SERIES_ID,
      { from: new Date("2026-08-01"), to: new Date("2026-09-30") },
    );
  });

  it("A9. does not allow changing teamSeasonId — the update payload never includes it", async () => {
    await PUT(makePutRequest({ ...VALID_BODY, teamSeasonId: "some-other-team-season" }), makeParams(SERIES_ID));

    const call = mocks.updateTrainingSeries.mock.calls[0][2];
    expect(call.teamSeasonId).toBeUndefined();
  });
});

// ── B. DELETE (archive) ───────────────────────────────────────────────────────

describe("B. DELETE /api/training-series/:seriesId", () => {
  it("B1. returns 401 when unauthenticated", async () => {
    mocks.auth.mockResolvedValue(null);
    const res = await DELETE(new NextRequest(`http://localhost/api/training-series/${SERIES_ID}`, { method: "DELETE" }), makeParams(SERIES_ID));
    expect(res.status).toBe(401);
  });

  it("B2. returns 403 when planning policy denies edit (no scope)", async () => {
    mocks.canEditPlanningRecord.mockResolvedValue(false);
    const res = await DELETE(new NextRequest(`http://localhost/api/training-series/${SERIES_ID}`, { method: "DELETE" }), makeParams(SERIES_ID));
    expect(res.status).toBe(403);
  });

  it("B3. returns 404 when series does not exist (or cross-tenant)", async () => {
    // ORG-ACCESS-03: scope check loads series first; null → 404 before archiveTrainingSeries.
    mocks.seriesFindFirst.mockResolvedValue(null);
    const res = await DELETE(new NextRequest(`http://localhost/api/training-series/${SERIES_ID}`, { method: "DELETE" }), makeParams(SERIES_ID));
    expect(res.status).toBe(404);
  });

  it("B4. success — archives the series and returns it", async () => {
    const res = await DELETE(new NextRequest(`http://localhost/api/training-series/${SERIES_ID}`, { method: "DELETE" }), makeParams(SERIES_ID));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.series.status).toBe("ARCHIVED");
    expect(body.series.archivedAt).not.toBeNull();
  });

  it("B5. tenant isolation — archiving under a different tenant's session scopes the lookup by that tenant", async () => {
    // ORG-ACCESS-03: auth() is now the session source; seriesFindFirst scopes to tenantId.
    mocks.auth.mockResolvedValue(makeAuthOk(TENANT_B));
    // seriesFindFirst not found for TENANT_B → 404 (scope check returns null before archive).
    mocks.seriesFindFirst.mockResolvedValue(null);

    const res = await DELETE(new NextRequest(`http://localhost/api/training-series/${SERIES_ID}`, { method: "DELETE" }), makeParams(SERIES_ID));

    expect(res.status).toBe(404);
  });
});
