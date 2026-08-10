/**
 * ADMIN-DELETE-01A-C1 (corrected by ADMIN-DELETE-01A-C2) — SCE Super Admin
 * cross-tenant deletion authority
 *
 * Correction to the ADMIN-DELETE-01A permission foundation (PR #346, see
 * lib/permissions/__tests__/admin-delete-01a-deletion-permission-foundation.test.ts):
 * that slice preserved the RPERM-04 rule that a PLATFORM-held grant never
 * satisfies a TENANT-scoped `hasPermission()` check — correct for ordinary
 * "view"/"manage" permissions, but it meant an authenticated SCE Super
 * Admin (holding `teams.delete` platform-wide, e.g. via the seeded
 * `super_admin` role) could not exercise deletion authority in a tenant
 * without first acquiring a `TenantMembership`, a tenant-scoped role grant,
 * or impersonation — conflicting with the required SCE platform-
 * administration model.
 *
 * This suite exercises the new, narrowly-scoped
 * `EffectivePermissionResolver.hasTenantDeletionAuthority()` primitive
 * (lib/permissions/services/effective-permission-resolver.ts) added to
 * close that gap WITHOUT reopening the RPERM-04 bug: `hasPermission()`
 * itself is completely unchanged (see the untouched
 * admin-delete-01a-deletion-permission-foundation.test.ts SA-01 case), and
 * no route contains a hardcoded `if (isSuperAdmin) return true` — every
 * semantic below falls out of the resolver evaluating
 * `(permission, tenantId)` against real membership/role/tenant rows.
 *
 * ── ADMIN-DELETE-01A-C2 test correction ──────────────────────────────────────
 * The original C1 version of this suite mocked the SCE Super Admin's
 * PLATFORM `UserRole → Role → RolePermission → Permission` join with
 * `permission.scope: "PLATFORM"` for `teams.delete`. That does NOT match
 * the real seeded shape: `teams.delete`'s `Permission` row is correctly
 * `scope: TENANT` (prisma/seed.ts) even though it is legitimately attached
 * to the PLATFORM `super_admin` `Role` via `RolePermission` (super_admin
 * owns every permission key regardless of scope). The mismatch masked a
 * real bug in `hasTenantDeletionAuthority()`'s Path 2 (it used
 * `resolvePlatformPermissions()`, which filters on
 * `permission.scope === "PLATFORM"` and therefore silently dropped
 * `teams.delete`). Every SCE Super Admin scenario below now mocks
 * `permission.scope: "TENANT"` on the joined row — the real shape — so
 * this suite would fail again if the underlying bug ever regressed.
 *
 * Covers the 8 scenarios required by ADMIN-DELETE-01A-C2:
 *   1. SC-01 PLATFORM super_admin role + TENANT-scoped teams.delete (real
 *      seeded shape) → allowed for an explicit, real, ACTIVE Tenant A.
 *   2. SC-01b No TenantMembership in Tenant A is required for that grant.
 *   3. SC-04 The PLATFORM role's RolePermission set does NOT include
 *      teams.delete (e.g. holds only teams.manage) → denied.
 *   4. SC-05 The PLATFORM role holds an entirely unrelated permission
 *      (users.manage) → denied for teams.delete.
 *   5. SC-03 An ARCHIVED/INACTIVE target tenant → denied even with the
 *      platform grant.
 *   6. SC-02 A missing/unknown tenant id → denied even with the platform
 *      grant; an empty tenantId is denied without any DB query.
 *   7. CA-01/CA-02 Club Admin tenant-scoped path is unaffected: allowed in
 *      its own tenant, denied cross-tenant.
 *   8. DEN-01 teams.manage alone still does NOT imply teams.delete —
 *      checked via the same hasTenantDeletionAuthority() entry point.
 *
 * Plus the pre-existing DEL-01 (delegated user) and DEN-02 (ordinary user)
 * coverage and the "<module>.delete" naming-convention guard, all unchanged
 * by the C2 correction.
 *
 * Mocks Prisma the same way
 * lib/permissions/__tests__/admin-delete-01a-deletion-permission-foundation.test.ts
 * and lib/permissions/services/__tests__/effective-permission-resolver.test.ts
 * do, plus a `tenant.findUnique` mock for the tenant-existence/status check
 * this method performs before ever trusting a platform grant cross-tenant.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { PrismaClient } from "@prisma/client";
import {
  EffectivePermissionResolver,
} from "@/lib/permissions/services/effective-permission-resolver";
import { PERMISSIONS } from "@/lib/permissions/permissions";

type UserRoleFindManyMock = ReturnType<typeof vi.fn>;
type TenantMembershipFindUniqueMock = ReturnType<typeof vi.fn>;
type TenantFindUniqueMock = ReturnType<typeof vi.fn>;

function makeMockPrisma(overrides: {
  userRoleFindMany?: UserRoleFindManyMock;
  tenantMembershipFindUnique?: TenantMembershipFindUniqueMock;
  tenantFindUnique?: TenantFindUniqueMock;
} = {}): PrismaClient {
  return {
    userRole: {
      findMany: overrides.userRoleFindMany ?? vi.fn().mockResolvedValue([]),
    },
    tenantMembership: {
      findUnique:
        overrides.tenantMembershipFindUnique ?? vi.fn().mockResolvedValue(null),
    },
    tenant: {
      findUnique: overrides.tenantFindUnique ?? vi.fn().mockResolvedValue(null),
    },
  } as unknown as PrismaClient;
}

function makeUserRoleRow(opts: {
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
 * Real seeded shape for the PLATFORM super_admin role's grant of
 * teams.delete (prisma/seed.ts): a PLATFORM UserRole → Role →
 * RolePermission → Permission chain, where the Permission row itself is
 * `scope: TENANT` (deletion is inherently per-tenant) even though the Role
 * granting it is PLATFORM-scoped. Deliberately distinct from
 * `makeUserRoleRow` above, which is reused for the (unrelated) tenant-scoped
 * paths, to make the real-shape intent explicit at every call site below.
 */
