/**
 * lib/roles/__tests__/rperm-05c1-platform-user-roles.test.ts
 *
 * RPERM-05-C1 — Finding 3: setPlatformUserRoles() (the corrected
 * /api/users/[userId]/roles mutation), verified against a real disposable
 * local database (same convention as test-helpers.ts) — proving tenant
 * data genuinely survives untouched, not just that the mocked route
 * doesn't call certain methods.
 */

import "dotenv/config";

import { afterAll, describe, expect, it } from "vitest";
import {
  createTestMembership,
  createTestTenant,
  createTestUser,
  createTenantRoleFixture,
  ensurePermission,
  prisma,
} from "@/lib/roles/__tests__/test-helpers";
import {
  ArchivedRoleError,
  LastRequiredAdminError,
  RoleNotFoundError,
  ScopeMismatchError,
} from "@/lib/roles/errors";
import { setPlatformUserRoles } from "@/lib/roles/platform-mutations";

const tenantIds: string[] = [];
const userIds: string[] = [];
const platformRoleIds: string[] = [];

afterAll(async () => {
  const roleIds = (
    await prisma.role.findMany({ where: { tenantId: { in: tenantIds } }, select: { id: true } })
  ).map((r) => r.id);
  const allRoleIds = [...roleIds, ...platformRoleIds];
  await prisma.rolePermission.deleteMany({ where: { roleId: { in: allRoleIds } } });
  await prisma.userRole.deleteMany({ where: { OR: [{ roleId: { in: allRoleIds } }, { userId: { in: userIds } }] } });
  await prisma.role.deleteMany({ where: { id: { in: allRoleIds } } });
  await prisma.tenantMembership.deleteMany({
    where: { OR: [{ tenantId: { in: tenantIds } }, { userId: { in: userIds } }] },
  });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.tenant.deleteMany({ where: { id: { in: tenantIds } } });
});

async function createPlatformRole(key: string, isSystem = false) {
  const role = await prisma.role.create({
    data: { key, name: `RPERM-05-C1 Platform Role ${key}`, scope: "PLATFORM", isSystem },
  });
  platformRoleIds.push(role.id);
  return role;
}

describe("setPlatformUserRoles — platform assignment succeeds", () => {
  it("creates a PLATFORM UserRole with tenantId=null", async () => {
    const user = await createTestUser("c1-platform-assign");
    userIds.push(user.id);
    const role = await createPlatformRole("rperm05c1-platform-trainer");

    const result = await setPlatformUserRoles({ userId: user.id, roleIds: [role.id], actorUserId: user.id });
    expect(result.roleIds).toEqual([role.id]);

    const userRole = await prisma.userRole.findFirst({ where: { userId: user.id, roleId: role.id } });
    expect(userRole).not.toBeNull();
    expect(userRole?.tenantId).toBeNull();
  });

  it("is idempotent — resubmitting the current set performs zero writes", async () => {
    const user = await createTestUser("c1-platform-idempotent");
    userIds.push(user.id);
    const role = await createPlatformRole("rperm05c1-platform-idempotent-role");

    await setPlatformUserRoles({ userId: user.id, roleIds: [role.id], actorUserId: user.id });
    const before = await prisma.userRole.findFirst({ where: { userId: user.id, roleId: role.id } });

    const result = await setPlatformUserRoles({ userId: user.id, roleIds: [role.id], actorUserId: user.id });
    const after = await prisma.userRole.findFirst({ where: { userId: user.id, roleId: role.id } });

    expect(result.roleIds).toEqual([role.id]);
    expect(after?.id).toBe(before?.id); // same row, never recreated
    expect(after?.createdAt).toEqual(before?.createdAt);
  });
});

describe("setPlatformUserRoles — tenant role id is rejected, tenant data preserved", () => {
  it("rejects a tenant role id and leaves every tenant UserRole/TenantMembership row untouched", async () => {
    const tenant = await createTestTenant("c1-legacy-reject");
    tenantIds.push(tenant.id);
    const user = await createTestUser("c1-legacy-reject");
    userIds.push(user.id);

    await ensurePermission("roles.manage", { module: "ROLES" });
    const tenantClubAdminRole = await createTenantRoleFixture({
      tenantId: tenant.id,
      name: "Club Admin",
      isSystem: true,
      permissionKeys: ["roles.manage"],
    });

    await createTestMembership(tenant.id, user.id, true);
    await prisma.userRole.create({
      data: { userId: user.id, roleId: tenantClubAdminRole.id, tenantId: tenant.id },
    });

    const membershipBefore = await prisma.tenantMembership.findUnique({
      where: { tenantId_userId: { tenantId: tenant.id, userId: user.id } },
    });
    const tenantUserRoleBefore = await prisma.userRole.findFirst({
      where: { userId: user.id, roleId: tenantClubAdminRole.id },
    });

    await expect(
      setPlatformUserRoles({ userId: user.id, roleIds: [tenantClubAdminRole.id], actorUserId: user.id }),
    ).rejects.toBeInstanceOf(ScopeMismatchError);

    const membershipAfter = await prisma.tenantMembership.findUnique({
      where: { tenantId_userId: { tenantId: tenant.id, userId: user.id } },
    });
    const tenantUserRoleAfter = await prisma.userRole.findFirst({
      where: { userId: user.id, roleId: tenantClubAdminRole.id },
    });

    expect(membershipAfter).toEqual(membershipBefore);
    expect(tenantUserRoleAfter).toEqual(tenantUserRoleBefore);
    expect(tenantUserRoleAfter?.tenantId).toBe(tenant.id);
  });

  it("rejects an unknown role id (never silently dropped)", async () => {
    const user = await createTestUser("c1-unknown-role");
    userIds.push(user.id);

    await expect(
      setPlatformUserRoles({ userId: user.id, roleIds: ["role-id-that-does-not-exist"], actorUserId: user.id }),
    ).rejects.toBeInstanceOf(RoleNotFoundError);
  });

  it("rejects an archived platform role id", async () => {
    const user = await createTestUser("c1-archived-role");
    userIds.push(user.id);
    const role = await prisma.role.create({
      data: { key: "rperm05c1-archived-platform-role", name: "Archived", scope: "PLATFORM", isArchived: true },
    });
    platformRoleIds.push(role.id);

    await expect(
      setPlatformUserRoles({ userId: user.id, roleIds: [role.id], actorUserId: user.id }),
    ).rejects.toBeInstanceOf(ArchivedRoleError);
  });
});

