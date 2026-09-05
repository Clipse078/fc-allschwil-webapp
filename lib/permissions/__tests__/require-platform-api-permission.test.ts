import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  userFindUnique: vi.fn(),
  hasPermission: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/db/prisma", () => ({
  prisma: { user: { findUnique: mocks.userFindUnique } },
}));
vi.mock("@/lib/permissions/services/effective-permission-resolver", () => ({
  createEffectivePermissionResolver: () => ({
    hasPermission: mocks.hasPermission,
  }),
}));

import { requirePlatformApiPermission } from "@/lib/permissions/require-platform-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({
    user: {
      id: "platform-actor",
      actorUserId: "platform-actor",
      effectiveUserId: "platform-actor",
      isImpersonating: false,
    },
  });
  mocks.userFindUnique.mockResolvedValue({ isActive: true });
  mocks.hasPermission.mockResolvedValue(true);
});

describe("requirePlatformApiPermission", () => {
  it("authorizes the current active actor through live platform authority", async () => {
    const result = await requirePlatformApiPermission(PERMISSIONS.USERS_MANAGE);

    expect(result).toMatchObject({
      ok: true,
      actorUserId: "platform-actor",
    });
    expect(mocks.hasPermission).toHaveBeenCalledWith({
      userId: "platform-actor",
      permission: PERMISSIONS.USERS_MANAGE,
    });
  });

  it("rejects an impersonated tenant identity before any permission lookup", async () => {
    mocks.auth.mockResolvedValue({
      user: {
        id: "tenant-admin",
        actorUserId: "platform-actor",
        effectiveUserId: "tenant-admin",
        isImpersonating: true,
      },
    });

    const result = await requirePlatformApiPermission(PERMISSIONS.USERS_MANAGE);

    expect(result).toMatchObject({ ok: false, status: 403 });
    expect(mocks.userFindUnique).not.toHaveBeenCalled();
    expect(mocks.hasPermission).not.toHaveBeenCalled();
  });

  it("rejects a stale identity mismatch even without the impersonation flag", async () => {
    mocks.auth.mockResolvedValue({
      user: {
        id: "tenant-admin",
        actorUserId: "platform-actor",
        effectiveUserId: "tenant-admin",
        isImpersonating: false,
      },
    });

    const result = await requirePlatformApiPermission(PERMISSIONS.USERS_MANAGE);
    expect(result).toMatchObject({ ok: false, status: 403 });
    expect(mocks.hasPermission).not.toHaveBeenCalled();
  });

  it("rejects inactive actors and missing live platform permission", async () => {
    mocks.userFindUnique.mockResolvedValueOnce({ isActive: false });
    await expect(
      requirePlatformApiPermission(PERMISSIONS.USERS_MANAGE),
    ).resolves.toMatchObject({ ok: false, status: 403 });

    mocks.userFindUnique.mockResolvedValueOnce({ isActive: true });
    mocks.hasPermission.mockResolvedValueOnce(false);
    await expect(
      requirePlatformApiPermission(PERMISSIONS.USERS_MANAGE),
    ).resolves.toMatchObject({ ok: false, status: 403 });
  });
});
