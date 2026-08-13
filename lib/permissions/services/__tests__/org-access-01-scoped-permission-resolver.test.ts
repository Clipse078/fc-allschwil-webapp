/**
 * ORG-ACCESS-01 — OrgUnit-Scoped Permission Resolver Tests
 *
 * Tests for `OrgUnitPermissionResolver.hasPermissionInOrgUnit`.
 * Uses mock Prisma (vi.fn()) for unit-level isolation — no live DB.
 *
 * Covers:
 *
 * GRANTS
 *   OA-G-01  Tenant-wide assignment (orgUnitId=null) → YES for any OrgUnit
 *   OA-G-02  THIS_ORG_UNIT on F2 → YES for exact F2
 *   OA-G-03  THIS_ORG_UNIT on F2 → NO for child of F2
 *   OA-G-04  THIS_ORG_UNIT on F2 → NO for sibling
 *   OA-G-05  THIS_ORG_UNIT_AND_DESCENDANTS on F2 → YES for exact F2
 *   OA-G-06  THIS_ORG_UNIT_AND_DESCENDANTS on parent → YES for child
 *   OA-G-07  THIS_ORG_UNIT_AND_DESCENDANTS on grandparent → YES for grandchild
 *   OA-G-08  THIS_ORG_UNIT_AND_DESCENDANTS on F2 → NO for unrelated sibling F3
 *   OA-G-09  Same role on F2 + E3 — user holds BOTH (multiple assignments)
 *
 * MEMBERSHIP/ROLE VALIDITY
 *   OA-V-01  Inactive TenantMembership → denied
 *   OA-V-02  Archived tenant → denied
 *   OA-V-03  Inactive tenant (INACTIVE status) → denied
 *   OA-V-04  Archived role → excluded from grant
 *
 * TENANT ISOLATION
 *   OA-T-01  Cross-tenant OrgUnit → denied
 *   OA-T-02  OrgUnit in correct tenant → allowed
 *
 * PLATFORM SCOPE
 *   OA-P-01  PLATFORM role never satisfies OrgUnit-scoped tenant check
 *
 * BACKWARD COMPATIBILITY
 *   OA-BC-01 Tenant-wide resolver (hasPermission) still works after schema change:
 *            only orgUnitId=null rows are considered
 *   OA-BC-02 Scoped assignment does NOT leak into tenant-wide hasPermission check
 *
 * EDGE CASES
 *   OA-E-01  Missing userId → denied
 *   OA-E-02  Missing orgUnitId → denied
 *   OA-E-03  Unknown OrgUnit → denied
 *   OA-E-04  Multiple assignments — any match → YES (union semantics)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { PrismaClient } from "@prisma/client";
import {
  OrgUnitPermissionResolver,
  createOrgUnitPermissionResolver,
} from "../org-unit-permission-resolver";
import { EffectivePermissionResolver } from "../effective-permission-resolver";

// ---------------------------------------------------------------------------
// Mock Prisma helpers
// ---------------------------------------------------------------------------

type MockFn = ReturnType<typeof vi.fn>;

interface MockPrisma {
  userRole: { findMany: MockFn };
  tenantMembership: { findUnique: MockFn };
  orgUnit: { findUnique: MockFn };
}

function makeMockPrisma(overrides: {
  userRoleFindMany?: MockFn;
  tenantMembershipFindUnique?: MockFn;
  orgUnitFindUnique?: MockFn;
}): PrismaClient {
  return {
    userRole: {
      findMany: overrides.userRoleFindMany ?? vi.fn().mockResolvedValue([]),
    },
    tenantMembership: {
      findUnique:
        overrides.tenantMembershipFindUnique ?? vi.fn().mockResolvedValue(null),
    },
    orgUnit: {
      findUnique: overrides.orgUnitFindUnique ?? vi.fn().mockResolvedValue(null),
    },
  } as unknown as PrismaClient;
}

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

function activeMembership(tenantStatus: "ACTIVE" | "INACTIVE" | "ARCHIVED" = "ACTIVE") {
  return { isActive: true, tenant: { status: tenantStatus } };
}

function inactiveMembership() {
  return { isActive: false, tenant: { status: "ACTIVE" as const } };
}

/** UserRole row with the requested permission (for findMany mock). */
function makeUserRoleWithPerm(opts: {
  orgUnitId: string | null;
  scopeMode: "THIS_ORG_UNIT" | "THIS_ORG_UNIT_AND_DESCENDANTS" | null;
  permissionKey: string;
}) {
  return {
    orgUnitId: opts.orgUnitId,
    scopeMode: opts.scopeMode,
    role: {
      rolePermissions: [
        { permission: { key: opts.permissionKey, scope: "TENANT" } },
      ],
    },
  };
}

