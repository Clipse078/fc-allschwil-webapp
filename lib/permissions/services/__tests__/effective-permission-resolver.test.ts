/**
 * RPERM-03 — Effective Permission Resolver Tests
 *
 * Covers:
 *
 * BASIC GRANTS
 *   G-01  Platform role → platform permission granted
 *   G-02  Tenant role → tenant permission granted for correct tenant
 *   G-03  Multiple roles → union of permissions
 *   G-04  Duplicate permissions are deduplicated
 *
 * BASIC DENIALS
 *   D-01  User without any role → denied
 *   D-02  Role lacks the requested permission → denied
 *   D-03  Unknown permission key → denied
 *   D-04  Missing user ID → denied
 *
 * TENANT ISOLATION
 *   T-01  Tenant A membership grants access in Tenant A
 *   T-02  Tenant A membership does NOT grant access in Tenant B
 *   T-03  Two tenants may have similar role names without cross-tenant grants
 *   T-04  Tenant permission check without tenantId → denied
 *
 * SCOPE ISOLATION
 *   S-01  Tenant role does NOT grant platform permission
 *   S-02  Platform role does NOT grant tenant operational permission
 *   S-03  Tenant-scoped permission attached via wrong role scope → denied
 *   S-04  Platform-scoped permission attached via wrong role scope → denied
 *
 * MEMBERSHIP VALIDITY
 *   V-01  Inactive TenantMembership → denied
 *   V-02  Archived role → denied
 *   V-03  Missing TenantMembership → denied (no row in DB)
 *
 * TENANT OPERATIONAL STATUS (RPERM-04-C1)
 *   TS-01 Active membership + ACTIVE tenant → granted
 *   TS-02 Active membership + ARCHIVED tenant → denied
 *   TS-03 Active membership + INACTIVE tenant → denied
 *   TS-04 Inactive membership + ACTIVE tenant → denied (membership gate still applies)
 *   TS-05 Archived-tenant denial short-circuits before the UserRole query
 *
 * AGGREGATE METHODS
 *   A-01  hasAnyPermission: true when at least one permission granted
 *   A-02  hasAnyPermission: false when none granted
 *   A-03  hasAllPermissions: true only when every permission granted
 *   A-04  hasAllPermissions: false when one is missing
 *   A-05  hasAnyPermission([]) → false
 *   A-06  hasAllPermissions([]) → true
 *
 * EFFECTIVE PERMISSION LISTING
 *   L-01  getEffectivePermissions returns only valid platform permissions
 *   L-02  getEffectivePermissions returns both platform and tenant permissions
 *   L-03  getEffectivePermissions returns empty sets for unknown user
 *   L-04  getEffectivePermissions without tenantId returns only platform
 *   L-05  getEffectivePermissions deduplicates across multiple roles
 *
 * QUERY SAFETY
 *   Q-01  Tenant permission query filters by tenantId at DB level
 *   Q-02  Platform permission query uses tenantId=null at DB level
 *   Q-03  Resolver fails closed when no authorization path found
 *   Q-04  Resolver does not expose memberships from unrelated tenants
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { PrismaClient } from "@prisma/client";
import {
  EffectivePermissionResolver,
  createEffectivePermissionResolver,
} from "../effective-permission-resolver";

// ---------------------------------------------------------------------------
// Mock Prisma helpers
// ---------------------------------------------------------------------------

type UserRoleFindManyMock = ReturnType<typeof vi.fn>;
type TenantMembershipFindUniqueMock = ReturnType<typeof vi.fn>;

interface MockPrismaOverrides {
  userRoleFindMany?: UserRoleFindManyMock;
  tenantMembershipFindUnique?: TenantMembershipFindUniqueMock;
}

function makeMockPrisma(overrides: MockPrismaOverrides = {}): PrismaClient {
  return {
    userRole: {
      findMany: overrides.userRoleFindMany ?? vi.fn().mockResolvedValue([]),
    },
    tenantMembership: {
      findUnique:
        overrides.tenantMembershipFindUnique ?? vi.fn().mockResolvedValue(null),
    },
  } as unknown as PrismaClient;
}

// ---------------------------------------------------------------------------
// Fixture builders
// ---------------------------------------------------------------------------

/** Produces a synthetic UserRole row as returned by the Prisma select shape. */
function makeUserRoleRow(opts: {
  roleScope: "PLATFORM" | "TENANT";
  roleIsArchived?: boolean;
  permissions: Array<{ key: string; scope: "PLATFORM" | "TENANT" }>;
}) {
  return {
    role: {
      rolePermissions: opts.permissions.map((p) => ({
        permission: { key: p.key, scope: p.scope },
      })),
    },
  };
}

/**
 * Active tenant membership fixture, linked to an operationally ACTIVE
 * tenant by default (RPERM-04-C1: the resolver now selects the related
 * Tenant.status alongside TenantMembership.isActive).
 */
