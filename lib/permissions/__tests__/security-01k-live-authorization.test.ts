import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  membershipFindFirst: vi.fn(),
  userRoleFindMany: vi.fn(),
  getEffectivePermissions: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    tenantMembership: { findFirst: mocks.membershipFindFirst },
    userRole: { findMany: mocks.userRoleFindMany },
  },
}));
vi.mock(
  "@/lib/permissions/services/effective-permission-resolver",
  () => ({
    createEffectivePermissionResolver: () => ({
      getEffectivePermissions: mocks.getEffectivePermissions,
    }),
  }),
);

import { requireApiTenantPermissionContext } from "@/lib/permissions/require-api-tenant-context";

describe("SECURITY-GO-LIVE-01K-A live authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({
      user: {
        id: "actor-a",
        effectiveUserId: "actor-a",
        activeTenantId: "tenant-a",
        permissionKeys: ["targets.manage"],
      },
    });
    mocks.membershipFindFirst.mockResolvedValue({ id: "membership-a" });
    mocks.userRoleFindMany.mockResolvedValue([]);
    mocks.getEffectivePermissions.mockResolvedValue({
      platform: [],
      tenant: ["targets.manage"],
    });
  });

  it("rejects a revoked permission despite a stale session claim", async () => {
    mocks.getEffectivePermissions.mockResolvedValueOnce({
      platform: [],
      tenant: [],
    });

    const result = await requireApiTenantPermissionContext(["targets.manage"]);

    expect(result).toMatchObject({ ok: false, status: 403 });
  });

  it("rejects a revoked tenant membership before permission evaluation", async () => {
    mocks.membershipFindFirst.mockResolvedValueOnce(null);

    const result = await requireApiTenantPermissionContext(["targets.manage"]);

    expect(result).toMatchObject({ ok: false, status: 403 });
    expect(mocks.getEffectivePermissions).not.toHaveBeenCalled();
  });
});
