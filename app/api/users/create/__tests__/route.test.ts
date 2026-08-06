/**
 * RPERM-04 — Create User Provisioning Tests
 *
 * Covers app/api/users/create/route.ts:
 *   - A new user is always provisioned with a TenantMembership for the
 *     creating admin's active tenant (never via the legacy User.tenantId
 *     column, which this route no longer writes).
 *   - No TenantMembership is created when the creating admin has no active
 *     tenant (pure platform administrator) — fails safe, no orphaned rows.
 *   - Existing validation/conflict/error behavior is preserved.
 */

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireApiPermission: vi.fn(),
  hashPassword: vi.fn(),
  userFindUnique: vi.fn(),
  userCreate: vi.fn(),
  tenantMembershipCreate: vi.fn(),
}));

vi.mock("@/lib/permissions/require-api-permission", () => ({
  requireApiPermission: mocks.requireApiPermission,
}));

vi.mock("@/lib/auth/password", () => ({
  hashPassword: mocks.hashPassword,
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    user: {
      findUnique: mocks.userFindUnique,
      create: mocks.userCreate,
    },
    tenantMembership: {
      create: mocks.tenantMembershipCreate,
    },
    $transaction: vi.fn(async (callback: (tx: unknown) => unknown) =>
      callback({
        user: { create: mocks.userCreate },
        tenantMembership: { create: mocks.tenantMembershipCreate },
      }),
    ),
  },
}));

import { POST } from "../route";

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/users/create", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function accessOk(activeTenantId: string | null) {
  return {
    ok: true as const,
    status: 200,
    error: null,
    session: { user: { id: "admin-1", activeTenantId } },
  };
}

const VALID_BODY = {
  firstName: "Jane",
  lastName: "Doe",
  email: "jane.doe@example.com",
  password: "supersecret",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireApiPermission.mockResolvedValue(accessOk("tenant-1"));
  mocks.hashPassword.mockResolvedValue("hashed-password");
  mocks.userFindUnique.mockResolvedValue(null);
  mocks.userCreate.mockResolvedValue({ id: "user-new-1" });
  mocks.tenantMembershipCreate.mockResolvedValue({ id: "membership-new-1" });
});

describe("POST /api/users/create", () => {
  it("returns 403 (via requireApiPermission) when unauthorized", async () => {
    mocks.requireApiPermission.mockResolvedValue({
      ok: false,
      status: 403,
      error: "Forbidden",
      session: null,
    });

    const response = await POST(makeRequest(VALID_BODY));

    expect(response.status).toBe(403);
    expect(mocks.userCreate).not.toHaveBeenCalled();
  });

  it("creates a TenantMembership for the creating admin's active tenant", async () => {
    const response = await POST(makeRequest(VALID_BODY));

    expect(response.status).toBe(201);
    expect(mocks.userCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          firstName: "Jane",
          lastName: "Doe",
          email: "jane.doe@example.com",
        }),
      }),
    );
    // No legacy tenantId written on the User row.
    const userCreateArgs = mocks.userCreate.mock.calls[0][0];
    expect(userCreateArgs.data).not.toHaveProperty("tenantId");

    expect(mocks.tenantMembershipCreate).toHaveBeenCalledWith({
      data: {
        tenantId: "tenant-1",
        userId: "user-new-1",
        isActive: true,
      },
    });
  });

  it("does not create a TenantMembership when the creating admin has no active tenant", async () => {
    mocks.requireApiPermission.mockResolvedValue(accessOk(null));

    const response = await POST(makeRequest(VALID_BODY));

    expect(response.status).toBe(201);
    expect(mocks.userCreate).toHaveBeenCalled();
    expect(mocks.tenantMembershipCreate).not.toHaveBeenCalled();
  });

  it("returns 409 when a user with the email already exists", async () => {
    mocks.userFindUnique.mockResolvedValue({ id: "existing-user" });

    const response = await POST(makeRequest(VALID_BODY));

    expect(response.status).toBe(409);
    expect(mocks.userCreate).not.toHaveBeenCalled();
    expect(mocks.tenantMembershipCreate).not.toHaveBeenCalled();
  });

  it("returns 400 when required fields are missing", async () => {
    const response = await POST(makeRequest({ firstName: "Jane" }));

    expect(response.status).toBe(400);
    expect(mocks.userCreate).not.toHaveBeenCalled();
  });
});
