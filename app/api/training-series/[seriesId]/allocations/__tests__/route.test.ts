/**
 * app/api/training-series/[seriesId]/allocations/__tests__/route.test.ts
 *
 * API regression tests for training allocation routes (TRAINING-ALLOCATIONS-01).
 *
 * GET  /api/training-series/:seriesId/allocations
 * POST /api/training-series/:seriesId/allocations
 *
 * Tests:
 *   A. GET — list allocations
 *   B. POST — create allocation
 */

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Hoisted mocks ─────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  requireApiAnyPermission: vi.fn(),
  listAllocationsByTrainingSeries: vi.fn(),
  createTrainingAllocation: vi.fn(),
}));

vi.mock("@/lib/permissions/require-api-any-permission", () => ({
  requireApiAnyPermission: mocks.requireApiAnyPermission,
}));

vi.mock("@/lib/training/training-allocation-service", () => ({
  listAllocationsByTrainingSeries: mocks.listAllocationsByTrainingSeries,
  createTrainingAllocation: mocks.createTrainingAllocation,
}));

vi.mock("@/lib/db/prisma", () => ({ prisma: {} }));

import { GET, POST } from "../route";
import {
  TrainingSeriesNotFoundError,
  TrainingAllocationResourceNotFoundError,
  TrainingAllocationArchivedResourceError,
  TrainingAllocationArchivedFacilityError,
  TrainingAllocationDuplicateError,
} from "@/lib/training/errors";

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

function makeAuthForbidden() {
  return { ok: false as const, status: 403, error: "Forbidden", session: null };
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

function makeGetRequest(seriesId: string): NextRequest {
  return new NextRequest(
    `http://localhost/api/training-series/${seriesId}/allocations`,
    { method: "GET" },
  );
}

function makePostRequest(seriesId: string, body: unknown): NextRequest {
  return new NextRequest(
    `http://localhost/api/training-series/${seriesId}/allocations`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
}

function makeParams(seriesId: string) {
  return { params: Promise.resolve({ seriesId }) };
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireApiAnyPermission.mockResolvedValue(makeAuthOk());
  mocks.listAllocationsByTrainingSeries.mockResolvedValue([]);
  mocks.createTrainingAllocation.mockResolvedValue(makeAllocationDto());
});

// ── A. GET /api/training-series/:seriesId/allocations ─────────────────────────

describe("A. GET /api/training-series/:seriesId/allocations", () => {
  it("A1. returns 401 when unauthenticated", async () => {
    mocks.requireApiAnyPermission.mockResolvedValue(makeAuthFail());

    const res = await GET(makeGetRequest(SERIES_ID), makeParams(SERIES_ID));

    expect(res.status).toBe(401);
  });

  it("A2. returns 403 when forbidden", async () => {
    mocks.requireApiAnyPermission.mockResolvedValue(makeAuthForbidden());

    const res = await GET(makeGetRequest(SERIES_ID), makeParams(SERIES_ID));

    expect(res.status).toBe(403);
  });

  it("A3. returns 400 when tenant context missing", async () => {
    mocks.requireApiAnyPermission.mockResolvedValue({
      ok: true,
      status: 200,
      error: null,
      session: { user: { id: "user-1", tenantId: undefined } },
    });

    const res = await GET(makeGetRequest(SERIES_ID), makeParams(SERIES_ID));

    expect(res.status).toBe(400);
  });

  it("A4. returns 404 when training series not found", async () => {
    mocks.listAllocationsByTrainingSeries.mockRejectedValue(
      new TrainingSeriesNotFoundError(SERIES_ID),
    );

    const res = await GET(makeGetRequest(SERIES_ID), makeParams(SERIES_ID));

    expect(res.status).toBe(404);
  });

  it("A5. returns 200 with empty allocations list", async () => {
    mocks.listAllocationsByTrainingSeries.mockResolvedValue([]);

    const res = await GET(makeGetRequest(SERIES_ID), makeParams(SERIES_ID));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.allocations).toEqual([]);
  });

  it("A6. returns 200 with allocations list", async () => {
    mocks.listAllocationsByTrainingSeries.mockResolvedValue([makeAllocationDto()]);

    const res = await GET(makeGetRequest(SERIES_ID), makeParams(SERIES_ID));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.allocations).toHaveLength(1);
    expect(body.allocations[0].facilityResourceType).toBe("FULL_PITCH");
  });

  it("A7. calls service with tenantId from session (not request)", async () => {
    await GET(makeGetRequest(SERIES_ID), makeParams(SERIES_ID));

    expect(mocks.listAllocationsByTrainingSeries).toHaveBeenCalledWith(TENANT_A, SERIES_ID);
  });

  it("A8. tenant isolation — wrong tenant gets 404 when series not found for that tenant", async () => {
    mocks.requireApiAnyPermission.mockResolvedValue(makeAuthOk(TENANT_B));
    mocks.listAllocationsByTrainingSeries.mockRejectedValue(
      new TrainingSeriesNotFoundError(SERIES_ID),
    );

    const res = await GET(makeGetRequest(SERIES_ID), makeParams(SERIES_ID));

    expect(res.status).toBe(404);
  });
});

// ── B. POST /api/training-series/:seriesId/allocations ────────────────────────

