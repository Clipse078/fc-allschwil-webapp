import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireApiAnyPermission: vi.fn(),
  getUserEffectiveAccessView: vi.fn(),
}));

vi.mock("@/lib/permissions/require-api-any-permission", () => ({
  requireApiAnyPermission: mocks.requireApiAnyPermission,
}));

vi.mock("@/lib/roles/effective-access", () => ({
  getUserEffectiveAccessView: mocks.getUserEffectiveAccessView,
}));

import { GET } from "@/app/api/tenant/effective-access/route";

const SESSION_TENANT_ID = "tenant-session";

function mockAuthorized() {
  mocks.requireApiAnyPermission.mockResolvedValue({
    ok: true,
    status: 200,
    error: null,
    session: { user: { id: "actor-1", activeTenantId: SESSION_TENANT_ID } },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/tenant/effective-access", () => {
  it("returns 400 when userId is missing", async () => {
    mockAuthorized();
    const res = await GET(new NextRequest("http://localhost/api/tenant/effective-access"));
    expect(res.status).toBe(400);
    expect(mocks.getUserEffectiveAccessView).not.toHaveBeenCalled();
  });

  it("returns 404 when the target user has no membership in the session's tenant", async () => {
    mockAuthorized();
    mocks.getUserEffectiveAccessView.mockResolvedValue(null);

    const res = await GET(
      new NextRequest("http://localhost/api/tenant/effective-access?userId=user-in-other-tenant"),
    );
    expect(res.status).toBe(404);
    expect(mocks.getUserEffectiveAccessView).toHaveBeenCalledWith(SESSION_TENANT_ID, "user-in-other-tenant");
  });

  it("returns the view on success, scoped to the session tenant", async () => {
    mockAuthorized();
    mocks.getUserEffectiveAccessView.mockResolvedValue({ user: { id: "user-1" } });

    const res = await GET(new NextRequest("http://localhost/api/tenant/effective-access?userId=user-1"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.view.user.id).toBe("user-1");
    expect(mocks.getUserEffectiveAccessView).toHaveBeenCalledWith(SESSION_TENANT_ID, "user-1");
  });
});
