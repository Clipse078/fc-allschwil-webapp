/**
 * RPERM-04-C1 — Registration Create-Person Route: Tenant-Slug Isolation Tests
 *
 * Covers POST /api/tenants/[tenantSlug]/registrations/[registrationId]/create-person.
 */

import { NextRequest } from "next/server";
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  requireApiTenantContextForSlug: vi.fn(),
  requireApiAnyPermission: vi.fn(),
  getRegistrationForTenant: vi.fn(),
  createPersonFromRegistration: vi.fn(),
}));

vi.mock("@/lib/tenants/active-tenant", () => ({
  requireApiTenantContextForSlug: mocks.requireApiTenantContextForSlug,
}));
vi.mock("@/lib/permissions/require-api-any-permission", () => ({
  requireApiAnyPermission: mocks.requireApiAnyPermission,
}));
vi.mock("@/lib/registrations/queries", () => ({
  getRegistrationForTenant: mocks.getRegistrationForTenant,
}));
vi.mock("@/lib/registrations/person-creation", () => ({
  createPersonFromRegistration: mocks.createPersonFromRegistration,
}));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { POST } from "@/app/api/tenants/[tenantSlug]/registrations/[registrationId]/create-person/route";

const TENANT_A_ID = "tenant-a-id";
const TENANT_B_ID = "tenant-b-id";

function makeContext(tenantSlug: string, registrationId = "reg-1") {
  return { params: Promise.resolve({ tenantSlug, registrationId }) };
}

function makeRequest(body: unknown = {}) {
  return new NextRequest("http://x/create-person", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST .../create-person — tenant-slug isolation", () => {
  it("rejects an invalid tenant slug before creating any Person", async () => {
    mocks.requireApiTenantContextForSlug.mockResolvedValue({
      ok: false,
      status: 404,
      error: "Tenant nicht gefunden.",
    });

    const res = await POST(makeRequest(), makeContext("tenant-b"));

    expect(res.status).toBe(404);
    expect(mocks.requireApiAnyPermission).not.toHaveBeenCalled();
    expect(mocks.createPersonFromRegistration).not.toHaveBeenCalled();
  });

  it("denies when the resolved tenant lacks registrations.edit, before creating any Person", async () => {
    mocks.requireApiTenantContextForSlug.mockResolvedValue({
      ok: true,
      tenantId: TENANT_B_ID,
      tenant: { id: TENANT_B_ID },
    });
    mocks.requireApiAnyPermission.mockResolvedValue({ ok: false, status: 403, error: "Forbidden" });

    const res = await POST(makeRequest(), makeContext("tenant-b"));

    expect(res.status).toBe(403);
    expect(mocks.createPersonFromRegistration).not.toHaveBeenCalled();
  });

  it("checks permission against the slug-resolved tenantId and mutates via the same slug", async () => {
    mocks.requireApiTenantContextForSlug.mockResolvedValue({
      ok: true,
      tenantId: TENANT_A_ID,
      tenant: { id: TENANT_A_ID },
    });
    mocks.requireApiAnyPermission.mockResolvedValue({
      ok: true,
      status: 200,
      error: null,
      session: { user: { id: "user-1" } },
    });
    mocks.createPersonFromRegistration.mockResolvedValue({ ok: true, personId: "person-1" });
    mocks.getRegistrationForTenant.mockResolvedValue({ id: "reg-1", personId: "person-1" });

    const res = await POST(makeRequest(), makeContext("tenant-a"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.personId).toBe("person-1");
    expect(mocks.requireApiAnyPermission).toHaveBeenCalledWith(expect.any(Array), TENANT_A_ID);
    expect(mocks.createPersonFromRegistration).toHaveBeenCalledWith(
      "tenant-a",
      "reg-1",
      expect.any(Object),
      "user-1",
    );
    expect(mocks.getRegistrationForTenant).toHaveBeenCalledWith("tenant-a", "reg-1");
  });
});
