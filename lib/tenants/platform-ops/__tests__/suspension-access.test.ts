import { describe, expect, it, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  tenantMembershipFindFirst: vi.fn(),
  userFindUnique: vi.fn(),
  getEffectivePermissions: vi.fn(),
  auth: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    user: { findUnique: mocks.userFindUnique },
    tenantMembership: { findFirst: mocks.tenantMembershipFindFirst },
  },
}));
vi.mock("@/lib/permissions/services/effective-permission-resolver", () => ({
  createEffectivePermissionResolver: () => ({
    getEffectivePermissions: mocks.getEffectivePermissions,
  }),
}));

import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({
    user: {
      id: "tenant-user-1",
      effectiveUserId: "tenant-user-1",
      activeTenantId: "tenant-suspended",
    },
  });
  mocks.userFindUnique.mockResolvedValue({ isActive: true });
  mocks.getEffectivePermissions.mockResolvedValue({
    platform: [],
    tenant: [PERMISSIONS.USERS_VIEW],
  });
});

describe("suspended tenant access semantics", () => {
  it("denies ordinary tenant API access when membership tenant is not ACTIVE", async () => {
    mocks.tenantMembershipFindFirst.mockResolvedValue(null);

    const result = await requireApiPermission(PERMISSIONS.USERS_VIEW, "tenant-suspended");

    expect(result.ok).toBe(false);
    expect(result.status).toBe(403);
    expect(mocks.getEffectivePermissions).not.toHaveBeenCalled();
  });

  it("preserves permission resolution for active tenant membership", async () => {
    mocks.tenantMembershipFindFirst.mockResolvedValue({ id: "membership-1" });

    const result = await requireApiPermission(PERMISSIONS.USERS_VIEW, "tenant-active");

    expect(result.ok).toBe(true);
    expect(mocks.getEffectivePermissions).toHaveBeenCalled();
  });
});
