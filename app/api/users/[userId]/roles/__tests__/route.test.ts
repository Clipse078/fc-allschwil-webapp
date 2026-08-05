/**
 * RPERM-04 — Role Assignment Provisioning Tests
 *
 * Covers app/api/users/[userId]/roles/route.ts (PUT):
 *   - Assigning a TENANT-scoped role creates a tenant-scoped UserRole
 *     (UserRole.tenantId = role.tenantId) AND ensures an active
 *     TenantMembership row for that tenant.
 *   - Assigning a PLATFORM-scoped role creates a UserRole with
 *     tenantId = null and does NOT touch TenantMembership.
 *   - Archived and template roles are never assignable.
 *   - Existing membership rows are reactivated (isActive: true), not
 *     duplicated.
 */

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireApiPermission: vi.fn(),
  userFindUnique: vi.fn(),
  roleFindMany: vi.fn(),
  userRoleDeleteMany: vi.fn(),
  userRoleCreate: vi.fn(),
  tenantMembershipUpsert: vi.fn(),
}));

vi.mock("@/lib/permissions/require-api-permission", () => ({
  requireApiPermission: mocks.requireApiPermission,
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    user: { findUnique: mocks.userFindUnique },
    role: { findMany: mocks.roleFindMany },
    $transaction: vi.fn(async (callback: (tx: unknown) => unknown) =>
      callback({
        userRole: {
          deleteMany: mocks.userRoleDeleteMany,
          create: mocks.userRoleCreate,
        },
        tenantMembership: { upsert: mocks.tenantMembershipUpsert },
      }),
    ),
  },
}));

import { PUT } from "../route";

function makeRequest(userId: string, roleIds: string[]): {
  request: NextRequest;
  context: { params: Promise<{ userId: string }> };
} {
  return {
    request: new NextRequest(`http://localhost/api/users/${userId}/roles`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ roleIds }),
    }),
    context: { params: Promise.resolve({ userId }) },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireApiPermission.mockResolvedValue({
    ok: true,
    status: 200,
    error: null,
    session: { user: { id: "admin-1", activeTenantId: "tenant-1" } },
  });
  mocks.userFindUnique.mockResolvedValue({ id: "user-1" });
});

describe("PUT /api/users/[userId]/roles", () => {
  it("creates a tenant-scoped UserRole and an active TenantMembership for a TENANT-scoped role", async () => {
    mocks.roleFindMany.mockResolvedValue([
      { id: "role-club-admin", scope: "TENANT", tenantId: "tenant-1" },
    ]);

    const { request, context } = makeRequest("user-1", ["role-club-admin"]);
    const response = await PUT(request, context);

    expect(response.status).toBe(200);
    expect(mocks.userRoleCreate).toHaveBeenCalledWith({
      data: { userId: "user-1", roleId: "role-club-admin", tenantId: "tenant-1" },
    });
    expect(mocks.tenantMembershipUpsert).toHaveBeenCalledWith({
      where: { tenantId_userId: { tenantId: "tenant-1", userId: "user-1" } },
      update: { isActive: true },
      create: { tenantId: "tenant-1", userId: "user-1", isActive: true },
    });
  });

  it("creates a platform UserRole (tenantId: null) and never touches TenantMembership for a PLATFORM-scoped role", async () => {
    mocks.roleFindMany.mockResolvedValue([
      { id: "role-super-admin", scope: "PLATFORM", tenantId: null },
    ]);

    const { request, context } = makeRequest("user-1", ["role-super-admin"]);
    const response = await PUT(request, context);

    expect(response.status).toBe(200);
    expect(mocks.userRoleCreate).toHaveBeenCalledWith({
      data: { userId: "user-1", roleId: "role-super-admin", tenantId: null },
    });
    expect(mocks.tenantMembershipUpsert).not.toHaveBeenCalled();
  });

  it("only ensures one TenantMembership row even when multiple roles share the same tenant", async () => {
    mocks.roleFindMany.mockResolvedValue([
      { id: "role-a", scope: "TENANT", tenantId: "tenant-1" },
      { id: "role-b", scope: "TENANT", tenantId: "tenant-1" },
    ]);

    const { request, context } = makeRequest("user-1", ["role-a", "role-b"]);
    await PUT(request, context);

    expect(mocks.tenantMembershipUpsert).toHaveBeenCalledTimes(1);
  });

  it("excludes archived and template roles from the query (never assignable)", async () => {
    mocks.roleFindMany.mockResolvedValue([]);

    const { request, context } = makeRequest("user-1", ["role-archived", "role-template"]);
    await PUT(request, context);

    expect(mocks.roleFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isArchived: false,
          isTemplate: false,
        }),
      }),
    );
  });

  it("returns 404 when the target user does not exist", async () => {
    mocks.userFindUnique.mockResolvedValue(null);

    const { request, context } = makeRequest("missing-user", []);
    const response = await PUT(request, context);

    expect(response.status).toBe(404);
    expect(mocks.userRoleCreate).not.toHaveBeenCalled();
  });
});
