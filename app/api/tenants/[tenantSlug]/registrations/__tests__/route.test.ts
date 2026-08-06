/**
 * RPERM-04-C1 — Registration List Route: Tenant-Slug Isolation Tests
 *
 * Covers GET /api/tenants/[tenantSlug]/registrations.
 *
 * Finding 2 fix under test: the route must resolve + validate the tenant
 * named by the URL's tenantSlug FIRST, then evaluate registrations.view /
 * registrations.edit against that EXACT tenant — never against
 * session.user.activeTenantId. Rejection must happen before any
 * registration data is fetched.
 *
 * Test groups:
 *   R-01  Tenant slug rejection (unknown/archived/no membership) → error
 *         returned, listRegistrationsForTenant() never called
 *   R-02  Permission denial for the resolved tenant → 403, data never fetched
 *   R-03  Success path: permission is checked against tenantResult.tenantId,
 *         not omitted (would otherwise default to activeTenantId)
 *   R-04  Cross-tenant scenario: a caller whose session.activeTenantId is
 *         Tenant A gets denied when requesting Tenant B's slug, even though
 *         Tenant B exists
 *   R-05  Multi-tenant caller: permission only in Tenant A → Tenant A
 *         allowed, Tenant B denied; once Tenant B permission is granted,
 *         Tenant B becomes allowed too
 */

import { NextRequest } from "next/server";
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  requireApiTenantContextForSlug: vi.fn(),
  requireApiAnyPermission: vi.fn(),
  listRegistrationsForTenant: vi.fn(),
}));

vi.mock("@/lib/tenants/active-tenant", () => ({
  requireApiTenantContextForSlug: mocks.requireApiTenantContextForSlug,
}));
vi.mock("@/lib/permissions/require-api-any-permission", () => ({
  requireApiAnyPermission: mocks.requireApiAnyPermission,
}));
vi.mock("@/lib/registrations/queries", () => ({
  listRegistrationsForTenant: mocks.listRegistrationsForTenant,
}));

import { GET } from "@/app/api/tenants/[tenantSlug]/registrations/route";

function makeContext(tenantSlug: string) {
  return { params: Promise.resolve({ tenantSlug }) };
}

