/**
 * app/api/training-series/[seriesId]/allocations/[allocationId]/__tests__/route.test.ts
 *
 * API regression tests for single allocation routes (TRAINING-ALLOCATIONS-01).
 *
 * GET    /api/training-series/:seriesId/allocations/:allocationId
 * PATCH  /api/training-series/:seriesId/allocations/:allocationId
 * DELETE /api/training-series/:seriesId/allocations/:allocationId
 */

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Hoisted mocks ─────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  requireApiAnyPermission: vi.fn(),
  getTrainingAllocation: vi.fn(),
  updateTrainingAllocation: vi.fn(),
  deleteTrainingAllocation: vi.fn(),
}));

vi.mock("@/lib/permissions/require-api-any-permission", () => ({
  requireApiAnyPermission: mocks.requireApiAnyPermission,
}));

vi.mock("@/lib/training/training-allocation-service", () => ({
  getTrainingAllocation: mocks.getTrainingAllocation,
  updateTrainingAllocation: mocks.updateTrainingAllocation,
  deleteTrainingAllocation: mocks.deleteTrainingAllocation,
}));

vi.mock("@/lib/db/prisma", () => ({ prisma: {} }));

import { GET, PATCH, DELETE } from "../route";
import { TrainingAllocationNotFoundError } from "@/lib/training/errors";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const TENANT_A = "tenant-a";
const TENANT_B = "tenant-b";
const SERIES_ID = "series-01";
const RESOURCE_ID = "resource-01";
const FACILITY_ID = "facility-01";
const ALLOCATION_ID = "allocation-01";

function makeAuthOk(tenantId = TENANT_A) {
  return {
    ok: true as const,
    status: 200,
    error: null,
    session: { user: { id: "user-1", tenantId } },
  };
}

function makeAuthFail(status = 401) {
  return { ok: false as const, status, error: "Unauthorized", session: null };
}

function makeAllocationDto(overrides: Record<string, unknown> = {}) {
  return {
    id: ALLOCATION_ID,
    tenantId: TENANT_A,
    trainingSeriesId: SERIES_ID,
    facilityResourceId: RESOURCE_ID,
    facilityResourceName: "Pitch A Full",
    facilityResourceCode: "PITCH_A_FULL",
    facilityResourceType: "FULL_PITCH",
    facilityId: FACILITY_ID,
    facilityName: "Sportanlage Brüel",
    notes: null,
    displayOrder: 0,
    createdAt: "2026-07-27T10:00:00.000Z",
    updatedAt: "2026-07-27T10:00:00.000Z",
    ...overrides,
  };
}

function makeParams(seriesId: string, allocationId: string) {
  return { params: Promise.resolve({ seriesId, allocationId }) };
}

function makeGetReq(seriesId: string, allocationId: string): NextRequest {
  return new NextRequest(
    `http://localhost/api/training-series/${seriesId}/allocations/${allocationId}`,
    { method: "GET" },
  );
}

function makePatchReq(seriesId: string, allocationId: string, body: unknown): NextRequest {
  return new NextRequest(
    `http://localhost/api/training-series/${seriesId}/allocations/${allocationId}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
}

function makeDeleteReq(seriesId: string, allocationId: string): NextRequest {
  return new NextRequest(
    `http://localhost/api/training-series/${seriesId}/allocations/${allocationId}`,
    { method: "DELETE" },
  );
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireApiAnyPermission.mockResolvedValue(makeAuthOk());
  mocks.getTrainingAllocation.mockResolvedValue(makeAllocationDto());
  mocks.updateTrainingAllocation.mockResolvedValue(makeAllocationDto());
  mocks.deleteTrainingAllocation.mockResolvedValue(undefined);
});

// ── GET ───────────────────────────────────────────────────────────────────────

