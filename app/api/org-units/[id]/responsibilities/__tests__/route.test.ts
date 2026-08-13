/**
 * ORG-ACCESS-02 — /api/org-units/[id]/responsibilities route tests
 *
 * Verifies request/response plumbing and domain-error → HTTP mapping.
 * Business logic is covered by lib/roles/__tests__/org-access-02-scoped-mutations.test.ts.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireApiAnyPermission: vi.fn(),
  assignScopedRoleToUser: vi.fn(),
  getScopedAssignmentsForOrgUnit: vi.fn(),
  removeScopedRoleAssignment: vi.fn(),
}));

vi.mock("@/lib/permissions/require-api-any-permission", () => ({
  requireApiAnyPermission: mocks.requireApiAnyPermission,
}));

vi.mock("@/lib/roles/scoped-mutations", () => ({
  assignScopedRoleToUser: mocks.assignScopedRoleToUser,
  getScopedAssignmentsForOrgUnit: mocks.getScopedAssignmentsForOrgUnit,
  removeScopedRoleAssignment: mocks.removeScopedRoleAssignment,
}));

import { GET, POST } from "@/app/api/org-units/[id]/responsibilities/route";
import { DELETE } from "@/app/api/org-units/[id]/responsibilities/[userRoleId]/route";
import { RoleNotFoundError, RoleDomainError, ArchivedRoleError } from "@/lib/roles/errors";
import { NextRequest } from "next/server";

const TENANT_ID = "tenant-session";
const ACTOR_ID = "actor-1";
const ORG_UNIT_ID = "orgunit-1";

function mockAuthorized() {
  mocks.requireApiAnyPermission.mockResolvedValue({
    ok: true,
    status: 200,
    error: null,
    session: {
      user: {
        id: ACTOR_ID,
        activeTenantId: TENANT_ID,
        effectiveUserId: ACTOR_ID,
      },
    },
  });
}

function ctx(id = ORG_UNIT_ID) {
  return { params: Promise.resolve({ id }) };
}

function ctxWithUserRoleId(id = ORG_UNIT_ID, userRoleId: string) {
  return { params: Promise.resolve({ id, userRoleId }) };
}

beforeEach(() => vi.clearAllMocks());

describe("GET /api/org-units/[id]/responsibilities", () => {
  it("returns assignments for the orgUnit", async () => {
    mockAuthorized();
    mocks.getScopedAssignmentsForOrgUnit.mockResolvedValue([{ id: "ur-1", roleName: "Trainer" }]);

    const req = new NextRequest(`http://localhost/api/org-units/${ORG_UNIT_ID}/responsibilities`);
    const res = await GET(req, ctx());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(mocks.getScopedAssignmentsForOrgUnit).toHaveBeenCalledWith(TENANT_ID, ORG_UNIT_ID);
    expect(body.assignments).toHaveLength(1);
  });

  it("returns 403 when not authorized", async () => {
    mocks.requireApiAnyPermission.mockResolvedValue({ ok: false, status: 403, error: "Forbidden" });
    const req = new NextRequest(`http://localhost/api/org-units/${ORG_UNIT_ID}/responsibilities`);
    const res = await GET(req, ctx());
    expect(res.status).toBe(403);
  });
});

describe("POST /api/org-units/[id]/responsibilities", () => {
  it("assigns scoped role using session-derived tenantId", async () => {
    mockAuthorized();
    mocks.assignScopedRoleToUser.mockResolvedValue({ assigned: true, userRoleId: "ur-new" });

    const req = new NextRequest(`http://localhost/api/org-units/${ORG_UNIT_ID}/responsibilities`, {
      method: "POST",
      body: JSON.stringify({ userId: "user-1", roleId: "role-1" }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req, ctx());
    const body = await res.json();

    expect(mocks.assignScopedRoleToUser).toHaveBeenCalledWith({
      tenantId: TENANT_ID,
      userId: "user-1",
      roleId: "role-1",
      orgUnitId: ORG_UNIT_ID,
      scopeMode: "THIS_ORG_UNIT",
      actorUserId: ACTOR_ID,
    });
    expect(body.assigned).toBe(true);
  });

  it("forwards custom scopeMode to the mutation", async () => {
    mockAuthorized();
    mocks.assignScopedRoleToUser.mockResolvedValue({ assigned: true, userRoleId: "ur-new2" });

    const req = new NextRequest(`http://localhost/api/org-units/${ORG_UNIT_ID}/responsibilities`, {
      method: "POST",
      body: JSON.stringify({
        userId: "user-1",
        roleId: "role-1",
        scopeMode: "THIS_ORG_UNIT_AND_DESCENDANTS",
      }),
      headers: { "Content-Type": "application/json" },
    });

    await POST(req, ctx());

    expect(mocks.assignScopedRoleToUser).toHaveBeenCalledWith(
      expect.objectContaining({ scopeMode: "THIS_ORG_UNIT_AND_DESCENDANTS" }),
    );
  });

  it("maps RoleNotFoundError (PLATFORM role) to 404", async () => {
    mockAuthorized();
    mocks.assignScopedRoleToUser.mockRejectedValue(new RoleNotFoundError());

    const req = new NextRequest(`http://localhost/api/org-units/${ORG_UNIT_ID}/responsibilities`, {
      method: "POST",
      body: JSON.stringify({ userId: "user-1", roleId: "platform-role" }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req, ctx());
    expect(res.status).toBe(404);
  });

  it("maps RoleDomainError (Club Admin) to 409", async () => {
    mockAuthorized();
    mocks.assignScopedRoleToUser.mockRejectedValue(
      new RoleDomainError(
        "SCOPE_MISMATCH",
        "Club Admin cannot be a scoped responsibility.",
        409,
      ),
    );

    const req = new NextRequest(`http://localhost/api/org-units/${ORG_UNIT_ID}/responsibilities`, {
      method: "POST",
      body: JSON.stringify({ userId: "user-1", roleId: "club-admin-id" }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req, ctx());
    const body = await res.json();
    expect(res.status).toBe(409);
    expect(body.code).toBe("SCOPE_MISMATCH");
  });

  it("maps ArchivedRoleError to 409", async () => {
    mockAuthorized();
    mocks.assignScopedRoleToUser.mockRejectedValue(new ArchivedRoleError());

    const req = new NextRequest(`http://localhost/api/org-units/${ORG_UNIT_ID}/responsibilities`, {
      method: "POST",
      body: JSON.stringify({ userId: "user-1", roleId: "archived-role" }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req, ctx());
    expect(res.status).toBe(409);
  });

  it("returns 400 when userId is missing", async () => {
    mockAuthorized();
    const req = new NextRequest(`http://localhost/api/org-units/${ORG_UNIT_ID}/responsibilities`, {
      method: "POST",
      body: JSON.stringify({ roleId: "role-1" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req, ctx());
    expect(res.status).toBe(400);
    expect(mocks.assignScopedRoleToUser).not.toHaveBeenCalled();
  });

  it("returns 400 when roleId is missing", async () => {
    mockAuthorized();
    const req = new NextRequest(`http://localhost/api/org-units/${ORG_UNIT_ID}/responsibilities`, {
      method: "POST",
      body: JSON.stringify({ userId: "user-1" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req, ctx());
    expect(res.status).toBe(400);
    expect(mocks.assignScopedRoleToUser).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid scopeMode", async () => {
    mockAuthorized();
    const req = new NextRequest(`http://localhost/api/org-units/${ORG_UNIT_ID}/responsibilities`, {
      method: "POST",
      body: JSON.stringify({ userId: "user-1", roleId: "role-1", scopeMode: "INVALID_MODE" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req, ctx());
    expect(res.status).toBe(400);
    expect(mocks.assignScopedRoleToUser).not.toHaveBeenCalled();
  });

  it("never uses body-supplied tenantId (tenant isolation)", async () => {
    mockAuthorized();
    mocks.assignScopedRoleToUser.mockResolvedValue({ assigned: true, userRoleId: "ur-iso" });

    const req = new NextRequest(`http://localhost/api/org-units/${ORG_UNIT_ID}/responsibilities`, {
      method: "POST",
      body: JSON.stringify({ userId: "user-1", roleId: "role-1", tenantId: "attacker-tenant" }),
      headers: { "Content-Type": "application/json" },
    });
    await POST(req, ctx());

    expect(mocks.assignScopedRoleToUser).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: TENANT_ID }),
    );
    expect(mocks.assignScopedRoleToUser).not.toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: "attacker-tenant" }),
    );
  });
});

describe("DELETE /api/org-units/[id]/responsibilities/[userRoleId]", () => {
  it("removes the specified scoped role using session-derived tenantId", async () => {
    mockAuthorized();
    mocks.removeScopedRoleAssignment.mockResolvedValue({ removed: true });

    const req = new NextRequest(
      `http://localhost/api/org-units/${ORG_UNIT_ID}/responsibilities/ur-1`,
      { method: "DELETE" },
    );

    const res = await DELETE(req, ctxWithUserRoleId(ORG_UNIT_ID, "ur-1"));
    const body = await res.json();

    expect(mocks.removeScopedRoleAssignment).toHaveBeenCalledWith({
      tenantId: TENANT_ID,
      userRoleId: "ur-1",
      actorUserId: ACTOR_ID,
    });
    expect(body.removed).toBe(true);
  });

  it("returns 403 when not authorized", async () => {
    mocks.requireApiAnyPermission.mockResolvedValue({ ok: false, status: 403, error: "Forbidden" });
    const req = new NextRequest(
      `http://localhost/api/org-units/${ORG_UNIT_ID}/responsibilities/ur-1`,
      { method: "DELETE" },
    );
    const res = await DELETE(req, ctxWithUserRoleId(ORG_UNIT_ID, "ur-1"));
    expect(res.status).toBe(403);
  });
});
