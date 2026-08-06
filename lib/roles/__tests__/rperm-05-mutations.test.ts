/**
 * RPERM-05 — Role mutation integration tests (lib/roles/mutations.ts)
 *
 * Requires a live PostgreSQL database (DATABASE_URL). Run against a
 * disposable local database — never STAGE. Each test creates its own
 * randomly-suffixed tenant/user/role fixtures and tears them down in
 * afterAll, so this file is safe to re-run against a database that also
 * carries the canonical `prisma/seed.ts` data.
 *
 * Covers:
 *   Role lifecycle
 *     RL-01  Create tenant custom role + permissions atomically
 *     RL-02  Duplicate role name (same tenant, case-insensitive) rejected
 *     RL-03  Same name allowed in a different tenant (no cross-tenant collision)
 *     RL-04  Rename + edit description
 *     RL-05  Archive then restore
 *     RL-06  Archived role cannot have its permissions edited
 *     RL-07  Protected (isSystem) role cannot be renamed/archived
 *   Permission scope validation
 *     PS-01  TENANT/grantableByAdmin permissions persist correctly
 *     PS-02  PLATFORM-scoped permission key is rejected
 *     PS-03  Unknown permission key is rejected
 *     PS-04  Essential permission cannot be removed from a protected role
 *   Tenant isolation
 *     TI-01  Mutating a role id that belongs to a different tenant fails (not found)
 *   Assignments
 *     AS-01  Active member can receive a role
 *     AS-02  Assigning a user without an active membership is rejected
 *     AS-03  Duplicate assignment is idempotent (no second UserRole row)
 *     AS-04  Removing a role does not delete the TenantMembership
 *     AS-05  Cross-tenant assignment (role from Tenant B) is rejected
 *     AS-06  Archived role cannot be assigned
 *     AS-07  Removing the last active holder of a protected role is blocked
 *     AS-08  Removal succeeds when another active holder remains
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  assignTenantRoleToUser,
  createTenantRole,
  removeTenantRoleAssignment,
  setTenantRolePermissions,
  updateTenantRoleDetails,
} from "@/lib/roles/mutations";
import {
  ArchivedRoleError,
  DuplicateRoleNameError,
  InactiveMembershipError,
  InvalidPermissionScopeError,
  LastRequiredAdminError,
  ProtectedRoleError,
  RoleNotFoundError,
  RoleUserNotFoundError,
  RoleValidationError,
} from "@/lib/roles/errors";
import {
  assignUserRoleFixture,
  createTenantRoleFixture,
  createTestMembership,
  createTestTenant,
  createTestUser,
  cleanupTestFixtures,
  ensurePermission,
  prisma,
} from "./test-helpers";

describe("RPERM-05 — Role mutations (live DB)", () => {
  let tenantA: { id: string };
  let tenantB: { id: string };
  const createdTenantIds: string[] = [];
  const createdUserIds: string[] = [];

  beforeAll(async () => {
    tenantA = await createTestTenant("mut-a");
    tenantB = await createTestTenant("mut-b");
    createdTenantIds.push(tenantA.id, tenantB.id);

    await ensurePermission("teams.view", { module: "TEAMS", scope: "TENANT", grantableByAdmin: true });
    await ensurePermission("teams.manage", { module: "TEAMS", scope: "TENANT", grantableByAdmin: true });
    // Pre-existing PLATFORM permission from canonical seed; ensure it exists
    // even if seed.ts hasn't run against this database.
    await ensurePermission("users.manage", { module: "USERS", scope: "PLATFORM", grantableByAdmin: false });
    await ensurePermission("roles.manage", { module: "ROLES", scope: "TENANT", grantableByAdmin: true });
    await ensurePermission("roles.assign", { module: "ROLES", scope: "TENANT", grantableByAdmin: true });
    await ensurePermission("users.manage_memberships", { module: "USERS", scope: "TENANT", grantableByAdmin: true });
  });

  afterAll(async () => {
    await cleanupTestFixtures({ tenantIds: createdTenantIds, userIds: createdUserIds });
    await prisma.$disconnect();
  });

  it("RL-01: creates a tenant custom role with permissions atomically", async () => {
    const result = await createTenantRole({
      tenantId: tenantA.id,
      name: `Dokumente Manager ${Date.now()}`,
      description: "Verwaltet Dokumente",
      permissionKeys: ["teams.view", "teams.manage"],
      isActive: true,
      actorUserId: "actor-1",
    });

    expect(result.permissionKeys.sort()).toEqual(["teams.manage", "teams.view"]);
    expect(result.isArchived).toBe(false);

    const persisted = await prisma.role.findUnique({
      where: { id: result.id },
      include: { rolePermissions: true },
    });
    expect(persisted?.scope).toBe("TENANT");
    expect(persisted?.tenantId).toBe(tenantA.id);
    expect(persisted?.rolePermissions).toHaveLength(2);
  });

  it("RL-02: rejects a duplicate role name within the same tenant (case-insensitive)", async () => {
    const name = `Trainer Sonderrolle ${Date.now()}`;
    await createTenantRole({
      tenantId: tenantA.id,
      name,
      permissionKeys: [],
      isActive: true,
      actorUserId: "actor-1",
    });

    await expect(
      createTenantRole({
        tenantId: tenantA.id,
        name: name.toUpperCase(),
        permissionKeys: [],
        isActive: true,
        actorUserId: "actor-1",
      }),
    ).rejects.toBeInstanceOf(DuplicateRoleNameError);
  });

  it("RL-03: the same name is allowed in a different tenant", async () => {
    const name = `Shared Name ${Date.now()}`;
    await createTenantRole({
      tenantId: tenantA.id,
      name,
      permissionKeys: [],
      isActive: true,
      actorUserId: "actor-1",
    });

    await expect(
      createTenantRole({
        tenantId: tenantB.id,
        name,
        permissionKeys: [],
        isActive: true,
        actorUserId: "actor-1",
      }),
    ).resolves.toBeDefined();
  });

  it("PS-02: rejects a PLATFORM-scoped permission key", async () => {
    await expect(
      createTenantRole({
        tenantId: tenantA.id,
        name: `Invalid Scope ${Date.now()}`,
        permissionKeys: ["users.manage"],
        isActive: true,
        actorUserId: "actor-1",
      }),
    ).rejects.toBeInstanceOf(InvalidPermissionScopeError);
  });

  it("PS-03: rejects an unknown permission key", async () => {
    await expect(
      createTenantRole({
        tenantId: tenantA.id,
        name: `Unknown Perm ${Date.now()}`,
        permissionKeys: ["not.a.real.permission"],
        isActive: true,
        actorUserId: "actor-1",
      }),
    ).rejects.toBeInstanceOf(RoleValidationError);
  });

  it("RL-04: renames and edits description of a custom role", async () => {
    const role = await createTenantRole({
      tenantId: tenantA.id,
      name: `Original Name ${Date.now()}`,
      permissionKeys: [],
      isActive: true,
      actorUserId: "actor-1",
    });

    const updated = await updateTenantRoleDetails({
      tenantId: tenantA.id,
      roleId: role.id,
      name: "Renamed Role",
      description: "Neue Beschreibung",
      actorUserId: "actor-1",
    });

    expect(updated.name).toBe("Renamed Role");
    expect(updated.description).toBe("Neue Beschreibung");
  });

  it("RL-05: archives then restores a custom role", async () => {
    const role = await createTenantRole({
      tenantId: tenantA.id,
      name: `Archivable ${Date.now()}`,
      permissionKeys: [],
      isActive: true,
      actorUserId: "actor-1",
    });

    const archived = await updateTenantRoleDetails({
      tenantId: tenantA.id,
      roleId: role.id,
      isArchived: true,
      actorUserId: "actor-1",
    });
    expect(archived.isArchived).toBe(true);

    const restored = await updateTenantRoleDetails({
      tenantId: tenantA.id,
      roleId: role.id,
      isArchived: false,
      actorUserId: "actor-1",
    });
    expect(restored.isArchived).toBe(false);
  });

  it("RL-06 / PS-01: archived role rejects permission edits; active role persists TENANT permissions", async () => {
    const role = await createTenantRole({
      tenantId: tenantA.id,
      name: `Archived Perms ${Date.now()}`,
      permissionKeys: ["teams.view"],
      isActive: true,
      actorUserId: "actor-1",
    });

    const active = await setTenantRolePermissions({
      tenantId: tenantA.id,
      roleId: role.id,
      permissionKeys: ["teams.view", "teams.manage"],
      actorUserId: "actor-1",
    });
    expect(active.permissionKeys.sort()).toEqual(["teams.manage", "teams.view"]);

    await updateTenantRoleDetails({
      tenantId: tenantA.id,
      roleId: role.id,
      isArchived: true,
      actorUserId: "actor-1",
    });

    await expect(
      setTenantRolePermissions({
        tenantId: tenantA.id,
        roleId: role.id,
        permissionKeys: ["teams.view"],
        actorUserId: "actor-1",
      }),
    ).rejects.toBeInstanceOf(ArchivedRoleError);
  });

  it("RL-07: a protected (isSystem) role cannot be renamed, described, or archived", async () => {
    const systemRole = await createTenantRoleFixture({
      tenantId: tenantA.id,
      name: "Club Admin (Test)",
      isSystem: true,
      permissionKeys: ["roles.manage", "roles.assign", "users.manage_memberships"],
    });

    await expect(
      updateTenantRoleDetails({
        tenantId: tenantA.id,
        roleId: systemRole.id,
        name: "Renamed",
        actorUserId: "actor-1",
      }),
    ).rejects.toBeInstanceOf(ProtectedRoleError);

    await expect(
      updateTenantRoleDetails({
        tenantId: tenantA.id,
        roleId: systemRole.id,
        isArchived: true,
        actorUserId: "actor-1",
      }),
    ).rejects.toBeInstanceOf(ProtectedRoleError);
  });

  it("PS-04: an essential permission cannot be removed from a protected role", async () => {
    const systemRole = await createTenantRoleFixture({
      tenantId: tenantA.id,
      name: `System Role Perms ${Date.now()}`,
      isSystem: true,
      permissionKeys: ["roles.manage", "roles.assign", "users.manage_memberships", "teams.view"],
    });

    await expect(
      setTenantRolePermissions({
        tenantId: tenantA.id,
        roleId: systemRole.id,
        permissionKeys: ["teams.view"], // drops all three essential keys
        actorUserId: "actor-1",
      }),
    ).rejects.toBeInstanceOf(ProtectedRoleError);

    // Non-essential permission remains freely removable.
    const result = await setTenantRolePermissions({
      tenantId: tenantA.id,
      roleId: systemRole.id,
      permissionKeys: ["roles.manage", "roles.assign", "users.manage_memberships"],
      actorUserId: "actor-1",
    });
    expect(result.permissionKeys).not.toContain("teams.view");
  });

  it("TI-01: mutating a role id owned by a different tenant is rejected as not-found", async () => {
    const roleInB = await createTenantRoleFixture({ tenantId: tenantB.id, name: `Tenant B Role ${Date.now()}` });

    await expect(
      updateTenantRoleDetails({
        tenantId: tenantA.id,
        roleId: roleInB.id,
        name: "Hijacked",
        actorUserId: "attacker",
      }),
    ).rejects.toBeInstanceOf(RoleNotFoundError);

    await expect(
      setTenantRolePermissions({
        tenantId: tenantA.id,
        roleId: roleInB.id,
        permissionKeys: [],
        actorUserId: "attacker",
      }),
    ).rejects.toBeInstanceOf(RoleNotFoundError);
  });

  // ── Assignments ──────────────────────────────────────────────────────────

  it("AS-01 / AS-03: an active member can receive a role, idempotently", async () => {
    const user = await createTestUser("assign-active");
    createdUserIds.push(user.id);
    await createTestMembership(tenantA.id, user.id, true);
    const role = await createTenantRoleFixture({ tenantId: tenantA.id, name: `Assignable ${Date.now()}` });

    const first = await assignTenantRoleToUser({
      tenantId: tenantA.id,
      roleId: role.id,
      userId: user.id,
      actorUserId: "actor-1",
    });
    expect(first.assigned).toBe(true);

    const second = await assignTenantRoleToUser({
      tenantId: tenantA.id,
      roleId: role.id,
      userId: user.id,
      actorUserId: "actor-1",
    });
    expect(second.assigned).toBe(false);

    const rows = await prisma.userRole.findMany({ where: { userId: user.id, roleId: role.id } });
    expect(rows).toHaveLength(1);
  });

  it("AS-02: assigning a user with an inactive membership is rejected", async () => {
    const user = await createTestUser("assign-inactive");
    createdUserIds.push(user.id);
    await createTestMembership(tenantA.id, user.id, false);
    const role = await createTenantRoleFixture({ tenantId: tenantA.id, name: `Inactive Target ${Date.now()}` });

    await expect(
      assignTenantRoleToUser({ tenantId: tenantA.id, roleId: role.id, userId: user.id, actorUserId: "actor-1" }),
    ).rejects.toBeInstanceOf(InactiveMembershipError);
  });

  it("AS-02b: assigning a user with no membership at all is rejected", async () => {
    const user = await createTestUser("assign-no-membership");
    createdUserIds.push(user.id);
    const role = await createTenantRoleFixture({ tenantId: tenantA.id, name: `No Membership Target ${Date.now()}` });

    await expect(
      assignTenantRoleToUser({ tenantId: tenantA.id, roleId: role.id, userId: user.id, actorUserId: "actor-1" }),
    ).rejects.toBeInstanceOf(RoleUserNotFoundError);
  });

  it("AS-04: removing a role assignment does not delete the TenantMembership", async () => {
    const user = await createTestUser("remove-keeps-membership");
    createdUserIds.push(user.id);
    await createTestMembership(tenantA.id, user.id, true);
    const role = await createTenantRoleFixture({ tenantId: tenantA.id, name: `Removable ${Date.now()}` });

    await assignTenantRoleToUser({ tenantId: tenantA.id, roleId: role.id, userId: user.id, actorUserId: "actor-1" });
    const removed = await removeTenantRoleAssignment({
      tenantId: tenantA.id,
      roleId: role.id,
      userId: user.id,
      actorUserId: "actor-1",
    });
    expect(removed.removed).toBe(true);

    const membership = await prisma.tenantMembership.findUnique({
      where: { tenantId_userId: { tenantId: tenantA.id, userId: user.id } },
    });
    expect(membership).not.toBeNull();
    expect(membership?.isActive).toBe(true);
  });

  it("AS-05: a role owned by Tenant B cannot be assigned via Tenant A's context", async () => {
    const user = await createTestUser("cross-tenant-target");
    createdUserIds.push(user.id);
    await createTestMembership(tenantA.id, user.id, true);
    const roleInB = await createTenantRoleFixture({ tenantId: tenantB.id, name: `Cross Tenant Role ${Date.now()}` });

    await expect(
      assignTenantRoleToUser({ tenantId: tenantA.id, roleId: roleInB.id, userId: user.id, actorUserId: "actor-1" }),
    ).rejects.toBeInstanceOf(RoleNotFoundError);
  });

  it("AS-06: an archived role cannot be assigned", async () => {
    const user = await createTestUser("archived-role-target");
    createdUserIds.push(user.id);
    await createTestMembership(tenantA.id, user.id, true);
    const role = await createTenantRoleFixture({
      tenantId: tenantA.id,
      name: `Archived At Creation ${Date.now()}`,
      isArchived: true,
    });

    await expect(
      assignTenantRoleToUser({ tenantId: tenantA.id, roleId: role.id, userId: user.id, actorUserId: "actor-1" }),
    ).rejects.toBeInstanceOf(ArchivedRoleError);
  });

  it("AS-07 / AS-08: removing the last active holder of a protected role is blocked; succeeds with a remaining holder", async () => {
    const userOne = await createTestUser("last-admin-one");
    const userTwo = await createTestUser("last-admin-two");
    createdUserIds.push(userOne.id, userTwo.id);
    await createTestMembership(tenantA.id, userOne.id, true);
    await createTestMembership(tenantA.id, userTwo.id, true);

    const systemRole = await createTenantRoleFixture({
      tenantId: tenantA.id,
      name: `Last Admin Guard ${Date.now()}`,
      isSystem: true,
    });

    await assignUserRoleFixture({ userId: userOne.id, roleId: systemRole.id, tenantId: tenantA.id });

    // Sole holder — removal must be blocked.
    await expect(
      removeTenantRoleAssignment({
        tenantId: tenantA.id,
        roleId: systemRole.id,
        userId: userOne.id,
        actorUserId: "actor-1",
      }),
    ).rejects.toBeInstanceOf(LastRequiredAdminError);

    // Add a second holder — now removing the first must succeed.
    await assignUserRoleFixture({ userId: userTwo.id, roleId: systemRole.id, tenantId: tenantA.id });

    const result = await removeTenantRoleAssignment({
      tenantId: tenantA.id,
      roleId: systemRole.id,
      userId: userOne.id,
      actorUserId: "actor-1",
    });
    expect(result.removed).toBe(true);
  });
});
