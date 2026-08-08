/**
 * app/api/training-sessions/[sessionId]/reschedule/__tests__/route.test.ts
 *
 * API regression tests for the TrainingSession single-occurrence reschedule
 * route (TRAININGCENTER-02).
 *
 * PATCH / DELETE /api/training-sessions/:sessionId/reschedule
 */

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireApiAnyPermission: vi.fn(),
  rescheduleTrainingSession: vi.fn(),
  resetTrainingSessionSchedule: vi.fn(),
}));

vi.mock("@/lib/permissions/require-api-any-permission", () => ({
  requireApiAnyPermission: mocks.requireApiAnyPermission,
}));

vi.mock("@/lib/training/session-reschedule-service", () => ({
  rescheduleTrainingSession: mocks.rescheduleTrainingSession,
  resetTrainingSessionSchedule: mocks.resetTrainingSessionSchedule,
}));

vi.mock("@/lib/db/prisma", () => ({ prisma: {} }));

import { PATCH, DELETE } from "../route";
import {
  TrainingSessionInvalidTransitionError,
  TrainingSessionNotFoundError,
  TrainingSessionRescheduleValidationError,
} from "@/lib/training/errors";

const TENANT_A = "tenant-a";
const SESSION_ID = "session-01";

function makeAuthOk(tenantId = TENANT_A) {
  return {
    ok: true as const,
    status: 200,
    error: null,
    session: { user: { id: "user-1", activeTenantId: tenantId } },
  };
}

function makeAuthForbidden() {
  return { ok: false as const, status: 403, error: "Forbidden", session: null };
}

function makeSessionDto(overrides: Record<string, unknown> = {}) {
  return {
    id: SESSION_ID,
    tenantId: TENANT_A,
    trainingSeriesId: "series-01",
    trainingSeriesTitle: "F2 Tuesday Training",
    teamSeasonId: "ts-01",
    teamName: "F2",
    date: "2026-08-05",
    weekday: "WEDNESDAY",
    startAt: "2026-08-05T16:00:00.000Z",
    endAt: "2026-08-05T17:00:00.000Z",
    timezone: "Europe/Zurich",
    status: "SCHEDULED",
    originalDate: "2026-08-04",
    originalStartAt: "2026-08-04T15:00:00.000Z",
    originalEndAt: "2026-08-04T16:00:00.000Z",
    isRescheduled: true,
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeRequest(body: unknown): NextRequest {
  return new NextRequest(`http://localhost/api/training-sessions/${SESSION_ID}/reschedule`, {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function makeDeleteRequest(): NextRequest {
  return new NextRequest(`http://localhost/api/training-sessions/${SESSION_ID}/reschedule`, {
    method: "DELETE",
  });
}

function makeParams(sessionId = SESSION_ID) {
  return { params: Promise.resolve({ sessionId }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireApiAnyPermission.mockResolvedValue(makeAuthOk());
});

describe("PATCH /api/training-sessions/[sessionId]/reschedule", () => {
  it("reschedules a session with date + time", async () => {
    mocks.rescheduleTrainingSession.mockResolvedValue(makeSessionDto());

    const res = await PATCH(makeRequest({ date: "2026-08-05", startsAt: "18:00", endsAt: "19:00" }), makeParams());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.session.isRescheduled).toBe(true);
    expect(mocks.rescheduleTrainingSession).toHaveBeenCalledWith(TENANT_A, SESSION_ID, {
      startsAt: "18:00",
      endsAt: "19:00",
      date: "2026-08-05",
    });
  });

  it("passes null date when omitted (time-only reschedule)", async () => {
    mocks.rescheduleTrainingSession.mockResolvedValue(makeSessionDto());

    await PATCH(makeRequest({ startsAt: "18:00", endsAt: "19:00" }), makeParams());

    expect(mocks.rescheduleTrainingSession).toHaveBeenCalledWith(TENANT_A, SESSION_ID, {
      startsAt: "18:00",
      endsAt: "19:00",
      date: null,
    });
  });

  it("rejects an unauthenticated/unauthorized request", async () => {
    mocks.requireApiAnyPermission.mockResolvedValue(makeAuthForbidden());

    const res = await PATCH(makeRequest({ startsAt: "18:00", endsAt: "19:00" }), makeParams());

    expect(res.status).toBe(403);
    expect(mocks.rescheduleTrainingSession).not.toHaveBeenCalled();
  });

  it("rejects a missing body", async () => {
    const req = new NextRequest(`http://localhost/api/training-sessions/${SESSION_ID}/reschedule`, {
      method: "PATCH",
    });

    const res = await PATCH(req, makeParams());
    expect(res.status).toBe(400);
  });

  it("rejects a body missing startsAt/endsAt", async () => {
    const res = await PATCH(makeRequest({ date: "2026-08-05" }), makeParams());
    expect(res.status).toBe(400);
    expect(mocks.rescheduleTrainingSession).not.toHaveBeenCalled();
  });

  it("maps TrainingSessionNotFoundError to 404", async () => {
    mocks.rescheduleTrainingSession.mockRejectedValue(new TrainingSessionNotFoundError(SESSION_ID));

    const res = await PATCH(makeRequest({ startsAt: "18:00", endsAt: "19:00" }), makeParams());
    expect(res.status).toBe(404);
  });

  it("maps TrainingSessionInvalidTransitionError to 422", async () => {
    mocks.rescheduleTrainingSession.mockRejectedValue(
      new TrainingSessionInvalidTransitionError("invalid transition"),
    );

    const res = await PATCH(makeRequest({ startsAt: "18:00", endsAt: "19:00" }), makeParams());
    expect(res.status).toBe(422);
  });

  it("maps TrainingSessionRescheduleValidationError to 400", async () => {
    mocks.rescheduleTrainingSession.mockRejectedValue(
      new TrainingSessionRescheduleValidationError("invalid input"),
    );

    const res = await PATCH(makeRequest({ startsAt: "18:00", endsAt: "19:00" }), makeParams());
    expect(res.status).toBe(400);
  });

  it("never trusts a tenantId from the request body — always uses the session's tenant", async () => {
    mocks.rescheduleTrainingSession.mockResolvedValue(makeSessionDto());

    await PATCH(
      makeRequest({ startsAt: "18:00", endsAt: "19:00", tenantId: "attacker-tenant" }),
      makeParams(),
    );

    expect(mocks.rescheduleTrainingSession).toHaveBeenCalledWith(TENANT_A, SESSION_ID, expect.anything());
  });
});

describe("DELETE /api/training-sessions/[sessionId]/reschedule", () => {
  it("clears the override", async () => {
    mocks.resetTrainingSessionSchedule.mockResolvedValue(makeSessionDto({ isRescheduled: false }));

    const res = await DELETE(makeDeleteRequest(), makeParams());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.session.isRescheduled).toBe(false);
    expect(mocks.resetTrainingSessionSchedule).toHaveBeenCalledWith(TENANT_A, SESSION_ID);
  });

  it("rejects an unauthorized request", async () => {
    mocks.requireApiAnyPermission.mockResolvedValue(makeAuthForbidden());

    const res = await DELETE(makeDeleteRequest(), makeParams());
    expect(res.status).toBe(403);
  });

  it("maps TrainingSessionNotFoundError to 404", async () => {
    mocks.resetTrainingSessionSchedule.mockRejectedValue(new TrainingSessionNotFoundError(SESSION_ID));

    const res = await DELETE(makeDeleteRequest(), makeParams());
    expect(res.status).toBe(404);
  });
});
