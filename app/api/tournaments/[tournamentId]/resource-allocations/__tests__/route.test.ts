/**
 * app/api/tournaments/[tournamentId]/resource-allocations/__tests__/route.test.ts
 *
 * GET  /api/tournaments/:tournamentId/resource-allocations
 * POST /api/tournaments/:tournamentId/resource-allocations
 */

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireApiAnyPermission: vi.fn(),
  listTournamentResourceAllocations: vi.fn(),
  addTournamentResourceAllocation: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/permissions/require-api-any-permission", () => ({
  requireApiAnyPermission: mocks.requireApiAnyPermission,
}));

vi.mock("@/lib/tournaments/resource-allocation-service", () => ({
  listTournamentResourceAllocations: mocks.listTournamentResourceAllocations,
  addTournamentResourceAllocation: mocks.addTournamentResourceAllocation,
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import { GET, POST } from "../route";
import {
  TournamentNotFoundError,
  TournamentResourceAllocationResourceNotFoundError,
  TournamentResourceAllocationArchivedResourceError,
  TournamentResourceAllocationDuplicateError,
} from "@/lib/tournaments/errors";

const TENANT_A = "tenant-a";
const TOURNAMENT_ID = "tournament-01";

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
    id: "alloc-01",
    facilityResourceId: "fr-kr2",
    facilityResourceCode: "KUNSTRASEN_2",
    facilityResourceName: "Kunstrasen 2",
    facilityResourceType: "FULL_PITCH",
    facilityId: "facility-01",
    facilityName: "Sportanlage",
    notes: null,
    displayOrder: 0,
    ...overrides,
  };
}

function makeGetRequest(): NextRequest {
  return new NextRequest(`http://localhost/api/tournaments/${TOURNAMENT_ID}/resource-allocations`, {
    method: "GET",
  });
}

function makePostRequest(body: unknown): NextRequest {
  return new NextRequest(`http://localhost/api/tournaments/${TOURNAMENT_ID}/resource-allocations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeParams() {
  return { params: Promise.resolve({ tournamentId: TOURNAMENT_ID }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireApiAnyPermission.mockResolvedValue(makeAuthOk());
  mocks.listTournamentResourceAllocations.mockResolvedValue([]);
  mocks.addTournamentResourceAllocation.mockResolvedValue(makeAllocationDto());
});

describe("GET /api/tournaments/:tournamentId/resource-allocations", () => {
  it("returns 401 when unauthenticated", async () => {
    mocks.requireApiAnyPermission.mockResolvedValue({ ok: false, status: 401, error: "Unauthorized", session: null });
    const res = await GET(makeGetRequest(), makeParams());
    expect(res.status).toBe(401);
  });

  it("supports multiple allocations for a HOME tournament", async () => {
    mocks.listTournamentResourceAllocations.mockResolvedValue([
      makeAllocationDto({ id: "alloc-1", facilityResourceCode: "KR2" }),
      makeAllocationDto({ id: "alloc-2", facilityResourceCode: "KR3_A" }),
      makeAllocationDto({ id: "alloc-3", facilityResourceCode: "KR3_B" }),
    ]);

    const res = await GET(makeGetRequest(), makeParams());

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.allocations).toHaveLength(3);
  });

  it("returns 404 when the tournament is not found", async () => {
    mocks.listTournamentResourceAllocations.mockRejectedValue(new TournamentNotFoundError(TOURNAMENT_ID));
    const res = await GET(makeGetRequest(), makeParams());
    expect(res.status).toBe(404);
  });
});

describe("POST /api/tournaments/:tournamentId/resource-allocations", () => {
  it("returns 400 when facilityResourceId is missing", async () => {
    const res = await POST(makePostRequest({}), makeParams());
    expect(res.status).toBe(400);
  });

  it("returns 201 with the created allocation", async () => {
    const res = await POST(makePostRequest({ facilityResourceId: "fr-kr2" }), makeParams());
    expect(res.status).toBe(201);
  });

  it("returns 404 when the resource is not found", async () => {
    mocks.addTournamentResourceAllocation.mockRejectedValue(
      new TournamentResourceAllocationResourceNotFoundError("fr-unknown"),
    );
    const res = await POST(makePostRequest({ facilityResourceId: "fr-unknown" }), makeParams());
    expect(res.status).toBe(404);
  });

  it("returns 422 when the resource is archived", async () => {
    mocks.addTournamentResourceAllocation.mockRejectedValue(
      new TournamentResourceAllocationArchivedResourceError("fr-kr2"),
    );
    const res = await POST(makePostRequest({ facilityResourceId: "fr-kr2" }), makeParams());
    expect(res.status).toBe(422);
  });

  it("returns 409 for a duplicate allocation", async () => {
    mocks.addTournamentResourceAllocation.mockRejectedValue(
      new TournamentResourceAllocationDuplicateError(TOURNAMENT_ID, "fr-kr2"),
    );
    const res = await POST(makePostRequest({ facilityResourceId: "fr-kr2" }), makeParams());
    expect(res.status).toBe(409);
  });
});
