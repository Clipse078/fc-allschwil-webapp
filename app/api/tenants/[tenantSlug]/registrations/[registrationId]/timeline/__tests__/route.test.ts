/**
 * RPERM-04-C1 — Registration Timeline Route: Tenant-Slug Isolation Tests
 *
 * Covers GET /api/tenants/[tenantSlug]/registrations/[registrationId]/timeline.
 */

import { NextRequest } from "next/server";
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  requireApiTenantContextForSlug: vi.fn(),
  requireApiAnyPermission: vi.fn(),
  getRegistrationTimeline: vi.fn(),
}));

vi.mock("@/lib/tenants/active-tenant", () => ({
  requireApiTenantContextForSlug: mocks.requireApiTenantContextForSlug,
}));
vi.mock("@/lib/permissions/require-api-any-permission", () => ({
  requireApiAnyPermission: mocks.requireApiAnyPermission,
}));
vi.mock("@/lib/registrations/timeline", () => ({
  getRegistrationTimeline: mocks.getRegistrationTimeline,
}));

import { GET } from "@/app/api/tenants/[tenantSlug]/registrations/[registrationId]/timeline/route";

const TENANT_A_ID = "tenant-a-id";
const TENANT_B_ID = "tenant-b-id";

function makeContext(tenantSlug: string, registrationId = "reg-1") {
  return { params: Promise.resolve({ tenantSlug, registrationId }) };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET .../timeline — tenant-slug isolation", () => {
  it("rejects an invalid tenant slug before fetching the timeline", async () => {
    mocks.requireApiTenantContextForSlug.mockResolvedValue({
      ok: false,
      status: 404,
      error: "Tenant nicht gefunden.",
    });

    const res = await GET(new NextRequest("http://x/timeline"), makeContext("tenant-b"));

    expect(res.status).toBe(404);
    expect(mocks.requireApiAnyPermission).not.toHaveBeenCalled();
    expect(mocks.getRegistrationTimeline).not.toHaveBeenCalled();
  });

  it("denies when the resolved tenant lacks the permission, before fetching the timeline", async () => {
    mocks.requireApiTenantContextForSlug.mockResolvedValue({
      ok: true,
      tenantId: TENANT_B_ID,
      tenant: { id: TENANT_B_ID },
    });
    mocks.requireApiAnyPermission.mockResolvedValue({ ok: false, status: 403, error: "Forbidden" });

    const res = await GET(new NextRequest("http://x/timeline"), makeContext("tenant-b"));

    expect(res.status).toBe(403);
    expect(mocks.getRegistrationTimeline).not.toHaveBeenCalled();
  });

  it("checks permission against the slug-resolved tenantId and fetches the timeline via the same slug", async () => {
    mocks.requireApiTenantContextForSlug.mockResolvedValue({
      ok: true,
      tenantId: TENANT_A_ID,
      tenant: { id: TENANT_A_ID },
    });
    mocks.requireApiAnyPermission.mockResolvedValue({ ok: true, status: 200, error: null, session: {} });
    mocks.getRegistrationTimeline.mockResolvedValue([{ id: "event-1" }]);

    const res = await GET(new NextRequest("http://x/timeline"), makeContext("tenant-a"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.timeline).toEqual([{ id: "event-1" }]);
    expect(mocks.requireApiAnyPermission).toHaveBeenCalledWith(expect.any(Array), TENANT_A_ID);
    expect(mocks.getRegistrationTimeline).toHaveBeenCalledWith("tenant-a", "reg-1");
  });
});