const TENANT_A_ID = "tenant-a-id";
const TENANT_B_ID = "tenant-b-id";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/tenants/[tenantSlug]/registrations — tenant-slug isolation", () => {
  it("R-01: unknown/archived tenant slug or no membership → error returned, no registration data fetched", async () => {
    mocks.requireApiTenantContextForSlug.mockResolvedValue({
      ok: false,
      status: 404,
      error: "Tenant nicht gefunden.",
    });

    const res = await GET(new NextRequest("http://x/api/tenants/tenant-b/registrations"), makeContext("tenant-b"));
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe("Tenant nicht gefunden.");
    expect(mocks.requireApiAnyPermission).not.toHaveBeenCalled();
    expect(mocks.listRegistrationsForTenant).not.toHaveBeenCalled();
  });

  it("R-02: permission denial for the resolved tenant → 403, registration data never fetched", async () => {
    mocks.requireApiTenantContextForSlug.mockResolvedValue({
      ok: true,
      tenantId: TENANT_B_ID,
      tenant: { id: TENANT_B_ID, key: "tenant-b" },
    });
    mocks.requireApiAnyPermission.mockResolvedValue({
      ok: false,
      status: 403,
      error: "Forbidden",
      session: null,
    });

    const res = await GET(new NextRequest("http://x/api/tenants/tenant-b/registrations"), makeContext("tenant-b"));
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error).toBe("Forbidden");
    expect(mocks.listRegistrationsForTenant).not.toHaveBeenCalled();
  });

  it("R-03: permission is evaluated against the slug-resolved tenantId, never omitted", async () => {
    mocks.requireApiTenantContextForSlug.mockResolvedValue({
      ok: true,
      tenantId: TENANT_A_ID,
      tenant: { id: TENANT_A_ID, key: "tenant-a" },
    });
    mocks.requireApiAnyPermission.mockResolvedValue({
      ok: true,
      status: 200,
      error: null,
      session: { user: { id: "user-1" } },
    });
    mocks.listRegistrationsForTenant.mockResolvedValue([{ id: "reg-1" }]);

    const res = await GET(new NextRequest("http://x/api/tenants/tenant-a/registrations"), makeContext("tenant-a"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.registrations).toEqual([{ id: "reg-1" }]);

    // CRITICAL: the tenantId argument must be the slug-resolved tenant, not
    // omitted (omitting it would fall back to session.activeTenantId).
    expect(mocks.requireApiAnyPermission).toHaveBeenCalledWith(
      expect.any(Array),
      TENANT_A_ID,
    );
    // Data is fetched using the same slug that was validated.
    expect(mocks.listRegistrationsForTenant).toHaveBeenCalledWith("tenant-a");
  });

  it("R-04: a Tenant-A-only caller requesting Tenant B's slug is denied before Tenant B's tenantId ever reaches requireApiAnyPermission", async () => {
    // Simulates: session.activeTenantId = Tenant A, but the caller has no
    // active membership in Tenant B. requireApiTenantContextForSlug is the
    // resolver under test elsewhere (active-tenant.test.ts); here we assert
    // the ROUTE correctly stops at that gate and never calls
    // requireApiAnyPermission (and therefore never with Tenant A's id).
    mocks.requireApiTenantContextForSlug.mockResolvedValue({
      ok: false,
      status: 404,
      error: "Tenant nicht gefunden.",
    });

    const res = await GET(new NextRequest("http://x/api/tenants/tenant-b/registrations"), makeContext("tenant-b"));

    expect(res.status).toBe(404);
    expect(mocks.requireApiAnyPermission).not.toHaveBeenCalled();
  });

  it("R-05: multi-tenant caller — permission only in Tenant A is allowed for A and denied for B; granting Tenant B permission allows B", async () => {
    // -- Tenant A: membership + permission → allowed --
    mocks.requireApiTenantContextForSlug.mockResolvedValueOnce({
      ok: true,
      tenantId: TENANT_A_ID,
      tenant: { id: TENANT_A_ID, key: "tenant-a" },
    });
    mocks.requireApiAnyPermission.mockResolvedValueOnce({
      ok: true,
      status: 200,
      error: null,
      session: { user: { id: "multi-tenant-user" } },
    });
    mocks.listRegistrationsForTenant.mockResolvedValueOnce([{ id: "reg-a" }]);

    const resA = await GET(new NextRequest("http://x/api/tenants/tenant-a/registrations"), makeContext("tenant-a"));
    expect(resA.status).toBe(200);

    // -- Tenant B: membership exists, but no registrations permission yet → denied --
    mocks.requireApiTenantContextForSlug.mockResolvedValueOnce({
      ok: true,
      tenantId: TENANT_B_ID,
      tenant: { id: TENANT_B_ID, key: "tenant-b" },
    });
    mocks.requireApiAnyPermission.mockResolvedValueOnce({
      ok: false,
      status: 403,
      error: "Forbidden",
      session: null,
    });

    const resBDenied = await GET(new NextRequest("http://x/api/tenants/tenant-b/registrations"), makeContext("tenant-b"));
    expect(resBDenied.status).toBe(403);
    expect(mocks.listRegistrationsForTenant).toHaveBeenCalledTimes(1); // only for Tenant A so far

    // -- Tenant B: permission now granted → allowed --
    mocks.requireApiTenantContextForSlug.mockResolvedValueOnce({
      ok: true,
      tenantId: TENANT_B_ID,
      tenant: { id: TENANT_B_ID, key: "tenant-b" },
    });
    mocks.requireApiAnyPermission.mockResolvedValueOnce({
      ok: true,
      status: 200,
      error: null,
      session: { user: { id: "multi-tenant-user" } },
    });
    mocks.listRegistrationsForTenant.mockResolvedValueOnce([{ id: "reg-b" }]);

    const resBAllowed = await GET(new NextRequest("http://x/api/tenants/tenant-b/registrations"), makeContext("tenant-b"));
    const bodyBAllowed = await resBAllowed.json();
    expect(resBAllowed.status).toBe(200);
    expect(bodyBAllowed.registrations).toEqual([{ id: "reg-b" }]);

    // No Tenant B data was ever returned before the permission was granted.
    expect(mocks.listRegistrationsForTenant).toHaveBeenCalledTimes(2);
  });
});
