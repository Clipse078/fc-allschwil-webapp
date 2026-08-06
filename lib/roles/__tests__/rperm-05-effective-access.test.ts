/**
 * RPERM-05 — Effective access preview (lib/roles/effective-access.ts)
 *
 * Requires a live PostgreSQL database (DATABASE_URL). See test-helpers.ts.
 *
 * Covers:
 *   EA-01  Effective permissions come from EffectivePermissionResolver, deduplicated across roles
 *   EA-02  Archived tenant-role assignments are excluded from effective grants (still listed, flagged)
 *   EA-03  Inactive membership yields no effective tenant permissions
 *   EA-04  Platform roles are surfaced separately and never merged into tenant grants
 *   EA-05  Visible module (Dokumente) appears once workspace.manage is granted; denied otherwise
 *   EA-06  Returns null for a user with no TenantMembership row in this tenant
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getUserEffectiveAccessView } from "@/lib/roles/effective-access";
import {
  assignUserRoleFixture,
  cleanupTestFixtures,
  createTenantRoleFixture,
  createTestMembership,
  createTestTenant,
  createTestUser,
  ensurePermission,
  prisma,
} from "./test-helpers";

describe("RPERM-05 — Effective access view (live DB)", () => {
  let tenant: { id: string };
  const tenantIds: string[] = [];
  const userIds: string[] = [];

  beforeAll(async () => {
    tenant = await createTestTenant("effective");
    tenantIds.push(tenant.id);
    await ensurePermission("workspace.view", { module: "WORKSPACE", scope: "TENANT", grantableByAdmin: true });
    await ensurePermission("workspace.manage", { module: "WORKSPACE", scope: "TENANT", grantableByAdmin: true });
    await ensurePermission("teams.view", { module: "TEAMS", scope: "TENANT", grantableByAdmin: true });
    await ensurePermission("users.manage", { module: "USERS", scope: "PLATFORM", grantableByAdmin: false });
  });

  afterAll(async () => {
    await cleanupTestFixtures({ tenantIds, userIds });
    await prisma.$disconnect();
  });

  it("EA-01: deduplicates permissions granted by multiple roles", async () => {
    const user = await createTestUser("effective-multi-role");
    userIds.push(user.id);
    await createTestMembership(tenant.id, user.id, true);

    const roleOne = await createTenantRoleFixture({
      tenantId: tenant.id,
      name: `Role One ${Date.now()}`,
      permissionKeys: ["workspace.view", "teams.view"],
    });
    const roleTwo = await createTenantRoleFixture({
      tenantId: tenant.id,
      name: `Role Two ${Date.now()}`,
      permissionKeys: ["workspace.view", "workspace.manage"],
    });
    await assignUserRoleFixture({ userId: user.id, roleId: roleOne.id, tenantId: tenant.id });
    await assignUserRoleFixture({ userId: user.id, roleId: roleTwo.id, tenantId: tenant.id });

    const view = await getUserEffectiveAccessView(tenant.id, user.id);
    expect(view).not.toBeNull();
    expect(view!.effectiveTenantPermissionKeys.sort()).toEqual(
      ["teams.view", "workspace.manage", "workspace.view"].sort(),
    );
    // Deduplicated — workspace.view granted by both roles appears once.
    expect(
      view!.effectiveTenantPermissionKeys.filter((k) => k === "workspace.view"),
    ).toHaveLength(1);
  });

  it("EA-02: an archived role assignment is listed but excluded from effective grants", async () => {
    const user = await createTestUser("effective-archived-role");
    userIds.push(user.id);
    await createTestMembership(tenant.id, user.id, true);

    const archivedRole = await createTenantRoleFixture({
      tenantId: tenant.id,
      name: `Archived Grant ${Date.now()}`,
      isArchived: true,
      permissionKeys: ["workspace.manage"],
    });
    await assignUserRoleFixture({ userId: user.id, roleId: archivedRole.id, tenantId: tenant.id });

    const view = await getUserEffectiveAccessView(tenant.id, user.id);
    expect(view!.assignedRoles.some((r) => r.id === archivedRole.id && r.isArchived)).toBe(true);
    expect(view!.effectiveTenantPermissionKeys).not.toContain("workspace.manage");
  });

  it("EA-03: an inactive membership yields no effective tenant permissions", async () => {
    const user = await createTestUser("effective-inactive-membership");
    userIds.push(user.id);
    await createTestMembership(tenant.id, user.id, false);

    const role = await createTenantRoleFixture({
      tenantId: tenant.id,
      name: `Inactive Grant ${Date.now()}`,
      permissionKeys: ["workspace.manage"],
    });
    await assignUserRoleFixture({ userId: user.id, roleId: role.id, tenantId: tenant.id });

    const view = await getUserEffectiveAccessView(tenant.id, user.id);
    expect(view!.membershipIsActive).toBe(false);
    expect(view!.effectiveTenantPermissionKeys).toEqual([]);
  });

  it("EA-04: platform roles are surfaced separately, never merged into tenant grants", async () => {
    const user = await createTestUser("effective-platform-role");
    userIds.push(user.id);
    await createTestMembership(tenant.id, user.id, true);

    const platformRole = await prisma.role.create({
      data: { key: `rperm05-platform-ea-${Date.now()}`, name: "Platform Test Role", scope: "PLATFORM" },
    });
    await assignUserRoleFixture({ userId: user.id, roleId: platformRole.id, tenantId: null });

    try {
      const view = await getUserEffectiveAccessView(tenant.id, user.id);
      expect(view!.platformRoles.map((r) => r.id)).toContain(platformRole.id);
      expect(view!.assignedRoles.map((r) => r.id)).not.toContain(platformRole.id);
    } finally {
      await prisma.userRole.deleteMany({ where: { roleId: platformRole.id } });
      await prisma.role.delete({ where: { id: platformRole.id } });
    }
  });

  it("EA-05: the Dokumente module is visible only once workspace access is granted", async () => {
    const user = await createTestUser("effective-documents-visibility");
    userIds.push(user.id);
    await createTestMembership(tenant.id, user.id, true);

    const noDocsView = await getUserEffectiveAccessView(tenant.id, user.id);
    expect(noDocsView!.visibleNavItems.some((i) => i.label === "Dokumente")).toBe(false);
    expect(noDocsView!.deniedNavItems.some((i) => i.label === "Dokumente")).toBe(true);

    const docsRole = await createTenantRoleFixture({
      tenantId: tenant.id,
      name: `Documents Manager ${Date.now()}`,
      permissionKeys: ["workspace.manage"],
    });
    await assignUserRoleFixture({ userId: user.id, roleId: docsRole.id, tenantId: tenant.id });

    const withDocsView = await getUserEffectiveAccessView(tenant.id, user.id);
    expect(withDocsView!.visibleNavItems.some((i) => i.label === "Dokumente")).toBe(true);
    expect(withDocsView!.deniedNavItems.some((i) => i.label === "Dokumente")).toBe(false);
  });

  it("EA-06: returns null for a user with no TenantMembership row in this tenant", async () => {
    const user = await createTestUser("effective-no-membership");
    userIds.push(user.id);
    const view = await getUserEffectiveAccessView(tenant.id, user.id);
    expect(view).toBeNull();
  });
});
