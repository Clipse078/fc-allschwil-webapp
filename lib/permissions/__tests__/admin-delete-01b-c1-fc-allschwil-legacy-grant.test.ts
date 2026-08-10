/**
 * ADMIN-DELETE-01B-C1 — Grant teams.delete to the actual FC Allschwil Club
 * Admin role
 *
 * Focused, end-to-end-shaped tests proving the specific STAGE authorization
 * gap ADMIN-DELETE-01B found is closed: the actually-assigned FC Allschwil
 * Club Admin role (`Role.key = "club_admin_fc_allschwil"`, `isSystem: false`)
 * — NOT the canonical `club_admin__fc-allschwil` — now authorizes permanent
 * Team deletion once `lib/permissions/teams-delete-permission-reconciliation.ts`
 * has granted it `teams.delete`.
 *
 * `EffectivePermissionResolver` (lib/permissions/services/effective-permission-
 * resolver.ts) is completely role-key-agnostic — it only ever inspects
 * `RolePermission` rows, never `Role.key` — so these tests exercise the exact
 * real-world shape (the legacy role's own key, scope, and tenant ownership)
 * to prove the fix end-to-end rather than re-deriving already-covered
 * generic Club Admin resolver behavior
 * (lib/permissions/__tests__/admin-delete-01a-c1-cross-tenant-super-admin-authority.test.ts).
 *
 * Covers:
 *   6. FC Allschwil Club Admin path is authorized after the reconciliation
 *      grant (this is the exact finding ADMIN-DELETE-01B reported and
 *      ADMIN-DELETE-01B-C1 fixes).
 *   7. teams.manage alone — even on this exact legacy role, in its own
 *      tenant, with an active membership — still does not authorize
 *      permanent deletion.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { EffectivePermissionResolver } from "@/lib/permissions/services/effective-permission-resolver";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { FC_ALLSCHWIL_LEGACY_CLUB_ADMIN_ROLE_KEY } from "@/lib/permissions/teams-delete-permission-reconciliation";

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
      findUnique: overrides.tenantMembershipFindUnique ?? vi.fn().mockResolvedValue(null),
    },
    tenant: {
      findUnique: vi.fn().mockResolvedValue(null),
    },
  } as unknown as PrismaClient;
}

/**
 * Models the real, live shape of the legacy FC Allschwil Club Admin's
 * `UserRole → Role → RolePermission → Permission` chain — `role.key` is
 * included even though the resolver never reads it, purely to document that
 * this is exactly the `club_admin_fc_allschwil` row, not a generic
 * stand-in tenant role.
 */
function makeFcAllschwilLegacyClubAdminRow(permissionKeys: string[]) {
  return {
    role: {
      key: FC_ALLSCHWIL_LEGACY_CLUB_ADMIN_ROLE_KEY,
      rolePermissions: permissionKeys.map((key) => ({
        permission: { key, scope: "TENANT" as const },
      })),
    },
  };
}

function activeMembership() {
  return { isActive: true, tenant: { status: "ACTIVE" as const } };
}

const FC_ALLSCHWIL_TENANT_ID = "tenant-fc-allschwil-id";
const CLUB_ADMIN_USER = "it-fcallschwil-user-id";

const TEAMS_DELETE = PERMISSIONS.TEAMS_DELETE;
const TEAMS_MANAGE = PERMISSIONS.TEAMS_MANAGE;

describe("ADMIN-DELETE-01B-C1 — FC Allschwil legacy Club Admin (club_admin_fc_allschwil) deletion authority", () => {
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

  it("6 — is authorized to delete in fc-allschwil after the reconciliation grant (teams.delete present)", async () => {
    tenantMembershipFindUnique.mockResolvedValue(activeMembership());
    // Post-reconciliation state: the legacy role now carries both its
    // pre-existing teams.manage grant and the newly-granted teams.delete.
    userRoleFindMany.mockResolvedValue([
      makeFcAllschwilLegacyClubAdminRow([TEAMS_MANAGE, TEAMS_DELETE]),
    ]);

    const result = await resolver.hasTenantDeletionAuthority({
      userId: CLUB_ADMIN_USER,
      permission: TEAMS_DELETE,
      tenantId: FC_ALLSCHWIL_TENANT_ID,
    });

    expect(result).toBe(true);
  });

  it("would have been denied before the grant (teams.delete absent) — documents the exact pre-fix gap", async () => {
    tenantMembershipFindUnique.mockResolvedValue(activeMembership());
    // Pre-reconciliation state, as found by ADMIN-DELETE-01B: only
    // teams.manage, no teams.delete.
    userRoleFindMany.mockResolvedValue([makeFcAllschwilLegacyClubAdminRow([TEAMS_MANAGE])]);

    const result = await resolver.hasTenantDeletionAuthority({
      userId: CLUB_ADMIN_USER,
      permission: TEAMS_DELETE,
      tenantId: FC_ALLSCHWIL_TENANT_ID,
    });

    expect(result).toBe(false);
  });

  it("7 — teams.manage alone (even on this exact legacy role, active membership) never implies teams.delete", async () => {
    tenantMembershipFindUnique.mockResolvedValue(activeMembership());
    userRoleFindMany.mockResolvedValue([makeFcAllschwilLegacyClubAdminRow([TEAMS_MANAGE])]);

    const deleteResult = await resolver.hasTenantDeletionAuthority({
      userId: CLUB_ADMIN_USER,
      permission: TEAMS_DELETE,
      tenantId: FC_ALLSCHWIL_TENANT_ID,
    });
    const manageResult = await resolver.hasPermission({
      userId: CLUB_ADMIN_USER,
      permission: TEAMS_MANAGE,
      tenantId: FC_ALLSCHWIL_TENANT_ID,
    });

    expect(deleteResult).toBe(false);
    expect(manageResult).toBe(true);
  });

  it("remains tenant-isolated — the grant on the fc-allschwil role never authorizes deletion in another tenant", async () => {
    // Active membership only in fc-allschwil, and the query is tenant-scoped
    // — a request against a different tenant id resolves zero UserRoles.
    tenantMembershipFindUnique.mockImplementation(
      (args: { where: { tenantId_userId: { tenantId: string } } }) =>
        Promise.resolve(
          args.where.tenantId_userId.tenantId === FC_ALLSCHWIL_TENANT_ID ? activeMembership() : null,
        ),
    );
    userRoleFindMany.mockImplementation((args: { where: { tenantId: string } }) =>
      Promise.resolve(
        args.where.tenantId === FC_ALLSCHWIL_TENANT_ID
          ? [makeFcAllschwilLegacyClubAdminRow([TEAMS_MANAGE, TEAMS_DELETE])]
          : [],
      ),
    );

    const result = await resolver.hasTenantDeletionAuthority({
      userId: CLUB_ADMIN_USER,
      permission: TEAMS_DELETE,
      tenantId: "tenant-some-other-club-id",
    });

    expect(result).toBe(false);
  });
});
