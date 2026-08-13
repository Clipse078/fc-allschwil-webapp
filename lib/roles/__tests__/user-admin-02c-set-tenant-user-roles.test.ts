/**
 * USER-ADMIN-02C — setTenantUserRoles integration tests (lib/roles/mutations.ts)
 *
 * Requires a live PostgreSQL database (DATABASE_URL). Each test creates its
 * own randomly-suffixed fixtures and tears them down in afterAll.
 *
 * Covers:
 *   SR-01  Lists current tenant roles (read path via getTenantRolesOverview)
 *   SR-02  Assigns a tenant role to a user
 *   SR-03  Removes a tenant role from a user
 *   SR-04  Cross-tenant role ID is rejected (RoleNotFoundError)
 *   SR-05  PLATFORM-scoped role ID is rejected (RoleNotFoundError)
 *   SR-06  Cross-tenant user (no TenantMembership) is rejected (RoleUserNotFoundError)
 *   SR-07  Assignment blocked for inactive membership (InactiveMembershipError)
 *   SR-08  Last active holder of a protected (isSystem) role cannot be removed
 *          (LastRequiredAdminError)
 *   SR-09  Removing own last-admin role is blocked when no other active holder
 *   SR-10  Other tenant's TENANT roles are untouched after sync
 *   SR-11  PLATFORM UserRole records are untouched after sync
 *   SR-12  TenantMembership.isActive unchanged after role assignment/removal
 *   SR-13  Duplicate assignment (already-assigned role in roleIds) is idempotent
 *   SR-14  Removal succeeds when another active holder of a protected role exists
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { setTenantUserRoles } from "@/lib/roles/mutations";
import { getTenantRolesOverview } from "@/lib/roles/tenant-queries";
import {
  ArchivedRoleError,
  InactiveMembershipError,
  LastRequiredAdminError,
  RoleNotFoundError,
  RoleUserNotFoundError,
} from "@/lib/roles/errors";
import {
  assignUserRoleFixture,
  cleanupTestFixtures,
  createTenantRoleFixture,
  createTestMembership,
  createTestTenant,
  createTestUser,
  prisma,
} from "./test-helpers";

describe("USER-ADMIN-02C — setTenantUserRoles (live DB)", () => {
  let tenantA: { id: string; key: string };
  let tenantB: { id: string; key: string };
  let platformRole: { id: string };

  const createdTenantIds: string[] = [];
  const createdUserIds: string[] = [];

  beforeAll(async () => {
    tenantA = await createTestTenant("02c-a");
    tenantB = await createTestTenant("02c-b");
    createdTenantIds.push(tenantA.id, tenantB.id);

    platformRole = await prisma.role.create({
      data: {
        key: `platform-role-02c-${Date.now()}`,
        name: "Platform Test Role 02C",
        scope: "PLATFORM",
        isSystem: false,
        isArchived: false,
      },
    });
  });

  afterAll(async () => {
    await prisma.role.deleteMany({ where: { id: platformRole.id } });
    await cleanupTestFixtures({ tenantIds: createdTenantIds, userIds: createdUserIds });
    await prisma.$disconnect();
  });

  it("SR-01: getTenantRolesOverview returns all TENANT roles (active + archived) for this tenant only", async () => {
    const roleA = await createTenantRoleFixture({ tenantId: tenantA.id, name: "SR01 Role A" });
    const archivedA = await createTenantRoleFixture({
      tenantId: tenantA.id,
      name: "SR01 Archived",
      isArchived: true,
    });
    const roleB = await createTenantRoleFixture({ tenantId: tenantB.id, name: "SR01 Role B" });

    const overview = await getTenantRolesOverview(tenantA.id);
    const ids = overview.map((r) => r.id);

    // Includes both active and archived for this tenant
    expect(ids).toContain(roleA.id);
    expect(ids).toContain(archivedA.id);
    // Does NOT include other tenants or PLATFORM roles
    expect(ids).not.toContain(roleB.id);
    expect(ids).not.toContain(platformRole.id);
    // The caller (API route / page) filters archived; verify the flag is present
    const archivedRow = overview.find((r) => r.id === archivedA.id);
    expect(archivedRow?.isArchived).toBe(true);
  });

  it("SR-02: assigns a tenant role to a user with active membership", async () => {
    const user = await createTestUser("sr02");
    createdUserIds.push(user.id);
    await createTestMembership(tenantA.id, user.id, true);
    const role = await createTenantRoleFixture({ tenantId: tenantA.id, name: "SR02 Role" });

    const result = await setTenantUserRoles({
      tenantId: tenantA.id,
      userId: user.id,
      roleIds: [role.id],
      actorUserId: "actor-test",
    });

    expect(result.assigned).toEqual([role.name]);
    expect(result.removed).toEqual([]);

    const ur = await prisma.userRole.findUnique({
      where: { userId_roleId: { userId: user.id, roleId: role.id } },
    });
    expect(ur).not.toBeNull();
    expect(ur?.tenantId).toBe(tenantA.id);
  });

  it("SR-03: removes a tenant role from a user", async () => {
    const user = await createTestUser("sr03");
    createdUserIds.push(user.id);
    await createTestMembership(tenantA.id, user.id, true);
    const roleToKeep = await createTenantRoleFixture({ tenantId: tenantA.id, name: "SR03 Keep" });
    const roleToRemove = await createTenantRoleFixture({
      tenantId: tenantA.id,
      name: "SR03 Remove",
    });
    await assignUserRoleFixture({ userId: user.id, roleId: roleToKeep.id, tenantId: tenantA.id });
    await assignUserRoleFixture({
      userId: user.id,
      roleId: roleToRemove.id,
      tenantId: tenantA.id,
    });

    const result = await setTenantUserRoles({
      tenantId: tenantA.id,
      userId: user.id,
      roleIds: [roleToKeep.id],
      actorUserId: "actor-test",
    });

    expect(result.removed).toEqual([roleToRemove.name]);
    expect(result.assigned).toEqual([]);

    const removed = await prisma.userRole.findUnique({
      where: { userId_roleId: { userId: user.id, roleId: roleToRemove.id } },
    });
    expect(removed).toBeNull();

    const kept = await prisma.userRole.findUnique({
      where: { userId_roleId: { userId: user.id, roleId: roleToKeep.id } },
    });
    expect(kept).not.toBeNull();
  });

  it("SR-04: cross-tenant role ID is rejected with RoleNotFoundError", async () => {
    const user = await createTestUser("sr04");
    createdUserIds.push(user.id);
    await createTestMembership(tenantA.id, user.id, true);
    const roleTenantB = await createTenantRoleFixture({
      tenantId: tenantB.id,
      name: "SR04 TenantB Role",
    });

    await expect(
      setTenantUserRoles({
        tenantId: tenantA.id,
        userId: user.id,
        roleIds: [roleTenantB.id],
        actorUserId: "actor-test",
      }),
    ).rejects.toBeInstanceOf(RoleNotFoundError);
  });

  it("SR-05: PLATFORM-scoped role ID is rejected with RoleNotFoundError", async () => {
    const user = await createTestUser("sr05");
    createdUserIds.push(user.id);
    await createTestMembership(tenantA.id, user.id, true);

    await expect(
      setTenantUserRoles({
        tenantId: tenantA.id,
        userId: user.id,
        roleIds: [platformRole.id],
        actorUserId: "actor-test",
      }),
    ).rejects.toBeInstanceOf(RoleNotFoundError);
  });

  it("SR-06: user with no TenantMembership in this tenant is rejected", async () => {
    const user = await createTestUser("sr06");
    createdUserIds.push(user.id);
    // No membership in tenantA
    const role = await createTenantRoleFixture({ tenantId: tenantA.id, name: "SR06 Role" });

    await expect(
      setTenantUserRoles({
        tenantId: tenantA.id,
        userId: user.id,
        roleIds: [role.id],
        actorUserId: "actor-test",
      }),
    ).rejects.toBeInstanceOf(RoleUserNotFoundError);
  });

  it("SR-07: assigning a role to a user with inactive membership is blocked", async () => {
    const user = await createTestUser("sr07");
    createdUserIds.push(user.id);
    await createTestMembership(tenantA.id, user.id, false);
    const role = await createTenantRoleFixture({ tenantId: tenantA.id, name: "SR07 Role" });

    await expect(
      setTenantUserRoles({
        tenantId: tenantA.id,
        userId: user.id,
        roleIds: [role.id],
        actorUserId: "actor-test",
      }),
    ).rejects.toBeInstanceOf(InactiveMembershipError);
  });

  it("SR-08: removing the last active holder of a protected (isSystem) role is blocked", async () => {
    const user = await createTestUser("sr08");
    createdUserIds.push(user.id);
    await createTestMembership(tenantA.id, user.id, true);
    const systemRole = await createTenantRoleFixture({
      tenantId: tenantA.id,
      name: "SR08 System Role",
      isSystem: true,
    });
    await assignUserRoleFixture({ userId: user.id, roleId: systemRole.id, tenantId: tenantA.id });

    await expect(
      setTenantUserRoles({
        tenantId: tenantA.id,
        userId: user.id,
        roleIds: [],
        actorUserId: "actor-test",
      }),
    ).rejects.toBeInstanceOf(LastRequiredAdminError);
  });

  it("SR-09: actor removing own last protected role (no other active holder) is blocked", async () => {
    const actor = await createTestUser("sr09-actor");
    createdUserIds.push(actor.id);
    await createTestMembership(tenantA.id, actor.id, true);
    const systemRole = await createTenantRoleFixture({
      tenantId: tenantA.id,
      name: "SR09 System Role",
      isSystem: true,
    });
    await assignUserRoleFixture({ userId: actor.id, roleId: systemRole.id, tenantId: tenantA.id });

    await expect(
      setTenantUserRoles({
        tenantId: tenantA.id,
        userId: actor.id,
        roleIds: [],
        actorUserId: actor.id,
      }),
    ).rejects.toBeInstanceOf(LastRequiredAdminError);
  });

  it("SR-10: TENANT roles from another tenant are untouched after sync", async () => {
    const user = await createTestUser("sr10");
    createdUserIds.push(user.id);
    await createTestMembership(tenantA.id, user.id, true);
    await createTestMembership(tenantB.id, user.id, true);

    const roleA = await createTenantRoleFixture({ tenantId: tenantA.id, name: "SR10 TenantA" });
    const roleB = await createTenantRoleFixture({ tenantId: tenantB.id, name: "SR10 TenantB" });

    // Assign both roles
    await assignUserRoleFixture({ userId: user.id, roleId: roleA.id, tenantId: tenantA.id });
    await assignUserRoleFixture({ userId: user.id, roleId: roleB.id, tenantId: tenantB.id });

    // Sync tenantA roles to empty — should NOT touch tenantB's assignment
    await setTenantUserRoles({
      tenantId: tenantA.id,
      userId: user.id,
      roleIds: [],
      actorUserId: "actor-test",
    });

    const tenantBAssignment = await prisma.userRole.findUnique({
      where: { userId_roleId: { userId: user.id, roleId: roleB.id } },
    });
    expect(tenantBAssignment).not.toBeNull();
    expect(tenantBAssignment?.tenantId).toBe(tenantB.id);
  });

  it("SR-11: PLATFORM UserRole records are untouched after sync", async () => {
    const user = await createTestUser("sr11");
    createdUserIds.push(user.id);
    await createTestMembership(tenantA.id, user.id, true);

    // Assign platform role directly (not via setTenantUserRoles)
    const platformUserRole = await prisma.userRole.create({
      data: { userId: user.id, roleId: platformRole.id, tenantId: null },
    });

    const roleA = await createTenantRoleFixture({ tenantId: tenantA.id, name: "SR11 Role" });

    // Sync tenantA roles (not including the platform role id, which would fail validation anyway)
    await setTenantUserRoles({
      tenantId: tenantA.id,
      userId: user.id,
      roleIds: [roleA.id],
      actorUserId: "actor-test",
    });

    const platformStillAssigned = await prisma.userRole.findUnique({
      where: { id: platformUserRole.id },
    });
    expect(platformStillAssigned).not.toBeNull();

    // Cleanup platform userRole
    await prisma.userRole.delete({ where: { id: platformUserRole.id } });
  });

  it("SR-12: TenantMembership.isActive is unchanged after role assignment and removal", async () => {
    const user = await createTestUser("sr12");
    createdUserIds.push(user.id);
    await createTestMembership(tenantA.id, user.id, true);
    const role = await createTenantRoleFixture({ tenantId: tenantA.id, name: "SR12 Role" });

    await setTenantUserRoles({
      tenantId: tenantA.id,
      userId: user.id,
      roleIds: [role.id],
      actorUserId: "actor-test",
    });

    let mem = await prisma.tenantMembership.findUnique({
      where: { tenantId_userId: { tenantId: tenantA.id, userId: user.id } },
      select: { isActive: true },
    });
    expect(mem?.isActive).toBe(true);

    await setTenantUserRoles({
      tenantId: tenantA.id,
      userId: user.id,
      roleIds: [],
      actorUserId: "actor-test",
    });

    mem = await prisma.tenantMembership.findUnique({
      where: { tenantId_userId: { tenantId: tenantA.id, userId: user.id } },
      select: { isActive: true },
    });
    expect(mem?.isActive).toBe(true);
  });

  it("SR-13: duplicate role in roleIds (already assigned) is idempotent — no second UserRole row", async () => {
    const user = await createTestUser("sr13");
    createdUserIds.push(user.id);
    await createTestMembership(tenantA.id, user.id, true);
    const role = await createTenantRoleFixture({ tenantId: tenantA.id, name: "SR13 Role" });
    await assignUserRoleFixture({ userId: user.id, roleId: role.id, tenantId: tenantA.id });

    // Syncing with the already-assigned role should be a no-op
    const result = await setTenantUserRoles({
      tenantId: tenantA.id,
      userId: user.id,
      roleIds: [role.id],
      actorUserId: "actor-test",
    });

    expect(result.assigned).toEqual([]);
    expect(result.removed).toEqual([]);

    const rows = await prisma.userRole.findMany({
      where: { userId: user.id, roleId: role.id },
    });
    expect(rows).toHaveLength(1);
  });

  it("SR-14: removal succeeds when another active holder of a protected role exists", async () => {
    const userA = await createTestUser("sr14a");
    const userB = await createTestUser("sr14b");
    createdUserIds.push(userA.id, userB.id);
    await createTestMembership(tenantA.id, userA.id, true);
    await createTestMembership(tenantA.id, userB.id, true);

    const systemRole = await createTenantRoleFixture({
      tenantId: tenantA.id,
      name: "SR14 System Role",
      isSystem: true,
    });
    await assignUserRoleFixture({ userId: userA.id, roleId: systemRole.id, tenantId: tenantA.id });
    await assignUserRoleFixture({ userId: userB.id, roleId: systemRole.id, tenantId: tenantA.id });

    // userA removes the protected role — allowed because userB still holds it
    const result = await setTenantUserRoles({
      tenantId: tenantA.id,
      userId: userA.id,
      roleIds: [],
      actorUserId: "actor-test",
    });

    expect(result.removed).toEqual([systemRole.name]);

    const ur = await prisma.userRole.findUnique({
      where: { userId_roleId: { userId: userA.id, roleId: systemRole.id } },
    });
    expect(ur).toBeNull();
  });

  it("SR-15: archived role in roleIds is rejected (ArchivedRoleError)", async () => {
    const user = await createTestUser("sr15");
    createdUserIds.push(user.id);
    await createTestMembership(tenantA.id, user.id, true);
    const archivedRole = await createTenantRoleFixture({
      tenantId: tenantA.id,
      name: "SR15 Archived",
      isArchived: true,
    });

    await expect(
      setTenantUserRoles({
        tenantId: tenantA.id,
        userId: user.id,
        roleIds: [archivedRole.id],
        actorUserId: "actor-test",
      }),
    ).rejects.toBeInstanceOf(ArchivedRoleError);
  });
});
