/**
 * lib/roles/__tests__/rperm-05c1-platform-permission-scope.test.ts
 *
 * RPERM-05-C1 — Finding 2: platform permission-scope validation.
 *
 * Expected combinations (from the task):
 *
 *   Role      Permission   Result
 *   PLATFORM  PLATFORM      Allowed
 *   PLATFORM  TENANT        Denied
 *   TENANT    TENANT        Allowed   (covered by rperm-05-mutations.test.ts PS-01)
 *   TENANT    PLATFORM      Denied    (covered by rperm-05-mutations.test.ts PS-02)
 *
 * This file covers the PLATFORM-role half of the matrix plus the catalog
 * (listing) filter, against a real disposable local database (same
 * convention as `lib/roles/__tests__/test-helpers.ts`).
 */

import "dotenv/config";

import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/roles/__tests__/test-helpers";
import { getPermissionEditorData } from "@/lib/roles/queries";
import { setPlatformRolePermissions } from "@/lib/roles/platform-mutations";
import { InvalidPermissionScopeError, RoleNotFoundError } from "@/lib/roles/errors";

const roleIds: string[] = [];
const permissionKeys: string[] = [];

afterAll(async () => {
  await prisma.rolePermission.deleteMany({ where: { roleId: { in: roleIds } } });
  await prisma.role.deleteMany({ where: { id: { in: roleIds } } });
  await prisma.permission.deleteMany({ where: { key: { in: permissionKeys } } });
});

async function createPlatformRole(key: string) {
  const role = await prisma.role.create({
    data: { key, name: `RPERM-05-C1 Platform Role ${key}`, scope: "PLATFORM", isSystem: false },
  });
  roleIds.push(role.id);
  return role;
}

async function createTenantRole(key: string, tenantId: string) {
  const role = await prisma.role.create({
    data: { key, name: `RPERM-05-C1 Tenant Role ${key}`, scope: "TENANT", tenantId, isSystem: false },
  });
  roleIds.push(role.id);
  return role;
}

async function ensurePlatformPermission(key: string) {
  permissionKeys.push(key);
  return prisma.permission.upsert({
    where: { key },
    update: { scope: "PLATFORM", grantableByAdmin: false },
    create: { key, name: key, module: "USERS", scope: "PLATFORM", grantableByAdmin: false },
  });
}

async function ensureTenantPermission(key: string) {
  permissionKeys.push(key);
  return prisma.permission.upsert({
    where: { key },
    update: { scope: "TENANT", grantableByAdmin: true },
    create: { key, name: key, module: "WORKSPACE", scope: "TENANT", grantableByAdmin: true },
  });
}

describe("RPERM-05-C1 — platform permission catalog (listing)", () => {
  it("getPermissionEditorData lists only scope=PLATFORM permissions in the catalog", async () => {
    const platformPerm = await ensurePlatformPermission("rperm05c1-platform-listing-perm");
    const tenantPerm = await ensureTenantPermission("rperm05c1-tenant-listing-perm");
    const role = await createPlatformRole("rperm05c1-platform-listing-role");

    const data = await getPermissionEditorData(role.id);
    expect(data).not.toBeNull();

    const allKeysInCatalog = data!.moduleGroups.flatMap((g) => g.permissions.map((p) => p.key));
    expect(allKeysInCatalog).toContain(platformPerm.key);
    expect(allKeysInCatalog).not.toContain(tenantPerm.key);
  });

  it("getPermissionEditorData never reports a legacy TENANT permission as 'assigned' on a PLATFORM role", async () => {
    // Regression guard: some seed-created PLATFORM roles (match_coordinator,
    // website_publisher, trainer, viewer) predate RPERM-05-C1 and already
    // carry TENANT-scoped RolePermission rows. assignedKeys must exclude
    // them — otherwise the editor would render them pre-checked and
    // resubmit them on save, which setPlatformRolePermissions() rejects.
    const platformPerm = await ensurePlatformPermission("rperm05c1-assigned-platform-perm");
    const legacyTenantPerm = await ensureTenantPermission("rperm05c1-assigned-legacy-tenant-perm");
    const role = await createPlatformRole("rperm05c1-legacy-assigned-role");

    await prisma.rolePermission.createMany({
      data: [
        { roleId: role.id, permissionId: platformPerm.id },
        { roleId: role.id, permissionId: legacyTenantPerm.id },
      ],
    });

    const data = await getPermissionEditorData(role.id);
    expect(data).not.toBeNull();
    expect(data!.assignedKeys).toContain(platformPerm.key);
    expect(data!.assignedKeys).not.toContain(legacyTenantPerm.key);
  });

  it("getPermissionEditorData returns null for a TENANT role id (platform-only editor)", async () => {
    const tenant = await prisma.tenant.create({
      data: { key: `rperm05c1-listing-tenant-${Date.now()}`, name: "RPERM-05-C1 Listing Tenant" },
    });
    const tenantRole = await createTenantRole("rperm05c1-platform-listing-tenant-role", tenant.id);

    const data = await getPermissionEditorData(tenantRole.id);
    expect(data).toBeNull();

    await prisma.role.delete({ where: { id: tenantRole.id } });
    roleIds.splice(roleIds.indexOf(tenantRole.id), 1);
    await prisma.tenant.delete({ where: { id: tenant.id } });
  });
});