describe("GET /api/training-series/:seriesId/allocations/:allocationId", () => {
  it("returns 401 when unauthenticated", async () => {
    mocks.requireApiAnyPermission.mockResolvedValue(makeAuthFail());
    const res = await GET(makeGetReq(SERIES_ID, ALLOCATION_ID), makeParams(SERIES_ID, ALLOCATION_ID));
    expect(res.status).toBe(401);
  });

  it("returns 400 when tenant context missing", async () => {
    mocks.requireApiAnyPermission.mockResolvedValue({
      ok: true,
      status: 200,
      error: null,
      session: { user: { id: "u", tenantId: undefined } },
    });
    const res = await GET(makeGetReq(SERIES_ID, ALLOCATION_ID), makeParams(SERIES_ID, ALLOCATION_ID));
    expect(res.status).toBe(400);
  });

  it("returns 404 when allocation not found", async () => {
    mocks.getTrainingAllocation.mockRejectedValue(
      new TrainingAllocationNotFoundError(ALLOCATION_ID),
    );
    const res = await GET(makeGetReq(SERIES_ID, ALLOCATION_ID), makeParams(SERIES_ID, ALLOCATION_ID));
    expect(res.status).toBe(404);
  });

  it("returns 200 with allocation", async () => {
    const res = await GET(makeGetReq(SERIES_ID, ALLOCATION_ID), makeParams(SERIES_ID, ALLOCATION_ID));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.allocation.id).toBe(ALLOCATION_ID);
  });

  it("calls service with tenantId from session", async () => {
    await GET(makeGetReq(SERIES_ID, ALLOCATION_ID), makeParams(SERIES_ID, ALLOCATION_ID));
    expect(mocks.getTrainingAllocation).toHaveBeenCalledWith(TENANT_A, ALLOCATION_ID);
  });

  it("returns 404 when allocation belongs to a different series (URL mismatch)", async () => {
    const WRONG_SERIES = "series-wrong";
    mocks.getTrainingAllocation.mockResolvedValue(
      makeAllocationDto({ trainingSeriesId: SERIES_ID }),
    );
    const res = await GET(makeGetReq(WRONG_SERIES, ALLOCATION_ID), makeParams(WRONG_SERIES, ALLOCATION_ID));
    expect(res.status).toBe(404);
  });
});

// ── PATCH ─────────────────────────────────────────────────────────────────────

