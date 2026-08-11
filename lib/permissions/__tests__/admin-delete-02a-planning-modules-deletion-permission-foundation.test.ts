/**
 * ADMIN-DELETE-02A — Planning-modules deletion permission foundation
 *
 * Verifies that trainings.delete / matches.delete / tournaments.delete are
 * resolved through the existing, UNMODIFIED
 * `EffectivePermissionResolver.hasTenantDeletionAuthority()` (lib/
 * permissions/services/effective-permission-resolver.ts) with no
 * module-specific special-casing anywhere in the authorization path —
 * mirrors lib/permissions/__tests__/admin-delete-01a-deletion-permission-
 * foundation.test.ts and admin-delete-01a-c1-cross-tenant-super-admin-
 * authority.test.ts for teams.delete, parametrized over all three new
 * "<module>.delete" keys to prove the same generic contract holds for each.
 *
 * Covers, for EACH of trainings.delete / matches.delete / tournaments.delete:
 *   CA-01  Club Admin (tenant-scoped role holding the delete permission) can
 *          delete within its own tenant.
 *   CA-02  Club Admin cannot delete cross-tenant.
 *   DEL-01 Delegated user: a custom tenant role holding ONLY the delete
 *          permission (no "manage" permission) is authorized to delete.
 *   DEN-01 A role holding only the module's "manage" permission (not
 *          "delete") is denied — manage never implicitly grants deletion.
 *   SA-01  SCE Super Admin: platform-held delete permission grants
 *          cross-tenant deletion authority once the tenant is confirmed
 *          real and ACTIVE (hasTenantDeletionAuthority Path 2).
 *   SA-02  That SCE Super Admin grant does not leak into an unrelated,
 *          unresolvable tenant.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { EffectivePermissionResolver } from "@/lib/permissions/services/effective-permission-resolver";
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
      findUnique: overrides.tenantMembershipFindUnique ?? vi.fn().mockResolvedValue(null),
    },
    tenant: {
      findUnique: overrides.tenantFindUnique ?? vi.fn().mockResolvedValue(null),
    },
  } as unknown as PrismaClient;
}

function makeTenantScopedRoleRow(permissionKey: string) {
  return {
    role: {
      rolePermissions: [{ permission: { key: permissionKey, scope: "TENANT" } }],
    },
  };
}

function makePlatformRoleRow(permissionKey: string) {
  return {
    role: {
      rolePermissions: [{ permission: { key: permissionKey, scope: "TENANT" } }],
    },
  };
}

function activeMembership(tenantStatus: "ACTIVE" | "INACTIVE" | "ARCHIVED" = "ACTIVE") {
  return { isActive: true, tenant: { status: tenantStatus } };
}

const TENANT_A = "tenant-a-id";
const TENANT_B = "tenant-b-id";

const MODULE_DELETE_PERMISSIONS = [
  { module: "trainings", deleteKey: PERMISSIONS.TRAININGS_DELETE, manageKey: PERMISSIONS.TRAININGS_MANAGE },
  { module: "matches", deleteKey: PERMISSIONS.MATCHES_DELETE, manageKey: PERMISSIONS.EVENTS_MANAGE },
  { module: "tournaments", deleteKey: PERMISSIONS.TOURNAMENTS_DELETE, manageKey: PERMISSIONS.EVENTS_MANAGE },
] as const;

describe.each(MODULE_DELETE_PERMISSIONS)(
  "ADMIN-DELETE-02A — $module.delete authorization foundation",
  ({ deleteKey, manageKey }) => {
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

    it("CA-01: Club Admin can delete within its own tenant", async () => {
      tenantMembershipFindUnique.mockResolvedValue(activeMembership());
      userRoleFindMany.mockResolvedValue([makeTenantScopedRoleRow(deleteKey)]);

      const result = await resolver.hasTenantDeletionAuthority({
        userId: "club-admin-1",
        permission: deleteKey,
        tenantId: TENANT_A,
      });

      expect(result).toBe(true);
    });

    it("CA-02: Club Admin cannot delete cross-tenant", async () => {
      tenantMembershipFindUnique.mockImplementation(
        (args: { where: { tenantId_userId: { tenantId: string } } }) =>
          args.where.tenantId_userId.tenantId === TENANT_A
            ? Promise.resolve(activeMembership())
            : Promise.resolve(null),
      );
      userRoleFindMany.mockResolvedValue([makeTenantScopedRoleRow(deleteKey)]);

      const ownTenant = await resolver.hasTenantDeletionAuthority({
        userId: "club-admin-1",
        permission: deleteKey,
        tenantId: TENANT_A,
      });
      const otherTenant = await resolver.hasTenantDeletionAuthority({
        userId: "club-admin-1",
        permission: deleteKey,
        tenantId: TENANT_B,
      });

      expect(ownTenant).toBe(true);
      expect(otherTenant).toBe(false);
    });

    it("DEL-01: delegated user with only the delete permission (no manage) is authorized", async () => {
      tenantMembershipFindUnique.mockResolvedValue(activeMembership());
      userRoleFindMany.mockResolvedValue([makeTenantScopedRoleRow(deleteKey)]);

      const canDelete = await resolver.hasTenantDeletionAuthority({
        userId: "delegated-user-1",
        permission: deleteKey,
        tenantId: TENANT_A,
      });
      const hasManage = await resolver.hasPermission({
        userId: "delegated-user-1",
        permission: manageKey,
        tenantId: TENANT_A,
      });

      expect(canDelete).toBe(true);
      expect(hasManage).toBe(false);
    });

    it("DEN-01: a role holding only the module's manage permission is denied deletion", async () => {
      tenantMembershipFindUnique.mockResolvedValue(activeMembership());
      userRoleFindMany.mockResolvedValue([makeTenantScopedRoleRow(manageKey)]);

      const result = await resolver.hasTenantDeletionAuthority({
        userId: "manage-only-user",
        permission: deleteKey,
        tenantId: TENANT_A,
      });

      expect(result).toBe(false);
    });

    it("SA-01: SCE Super Admin's platform-held delete grant authorizes deletion against a real, ACTIVE tenant", async () => {
      // Platform UserRole (tenantId=null) whose role carries the delete key —
      // models the seeded super_admin role, which owns every permission key.
      userRoleFindMany.mockResolvedValue([makePlatformRoleRow(deleteKey)]);
      tenantFindUnique.mockResolvedValue({ status: "ACTIVE" });

      const result = await resolver.hasTenantDeletionAuthority({
        userId: "sce-super-admin-1",
        permission: deleteKey,
        tenantId: TENANT_A,
      });

      expect(result).toBe(true);
      expect(tenantFindUnique).toHaveBeenCalledWith({
        where: { id: TENANT_A },
        select: { status: true },
      });
    });

    it("SA-02: the SCE Super Admin platform grant does not authorize against an unresolved/ARCHIVED tenant", async () => {
      userRoleFindMany.mockResolvedValue([makePlatformRoleRow(deleteKey)]);
      tenantFindUnique.mockResolvedValue({ status: "ARCHIVED" });

      const result = await resolver.hasTenantDeletionAuthority({
        userId: "sce-super-admin-1",
        permission: deleteKey,
        tenantId: TENANT_B,
      });

      expect(result).toBe(false);
    });
  },
);
