/**
 * RPERM-04 — TargetGroup roleKeys Clause Tenant Isolation Tests
 *
 * Before RPERM-04, the `roleKeys` clause filtered candidates by the legacy
 * `User.tenantId` column, which is no longer populated for new users
 * provisioned via TenantMembership. This left the roleKeys clause silently
 * broken for any user without a legacy tenantId.
 *
 * Covers lib/org/target-group-resolver.ts `roleKeys` clause resolution via
 * the public resolveTargetGroup() entrypoint:
 *   - A user with an active TenantMembership for the requested tenant IS
 *     included, even when User.tenantId is null.
 *   - A user without a TenantMembership for the requested tenant is
 *     excluded, even if they hold the matching role.
 *   - Inactive users are always excluded.
 *   - Without a tenantId context, all users holding the role are included
 *     (no membership filter applied).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  targetGroupFindUnique: vi.fn(),
  roleFindMany: vi.fn(),
  userRoleFindMany: vi.fn(),
  tenantMembershipFindMany: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    targetGroup: { findUnique: mocks.targetGroupFindUnique },
    role: { findMany: mocks.roleFindMany },
    userRole: { findMany: mocks.userRoleFindMany },
    tenantMembership: { findMany: mocks.tenantMembershipFindMany },
  },
}));

import { resolveTargetGroup } from "../target-group-resolver";

function makeGroup(tenantId: string | null) {
  return {
    id: "tg-1",
    tenantId,
    status: "ACTIVE",
    ruleJson: { type: "roleKeys", value: ["match_coordinator"] },
  };
}

function makeUser(id: string, isActive = true) {
  return {
    id,
    firstName: "First",
    lastName: `User-${id}`,
    email: `${id}@example.com`,
    isActive,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.roleFindMany.mockResolvedValue([{ id: "role-1", key: "match_coordinator" }]);
});

describe("resolveTargetGroup — roleKeys clause tenant isolation (RPERM-04)", () => {
  it("includes a user with an active TenantMembership for the tenant, even when User.tenantId would have been null", async () => {
    mocks.targetGroupFindUnique.mockResolvedValue(makeGroup("tenant-1"));
    mocks.userRoleFindMany.mockResolvedValue([
      { roleId: "role-1", user: makeUser("user-member") },
    ]);
    mocks.tenantMembershipFindMany.mockResolvedValue([{ userId: "user-member" }]);

    const result = await resolveTargetGroup("tg-1", "tenant-1");

    expect(result?.userIds).toEqual(["user-member"]);
    expect(mocks.tenantMembershipFindMany).toHaveBeenCalledWith({
      where: { tenantId: "tenant-1", userId: { in: ["user-member"] }, isActive: true },
      select: { userId: true },
    });
  });

  it("excludes a user who holds the role but has no active TenantMembership for the tenant", async () => {
    mocks.targetGroupFindUnique.mockResolvedValue(makeGroup("tenant-1"));
    mocks.userRoleFindMany.mockResolvedValue([
      { roleId: "role-1", user: makeUser("user-other-tenant") },
    ]);
    // No membership rows returned — user does not belong to tenant-1.
    mocks.tenantMembershipFindMany.mockResolvedValue([]);

    const result = await resolveTargetGroup("tg-1", "tenant-1");

    expect(result?.userIds).toEqual([]);
  });

  it("excludes inactive users regardless of membership", async () => {
    mocks.targetGroupFindUnique.mockResolvedValue(makeGroup("tenant-1"));
    mocks.userRoleFindMany.mockResolvedValue([
      { roleId: "role-1", user: makeUser("user-inactive", false) },
    ]);
    mocks.tenantMembershipFindMany.mockResolvedValue([{ userId: "user-inactive" }]);

    const result = await resolveTargetGroup("tg-1", "tenant-1");

    expect(result?.userIds).toEqual([]);
  });

  it("includes all active role holders when no tenant context is provided", async () => {
    mocks.targetGroupFindUnique.mockResolvedValue(makeGroup(null));
    mocks.userRoleFindMany.mockResolvedValue([
      { roleId: "role-1", user: makeUser("user-a") },
      { roleId: "role-1", user: makeUser("user-b") },
    ]);

    const result = await resolveTargetGroup("tg-1");

    expect(result?.userIds?.sort()).toEqual(["user-a", "user-b"]);
    expect(mocks.tenantMembershipFindMany).not.toHaveBeenCalled();
  });
});