describe("PATCH /api/training-series/:seriesId/allocations/:allocationId", () => {
  it("returns 401 when unauthenticated", async () => {
    mocks.requireApiAnyPermission.mockResolvedValue(makeAuthFail());
    const res = await PATCH(
      makePatchReq(SERIES_ID, ALLOCATION_ID, { notes: "x" }),
      makeParams(SERIES_ID, ALLOCATION_ID),
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 when body is missing", async () => {
    const req = new NextRequest(
      `http://localhost/api/training-series/${SERIES_ID}/allocations/${ALLOCATION_ID}`,
      { method: "PATCH" },
    );
    const res = await PATCH(req, makeParams(SERIES_ID, ALLOCATION_ID));
    expect(res.status).toBe(400);
  });

  it("returns 400 when no valid fields to update", async () => {
    const res = await PATCH(
      makePatchReq(SERIES_ID, ALLOCATION_ID, { unknownField: "x" }),
      makeParams(SERIES_ID, ALLOCATION_ID),
    );
    expect(res.status).toBe(400);
  });

  it("returns 404 when allocation not found", async () => {
    mocks.updateTrainingAllocation.mockRejectedValue(
      new TrainingAllocationNotFoundError(ALLOCATION_ID),
    );
    const res = await PATCH(
      makePatchReq(SERIES_ID, ALLOCATION_ID, { notes: "x" }),
      makeParams(SERIES_ID, ALLOCATION_ID),
    );
    expect(res.status).toBe(404);
  });

  it("returns 200 with updated allocation", async () => {
    mocks.updateTrainingAllocation.mockResolvedValue(makeAllocationDto({ notes: "updated" }));
    const res = await PATCH(
      makePatchReq(SERIES_ID, ALLOCATION_ID, { notes: "updated" }),
      makeParams(SERIES_ID, ALLOCATION_ID),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.allocation.notes).toBe("updated");
  });

  it("wrong tenant gets 404 when allocation not found for that tenant", async () => {
    mocks.requireApiAnyPermission.mockResolvedValue(makeAuthOk(TENANT_B));
    mocks.getTrainingAllocation.mockRejectedValue(
      new TrainingAllocationNotFoundError(ALLOCATION_ID),
    );
    const res = await PATCH(
      makePatchReq(SERIES_ID, ALLOCATION_ID, { notes: "x" }),
      makeParams(SERIES_ID, ALLOCATION_ID),
    );
    expect(res.status).toBe(404);
  });

  it("returns 404 when allocation belongs to a different series (URL mismatch)", async () => {
    const WRONG_SERIES = "series-wrong";
    mocks.getTrainingAllocation.mockResolvedValue(
      makeAllocationDto({ trainingSeriesId: SERIES_ID }),
    );
    const res = await PATCH(
      makePatchReq(WRONG_SERIES, ALLOCATION_ID, { notes: "x" }),
      makeParams(WRONG_SERIES, ALLOCATION_ID),
    );
    expect(res.status).toBe(404);
  });
});

// ── DELETE ────────────────────────────────────────────────────────────────────

describe("DELETE /api/training-series/:seriesId/allocations/:allocationId", () => {
  it("returns 401 when unauthenticated", async () => {
    mocks.requireApiAnyPermission.mockResolvedValue(makeAuthFail());
    const res = await DELETE(makeDeleteReq(SERIES_ID, ALLOCATION_ID), makeParams(SERIES_ID, ALLOCATION_ID));
    expect(res.status).toBe(401);
  });

  it("returns 404 when allocation not found", async () => {
    mocks.deleteTrainingAllocation.mockRejectedValue(
      new TrainingAllocationNotFoundError(ALLOCATION_ID),
    );
    const res = await DELETE(makeDeleteReq(SERIES_ID, ALLOCATION_ID), makeParams(SERIES_ID, ALLOCATION_ID));
    expect(res.status).toBe(404);
  });

  it("returns 200 ok on successful delete", async () => {
    const res = await DELETE(makeDeleteReq(SERIES_ID, ALLOCATION_ID), makeParams(SERIES_ID, ALLOCATION_ID));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  it("calls deleteTrainingAllocation with tenantId from session", async () => {
    await DELETE(makeDeleteReq(SERIES_ID, ALLOCATION_ID), makeParams(SERIES_ID, ALLOCATION_ID));
    expect(mocks.deleteTrainingAllocation).toHaveBeenCalledWith(TENANT_A, ALLOCATION_ID);
  });

  it("wrong tenant gets 404 for cross-tenant delete attempt", async () => {
    mocks.requireApiAnyPermission.mockResolvedValue(makeAuthOk(TENANT_B));
    mocks.getTrainingAllocation.mockRejectedValue(
      new TrainingAllocationNotFoundError(ALLOCATION_ID),
    );
    const res = await DELETE(makeDeleteReq(SERIES_ID, ALLOCATION_ID), makeParams(SERIES_ID, ALLOCATION_ID));
    expect(res.status).toBe(404);
  });

  it("returns 404 when allocation belongs to a different series (URL mismatch)", async () => {
    const WRONG_SERIES = "series-wrong";
    mocks.getTrainingAllocation.mockResolvedValue(
      makeAllocationDto({ trainingSeriesId: SERIES_ID }),
    );
    const res = await DELETE(makeDeleteReq(WRONG_SERIES, ALLOCATION_ID), makeParams(WRONG_SERIES, ALLOCATION_ID));
    expect(res.status).toBe(404);
  });
});