/** OrgUnit row for findUnique (ancestor chain). */
function makeOrgUnit(id: string, tenantId: string, parentChain: string[] = []) {
  // parentChain[0] = direct parent id, parentChain[1] = grandparent id
  const parent = parentChain[0]
    ? {
        id: parentChain[0],
        parentId: parentChain[1] ?? null,
        parent: parentChain[1]
          ? { id: parentChain[1], parentId: null }
          : null,
      }
    : null;

  return {
    id,
    tenantId,
    parentId: parent?.id ?? null,
    parent,
  };
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const USER_ID = "user-1";
const TENANT_ID = "tenant-1";
const PERM = "trainings.manage";

const F2 = "org-f2";
const F2_U10 = "org-f2-u10";
const F2_U10_A = "org-f2-u10-a";
const F3 = "org-f3";
const E3 = "org-e3";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("OrgUnitPermissionResolver.hasPermissionInOrgUnit", () => {
  // ── GRANTS ─────────────────────────────────────────────────────────────────

  describe("GRANTS", () => {
    it("OA-G-01: tenant-wide assignment (orgUnitId=null) grants access for any OrgUnit", async () => {
      const prisma = makeMockPrisma({
        tenantMembershipFindUnique: vi.fn().mockResolvedValue(activeMembership()),
        userRoleFindMany: vi.fn().mockResolvedValue([
          makeUserRoleWithPerm({ orgUnitId: null, scopeMode: null, permissionKey: PERM }),
        ]),
        orgUnitFindUnique: vi.fn().mockResolvedValue(makeOrgUnit(F2, TENANT_ID)),
      });

      const resolver = new OrgUnitPermissionResolver(prisma);
      // Tenant-wide: should be YES for any orgUnitId — no ancestor lookup needed
      await expect(
        resolver.hasPermissionInOrgUnit({ userId: USER_ID, permission: PERM, tenantId: TENANT_ID, orgUnitId: F2 }),
      ).resolves.toBe(true);
      await expect(
        resolver.hasPermissionInOrgUnit({ userId: USER_ID, permission: PERM, tenantId: TENANT_ID, orgUnitId: F3 }),
      ).resolves.toBe(true);
    });

    it("OA-G-02: THIS_ORG_UNIT on F2 → YES for exact F2", async () => {
      const prisma = makeMockPrisma({
        tenantMembershipFindUnique: vi.fn().mockResolvedValue(activeMembership()),
        userRoleFindMany: vi.fn().mockResolvedValue([
          makeUserRoleWithPerm({ orgUnitId: F2, scopeMode: "THIS_ORG_UNIT", permissionKey: PERM }),
        ]),
        orgUnitFindUnique: vi.fn().mockResolvedValue(makeOrgUnit(F2, TENANT_ID)),
      });

      const resolver = new OrgUnitPermissionResolver(prisma);
      await expect(
        resolver.hasPermissionInOrgUnit({ userId: USER_ID, permission: PERM, tenantId: TENANT_ID, orgUnitId: F2 }),
      ).resolves.toBe(true);
    });

    it("OA-G-03: THIS_ORG_UNIT on F2 → NO for child F2/U10", async () => {
      const prisma = makeMockPrisma({
        tenantMembershipFindUnique: vi.fn().mockResolvedValue(activeMembership()),
        userRoleFindMany: vi.fn().mockResolvedValue([
          makeUserRoleWithPerm({ orgUnitId: F2, scopeMode: "THIS_ORG_UNIT", permissionKey: PERM }),
        ]),
        orgUnitFindUnique: vi.fn().mockResolvedValue(makeOrgUnit(F2_U10, TENANT_ID, [F2])),
      });

      const resolver = new OrgUnitPermissionResolver(prisma);
      await expect(
        resolver.hasPermissionInOrgUnit({ userId: USER_ID, permission: PERM, tenantId: TENANT_ID, orgUnitId: F2_U10 }),
      ).resolves.toBe(false);
    });

    it("OA-G-04: THIS_ORG_UNIT on F2 → NO for unrelated sibling F3", async () => {
      const prisma = makeMockPrisma({
        tenantMembershipFindUnique: vi.fn().mockResolvedValue(activeMembership()),
        userRoleFindMany: vi.fn().mockResolvedValue([
          makeUserRoleWithPerm({ orgUnitId: F2, scopeMode: "THIS_ORG_UNIT", permissionKey: PERM }),
        ]),
        orgUnitFindUnique: vi.fn().mockResolvedValue(makeOrgUnit(F3, TENANT_ID)),
      });

      const resolver = new OrgUnitPermissionResolver(prisma);
      await expect(
        resolver.hasPermissionInOrgUnit({ userId: USER_ID, permission: PERM, tenantId: TENANT_ID, orgUnitId: F3 }),
      ).resolves.toBe(false);
    });

    it("OA-G-05: THIS_ORG_UNIT_AND_DESCENDANTS on F2 → YES for exact F2", async () => {
      const prisma = makeMockPrisma({
        tenantMembershipFindUnique: vi.fn().mockResolvedValue(activeMembership()),
        userRoleFindMany: vi.fn().mockResolvedValue([
          makeUserRoleWithPerm({
            orgUnitId: F2,
            scopeMode: "THIS_ORG_UNIT_AND_DESCENDANTS",
            permissionKey: PERM,
          }),
        ]),
        // Target IS F2, ancestor chain contains only F2 (no parent)
        orgUnitFindUnique: vi.fn().mockResolvedValue(makeOrgUnit(F2, TENANT_ID)),
      });

      const resolver = new OrgUnitPermissionResolver(prisma);
      await expect(
        resolver.hasPermissionInOrgUnit({ userId: USER_ID, permission: PERM, tenantId: TENANT_ID, orgUnitId: F2 }),
      ).resolves.toBe(true);
    });

    it("OA-G-06: THIS_ORG_UNIT_AND_DESCENDANTS on F2 → YES for child F2/U10", async () => {
      const prisma = makeMockPrisma({
        tenantMembershipFindUnique: vi.fn().mockResolvedValue(activeMembership()),
        userRoleFindMany: vi.fn().mockResolvedValue([
          makeUserRoleWithPerm({
            orgUnitId: F2,
            scopeMode: "THIS_ORG_UNIT_AND_DESCENDANTS",
            permissionKey: PERM,
          }),
        ]),
        // Target = F2_U10, parent = F2
        orgUnitFindUnique: vi.fn().mockResolvedValue(makeOrgUnit(F2_U10, TENANT_ID, [F2])),
      });

      const resolver = new OrgUnitPermissionResolver(prisma);
      await expect(
        resolver.hasPermissionInOrgUnit({ userId: USER_ID, permission: PERM, tenantId: TENANT_ID, orgUnitId: F2_U10 }),
      ).resolves.toBe(true);
    });

    it("OA-G-07: THIS_ORG_UNIT_AND_DESCENDANTS on F2 → YES for grandchild F2/U10/A", async () => {
      const prisma = makeMockPrisma({
        tenantMembershipFindUnique: vi.fn().mockResolvedValue(activeMembership()),
        userRoleFindMany: vi.fn().mockResolvedValue([
          makeUserRoleWithPerm({
            orgUnitId: F2,
            scopeMode: "THIS_ORG_UNIT_AND_DESCENDANTS",
            permissionKey: PERM,
          }),
        ]),
        // Target = F2_U10_A, parent = F2_U10, grandparent = F2
        orgUnitFindUnique: vi
          .fn()
          .mockResolvedValue(makeOrgUnit(F2_U10_A, TENANT_ID, [F2_U10, F2])),
      });

      const resolver = new OrgUnitPermissionResolver(prisma);
      await expect(
        resolver.hasPermissionInOrgUnit({ userId: USER_ID, permission: PERM, tenantId: TENANT_ID, orgUnitId: F2_U10_A }),
      ).resolves.toBe(true);
    });

    it("OA-G-08: THIS_ORG_UNIT_AND_DESCENDANTS on F2 → NO for unrelated sibling F3", async () => {
      const prisma = makeMockPrisma({
        tenantMembershipFindUnique: vi.fn().mockResolvedValue(activeMembership()),
        userRoleFindMany: vi.fn().mockResolvedValue([
          makeUserRoleWithPerm({
            orgUnitId: F2,
            scopeMode: "THIS_ORG_UNIT_AND_DESCENDANTS",
            permissionKey: PERM,
          }),
        ]),
        // Target = F3, no ancestors related to F2
        orgUnitFindUnique: vi.fn().mockResolvedValue(makeOrgUnit(F3, TENANT_ID)),
      });

      const resolver = new OrgUnitPermissionResolver(prisma);
      await expect(
        resolver.hasPermissionInOrgUnit({ userId: USER_ID, permission: PERM, tenantId: TENANT_ID, orgUnitId: F3 }),
      ).resolves.toBe(false);
    });

    it("OA-G-09: same role can exist on F2 AND E3 (multiple assignments, both allow)", async () => {
      // User has SAME role assigned to both F2 and E3 with THIS_ORG_UNIT
      const prisma = makeMockPrisma({
        tenantMembershipFindUnique: vi.fn().mockResolvedValue(activeMembership()),
        userRoleFindMany: vi.fn().mockResolvedValue([
          makeUserRoleWithPerm({ orgUnitId: F2, scopeMode: "THIS_ORG_UNIT", permissionKey: PERM }),
          makeUserRoleWithPerm({ orgUnitId: E3, scopeMode: "THIS_ORG_UNIT", permissionKey: PERM }),
        ]),
        orgUnitFindUnique: vi.fn().mockImplementation((args: { where: { id: string } }) => {
          const id = args.where.id;
          if (id === F2) return Promise.resolve(makeOrgUnit(F2, TENANT_ID));
          if (id === E3) return Promise.resolve(makeOrgUnit(E3, TENANT_ID));
          return Promise.resolve(null);
        }),
      });

      const resolver = new OrgUnitPermissionResolver(prisma);
      // Both should be YES
      await expect(
        resolver.hasPermissionInOrgUnit({ userId: USER_ID, permission: PERM, tenantId: TENANT_ID, orgUnitId: F2 }),
      ).resolves.toBe(true);
      await expect(
        resolver.hasPermissionInOrgUnit({ userId: USER_ID, permission: PERM, tenantId: TENANT_ID, orgUnitId: E3 }),
      ).resolves.toBe(true);
      // Unrelated sibling → NO
      await expect(
        resolver.hasPermissionInOrgUnit({ userId: USER_ID, permission: PERM, tenantId: TENANT_ID, orgUnitId: F3 }),
      ).resolves.toBe(false);
    });
  });

  // ── MEMBERSHIP / ROLE VALIDITY ─────────────────────────────────────────────

  describe("MEMBERSHIP / ROLE VALIDITY", () => {
    it("OA-V-01: inactive TenantMembership → denied", async () => {
      const prisma = makeMockPrisma({
        tenantMembershipFindUnique: vi.fn().mockResolvedValue(inactiveMembership()),
        userRoleFindMany: vi.fn().mockResolvedValue([
          makeUserRoleWithPerm({ orgUnitId: null, scopeMode: null, permissionKey: PERM }),
        ]),
      });

      const resolver = new OrgUnitPermissionResolver(prisma);
      await expect(
        resolver.hasPermissionInOrgUnit({ userId: USER_ID, permission: PERM, tenantId: TENANT_ID, orgUnitId: F2 }),
      ).resolves.toBe(false);
    });

    it("OA-V-02: ARCHIVED tenant → denied even with active membership", async () => {
      const prisma = makeMockPrisma({
        tenantMembershipFindUnique: vi.fn().mockResolvedValue(activeMembership("ARCHIVED")),
        userRoleFindMany: vi.fn().mockResolvedValue([
          makeUserRoleWithPerm({ orgUnitId: null, scopeMode: null, permissionKey: PERM }),
        ]),
      });

      const resolver = new OrgUnitPermissionResolver(prisma);
      await expect(
        resolver.hasPermissionInOrgUnit({ userId: USER_ID, permission: PERM, tenantId: TENANT_ID, orgUnitId: F2 }),
      ).resolves.toBe(false);
    });

    it("OA-V-03: INACTIVE tenant → denied", async () => {
      const prisma = makeMockPrisma({
        tenantMembershipFindUnique: vi.fn().mockResolvedValue(activeMembership("INACTIVE")),
        userRoleFindMany: vi.fn().mockResolvedValue([
          makeUserRoleWithPerm({ orgUnitId: null, scopeMode: null, permissionKey: PERM }),
        ]),
      });

      const resolver = new OrgUnitPermissionResolver(prisma);
      await expect(
        resolver.hasPermissionInOrgUnit({ userId: USER_ID, permission: PERM, tenantId: TENANT_ID, orgUnitId: F2 }),
      ).resolves.toBe(false);
    });

    it("OA-V-04: archived role is excluded (no grant from archived role)", async () => {
      // The archived role filter is enforced by the Prisma query (isArchived: false in role filter).
      // Simulated here by returning empty userRoles (as if archived roles were filtered out).
      const prisma = makeMockPrisma({
        tenantMembershipFindUnique: vi.fn().mockResolvedValue(activeMembership()),
        userRoleFindMany: vi.fn().mockResolvedValue([]), // filtered out by isArchived: false
        orgUnitFindUnique: vi.fn().mockResolvedValue(makeOrgUnit(F2, TENANT_ID)),
      });

      const resolver = new OrgUnitPermissionResolver(prisma);
      await expect(
        resolver.hasPermissionInOrgUnit({ userId: USER_ID, permission: PERM, tenantId: TENANT_ID, orgUnitId: F2 }),
      ).resolves.toBe(false);
    });
  });

  // ── TENANT ISOLATION ────────────────────────────────────────────────────────

  describe("TENANT ISOLATION", () => {
    it("OA-T-01: cross-tenant OrgUnit → denied (OrgUnit belongs to a different tenant)", async () => {
      const OTHER_TENANT = "other-tenant-99";
      const prisma = makeMockPrisma({
        tenantMembershipFindUnique: vi.fn().mockResolvedValue(activeMembership()),
        userRoleFindMany: vi.fn().mockResolvedValue([
          makeUserRoleWithPerm({
            orgUnitId: F2,
            scopeMode: "THIS_ORG_UNIT_AND_DESCENDANTS",
            permissionKey: PERM,
          }),
        ]),
        // OrgUnit belongs to OTHER_TENANT, not TENANT_ID
        orgUnitFindUnique: vi.fn().mockResolvedValue(makeOrgUnit(F2_U10, OTHER_TENANT, [F2])),
      });

      const resolver = new OrgUnitPermissionResolver(prisma);
      await expect(
        resolver.hasPermissionInOrgUnit({ userId: USER_ID, permission: PERM, tenantId: TENANT_ID, orgUnitId: F2_U10 }),
      ).resolves.toBe(false);
    });

    it("OA-T-02: OrgUnit in the correct tenant → granted normally", async () => {
      const prisma = makeMockPrisma({
        tenantMembershipFindUnique: vi.fn().mockResolvedValue(activeMembership()),
        userRoleFindMany: vi.fn().mockResolvedValue([
          makeUserRoleWithPerm({
            orgUnitId: F2,
            scopeMode: "THIS_ORG_UNIT_AND_DESCENDANTS",
            permissionKey: PERM,
          }),
        ]),
        orgUnitFindUnique: vi.fn().mockResolvedValue(makeOrgUnit(F2_U10, TENANT_ID, [F2])),
      });

      const resolver = new OrgUnitPermissionResolver(prisma);
      await expect(
        resolver.hasPermissionInOrgUnit({ userId: USER_ID, permission: PERM, tenantId: TENANT_ID, orgUnitId: F2_U10 }),
      ).resolves.toBe(true);
    });
  });

  // ── PLATFORM SCOPE ──────────────────────────────────────────────────────────

  describe("PLATFORM SCOPE", () => {
    it("OA-P-01: PLATFORM roles never satisfy OrgUnit-scoped tenant checks", async () => {
      // The role filter enforces scope=TENANT; platform roles return no rows.
      const prisma = makeMockPrisma({
        tenantMembershipFindUnique: vi.fn().mockResolvedValue(activeMembership()),
        // findMany returns empty — PLATFORM roles filtered out by scope=TENANT
        userRoleFindMany: vi.fn().mockResolvedValue([]),
        orgUnitFindUnique: vi.fn().mockResolvedValue(makeOrgUnit(F2, TENANT_ID)),
      });

      const resolver = new OrgUnitPermissionResolver(prisma);
      await expect(
        resolver.hasPermissionInOrgUnit({ userId: USER_ID, permission: PERM, tenantId: TENANT_ID, orgUnitId: F2 }),
      ).resolves.toBe(false);
    });
  });

  // ── BACKWARD COMPATIBILITY ──────────────────────────────────────────────────

  describe("BACKWARD COMPATIBILITY — existing hasPermission unaffected", () => {
    it("OA-BC-01: EffectivePermissionResolver.hasPermission uses only orgUnitId=null rows (tenant-wide)", async () => {
      // The effective-permission-resolver filters orgUnitId: null.
      // We verify the query shape includes that filter by checking the mock.
      const userRoleFindMany = vi.fn().mockResolvedValue([]);
      const tenantMembershipFindUnique = vi.fn().mockResolvedValue(activeMembership());

      const prisma = {
        userRole: { findMany: userRoleFindMany },
        tenantMembership: { findUnique: tenantMembershipFindUnique },
      } as unknown as PrismaClient;

      const resolver = new EffectivePermissionResolver(prisma);
      await resolver.hasPermission({ userId: USER_ID, permission: PERM, tenantId: TENANT_ID });

      // Assert the tenant userRole query includes orgUnitId: null
      expect(userRoleFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            orgUnitId: null,
          }),
        }),
      );
    });

    it("OA-BC-02: scoped assignment does NOT grant tenant-wide hasPermission", async () => {
      // Only a scoped assignment exists (orgUnitId=F2); tenant-wide check should deny.
      const userRoleFindMany = vi.fn().mockResolvedValue([]); // filtered out by orgUnitId: null
      const tenantMembershipFindUnique = vi.fn().mockResolvedValue(activeMembership());

      const prisma = {
        userRole: { findMany: userRoleFindMany },
        tenantMembership: { findUnique: tenantMembershipFindUnique },
      } as unknown as PrismaClient;

      const resolver = new EffectivePermissionResolver(prisma);
      const result = await resolver.hasPermission({
        userId: USER_ID,
        permission: PERM,
        tenantId: TENANT_ID,
      });
      expect(result).toBe(false);
    });
  });

  // ── EDGE CASES ──────────────────────────────────────────────────────────────

  describe("EDGE CASES", () => {
    it("OA-E-01: missing userId → denied immediately", async () => {
      const prisma = makeMockPrisma({});
      const resolver = new OrgUnitPermissionResolver(prisma);
      await expect(
        resolver.hasPermissionInOrgUnit({ userId: "", permission: PERM, tenantId: TENANT_ID, orgUnitId: F2 }),
      ).resolves.toBe(false);
    });

    it("OA-E-02: missing orgUnitId → denied immediately", async () => {
      const prisma = makeMockPrisma({});
      const resolver = new OrgUnitPermissionResolver(prisma);
      await expect(
        resolver.hasPermissionInOrgUnit({ userId: USER_ID, permission: PERM, tenantId: TENANT_ID, orgUnitId: "" }),
      ).resolves.toBe(false);
    });

    it("OA-E-03: OrgUnit not found in DB → denied", async () => {
      const prisma = makeMockPrisma({
        tenantMembershipFindUnique: vi.fn().mockResolvedValue(activeMembership()),
        userRoleFindMany: vi.fn().mockResolvedValue([
          makeUserRoleWithPerm({
            orgUnitId: F2,
            scopeMode: "THIS_ORG_UNIT_AND_DESCENDANTS",
            permissionKey: PERM,
          }),
        ]),
        orgUnitFindUnique: vi.fn().mockResolvedValue(null), // not found
      });

      const resolver = new OrgUnitPermissionResolver(prisma);
      await expect(
        resolver.hasPermissionInOrgUnit({ userId: USER_ID, permission: PERM, tenantId: TENANT_ID, orgUnitId: "nonexistent" }),
      ).resolves.toBe(false);
    });

    it("OA-E-04: multiple assignments — union semantics (any match → YES)", async () => {
      // User has THIS_ORG_UNIT on F2 AND THIS_ORG_UNIT_AND_DESCENDANTS on E3.
      // Checking F2/U10 (child of F2, which is THIS_ORG_UNIT — NO) and
      // E3/sub (child of E3 — YES via descendants).
      const E3_SUB = "org-e3-sub";
      const prisma = makeMockPrisma({
        tenantMembershipFindUnique: vi.fn().mockResolvedValue(activeMembership()),
        userRoleFindMany: vi.fn().mockResolvedValue([
          makeUserRoleWithPerm({ orgUnitId: F2, scopeMode: "THIS_ORG_UNIT", permissionKey: PERM }),
          makeUserRoleWithPerm({
            orgUnitId: E3,
            scopeMode: "THIS_ORG_UNIT_AND_DESCENDANTS",
            permissionKey: PERM,
          }),
        ]),
        orgUnitFindUnique: vi.fn().mockImplementation((args: { where: { id: string } }) => {
          const id = args.where.id;
          if (id === F2_U10) return Promise.resolve(makeOrgUnit(F2_U10, TENANT_ID, [F2]));
          if (id === E3_SUB) return Promise.resolve(makeOrgUnit(E3_SUB, TENANT_ID, [E3]));
          return Promise.resolve(null);
        }),
      });

      const resolver = new OrgUnitPermissionResolver(prisma);

      // F2_U10 is child of F2 — THIS_ORG_UNIT on F2 does NOT cover child → NO
      await expect(
        resolver.hasPermissionInOrgUnit({ userId: USER_ID, permission: PERM, tenantId: TENANT_ID, orgUnitId: F2_U10 }),
      ).resolves.toBe(false);

      // E3_SUB is child of E3 — THIS_ORG_UNIT_AND_DESCENDANTS on E3 DOES cover it → YES
      await expect(
        resolver.hasPermissionInOrgUnit({ userId: USER_ID, permission: PERM, tenantId: TENANT_ID, orgUnitId: E3_SUB }),
      ).resolves.toBe(true);
    });
  });

  // ── FACTORY ─────────────────────────────────────────────────────────────────

  describe("factory", () => {
    it("createOrgUnitPermissionResolver returns an OrgUnitPermissionResolver instance", () => {
      const prisma = makeMockPrisma({});
      const resolver = createOrgUnitPermissionResolver(prisma);
      expect(resolver).toBeInstanceOf(OrgUnitPermissionResolver);
    });
  });
});
