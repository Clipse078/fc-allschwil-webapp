/**
 * USER-ADMIN-02C — /api/admin/users/[userId]/roles route unit tests
 *
 * Verifies request/response plumbing and permission gates for the tenant
 * role management endpoint on the admin user detail page. Business logic
 * (last-admin guard, membership check, cross-tenant isolation) is covered
 * by the service-layer integration tests in
 * lib/roles/__tests__/user-admin-02c-set-tenant-user-roles.test.ts.
 *
 * Covers:
 *   RT-01  GET: requires users.view OR users.manage; returns roles + assignedRoleIds
 *   RT-02  GET: 403 when unauthenticated
 *   RT-03  GET: 404 when user is not a member of the active tenant
 *   RT-04  PUT: requires users.manage; 403 for users.view-only caller
 *   RT-05  PUT: delegates to setTenantUserRoles with session-derived tenantId
 *   RT-06  PUT: tenantId in body is ignored; only session tenantId is used
 *   RT-07  PUT: maps LastRequiredAdminError → 409 LAST_REQUIRED_ADMIN
 *   RT-08  PUT: maps RoleNotFoundError → 404 ROLE_NOT_FOUND (cross-tenant/platform)
 *   RT-09  PUT: 400 when roleIds is not an array
 *   RT-10  PUT: 401 for unauthenticated request
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireApiAnyPermission: vi.fn(),
  requireApiPermission: vi.fn(),
  getTenantRolesOverview: vi.fn(),
  setTenantUserRoles: vi.fn(),
  findUnique: vi.fn(),
  findMany: vi.fn(),
}));

vi.mock("@/lib/permissions/require-api-any-permission", () => ({
  requireApiAnyPermission: mocks.requireApiAnyPermission,
}));

vi.mock("@/lib/permissions/require-api-permission", () => ({
  requireApiPermission: mocks.requireApiPermission,
}));

vi.mock("@/lib/roles/tenant-queries", () => ({
  getTenantRolesOverview: mocks.getTenantRolesOverview,
}));

vi.mock("@/lib/roles/mutations", () => ({
  setTenantUserRoles: mocks.setTenantUserRoles,
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    tenantMembership: { findUnique: mocks.findUnique },
    userRole: { findMany: mocks.findMany },
  },
}));

import { GET, PUT } from "@/app/api/admin/users/[userId]/roles/route";
import { LastRequiredAdminError, RoleNotFoundError } from "@/lib/roles/errors";
import { NextRequest } from "next/server";

const SESSION_TENANT_ID = "tenant-session";
const ACTOR_USER_ID = "actor-1";
const TARGET_USER_ID = "user-42";

function ctx() {
  return { params: Promise.resolve({ userId: TARGET_USER_ID }) };
}

function makeSession(overrides: Record<string, unknown> = {}) {
  return {
    user: {
      id: ACTOR_USER_ID,
      activeTenantId: SESSION_TENANT_ID,
      ...overrides,
    },
  };
}

function mockViewAccess() {
  mocks.requireApiAnyPermission.mockResolvedValue({
    ok: true,
    status: 200,
    error: null,
    session: makeSession(),
  });
}

function mockManageAccess() {
  mocks.requireApiPermission.mockResolvedValue({
    ok: true,
    status: 200,
    error: null,
    session: makeSession(),
  });
}

function mockMembershipFound(isActive = true) {
  mocks.findUnique.mockResolvedValue({ isActive });
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// GET
// ---------------------------------------------------------------------------

describe("GET /api/admin/users/[userId]/roles", () => {
  it("RT-01: returns roles and assignedRoleIds for authorized caller", async () => {
    mockViewAccess();
    mockMembershipFound();
    mocks.getTenantRolesOverview.mockResolvedValue([
      { id: "role-1", name: "Admin", isSystem: true, isArchived: false },
      { id: "role-2", name: "Trainer", isSystem: false, isArchived: false },
      { id: "role-3", name: "Old Archived", isSystem: false, isArchived: true },
    ]);
    mocks.findMany.mockResolvedValue([{ roleId: "role-1" }]);

    const req = new NextRequest(
      `http://localhost/api/admin/users/${TARGET_USER_ID}/roles`,
    );
    const res = await GET(req, ctx());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.roles).toHaveLength(2); // archived filtered out
    expect(body.roles.map((r: { id: string }) => r.id)).not.toContain("role-3");
    expect(body.assignedRoleIds).toEqual(["role-1"]);
  });

  it("RT-02: 403 when not authenticated", async () => {
    mocks.requireApiAnyPermission.mockResolvedValue({
      ok: false,
      status: 403,
      error: "Forbidden",
      session: null,
    });

    const req = new NextRequest(
      `http://localhost/api/admin/users/${TARGET_USER_ID}/roles`,
    );
    const res = await GET(req, ctx());
    expect(res.status).toBe(403);
  });

  it("RT-03: 404 when user is not a member of the active tenant", async () => {
    mockViewAccess();
    mocks.findUnique.mockResolvedValue(null); // No membership

    const req = new NextRequest(
      `http://localhost/api/admin/users/${TARGET_USER_ID}/roles`,
    );
    const res = await GET(req, ctx());
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// PUT
// ---------------------------------------------------------------------------

describe("PUT /api/admin/users/[userId]/roles", () => {
  it("RT-04: 403 for a caller without users.manage", async () => {
    mocks.requireApiPermission.mockResolvedValue({
      ok: false,
      status: 403,
      error: "Forbidden",
      session: null,
    });

    const req = new NextRequest(
      `http://localhost/api/admin/users/${TARGET_USER_ID}/roles`,
      {
        method: "PUT",
        body: JSON.stringify({ roleIds: [] }),
        headers: { "Content-Type": "application/json" },
      },
    );
    const res = await PUT(req, ctx());
    expect(res.status).toBe(403);
    expect(mocks.setTenantUserRoles).not.toHaveBeenCalled();
  });

  it("RT-05: delegates to setTenantUserRoles with session-derived tenantId", async () => {
    mockManageAccess();
    mocks.setTenantUserRoles.mockResolvedValue({ assigned: [], removed: [] });

    const req = new NextRequest(
      `http://localhost/api/admin/users/${TARGET_USER_ID}/roles`,
      {
        method: "PUT",
        body: JSON.stringify({ roleIds: ["role-1", "role-2"] }),
        headers: { "Content-Type": "application/json" },
      },
    );
    await PUT(req, ctx());

    expect(mocks.setTenantUserRoles).toHaveBeenCalledWith({
      tenantId: SESSION_TENANT_ID,
      userId: TARGET_USER_ID,
      roleIds: ["role-1", "role-2"],
      actorUserId: ACTOR_USER_ID,
    });
  });

  it("RT-06: body-supplied tenantId is ignored; only session tenantId is used", async () => {
    mockManageAccess();
    mocks.setTenantUserRoles.mockResolvedValue({ assigned: [], removed: [] });

    const req = new NextRequest(
      `http://localhost/api/admin/users/${TARGET_USER_ID}/roles`,
      {
        method: "PUT",
        body: JSON.stringify({
          roleIds: ["role-1"],
          tenantId: "attacker-tenant",
        }),
        headers: { "Content-Type": "application/json" },
      },
    );
    await PUT(req, ctx());

    expect(mocks.setTenantUserRoles).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: SESSION_TENANT_ID }),
    );
  });

  it("RT-07: maps LastRequiredAdminError to 409 with LAST_REQUIRED_ADMIN code", async () => {
    mockManageAccess();
    mocks.setTenantUserRoles.mockRejectedValue(new LastRequiredAdminError());

    const req = new NextRequest(
      `http://localhost/api/admin/users/${TARGET_USER_ID}/roles`,
      {
        method: "PUT",
        body: JSON.stringify({ roleIds: [] }),
        headers: { "Content-Type": "application/json" },
      },
    );
    const res = await PUT(req, ctx());
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.code).toBe("LAST_REQUIRED_ADMIN");
  });

  it("RT-08: maps RoleNotFoundError to 404 with ROLE_NOT_FOUND code", async () => {
    mockManageAccess();
    mocks.setTenantUserRoles.mockRejectedValue(new RoleNotFoundError());

    const req = new NextRequest(
      `http://localhost/api/admin/users/${TARGET_USER_ID}/roles`,
      {
        method: "PUT",
        body: JSON.stringify({ roleIds: ["foreign-role-id"] }),
        headers: { "Content-Type": "application/json" },
      },
    );
    const res = await PUT(req, ctx());
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.code).toBe("ROLE_NOT_FOUND");
  });

  it("RT-09: 400 when roleIds is missing or not an array", async () => {
    mockManageAccess();

    const req = new NextRequest(
      `http://localhost/api/admin/users/${TARGET_USER_ID}/roles`,
      {
        method: "PUT",
        body: JSON.stringify({ roleIds: "not-an-array" }),
        headers: { "Content-Type": "application/json" },
      },
    );
    const res = await PUT(req, ctx());
    expect(res.status).toBe(400);
    expect(mocks.setTenantUserRoles).not.toHaveBeenCalled();
  });

  it("RT-10: 401 for unauthenticated request", async () => {
    mocks.requireApiPermission.mockResolvedValue({
      ok: false,
      status: 401,
      error: "Unauthorized",
      session: null,
    });

    const req = new NextRequest(
      `http://localhost/api/admin/users/${TARGET_USER_ID}/roles`,
      {
        method: "PUT",
        body: JSON.stringify({ roleIds: [] }),
        headers: { "Content-Type": "application/json" },
      },
    );
    const res = await PUT(req, ctx());
    expect(res.status).toBe(401);
  });
});
