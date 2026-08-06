/**
 * RPERM-05-C1 (Finding 3) — /api/users/[userId]/roles is now
 * PLATFORM-scope only.
 *
 * Covers app/api/users/[userId]/roles/route.ts (GET/PUT):
 *   - GET returns only PLATFORM-scoped role ids.
 *   - PUT assigns/replaces PLATFORM role ids only.
 *   - A TENANT role id anywhere in the submitted set is rejected (400),
 *     atomically — the transaction is never even attempted.
 *   - Existing TENANT-scoped UserRole rows (tenantId IS NOT NULL) are
 *     never read, deleted, or altered by this endpoint.
 *   - No TenantMembership row is ever created, read, or altered.
 *   - The last platform-wide holder of an isSystem PLATFORM role cannot
 *     be removed through this endpoint.
 *   - Multi-tenant assignments are preserved (the endpoint never even
 *     queries tenant-scoped rows, so it cannot affect them).
 *   - Idempotent: resubmitting the current platform role set makes no
 *     writes.
 */

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireApiPermission: vi.fn(),
  userFindUnique: vi.fn(),
  roleFindMany: vi.fn(),
  userRoleFindMany: vi.fn(),
  userRoleCount: vi.fn(),
  userRoleDeleteMany: vi.fn(),
  userRoleCreate: vi.fn(),
  transaction: vi.fn(),
  auditLogCreate: vi.fn(),
}));

vi.mock("@/lib/permissions/require-api-permission", () => ({
  requireApiPermission: mocks.requireApiPermission,
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    user: { findUnique: mocks.userFindUnique },
    role: { findMany: mocks.roleFindMany },
    userRole: {
      findMany: mocks.userRoleFindMany,
      count: mocks.userRoleCount,
      deleteMany: mocks.userRoleDeleteMany,
      create: mocks.userRoleCreate,
    },
    auditLog: { create: mocks.auditLogCreate },
    $transaction: mocks.transaction,
  },
}));

import { GET, PUT } from "../route";

function makePutRequest(userId: string, roleIds: string[]): {
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

function makeGetContext(userId: string) {
  return { params: Promise.resolve({ userId }) };
}

function platformRole(overrides: Partial<{ id: string; key: string; isSystem: boolean }> = {}) {
  return {
    id: overrides.id ?? "role-platform-1",
    key: overrides.key ?? "trainer",
    name: "Trainer",
    scope: "PLATFORM" as const,
    isSystem: overrides.isSystem ?? false,
    isArchived: false,
    isTemplate: false,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireApiPermission.mockResolvedValue({
    ok: true,
    status: 200,
    error: null,
    session: { user: { id: "admin-1", activeTenantId: null } },
  });
  mocks.userFindUnique.mockResolvedValue({ id: "user-1" });
  mocks.userRoleFindMany.mockResolvedValue([]);
  mocks.userRoleCount.mockResolvedValue(1);
  mocks.transaction.mockImplementation(async (callback: (tx: unknown) => unknown) =>
    callback({
      userRole: {
        deleteMany: mocks.userRoleDeleteMany,
        create: mocks.userRoleCreate,
      },
    }),
  );
});

describe("GET /api/users/[userId]/roles — PLATFORM-scope only", () => {
  it("returns only PLATFORM-scoped role ids", async () => {
    mocks.userFindUnique.mockResolvedValue({
      id: "user-1",
      userRoles: [{ roleId: "role-platform-1" }],
    });

    const res = await GET(new NextRequest("http://localhost/api/users/user-1/roles"), makeGetContext("user-1"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.roleIds).toEqual(["role-platform-1"]);
    expect(mocks.userFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          userRoles: expect.objectContaining({
            where: { role: { scope: "PLATFORM" } },
          }),
        }),
      }),
    );
  });

  it("404s when the user does not exist", async () => {
    mocks.userFindUnique.mockResolvedValue(null);
    const res = await GET(new NextRequest("http://localhost/api/users/missing/roles"), makeGetContext("missing"));
    expect(res.status).toBe(404);
  });
});

describe("PUT /api/users/[userId]/roles — platform assignment succeeds", () => {
  it("assigns a PLATFORM role: creates a UserRole with tenantId=null, via a transaction", async () => {
    mocks.roleFindMany.mockResolvedValue([platformRole({ id: "role-trainer" })]);

    const { request, context } = makePutRequest("user-1", ["role-trainer"]);
    const response = await PUT(request, context);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.roleIds).toEqual(["role-trainer"]);
    expect(mocks.transaction).toHaveBeenCalledTimes(1);
    expect(mocks.userRoleCreate).toHaveBeenCalledWith({
      data: { userId: "user-1", roleId: "role-trainer", tenantId: null },
    });
  });

  it("is idempotent: resubmitting the current platform role set makes zero writes", async () => {
    mocks.userRoleFindMany.mockResolvedValue([
      { id: "ur-1", roleId: "role-trainer", role: { key: "trainer", isSystem: false } },
    ]);
    mocks.roleFindMany.mockResolvedValue([platformRole({ id: "role-trainer" })]);

    const { request, context } = makePutRequest("user-1", ["role-trainer"]);
    const response = await PUT(request, context);

    expect(response.status).toBe(200);
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.userRoleCreate).not.toHaveBeenCalled();
    expect(mocks.userRoleDeleteMany).not.toHaveBeenCalled();
  });
});

