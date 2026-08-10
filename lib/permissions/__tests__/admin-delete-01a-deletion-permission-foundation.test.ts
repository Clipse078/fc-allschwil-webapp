/**
 * ADMIN-DELETE-01A — Canonical permanent-deletion permission foundation
 *
 * Verifies that the module-scoped delete permission ("teams.delete" is the
 * concrete instance seeded for this slice — see prisma/seed.ts and
 * lib/permissions/permissions.ts) is resolved through the existing,
 * unmodified `EffectivePermissionResolver` (lib/permissions/services/
 * effective-permission-resolver.ts) with no special-cased "admins only"
 * logic anywhere in the authorization path. Every semantic required by the
 * product policy — SCE Super Admin, Club Admin, delegated users, ordinary
 * users, and tenant isolation — falls directly out of the resolver's
 * existing platform/tenant scoping rules once a permission row exists.
 *
 * Covers:
 *   SA-01  SCE Super Admin: platform-held delete permission is a platform
 *          grant only — it does NOT, by itself, satisfy a tenant-scoped
 *          delete check via the generic `hasPermission()` (no automatic
 *          cross-tenant bypass through that method; matches the existing
 *          RPERM-04 "platform roles never imply tenant operational access"
 *          rule documented in lib/tenants/README.md). This case, and this
 *          method, are deliberately UNCHANGED by ADMIN-DELETE-01A-C1 — the
 *          dedicated cross-tenant SCE Super Admin deletion authority added
 *          by that correction lives in a separate, narrowly-scoped method
 *          (`hasTenantDeletionAuthority()`), covered in
 *          admin-delete-01a-c1-cross-tenant-super-admin-authority.test.ts,
 *          never in this generic permission checker.
 *   SA-02  SCE Super Admin acting through a trusted tenant context (an
 *          active TenantMembership + tenant-scoped role granting the delete
 *          permission — the same trusted-context path any tenant operator
 *          uses) IS authorized to delete within that tenant.
 *   SA-03  SCE Super Admin's tenant-scoped grant in Tenant A does not leak
 *          into Tenant B.
 *   CA-01  Club Admin (tenant-scoped role holding the delete permission,
 *          e.g. the per-tenant `club_admin` role) can delete within its own
 *          tenant.
 *   CA-02  Club Admin cannot delete cross-tenant — no active membership in
 *          the other tenant means no grant, regardless of role contents.
 *   DEL-01 Delegated user: a custom tenant role holding ONLY the delete
 *          permission (no "manage" permission at all) is authorized to
 *          delete — proving delegation works through the existing Roles &
 *          Permissions role/permission model, not a hardcoded admin check.
 *   DEN-01 Ordinary user with no roles is denied.
 *   DEN-02 User holding only view/manage (non-delete) permissions for the
 *          module is denied the delete permission — "manage" never
 *          implicitly grants permanent deletion.
 *   DEN-03 Symmetric check: holding only the delete permission does not
 *          grant the "manage" permission either — the two remain
 *          independent grants.
 *   REG-01 Regression guard: PERMISSIONS.TEAMS_DELETE exists and is distinct
 *          from PERMISSIONS.TEAMS_MANAGE / PERMISSIONS.TEAMS_VIEW, following
 *          the repository's "<module>.delete" naming convention.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { PrismaClient } from "@prisma/client";
import {
  EffectivePermissionResolver,
} from "@/lib/permissions/services/effective-permission-resolver";
import { PERMISSIONS } from "@/lib/permissions/permissions";

// ---------------------------------------------------------------------------
// Mock Prisma helpers (mirrors lib/permissions/services/__tests__/effective-
// permission-resolver.test.ts so this suite exercises the exact same
// resolver contract, not a reimplementation of it).
// ---------------------------------------------------------------------------

type UserRoleFindManyMock = ReturnType<typeof vi.fn>;
type TenantMembershipFindUniqueMock = ReturnType<typeof vi.fn>;

function makeMockPrisma(overrides: {
  userRoleFindMany?: UserRoleFindManyMock;
  tenantMembershipFindUnique?: TenantMembershipFindUniqueMock;
} = {}): PrismaClient {
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

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SUPER_ADMIN_USER = "super-admin-user-id";
const CLUB_ADMIN_USER = "club-admin-user-id";
const DELEGATED_USER = "delegated-user-id";
const ORDINARY_USER = "ordinary-user-id";

const TENANT_A = "tenant-a-id";
const TENANT_B = "tenant-b-id";

const TEAMS_DELETE = PERMISSIONS.TEAMS_DELETE; // "teams.delete"
const TEAMS_MANAGE = PERMISSIONS.TEAMS_MANAGE; // "teams.manage"
const TEAMS_VIEW = PERMISSIONS.TEAMS_VIEW; // "teams.view"

describe("ADMIN-DELETE-01A — deletion permission foundation", () => {
  let userRoleFindMany: UserRoleFindManyMock;
  let tenantMembershipFindUnique: TenantMembershipFindUniqueMock;
  let resolver: EffectivePermissionResolver;

  beforeEach(() => {
    userRoleFindMany = vi.fn().mockResolvedValue([]);
    tenantMembershipFindUnique = vi.fn().mockResolvedValue(null);
    resolver = new EffectivePermissionResolver(
      makeMockPrisma({ userRoleFindMany, tenantMembershipFindUnique }),
    );
  });

  // ── SCE SUPER ADMIN ────────────────────────────────────────────────────

  describe("SA-01: platform-held delete permission does not by itself grant tenant deletion", () => {
    it("a PLATFORM role holding teams.delete does not satisfy a tenant-scoped check", async () => {
      // Models the seeded super_admin role: PLATFORM UserRole (tenantId=null)
      // whose role carries teams.delete (super_admin is seeded with every
      // permission — see prisma/seed.ts).
      userRoleFindMany.mockResolvedValue([
        makeUserRoleRow({ permissions: [{ key: TEAMS_DELETE, scope: "PLATFORM" }] }),
      ]);

      const platformCheck = await resolver.hasPermission({
        userId: SUPER_ADMIN_USER,
        permission: TEAMS_DELETE,
        // no tenantId → platform-scoped check
      });
      expect(platformCheck).toBe(true);

      // Tenant-scoped check for the SAME user/permission, with no active
      // TenantMembership in Tenant A, must be denied — a platform grant
      // never implies a tenant operational grant (existing RPERM-04 rule).
      const tenantCheck = await resolver.hasPermission({
        userId: SUPER_ADMIN_USER,
        permission: TEAMS_DELETE,
        tenantId: TENANT_A,
      });
      expect(tenantCheck).toBe(false);
    });
  });

  describe("SA-02: SCE Super Admin authorized to delete via a trusted tenant context", () => {
    it("grants deletion once the super admin holds an active membership + tenant role for that exact tenant", async () => {
      // Represents the trusted-context path (e.g. an impersonation-derived
      // session, or an explicit tenant-role grant) — never a client-supplied
      // tenantId, and never a hardcoded "is super admin" bypass. The
      // resolver only ever sees a userId + tenantId and answers from
      // TenantMembership + tenant-scoped UserRole/RolePermission rows.
      tenantMembershipFindUnique.mockResolvedValue(activeMembership());
      userRoleFindMany.mockResolvedValue([
        makeUserRoleRow({ permissions: [{ key: TEAMS_DELETE, scope: "TENANT" }] }),
      ]);

      const result = await resolver.hasPermission({
        userId: SUPER_ADMIN_USER,
        permission: TEAMS_DELETE,
        tenantId: TENANT_A,
      });

      expect(result).toBe(true);
    });
  });

  describe("SA-03: SCE Super Admin's tenant-scoped grant does not leak cross-tenant", () => {
    it("a delete grant in Tenant A is denied when checked against Tenant B", async () => {
      tenantMembershipFindUnique.mockImplementation(
        (args: { where: { tenantId_userId: { tenantId: string } } }) =>
          args.where.tenantId_userId.tenantId === TENANT_A
            ? Promise.resolve(activeMembership())
            : Promise.resolve(null),
      );
      userRoleFindMany.mockResolvedValue([
        makeUserRoleRow({ permissions: [{ key: TEAMS_DELETE, scope: "TENANT" }] }),
      ]);

      const resultA = await resolver.hasPermission({
        userId: SUPER_ADMIN_USER,
        permission: TEAMS_DELETE,
        tenantId: TENANT_A,
      });
      const resultB = await resolver.hasPermission({
        userId: SUPER_ADMIN_USER,
        permission: TEAMS_DELETE,
        tenantId: TENANT_B,
      });

      expect(resultA).toBe(true);
      expect(resultB).toBe(false);
    });
  });

  // ── CLUB ADMIN ─────────────────────────────────────────────────────────

  describe("CA-01: Club Admin can delete within its own tenant", () => {
    it("grants teams.delete for a tenant-scoped club_admin-style role with an active membership", async () => {
      // Mirrors prisma/seed.ts: the tenant club_admin role owns every
      // TENANT-scoped permission, which now includes teams.delete.
      tenantMembershipFindUnique.mockResolvedValue(activeMembership());
      userRoleFindMany.mockResolvedValue([
        makeUserRoleRow({
          permissions: [
            { key: TEAMS_VIEW, scope: "TENANT" },
            { key: TEAMS_MANAGE, scope: "TENANT" },
            { key: TEAMS_DELETE, scope: "TENANT" },
          ],
        }),
      ]);

      const result = await resolver.hasPermission({
        userId: CLUB_ADMIN_USER,
        permission: TEAMS_DELETE,
        tenantId: TENANT_A,
      });

      expect(result).toBe(true);
    });
  });

  describe("CA-02: Club Admin cannot delete cross-tenant", () => {
    it("denies teams.delete for a different tenant even though the role in Tenant A grants it", async () => {
      // Club Admin has an active membership + role in Tenant A only.
      tenantMembershipFindUnique.mockImplementation(
        (args: { where: { tenantId_userId: { tenantId: string } } }) =>
          args.where.tenantId_userId.tenantId === TENANT_A
            ? Promise.resolve(activeMembership())
            : Promise.resolve(null),
      );
      userRoleFindMany.mockResolvedValue([
        makeUserRoleRow({ permissions: [{ key: TEAMS_DELETE, scope: "TENANT" }] }),
      ]);

      const ownTenant = await resolver.hasPermission({
        userId: CLUB_ADMIN_USER,
        permission: TEAMS_DELETE,
        tenantId: TENANT_A,
      });
      const otherTenant = await resolver.hasPermission({
        userId: CLUB_ADMIN_USER,
        permission: TEAMS_DELETE,
        tenantId: TENANT_B,
      });

      expect(ownTenant).toBe(true);
      expect(otherTenant).toBe(false);
    });
  });

  // ── DELEGATION ─────────────────────────────────────────────────────────

  describe("DEL-01: delegated user with only the delete permission is authorized", () => {
    it("grants teams.delete via a custom tenant role that does NOT hold teams.manage", async () => {
      // Proves delegation flows entirely through RolePermission — no
      // hardcoded "admins only" branch anywhere near this check. A club
      // admin could grant exactly this custom role via the existing
      // Roles & Permissions UI (grantableByAdmin: true for teams.delete).
      tenantMembershipFindUnique.mockResolvedValue(activeMembership());
      userRoleFindMany.mockResolvedValue([
        makeUserRoleRow({
          permissions: [
            { key: TEAMS_VIEW, scope: "TENANT" },
            { key: TEAMS_DELETE, scope: "TENANT" },
            // Deliberately NOT teams.manage.
          ],
        }),
      ]);

      const canDelete = await resolver.hasPermission({
        userId: DELEGATED_USER,
        permission: TEAMS_DELETE,
        tenantId: TENANT_A,
      });
      const canManage = await resolver.hasPermission({
        userId: DELEGATED_USER,
        permission: TEAMS_MANAGE,
        tenantId: TENANT_A,
      });

      expect(canDelete).toBe(true);
      expect(canManage).toBe(false);
    });
  });

  // ── DENIALS ────────────────────────────────────────────────────────────

  describe("DEN-01: user without any role is denied", () => {
    it("returns false for teams.delete when no UserRole rows exist", async () => {
      userRoleFindMany.mockResolvedValue([]);

      const result = await resolver.hasPermission({
        userId: ORDINARY_USER,
        permission: TEAMS_DELETE,
        tenantId: TENANT_A,
      });

      expect(result).toBe(false);
    });
  });

  describe("DEN-02: manage/view permissions do not implicitly grant deletion", () => {
    it("denies teams.delete for a role holding teams.view + teams.manage but not teams.delete", async () => {
      tenantMembershipFindUnique.mockResolvedValue(activeMembership());
      userRoleFindMany.mockResolvedValue([
        makeUserRoleRow({
          permissions: [
            { key: TEAMS_VIEW, scope: "TENANT" },
            { key: TEAMS_MANAGE, scope: "TENANT" },
          ],
        }),
      ]);

      const result = await resolver.hasPermission({
        userId: ORDINARY_USER,
        permission: TEAMS_DELETE,
        tenantId: TENANT_A,
      });

      expect(result).toBe(false);
    });
  });

  describe("DEN-03: deletion permission does not implicitly grant manage", () => {
    it("denies teams.manage for a role holding only teams.delete", async () => {
      tenantMembershipFindUnique.mockResolvedValue(activeMembership());
      userRoleFindMany.mockResolvedValue([
        makeUserRoleRow({ permissions: [{ key: TEAMS_DELETE, scope: "TENANT" }] }),
      ]);

      const result = await resolver.hasPermission({
        userId: ORDINARY_USER,
        permission: TEAMS_MANAGE,
        tenantId: TENANT_A,
      });

      expect(result).toBe(false);
    });
  });

  // ── NAMING CONVENTION REGRESSION GUARD ─────────────────────────────────

  describe("REG-01: PERMISSIONS.TEAMS_DELETE follows the '<module>.delete' convention", () => {
    it("is defined and distinct from TEAMS_MANAGE / TEAMS_VIEW", () => {
      expect(PERMISSIONS.TEAMS_DELETE).toBe("teams.delete");
      expect(PERMISSIONS.TEAMS_DELETE).not.toBe(PERMISSIONS.TEAMS_MANAGE);
      expect(PERMISSIONS.TEAMS_DELETE).not.toBe(PERMISSIONS.TEAMS_VIEW);
    });
  });
});
