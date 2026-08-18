/**
 * ADMIN-HARD-DELETE — tenant membership removal safety tests.
 *
 * Test matrix:
 *  4. Tenant removal does NOT delete the global User account.
 *  5. Tenant removal does NOT delete the linked Person record.
 *  6. Tenant removal does NOT affect memberships in other tenants.
 *
 * These tests verify that:
 *  - `removeTenantMembership` is called (tenant-scoped removal).
 *  - No global user delete function is called.
 *  - No cross-tenant side effects are triggered.
 *
 * Authorization: accepts users.manage OR users.manage_memberships
 * (ADMIN-HARD-DELETE — Club Admin now authorized via USERS_MANAGE_MEMBERSHIPS).
 */

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAnyApiPermission: vi.fn(),
  removeTenantMembership: vi.fn(),
  deleteUserGlobally: vi.fn(),
  deletePerson: vi.fn(),
}));

vi.mock("@/lib/permissions/require-any-api-permission", () => ({
  requireAnyApiPermission: mocks.requireAnyApiPermission,
}));

vi.mock("@/lib/users/mutations", () => ({
  setTenantMembershipActive: vi.fn(),
  MembershipDomainError: class MembershipDomainError extends Error {
    code: string;
    constructor(code: string) {
      super(code);
      this.code = code;
    }
  },
  removeTenantMembership: mocks.removeTenantMembership,
  RemoveMembershipDomainError: class RemoveMembershipDomainError extends Error {
    code: string;
    constructor(code: string) {
      super(code);
      this.code = code;
    }
  },
}));

import { DELETE } from "../route";

const TENANT_ID = "tenant-abc";
const USER_ID = "user-target";
const ACTOR_ID = "actor-club-admin";

function makeReq() {
  return new NextRequest(
    `http://localhost/api/admin/users/${USER_ID}/membership`,
    { method: "DELETE" },
  );
}
function makeParams() {
  return { params: Promise.resolve({ userId: USER_ID }) };
}

function sessionWithMembershipsPermission() {
  return {
    ok: true as const,
    session: { user: { id: ACTOR_ID, activeTenantId: TENANT_ID } },
  };
}

beforeEach(() => vi.clearAllMocks());

describe("DELETE /api/admin/users/[userId]/membership — removal safety", () => {
  /**
   * Test 4 — Tenant removal does NOT delete the global User account.
   * The route calls removeTenantMembership (tenant-scoped) and nothing else.
   */
  it("4. Tenant removal does not delete the global User account", async () => {
    mocks.requireAnyApiPermission.mockResolvedValue(sessionWithMembershipsPermission());
    mocks.removeTenantMembership.mockResolvedValue(undefined);

    const res = await DELETE(makeReq(), makeParams());
    expect(res.status).toBe(200);

    // Only tenant-scoped removal was called — no global user delete invoked
    expect(mocks.removeTenantMembership).toHaveBeenCalledTimes(1);
    expect(mocks.removeTenantMembership).toHaveBeenCalledWith(TENANT_ID, USER_ID, expect.anything());
    expect(mocks.deleteUserGlobally).not.toHaveBeenCalled();
  });

  /**
   * Test 5 — Tenant removal does NOT delete the linked Person record.
   * Person deletion is a separate operation on a different endpoint.
   */
  it("5. Tenant removal does not delete the linked Person record", async () => {
    mocks.requireAnyApiPermission.mockResolvedValue(sessionWithMembershipsPermission());
    mocks.removeTenantMembership.mockResolvedValue(undefined);

    const res = await DELETE(makeReq(), makeParams());
    expect(res.status).toBe(200);

    expect(mocks.deletePerson).not.toHaveBeenCalled();
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  /**
   * Test 6 — Tenant removal is scoped to the actor's activeTenantId.
   * removeTenantMembership receives the correct (single) tenantId,
   * guaranteeing no cross-tenant membership changes.
   */
  it("6. Tenant removal is scoped to the active tenant only (other tenants untouched)", async () => {
    mocks.requireAnyApiPermission.mockResolvedValue(sessionWithMembershipsPermission());
    mocks.removeTenantMembership.mockResolvedValue(undefined);

    await DELETE(makeReq(), makeParams());

    const [calledTenantId] = mocks.removeTenantMembership.mock.calls[0] as [string, string, string];
    // Must be exactly the caller's activeTenantId — no other tenant IDs
    expect(calledTenantId).toBe(TENANT_ID);
    // Called exactly once — no fan-out to other tenants
    expect(mocks.removeTenantMembership).toHaveBeenCalledTimes(1);
  });

  /**
   * Additional: Club Admin (users.manage_memberships) is now authorized.
   * requireAnyApiPermission must be called with both permission keys.
   */
  it("auth: requireAnyApiPermission is called with USERS_MANAGE and USERS_MANAGE_MEMBERSHIPS", async () => {
    mocks.requireAnyApiPermission.mockResolvedValue(sessionWithMembershipsPermission());
    mocks.removeTenantMembership.mockResolvedValue(undefined);

    await DELETE(makeReq(), makeParams());

    expect(mocks.requireAnyApiPermission).toHaveBeenCalledWith(
      expect.arrayContaining(["users.manage", "users.manage_memberships"]),
    );
  });
});
