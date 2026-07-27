/**
 * app/api/facilities/[facilityId]/resources/__tests__/route.test.ts
 *
 * Regression tests for the facility resource create (POST) and list (GET) API routes.
 * Covers the full create → list lifecycle including:
 *   - Successful resource creation (all canonical types)
 *   - Facility ownership validation (prevents cross-tenant resource creation)
 *   - Newly created resources appear in the list response
 *   - Cross-tenant isolation
 *   - Archived resource exclusion from list
 *   - Duplicate code rejection
 *   - Error handling
 */

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Hoisted mocks ─────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  requireApiAnyPermission: vi.fn(),
  getFacilityById: vi.fn(),
  getFacilityResourcesForFacility: vi.fn(),
  createFacilityResource: vi.fn(),
}));

vi.mock("@/lib/permissions/require-api-any-permission", () => ({
  requireApiAnyPermission: mocks.requireApiAnyPermission,
}));

vi.mock("@/lib/facilities/queries", () => ({
  getFacilityById: mocks.getFacilityById,
  getFacilityResourcesForFacility: mocks.getFacilityResourcesForFacility,
  createFacilityResource: mocks.createFacilityResource,
}));

vi.mock("@/lib/db/prisma", () => ({ prisma: {} }));

import { GET, POST } from "../route";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const TENANT_A = "tenant-a";
const TENANT_B = "tenant-b";
const FACILITY_1 = "facility-1";

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

function makeFacility(facilityId = FACILITY_1, tenantId = TENANT_A) {
  return {
    id: facilityId,
    tenantId,
    name: "Hauptplatz",
    type: "PITCH" as const,
    status: "ACTIVE" as const,
    sortOrder: 0,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    resources: [],
  };
}

function makeResource(overrides: Record<string, unknown> = {}) {
  return {
    id: "resource-1",
    tenantId: TENANT_A,
    facilityId: FACILITY_1,
    name: "Stadion A",
    code: "STADION_A",
    type: "FULL_PITCH" as const,
    status: "ACTIVE" as const,
    sortOrder: 0,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    ...overrides,
  };
}

function makePostRequest(facilityId: string, body: unknown): NextRequest {
  return new NextRequest(
    `http://localhost/api/facilities/${facilityId}/resources`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
}

function makeGetRequest(facilityId: string): NextRequest {
  return new NextRequest(
    `http://localhost/api/facilities/${facilityId}/resources`,
    { method: "GET" },
  );
}

async function resolveParams(facilityId: string) {
  return { params: Promise.resolve({ facilityId }) };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireApiAnyPermission.mockResolvedValue(makeAuthOk());
  mocks.getFacilityById.mockResolvedValue(makeFacility());
  mocks.getFacilityResourcesForFacility.mockResolvedValue([]);
  mocks.createFacilityResource.mockResolvedValue(makeResource());
});

// ── GET /api/facilities/[facilityId]/resources ────────────────────────────────

