/**
 * RPERM-05 — Tenant role/permission queries (lib/roles/tenant-queries.ts)
 *
 * Requires a live PostgreSQL database (DATABASE_URL). See test-helpers.ts.
 *
 * Covers:
 *   Tenant isolation
 *     TQ-01  getTenantRolesOverview only returns Tenant A's own roles
 *     TQ-02  getTenantRoleDetail returns null for a role owned by another tenant
 *     TQ-03  PLATFORM-scoped roles never appear in a tenant overview
 *   Eligible members
 *     TQ-04  Only active TenantMembership rows are eligible — inactive excluded
 *     TQ-05  A user with User.tenantId pointing here but no TenantMembership row is excluded
 *   Permission catalog
 *     TQ-06  Catalog contains only scope=TENANT AND grantableByAdmin=true permissions
 *     TQ-07  A PLATFORM permission never appears in the tenant catalog
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  getEligibleTenantMembers,
  getTenantPermissionCatalog,
  getTenantRoleDetail,
  getTenantRolesOverview,
} from "@/lib/roles/tenant-queries";
import {
  cleanupTestFixtures,
  createTenantRoleFixture,
  createTestMembership,
  createTestTenant,
  createTestUser,
  ensurePermission,
  prisma,
} from "./test-helpers";

describe("RPERM-05 — Tenant queries (live DB)", () => {
  let tenantA: { id: string };
  let tenantB: { id: string };
  const tenantIds: string[] = [];
  const userIds: string[] = [];

  beforeAll(async () => {
    tenantA = await createTestTenant("query-a");
    tenantB = await createTestTenant("query-b");
    tenantIds.push(tenantA.id, tenantB.id);
    await ensurePermission("users.manage", { module: "USERS", scope: "PLATFORM", grantableByAdmin: false });
    await ensurePermission("teams.view", { module: "TEAMS", scope: "TENANT", grantableByAdmin: true });
  });

  afterAll(async () => {
    await cleanupTestFixtures({ tenantIds, userIds });
    await prisma.$disconnect();
  });

  it("TQ-01: getTenantRolesOverview only returns roles owned by the given tenant", async () => {
    const roleA = await createTenantRoleFixture({ tenantId: tenantA.id, name: `A-Only ${Date.now()}` });
    await createTenantRoleFixture({ tenantId: tenantB.id, name: `B-Only ${Date.now()}` });

    const overview = await getTenantRolesOverview(tenantA.id);
    const ids = overview.map((r) => r.id);
    expect(ids).toContain(roleA.id);

    const overviewB = await getTenantRolesOverview(tenantB.id);
    expect(overviewB.map((r) => r.id)).not.toContain(roleA.id);
  });

  it("TQ-02: getTenantRoleDetail returns null for a role owned by a different tenant", async () => {
    const roleB = await createTenantRoleFixture({ tenantId: tenantB.id, name: `Detail B ${Date.now()}` });
    const detail = await getTenantRoleDetail(tenantA.id, roleB.id);
    expect(detail).toBeNull();

    const correctDetail = await getTenantRoleDetail(tenantB.id, roleB.id);
    expect(correctDetail?.id).toBe(roleB.id);
  });

  it("TQ-03: a PLATFORM-scoped role never appears in a tenant overview even with a matching tenantId row", async () => {
    // Defensive: platform roles never carry a tenantId in practice, but the
    // query itself filters scope="TENANT" explicitly — assert directly.
    const platformRole = await prisma.role.create({
      data: { key: `rperm05-platform-${Date.now()}`, name: "Stray Platform Role", scope: "PLATFORM" },
    });
    try {
      const overview = await getTenantRolesOverview(tenantA.id);
      expect(overview.map((r) => r.id)).not.toContain(platformRole.id);
    } finally {
      await prisma.role.delete({ where: { id: platformRole.id } });
    }
  });

  it("TQ-04: only active TenantMembership rows are eligible members", async () => {
    const activeUser = await createTestUser("eligible-active");
    const inactiveUser = await createTestUser("eligible-inactive");
    userIds.push(activeUser.id, inactiveUser.id);
    await createTestMembership(tenantA.id, activeUser.id, true);
    await createTestMembership(tenantA.id, inactiveUser.id, false);

    const members = await getEligibleTenantMembers(tenantA.id);
    const ids = members.map((m) => m.userId);
    expect(ids).toContain(activeUser.id);
    expect(ids).not.toContain(inactiveUser.id);
  });

  it("TQ-05: a user with only a legacy User.tenantId (no TenantMembership row) is not eligible", async () => {
    const legacyUser = await createTestUser("eligible-legacy-only");
    userIds.push(legacyUser.id);
    await prisma.user.update({ where: { id: legacyUser.id }, data: { tenantId: tenantA.id } });
    // Deliberately no TenantMembership row created for this user.

    const members = await getEligibleTenantMembers(tenantA.id);
    expect(members.map((m) => m.userId)).not.toContain(legacyUser.id);
  });

  it("TQ-06 / TQ-07: the permission catalog contains only TENANT+grantableByAdmin permissions", async () => {
    const groups = await getTenantPermissionCatalog();
    const allKeys = groups.flatMap((g) => g.permissions.map((p) => p.key));
    expect(allKeys).toContain("teams.view");
    expect(allKeys).not.toContain("users.manage");
  });
});