function activeMembership(tenantStatus: "ACTIVE" | "INACTIVE" | "ARCHIVED" = "ACTIVE") {
  return { isActive: true, tenant: { status: tenantStatus } };
}

/** Inactive tenant membership fixture. */
function inactiveMembership(tenantStatus: "ACTIVE" | "INACTIVE" | "ARCHIVED" = "ACTIVE") {
  return { isActive: false, tenant: { status: tenantStatus } };
}

// ---------------------------------------------------------------------------
// Convenience constants
// ---------------------------------------------------------------------------

const USER_A = "user-a-id";
const TENANT_A = "tenant-a-id";
const TENANT_B = "tenant-b-id";

const PERM_USERS_MANAGE = "users.manage";  // PLATFORM scope
const PERM_TENANTS_VIEW = "tenants.view";  // PLATFORM scope
const PERM_TEAMS_VIEW = "teams.view";      // TENANT scope
const PERM_UNKNOWN = "does.not.exist";     // never in DB

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("EffectivePermissionResolver", () => {
  let userRoleFindMany: UserRoleFindManyMock;
  let tenantMembershipFindUnique: TenantMembershipFindUniqueMock;
  let resolver: EffectivePermissionResolver;

  beforeEach(() => {
    userRoleFindMany = vi.fn().mockResolvedValue([]);
    tenantMembershipFindUnique = vi.fn().mockResolvedValue(null);
    const prisma = makeMockPrisma({ userRoleFindMany, tenantMembershipFindUnique });
    resolver = new EffectivePermissionResolver(prisma);
  });

  // ── BASIC GRANTS ──────────────────────────────────────────────────────────

  describe("G-01: platform role grants platform permission", () => {
    it("returns true when user has platform role with matching platform permission", async () => {
      userRoleFindMany.mockResolvedValue([
        makeUserRoleRow({
          roleScope: "PLATFORM",
          permissions: [{ key: PERM_USERS_MANAGE, scope: "PLATFORM" }],
        }),
      ]);

      const result = await resolver.hasPermission({
        userId: USER_A,
        permission: PERM_USERS_MANAGE,
      });

      expect(result).toBe(true);
    });
  });

  describe("G-02: tenant role grants tenant permission for correct tenant", () => {
    it("returns true when user has active membership and tenant role with matching permission", async () => {
      tenantMembershipFindUnique.mockResolvedValue(activeMembership());
      userRoleFindMany.mockResolvedValue([
        makeUserRoleRow({
          roleScope: "TENANT",
          permissions: [{ key: PERM_TEAMS_VIEW, scope: "TENANT" }],
        }),
      ]);

      const result = await resolver.hasPermission({
        userId: USER_A,
        permission: PERM_TEAMS_VIEW,
        tenantId: TENANT_A,
      });

      expect(result).toBe(true);
    });
  });

  describe("G-03: multiple roles — union of permissions", () => {
    it("grants permissions from all assigned roles", async () => {
      userRoleFindMany.mockResolvedValue([
        makeUserRoleRow({
          roleScope: "PLATFORM",
          permissions: [{ key: PERM_USERS_MANAGE, scope: "PLATFORM" }],
        }),
        makeUserRoleRow({
          roleScope: "PLATFORM",
          permissions: [{ key: PERM_TENANTS_VIEW, scope: "PLATFORM" }],
        }),
      ]);

      const [canManageUsers, canViewTenants] = await Promise.all([
        resolver.hasPermission({ userId: USER_A, permission: PERM_USERS_MANAGE }),
        resolver.hasPermission({ userId: USER_A, permission: PERM_TENANTS_VIEW }),
      ]);

      expect(canManageUsers).toBe(true);
      expect(canViewTenants).toBe(true);
    });
  });

  describe("G-04: duplicate permissions are deduplicated", () => {
    it("getEffectivePermissions contains each key only once even if two roles share it", async () => {
      userRoleFindMany.mockResolvedValue([
        makeUserRoleRow({
          roleScope: "PLATFORM",
          permissions: [
            { key: PERM_USERS_MANAGE, scope: "PLATFORM" },
            { key: PERM_TENANTS_VIEW, scope: "PLATFORM" },
          ],
        }),
        makeUserRoleRow({
          roleScope: "PLATFORM",
          permissions: [
            { key: PERM_USERS_MANAGE, scope: "PLATFORM" }, // duplicate
          ],
        }),
      ]);

      const result = await resolver.getEffectivePermissions({ userId: USER_A });
      const usersManageCount = result.platform.filter(
        (k) => k === PERM_USERS_MANAGE,
      ).length;

      expect(usersManageCount).toBe(1);
    });
  });

  // ── BASIC DENIALS ────────────────────────────────────────────────────────

  describe("D-01: user without any role → denied", () => {
    it("returns false when no UserRole rows exist", async () => {
      userRoleFindMany.mockResolvedValue([]);

      const result = await resolver.hasPermission({
        userId: USER_A,
        permission: PERM_USERS_MANAGE,
      });

      expect(result).toBe(false);
    });
  });

  describe("D-02: role lacks the requested permission → denied", () => {
    it("returns false when role exists but does not include the permission", async () => {
      userRoleFindMany.mockResolvedValue([
        makeUserRoleRow({
          roleScope: "PLATFORM",
          permissions: [{ key: PERM_TENANTS_VIEW, scope: "PLATFORM" }],
        }),
      ]);

      const result = await resolver.hasPermission({
        userId: USER_A,
        permission: PERM_USERS_MANAGE,
      });

      expect(result).toBe(false);
    });
  });

  describe("D-03: unknown permission key → denied", () => {
    it("returns false for a permission key that does not exist in any role", async () => {
      userRoleFindMany.mockResolvedValue([
        makeUserRoleRow({
          roleScope: "PLATFORM",
          permissions: [{ key: PERM_USERS_MANAGE, scope: "PLATFORM" }],
        }),
      ]);

      const result = await resolver.hasPermission({
        userId: USER_A,
        permission: PERM_UNKNOWN,
      });

      expect(result).toBe(false);
    });
  });

  describe("D-04: missing user ID → denied", () => {
    it("returns false when userId is empty string", async () => {
      const result = await resolver.hasPermission({
        userId: "",
        permission: PERM_USERS_MANAGE,
      });

      expect(result).toBe(false);
      // DB must not be queried
      expect(userRoleFindMany).not.toHaveBeenCalled();
    });

    it("getEffectivePermissions returns empty result for empty userId", async () => {
      const result = await resolver.getEffectivePermissions({ userId: "" });

      expect(result.platform).toHaveLength(0);
      expect(result.tenant).toHaveLength(0);
    });
  });

  // ── TENANT ISOLATION ─────────────────────────────────────────────────────

  describe("T-01: Tenant A membership grants access in Tenant A", () => {
    it("returns true for permission check in the correct tenant", async () => {
      tenantMembershipFindUnique.mockResolvedValue(activeMembership());
      userRoleFindMany.mockResolvedValue([
        makeUserRoleRow({
          roleScope: "TENANT",
          permissions: [{ key: PERM_TEAMS_VIEW, scope: "TENANT" }],
        }),
      ]);

      const result = await resolver.hasPermission({
        userId: USER_A,
        permission: PERM_TEAMS_VIEW,
        tenantId: TENANT_A,
      });

      expect(result).toBe(true);
    });
  });

  describe("T-02: Tenant A membership does NOT grant access in Tenant B", () => {
    it("returns false when tenantId in check does not match the user's membership", async () => {
      // User only has an active membership in Tenant A — not Tenant B.
      tenantMembershipFindUnique.mockImplementation(
        (args: { where: { tenantId_userId: { tenantId: string; userId: string } } }) => {
          const { tenantId } = args.where.tenantId_userId;
          if (tenantId === TENANT_A) return Promise.resolve(activeMembership());
          return Promise.resolve(null);
        },
      );

      // When tenantId = TENANT_A, the DB returns a role with TEAMS_VIEW.
      // When tenantId = TENANT_B, the membership check fails first (returns null),
      // so userRoleFindMany is never reached — but we make it return data anyway
      // to prove the membership gate is the real barrier.
      userRoleFindMany.mockResolvedValue([
        makeUserRoleRow({
          roleScope: "TENANT",
          permissions: [{ key: PERM_TEAMS_VIEW, scope: "TENANT" }],
        }),
      ]);

      const resultA = await resolver.hasPermission({
        userId: USER_A,
        permission: PERM_TEAMS_VIEW,
        tenantId: TENANT_A,
      });
      const resultB = await resolver.hasPermission({
        userId: USER_A,
        permission: PERM_TEAMS_VIEW,
        tenantId: TENANT_B,
      });

      // Tenant A grants access (active membership + role)
      expect(resultA).toBe(true);
      // Tenant B does NOT grant access (no active membership)
      expect(resultB).toBe(false);
    });
  });

  describe("T-03: two tenants with similar role names do not cross-authorize", () => {
    it("queries use the correct tenantId so roles from one tenant cannot authorize another", async () => {
      // Both tenants have an active membership but we verify the tenantId
      // is passed to the DB query — isolating which userRoles are fetched.
      tenantMembershipFindUnique.mockResolvedValue(activeMembership());
      userRoleFindMany.mockResolvedValue([
        makeUserRoleRow({
          roleScope: "TENANT",
          permissions: [{ key: PERM_TEAMS_VIEW, scope: "TENANT" }],
        }),
      ]);

      await resolver.hasPermission({
        userId: USER_A,
        permission: PERM_TEAMS_VIEW,
        tenantId: TENANT_A,
      });

      // The UserRole query must include the tenantId as a filter
      expect(userRoleFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenantId: TENANT_A }),
        }),
      );
    });
  });

  describe("T-04: tenant permission check without tenantId → denied", () => {
    it("platform check does not grant tenant-scoped permissions", async () => {
      // Simulate: user has a tenant role with TEAMS_VIEW, but we perform a
      // platform-level check (no tenantId). The platform query filters for
      // scope=PLATFORM so tenant rows are excluded at DB level. The mock
      // returns an empty array representing no platform roles.
      userRoleFindMany.mockResolvedValue([]);

      const result = await resolver.hasPermission({
        userId: USER_A,
        permission: PERM_TEAMS_VIEW,
        // tenantId deliberately omitted
      });

      expect(result).toBe(false);
    });
  });

  // ── SCOPE ISOLATION ───────────────────────────────────────────────────────

  describe("S-01: tenant role does NOT grant platform permission", () => {
    it("returns false when a TENANT-scoped role row carries a PLATFORM permission key", async () => {
      // Even if a TENANT role somehow linked to a PLATFORM permission,
      // the resolver filters permission.scope === PLATFORM within platform
      // resolution only. In the tenant resolver path, permission.scope === TENANT
      // is enforced. So this models: DB returns a row but with wrong scope.
      tenantMembershipFindUnique.mockResolvedValue(activeMembership());
      userRoleFindMany.mockResolvedValue([
        makeUserRoleRow({
          roleScope: "TENANT",
          // Simulate a misconfigured row: permission scope is PLATFORM
          permissions: [{ key: PERM_USERS_MANAGE, scope: "PLATFORM" }],
        }),
      ]);

      // Tenant-scoped check — resolver enforces permission.scope === TENANT
      const result = await resolver.hasPermission({
        userId: USER_A,
        permission: PERM_USERS_MANAGE,
        tenantId: TENANT_A,
      });

      expect(result).toBe(false);
    });
  });

  describe("S-02: platform role does NOT automatically grant tenant operational permission", () => {
    it("returns false for a tenant check even when user has a platform role", async () => {
      // Platform resolution path is used only when tenantId is omitted.
      // When tenantId IS provided, the resolver uses the tenant path which
      // queries for scope=TENANT roles. The mock returns no tenant roles.
      tenantMembershipFindUnique.mockResolvedValue(activeMembership());
      userRoleFindMany.mockResolvedValue([]);

      const result = await resolver.hasPermission({
        userId: USER_A,
        permission: PERM_TEAMS_VIEW,
        tenantId: TENANT_A,
      });

      expect(result).toBe(false);
    });
  });

  describe("S-03: tenant-scoped permission via incompatible role scope → denied", () => {
    it("platform resolution ignores permissions with scope=TENANT", async () => {
      userRoleFindMany.mockResolvedValue([
        makeUserRoleRow({
          roleScope: "PLATFORM",
          // The permission has scope=TENANT — should be excluded from platform grants
          permissions: [{ key: PERM_TEAMS_VIEW, scope: "TENANT" }],
        }),
      ]);

      const result = await resolver.hasPermission({
        userId: USER_A,
        permission: PERM_TEAMS_VIEW,
        // No tenantId → platform check
      });

      expect(result).toBe(false);
    });
  });

  describe("S-04: platform-scoped permission via incompatible role scope → denied (tenant path)", () => {
    it("tenant resolution ignores permissions with scope=PLATFORM", async () => {
      tenantMembershipFindUnique.mockResolvedValue(activeMembership());
      userRoleFindMany.mockResolvedValue([
        makeUserRoleRow({
          roleScope: "TENANT",
          // The permission has scope=PLATFORM — should be excluded from tenant grants
          permissions: [{ key: PERM_USERS_MANAGE, scope: "PLATFORM" }],
        }),
      ]);

      const result = await resolver.hasPermission({
        userId: USER_A,
        permission: PERM_USERS_MANAGE,
        tenantId: TENANT_A,
      });

      expect(result).toBe(false);
    });
  });

  // ── MEMBERSHIP VALIDITY ───────────────────────────────────────────────────

  describe("V-01: inactive TenantMembership → denied", () => {
    it("returns false when TenantMembership.isActive is false", async () => {
      tenantMembershipFindUnique.mockResolvedValue(inactiveMembership());
      userRoleFindMany.mockResolvedValue([
        makeUserRoleRow({
          roleScope: "TENANT",
          permissions: [{ key: PERM_TEAMS_VIEW, scope: "TENANT" }],
        }),
      ]);

      const result = await resolver.hasPermission({
        userId: USER_A,
        permission: PERM_TEAMS_VIEW,
        tenantId: TENANT_A,
      });

      expect(result).toBe(false);
      // UserRole query must NOT be reached when membership is inactive
      expect(userRoleFindMany).not.toHaveBeenCalled();
    });
  });

  describe("V-02: archived role → denied", () => {
    it("archived roles do not contribute permissions (DB-level filter enforces this)", async () => {
      // The query uses role: { isArchived: false } so the DB will return
      // zero rows for archived roles. We simulate this by returning empty.
      userRoleFindMany.mockResolvedValue([]);

      const result = await resolver.hasPermission({
        userId: USER_A,
        permission: PERM_USERS_MANAGE,
      });

      expect(result).toBe(false);
      // Verify the query includes the isArchived: false filter
      expect(userRoleFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            role: expect.objectContaining({ isArchived: false }),
          }),
        }),
      );
    });
  });

  describe("V-03: missing TenantMembership → denied", () => {
    it("returns false when no TenantMembership row exists for the user+tenant pair", async () => {
      tenantMembershipFindUnique.mockResolvedValue(null);

      const result = await resolver.hasPermission({
        userId: USER_A,
        permission: PERM_TEAMS_VIEW,
        tenantId: TENANT_A,
      });

      expect(result).toBe(false);
    });
  });

  // ── TENANT OPERATIONAL STATUS (RPERM-04-C1) ──────────────────────────────
  //
  // An active TenantMembership is necessary but not sufficient: the related
  // Tenant must also be operationally ACTIVE. An archived or inactive tenant
  // must not grant any tenant permission even to a user with a fully valid,
  // active membership and role — this is the fix for "archived tenant
  // remains accessible" (Finding 1).

  describe("TS-01: active membership + ACTIVE tenant → granted", () => {
    it("returns true when the related tenant is operationally ACTIVE", async () => {
      tenantMembershipFindUnique.mockResolvedValue(activeMembership("ACTIVE"));
      userRoleFindMany.mockResolvedValue([
        makeUserRoleRow({
          roleScope: "TENANT",
          permissions: [{ key: PERM_TEAMS_VIEW, scope: "TENANT" }],
        }),
      ]);

      const result = await resolver.hasPermission({
        userId: USER_A,
        permission: PERM_TEAMS_VIEW,
        tenantId: TENANT_A,
      });

      expect(result).toBe(true);
    });
  });

  describe("TS-02: active membership + ARCHIVED tenant → denied", () => {
    it("returns false even though the membership itself is active and the role grants the permission", async () => {
      tenantMembershipFindUnique.mockResolvedValue(activeMembership("ARCHIVED"));
      userRoleFindMany.mockResolvedValue([
        makeUserRoleRow({
          roleScope: "TENANT",
          permissions: [{ key: PERM_TEAMS_VIEW, scope: "TENANT" }],
        }),
      ]);

      const result = await resolver.hasPermission({
        userId: USER_A,
        permission: PERM_TEAMS_VIEW,
        tenantId: TENANT_A,
      });

      expect(result).toBe(false);
    });

    it("getEffectivePermissions returns an empty tenant bucket for an archived tenant", async () => {
      tenantMembershipFindUnique.mockResolvedValue(activeMembership("ARCHIVED"));
      userRoleFindMany.mockResolvedValue([
        makeUserRoleRow({
          roleScope: "TENANT",
          permissions: [{ key: PERM_TEAMS_VIEW, scope: "TENANT" }],
        }),
      ]);

      const result = await resolver.getEffectivePermissions({
        userId: USER_A,
        tenantId: TENANT_A,
      });

      expect(result.tenant).toHaveLength(0);
    });
  });

  describe("TS-03: active membership + INACTIVE tenant → denied", () => {
    it("returns false when the related tenant status is INACTIVE (not just ARCHIVED)", async () => {
      tenantMembershipFindUnique.mockResolvedValue(activeMembership("INACTIVE"));
      userRoleFindMany.mockResolvedValue([
        makeUserRoleRow({
          roleScope: "TENANT",
          permissions: [{ key: PERM_TEAMS_VIEW, scope: "TENANT" }],
        }),
      ]);

      const result = await resolver.hasPermission({
        userId: USER_A,
        permission: PERM_TEAMS_VIEW,
        tenantId: TENANT_A,
      });

      expect(result).toBe(false);
    });
  });

  describe("TS-04: inactive membership + ACTIVE tenant → denied", () => {
    it("the membership gate still applies independently of tenant status", async () => {
      tenantMembershipFindUnique.mockResolvedValue(inactiveMembership("ACTIVE"));
      userRoleFindMany.mockResolvedValue([
        makeUserRoleRow({
          roleScope: "TENANT",
          permissions: [{ key: PERM_TEAMS_VIEW, scope: "TENANT" }],
        }),
      ]);

      const result = await resolver.hasPermission({
        userId: USER_A,
        permission: PERM_TEAMS_VIEW,
        tenantId: TENANT_A,
      });

      expect(result).toBe(false);
    });
  });

  describe("TS-05: archived tenant denial short-circuits before the UserRole query", () => {
    it("does not query UserRole once the tenant is found to be non-ACTIVE", async () => {
      tenantMembershipFindUnique.mockResolvedValue(activeMembership("ARCHIVED"));
      userRoleFindMany.mockResolvedValue([]);

      await resolver.hasPermission({
        userId: USER_A,
        permission: PERM_TEAMS_VIEW,
        tenantId: TENANT_A,
      });

      expect(userRoleFindMany).not.toHaveBeenCalled();
    });
  });

  // ── AGGREGATE METHODS ─────────────────────────────────────────────────────

  describe("A-01: hasAnyPermission — true when at least one permission granted", () => {
    it("returns true if the user has any of the listed permissions", async () => {
      userRoleFindMany.mockResolvedValue([
        makeUserRoleRow({
          roleScope: "PLATFORM",
          permissions: [{ key: PERM_USERS_MANAGE, scope: "PLATFORM" }],
        }),
      ]);

      const result = await resolver.hasAnyPermission({
        userId: USER_A,
        permissions: [PERM_UNKNOWN, PERM_USERS_MANAGE],
      });

      expect(result).toBe(true);
    });
  });

  describe("A-02: hasAnyPermission — false when none granted", () => {
    it("returns false when the user does not have any of the listed permissions", async () => {
      userRoleFindMany.mockResolvedValue([
        makeUserRoleRow({
          roleScope: "PLATFORM",
          permissions: [{ key: PERM_TENANTS_VIEW, scope: "PLATFORM" }],
        }),
      ]);

      const result = await resolver.hasAnyPermission({
        userId: USER_A,
        permissions: [PERM_USERS_MANAGE, PERM_UNKNOWN],
      });

      expect(result).toBe(false);
    });
  });

  describe("A-03: hasAllPermissions — true only when every permission granted", () => {
    it("returns true when the user holds all listed permissions", async () => {
      userRoleFindMany.mockResolvedValue([
        makeUserRoleRow({
          roleScope: "PLATFORM",
          permissions: [
            { key: PERM_USERS_MANAGE, scope: "PLATFORM" },
            { key: PERM_TENANTS_VIEW, scope: "PLATFORM" },
          ],
        }),
      ]);

      const result = await resolver.hasAllPermissions({
        userId: USER_A,
        permissions: [PERM_USERS_MANAGE, PERM_TENANTS_VIEW],
      });

      expect(result).toBe(true);
    });
  });

  describe("A-04: hasAllPermissions — false when one is missing", () => {
    it("returns false if any required permission is not granted", async () => {
      userRoleFindMany.mockResolvedValue([
        makeUserRoleRow({
          roleScope: "PLATFORM",
          permissions: [{ key: PERM_USERS_MANAGE, scope: "PLATFORM" }],
        }),
      ]);

      const result = await resolver.hasAllPermissions({
        userId: USER_A,
        permissions: [PERM_USERS_MANAGE, PERM_TENANTS_VIEW],
      });

      expect(result).toBe(false);
    });
  });

  describe("A-05: hasAnyPermission([]) → false", () => {
    it("returns false for an empty permissions array", async () => {
      userRoleFindMany.mockResolvedValue([
        makeUserRoleRow({
          roleScope: "PLATFORM",
          permissions: [{ key: PERM_USERS_MANAGE, scope: "PLATFORM" }],
        }),
      ]);

      const result = await resolver.hasAnyPermission({
        userId: USER_A,
        permissions: [],
      });

      expect(result).toBe(false);
      // DB must not be queried — shortcut before resolving
      expect(userRoleFindMany).not.toHaveBeenCalled();
    });
  });

  describe("A-06: hasAllPermissions([]) → true", () => {
    it("returns true (vacuous) for an empty permissions array", async () => {
      userRoleFindMany.mockResolvedValue([]);

      const result = await resolver.hasAllPermissions({
        userId: USER_A,
        permissions: [],
      });

      expect(result).toBe(true);
      // DB must not be queried — shortcut before resolving
      expect(userRoleFindMany).not.toHaveBeenCalled();
    });
  });

  // ── EFFECTIVE PERMISSION LISTING ──────────────────────────────────────────

  describe("L-01: getEffectivePermissions returns only valid platform permissions", () => {
    it("lists granted platform permissions sorted alphabetically", async () => {
      userRoleFindMany.mockResolvedValue([
        makeUserRoleRow({
          roleScope: "PLATFORM",
          permissions: [
            { key: PERM_TENANTS_VIEW, scope: "PLATFORM" },
            { key: PERM_USERS_MANAGE, scope: "PLATFORM" },
          ],
        }),
      ]);

      const result = await resolver.getEffectivePermissions({ userId: USER_A });

      expect(result.platform).toContain(PERM_USERS_MANAGE);
      expect(result.platform).toContain(PERM_TENANTS_VIEW);
      expect(result.tenant).toHaveLength(0);
      // Sorted
      expect([...result.platform]).toEqual([...result.platform].sort());
    });
  });

  describe("L-02: getEffectivePermissions returns both platform and tenant permissions", () => {
    it("resolves platform and tenant permission sets when tenantId is provided", async () => {
      tenantMembershipFindUnique.mockResolvedValue(activeMembership());
      // First call (platform) returns platform roles; second call (tenant) returns tenant roles.
      userRoleFindMany
        .mockResolvedValueOnce([
          makeUserRoleRow({
            roleScope: "PLATFORM",
            permissions: [{ key: PERM_USERS_MANAGE, scope: "PLATFORM" }],
          }),
        ])
        .mockResolvedValueOnce([
          makeUserRoleRow({
            roleScope: "TENANT",
            permissions: [{ key: PERM_TEAMS_VIEW, scope: "TENANT" }],
          }),
        ]);

      const result = await resolver.getEffectivePermissions({
        userId: USER_A,
        tenantId: TENANT_A,
      });

      expect(result.platform).toContain(PERM_USERS_MANAGE);
      expect(result.tenant).toContain(PERM_TEAMS_VIEW);
    });
  });

  describe("L-03: getEffectivePermissions returns empty sets for unknown user", () => {
    it("returns empty platform and tenant arrays when userId is empty", async () => {
      const result = await resolver.getEffectivePermissions({ userId: "" });

      expect(result.platform).toHaveLength(0);
      expect(result.tenant).toHaveLength(0);
    });
  });

  describe("L-04: getEffectivePermissions without tenantId returns only platform", () => {
    it("resolves only platform permissions when tenantId is omitted", async () => {
      userRoleFindMany.mockResolvedValue([
        makeUserRoleRow({
          roleScope: "PLATFORM",
          permissions: [{ key: PERM_USERS_MANAGE, scope: "PLATFORM" }],
        }),
      ]);

      const result = await resolver.getEffectivePermissions({ userId: USER_A });

      expect(result.platform).toContain(PERM_USERS_MANAGE);
      expect(result.tenant).toHaveLength(0);
      // TenantMembership must not be queried
      expect(tenantMembershipFindUnique).not.toHaveBeenCalled();
    });
  });

  describe("L-05: getEffectivePermissions deduplicates across multiple roles", () => {
    it("each key appears only once even when multiple roles share it", async () => {
      userRoleFindMany.mockResolvedValue([
        makeUserRoleRow({
          roleScope: "PLATFORM",
          permissions: [{ key: PERM_USERS_MANAGE, scope: "PLATFORM" }],
        }),
        makeUserRoleRow({
          roleScope: "PLATFORM",
          permissions: [{ key: PERM_USERS_MANAGE, scope: "PLATFORM" }],
        }),
      ]);

      const result = await resolver.getEffectivePermissions({ userId: USER_A });

      const count = result.platform.filter((k) => k === PERM_USERS_MANAGE).length;
      expect(count).toBe(1);
    });
  });

  // ── QUERY SAFETY ──────────────────────────────────────────────────────────

  describe("Q-01: tenant permission query filters by tenantId at DB level", () => {
    it("passes the tenantId to both UserRole and role filters in userRole.findMany", async () => {
      tenantMembershipFindUnique.mockResolvedValue(activeMembership());
      userRoleFindMany.mockResolvedValue([]);

      await resolver.hasPermission({
        userId: USER_A,
        permission: PERM_TEAMS_VIEW,
        tenantId: TENANT_A,
      });

      expect(userRoleFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: TENANT_A,
            role: expect.objectContaining({ tenantId: TENANT_A }),
          }),
        }),
      );
    });
  });

  describe("Q-02: platform permission query uses tenantId=null at DB level", () => {
    it("passes tenantId: null to both UserRole and role filters in userRole.findMany", async () => {
      userRoleFindMany.mockResolvedValue([]);

      await resolver.hasPermission({
        userId: USER_A,
        permission: PERM_USERS_MANAGE,
        // no tenantId
      });

      expect(userRoleFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: null,
            role: expect.objectContaining({ tenantId: null }),
          }),
        }),
      );
    });
  });

  describe("Q-03: resolver fails closed when no authorization path found", () => {
    it("returns false rather than throwing when DB returns empty results", async () => {
      userRoleFindMany.mockResolvedValue([]);

      const result = await resolver.hasPermission({
        userId: "nonexistent-user",
        permission: PERM_USERS_MANAGE,
      });

      expect(result).toBe(false);
    });
  });

  describe("Q-04: resolver does not expose memberships from unrelated tenants", () => {
    it("tenantMembership query is always scoped to the requested tenantId", async () => {
      tenantMembershipFindUnique.mockResolvedValue(null);

      await resolver.hasPermission({
        userId: USER_A,
        permission: PERM_TEAMS_VIEW,
        tenantId: TENANT_A,
      });

      expect(tenantMembershipFindUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId_userId: expect.objectContaining({ tenantId: TENANT_A }),
          }),
        }),
      );
      // Verify TENANT_B was never queried
      const calls = tenantMembershipFindUnique.mock.calls as Array<[{ where: { tenantId_userId: { tenantId: string } } }]>;
      const queriedTenants = calls.map((c) => c[0].where.tenantId_userId.tenantId);
      expect(queriedTenants).not.toContain(TENANT_B);
    });
  });

  // ── SECURITY REGRESSION — ROLE OWNERSHIP ─────────────────────────────────
  //
  // These tests cover the hostile data scenario where:
  //   UserRole.tenantId = Tenant A  (assignment looks correct)
  //   Role.tenantId     = Tenant B  (role actually belongs to Tenant B)
  // or
  //   UserRole.tenantId = null      (platform assignment looks correct)
  //   Role.tenantId     = Tenant A  (role is actually tenant-owned)
  //
  // Both must be DENIED even though the assignment-level tenantId looks valid.
  // The resolver enforces role ownership at DB query level via role.tenantId.

  describe("Sec-01: tenant role ownership mismatch → denied at query level", () => {
    it("query enforces role.tenantId = requested tenantId, not just UserRole.tenantId", async () => {
      tenantMembershipFindUnique.mockResolvedValue(activeMembership());
      // The DB mock returns nothing — simulating the DB correctly returning
      // zero rows because role.tenantId = TENANT_B ≠ TENANT_A (the filter).
      userRoleFindMany.mockResolvedValue([]);

      const result = await resolver.hasPermission({
        userId: USER_A,
        permission: PERM_TEAMS_VIEW,
        tenantId: TENANT_A,
      });

      expect(result).toBe(false);

      // CRITICAL: verify the query includes role.tenantId = TENANT_A so the DB
      // can reject the mismatched Tenant B role before any data is returned.
      expect(userRoleFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: TENANT_A,
            role: expect.objectContaining({ tenantId: TENANT_A }),
          }),
        }),
      );
    });

    it("a role owned by Tenant B does not grant access in Tenant A check", async () => {
      // Simulate: DB would have returned a row if role.tenantId were not
      // filtered — but with the filter in place, the DB returns nothing.
      // The mock models the DB behavior after the filter is applied.
      tenantMembershipFindUnique.mockResolvedValue(activeMembership());
      userRoleFindMany.mockResolvedValue([]); // role.tenantId = TENANT_B filtered out

      const result = await resolver.hasPermission({
        userId: USER_A,
        permission: PERM_TEAMS_VIEW,
        tenantId: TENANT_A,
      });

      expect(result).toBe(false);
    });
  });

  describe("Sec-02: platform role with tenant owner → denied at query level", () => {
    it("query enforces role.tenantId = null for platform checks", async () => {
      // DB returns nothing — simulating the DB rejecting a role that has
      // scope=PLATFORM but tenantId=TENANT_A (inconsistent data).
      userRoleFindMany.mockResolvedValue([]);

      const result = await resolver.hasPermission({
        userId: USER_A,
        permission: PERM_USERS_MANAGE,
        // no tenantId → platform check
      });

      expect(result).toBe(false);

      // CRITICAL: verify role.tenantId = null is in the query
      expect(userRoleFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: null,
            role: expect.objectContaining({ tenantId: null }),
          }),
        }),
      );
    });
  });

  describe("Sec-03: archived platform role → denied at query level", () => {
    it("platform query includes role.isArchived: false filter", async () => {
      userRoleFindMany.mockResolvedValue([]);

      await resolver.hasPermission({
        userId: USER_A,
        permission: PERM_USERS_MANAGE,
      });

      expect(userRoleFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            role: expect.objectContaining({ isArchived: false }),
          }),
        }),
      );
    });
  });

  describe("Sec-04: archived tenant role → denied at query level", () => {
    it("tenant query includes role.isArchived: false filter", async () => {
      tenantMembershipFindUnique.mockResolvedValue(activeMembership());
      userRoleFindMany.mockResolvedValue([]);

      await resolver.hasPermission({
        userId: USER_A,
        permission: PERM_TEAMS_VIEW,
        tenantId: TENANT_A,
      });

      expect(userRoleFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            role: expect.objectContaining({ isArchived: false }),
          }),
        }),
      );
    });
  });

  // ── FACTORY ──────────────────────────────────────────────────────────────

  describe("createEffectivePermissionResolver factory", () => {
    it("returns an EffectivePermissionResolver instance", () => {
      const prisma = makeMockPrisma();
      const resolver = createEffectivePermissionResolver(prisma);
      expect(resolver).toBeInstanceOf(EffectivePermissionResolver);
    });
  });
});