function makePlatformSuperAdminRow(permissionKeys: string[]) {
  return makeUserRoleRow({
    permissions: permissionKeys.map((key) => ({ key, scope: "TENANT" as const })),
  });
}

function activeMembership(tenantStatus: "ACTIVE" | "INACTIVE" | "ARCHIVED" = "ACTIVE") {
  return { isActive: true, tenant: { status: tenantStatus } };
}

const SUPER_ADMIN_USER = "super-admin-user-id";
const CLUB_ADMIN_USER = "club-admin-user-id";
const DELEGATED_USER = "delegated-user-id";
const ORDINARY_USER = "ordinary-user-id";

const TENANT_A = "tenant-a-id";
const TENANT_B = "tenant-b-id";
const UNRESOLVED_TENANT = "tenant-forged-id";

const TEAMS_DELETE = PERMISSIONS.TEAMS_DELETE; // "teams.delete"
const TEAMS_MANAGE = PERMISSIONS.TEAMS_MANAGE; // "teams.manage"
const USERS_MANAGE = PERMISSIONS.USERS_MANAGE; // "users.manage" — a genuinely PLATFORM-scoped permission

describe("ADMIN-DELETE-01A-C1/C2 — SCE Super Admin cross-tenant deletion authority", () => {
  let userRoleFindMany: UserRoleFindManyMock;
  let tenantMembershipFindUnique: TenantMembershipFindUniqueMock;
  let tenantFindUnique: TenantFindUniqueMock;
  let resolver: EffectivePermissionResolver;

  beforeEach(() => {
    userRoleFindMany = vi.fn().mockResolvedValue([]);
    tenantMembershipFindUnique = vi.fn().mockResolvedValue(null);
    tenantFindUnique = vi.fn().mockResolvedValue(null);
    resolver = new EffectivePermissionResolver(
      makeMockPrisma({ userRoleFindMany, tenantMembershipFindUnique, tenantFindUnique }),
    );
  });

  // ── SC-01: SCE Super Admin cross-tenant grant, real seeded shape ────────

  describe("SC-01: PLATFORM super_admin role + TENANT-scoped teams.delete (real seeded shape) → allowed", () => {
    it("grants via the platform role's grant once Tenant A resolves to a real, ACTIVE tenant", async () => {
      // Real seeded shape: super_admin is a PLATFORM Role, but the
      // teams.delete Permission row it's granted is scope=TENANT
      // (prisma/seed.ts). This is the exact shape the C1→C2 correction
      // fixes — the old mock incorrectly used scope="PLATFORM" here.
      userRoleFindMany.mockResolvedValue([makePlatformSuperAdminRow([TEAMS_DELETE])]);
      tenantFindUnique.mockResolvedValue({ status: "ACTIVE" });

      const result = await resolver.hasTenantDeletionAuthority({
        userId: SUPER_ADMIN_USER,
        permission: TEAMS_DELETE,
        tenantId: TENANT_A,
      });

      expect(result).toBe(true);
      expect(tenantFindUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: TENANT_A } }),
      );
    });

    it("SC-01b: no TenantMembership in Tenant A is required for that grant", async () => {
      userRoleFindMany.mockResolvedValue([makePlatformSuperAdminRow([TEAMS_DELETE])]);
      tenantFindUnique.mockResolvedValue({ status: "ACTIVE" });
      // tenantMembershipFindUnique remains the default (resolves null) —
      // asserted explicitly to prove membership is genuinely irrelevant to
      // this path, not merely untested.
      tenantMembershipFindUnique.mockResolvedValue(null);

      const result = await resolver.hasTenantDeletionAuthority({
        userId: SUPER_ADMIN_USER,
        permission: TEAMS_DELETE,
        tenantId: TENANT_A,
      });

      expect(result).toBe(true);
    });
  });

  // ── SC-04/SC-05: platform grant must actually include the exact key ────

  describe("SC-04: the PLATFORM role's grant set does not include teams.delete → denied", () => {
    it("denies when the PLATFORM role holds teams.manage but not teams.delete", async () => {
      userRoleFindMany.mockResolvedValue([makePlatformSuperAdminRow([TEAMS_MANAGE])]);
      tenantFindUnique.mockResolvedValue({ status: "ACTIVE" });

      const result = await resolver.hasTenantDeletionAuthority({
        userId: SUPER_ADMIN_USER,
        permission: TEAMS_DELETE,
        tenantId: TENANT_A,
      });

      expect(result).toBe(false);
    });
  });

  describe("SC-05: an unrelated PLATFORM permission does not grant teams.delete", () => {
    it("denies teams.delete for a PLATFORM role holding only users.manage", async () => {
      userRoleFindMany.mockResolvedValue([makePlatformSuperAdminRow([USERS_MANAGE])]);
      tenantFindUnique.mockResolvedValue({ status: "ACTIVE" });

      const result = await resolver.hasTenantDeletionAuthority({
        userId: SUPER_ADMIN_USER,
        permission: TEAMS_DELETE,
        tenantId: TENANT_A,
      });

      expect(result).toBe(false);
    });
  });

  // ── SC-02/SC-03: explicit trusted tenant context is mandatory ───────────

  describe("SC-02: an unresolved/missing tenant id is denied even with the platform grant", () => {
    it("denies when the tenantId does not resolve to any real Tenant row", async () => {
      userRoleFindMany.mockResolvedValue([makePlatformSuperAdminRow([TEAMS_DELETE])]);
      tenantFindUnique.mockResolvedValue(null); // no such tenant

      const result = await resolver.hasTenantDeletionAuthority({
        userId: SUPER_ADMIN_USER,
        permission: TEAMS_DELETE,
        tenantId: UNRESOLVED_TENANT,
      });

      expect(result).toBe(false);
    });

    it("denies with an empty tenantId and never reaches the database — no ambient/global grant", async () => {
      userRoleFindMany.mockResolvedValue([makePlatformSuperAdminRow([TEAMS_DELETE])]);

      const result = await resolver.hasTenantDeletionAuthority({
        userId: SUPER_ADMIN_USER,
        permission: TEAMS_DELETE,
        tenantId: "",
      });

      expect(result).toBe(false);
      expect(tenantFindUnique).not.toHaveBeenCalled();
    });
  });

  describe("SC-03: an ARCHIVED/INACTIVE tenant is denied even though it exists", () => {
    it("denies when the resolved tenant's status is ARCHIVED", async () => {
      userRoleFindMany.mockResolvedValue([makePlatformSuperAdminRow([TEAMS_DELETE])]);
      tenantFindUnique.mockResolvedValue({ status: "ARCHIVED" });

      const result = await resolver.hasTenantDeletionAuthority({
        userId: SUPER_ADMIN_USER,
        permission: TEAMS_DELETE,
        tenantId: TENANT_A,
      });

      expect(result).toBe(false);
    });

    it("denies when the resolved tenant's status is INACTIVE", async () => {
      userRoleFindMany.mockResolvedValue([makePlatformSuperAdminRow([TEAMS_DELETE])]);
      tenantFindUnique.mockResolvedValue({ status: "INACTIVE" });

      const result = await resolver.hasTenantDeletionAuthority({
        userId: SUPER_ADMIN_USER,
        permission: TEAMS_DELETE,
        tenantId: TENANT_A,
      });

      expect(result).toBe(false);
    });
  });

  // ── CA-01/CA-02: Club Admin tenant isolation is fully preserved ─────────

  describe("CA-01: Club Admin Tenant A is allowed in Tenant A via the (unchanged) tenant-scoped path", () => {
    it("grants teams.delete for a tenant-scoped club_admin-style role with an active membership", async () => {
      tenantMembershipFindUnique.mockResolvedValue(activeMembership());
      userRoleFindMany.mockResolvedValue([
        makeUserRoleRow({
          permissions: [
            { key: TEAMS_MANAGE, scope: "TENANT" },
            { key: TEAMS_DELETE, scope: "TENANT" },
          ],
        }),
      ]);

      const result = await resolver.hasTenantDeletionAuthority({
        userId: CLUB_ADMIN_USER,
        permission: TEAMS_DELETE,
        tenantId: TENANT_A,
      });

      expect(result).toBe(true);
      // The tenant-scoped grant path is sufficient on its own — no need to
      // fall through to (or even query) the platform/tenant-existence path.
      expect(tenantFindUnique).not.toHaveBeenCalled();
    });
  });

  describe("CA-02: Club Admin Tenant A is denied in Tenant B — no platform grant, no membership in B", () => {
    it("denies cross-tenant even though the role in Tenant A grants teams.delete", async () => {
      tenantMembershipFindUnique.mockImplementation(
        (args: { where: { tenantId_userId: { tenantId: string } } }) =>
          args.where.tenantId_userId.tenantId === TENANT_A
            ? Promise.resolve(activeMembership())
            : Promise.resolve(null),
      );
      // Realistic query differentiation: this Club Admin's ONLY UserRole is
      // tenant-owned (UserRole.tenantId = TENANT_A). A real `userRole.findMany`
      // filtered to `tenantId: null` (the PLATFORM path
      // resolvePlatformRolePermissionKeys() queries, reached once Path 1
      // fails for Tenant B) would correctly return zero rows for this user —
      // asserting that here, rather than a single static mock value, is what
      // actually exercises tenant isolation across BOTH query paths this
      // method may issue in one call.
      userRoleFindMany.mockImplementation((args: { where: { tenantId: string | null } }) =>
        args.where.tenantId === TENANT_A
          ? Promise.resolve([makeUserRoleRow({ permissions: [{ key: TEAMS_DELETE, scope: "TENANT" }] })])
          : Promise.resolve([]),
      );
      tenantFindUnique.mockResolvedValue({ status: "ACTIVE" }); // Tenant B exists — irrelevant without a platform grant

      const inOwnTenant = await resolver.hasTenantDeletionAuthority({
        userId: CLUB_ADMIN_USER,
        permission: TEAMS_DELETE,
        tenantId: TENANT_A,
      });
      const inOtherTenant = await resolver.hasTenantDeletionAuthority({
        userId: CLUB_ADMIN_USER,
        permission: TEAMS_DELETE,
        tenantId: TENANT_B,
      });

      expect(inOwnTenant).toBe(true);
      expect(inOtherTenant).toBe(false);
    });
  });

  // ── DEL-01: delegation works within tenant ──────────────────────────────

  describe("DEL-01: delegated user with only teams.delete (no teams.manage) is authorized within its tenant", () => {
    it("grants via a custom tenant role holding only the delete permission", async () => {
      tenantMembershipFindUnique.mockResolvedValue(activeMembership());
      userRoleFindMany.mockResolvedValue([
        makeUserRoleRow({ permissions: [{ key: TEAMS_DELETE, scope: "TENANT" }] }),
      ]);

      const result = await resolver.hasTenantDeletionAuthority({
        userId: DELEGATED_USER,
        permission: TEAMS_DELETE,
        tenantId: TENANT_A,
      });

      expect(result).toBe(true);
    });
  });

  // ── DEN-01: manage never implies delete ─────────────────────────────────

  describe("DEN-01: teams.manage alone does not imply teams.delete", () => {
    it("denies when the user holds teams.manage (tenant-scoped) but not teams.delete", async () => {
      tenantMembershipFindUnique.mockResolvedValue(activeMembership());
      // Path 1 (tenant-scoped) fails to find teams.delete, so this method
      // falls through to Path 2 (platform-scoped) in the same call — mock
      // both `userRole.findMany` query shapes realistically: this user has
      // no PLATFORM UserRole at all (tenantId: null returns zero rows).
      userRoleFindMany.mockImplementation((args: { where: { tenantId: string | null } }) =>
        args.where.tenantId === TENANT_A
          ? Promise.resolve([makeUserRoleRow({ permissions: [{ key: TEAMS_MANAGE, scope: "TENANT" }] })])
          : Promise.resolve([]),
      );
      tenantFindUnique.mockResolvedValue({ status: "ACTIVE" });

      const result = await resolver.hasTenantDeletionAuthority({
        userId: ORDINARY_USER,
        permission: TEAMS_DELETE,
        tenantId: TENANT_A,
      });

      expect(result).toBe(false);
    });
  });

  // ── DEN-02: nobody with zero grants is authorized ───────────────────────

  describe("DEN-02: an ordinary user with no roles at all is denied", () => {
    it("returns false when no UserRole rows exist and no membership exists", async () => {
      const result = await resolver.hasTenantDeletionAuthority({
        userId: ORDINARY_USER,
        permission: TEAMS_DELETE,
        tenantId: TENANT_A,
      });

      expect(result).toBe(false);
    });
  });

  // ── Naming-convention guard ──────────────────────────────────────────────

  describe("guard: hasTenantDeletionAuthority rejects non-'<module>.delete' permission keys", () => {
    it("throws for teams.manage — this method is reserved for deletion-class permissions", async () => {
      await expect(
        resolver.hasTenantDeletionAuthority({
          userId: SUPER_ADMIN_USER,
          permission: TEAMS_MANAGE,
          tenantId: TENANT_A,
        }),
      ).rejects.toThrow(/reserved for/);
    });
  });
});
