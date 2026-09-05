import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  requireApiPermission: vi.fn(),
  hashPassword: vi.fn(),
  userUpdate: vi.fn(),
}));

vi.mock("@/lib/permissions/require-api-permission", () => ({
  requireApiPermission: mocks.requireApiPermission,
}));
vi.mock("@/lib/auth/password", () => ({ hashPassword: mocks.hashPassword }));
vi.mock("@/lib/db/prisma", () => ({
  prisma: { user: { update: mocks.userUpdate } },
}));

import { POST } from "../route";

function request(password: string) {
  return new NextRequest("http://localhost/api/users/user-2/reset-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
}

const context = { params: Promise.resolve({ userId: "user-2" }) };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireApiPermission.mockResolvedValue({
    ok: true,
    status: 200,
    error: null,
  });
  mocks.hashPassword.mockResolvedValue("new-password-hash");
  mocks.userUpdate.mockResolvedValue({ id: "user-2" });
});

describe("POST /api/users/[userId]/reset-password", () => {
  it("preserves the permission gate", async () => {
    mocks.requireApiPermission.mockResolvedValue({
      ok: false,
      status: 401,
      error: "Unauthorized",
    });

    const response = await POST(request("SecurePassword123!"), context);

    expect(response.status).toBe(401);
    expect(mocks.hashPassword).not.toHaveBeenCalled();
    expect(mocks.userUpdate).not.toHaveBeenCalled();
  });

  it("rejects an invalid password without writing", async () => {
    const response = await POST(request("short"), context);

    expect(response.status).toBe(400);
    expect(mocks.userUpdate).not.toHaveBeenCalled();
  });

  it("sets passwordChangedAt with the new hash so existing sessions revoke", async () => {
    const before = Date.now();

    const response = await POST(request("SecurePassword123!"), context);

    expect(response.status).toBe(200);
    expect(mocks.userUpdate).toHaveBeenCalledWith({
      where: { id: "user-2" },
      data: {
        passwordHash: "new-password-hash",
        passwordChangedAt: expect.any(Date),
      },
    });
    const changedAt = mocks.userUpdate.mock.calls[0][0].data
      .passwordChangedAt as Date;
    expect(changedAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(changedAt.getTime()).toBeLessThanOrEqual(Date.now());
  });
});
