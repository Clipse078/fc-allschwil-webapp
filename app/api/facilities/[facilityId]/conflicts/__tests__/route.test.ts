/**
 * Tests for POST /api/facilities/[facilityId]/conflicts
 *
 * Covers: authentication, body validation, ownership checks,
 * ACTIVE status enforcement, valid creation, duplicate/reverse-duplicate.
 *
 * All external dependencies are mocked. No real database access.
 *
 * Security invariants verified:
 *   - tenantId is NEVER accepted from the request body.
 *   - facilityId comes only from the URL param (simulated via `params`).
 *   - validateConflictRuleResources is always called with session tenantId.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

// ── Mock external dependencies before importing the route ─────────────────────

const mockRequireApiAnyPermission = vi.fn();
const mockGetConflictRulesForFacility = vi.fn();
const mockCreateConflictRule = vi.fn();
const mockValidateConflictRuleResources = vi.fn();
const mockConflictRuleExists = vi.fn();

vi.mock("@/lib/permissions/require-api-any-permission", () => ({
  requireApiAnyPermission: mockRequireApiAnyPermission,
}));

vi.mock("@/lib/facilities/queries", () => ({
  getConflictRulesForFacility: mockGetConflictRulesForFacility,
  createConflictRule: mockCreateConflictRule,
  validateConflictRuleResources: mockValidateConflictRuleResources,
  conflictRuleExists: mockConflictRuleExists,
}));

// Import after mocks are registered
const { POST, GET } = await import("../route");

// ── Fixtures ──────────────────────────────────────────────────────────────────

const TENANT_ID = "tenant-abc";
const FACILITY_ID = "facility-1";
const RESOURCE_A = "resource-a";
const RESOURCE_B = "resource-b";
const ROUTE_URL = `http://localhost/api/facilities/${FACILITY_ID}/conflicts`;

const AUTHENTICATED = {
  ok: true as const,
  status: 200,
  error: null,
  session: { user: { id: "user-1", email: "admin@test.invalid", tenantId: TENANT_ID } },
};

const UNAUTHENTICATED = {
  ok: false as const,
  status: 401,
  error: "Unauthorized",
  session: null,
};

const FORBIDDEN = {
  ok: false as const,
  status: 403,
  error: "Forbidden",
  session: null,
};

const NO_TENANT = {
  ok: true as const,
  status: 200,
  error: null,
  session: { user: { id: "user-2", email: "x@test.invalid", tenantId: null } },
};

const VALIDATION_OK = { ok: true as const };

function makeParams(facilityId = FACILITY_ID) {
  return { params: Promise.resolve({ facilityId }) };
}

function makePost(body: unknown): NextRequest {
  return new NextRequest(ROUTE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const CREATED_RULE = {
  id: "rule-1",
  resourceAId: RESOURCE_A,
  resourceBId: RESOURCE_B,
  resourceA: { id: RESOURCE_A, name: "Field A", code: "FIELD_A" },
  resourceB: { id: RESOURCE_B, name: "Field B", code: "FIELD_B" },
};

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireApiAnyPermission.mockResolvedValue(AUTHENTICATED);
  mockValidateConflictRuleResources.mockResolvedValue(VALIDATION_OK);
  mockConflictRuleExists.mockResolvedValue(false);
  mockCreateConflictRule.mockResolvedValue(CREATED_RULE);
  mockGetConflictRulesForFacility.mockResolvedValue([]);
});

// ═════════════════════════════════════════════════════════════════════════════
// POST /api/facilities/[facilityId]/conflicts
// ═════════════════════════════════════════════════════════════════════════════

describe("POST /api/facilities/[facilityId]/conflicts", () => {
  // ── Auth ──────────────────────────────────────────────────────────────────

  it("POST-1. rejects unauthenticated request with 401", async () => {
    mockRequireApiAnyPermission.mockResolvedValue(UNAUTHENTICATED);
    const res = await POST(makePost({ resourceAId: RESOURCE_A, resourceBId: RESOURCE_B }), makeParams());
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("POST-2. rejects forbidden request with 403", async () => {
    mockRequireApiAnyPermission.mockResolvedValue(FORBIDDEN);
    const res = await POST(makePost({ resourceAId: RESOURCE_A, resourceBId: RESOURCE_B }), makeParams());
    expect(res.status).toBe(403);
  });

  it("POST-3. returns 400 when tenant context is missing from session", async () => {
    mockRequireApiAnyPermission.mockResolvedValue(NO_TENANT);
    const res = await POST(makePost({ resourceAId: RESOURCE_A, resourceBId: RESOURCE_B }), makeParams());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/tenant/i);
  });

  // ── Body validation ───────────────────────────────────────────────────────

  it("POST-4. returns 400 when resourceAId is missing", async () => {
    const res = await POST(makePost({ resourceBId: RESOURCE_B }), makeParams());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/resourceAId/i);
  });

  it("POST-5. returns 400 when resourceBId is missing", async () => {
    const res = await POST(makePost({ resourceAId: RESOURCE_A }), makeParams());
    expect(res.status).toBe(400);
  });

  it("POST-6. returns 400 when resourceAId is an empty string", async () => {
    const res = await POST(makePost({ resourceAId: "  ", resourceBId: RESOURCE_B }), makeParams());
    expect(res.status).toBe(400);
  });

  it("POST-7. returns 400 when resourceAId equals resourceBId (self-conflict)", async () => {
    const res = await POST(makePost({ resourceAId: RESOURCE_A, resourceBId: RESOURCE_A }), makeParams());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/conflict with itself/i);
  });

  it("POST-7b. does not call validateConflictRuleResources for self-conflict", async () => {
    await POST(makePost({ resourceAId: RESOURCE_A, resourceBId: RESOURCE_A }), makeParams());
    expect(mockValidateConflictRuleResources).not.toHaveBeenCalled();
  });

  // ── Ownership and status validation ──────────────────────────────────────

  it("POST-8. returns 404 when resource A is not found in this facility", async () => {
    mockValidateConflictRuleResources.mockResolvedValue({
      ok: false,
      status: 404,
      error: "Resource not found in this facility",
    });
    const res = await POST(makePost({ resourceAId: "missing-a", resourceBId: RESOURCE_B }), makeParams());
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("Resource not found in this facility");
  });

  it("POST-9. returns 404 when resource B is not found in this facility", async () => {
    mockValidateConflictRuleResources.mockResolvedValue({
      ok: false,
      status: 404,
      error: "Resource not found in this facility",
    });
    const res = await POST(makePost({ resourceAId: RESOURCE_A, resourceBId: "missing-b" }), makeParams());
    expect(res.status).toBe(404);
  });

  it("POST-10. returns 404 when resource belongs to a different tenant (treated as not found)", async () => {
    mockValidateConflictRuleResources.mockResolvedValue({
      ok: false,
      status: 404,
      error: "Resource not found in this facility",
    });
    const res = await POST(makePost({ resourceAId: "other-tenant-resource", resourceBId: RESOURCE_B }), makeParams());
    expect(res.status).toBe(404);
  });

  it("POST-11. returns 404 when resource belongs to a different facility (treated as not found)", async () => {
    mockValidateConflictRuleResources.mockResolvedValue({
      ok: false,
      status: 404,
      error: "Resource not found in this facility",
    });
    const res = await POST(makePost({ resourceAId: "other-facility-resource", resourceBId: RESOURCE_B }), makeParams());
    expect(res.status).toBe(404);
  });

  it("POST-12. returns 400 when resource A is not ACTIVE", async () => {
    mockValidateConflictRuleResources.mockResolvedValue({
      ok: false,
      status: 400,
      error: "Both resources must have status ACTIVE",
    });
    const res = await POST(makePost({ resourceAId: "archived-resource", resourceBId: RESOURCE_B }), makeParams());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/ACTIVE/);
  });

  it("POST-13. returns 400 when resource B is not ACTIVE", async () => {
    mockValidateConflictRuleResources.mockResolvedValue({
      ok: false,
      status: 400,
      error: "Both resources must have status ACTIVE",
    });
    const res = await POST(makePost({ resourceAId: RESOURCE_A, resourceBId: "inactive-resource" }), makeParams());
    expect(res.status).toBe(400);
  });

  it("POST-14. returns 404 when facility itself is not found for this tenant", async () => {
    mockValidateConflictRuleResources.mockResolvedValue({
      ok: false,
      status: 404,
      error: "Facility not found",
    });
    const res = await POST(makePost({ resourceAId: RESOURCE_A, resourceBId: RESOURCE_B }), makeParams("nonexistent-facility"));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("Facility not found");
  });

  // ── Duplicate detection ───────────────────────────────────────────────────

  it("POST-15. returns 409 for a duplicate pair", async () => {
    mockConflictRuleExists.mockResolvedValue(true);
    const res = await POST(makePost({ resourceAId: RESOURCE_A, resourceBId: RESOURCE_B }), makeParams());
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/already exists/i);
  });

  it("POST-16. returns 409 for a reverse duplicate pair (B,A after A,B was created)", async () => {
    // The route trims and passes to conflictRuleExists which applies canonical ordering.
    mockConflictRuleExists.mockResolvedValue(true);
    const res = await POST(makePost({ resourceAId: RESOURCE_B, resourceBId: RESOURCE_A }), makeParams());
    expect(res.status).toBe(409);
  });

  it("POST-16b. conflictRuleExists is called with the exact IDs from the body (canonical ordering is handled inside the helper)", async () => {
    await POST(makePost({ resourceAId: RESOURCE_A, resourceBId: RESOURCE_B }), makeParams());
    expect(mockConflictRuleExists).toHaveBeenCalledWith({
      facilityId: FACILITY_ID,
      resourceAId: RESOURCE_A,
      resourceBId: RESOURCE_B,
    });
  });

  it("POST-17. does not call createConflictRule when duplicate exists", async () => {
    mockConflictRuleExists.mockResolvedValue(true);
    await POST(makePost({ resourceAId: RESOURCE_A, resourceBId: RESOURCE_B }), makeParams());
    expect(mockCreateConflictRule).not.toHaveBeenCalled();
  });

  // ── Successful creation ───────────────────────────────────────────────────

  it("POST-18. returns 201 with rule on valid creation", async () => {
    const res = await POST(makePost({ resourceAId: RESOURCE_A, resourceBId: RESOURCE_B }), makeParams());
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.rule).toEqual(CREATED_RULE);
  });

  it("POST-19. calls createConflictRule with session tenantId and URL facilityId", async () => {
    await POST(makePost({ resourceAId: RESOURCE_A, resourceBId: RESOURCE_B }), makeParams());
    expect(mockCreateConflictRule).toHaveBeenCalledWith({
      tenantId: TENANT_ID,
      facilityId: FACILITY_ID,
      resourceAId: RESOURCE_A,
      resourceBId: RESOURCE_B,
    });
  });

  it("POST-20. calls validateConflictRuleResources with session tenantId and URL facilityId", async () => {
    await POST(makePost({ resourceAId: RESOURCE_A, resourceBId: RESOURCE_B }), makeParams());
    expect(mockValidateConflictRuleResources).toHaveBeenCalledWith({
      tenantId: TENANT_ID,
      facilityId: FACILITY_ID,
      resourceAId: RESOURCE_A,
      resourceBId: RESOURCE_B,
    });
  });

  it("POST-21. does not call createConflictRule when validation fails", async () => {
    mockValidateConflictRuleResources.mockResolvedValue({
      ok: false,
      status: 404,
      error: "Resource not found in this facility",
    });
    await POST(makePost({ resourceAId: RESOURCE_A, resourceBId: RESOURCE_B }), makeParams());
    expect(mockCreateConflictRule).not.toHaveBeenCalled();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// GET /api/facilities/[facilityId]/conflicts
// ═════════════════════════════════════════════════════════════════════════════

describe("GET /api/facilities/[facilityId]/conflicts", () => {
  it("GET-1. returns rules for the authenticated tenant and route facility", async () => {
    const rules = [CREATED_RULE];
    mockGetConflictRulesForFacility.mockResolvedValue(rules);

    const req = new NextRequest(ROUTE_URL);
    const res = await GET(req, makeParams());

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.rules).toEqual(rules);
  });

  it("GET-2. calls getConflictRulesForFacility with session tenantId and URL facilityId", async () => {
    const req = new NextRequest(ROUTE_URL);
    await GET(req, makeParams());
    expect(mockGetConflictRulesForFacility).toHaveBeenCalledWith(FACILITY_ID, TENANT_ID);
  });

  it("GET-3. rejects unauthenticated request with 401", async () => {
    mockRequireApiAnyPermission.mockResolvedValue(UNAUTHENTICATED);
    const req = new NextRequest(ROUTE_URL);
    const res = await GET(req, makeParams());
    expect(res.status).toBe(401);
  });
});