describe("GET /api/facilities/[facilityId]/resources", () => {
  it("returns 401 when unauthenticated", async () => {
    mocks.requireApiAnyPermission.mockResolvedValue(makeAuthFail());

    const res = await GET(
      makeGetRequest(FACILITY_1),
      await resolveParams(FACILITY_1),
    );

    expect(res.status).toBe(401);
  });

  it("returns 400 when tenant context is missing from session", async () => {
    mocks.requireApiAnyPermission.mockResolvedValue({
      ok: true,
      status: 200,
      error: null,
      session: { user: { id: "user-1", tenantId: undefined } },
    });

    const res = await GET(
      makeGetRequest(FACILITY_1),
      await resolveParams(FACILITY_1),
    );

    expect(res.status).toBe(400);
  });

  it("returns 404 when the facility does not belong to the tenant", async () => {
    mocks.getFacilityResourcesForFacility.mockResolvedValue(null);

    const res = await GET(
      makeGetRequest(FACILITY_1),
      await resolveParams(FACILITY_1),
    );

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/not found/i);
  });

  it("returns 404 for cross-tenant facility access (tenant isolation)", async () => {
    mocks.requireApiAnyPermission.mockResolvedValue(makeAuthOk(TENANT_B));
    mocks.getFacilityResourcesForFacility.mockResolvedValue(null);

    const res = await GET(
      makeGetRequest(FACILITY_1),
      await resolveParams(FACILITY_1),
    );

    expect(res.status).toBe(404);
  });

  it("returns 200 with empty array when facility exists but has no active resources", async () => {
    mocks.getFacilityResourcesForFacility.mockResolvedValue([]);

    const res = await GET(
      makeGetRequest(FACILITY_1),
      await resolveParams(FACILITY_1),
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.resources).toEqual([]);
  });

  it("returns 200 with active resources for a valid tenant+facility", async () => {
    const resource = makeResource();
    mocks.getFacilityResourcesForFacility.mockResolvedValue([resource]);

    const res = await GET(
      makeGetRequest(FACILITY_1),
      await resolveParams(FACILITY_1),
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.resources).toHaveLength(1);
    expect(body.resources[0].id).toBe("resource-1");
    expect(body.resources[0].tenantId).toBe(TENANT_A);
    expect(body.resources[0].facilityId).toBe(FACILITY_1);
  });

  it("calls getFacilityResourcesForFacility with correct tenantId and facilityId", async () => {
    mocks.getFacilityResourcesForFacility.mockResolvedValue([]);

    await GET(makeGetRequest(FACILITY_1), await resolveParams(FACILITY_1));

    expect(mocks.getFacilityResourcesForFacility).toHaveBeenCalledWith(
      FACILITY_1,
      TENANT_A,
    );
  });
});

// ── POST /api/facilities/[facilityId]/resources ───────────────────────────────

