/**
 * app/api/training-sessions/[sessionId]/__tests__/route.test.ts
 *
 * API regression tests for the TrainingSession single-occurrence lifecycle
 * route (TRAININGCENTER-01).
 *
 * PATCH /api/training-sessions/:sessionId
 */

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireApiAnyPermission: vi.fn(),
  cancelTrainingSession: vi.fn(),
  restoreTrainingSession: vi.fn(),
}));

vi.mock("@/lib/permissions/require-api-any-permission", () => ({
  requireApiAnyPermission: mocks.requireApiAnyPermission,
}));

vi.mock("@/lib/training/session-lifecycle-service", () => ({
  cancelTrainingSession: mocks.cancelTrainingSession,
  restoreTrainingSession: mocks.restoreTrainingSession,
}));

vi.mock("@/lib/db/prisma", () => ({ prisma: {} }));

import { PATCH } from "../route";
import {
  TrainingSessionInvalidTransitionError,
  TrainingSessionNotFoundError,
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
    trainingSeriesTitle: "F2 Monday Training",
    teamSeasonId: "ts-01",
    teamName: "F2",
    date: "2026-08-03",
    weekday: "MONDAY",
    startAt: "2026-08-03T15:00:00.000Z",
    endAt: "2026-08-03T16:00:00.000Z",
    timezone: "Europe/Zurich",
    status: "SCHEDULED",
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeRequest(body: unknown): NextRequest {
  return new NextRequest(`http://localhost/api/training-sessions/${SESSION_ID}`, {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function makeParams(sessionId = SESSION_ID) {
  return { params: Promise.resolve({ sessionId }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireApiAnyPermission.mockResolvedValue(makeAuthOk());
});

describe("PATCH /api/training-sessions/[sessionId]", () => {
  it("cancels a session when status=CANCELLED", async () => {
    mocks.cancelTrainingSession.mockResolvedValue(makeSessionDto({ status: "CANCELLED" }));

    const res = await PATCH(makeRequest({ status: "CANCELLED" }), makeParams());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.session.status).toBe("CANCELLED");
    expect(mocks.cancelTrainingSession).toHaveBeenCalledWith(TENANT_A, SESSION_ID);
    expect(mocks.restoreTrainingSession).not.toHaveBeenCalled();
  });

  it("restores a session when status=SCHEDULED", async () => {
    mocks.restoreTrainingSession.mockResolvedValue(makeSessionDto({ status: "SCHEDULED" }));

    const res = await PATCH(makeRequest({ status: "SCHEDULED" }), makeParams());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.session.status).toBe("SCHEDULED");
    expect(mocks.restoreTrainingSession).toHaveBeenCalledWith(TENANT_A, SESSION_ID);
    expect(mocks.cancelTrainingSession).not.toHaveBeenCalled();
  });

  it("rejects an unauthenticated/unauthorized request", async () => {
    mocks.requireApiAnyPermission.mockResolvedValue(makeAuthForbidden());

    const res = await PATCH(makeRequest({ status: "CANCELLED" }), makeParams());

    expect(res.status).toBe(403);
    expect(mocks.cancelTrainingSession).not.toHaveBeenCalled();
  });

  it("rejects a missing body", async () => {
    const req = new NextRequest(`http://localhost/api/training-sessions/${SESSION_ID}`, {
      method: "PATCH",
    });

    const res = await PATCH(req, makeParams());
    expect(res.status).toBe(400);
  });

  it("rejects an invalid status value", async () => {
    const res = await PATCH(makeRequest({ status: "POSTPONED" }), makeParams());
    expect(res.status).toBe(400);
    expect(mocks.cancelTrainingSession).not.toHaveBeenCalled();
  });

  it("maps TrainingSessionNotFoundError to 404", async () => {
    mocks.cancelTrainingSession.mockRejectedValue(new TrainingSessionNotFoundError(SESSION_ID));

    const res = await PATCH(makeRequest({ status: "CANCELLED" }), makeParams());
    expect(res.status).toBe(404);
  });

  it("maps TrainingSessionInvalidTransitionError to 422", async () => {
    mocks.cancelTrainingSession.mockRejectedValue(
      new TrainingSessionInvalidTransitionError("invalid transition"),
    );

    const res = await PATCH(makeRequest({ status: "CANCELLED" }), makeParams());
    expect(res.status).toBe(422);
  });

  it("never trusts a tenantId from the request body — always uses the session's tenant", async () => {
    mocks.cancelTrainingSession.mockResolvedValue(makeSessionDto({ status: "CANCELLED" }));

    await PATCH(makeRequest({ status: "CANCELLED", tenantId: "attacker-tenant" }), makeParams());

    expect(mocks.cancelTrainingSession).toHaveBeenCalledWith(TENANT_A, SESSION_ID);
  });
});
