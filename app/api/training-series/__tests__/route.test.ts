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
 */

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Hoisted mocks ─────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  requireApiAnyPermission: vi.fn(),
  createTrainingSeries: vi.fn(),
  getTrainingSeries: vi.fn(),
  generateTrainingSessions: vi.fn(),
}));

vi.mock("@/lib/permissions/require-api-any-permission", () => ({
  requireApiAnyPermission: mocks.requireApiAnyPermission,
}));

vi.mock("@/lib/training/training-service", () => ({
  createTrainingSeries: mocks.createTrainingSeries,
  getTrainingSeries: mocks.getTrainingSeries,
}));

vi.mock("@/lib/training/session-generation-service", () => ({
  generateTrainingSessions: mocks.generateTrainingSessions,
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

function makeAuthOk() {
  return {
    ok: true as const,
    status: 200,
    error: null,
    session: { user: { id: "user-1", activeTenantId: TENANT_A } },
  };
}

function makeAuthFail(status = 401) {
  return { ok: false as const, status, error: "Unauthorized", session: null };
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
  mocks.requireApiAnyPermission.mockResolvedValue(makeAuthOk());
  mocks.createTrainingSeries.mockResolvedValue(makeSeriesDto());
  mocks.generateTrainingSessions.mockResolvedValue({
    trainingSeriesId: SERIES_ID,
    occurrencesInWindow: 9,
    created: 9,
    updated: 0,
    unchanged: 0,
  });
  mocks.getTrainingSeries.mockResolvedValue(makeSeriesDto({ sessionCount: 9 }));
});

// ── A. Auth / permission gating ──────────────────────────────────────────────

describe("A. POST /api/training-series — auth", () => {
  it("A1. returns 401 when unauthenticated", async () => {
    mocks.requireApiAnyPermission.mockResolvedValue(makeAuthFail());
    const res = await POST(makePostRequest(VALID_BODY));
    expect(res.status).toBe(401);
  });

  it("A2. returns 403 when forbidden (e.g. trainings.view only)", async () => {
    mocks.requireApiAnyPermission.mockResolvedValue({ ok: false, status: 403, error: "Forbidden", session: null });
    const res = await POST(makePostRequest(VALID_BODY));
    expect(res.status).toBe(403);
  });

  it("A3. returns 400 when tenant context missing", async () => {
    mocks.requireApiAnyPermission.mockResolvedValue({
      ok: true,
      status: 200,
      error: null,
      session: { user: { id: "user-1", activeTenantId: undefined } },
    });
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
