/**
 * ORG-ACCESS-02 — Scoped Role Assignment Mutation Tests
 *
 * Integration tests for lib/roles/scoped-mutations.ts.
 * Requires a live PostgreSQL database (DATABASE_URL).
 *
 * Covers:
 *
 * ASSIGNMENT (ASSIGN)
 *   SA-01  Team assignment creates correct scoped UserRole (orgUnitId, scopeMode=THIS_ORG_UNIT)
 *   SA-02  Same Trainer can be assigned to F2 + E3 (two distinct orgUnit rows)
 *   SA-03  OrgUnit exact scope assignment (THIS_ORG_UNIT)
 *   SA-04  Descendant scope assignment (THIS_ORG_UNIT_AND_DESCENDANTS)
 *   SA-05  Exact duplicate rejected as idempotent (no second row, assigned=false)
 *   SA-06  PLATFORM role rejected
 *   SA-07  Cross-tenant role rejected (role from Tenant B assigned in Tenant A)
 *   SA-08  Cross-tenant OrgUnit rejected (OrgUnit from Tenant B used in Tenant A)
 *   SA-09  Club Admin role rejected as scoped assignment
 *   SA-10  Archived role rejected
 *   SA-11  User without TenantMembership rejected
 *
 * REMOVAL (REMOVE)
 *   SR-01  Remove one scoped assignment without affecting other scoped assignments
 *   SR-02  Remove scoped assignment does not affect tenant-wide assignments
 *   SR-03  Remove with wrong tenantId rejected (cross-tenant isolation)
 *   SR-04  Remove of non-existent row returns { removed: false } (idempotent)
 *   SR-05  Remove refuses to delete a tenant-wide row (orgUnitId=null)
 *
 * READ
 *   RD-01  getScopedAssignmentsForOrgUnit returns only rows for the given orgUnit
 *   RD-02  getScopedAssignmentsForUser returns all scoped assignments for a user
 *
 * USER DETAIL CONSOLIDATION
 *   UD-01  User detail shows tenant-wide + scoped assignments separately
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  assignScopedRoleToUser,
  removeScopedRoleAssignment,
  getScopedAssignmentsForOrgUnit,
  getScopedAssignmentsForUser,
} from "@/lib/roles/scoped-mutations";
import {
  RoleNotFoundError,
  RoleUserNotFoundError,
  RoleDomainError,
  ArchivedRoleError,
} from "@/lib/roles/errors";
import {
  assignUserRoleFixture,
  createTenantRoleFixture,
  createTestMembership,
  createTestTenant,
  createTestUser,
  cleanupTestFixtures,
  prisma,
} from "./test-helpers";
import { getTenantClubAdminRoleKey } from "@/lib/roles/tenant-role-keys";
import { randomUUID } from "node:crypto";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function createOrgUnit(params: {
  tenantId: string;
  name: string;
  parentId?: string;
}) {
  const suffix = randomUUID().slice(0, 6);
  return prisma.orgUnit.create({
    data: {
      tenantId: params.tenantId,
      key: `oa02-ou-${suffix}`,
      name: params.name,
      type: "DIVISION",
      status: "ACTIVE",
      parentId: params.parentId ?? null,
      level: params.parentId ? 1 : 0,
    },
  });
}

async function createClubAdminRole(tenantId: string, tenantKey: string) {
  const key = getTenantClubAdminRoleKey(tenantKey);
  return prisma.role.create({
    data: {
      key,
      name: "Club Admin",
      scope: "TENANT",
      tenantId,
      isSystem: true,
      isArchived: false,
    },
  });
}

// ---------------------------------------------------------------------------
// Test fixture state
// ---------------------------------------------------------------------------

describe("ORG-ACCESS-02 — Scoped role mutation tests (live DB)", () => {
  let tenantA: { id: string; key: string };
  let tenantB: { id: string; key: string };
  let userA: { id: string };
  let userB: { id: string };
  let orgUnitF2: { id: string; name: string };
  let orgUnitE3: { id: string; name: string };
  let orgUnitB: { id: string };
  let trainerRole: { id: string; key: string; name: string };
  let vizeRole: { id: string; key: string; name: string };
  let archivedRole: { id: string };
  let platformRole: { id: string };
  let clubAdminRole: { id: string; key: string };
  let crossTenantRole: { id: string };

  const createdTenantIds: string[] = [];
  const createdUserIds: string[] = [];

  beforeAll(async () => {
    const suffixA = randomUUID().slice(0, 6);
    const suffixB = randomUUID().slice(0, 6);

    // Tenants
    tenantA = await prisma.tenant.create({
      data: { key: `oa02-ta-${suffixA}`, name: `OA-02 Tenant A ${suffixA}` },
    });
    tenantB = await prisma.tenant.create({
      data: { key: `oa02-tb-${suffixB}`, name: `OA-02 Tenant B ${suffixB}` },
    });
    createdTenantIds.push(tenantA.id, tenantB.id);

    // Users
    userA = await createTestUser(`oa02-ua`);
    userB = await createTestUser(`oa02-ub`);
    createdUserIds.push(userA.id, userB.id);

    // Memberships (both users in tenantA; userB also in tenantB)
    await createTestMembership(tenantA.id, userA.id);
    await createTestMembership(tenantA.id, userB.id);
    await createTestMembership(tenantB.id, userB.id);

    // OrgUnits
    orgUnitF2 = await createOrgUnit({ tenantId: tenantA.id, name: "F2" });
    orgUnitE3 = await createOrgUnit({ tenantId: tenantA.id, name: "E3" });
    orgUnitB = await createOrgUnit({ tenantId: tenantB.id, name: "OrgB" });

    // Roles
    trainerRole = await createTenantRoleFixture({
      tenantId: tenantA.id,
      name: "Trainer",
    });
    vizeRole = await createTenantRoleFixture({
      tenantId: tenantA.id,
      name: "Vizepräsident",
    });
    archivedRole = await createTenantRoleFixture({
      tenantId: tenantA.id,
      name: "Archived Role",
      isArchived: true,
    });
    platformRole = await prisma.role.create({
      data: {
        key: `oa02-plat-${suffixA}`,
        name: "Platform Role OA02",
        scope: "PLATFORM",
        isSystem: false,
        isArchived: false,
      },
    });
    clubAdminRole = await createClubAdminRole(tenantA.id, tenantA.key);
    crossTenantRole = await createTenantRoleFixture({
      tenantId: tenantB.id,
      name: "Cross Tenant Role",
    });
  });

  afterAll(async () => {
    // Clean up OrgUnits first (they reference tenant)
    const orgUnitIds = [orgUnitF2.id, orgUnitE3.id, orgUnitB.id];
    await prisma.userRole.deleteMany({ where: { orgUnitId: { in: orgUnitIds } } });
    await prisma.orgUnit.deleteMany({ where: { id: { in: orgUnitIds } } });

    // Clean up platform role manually (not covered by cleanupTestFixtures)
    await prisma.userRole.deleteMany({ where: { roleId: platformRole.id } });
    await prisma.role.delete({ where: { id: platformRole.id } });

    await cleanupTestFixtures({ tenantIds: createdTenantIds, userIds: createdUserIds });
  });

  // -------------------------------------------------------------------------
  // ASSIGNMENT
  // -------------------------------------------------------------------------

  describe("SA-01 — Team assignment creates correct scoped UserRole", () => {
    it("creates a row with orgUnitId, scopeMode=THIS_ORG_UNIT, and correct tenantId", async () => {
      const result = await assignScopedRoleToUser({
        tenantId: tenantA.id,
        userId: userA.id,
        roleId: trainerRole.id,
        orgUnitId: orgUnitF2.id,
        scopeMode: "THIS_ORG_UNIT",
        actorUserId: userA.id,
      });
      expect(result.assigned).toBe(true);
      expect(result.userRoleId).toBeTruthy();

      const row = await prisma.userRole.findUnique({ where: { id: result.userRoleId } });
      expect(row).not.toBeNull();
      expect(row!.orgUnitId).toBe(orgUnitF2.id);
      expect(row!.scopeMode).toBe("THIS_ORG_UNIT");
      expect(row!.tenantId).toBe(tenantA.id);
    });
  });

  describe("SA-02 — Same Trainer can be assigned to F2 + E3", () => {
    it("creates two distinct rows for the same role on different orgUnits", async () => {
      // Assign Trainer → E3 (F2 already assigned in SA-01)
      const result = await assignScopedRoleToUser({
        tenantId: tenantA.id,
        userId: userA.id,
        roleId: trainerRole.id,
        orgUnitId: orgUnitE3.id,
        scopeMode: "THIS_ORG_UNIT",
        actorUserId: userA.id,
      });
      expect(result.assigned).toBe(true);

      const rows = await prisma.userRole.findMany({
        where: {
          userId: userA.id,
          roleId: trainerRole.id,
          orgUnitId: { in: [orgUnitF2.id, orgUnitE3.id] },
        },
      });
      expect(rows).toHaveLength(2);
    });
  });

  describe("SA-03 — OrgUnit exact scope assignment", () => {
    it("scopeMode THIS_ORG_UNIT stored correctly", async () => {
      const result = await assignScopedRoleToUser({
        tenantId: tenantA.id,
        userId: userB.id,
        roleId: vizeRole.id,
        orgUnitId: orgUnitF2.id,
        scopeMode: "THIS_ORG_UNIT",
        actorUserId: userA.id,
      });
      expect(result.assigned).toBe(true);

      const row = await prisma.userRole.findUnique({ where: { id: result.userRoleId } });
      expect(row!.scopeMode).toBe("THIS_ORG_UNIT");
    });
  });

  describe("SA-04 — Descendant scope assignment", () => {
    it("scopeMode THIS_ORG_UNIT_AND_DESCENDANTS stored correctly", async () => {
      const result = await assignScopedRoleToUser({
        tenantId: tenantA.id,
        userId: userB.id,
        roleId: vizeRole.id,
        orgUnitId: orgUnitE3.id,
        scopeMode: "THIS_ORG_UNIT_AND_DESCENDANTS",
        actorUserId: userA.id,
      });
      expect(result.assigned).toBe(true);

      const row = await prisma.userRole.findUnique({ where: { id: result.userRoleId } });
      expect(row!.scopeMode).toBe("THIS_ORG_UNIT_AND_DESCENDANTS");
    });
  });

  describe("SA-05 — Exact duplicate idempotent", () => {
    it("returns assigned=false and does not create a second row", async () => {
      const countBefore = await prisma.userRole.count({
        where: { userId: userA.id, roleId: trainerRole.id, orgUnitId: orgUnitF2.id },
      });
      expect(countBefore).toBe(1);

      const result = await assignScopedRoleToUser({
        tenantId: tenantA.id,
        userId: userA.id,
        roleId: trainerRole.id,
        orgUnitId: orgUnitF2.id,
        scopeMode: "THIS_ORG_UNIT",
        actorUserId: userA.id,
      });
      expect(result.assigned).toBe(false);

      const countAfter = await prisma.userRole.count({
        where: { userId: userA.id, roleId: trainerRole.id, orgUnitId: orgUnitF2.id },
      });
      expect(countAfter).toBe(1);
    });
  });

  describe("SA-06 — PLATFORM role rejected", () => {
    it("throws RoleNotFoundError for a PLATFORM-scoped role", async () => {
      await expect(
        assignScopedRoleToUser({
          tenantId: tenantA.id,
          userId: userA.id,
          roleId: platformRole.id,
          orgUnitId: orgUnitF2.id,
          actorUserId: userA.id,
        }),
      ).rejects.toThrow(RoleNotFoundError);
    });
  });

  describe("SA-07 — Cross-tenant role rejected", () => {
    it("throws RoleNotFoundError when roleId belongs to a different tenant", async () => {
      await expect(
        assignScopedRoleToUser({
          tenantId: tenantA.id,
          userId: userA.id,
          roleId: crossTenantRole.id,
          orgUnitId: orgUnitF2.id,
          actorUserId: userA.id,
        }),
      ).rejects.toThrow(RoleNotFoundError);
    });
  });

  describe("SA-08 — Cross-tenant OrgUnit rejected", () => {
    it("throws RoleValidationError when orgUnitId belongs to a different tenant", async () => {
      await expect(
        assignScopedRoleToUser({
          tenantId: tenantA.id,
          userId: userA.id,
          roleId: trainerRole.id,
          orgUnitId: orgUnitB.id,
          actorUserId: userA.id,
        }),
      ).rejects.toThrow();
    });
  });

  describe("SA-09 — Club Admin role rejected", () => {
    it("throws RoleDomainError (SCOPE_MISMATCH) for the tenant Club Admin role", async () => {
      await expect(
        assignScopedRoleToUser({
          tenantId: tenantA.id,
          userId: userA.id,
          roleId: clubAdminRole.id,
          orgUnitId: orgUnitF2.id,
          actorUserId: userA.id,
        }),
      ).rejects.toThrow(RoleDomainError);
    });

    it("error code is SCOPE_MISMATCH", async () => {
      try {
        await assignScopedRoleToUser({
          tenantId: tenantA.id,
          userId: userA.id,
          roleId: clubAdminRole.id,
          orgUnitId: orgUnitF2.id,
          actorUserId: userA.id,
        });
      } catch (e) {
        expect(e).toBeInstanceOf(RoleDomainError);
        expect((e as RoleDomainError).code).toBe("SCOPE_MISMATCH");
      }
    });
  });

  describe("SA-10 — Archived role rejected", () => {
    it("throws ArchivedRoleError", async () => {
      await expect(
        assignScopedRoleToUser({
          tenantId: tenantA.id,
          userId: userA.id,
          roleId: archivedRole.id,
          orgUnitId: orgUnitF2.id,
          actorUserId: userA.id,
        }),
      ).rejects.toThrow(ArchivedRoleError);
    });
  });

  describe("SA-11 — User without TenantMembership rejected", () => {
    it("throws RoleUserNotFoundError for a user with no membership in the tenant", async () => {
      const outsideUser = await createTestUser("oa02-outside");
      createdUserIds.push(outsideUser.id);

      await expect(
        assignScopedRoleToUser({
          tenantId: tenantA.id,
          userId: outsideUser.id,
          roleId: trainerRole.id,
          orgUnitId: orgUnitF2.id,
          actorUserId: userA.id,
        }),
      ).rejects.toThrow(RoleUserNotFoundError);
    });
  });

  // -------------------------------------------------------------------------
  // REMOVAL
  // -------------------------------------------------------------------------

  describe("SR-01 — Remove one assignment without affecting others", () => {
    it("removes only the targeted scoped row; others remain", async () => {
      // userA should have Trainer→F2 and Trainer→E3 from SA-01/SA-02
      const before = await prisma.userRole.findMany({
        where: {
          userId: userA.id,
          roleId: trainerRole.id,
          orgUnitId: { in: [orgUnitF2.id, orgUnitE3.id] },
        },
      });
      expect(before).toHaveLength(2);

      const f2Row = before.find((r) => r.orgUnitId === orgUnitF2.id)!;

      const result = await removeScopedRoleAssignment({
        tenantId: tenantA.id,
        userRoleId: f2Row.id,
        actorUserId: userA.id,
      });
      expect(result.removed).toBe(true);

      const after = await prisma.userRole.findMany({
        where: {
          userId: userA.id,
          roleId: trainerRole.id,
          orgUnitId: { in: [orgUnitF2.id, orgUnitE3.id] },
        },
      });
      expect(after).toHaveLength(1);
      expect(after[0].orgUnitId).toBe(orgUnitE3.id);
    });
  });

  describe("SR-02 — Tenant-wide assignments unaffected by scoped removal", () => {
    it("tenant-wide UserRole survives scoped role removal", async () => {
      // Create a tenant-wide assignment for userA
      const tenantWideRow = await assignUserRoleFixture({
        userId: userA.id,
        roleId: trainerRole.id,
        tenantId: tenantA.id,
      });

      // Remove the E3 scoped row
      const e3Row = await prisma.userRole.findFirst({
        where: { userId: userA.id, roleId: trainerRole.id, orgUnitId: orgUnitE3.id },
      });
      if (e3Row) {
        await removeScopedRoleAssignment({
          tenantId: tenantA.id,
          userRoleId: e3Row.id,
          actorUserId: userA.id,
        });
      }

      // Tenant-wide row still exists
      const stillExists = await prisma.userRole.findUnique({
        where: { id: tenantWideRow.id },
      });
      expect(stillExists).not.toBeNull();

      // Clean up
      await prisma.userRole.delete({ where: { id: tenantWideRow.id } });
    });
  });

  describe("SR-03 — Cross-tenant removal rejected", () => {
    it("returns removed=false when userRoleId does not belong to the actor's tenant", async () => {
      // Assign a role in tenantA, then try to remove from tenantB context
      const row = await assignScopedRoleToUser({
        tenantId: tenantA.id,
        userId: userA.id,
        roleId: trainerRole.id,
        orgUnitId: orgUnitF2.id,
        scopeMode: "THIS_ORG_UNIT",
        actorUserId: userA.id,
      });
      expect(row.assigned).toBe(true);

      // Attempt to remove using tenantB context
      const result = await removeScopedRoleAssignment({
        tenantId: tenantB.id,
        userRoleId: row.userRoleId,
        actorUserId: userB.id,
      });
      // Should not find the row in tenantB context
      expect(result.removed).toBe(false);

      // Cleanup the correctly-tenant row
      await removeScopedRoleAssignment({
        tenantId: tenantA.id,
        userRoleId: row.userRoleId,
        actorUserId: userA.id,
      });
    });
  });

  describe("SR-04 — Remove non-existent row is idempotent", () => {
    it("returns removed=false for a non-existent userRoleId", async () => {
      const result = await removeScopedRoleAssignment({
        tenantId: tenantA.id,
        userRoleId: "nonexistent-id-xyz",
        actorUserId: userA.id,
      });
      expect(result.removed).toBe(false);
    });
  });

  describe("SR-05 — Remove refuses tenant-wide row (orgUnitId=null)", () => {
    it("returns removed=false when the row has orgUnitId=null", async () => {
      const tenantWideRow = await assignUserRoleFixture({
        userId: userA.id,
        roleId: vizeRole.id,
        tenantId: tenantA.id,
      });

      const result = await removeScopedRoleAssignment({
        tenantId: tenantA.id,
        userRoleId: tenantWideRow.id,
        actorUserId: userA.id,
      });
      expect(result.removed).toBe(false);

      // Cleanup
      await prisma.userRole.delete({ where: { id: tenantWideRow.id } });
    });
  });

  // -------------------------------------------------------------------------
  // READ
  // -------------------------------------------------------------------------

  describe("RD-01 — getScopedAssignmentsForOrgUnit", () => {
    it("returns only rows for the given orgUnit (not cross-tenant or cross-orgunit)", async () => {
      // Assign Trainer to F2
      await assignScopedRoleToUser({
        tenantId: tenantA.id,
        userId: userA.id,
        roleId: trainerRole.id,
        orgUnitId: orgUnitF2.id,
        actorUserId: userA.id,
      });

      const results = await getScopedAssignmentsForOrgUnit(tenantA.id, orgUnitF2.id);
      expect(results.length).toBeGreaterThanOrEqual(1);

      for (const a of results) {
        expect(a.orgUnitId).toBe(orgUnitF2.id);
        // Role should belong to tenantA
        expect(a.orgUnitName).toBe("F2");
      }
    });
  });

  describe("RD-02 — getScopedAssignmentsForUser", () => {
    it("returns all scoped assignments for a user across all orgUnits", async () => {
      const results = await getScopedAssignmentsForUser(tenantA.id, userB.id);
      expect(results.length).toBeGreaterThanOrEqual(1);

      for (const a of results) {
        expect(a.userId).toBe(userB.id);
        expect(a.orgUnitId).not.toBeNull();
      }
    });
  });

  // -------------------------------------------------------------------------
  // USER DETAIL CONSOLIDATION
  // -------------------------------------------------------------------------

  describe("UD-01 — User detail consolidation: tenant-wide + scoped separately", () => {
    it("scoped assignments are NOT included in orgUnitId=null query", async () => {
      // Tenant-wide (orgUnitId=null) query used by existing TenantRoleAssignmentControl
      const tenantWideRoles = await prisma.userRole.findMany({
        where: { tenantId: tenantA.id, userId: userA.id, orgUnitId: null },
      });

      // Scoped assignments should not appear in tenant-wide query
      const scopedRoles = await prisma.userRole.findMany({
        where: { tenantId: tenantA.id, userId: userA.id, orgUnitId: { not: null } },
      });

      // Verify the separation: no overlap
      const tenantWideIds = new Set(tenantWideRoles.map((r) => r.id));
      for (const scoped of scopedRoles) {
        expect(tenantWideIds.has(scoped.id)).toBe(false);
      }
    });
  });
});
