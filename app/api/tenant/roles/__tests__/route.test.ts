/**
 * RPERM-05 — /api/tenant/roles route tests
 *
 * Mocks the canonical live permission gate (requireApiAnyPermission) and
 * the query/mutation layer, following the existing repository pattern
 * (see app/api/workspace/folders/__tests__/route.test.ts). Verifies:
 *   - 403 when the live permission check fails
 *   - 403 when the session has no activeTenantId (never falls back to a
 *     client-submitted tenant id — there is none to fall back to)
 *   - GET/POST delegate to the tenant-scoped query/mutation layer with the
 *     session-derived tenantId, never a request-body value
 *   - domain errors map to their declared HTTP status + code
 */

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireApiAnyPermission: vi.fn(),
  getTenantRolesOverview: vi.fn(),
  createTenantRole: vi.fn(),
}));

vi.mock("@/lib/permissions/require-api-any-permission", () => ({
  requireApiAnyPermission: mocks.requireApiAnyPermission,
}));

vi.mock("@/lib/roles/tenant-queries", () => ({
  getTenantRolesOverview: mocks.getTenantRolesOverview,
}));

vi.mock("@/lib/roles/mutations", () => ({
  createTenantRole: mocks.createTenantRole,
}));

import { GET, POST } from "@/app/api/tenant/roles/route";
import { DuplicateRoleNameError, InvalidPermissionScopeError } from "@/lib/roles/errors";

const SESSION_TENANT_ID = "tenant-session";
const ACTOR_USER_ID = "user-1";

function mockAuthorized(overrides: { tenantId?: string | null; userId?: string | null } = {}) {
  mocks.requireApiAnyPermission.mockResolvedValue({
    ok: true,
    status: 200,
    error: null,
    session: {
      user: {
        id: overrides.userId === undefined ? ACTOR_USER_ID : overrides.userId,
        activeTenantId: overrides.tenantId === undefined ? SESSION_TENANT_ID : overrides.tenantId,
      },
    },
  });
}

function mockDenied(status = 403, error = "Forbidden") {
  mocks.requireApiAnyPermission.mockResolvedValue({ ok: false, status, error, session: null });
}

function makePostRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/tenant/roles", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/tenant/roles", () => {
  it("returns 403 when the live permission check fails", async () => {
    mockDenied();
    const res = await GET();
    expect(res.status).toBe(403);
    expect(mocks.getTenantRolesOverview).not.toHaveBeenCalled();
  });

  it("returns 403 when the session has no activeTenantId", async () => {
    mockAuthorized({ tenantId: null });
    const res = await GET();
    expect(res.status).toBe(403);
    expect(mocks.getTenantRolesOverview).not.toHaveBeenCalled();
  });

  it("delegates to getTenantRolesOverview with the session-derived tenantId", async () => {
    mockAuthorized();
    mocks.getTenantRolesOverview.mockResolvedValue([{ id: "role-1" }]);

    const res = await GET();
    const body = await res.json();

    expect(mocks.getTenantRolesOverview).toHaveBeenCalledWith(SESSION_TENANT_ID);
    expect(body.roles).toEqual([{ id: "role-1" }]);
  });
});

describe("POST /api/tenant/roles", () => {
  it("returns 403 when the live permission check fails", async () => {
    mockDenied();
    const res = await POST(makePostRequest({ name: "X" }));
    expect(res.status).toBe(403);
    expect(mocks.createTenantRole).not.toHaveBeenCalled();
  });

  it("forces tenantId/actorUserId from the session, ignoring any request-body override attempt", async () => {
    mockAuthorized();
    mocks.createTenantRole.mockResolvedValue({ id: "role-1", permissionKeys: [] });

    await POST(
      makePostRequest({
        name: "Custom Role",
        tenantId: "attacker-supplied-tenant",
        scope: "PLATFORM",
        isSystem: true,
        permissionKeys: ["teams.view"],
      }),
    );

    expect(mocks.createTenantRole).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: SESSION_TENANT_ID,
        actorUserId: ACTOR_USER_ID,
        permissionKeys: ["teams.view"],
      }),
    );
    // The mutation call never receives scope/isSystem from the request body —
    // createTenantRole's own signature has no such fields to pass through.
    const callArgs = mocks.createTenantRole.mock.calls[0][0];
    expect(callArgs.scope).toBeUndefined();
    expect(callArgs.isSystem).toBeUndefined();
  });

  it("maps DuplicateRoleNameError to 409 with a stable error code", async () => {
    mockAuthorized();
    mocks.createTenantRole.mockRejectedValue(new DuplicateRoleNameError("Trainer"));

    const res = await POST(makePostRequest({ name: "Trainer", permissionKeys: [] }));
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.code).toBe("DUPLICATE_ROLE_NAME");
  });

  it("maps InvalidPermissionScopeError to 400", async () => {
    mockAuthorized();
    mocks.createTenantRole.mockRejectedValue(new InvalidPermissionScopeError());

    const res = await POST(makePostRequest({ name: "X", permissionKeys: ["users.manage"] }));
    expect(res.status).toBe(400);
  });
});
