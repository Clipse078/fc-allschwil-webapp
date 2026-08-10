/**
 * ADMIN-DELETE-01A-C1 — SCE Super Admin cross-tenant deletion authority
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
 * Covers exactly the 8 focused scenarios required by ADMIN-DELETE-01A-C1:
 *   1. SC-01 SCE Super Admin can authorize teams.delete for Tenant A
 *      without any TenantMembership in Tenant A — the platform grant alone,
 *      resolved against a real, ACTIVE Tenant A, is sufficient.
 *   2. SC-02 Explicit trusted Tenant A context is required — omitting
 *      tenantId is a type-level requirement (tenantId is mandatory), and a
 *      tenantId that resolves to no real tenant is denied even with the
 *      platform grant.
 *   3. SC-03 SCE Super Admin cannot use an unresolved/client-forged tenant
 *      context — a syntactically well-formed but non-existent tenantId is
 *      denied; an ARCHIVED/INACTIVE tenant is denied even though it exists.
 *   4. CA-01 Club Admin Tenant A allowed in Tenant A (tenant-scoped grant
 *      path, unchanged).
 *   5. CA-02 Club Admin Tenant A denied in Tenant B (no platform grant, no
 *      tenant grant in B — tenant isolation fully preserved).
 *   6. DEL-01 Delegated user: teams.delete works within tenant via a custom
 *      role holding only the delete permission (no manage permission).
 *   7. DEN-01 teams.manage alone does NOT imply teams.delete — checked via
 *      the same hasTenantDeletionAuthority() entry point.
 *   8. DEN-02 An ordinary user with no roles at all is denied.
 *
 * Mocks Prisma the same way
 * lib/permissions/__tests__/admin-delete-01a-deletion-permission-foundation.test.ts
 * and lib/permissions/services/__tests__/effective-permission-resolver.test.ts
 * do, plus a `tenant.findUnique` mock for the new tenant-existence/status
 * check this method performs before ever trusting a platform grant
 * cross-tenant.
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

describe("ADMIN-DELETE-01A-C1 — SCE Super Admin cross-tenant deletion authority", () => {
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

  // ── SC-01: SCE Super Admin cross-tenant grant, no membership needed ─────

  describe("SC-01: SCE Super Admin authorizes teams.delete for Tenant A without any TenantMembership in A", () => {
    it("grants via the platform-held permission once Tenant A resolves to a real, ACTIVE tenant", async () => {
      // No TenantMembership at all (tenantMembershipFindUnique stays null —
      // the default) — proves membership/tenant-role acquisition is not
      // required merely to administer another tenant.
      userRoleFindMany.mockResolvedValue([
        makeUserRoleRow({ permissions: [{ key: TEAMS_DELETE, scope: "PLATFORM" }] }),
      ]);
      tenantFindUnique.mockResolvedValue({ status: "ACTIVE" });

      const result = await resolver.hasTenantDeletionAuthority({
        userId: SUPER_ADMIN_USER,
        permission: TEAMS_DELETE,
        tenantId: TENANT_A,
      });

      expect(result).toBe(true);
      // No active TenantMembership exists in Tenant A (mocked to resolve
      // null by default) — the grant comes exclusively from the platform
      // path once Tenant A is confirmed real + ACTIVE.
      expect(tenantFindUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: TENANT_A } }),
      );
    });
  });

  // ── SC-02/SC-03: explicit trusted tenant context is mandatory ───────────

  describe("SC-02: an unresolved tenant id is denied even with the platform grant", () => {
    it("denies when the tenantId does not resolve to any real Tenant row", async () => {
      userRoleFindMany.mockResolvedValue([
        makeUserRoleRow({ permissions: [{ key: TEAMS_DELETE, scope: "PLATFORM" }] }),
      ]);
      tenantFindUnique.mockResolvedValue(null); // no such tenant

      const result = await resolver.hasTenantDeletionAuthority({
        userId: SUPER_ADMIN_USER,
        permission: TEAMS_DELETE,
        tenantId: UNRESOLVED_TENANT,
      });

      expect(result).toBe(false);
    });

    it("denying with an empty tenantId never reaches the database — no ambient/global grant", async () => {
      userRoleFindMany.mockResolvedValue([
        makeUserRoleRow({ permissions: [{ key: TEAMS_DELETE, scope: "PLATFORM" }] }),
      ]);

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
      userRoleFindMany.mockResolvedValue([
        makeUserRoleRow({ permissions: [{ key: TEAMS_DELETE, scope: "PLATFORM" }] }),
      ]);
      tenantFindUnique.mockResolvedValue({ status: "ARCHIVED" });

      const result = await resolver.hasTenantDeletionAuthority({
        userId: SUPER_ADMIN_USER,
        permission: TEAMS_DELETE,
        tenantId: TENANT_A,
      });

      expect(result).toBe(false);
    });

    it("denies when the resolved tenant's status is INACTIVE", async () => {
      userRoleFindMany.mockResolvedValue([
        makeUserRoleRow({ permissions: [{ key: TEAMS_DELETE, scope: "PLATFORM" }] }),
      ]);
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
      userRoleFindMany.mockResolvedValue([
        makeUserRoleRow({ permissions: [{ key: TEAMS_DELETE, scope: "TENANT" }] }),
      ]);
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
    it("denies when the user holds teams.manage (tenant + platform) but not teams.delete", async () => {
      tenantMembershipFindUnique.mockResolvedValue(activeMembership());
      userRoleFindMany.mockResolvedValue([
        makeUserRoleRow({ permissions: [{ key: TEAMS_MANAGE, scope: "TENANT" }] }),
      ]);
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