describe("setPlatformUserRoles — no membership is ever created", () => {
  it("never creates a TenantMembership row as a side effect of a platform role change", async () => {
    const user = await createTestUser("c1-no-membership");
    userIds.push(user.id);
    const role = await createPlatformRole("rperm05c1-no-membership-role");

    await setPlatformUserRoles({ userId: user.id, roleIds: [role.id], actorUserId: user.id });

    const membershipCount = await prisma.tenantMembership.count({ where: { userId: user.id } });
    expect(membershipCount).toBe(0);
  });
});

describe("setPlatformUserRoles — multi-tenant assignments preserved", () => {
  it("changing platform roles never touches a multi-tenant user's tenant assignments across either tenant", async () => {
    const tenantA = await createTestTenant("c1-multi-a");
    const tenantB = await createTestTenant("c1-multi-b");
    tenantIds.push(tenantA.id, tenantB.id);
    const user = await createTestUser("c1-multi-tenant");
    userIds.push(user.id);

    const roleA = await createTenantRoleFixture({ tenantId: tenantA.id, name: "Club Admin A" });
    const roleB = await createTenantRoleFixture({ tenantId: tenantB.id, name: "Club Admin B" });
    await createTestMembership(tenantA.id, user.id, true);
    await createTestMembership(tenantB.id, user.id, true);
    await prisma.userRole.create({ data: { userId: user.id, roleId: roleA.id, tenantId: tenantA.id } });
    await prisma.userRole.create({ data: { userId: user.id, roleId: roleB.id, tenantId: tenantB.id } });

    const platformRole = await createPlatformRole("rperm05c1-multi-tenant-platform-role");
    await setPlatformUserRoles({ userId: user.id, roleIds: [platformRole.id], actorUserId: user.id });

    const tenantURoleA = await prisma.userRole.findFirst({ where: { userId: user.id, roleId: roleA.id } });
    const tenantURoleB = await prisma.userRole.findFirst({ where: { userId: user.id, roleId: roleB.id } });
    expect(tenantURoleA).not.toBeNull();
    expect(tenantURoleB).not.toBeNull();
    expect(tenantURoleA?.tenantId).toBe(tenantA.id);
    expect(tenantURoleB?.tenantId).toBe(tenantB.id);

    const membershipA = await prisma.tenantMembership.findUnique({
      where: { tenantId_userId: { tenantId: tenantA.id, userId: user.id } },
    });
    const membershipB = await prisma.tenantMembership.findUnique({
      where: { tenantId_userId: { tenantId: tenantB.id, userId: user.id } },
    });
    expect(membershipA?.isActive).toBe(true);
    expect(membershipB?.isActive).toBe(true);
  });
});

describe("setPlatformUserRoles — last platform admin safeguard", () => {
  it("blocks removing the last platform-wide holder of an isSystem PLATFORM role", async () => {
    const user = await createTestUser("c1-last-admin");
    userIds.push(user.id);
    const role = await createPlatformRole("rperm05c1-last-admin-role", true);
    await setPlatformUserRoles({ userId: user.id, roleIds: [role.id], actorUserId: user.id });

    await expect(setPlatformUserRoles({ userId: user.id, roleIds: [], actorUserId: user.id })).rejects.toBeInstanceOf(
      LastRequiredAdminError,
    );

    const stillAssigned = await prisma.userRole.findFirst({ where: { userId: user.id, roleId: role.id } });
    expect(stillAssigned).not.toBeNull();
  });

  it("allows removal when another platform-wide holder exists", async () => {
    const user1 = await createTestUser("c1-other-holder-1");
    const user2 = await createTestUser("c1-other-holder-2");
    userIds.push(user1.id, user2.id);
    const role = await createPlatformRole("rperm05c1-shared-admin-role", true);

    await setPlatformUserRoles({ userId: user1.id, roleIds: [role.id], actorUserId: user1.id });
    await setPlatformUserRoles({ userId: user2.id, roleIds: [role.id], actorUserId: user2.id });

    await expect(setPlatformUserRoles({ userId: user1.id, roleIds: [], actorUserId: user1.id })).resolves.toEqual({ roleIds: [] });

    const user1Assignment = await prisma.userRole.findFirst({ where: { userId: user1.id, roleId: role.id } });
    expect(user1Assignment).toBeNull();
  });
});
