import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { DelegationForbiddenError } from "@/lib/roles/errors";

const mocks = vi.hoisted(() => ({
  effectiveTenantPermissions: [] as string[],
  permissionFindMany: vi.fn(),
  roleFindMany: vi.fn(),
  getEffectivePermissions: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({ prisma: {} }));
vi.mock(
  "@/lib/permissions/services/effective-permission-resolver",
  () => ({
    createEffectivePermissionResolver: () => ({
      getEffectivePermissions: mocks.getEffectivePermissions,
    }),
  }),
);

import {
  assertTenantDelegationAllowed,
  findMissingDelegatedPermissions,
} from "@/lib/roles/delegation";

const db = {
  permission: { findMany: mocks.permissionFindMany },
  role: { findMany: mocks.roleFindMany },
} as unknown as PrismaClient;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.effectiveTenantPermissions = ["roles.manage", "teams.view"];
  mocks.getEffectivePermissions.mockImplementation(async () => ({
    platform: ["tenants.manage"],
    tenant: mocks.effectiveTenantPermissions,
  }));
  mocks.permissionFindMany.mockImplementation(
    async ({ where }: { where: { key: { in: string[] } } }) =>
      where.key.in
        .filter((key) => !key.startsWith("platform."))
        .map((key) => ({ key })),
  );
  mocks.roleFindMany.mockResolvedValue([]);
});

describe("SECURITY-GO-LIVE-01K-A delegation boundary", () => {
  it("allows only a permission subset the actor currently holds", async () => {
    await expect(
      assertTenantDelegationAllowed(
        {
          tenantId: "tenant-a",
          actorUserId: "actor-a",
          permissionKeys: ["teams.view"],
        },
        db,
      ),
    ).resolves.toBeUndefined();
  });

  it("rejects a permission the actor lacks, including self-escalation", async () => {
    await expect(
      assertTenantDelegationAllowed(
        {
          tenantId: "tenant-a",
          actorUserId: "actor-a",
          permissionKeys: ["users.invite"],
        },
        db,
      ),
    ).rejects.toBeInstanceOf(DelegationForbiddenError);
  });

  it("rejects platform or otherwise non-grantable permissions", async () => {
    mocks.permissionFindMany.mockResolvedValueOnce([]);
    await expect(
      assertTenantDelegationAllowed(
        {
          tenantId: "tenant-a",
          actorUserId: "actor-a",
          permissionKeys: ["platform.superadmin"],
        },
        db,
      ),
    ).rejects.toBeInstanceOf(DelegationForbiddenError);
  });

  it("rejects cross-tenant or nonexistent role ids without existence leakage", async () => {
    mocks.roleFindMany.mockResolvedValueOnce([]);
    await expect(
      assertTenantDelegationAllowed(
        {
          tenantId: "tenant-a",
          actorUserId: "actor-a",
          roleIds: ["tenant-b-role"],
        },
        db,
      ),
    ).rejects.toBeInstanceOf(DelegationForbiddenError);
  });

  it("rejects a stronger role and any role containing platform authority", async () => {
    mocks.roleFindMany.mockResolvedValueOnce([
      {
        id: "strong-role",
        rolePermissions: [
          {
            permission: {
              key: "users.invite",
              scope: "TENANT",
              grantableByAdmin: true,
            },
          },
        ],
      },
    ]);
    await expect(
      assertTenantDelegationAllowed(
        {
          tenantId: "tenant-a",
          actorUserId: "actor-a",
          roleIds: ["strong-role"],
        },
        db,
      ),
    ).rejects.toBeInstanceOf(DelegationForbiddenError);

    mocks.roleFindMany.mockResolvedValueOnce([
      {
        id: "platform-role",
        rolePermissions: [
          {
            permission: {
              key: "tenants.manage",
              scope: "PLATFORM",
              grantableByAdmin: false,
            },
          },
        ],
      },
    ]);
    await expect(
      assertTenantDelegationAllowed(
        {
          tenantId: "tenant-a",
          actorUserId: "actor-a",
          roleIds: ["platform-role"],
        },
        db,
      ),
    ).rejects.toBeInstanceOf(DelegationForbiddenError);
  });

  it("computes missing delegated permissions deterministically", () => {
    expect(
      findMissingDelegatedPermissions(
        ["roles.manage", "teams.view"],
        ["teams.view", "users.invite", "users.invite"],
      ),
    ).toEqual(["users.invite"]);
  });
});