describe("RPERM-05-C1 — setPlatformRolePermissions (mutation)", () => {
  it("PLATFORM role + PLATFORM permission → allowed and persisted", async () => {
    const perm = await ensurePlatformPermission("rperm05c1-platform-allowed-perm");
    const role = await createPlatformRole("rperm05c1-platform-allowed-role");

    const result = await setPlatformRolePermissions({ roleId: role.id, permissionKeys: [perm.key] });
    expect(result.permissionKeys).toEqual([perm.key]);

    const persisted = await prisma.rolePermission.findMany({
      where: { roleId: role.id },
      select: { permission: { select: { key: true } } },
    });
    expect(persisted.map((p) => p.permission.key)).toEqual([perm.key]);
  });

  it("PLATFORM role + TENANT permission → denied, atomic (no partial persist)", async () => {
    const platformPerm = await ensurePlatformPermission("rperm05c1-mixed-platform-perm");
    const tenantPerm = await ensureTenantPermission("rperm05c1-mixed-tenant-perm");
    const role = await createPlatformRole("rperm05c1-mixed-scope-role");

    // Pre-seed one valid permission so we can prove it survives the rejection untouched.
    await prisma.rolePermission.create({ data: { roleId: role.id, permissionId: platformPerm.id } });

    await expect(
      setPlatformRolePermissions({ roleId: role.id, permissionKeys: [platformPerm.key, tenantPerm.key] }),
    ).rejects.toBeInstanceOf(InvalidPermissionScopeError);

    // Atomicity: the pre-existing valid PLATFORM permission set is untouched
    // — no tenant permission row was persisted, nothing was deleted either.
    const persisted = await prisma.rolePermission.findMany({
      where: { roleId: role.id },
      select: { permission: { select: { key: true } } },
    });
    expect(persisted.map((p) => p.permission.key)).toEqual([platformPerm.key]);
  });

  it("a mixed-scope submission never persists the tenant permission row anywhere", async () => {
    const platformPerm = await ensurePlatformPermission("rperm05c1-mixed2-platform-perm");
    const tenantPerm = await ensureTenantPermission("rperm05c1-mixed2-tenant-perm");
    const role = await createPlatformRole("rperm05c1-mixed2-scope-role");

    await expect(
      setPlatformRolePermissions({ roleId: role.id, permissionKeys: [platformPerm.key, tenantPerm.key] }),
    ).rejects.toBeInstanceOf(InvalidPermissionScopeError);

    const rolePermissionRow = await prisma.rolePermission.findFirst({
      where: { roleId: role.id, permission: { key: tenantPerm.key } },
    });
    expect(rolePermissionRow).toBeNull();
  });

  it("rejects a TENANT-scoped role id (platform-only mutation surface)", async () => {
    const tenant = await prisma.tenant.create({
      data: { key: `rperm05c1-mutation-tenant-${Date.now()}`, name: "RPERM-05-C1 Mutation Tenant" },
    });
    const tenantRole = await createTenantRole("rperm05c1-mutation-scope-tenant-role", tenant.id);

    await expect(
      setPlatformRolePermissions({ roleId: tenantRole.id, permissionKeys: [] }),
    ).rejects.toBeInstanceOf(RoleNotFoundError);

    await prisma.role.delete({ where: { id: tenantRole.id } });
    roleIds.splice(roleIds.indexOf(tenantRole.id), 1);
    await prisma.tenant.delete({ where: { id: tenant.id } });
  });

  it("unknown permission keys are silently dropped (no error, no row)", async () => {
    const role = await createPlatformRole("rperm05c1-unknown-key-role");

    const result = await setPlatformRolePermissions({
      roleId: role.id,
      permissionKeys: ["rperm05c1-does-not-exist"],
    });
    expect(result.permissionKeys).toEqual([]);
  });
});