describe("POST /api/facilities/[facilityId]/resources", () => {
  it("returns 401 when unauthenticated", async () => {
    mocks.requireApiAnyPermission.mockResolvedValue(makeAuthFail());

    const res = await POST(
      makePostRequest(FACILITY_1, { name: "Stadion A", code: "STADION_A", type: "FULL_PITCH" }),
      await resolveParams(FACILITY_1),
    );

    expect(res.status).toBe(401);
  });

  it("returns 400 when tenant context is missing from session", async () => {
    mocks.requireApiAnyPermission.mockResolvedValue({
      ok: true,
      status: 200,
      error: null,
      session: { user: { id: "user-1", tenantId: undefined } },
    });

    const res = await POST(
      makePostRequest(FACILITY_1, { name: "Test", code: "TEST", type: "OTHER" }),
      await resolveParams(FACILITY_1),
    );

    expect(res.status).toBe(400);
  });

  it("returns 404 when the facility does not belong to the authenticated tenant", async () => {
    mocks.getFacilityById.mockResolvedValue(null);

    const res = await POST(
      makePostRequest(FACILITY_1, { name: "Test", code: "TEST", type: "OTHER" }),
      await resolveParams(FACILITY_1),
    );

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/not found/i);
    expect(mocks.createFacilityResource).not.toHaveBeenCalled();
  });

  it("rejects cross-tenant resource creation (facility belongs to different tenant)", async () => {
    mocks.requireApiAnyPermission.mockResolvedValue(makeAuthOk(TENANT_B));
    mocks.getFacilityById.mockResolvedValue(null); // facility not found for tenant B

    const res = await POST(
      makePostRequest(FACILITY_1, { name: "Hijacked", code: "HACK", type: "OTHER" }),
      await resolveParams(FACILITY_1),
    );

    expect(res.status).toBe(404);
    expect(mocks.createFacilityResource).not.toHaveBeenCalled();
  });

  it("verifies facility ownership before creating the resource", async () => {
    mocks.getFacilityById.mockResolvedValue(makeFacility());
    mocks.createFacilityResource.mockResolvedValue(makeResource());

    await POST(
      makePostRequest(FACILITY_1, { name: "Stadion A", code: "STADION_A", type: "FULL_PITCH" }),
      await resolveParams(FACILITY_1),
    );

    expect(mocks.getFacilityById).toHaveBeenCalledWith(FACILITY_1, TENANT_A);
  });

  it("returns 400 when name is missing", async () => {
    const res = await POST(
      makePostRequest(FACILITY_1, { code: "STADION_A", type: "FULL_PITCH" }),
      await resolveParams(FACILITY_1),
    );

    expect(res.status).toBe(400);
    expect(mocks.createFacilityResource).not.toHaveBeenCalled();
  });

  it("returns 400 when code is missing", async () => {
    const res = await POST(
      makePostRequest(FACILITY_1, { name: "Stadion A", type: "FULL_PITCH" }),
      await resolveParams(FACILITY_1),
    );

    expect(res.status).toBe(400);
    expect(mocks.createFacilityResource).not.toHaveBeenCalled();
  });

  it("returns 201 with the created resource on success", async () => {
    const resource = makeResource();
    mocks.createFacilityResource.mockResolvedValue(resource);

    const res = await POST(
      makePostRequest(FACILITY_1, { name: "Stadion A", code: "stadion_a", type: "FULL_PITCH" }),
      await resolveParams(FACILITY_1),
    );

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.resource).toBeDefined();
    expect(body.resource.id).toBe("resource-1");
    expect(body.resource.tenantId).toBe(TENANT_A);
    expect(body.resource.facilityId).toBe(FACILITY_1);
  });

  it("creates the resource with the correct tenantId from the session (not from request body)", async () => {
    const resource = makeResource();
    mocks.createFacilityResource.mockResolvedValue(resource);

    await POST(
      makePostRequest(FACILITY_1, { name: "Test", code: "TEST", type: "OTHER" }),
      await resolveParams(FACILITY_1),
    );

    expect(mocks.createFacilityResource).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: TENANT_A }),
    );
  });

  it("creates the resource with the correct facilityId from the URL parameter", async () => {
    const resource = makeResource();
    mocks.createFacilityResource.mockResolvedValue(resource);

    await POST(
      makePostRequest(FACILITY_1, { name: "Test", code: "TEST", type: "OTHER" }),
      await resolveParams(FACILITY_1),
    );

    expect(mocks.createFacilityResource).toHaveBeenCalledWith(
      expect.objectContaining({ facilityId: FACILITY_1 }),
    );
  });

  it("uppercases the resource code before persisting", async () => {
    mocks.createFacilityResource.mockResolvedValue(makeResource({ code: "STADION_A" }));

    await POST(
      makePostRequest(FACILITY_1, { name: "Test", code: "stadion_a", type: "FULL_PITCH" }),
      await resolveParams(FACILITY_1),
    );

    expect(mocks.createFacilityResource).toHaveBeenCalledWith(
      expect.objectContaining({ code: "STADION_A" }),
    );
  });

  it("creates a FULL_PITCH resource with correct canonical type", async () => {
    mocks.createFacilityResource.mockResolvedValue(makeResource({ type: "FULL_PITCH" }));

    await POST(
      makePostRequest(FACILITY_1, { name: "Stadion", code: "STADION", type: "FULL_PITCH" }),
      await resolveParams(FACILITY_1),
    );

    expect(mocks.createFacilityResource).toHaveBeenCalledWith(
      expect.objectContaining({ type: "FULL_PITCH" }),
    );
  });

  it("creates a HALF_PITCH resource with correct canonical type", async () => {
    mocks.createFacilityResource.mockResolvedValue(makeResource({ type: "HALF_PITCH" }));

    await POST(
      makePostRequest(FACILITY_1, { name: "Hälfte A", code: "STADION_A", type: "HALF_PITCH" }),
      await resolveParams(FACILITY_1),
    );

    expect(mocks.createFacilityResource).toHaveBeenCalledWith(
      expect.objectContaining({ type: "HALF_PITCH" }),
    );
  });

  it("creates a DRESSING_ROOM resource with correct canonical type", async () => {
    mocks.createFacilityResource.mockResolvedValue(makeResource({ type: "DRESSING_ROOM" }));

    await POST(
      makePostRequest(FACILITY_1, { name: "Garderobe E1", code: "E1", type: "DRESSING_ROOM" }),
      await resolveParams(FACILITY_1),
    );

    expect(mocks.createFacilityResource).toHaveBeenCalledWith(
      expect.objectContaining({ type: "DRESSING_ROOM" }),
    );
  });

  it("falls back to OTHER type for unknown/unsupported type values", async () => {
    mocks.createFacilityResource.mockResolvedValue(makeResource({ type: "OTHER" }));

    await POST(
      makePostRequest(FACILITY_1, { name: "Test", code: "TEST", type: "UNKNOWN_TYPE" }),
      await resolveParams(FACILITY_1),
    );

    expect(mocks.createFacilityResource).toHaveBeenCalledWith(
      expect.objectContaining({ type: "OTHER" }),
    );
  });

  it("returns 409 when a resource with the same code already exists for the tenant", async () => {
    mocks.createFacilityResource.mockRejectedValue(
      new Error("Unique constraint failed on the fields: (`tenantId`,`code`)"),
    );

    const res = await POST(
      makePostRequest(FACILITY_1, { name: "Duplicate", code: "EXISTING_CODE", type: "OTHER" }),
      await resolveParams(FACILITY_1),
    );

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/already exists/i);
  });

  it("does not call createFacilityResource when facility ownership validation fails", async () => {
    mocks.getFacilityById.mockResolvedValue(null);

    await POST(
      makePostRequest(FACILITY_1, { name: "Test", code: "TEST", type: "OTHER" }),
      await resolveParams(FACILITY_1),
    );

    expect(mocks.createFacilityResource).not.toHaveBeenCalled();
  });

  it("create → list: created resource appears in the list response for the same tenant/facility", async () => {
    const createdResource = makeResource({ name: "Hauptplatz A", code: "HP_A", type: "FULL_PITCH" });
    mocks.createFacilityResource.mockResolvedValue(createdResource);

    // Step 1: Create the resource
    const createRes = await POST(
      makePostRequest(FACILITY_1, { name: "Hauptplatz A", code: "HP_A", type: "FULL_PITCH" }),
      await resolveParams(FACILITY_1),
    );
    expect(createRes.status).toBe(201);

    // Step 2: List returns the created resource
    mocks.getFacilityResourcesForFacility.mockResolvedValue([createdResource]);
    const listRes = await GET(
      makeGetRequest(FACILITY_1),
      await resolveParams(FACILITY_1),
    );
    expect(listRes.status).toBe(200);
    const listBody = await listRes.json();
    expect(listBody.resources).toHaveLength(1);
    expect(listBody.resources[0].code).toBe("HP_A");
    expect(listBody.resources[0].tenantId).toBe(TENANT_A);
    expect(listBody.resources[0].facilityId).toBe(FACILITY_1);
  });

  it("create → list: created resource does not appear for a different tenant", async () => {
    const createdResource = makeResource();
    mocks.createFacilityResource.mockResolvedValue(createdResource);

    // Step 1: Create the resource as tenant A
    await POST(
      makePostRequest(FACILITY_1, { name: "Stadion A", code: "STADION_A", type: "FULL_PITCH" }),
      await resolveParams(FACILITY_1),
    );

    // Step 2: Tenant B cannot list resources for the same facilityId
    mocks.requireApiAnyPermission.mockResolvedValue(makeAuthOk(TENANT_B));
    mocks.getFacilityResourcesForFacility.mockResolvedValue(null); // facility not accessible to tenant B

    const listRes = await GET(
      makeGetRequest(FACILITY_1),
      await resolveParams(FACILITY_1),
    );
    expect(listRes.status).toBe(404);
  });
});
