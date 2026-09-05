import { beforeEach, describe, expect, it, vi } from "vitest";
import { PERMISSIONS } from "@/lib/permissions/permissions";

const mocks = vi.hoisted(() => ({
  requireContext: vi.fn(),
  membershipFindMany: vi.fn(),
}));

vi.mock("@/lib/permissions/require-api-tenant-context", () => ({
  requireApiTenantPermissionContext: mocks.requireContext,
}));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    tenantMembership: { findMany: mocks.membershipFindMany },
  },
}));

import { GET } from "@/app/api/users/select/route";

const selectorPermissions = [
  PERMISSIONS.USERS_VIEW,
  PERMISSIONS.USERS_MANAGE,
  PERMISSIONS.ORG_MANAGE,
  PERMISSIONS.MEETINGS_MANAGE,
  PERMISSIONS.TARGETS_MANAGE,
  PERMISSIONS.INITIATIVES_MANAGE,
] as const;

type MockMembership = {
  tenantId: string;
  isActive: boolean;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    isActive: boolean;
  };
};

let heldPermissions = new Set<string>();
let memberships: MockMembership[] = [];

beforeEach(() => {
  vi.clearAllMocks();
  heldPermissions = new Set([PERMISSIONS.USERS_VIEW]);
  memberships = [];
  mocks.requireContext.mockImplementation(async (requested: readonly string[]) =>
    requested.some((permission) => heldPermissions.has(permission))
      ? {
          ok: true,
          context: { tenantId: "tenant-a", actorUserId: "actor-a" },
        }
      : { ok: false, status: 403, error: "Forbidden" },
  );
  mocks.membershipFindMany.mockImplementation(
    async (args: {
      where: {
        tenantId: string;
        isActive: boolean;
        user: { isActive: boolean };
      };
    }) =>
      memberships
        .filter(
          (membership) =>
            membership.tenantId === args.where.tenantId &&
            membership.isActive === args.where.isActive &&
            membership.user.isActive === args.where.user.isActive,
        )
        .map(({ user }) => ({ user })),
  );
});

describe("SECURITY-GO-LIVE-01H-B GET /api/users/select", () => {
  it.each(selectorPermissions)("%s is accepted", async (permission) => {
    heldPermissions = new Set([permission]);

    const response = await GET();

    expect(response.status).toBe(200);
    expect(mocks.requireContext).toHaveBeenCalledWith(selectorPermissions);
  });

  it("rejects an unrelated permission", async () => {
    heldPermissions = new Set([PERMISSIONS.TEAMS_VIEW]);

    const response = await GET();

    expect(response.status).toBe(403);
    expect(mocks.membershipFindMany).not.toHaveBeenCalled();
  });

  it("rejects an authenticated caller without a required permission", async () => {
    heldPermissions = new Set();

    const response = await GET();

    expect(response.status).toBe(403);
    expect(mocks.membershipFindMany).not.toHaveBeenCalled();
  });

  it("keeps Tenant A results tenant-scoped with the intended response fields", async () => {
    memberships = [
      {
        tenantId: "tenant-a",
        isActive: true,
        user: {
          id: "user-a",
          firstName: "Alice",
          lastName: "A",
          email: "alice@a.test",
          isActive: true,
        },
      },
      {
        tenantId: "tenant-b",
        isActive: true,
        user: {
          id: "user-b",
          firstName: "Bob",
          lastName: "B",
          email: "bob@b.test",
          isActive: true,
        },
      },
    ];

    const response = await GET();

    expect(await response.json()).toEqual([
      { id: "user-a", name: "Alice A", email: "alice@a.test" },
    ]);
    expect(mocks.membershipFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId: "tenant-a",
          isActive: true,
          user: { isActive: true },
        },
      }),
    );
  });

  it("excludes a Tenant B-only User", async () => {
    memberships = [
      {
        tenantId: "tenant-b",
        isActive: true,
        user: {
          id: "user-b",
          firstName: "Bob",
          lastName: "B",
          email: "bob@b.test",
          isActive: true,
        },
      },
    ];

    const response = await GET();

    expect(await response.json()).toEqual([]);
  });

  it("excludes inactive TenantMembership and inactive User rows", async () => {
    memberships = [
      {
        tenantId: "tenant-a",
        isActive: false,
        user: {
          id: "inactive-membership",
          firstName: "Inactive",
          lastName: "Membership",
          email: "inactive-membership@a.test",
          isActive: true,
        },
      },
      {
        tenantId: "tenant-a",
        isActive: true,
        user: {
          id: "inactive-user",
          firstName: "Inactive",
          lastName: "User",
          email: "inactive-user@a.test",
          isActive: false,
        },
      },
    ];

    const response = await GET();

    expect(await response.json()).toEqual([]);
  });
});
