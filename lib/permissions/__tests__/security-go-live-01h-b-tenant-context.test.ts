import { beforeEach, describe, expect, it, vi } from "vitest";
import { PERMISSIONS } from "@/lib/permissions/permissions";

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
vi.mock("@/lib/permissions/services/effective-permission-resolver", () => ({
  createEffectivePermissionResolver: () => ({
    getEffectivePermissions: mocks.getEffectivePermissions,
  }),
}));

import { requireApiTenantPermissionContext } from "@/lib/permissions/require-api-tenant-context";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({
    user: {
      id: "canonical-user",
      effectiveUserId: "effective-user",
      activeTenantId: "tenant-a",
    },
  });
  mocks.membershipFindFirst.mockResolvedValue({ id: "membership-a" });
  mocks.userRoleFindMany.mockResolvedValue([]);
  mocks.getEffectivePermissions.mockResolvedValue({
    platform: [],
    tenant: [PERMISSIONS.PEOPLE_VIEW],
  });
});

describe("SECURITY-GO-LIVE-01H-B tenant permission context", () => {
  it("uses the effective actor and proves live membership before permission access", async () => {
    const result = await requireApiTenantPermissionContext([PERMISSIONS.PEOPLE_VIEW]);

    expect(result).toEqual({
      ok: true,
      context: {
        tenantId: "tenant-a",
        actorUserId: "effective-user",
        permissionKeys: [PERMISSIONS.PEOPLE_VIEW],
        roleKeys: [],
      },
    });
    expect(mocks.membershipFindFirst).toHaveBeenCalledWith({
      where: {
        tenantId: "tenant-a",
        userId: "effective-user",
        isActive: true,
        tenant: { status: "ACTIVE" },
        user: { isActive: true },
      },
      select: { id: true },
    });
    expect(mocks.getEffectivePermissions).toHaveBeenCalledWith({
      userId: "effective-user",
      tenantId: "tenant-a",
    });
  });

  it("fails closed when active tenant context is missing", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "canonical-user", activeTenantId: null } });

    await expect(
      requireApiTenantPermissionContext([PERMISSIONS.PEOPLE_VIEW]),
    ).resolves.toEqual({ ok: false, status: 403, error: "Forbidden" });
    expect(mocks.membershipFindFirst).not.toHaveBeenCalled();
  });

  it("fails closed when the live membership is inactive or absent", async () => {
    mocks.membershipFindFirst.mockResolvedValue(null);

    await expect(
      requireApiTenantPermissionContext([PERMISSIONS.PEOPLE_VIEW]),
    ).resolves.toEqual({ ok: false, status: 403, error: "Forbidden" });
    expect(mocks.getEffectivePermissions).not.toHaveBeenCalled();
  });

  it("rejects insufficient permission after membership validation", async () => {
    mocks.getEffectivePermissions.mockResolvedValue({ platform: [], tenant: [] });

    await expect(
      requireApiTenantPermissionContext([PERMISSIONS.PEOPLE_VIEW]),
    ).resolves.toEqual({ ok: false, status: 403, error: "Forbidden" });
  });
});
