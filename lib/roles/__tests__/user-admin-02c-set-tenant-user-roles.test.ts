/**
 * USER-ADMIN-02C — setTenantUserRoles integration tests (lib/roles/mutations.ts)
 *
 * Requires a live PostgreSQL database (DATABASE_URL). Each test creates its
 * own randomly-suffixed fixtures and tears them down in afterAll.
 *
 * Covers:
 *   SR-01  getTenantRolesOverview scope: active + archived for this tenant only
 *   SR-02  Assigns a tenant role to a user with active membership
 *   SR-03  Removes a tenant role from a user
 *   SR-04  Cross-tenant role ID is rejected (RoleNotFoundError)
 *   SR-05  PLATFORM-scoped role ID is rejected (RoleNotFoundError)
 *   SR-06  Cross-tenant user (no TenantMembership) is rejected (RoleUserNotFoundError)
 *   SR-07  Role can be ASSIGNED to inactive membership (no InactiveMembershipError)
 *   SR-08  Role can be REMOVED from inactive membership
 *   SR-09  Inactive membership remains inactive after role assignment
 *   SR-10  Inactive membership remains inactive after role removal
 *   SR-11  Last canonical Club Admin cannot be removed (LastRequiredAdminError)
 *   SR-12  Club Admin can be removed when another active Club Admin exists
 *   SR-13  Last holder of a non-Club-Admin isSystem role CAN be removed
 *   SR-14  Self removing own last Club Admin role is blocked (no other active CA)
 *   SR-15  Other tenant's TENANT roles are untouched after sync
 *   SR-16  PLATFORM UserRole records are untouched after sync
 *   SR-17  TenantMembership.isActive unchanged after role assignment/removal
 *          with active membership
 *   SR-18  Duplicate role in roleIds is idempotent
 *   SR-19  Archived role in roleIds is rejected (ArchivedRoleError)
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { setTenantUserRoles } from "@/lib/roles/mutations";
import { getTenantRolesOverview } from "@/lib/roles/tenant-queries";
import { getTenantClubAdminRoleKey } from "@/lib/roles/tenant-role-keys";
import {
  ArchivedRoleError,
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

/** Creates the canonical Club Admin role for a tenant (matching getTenantClubAdminRoleKey). */
async function createClubAdminRole(tenantId: string, tenantKey: string) {
  return prisma.role.upsert({
    where: { key: getTenantClubAdminRoleKey(tenantKey) },
    create: {
      key: getTenantClubAdminRoleKey(tenantKey),
      name: "Club Admin",
      scope: "TENANT",
      tenantId,
      isSystem: true,
      isArchived: false,
    },
    update: {},
  });
}

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

    expect(ids).toContain(roleA.id);
    expect(ids).toContain(archivedA.id);
    expect(ids).not.toContain(roleB.id);
    expect(ids).not.toContain(platformRole.id);
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
    const roleToRemove = await createTenantRoleFixture({ tenantId: tenantA.id, name: "SR03 Remove" });
    await assignUserRoleFixture({ userId: user.id, roleId: roleToKeep.id, tenantId: tenantA.id });
    await assignUserRoleFixture({ userId: user.id, roleId: roleToRemove.id, tenantId: tenantA.id });

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
    const roleTenantB = await createTenantRoleFixture({ tenantId: tenantB.id, name: "SR04 TenantB Role" });

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

  // ── Correction 2: inactive membership allows role changes ─────────────────

  it("SR-07: role can be ASSIGNED to a user with inactive membership", async () => {
    const user = await createTestUser("sr07");
    createdUserIds.push(user.id);
    await createTestMembership(tenantA.id, user.id, false); // inactive
    const role = await createTenantRoleFixture({ tenantId: tenantA.id, name: "SR07 Role" });

    const result = await setTenantUserRoles({
      tenantId: tenantA.id,
      userId: user.id,
      roleIds: [role.id],
      actorUserId: "actor-test",
    });

    expect(result.assigned).toEqual([role.name]);
    const ur = await prisma.userRole.findUnique({
      where: { userId_roleId: { userId: user.id, roleId: role.id } },
    });
    expect(ur).not.toBeNull();
  });

  it("SR-08: role can be REMOVED from a user with inactive membership", async () => {
    const user = await createTestUser("sr08");
    createdUserIds.push(user.id);
    await createTestMembership(tenantA.id, user.id, false); // inactive
    const role = await createTenantRoleFixture({ tenantId: tenantA.id, name: "SR08 Role" });
    await assignUserRoleFixture({ userId: user.id, roleId: role.id, tenantId: tenantA.id });

    const result = await setTenantUserRoles({
      tenantId: tenantA.id,
      userId: user.id,
      roleIds: [],
      actorUserId: "actor-test",
    });

    expect(result.removed).toEqual([role.name]);
    const ur = await prisma.userRole.findUnique({
      where: { userId_roleId: { userId: user.id, roleId: role.id } },
    });
    expect(ur).toBeNull();
  });

  it("SR-09: inactive membership remains inactive after role assignment", async () => {
    const user = await createTestUser("sr09");
    createdUserIds.push(user.id);
    await createTestMembership(tenantA.id, user.id, false);
    const role = await createTenantRoleFixture({ tenantId: tenantA.id, name: "SR09 Role" });

    await setTenantUserRoles({
      tenantId: tenantA.id,
      userId: user.id,
      roleIds: [role.id],
      actorUserId: "actor-test",
    });

    const mem = await prisma.tenantMembership.findUnique({
      where: { tenantId_userId: { tenantId: tenantA.id, userId: user.id } },
      select: { isActive: true },
    });
    expect(mem?.isActive).toBe(false);
  });

  it("SR-10: inactive membership remains inactive after role removal", async () => {
    const user = await createTestUser("sr10");
    createdUserIds.push(user.id);
    await createTestMembership(tenantA.id, user.id, false);
    const role = await createTenantRoleFixture({ tenantId: tenantA.id, name: "SR10 Role" });
    await assignUserRoleFixture({ userId: user.id, roleId: role.id, tenantId: tenantA.id });

    await setTenantUserRoles({
      tenantId: tenantA.id,
      userId: user.id,
      roleIds: [],
      actorUserId: "actor-test",
    });

    const mem = await prisma.tenantMembership.findUnique({
      where: { tenantId_userId: { tenantId: tenantA.id, userId: user.id } },
      select: { isActive: true },
    });
    expect(mem?.isActive).toBe(false);
  });

  // ── Correction 1: canonical Club Admin last-holder protection ─────────────
  // Each test uses its own tenant to avoid key-uniqueness collisions between
  // tests sharing the same canonical club_admin__<tenantKey> role.

  it("SR-11: removing the last active canonical Club Admin is blocked (LastRequiredAdminError)", async () => {
    const tenant = await createTestTenant("sr11ca");
    createdTenantIds.push(tenant.id);
    const user = await createTestUser("sr11");
    createdUserIds.push(user.id);
    await createTestMembership(tenant.id, user.id, true);
    const caRole = await createClubAdminRole(tenant.id, tenant.key);
    await assignUserRoleFixture({ userId: user.id, roleId: caRole.id, tenantId: tenant.id });

    await expect(
      setTenantUserRoles({
        tenantId: tenant.id,
        userId: user.id,
        roleIds: [],
        actorUserId: "actor-test",
      }),
    ).rejects.toBeInstanceOf(LastRequiredAdminError);
  });

  it("SR-12: Club Admin can be removed when another active Club Admin exists", async () => {
    const tenant = await createTestTenant("sr12ca");
    createdTenantIds.push(tenant.id);
    const userA = await createTestUser("sr12a");
    const userB = await createTestUser("sr12b");
    createdUserIds.push(userA.id, userB.id);
    await createTestMembership(tenant.id, userA.id, true);
    await createTestMembership(tenant.id, userB.id, true);
    const caRole = await createClubAdminRole(tenant.id, tenant.key);
    await assignUserRoleFixture({ userId: userA.id, roleId: caRole.id, tenantId: tenant.id });
    await assignUserRoleFixture({ userId: userB.id, roleId: caRole.id, tenantId: tenant.id });

    const result = await setTenantUserRoles({
      tenantId: tenant.id,
      userId: userA.id,
      roleIds: [],
      actorUserId: "actor-test",
    });

    expect(result.removed).toEqual(["Club Admin"]);
    const ur = await prisma.userRole.findUnique({
      where: { userId_roleId: { userId: userA.id, roleId: caRole.id } },
    });
    expect(ur).toBeNull();
  });

  it("SR-13: last holder of a non-Club-Admin isSystem role CAN be removed", async () => {
    const user = await createTestUser("sr13");
    createdUserIds.push(user.id);
    await createTestMembership(tenantA.id, user.id, true);
    const systemRole = await createTenantRoleFixture({
      tenantId: tenantA.id,
      name: "SR13 Other System Role",
      isSystem: true,
    });
    await assignUserRoleFixture({ userId: user.id, roleId: systemRole.id, tenantId: tenantA.id });

    // No LastRequiredAdminError — this is not the canonical Club Admin role
    const result = await setTenantUserRoles({
      tenantId: tenantA.id,
      userId: user.id,
      roleIds: [],
      actorUserId: "actor-test",
    });

    expect(result.removed).toEqual([systemRole.name]);
    const ur = await prisma.userRole.findUnique({
      where: { userId_roleId: { userId: user.id, roleId: systemRole.id } },
    });
    expect(ur).toBeNull();
  });

  it("SR-14: self removing own last Club Admin role is blocked (no other active CA)", async () => {
    const tenant = await createTestTenant("sr14ca");
    createdTenantIds.push(tenant.id);
    const actor = await createTestUser("sr14");
    createdUserIds.push(actor.id);
    await createTestMembership(tenant.id, actor.id, true);
    const caRole = await createClubAdminRole(tenant.id, tenant.key);
    await assignUserRoleFixture({ userId: actor.id, roleId: caRole.id, tenantId: tenant.id });

    await expect(
      setTenantUserRoles({
        tenantId: tenant.id,
        userId: actor.id,
        roleIds: [],
        actorUserId: actor.id,
      }),
    ).rejects.toBeInstanceOf(LastRequiredAdminError);
  });

  it("SR-15: other tenant's TENANT roles are untouched after sync", async () => {
    const user = await createTestUser("sr15");
    createdUserIds.push(user.id);
    await createTestMembership(tenantA.id, user.id, true);
    await createTestMembership(tenantB.id, user.id, true);

    const roleA = await createTenantRoleFixture({ tenantId: tenantA.id, name: "SR15 TenantA" });
    const roleB = await createTenantRoleFixture({ tenantId: tenantB.id, name: "SR15 TenantB" });

    await assignUserRoleFixture({ userId: user.id, roleId: roleA.id, tenantId: tenantA.id });
    await assignUserRoleFixture({ userId: user.id, roleId: roleB.id, tenantId: tenantB.id });

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

  it("SR-16: PLATFORM UserRole records are untouched after sync", async () => {
    const user = await createTestUser("sr16");
    createdUserIds.push(user.id);
    await createTestMembership(tenantA.id, user.id, true);

    const platformUserRole = await prisma.userRole.create({
      data: { userId: user.id, roleId: platformRole.id, tenantId: null },
    });

    const roleA = await createTenantRoleFixture({ tenantId: tenantA.id, name: "SR16 Role" });

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

    await prisma.userRole.delete({ where: { id: platformUserRole.id } });
  });

  it("SR-17: TenantMembership.isActive unchanged after role changes with active membership", async () => {
    const user = await createTestUser("sr17");
    createdUserIds.push(user.id);
    await createTestMembership(tenantA.id, user.id, true);
    const role = await createTenantRoleFixture({ tenantId: tenantA.id, name: "SR17 Role" });

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

  it("SR-18: duplicate role in roleIds (already assigned) is idempotent", async () => {
    const user = await createTestUser("sr18");
    createdUserIds.push(user.id);
    await createTestMembership(tenantA.id, user.id, true);
    const role = await createTenantRoleFixture({ tenantId: tenantA.id, name: "SR18 Role" });
    await assignUserRoleFixture({ userId: user.id, roleId: role.id, tenantId: tenantA.id });

    const result = await setTenantUserRoles({
      tenantId: tenantA.id,
      userId: user.id,
      roleIds: [role.id],
      actorUserId: "actor-test",
    });

    expect(result.assigned).toEqual([]);
    expect(result.removed).toEqual([]);

    const rows = await prisma.userRole.findMany({ where: { userId: user.id, roleId: role.id } });
    expect(rows).toHaveLength(1);
  });

  it("SR-19: archived role in roleIds is rejected (ArchivedRoleError)", async () => {
    const user = await createTestUser("sr19");
    createdUserIds.push(user.id);
    await createTestMembership(tenantA.id, user.id, true);
    const archivedRole = await createTenantRoleFixture({
      tenantId: tenantA.id,
      name: "SR19 Archived",
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
