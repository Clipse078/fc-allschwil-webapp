import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  requirePlatformApiPermission: vi.fn(),
  resetPlatformAccountPassword: vi.fn(),
}));

vi.mock("@/lib/permissions/require-platform-api-permission", () => ({
  requirePlatformApiPermission: mocks.requirePlatformApiPermission,
}));
vi.mock("@/lib/users/platform-account-service", () => ({
  resetPlatformAccountPassword: mocks.resetPlatformAccountPassword,
  PlatformAccountDomainError: class PlatformAccountDomainError extends Error {},
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
  mocks.requirePlatformApiPermission.mockResolvedValue({
    ok: true,
    status: 200,
    error: null,
    actorUserId: "platform-admin",
  });
  mocks.resetPlatformAccountPassword.mockResolvedValue(undefined);
});

describe("POST /api/users/[userId]/reset-password", () => {
  it("preserves the permission gate", async () => {
    mocks.requirePlatformApiPermission.mockResolvedValue({
      ok: false,
      status: 401,
      error: "Unauthorized",
    });

    const response = await POST(request("SecurePassword123!"), context);

    expect(response.status).toBe(401);
    expect(mocks.resetPlatformAccountPassword).not.toHaveBeenCalled();
  });

  it("rejects an invalid password without writing", async () => {
    const response = await POST(request("short"), context);

    expect(response.status).toBe(400);
    expect(mocks.resetPlatformAccountPassword).not.toHaveBeenCalled();
  });

  it("sets passwordChangedAt with the new hash so existing sessions revoke", async () => {
    const response = await POST(request("SecurePassword123!"), context);

    expect(response.status).toBe(200);
    expect(mocks.resetPlatformAccountPassword).toHaveBeenCalledWith({
      userId: "user-2",
      password: "SecurePassword123!",
      actorUserId: "platform-admin",
    });
  });
});
