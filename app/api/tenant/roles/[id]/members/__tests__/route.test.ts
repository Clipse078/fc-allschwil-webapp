/**
 * RPERM-05 — /api/tenant/roles/[id]/members route tests
 *
 * Verifies request/response plumbing and domain-error → HTTP mapping for
 * the tenant role assignment endpoint. Business logic itself (idempotency,
 * last-required-admin guard, membership validation) is covered by
 * lib/roles/__tests__/rperm-05-mutations.test.ts against a live database —
 * this file only asserts the route delegates correctly and maps errors.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireApiAnyPermission: vi.fn(),
  getTenantRoleDetail: vi.fn(),
  assignTenantRoleToUser: vi.fn(),
  removeTenantRoleAssignment: vi.fn(),
}));

vi.mock("@/lib/permissions/require-api-any-permission", () => ({
  requireApiAnyPermission: mocks.requireApiAnyPermission,
}));

vi.mock("@/lib/roles/tenant-queries", () => ({
  getTenantRoleDetail: mocks.getTenantRoleDetail,
}));

vi.mock("@/lib/roles/mutations", () => ({
  assignTenantRoleToUser: mocks.assignTenantRoleToUser,
  removeTenantRoleAssignment: mocks.removeTenantRoleAssignment,
}));

import { DELETE, POST } from "@/app/api/tenant/roles/[id]/members/route";
import { InactiveMembershipError, LastRequiredAdminError } from "@/lib/roles/errors";
import { NextRequest } from "next/server";

const SESSION_TENANT_ID = "tenant-session";
const ACTOR_USER_ID = "actor-1";
const ROLE_ID = "role-1";

function mockAuthorized() {
  mocks.requireApiAnyPermission.mockResolvedValue({
    ok: true,
    status: 200,
    error: null,
    session: { user: { id: ACTOR_USER_ID, activeTenantId: SESSION_TENANT_ID } },
  });
}

function ctx() {
  return { params: Promise.resolve({ id: ROLE_ID }) };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/tenant/roles/[id]/members", () => {
  it("assigns using the session-derived tenantId, never a body-supplied one", async () => {
    mockAuthorized();
    mocks.assignTenantRoleToUser.mockResolvedValue({ assigned: true });

    const req = new NextRequest("http://localhost/api/tenant/roles/role-1/members", {
      method: "POST",
      body: JSON.stringify({ userId: "user-1", tenantId: "attacker-tenant" }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req, ctx());
    const body = await res.json();

    expect(mocks.assignTenantRoleToUser).toHaveBeenCalledWith({
      tenantId: SESSION_TENANT_ID,
      roleId: ROLE_ID,
      userId: "user-1",
      actorUserId: ACTOR_USER_ID,
    });
    expect(body.assigned).toBe(true);
  });

  it("maps InactiveMembershipError to 409", async () => {
    mockAuthorized();
    mocks.assignTenantRoleToUser.mockRejectedValue(new InactiveMembershipError());

    const req = new NextRequest("http://localhost/api/tenant/roles/role-1/members", {
      method: "POST",
      body: JSON.stringify({ userId: "user-1" }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req, ctx());
    const body = await res.json();
    expect(res.status).toBe(409);
    expect(body.code).toBe("INACTIVE_MEMBERSHIP");
  });

  it("returns 400 when userId is missing", async () => {
    mockAuthorized();
    const req = new NextRequest("http://localhost/api/tenant/roles/role-1/members", {
      method: "POST",
      body: JSON.stringify({}),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req, ctx());
    expect(res.status).toBe(400);
    expect(mocks.assignTenantRoleToUser).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/tenant/roles/[id]/members", () => {
  it("maps LastRequiredAdminError to 409", async () => {
    mockAuthorized();
    mocks.removeTenantRoleAssignment.mockRejectedValue(new LastRequiredAdminError());

    const req = new NextRequest(
      "http://localhost/api/tenant/roles/role-1/members?userId=user-1",
      { method: "DELETE" },
    );
    const res = await DELETE(req, ctx());
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.code).toBe("LAST_REQUIRED_ADMIN");
  });

  it("delegates removal with the session-derived tenantId", async () => {
    mockAuthorized();
    mocks.removeTenantRoleAssignment.mockResolvedValue({ removed: true });

    const req = new NextRequest(
      "http://localhost/api/tenant/roles/role-1/members?userId=user-1",
      { method: "DELETE" },
    );
    await DELETE(req, ctx());

    expect(mocks.removeTenantRoleAssignment).toHaveBeenCalledWith({
      tenantId: SESSION_TENANT_ID,
      roleId: ROLE_ID,
      userId: "user-1",
      actorUserId: ACTOR_USER_ID,
    });
  });
});