describe("PUT /api/users/[userId]/roles — tenant role id is rejected", () => {
  // Note: RoleDomainError subclasses each carry their own HTTP status
  // (see lib/roles/errors.ts) — SCOPE_MISMATCH → 409, VALIDATION_ERROR →
  // 400. Every case below is still a hard, atomic rejection (never a
  // silent filter, never a partial persist).
  it("rejects a submitted tenant role id — atomic, no transaction attempted", async () => {
    mocks.roleFindMany.mockResolvedValue([
      { id: "role-tenant-1", key: "club_admin__fc-allschwil", name: "Club Admin", scope: "TENANT", isSystem: true, isArchived: false, isTemplate: false },
    ]);

    const { request, context } = makePutRequest("user-1", ["role-tenant-1"]);
    const response = await PUT(request, context);

    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.code).toBe("SCOPE_MISMATCH");
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.userRoleCreate).not.toHaveBeenCalled();
    expect(mocks.userRoleDeleteMany).not.toHaveBeenCalled();
  });

  it("rejects an unknown role id (does not silently drop it)", async () => {
    mocks.roleFindMany.mockResolvedValue([]);

    const { request, context } = makePutRequest("user-1", ["role-does-not-exist"]);
    const response = await PUT(request, context);

    expect(response.status).toBe(404);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("rejects an archived or template role id", async () => {
    mocks.roleFindMany.mockResolvedValue([
      { id: "role-archived", key: "old_role", name: "Old", scope: "PLATFORM", isSystem: false, isArchived: true, isTemplate: false },
    ]);

    const { request, context } = makePutRequest("user-1", ["role-archived"]);
    const response = await PUT(request, context);

    expect(response.status).toBe(409);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});

describe("PUT /api/users/[userId]/roles — tenant data is never touched", () => {
  it("never reads or deletes tenant-scoped UserRole rows", async () => {
    mocks.roleFindMany.mockResolvedValue([platformRole({ id: "role-trainer" })]);

    const { request, context } = makePutRequest("user-1", ["role-trainer"]);
    await PUT(request, context);

    // The only UserRole query issued is scoped to PLATFORM roles.
    expect(mocks.userRoleFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "user-1", role: { scope: "PLATFORM" } } }),
    );
  });

  it("never creates or reads a TenantMembership row (no tenantMembership mock exists on the client at all)", async () => {
    mocks.roleFindMany.mockResolvedValue([platformRole({ id: "role-trainer" })]);

    const { request, context } = makePutRequest("user-1", ["role-trainer"]);
    const response = await PUT(request, context);

    expect(response.status).toBe(200);
    // If the route ever touched prisma.tenantMembership, this test's mocked
    // prisma client (which has no `tenantMembership` key) would throw.
  });

  it("preserves a multi-tenant user's tenant assignments — only removes the requested platform role", async () => {
    mocks.userRoleFindMany.mockResolvedValue([
      { id: "ur-old-platform", roleId: "role-old-platform", role: { key: "viewer", isSystem: false } },
    ]);
    mocks.roleFindMany.mockResolvedValue([platformRole({ id: "role-trainer" })]);

    const { request, context } = makePutRequest("user-1", ["role-trainer"]);
    const response = await PUT(request, context);

    expect(response.status).toBe(200);
    expect(mocks.userRoleDeleteMany).toHaveBeenCalledWith({ where: { id: { in: ["ur-old-platform"] } } });
    expect(mocks.userRoleCreate).toHaveBeenCalledWith({
      data: { userId: "user-1", roleId: "role-trainer", tenantId: null },
    });
    // No tenant-scoped query ever appears in this flow — the PLATFORM-only
    // filter above (role: { scope: "PLATFORM" }) guarantees any UserRole
    // row with tenantId IS NOT NULL is excluded from every read/write this
    // endpoint performs.
  });
});

describe("PUT /api/users/[userId]/roles — last platform admin safeguard", () => {
  it("blocks removing the last platform-wide holder of an isSystem PLATFORM role", async () => {
    mocks.userRoleFindMany.mockResolvedValue([
      { id: "ur-super-admin", roleId: "role-super-admin", role: { key: "super_admin", isSystem: true } },
    ]);
    mocks.userRoleCount.mockResolvedValue(0); // no other holder
    mocks.roleFindMany.mockResolvedValue([]); // removing everything

    const { request, context } = makePutRequest("user-1", []);
    const response = await PUT(request, context);

    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.code).toBe("LAST_REQUIRED_ADMIN");
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("allows removal when another holder of the isSystem role exists", async () => {
    mocks.userRoleFindMany.mockResolvedValue([
      { id: "ur-super-admin", roleId: "role-super-admin", role: { key: "super_admin", isSystem: true } },
    ]);
    mocks.userRoleCount.mockResolvedValue(1); // another holder exists
    mocks.roleFindMany.mockResolvedValue([]);

    const { request, context } = makePutRequest("user-1", []);
    const response = await PUT(request, context);

    expect(response.status).toBe(200);
    expect(mocks.transaction).toHaveBeenCalledTimes(1);
  });
});

describe("PUT /api/users/[userId]/roles — 404 for missing user", () => {
  it("returns 404 when the target user does not exist", async () => {
    mocks.userFindUnique.mockResolvedValue(null);

    const { request, context } = makePutRequest("missing-user", []);
    const response = await PUT(request, context);

    expect(response.status).toBe(404);
    expect(mocks.userRoleCreate).not.toHaveBeenCalled();
  });
});
