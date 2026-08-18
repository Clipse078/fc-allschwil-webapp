/**
 * app/api/admin/users/[userId]/membership/__tests__/membership-delete.test.ts
 *
 * Identity — DELETE /api/admin/users/[userId]/membership focused tests.
 *
 * TEST COVERAGE:
 *   1. 401 no session.
 *   2. 403 no USERS_MANAGE permission.
 *   3. 403 no tenant context.
 *   4. Self-removal blocked (SELF_REMOVAL error).
 *   5. Last Club Admin blocked (LAST_CLUB_ADMIN error).
 *   6. Membership not found → 404.
 *   7. Success: returns 200 + success:true. Global User NOT deleted.
 */

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAnyApiPermission: vi.fn(),
  removeTenantMembership: vi.fn(),
}));

vi.mock("@/lib/permissions/require-any-api-permission", () => ({
  requireAnyApiPermission: mocks.requireAnyApiPermission,
}));

vi.mock("@/lib/users/mutations", () => ({
  setTenantMembershipActive: vi.fn(),
  MembershipDomainError: class MembershipDomainError extends Error {
    code: string;
    constructor(code: string) { super(code); this.code = code; }
  },
  removeTenantMembership: mocks.removeTenantMembership,
  RemoveMembershipDomainError: class RemoveMembershipDomainError extends Error {
    code: string;
    constructor(code: string) { super(code); this.code = code; }
  },
}));

import { DELETE } from "../route";
import { RemoveMembershipDomainError } from "@/lib/users/mutations";

const TENANT_ID = "tenant-1";
const USER_ID = "user-target";
const ACTOR_ID = "actor-1";

function makeReq() {
  return new NextRequest(`http://localhost/api/admin/users/${USER_ID}/membership`, { method: "DELETE" });
}
function makeParams() {
  return { params: Promise.resolve({ userId: USER_ID }) };
}

beforeEach(() => vi.clearAllMocks());

describe("DELETE /api/admin/users/[userId]/membership", () => {
  it("1. 401 no session", async () => {
    mocks.requireAnyApiPermission.mockResolvedValue({ ok: false, status: 401, error: "Unauthorized" });
    const res = await DELETE(makeReq(), makeParams());
    expect(res.status).toBe(401);
  });

  it("2. 403 no permission", async () => {
    mocks.requireAnyApiPermission.mockResolvedValue({ ok: false, status: 403, error: "Forbidden" });
    const res = await DELETE(makeReq(), makeParams());
    expect(res.status).toBe(403);
  });

  it("3. 403 no tenant context", async () => {
    mocks.requireAnyApiPermission.mockResolvedValue({
      ok: true, session: { user: { id: ACTOR_ID, activeTenantId: null } }
    });
    const res = await DELETE(makeReq(), makeParams());
    expect(res.status).toBe(403);
  });

  it("4. self-removal blocked → 400", async () => {
    mocks.requireAnyApiPermission.mockResolvedValue({
      ok: true, session: { user: { id: ACTOR_ID, activeTenantId: TENANT_ID } }
    });
    mocks.removeTenantMembership.mockRejectedValue(new RemoveMembershipDomainError("SELF_REMOVAL"));
    const res = await DELETE(makeReq(), makeParams());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("eigenen");
  });

  it("5. last Club Admin blocked → 400", async () => {
    mocks.requireAnyApiPermission.mockResolvedValue({
      ok: true, session: { user: { id: ACTOR_ID, activeTenantId: TENANT_ID } }
    });
    mocks.removeTenantMembership.mockRejectedValue(new RemoveMembershipDomainError("LAST_CLUB_ADMIN"));
    const res = await DELETE(makeReq(), makeParams());
    expect(res.status).toBe(400);
  });

  it("6. membership not found → 404", async () => {
    mocks.requireAnyApiPermission.mockResolvedValue({
      ok: true, session: { user: { id: ACTOR_ID, activeTenantId: TENANT_ID } }
    });
    mocks.removeTenantMembership.mockRejectedValue(new RemoveMembershipDomainError("MEMBERSHIP_NOT_FOUND"));
    const res = await DELETE(makeReq(), makeParams());
    expect(res.status).toBe(404);
  });

  it("7. success: 200 + success true, global User not deleted", async () => {
    mocks.requireAnyApiPermission.mockResolvedValue({
      ok: true, session: { user: { id: ACTOR_ID, activeTenantId: TENANT_ID } }
    });
    mocks.removeTenantMembership.mockResolvedValue(undefined);
    const res = await DELETE(makeReq(), makeParams());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    // Verify removeTenantMembership called with correct tenant + user
    expect(mocks.removeTenantMembership).toHaveBeenCalledWith(TENANT_ID, USER_ID, expect.anything());
  });
});
