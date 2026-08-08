/**
 * app/api/training-sessions/[sessionId]/allocations/[allocationId]/__tests__/route.test.ts
 *
 * API regression tests for deleting one occurrence-level allocation
 * override (TRAININGCENTER-02).
 */

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireApiAnyPermission: vi.fn(),
  getTrainingSessionAllocation: vi.fn(),
  deleteTrainingSessionAllocation: vi.fn(),
}));

vi.mock("@/lib/permissions/require-api-any-permission", () => ({
  requireApiAnyPermission: mocks.requireApiAnyPermission,
}));

vi.mock("@/lib/training/session-allocation-service", () => ({
  getTrainingSessionAllocation: mocks.getTrainingSessionAllocation,
  deleteTrainingSessionAllocation: mocks.deleteTrainingSessionAllocation,
}));

vi.mock("@/lib/db/prisma", () => ({ prisma: {} }));

import { DELETE } from "../route";
import { TrainingSessionAllocationNotFoundError } from "@/lib/training/errors";

const TENANT_A = "tenant-a";
const SESSION_ID = "session-01";
const OTHER_SESSION_ID = "session-99";
const ALLOCATION_ID = "alloc-01";

function makeAuthOk() {
  return {
    ok: true as const,
    status: 200,
    error: null,
    session: { user: { id: "user-1", activeTenantId: TENANT_A } },
  };
}

function makeAllocationDto(overrides: Record<string, unknown> = {}) {
  return {
    id: ALLOCATION_ID,
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

function makeParams(sessionId = SESSION_ID, allocationId = ALLOCATION_ID) {
  return { params: Promise.resolve({ sessionId, allocationId }) };
}

function makeRequest(): NextRequest {
  return new NextRequest(
    `http://localhost/api/training-sessions/${SESSION_ID}/allocations/${ALLOCATION_ID}`,
    { method: "DELETE" },
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireApiAnyPermission.mockResolvedValue(makeAuthOk());
});

describe("DELETE /api/training-sessions/[sessionId]/allocations/[allocationId]", () => {
  it("deletes the override", async () => {
    mocks.getTrainingSessionAllocation.mockResolvedValue(makeAllocationDto());
    mocks.deleteTrainingSessionAllocation.mockResolvedValue(undefined);

    const res = await DELETE(makeRequest(), makeParams());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(mocks.deleteTrainingSessionAllocation).toHaveBeenCalledWith(TENANT_A, ALLOCATION_ID);
  });

  it("404s when the allocation does not belong to the URL's session (ownership enforcement)", async () => {
    mocks.getTrainingSessionAllocation.mockResolvedValue(
      makeAllocationDto({ trainingSessionId: OTHER_SESSION_ID }),
    );

    const res = await DELETE(makeRequest(), makeParams(SESSION_ID, ALLOCATION_ID));
    expect(res.status).toBe(404);
    expect(mocks.deleteTrainingSessionAllocation).not.toHaveBeenCalled();
  });

  it("maps TrainingSessionAllocationNotFoundError to 404", async () => {
    mocks.getTrainingSessionAllocation.mockRejectedValue(new TrainingSessionAllocationNotFoundError(ALLOCATION_ID));

    const res = await DELETE(makeRequest(), makeParams());
    expect(res.status).toBe(404);
  });

  it("rejects an unauthorized request", async () => {
    mocks.requireApiAnyPermission.mockResolvedValue({ ok: false, status: 403, error: "Forbidden", session: null });

    const res = await DELETE(makeRequest(), makeParams());
    expect(res.status).toBe(403);
    expect(mocks.deleteTrainingSessionAllocation).not.toHaveBeenCalled();
  });
});