describe("B. POST /api/training-series/:seriesId/allocations", () => {
  it("B1. returns 401 when unauthenticated", async () => {
    mocks.requireApiAnyPermission.mockResolvedValue(makeAuthFail());

    const res = await POST(
      makePostRequest(SERIES_ID, { facilityResourceId: RESOURCE_ID }),
      makeParams(SERIES_ID),
    );

    expect(res.status).toBe(401);
  });

  it("B2. returns 403 when forbidden", async () => {
    mocks.requireApiAnyPermission.mockResolvedValue(makeAuthForbidden());

    const res = await POST(
      makePostRequest(SERIES_ID, { facilityResourceId: RESOURCE_ID }),
      makeParams(SERIES_ID),
    );

    expect(res.status).toBe(403);
  });

  it("B3. returns 400 when request body is missing", async () => {
    const req = new NextRequest(
      `http://localhost/api/training-series/${SERIES_ID}/allocations`,
      { method: "POST" },
    );

    const res = await POST(req, makeParams(SERIES_ID));

    expect(res.status).toBe(400);
  });

  it("B4. returns 400 when facilityResourceId is missing", async () => {
    const res = await POST(
      makePostRequest(SERIES_ID, { notes: "test" }),
      makeParams(SERIES_ID),
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/facilityResourceId/i);
  });

  it("B5. returns 400 when facilityResourceId is empty string", async () => {
    const res = await POST(
      makePostRequest(SERIES_ID, { facilityResourceId: "  " }),
      makeParams(SERIES_ID),
    );

    expect(res.status).toBe(400);
  });

  it("B6. returns 404 when training series not found", async () => {
    mocks.createTrainingAllocation.mockRejectedValue(
      new TrainingSeriesNotFoundError(SERIES_ID),
    );

    const res = await POST(
      makePostRequest(SERIES_ID, { facilityResourceId: RESOURCE_ID }),
      makeParams(SERIES_ID),
    );

    expect(res.status).toBe(404);
  });

  it("B7. returns 404 when facility resource not found", async () => {
    mocks.createTrainingAllocation.mockRejectedValue(
      new TrainingAllocationResourceNotFoundError(RESOURCE_ID),
    );

    const res = await POST(
      makePostRequest(SERIES_ID, { facilityResourceId: RESOURCE_ID }),
      makeParams(SERIES_ID),
    );

    expect(res.status).toBe(404);
  });

  it("B8. returns 422 when facility resource is archived", async () => {
    mocks.createTrainingAllocation.mockRejectedValue(
      new TrainingAllocationArchivedResourceError(RESOURCE_ID),
    );

    const res = await POST(
      makePostRequest(SERIES_ID, { facilityResourceId: RESOURCE_ID }),
      makeParams(SERIES_ID),
    );

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toMatch(/archived/i);
  });

  it("B8b. returns 422 when parent facility is archived", async () => {
    mocks.createTrainingAllocation.mockRejectedValue(
      new TrainingAllocationArchivedFacilityError("facility-01"),
    );

    const res = await POST(
      makePostRequest(SERIES_ID, { facilityResourceId: RESOURCE_ID }),
      makeParams(SERIES_ID),
    );

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toMatch(/archived/i);
  });

  it("B9. returns 409 for duplicate allocation", async () => {
    mocks.createTrainingAllocation.mockRejectedValue(
      new TrainingAllocationDuplicateError(SERIES_ID, RESOURCE_ID),
    );

    const res = await POST(
      makePostRequest(SERIES_ID, { facilityResourceId: RESOURCE_ID }),
      makeParams(SERIES_ID),
    );

    expect(res.status).toBe(409);
  });

  it("B10. returns 201 with allocation on success", async () => {
    mocks.createTrainingAllocation.mockResolvedValue(makeAllocationDto());

    const res = await POST(
      makePostRequest(SERIES_ID, { facilityResourceId: RESOURCE_ID }),
      makeParams(SERIES_ID),
    );

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.allocation).toBeDefined();
    expect(body.allocation.id).toBe(ALLOCATION_ID);
    expect(body.allocation.facilityResourceType).toBe("FULL_PITCH");
  });

  it("B11. passes seriesId from URL (not body) to service", async () => {
    await POST(
      makePostRequest(SERIES_ID, { facilityResourceId: RESOURCE_ID }),
      makeParams(SERIES_ID),
    );

    expect(mocks.createTrainingAllocation).toHaveBeenCalledWith(
      TENANT_A,
      expect.objectContaining({ trainingSeriesId: SERIES_ID }),
    );
  });

  it("B12. passes tenantId from session (not body) to service", async () => {
    await POST(
      makePostRequest(SERIES_ID, { facilityResourceId: RESOURCE_ID }),
      makeParams(SERIES_ID),
    );

    expect(mocks.createTrainingAllocation).toHaveBeenCalledWith(
      TENANT_A,
      expect.anything(),
    );
  });

  it("B13. passes notes when provided", async () => {
    await POST(
      makePostRequest(SERIES_ID, { facilityResourceId: RESOURCE_ID, notes: "test note" }),
      makeParams(SERIES_ID),
    );

    expect(mocks.createTrainingAllocation).toHaveBeenCalledWith(
      TENANT_A,
      expect.objectContaining({ notes: "test note" }),
    );
  });

  it("B14. invalid payload (non-JSON body) returns 400", async () => {
    const req = new NextRequest(
      `http://localhost/api/training-series/${SERIES_ID}/allocations`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not-json-{{",
      },
    );

    const res = await POST(req, makeParams(SERIES_ID));

    expect(res.status).toBe(400);
  });
});
