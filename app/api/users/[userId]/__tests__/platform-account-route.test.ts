import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePlatformApiPermission: vi.fn(),
  updatePlatformAccount: vi.fn(),
  auditRejectedPrivilegedAction: vi.fn(),
}));

vi.mock("@/lib/permissions/require-platform-api-permission", () => ({
  requirePlatformApiPermission: mocks.requirePlatformApiPermission,
}));
vi.mock("@/lib/users/platform-account-service", () => {
  class PlatformAccountDomainError extends Error {
    constructor(
      public readonly code: string,
      message: string,
    ) {
      super(message);
    }
  }
  return {
    PlatformAccountDomainError,
    updatePlatformAccount: mocks.updatePlatformAccount,
  };
});
vi.mock("@/lib/db/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/audit/security-events", () => ({
  auditRejectedPrivilegedAction: mocks.auditRejectedPrivilegedAction,
}));

import { PATCH } from "@/app/api/users/[userId]/route";

const context = { params: Promise.resolve({ userId: "platform-admin" }) };
const body = {
  firstName: "Platform",
  lastName: "Admin",
  email: "platform@example.test",
  isActive: true,
};

function request(overrides: Record<string, unknown> = {}) {
  return new Request("http://localhost/api/users/platform-admin", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...body, ...overrides }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requirePlatformApiPermission.mockResolvedValue({
    ok: true,
    status: 200,
    error: null,
    actorUserId: "platform-actor",
  });
  mocks.updatePlatformAccount.mockResolvedValue({
    id: "platform-admin",
    ...body,
  });
});

describe("platform account update route", () => {
  it("rejects tenant-only or impersonated callers before an email mutation", async () => {
    mocks.requirePlatformApiPermission.mockResolvedValue({
      ok: false,
      status: 403,
      error: "Forbidden",
    });

    const response = await PATCH(request() as never, context);
    expect(response.status).toBe(403);
    expect(mocks.updatePlatformAccount).not.toHaveBeenCalled();
  });

  it("passes an authorized safe change with canonical actor identity", async () => {
    const response = await PATCH(request() as never, context);

    expect(response.status).toBe(200);
    expect(mocks.updatePlatformAccount).toHaveBeenCalledWith({
      userId: "platform-admin",
      ...body,
      actorUserId: "platform-actor",
    });
  });

  it("rejects duplicate privileged email without exposing a database error", async () => {
    const { PlatformAccountDomainError } = await import(
      "@/lib/users/platform-account-service"
    );
    mocks.updatePlatformAccount.mockRejectedValue(
      new PlatformAccountDomainError(
        "EMAIL_TAKEN",
        "Diese E-Mail ist bereits vergeben.",
      ),
    );

    const response = await PATCH(request() as never, context);
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: "EMAIL_TAKEN" });
    expect(mocks.auditRejectedPrivilegedAction).toHaveBeenCalledWith({
      actorUserId: "platform-actor",
      tenantId: null,
      action: "PLATFORM_ACCOUNT_UPDATE_REJECTED",
      entityType: "User",
      entityId: "platform-admin",
      reasonCode: "EMAIL_TAKEN",
    });
  });
});
