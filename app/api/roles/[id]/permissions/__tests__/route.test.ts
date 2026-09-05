/**
 * RPERM-05-C1 — Finding 2: /api/roles/[id]/permissions PUT scope validation.
 *
 * The route now delegates to setPlatformRolePermissions(), which
 * re-validates every key server-side. This test locks in the HTTP-level
 * contract with a fully mocked Prisma client (fast, no DB needed):
 *   - a pure PLATFORM key list persists (200, $transaction called);
 *   - a mixed PLATFORM+TENANT key list is rejected (never silently
 *     filtered) and the transaction is never even attempted (atomic).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePlatformApiPermission: vi.fn(),
  role: { findFirst: vi.fn() },
  rolePermission: {
    findMany: vi.fn(),
    deleteMany: vi.fn(),
    createMany: vi.fn(),
  },
  permission: { findMany: vi.fn() },
  auditLogCreate: vi.fn(),
  auditRejectedPrivilegedAction: vi.fn(),
  transaction: vi.fn(),
  queryRaw: vi.fn(),
}));

vi.mock("@/lib/permissions/require-platform-api-permission", () => ({
  requirePlatformApiPermission: mocks.requirePlatformApiPermission,
}));
vi.mock("@/lib/audit/security-events", () => ({
  auditRejectedPrivilegedAction: mocks.auditRejectedPrivilegedAction,
}));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    role: mocks.role,
    rolePermission: mocks.rolePermission,
    permission: mocks.permission,
    auditLog: { create: mocks.auditLogCreate },
    $transaction: mocks.transaction,
  },
}));

import { PUT } from "@/app/api/roles/[id]/permissions/route";

function mockAuthorized() {
  mocks.requirePlatformApiPermission.mockResolvedValue({
    ok: true,
    status: 200,
    error: null,
    actorUserId: "platform-admin",
    session: { user: { id: "platform-admin", activeTenantId: null } },
  });
}

function makeRequest(permissionKeys: unknown) {
  return new Request("http://localhost/api/roles/role-1/permissions", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ permissionKeys }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAuthorized();
  mocks.role.findFirst.mockResolvedValue({ id: "role-1", key: "match_coordinator" });
  mocks.rolePermission.findMany.mockResolvedValue([]);
  mocks.transaction.mockImplementation(
    async (callback: (tx: unknown) => unknown) =>
      callback({
        $queryRawUnsafe: mocks.queryRaw,
        rolePermission: mocks.rolePermission,
        auditLog: { create: mocks.auditLogCreate },
      }),
  );
});

describe("PUT /api/roles/[id]/permissions — RPERM-05-C1 scope validation", () => {
  it("PLATFORM + PLATFORM → allowed, persists via a transaction", async () => {
    mocks.permission.findMany.mockResolvedValue([
      { id: "perm-1", key: "users.view", scope: "PLATFORM" },
    ]);

    const res = await PUT(makeRequest(["users.view"]) as never, {
      params: Promise.resolve({ id: "role-1" }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.permissionKeys).toEqual(["users.view"]);
    expect(mocks.transaction).toHaveBeenCalledTimes(1);
    expect(mocks.auditLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorUserId: "platform-admin",
        tenantId: null,
        entityId: "role-1",
        action: "PLATFORM_PERMISSIONS_CHANGE",
      }),
    });
  });

  it("PLATFORM + TENANT → denied atomically; transaction is never attempted", async () => {
    mocks.permission.findMany.mockResolvedValue([
      { id: "perm-1", key: "users.view", scope: "PLATFORM" },
      { id: "perm-2", key: "workspace.manage", scope: "TENANT" },
    ]);

    const res = await PUT(makeRequest(["users.view", "workspace.manage"]) as never, {
      params: Promise.resolve({ id: "role-1" }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("INVALID_PERMISSION_SCOPE");
    expect(body.error).toContain("workspace.manage");
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.auditRejectedPrivilegedAction).toHaveBeenCalledWith({
      actorUserId: "platform-admin",
      tenantId: null,
      action: "PLATFORM_PERMISSION_CHANGE_REJECTED",
      entityType: "Role",
      entityId: "role-1",
      reasonCode: "INVALID_PERMISSION_SCOPE",
    });
  });

  it("a submitted tenant-only mixed-scope list rejects the entire request, not just the invalid key", async () => {
    mocks.permission.findMany.mockResolvedValue([
      { id: "perm-1", key: "roles.view", scope: "TENANT" },
      { id: "perm-2", key: "roles.manage", scope: "TENANT" },
    ]);

    const res = await PUT(makeRequest(["roles.view", "roles.manage"]) as never, {
      params: Promise.resolve({ id: "role-1" }),
    });

    expect(res.status).toBe(400);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("404s when the role id does not resolve to a PLATFORM role", async () => {
    mocks.role.findFirst.mockResolvedValue(null);

    const res = await PUT(makeRequest([]) as never, {
      params: Promise.resolve({ id: "tenant-role-1" }),
    });

    expect(res.status).toBe(404);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("cannot remove existing authority from the canonical super_admin role", async () => {
    mocks.role.findFirst.mockResolvedValue({
      id: "role-super",
      key: "super_admin",
    });
    mocks.rolePermission.findMany.mockResolvedValue([
      { permission: { key: "users.manage" } },
      { permission: { key: "users.delete" } },
    ]);
    mocks.permission.findMany.mockResolvedValue([
      { id: "perm-manage", key: "users.manage", scope: "PLATFORM" },
    ]);

    const res = await PUT(makeRequest(["users.manage"]) as never, {
      params: Promise.resolve({ id: "role-super" }),
    });

    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("PROTECTED_ROLE");
    expect(mocks.rolePermission.deleteMany).not.toHaveBeenCalled();
  });
});
