/**
 * RPERM-04-C1 — Registration Detail Route: Tenant-Slug Isolation Tests
 *
 * Covers GET + PATCH /api/tenants/[tenantSlug]/registrations/[registrationId].
 *
 * Finding 2 fix under test: registration reads/writes must authorize
 * against the tenant resolved from the URL's tenantSlug — never
 * session.user.activeTenantId — and must reject before any registration
 * data is fetched or mutated.
 *
 * Test groups:
 *   D-01  GET: tenant-slug rejection → error returned, no registration fetched
 *   D-02  GET: permission denial for the resolved tenant → 403, no fetch
 *   D-03  GET: success — permission checked against the slug-resolved
 *         tenantId; registration fetched via the same tenantSlug
 *   D-04  PATCH: tenant-slug rejection → error returned, no mutation
 *   D-05  PATCH: permission denial → 403, no mutation
 *   D-06  PATCH: success — permission checked against the slug-resolved
 *         tenantId before any write occurs
 */

import { NextRequest } from "next/server";
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  requireApiTenantContextForSlug: vi.fn(),
  requireApiAnyPermission: vi.fn(),
  getRegistrationForTenant: vi.fn(),
  updateRegistrationStatusForTenant: vi.fn(),
  logAction: vi.fn(),
}));

vi.mock("@/lib/tenants/active-tenant", () => ({
  requireApiTenantContextForSlug: mocks.requireApiTenantContextForSlug,
}));
vi.mock("@/lib/permissions/require-api-any-permission", () => ({
  requireApiAnyPermission: mocks.requireApiAnyPermission,
}));
vi.mock("@/lib/registrations/queries", () => ({
  getRegistrationForTenant: mocks.getRegistrationForTenant,
  updateRegistrationStatusForTenant: mocks.updateRegistrationStatusForTenant,
}));
vi.mock("@/lib/audit/log-action", () => ({
  logAction: mocks.logAction,
}));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { GET, PATCH } from "@/app/api/tenants/[tenantSlug]/registrations/[registrationId]/route";

function makeContext(tenantSlug: string, registrationId = "reg-1") {
  return { params: Promise.resolve({ tenantSlug, registrationId }) };
}

const TENANT_A_ID = "tenant-a-id";
const TENANT_B_ID = "tenant-b-id";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/tenants/[tenantSlug]/registrations/[registrationId] — tenant-slug isolation", () => {
  it("D-01: unknown/archived tenant slug or no membership → error returned, registration never fetched", async () => {
    mocks.requireApiTenantContextForSlug.mockResolvedValue({
      ok: false,
      status: 404,
      error: "Tenant nicht gefunden.",
    });

    const res = await GET(
      new NextRequest("http://x/api/tenants/tenant-b/registrations/reg-1"),
      makeContext("tenant-b"),
    );
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe("Tenant nicht gefunden.");
    expect(mocks.requireApiAnyPermission).not.toHaveBeenCalled();
    expect(mocks.getRegistrationForTenant).not.toHaveBeenCalled();
  });

  it("D-02: permission denial for the resolved tenant → 403, registration never fetched", async () => {
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

    const res = await GET(
      new NextRequest("http://x/api/tenants/tenant-b/registrations/reg-1"),
      makeContext("tenant-b"),
    );

    expect(res.status).toBe(403);
    expect(mocks.getRegistrationForTenant).not.toHaveBeenCalled();
  });

  it("D-03: success — permission is checked against the slug-resolved tenantId, and data is read via the same slug", async () => {
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
    mocks.getRegistrationForTenant.mockResolvedValue({ id: "reg-1", firstName: "A" });

    const res = await GET(
      new NextRequest("http://x/api/tenants/tenant-a/registrations/reg-1"),
      makeContext("tenant-a"),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.registration).toEqual({ id: "reg-1", firstName: "A" });
    expect(mocks.requireApiAnyPermission).toHaveBeenCalledWith(expect.any(Array), TENANT_A_ID);
    expect(mocks.getRegistrationForTenant).toHaveBeenCalledWith("tenant-a", "reg-1");
  });
});

describe("PATCH /api/tenants/[tenantSlug]/registrations/[registrationId] — tenant-slug isolation", () => {
  it("D-04: unknown/archived tenant slug or no membership → error returned, no mutation attempted", async () => {
    mocks.requireApiTenantContextForSlug.mockResolvedValue({
      ok: false,
      status: 404,
      error: "Tenant nicht gefunden.",
    });

    const req = new NextRequest("http://x/api/tenants/tenant-b/registrations/reg-1", {
      method: "PATCH",
      body: JSON.stringify({ status: "CONTACTED" }),
    });
    const res = await PATCH(req, makeContext("tenant-b"));

    expect(res.status).toBe(404);
    expect(mocks.requireApiAnyPermission).not.toHaveBeenCalled();
    expect(mocks.updateRegistrationStatusForTenant).not.toHaveBeenCalled();
  });

  it("D-05: permission denial for the resolved tenant → 403, no mutation attempted", async () => {
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

    const req = new NextRequest("http://x/api/tenants/tenant-b/registrations/reg-1", {
      method: "PATCH",
      body: JSON.stringify({ status: "CONTACTED" }),
    });
    const res = await PATCH(req, makeContext("tenant-b"));

    expect(res.status).toBe(403);
    expect(mocks.updateRegistrationStatusForTenant).not.toHaveBeenCalled();
  });

  it("D-06: success — permission is checked against the slug-resolved tenantId before the mutation runs", async () => {
    mocks.requireApiTenantContextForSlug.mockResolvedValue({
      ok: true,
      tenantId: TENANT_A_ID,
      tenant: { id: TENANT_A_ID, key: "tenant-a" },
    });
    mocks.requireApiAnyPermission.mockResolvedValue({
      ok: true,
      status: 200,
      error: null,
      session: { user: { id: "user-1", effectiveUserId: "user-1" } },
    });
    mocks.updateRegistrationStatusForTenant.mockResolvedValue({
      before: { status: "NEW", assignedToUserId: null, targetGroupId: null, personId: null, duplicateIgnoredAt: null },
      registration: { id: "reg-1", status: "CONTACTED", assignedToUserId: null, targetGroupId: null, personId: null, duplicateIgnoredAt: null },
    });

    const req = new NextRequest("http://x/api/tenants/tenant-a/registrations/reg-1", {
      method: "PATCH",
      body: JSON.stringify({ status: "CONTACTED" }),
    });
    const res = await PATCH(req, makeContext("tenant-a"));

    expect(res.status).toBe(200);
    expect(mocks.requireApiAnyPermission).toHaveBeenCalledWith(expect.any(Array), TENANT_A_ID);
    expect(mocks.updateRegistrationStatusForTenant).toHaveBeenCalledWith(
      "tenant-a",
      "reg-1",
      expect.objectContaining({ status: "CONTACTED" }),
      "user-1",
    );
  });
});
