/**
 * app/api/training-sessions/[sessionId]/allocations/__tests__/route.test.ts
 *
 * API regression tests for occurrence-level allocation overrides
 * (TRAININGCENTER-02). Mirrors
 * app/api/training-series/[seriesId]/allocations/__tests__/route.test.ts.
 */

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireApiAnyPermission: vi.fn(),
  createTrainingSessionAllocation: vi.fn(),
  listAllocationsByTrainingSession: vi.fn(),
}));

vi.mock("@/lib/permissions/require-api-any-permission", () => ({
  requireApiAnyPermission: mocks.requireApiAnyPermission,
}));

vi.mock("@/lib/training/session-allocation-service", () => ({
  createTrainingSessionAllocation: mocks.createTrainingSessionAllocation,
  listAllocationsByTrainingSession: mocks.listAllocationsByTrainingSession,
}));

vi.mock("@/lib/db/prisma", () => ({ prisma: {} }));

import { GET, POST } from "../route";
import {
  TrainingSessionNotFoundError,
  TrainingSessionAllocationResourceNotFoundError,
  TrainingSessionAllocationArchivedResourceError,
  TrainingSessionAllocationArchivedFacilityError,
  TrainingSessionAllocationDuplicateError,
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

function makeAllocationDto(overrides: Record<string, unknown> = {}) {
  return {
    id: "alloc-01",
    tenantId: TENANT_A,
    trainingSessionId: SESSION_ID,
    facilityResourceId: "resource-01",
    facilityResourceName: "Hauptplatz A",
    facilityResourceCode: "A",
    facilityResourceType: "FULL_PITCH",
    facilityId: "facility-1",
    facilityName: "Sportanlage Bruderholz",
    notes: null,
    displayOrder: 0,
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeParams(sessionId = SESSION_ID) {
  return { params: Promise.resolve({ sessionId }) };
}

function makePostRequest(body: unknown): NextRequest {
  return new NextRequest(`http://localhost/api/training-sessions/${SESSION_ID}/allocations`, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireApiAnyPermission.mockResolvedValue(makeAuthOk());
});

describe("GET /api/training-sessions/[sessionId]/allocations", () => {
  it("lists overrides for the occurrence", async () => {
    mocks.listAllocationsByTrainingSession.mockResolvedValue([makeAllocationDto()]);

    const res = await GET(
      new NextRequest(`http://localhost/api/training-sessions/${SESSION_ID}/allocations`),
      makeParams(),
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.allocations).toHaveLength(1);
  });

  it("maps TrainingSessionNotFoundError to 404", async () => {
    mocks.listAllocationsByTrainingSession.mockRejectedValue(new TrainingSessionNotFoundError(SESSION_ID));

    const res = await GET(
      new NextRequest(`http://localhost/api/training-sessions/${SESSION_ID}/allocations`),
      makeParams(),
    );
    expect(res.status).toBe(404);
  });

  it("rejects an unauthorized request", async () => {
    mocks.requireApiAnyPermission.mockResolvedValue(makeAuthForbidden());

    const res = await GET(
      new NextRequest(`http://localhost/api/training-sessions/${SESSION_ID}/allocations`),
      makeParams(),
    );
    expect(res.status).toBe(403);
  });
});

describe("POST /api/training-sessions/[sessionId]/allocations", () => {
  it("creates an override allocation", async () => {
    mocks.createTrainingSessionAllocation.mockResolvedValue(makeAllocationDto());

    const res = await POST(makePostRequest({ facilityResourceId: "resource-01" }), makeParams());
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.allocation.facilityResourceId).toBe("resource-01");
    expect(mocks.createTrainingSessionAllocation).toHaveBeenCalledWith(TENANT_A, {
      trainingSessionId: SESSION_ID,
      facilityResourceId: "resource-01",
      notes: null,
      displayOrder: undefined,
    });
  });

  it("rejects a missing facilityResourceId", async () => {
    const res = await POST(makePostRequest({}), makeParams());
    expect(res.status).toBe(400);
    expect(mocks.createTrainingSessionAllocation).not.toHaveBeenCalled();
  });

  it("rejects an unauthorized request", async () => {
    mocks.requireApiAnyPermission.mockResolvedValue(makeAuthForbidden());

    const res = await POST(makePostRequest({ facilityResourceId: "resource-01" }), makeParams());
    expect(res.status).toBe(403);
  });

  it("maps TrainingSessionNotFoundError to 404", async () => {
    mocks.createTrainingSessionAllocation.mockRejectedValue(new TrainingSessionNotFoundError(SESSION_ID));

    const res = await POST(makePostRequest({ facilityResourceId: "resource-01" }), makeParams());
    expect(res.status).toBe(404);
  });

  it("maps TrainingSessionAllocationResourceNotFoundError to 404", async () => {
    mocks.createTrainingSessionAllocation.mockRejectedValue(
      new TrainingSessionAllocationResourceNotFoundError("resource-01"),
    );

    const res = await POST(makePostRequest({ facilityResourceId: "resource-01" }), makeParams());
    expect(res.status).toBe(404);
  });

  it("maps TrainingSessionAllocationArchivedResourceError to 422 — archived resources cannot be newly assigned", async () => {
    mocks.createTrainingSessionAllocation.mockRejectedValue(
      new TrainingSessionAllocationArchivedResourceError("resource-01"),
    );

    const res = await POST(makePostRequest({ facilityResourceId: "resource-01" }), makeParams());
    expect(res.status).toBe(422);
  });

  it("maps TrainingSessionAllocationArchivedFacilityError to 422", async () => {
    mocks.createTrainingSessionAllocation.mockRejectedValue(
      new TrainingSessionAllocationArchivedFacilityError("facility-1"),
    );

    const res = await POST(makePostRequest({ facilityResourceId: "resource-01" }), makeParams());
    expect(res.status).toBe(422);
  });

  it("maps TrainingSessionAllocationDuplicateError to 409 — prevent duplicate allocations", async () => {
    mocks.createTrainingSessionAllocation.mockRejectedValue(
      new TrainingSessionAllocationDuplicateError(SESSION_ID, "resource-01"),
    );

    const res = await POST(makePostRequest({ facilityResourceId: "resource-01" }), makeParams());
    expect(res.status).toBe(409);
  });
});
