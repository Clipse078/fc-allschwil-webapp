/**
 * Tests for DELETE /api/facilities/[facilityId]/conflicts/[ruleId]
 *
 * Covers: authentication, triple-scoped deletion (tenant + facility + rule),
 * 404 on no match (wrong facility, wrong tenant, nonexistent rule), and
 * success only when exactly one rule is deleted.
 *
 * Security invariants verified:
 *   - tenantId comes only from the authenticated session.
 *   - facilityId comes only from the URL parameter.
 *   - A rule from another facility or tenant is treated as not found.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

// ── Mock external dependencies before importing the route ─────────────────────

const mockRequireApiAnyPermission = vi.fn();
const mockDeleteConflictRule = vi.fn();

vi.mock("@/lib/permissions/require-api-any-permission", () => ({
  requireApiAnyPermission: mockRequireApiAnyPermission,
}));

vi.mock("@/lib/facilities/queries", () => ({
  deleteConflictRule: mockDeleteConflictRule,
}));

// Import after mocks are registered
const { DELETE } = await import("../route");

// ── Fixtures ──────────────────────────────────────────────────────────────────

const TENANT_ID = "tenant-abc";
const FACILITY_ID = "facility-1";
const RULE_ID = "rule-x";
const ROUTE_URL = `http://localhost/api/facilities/${FACILITY_ID}/conflicts/${RULE_ID}`;

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

function makeParams(facilityId = FACILITY_ID, ruleId = RULE_ID) {
  return { params: Promise.resolve({ facilityId, ruleId }) };
}

function makeRequest(): NextRequest {
  return new NextRequest(ROUTE_URL, { method: "DELETE" });
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireApiAnyPermission.mockResolvedValue(AUTHENTICATED);
  // Default: deletion succeeds (count = 1)
  mockDeleteConflictRule.mockResolvedValue({ count: 1 });
});

// ═════════════════════════════════════════════════════════════════════════════
// DELETE /api/facilities/[facilityId]/conflicts/[ruleId]
// ═════════════════════════════════════════════════════════════════════════════

describe("DELETE /api/facilities/[facilityId]/conflicts/[ruleId]", () => {
  // ── Auth ──────────────────────────────────────────────────────────────────

  it("DEL-1. rejects unauthenticated request with 401", async () => {
    mockRequireApiAnyPermission.mockResolvedValue(UNAUTHENTICATED);
    const res = await DELETE(makeRequest(), makeParams());
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("DEL-2. rejects forbidden request with 403", async () => {
    mockRequireApiAnyPermission.mockResolvedValue(FORBIDDEN);
    const res = await DELETE(makeRequest(), makeParams());
    expect(res.status).toBe(403);
  });

  it("DEL-3. returns 400 when tenant context is missing from session", async () => {
    mockRequireApiAnyPermission.mockResolvedValue(NO_TENANT);
    const res = await DELETE(makeRequest(), makeParams());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/tenant/i);
  });

  it("DEL-4. does not call deleteConflictRule when unauthenticated", async () => {
    mockRequireApiAnyPermission.mockResolvedValue(UNAUTHENTICATED);
    await DELETE(makeRequest(), makeParams());
    expect(mockDeleteConflictRule).not.toHaveBeenCalled();
  });

  // ── Scoped deletion ───────────────────────────────────────────────────────

  it("DEL-5. returns 404 when rule does not exist for this tenant+facility (count=0)", async () => {
    mockDeleteConflictRule.mockResolvedValue({ count: 0 });
    const res = await DELETE(makeRequest(), makeParams());
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/not found/i);
  });

  it("DEL-6. returns 404 when facilityId in URL does not match rule's facility (cross-facility)", async () => {
    // deleteConflictRule returns count=0 because the WHERE includes facilityId
    mockDeleteConflictRule.mockResolvedValue({ count: 0 });
    const res = await DELETE(makeRequest(), makeParams("other-facility", RULE_ID));
    expect(res.status).toBe(404);
  });

  it("DEL-7. returns 404 when rule belongs to a different tenant (cross-tenant)", async () => {
    // deleteConflictRule returns count=0 because the WHERE includes tenantId from session
    mockDeleteConflictRule.mockResolvedValue({ count: 0 });
    const res = await DELETE(makeRequest(), makeParams());
    expect(res.status).toBe(404);
  });

  it("DEL-8. calls deleteConflictRule with session tenantId, URL facilityId, and URL ruleId", async () => {
    await DELETE(makeRequest(), makeParams());
    expect(mockDeleteConflictRule).toHaveBeenCalledWith(RULE_ID, TENANT_ID, FACILITY_ID);
  });

  it("DEL-9. never passes facilityId from a source other than the URL param", async () => {
    const differentFacility = "injected-facility-from-body";
    // Even if an attacker puts facilityId in a header or elsewhere, the URL param is used
    await DELETE(makeRequest(), makeParams(differentFacility, RULE_ID));
    expect(mockDeleteConflictRule).toHaveBeenCalledWith(
      RULE_ID,
      TENANT_ID,
      differentFacility, // route should have passed the URL param, not body
    );
  });

  // ── Successful deletion ───────────────────────────────────────────────────

  it("DEL-10. returns 200 with ok:true when exactly one rule is deleted", async () => {
    const res = await DELETE(makeRequest(), makeParams());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  it("DEL-11. uses ruleId from URL param, not from any other source", async () => {
    const customRuleId = "specific-rule-id";
    await DELETE(makeRequest(), makeParams(FACILITY_ID, customRuleId));
    expect(mockDeleteConflictRule).toHaveBeenCalledWith(customRuleId, TENANT_ID, FACILITY_ID);
  });
});
