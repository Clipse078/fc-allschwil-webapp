/**
 * ADMIN-DELETE-01A-C1
 * Tests for lib/permissions/teams-delete-permission-reconciliation.ts
 *
 * Mirrors lib/permissions/__tests__/training-permission-reconciliation.test.ts's
 * mock-Prisma structure and test matrix, adapted for teams.delete's two
 * automatic-grant recipients (super_admin, and every already-materialized
 * per-tenant Club Admin role) rather than a static role list.
 *
 * Test matrix:
 *   A. Constant definitions
 *   B. First execution — permission created, super_admin + tenant Club Admin
 *      roles all assigned
 *   C. Idempotency — repeated execution on already-synced state is a no-op
 *   D. super_admin role not found — reported, does not throw
 *   E. No materialized tenant Club Admin roles exist yet — empty list, no error
 *   F. Dry-run mode — reports changes but makes no writes
 *   G. Multiple tenants — every materialized Club Admin role receives the grant
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  reconcileTeamsDeletePermission,
  TEAMS_DELETE_PERMISSION_DEF,
  TEAMS_DELETE_SUPER_ADMIN_ROLE_KEY,
  TENANT_CLUB_ADMIN_ROLE_KEY_PREFIX,
  FC_ALLSCHWIL_TENANT_KEY,
  FC_ALLSCHWIL_LEGACY_CLUB_ADMIN_ROLE_KEY,
} from "../teams-delete-permission-reconciliation";
import type { PrismaClient } from "@prisma/client";

// ── Mock Prisma client ─────────────────────────────────────────────────────────

function makeMockPrisma(overrides: {
  permissionFindUnique?: ReturnType<typeof vi.fn>;
  permissionUpsert?: ReturnType<typeof vi.fn>;
  roleFindUnique?: ReturnType<typeof vi.fn>;
  roleFindMany?: ReturnType<typeof vi.fn>;
  rolePermissionFindUnique?: ReturnType<typeof vi.fn>;
  rolePermissionUpsert?: ReturnType<typeof vi.fn>;
  tenantFindUnique?: ReturnType<typeof vi.fn>;
} = {}): PrismaClient {
  return {
    permission: {
      findUnique: overrides.permissionFindUnique ?? vi.fn().mockResolvedValue(null),
      upsert: overrides.permissionUpsert ?? vi.fn().mockResolvedValue({}),
    },
    role: {
      findUnique: overrides.roleFindUnique ?? vi.fn().mockResolvedValue(null),
      findMany: overrides.roleFindMany ?? vi.fn().mockResolvedValue([]),
    },
    rolePermission: {
      findUnique: overrides.rolePermissionFindUnique ?? vi.fn().mockResolvedValue(null),
      upsert: overrides.rolePermissionUpsert ?? vi.fn().mockResolvedValue({}),
    },
    tenant: {
      findUnique: overrides.tenantFindUnique ?? vi.fn().mockResolvedValue(null),
    },
  } as unknown as PrismaClient;
}

const SUPER_ADMIN_ROLE = { id: "role-super-admin" };
const FCA_CLUB_ADMIN_ROLE = { id: "role-club-admin-fca", key: "club_admin__fc-allschwil" };
const OTHER_CLUB_ADMIN_ROLE = { id: "role-club-admin-other", key: "club_admin__other-tenant" };
const TEAMS_DELETE_PERM = { id: "perm-teams-delete" };
const FCA_TENANT = { id: "tenant-fc-allschwil" };
const FCA_LEGACY_CLUB_ADMIN_ROLE = {
  id: "role-club-admin-fca-legacy",
  key: FC_ALLSCHWIL_LEGACY_CLUB_ADMIN_ROLE_KEY,
  scope: "TENANT",
  tenantId: FCA_TENANT.id,
};

// ── A. Constant definitions ────────────────────────────────────────────────────

describe("TEAMS_DELETE_PERMISSION_DEF — constants", () => {
  it("defines the teams.delete key with TENANT scope and grantableByAdmin true", () => {
    expect(TEAMS_DELETE_PERMISSION_DEF.key).toBe("teams.delete");
    expect(TEAMS_DELETE_PERMISSION_DEF.scope).toBe("TENANT");
    expect(TEAMS_DELETE_PERMISSION_DEF.grantableByAdmin).toBe(true);
  });

  it("uses the TEAMS module", () => {
    expect(TEAMS_DELETE_PERMISSION_DEF.module).toBe("TEAMS");
  });

  it("super_admin is the automatic PLATFORM recipient", () => {
    expect(TEAMS_DELETE_SUPER_ADMIN_ROLE_KEY).toBe("super_admin");
  });

  it("the tenant Club Admin role prefix matches lib/roles/tenant-role-keys.ts's convention", () => {
    expect(TENANT_CLUB_ADMIN_ROLE_KEY_PREFIX).toBe("club_admin__");
  });
});

// ── B. First execution ─────────────────────────────────────────────────────────

describe("reconcileTeamsDeletePermission — first execution (all new)", () => {
  let prisma: PrismaClient;

  beforeEach(() => {
    const roleFindUnique = vi.fn().mockImplementation(({ where }: { where: { key: string } }) => {
      if (where.key === "super_admin") return Promise.resolve(SUPER_ADMIN_ROLE);
      if (where.key === FCA_CLUB_ADMIN_ROLE.key) return Promise.resolve(FCA_CLUB_ADMIN_ROLE);
      return Promise.resolve(null);
    });
    const roleFindMany = vi.fn().mockResolvedValue([{ key: FCA_CLUB_ADMIN_ROLE.key }]);

    const createdPerms = new Set<string>();
    const permFindUnique = vi.fn().mockImplementation(() => {
      return Promise.resolve(createdPerms.has("teams.delete") ? TEAMS_DELETE_PERM : null);
    });
    const permUpsert = vi.fn().mockImplementation(({ create }: { create: { key: string } }) => {
      createdPerms.add(create.key);
      return Promise.resolve(TEAMS_DELETE_PERM);
    });

    prisma = makeMockPrisma({
      permissionFindUnique: permFindUnique,
      permissionUpsert: permUpsert,
      roleFindUnique,
      roleFindMany,
      rolePermissionFindUnique: vi.fn().mockResolvedValue(null),
      rolePermissionUpsert: vi.fn().mockResolvedValue({}),
    });
  });

  it("reports the permission as created", async () => {
    const result = await reconcileTeamsDeletePermission(prisma, false);
    expect(result.permission).toEqual({ action: "created", key: "teams.delete" });
  });

  it("assigns teams.delete to super_admin", async () => {
    const result = await reconcileTeamsDeletePermission(prisma, false);
    expect(result.superAdmin).toEqual({
      action: "assigned",
      roleKey: "super_admin",
      permissionKey: "teams.delete",
    });
  });

  it("assigns teams.delete to the materialized fc-allschwil Club Admin role", async () => {
    const result = await reconcileTeamsDeletePermission(prisma, false);
    expect(result.tenantClubAdminRoles).toEqual([
      { action: "assigned", roleKey: FCA_CLUB_ADMIN_ROLE.key, permissionKey: "teams.delete" },
    ]);
  });

  it("does not touch the FC Allschwil legacy compatibility path when the fc-allschwil tenant does not exist in this database", async () => {
    // tenantFindUnique defaults to null (not provided in this suite's setup)
    // — the legacy check must short-circuit and never call role.findUnique
    // for the legacy key.
    const result = await reconcileTeamsDeletePermission(prisma, false);
    expect(result.fcAllschwilLegacyClubAdmin).toBeNull();
    expect(prisma.role.findUnique).not.toHaveBeenCalledWith(
      expect.objectContaining({ where: { key: FC_ALLSCHWIL_LEGACY_CLUB_ADMIN_ROLE_KEY } }),
    );
  });

  it("only queries roles matching the club_admin__ prefix + isSystem TENANT filter", async () => {
    await reconcileTeamsDeletePermission(prisma, false);
    expect(prisma.role.findMany).toHaveBeenCalledWith({
      where: {
        scope: "TENANT",
        isSystem: true,
        key: { startsWith: "club_admin__" },
      },
      select: { key: true },
    });
  });

  it("upserts the Permission row with the exact seed.ts definition", async () => {
    await reconcileTeamsDeletePermission(prisma, false);
    expect(prisma.permission.upsert).toHaveBeenCalledWith({
      where: { key: "teams.delete" },
      update: { name: "Permanently delete teams", module: "TEAMS", scope: "TENANT", grantableByAdmin: true },
      create: { key: "teams.delete", name: "Permanently delete teams", module: "TEAMS", scope: "TENANT", grantableByAdmin: true },
    });
  });
});

// ── C. Idempotency ──────────────────────────────────────────────────────────────

describe("reconcileTeamsDeletePermission — idempotency (already synced)", () => {
  it("reports already_exists / already_assigned on a second run, still no throw", async () => {
    const roleFindUnique = vi.fn().mockImplementation(({ where }: { where: { key: string } }) => {
      if (where.key === "super_admin") return Promise.resolve(SUPER_ADMIN_ROLE);
      if (where.key === FCA_CLUB_ADMIN_ROLE.key) return Promise.resolve(FCA_CLUB_ADMIN_ROLE);
      return Promise.resolve(null);
    });

    const prisma = makeMockPrisma({
      permissionFindUnique: vi.fn().mockResolvedValue({
        id: TEAMS_DELETE_PERM.id,
        name: "Permanently delete teams",
        module: "TEAMS",
        scope: "TENANT",
        grantableByAdmin: true,
      }),
      permissionUpsert: vi.fn().mockResolvedValue(TEAMS_DELETE_PERM),
      roleFindUnique,
      roleFindMany: vi.fn().mockResolvedValue([{ key: FCA_CLUB_ADMIN_ROLE.key }]),
      rolePermissionFindUnique: vi.fn().mockResolvedValue({ roleId: "some-role-id" }),
      rolePermissionUpsert: vi.fn().mockResolvedValue({}),
    });

    const result = await reconcileTeamsDeletePermission(prisma, false);

    expect(result.permission).toEqual({ action: "already_exists", key: "teams.delete" });
    expect(result.superAdmin).toEqual({
      action: "already_assigned",
      roleKey: "super_admin",
      permissionKey: "teams.delete",
    });
    expect(result.tenantClubAdminRoles).toEqual([
      { action: "already_assigned", roleKey: FCA_CLUB_ADMIN_ROLE.key, permissionKey: "teams.delete" },
    ]);
    expect(result.fcAllschwilLegacyClubAdmin).toBeNull();

    // Upserts are still safe/idempotent even though nothing changed.
    expect(prisma.permission.upsert).toHaveBeenCalledTimes(1);
  });
});

// ── D. Role not found ────────────────────────────────────────────────────────────

describe("reconcileTeamsDeletePermission — super_admin role missing", () => {
  it("reports role_not_found instead of throwing", async () => {
    const prisma = makeMockPrisma({
      permissionFindUnique: vi.fn().mockResolvedValue(null),
      permissionUpsert: vi.fn().mockResolvedValue(TEAMS_DELETE_PERM),
      roleFindUnique: vi.fn().mockResolvedValue(null),
      roleFindMany: vi.fn().mockResolvedValue([]),
    });

    const result = await reconcileTeamsDeletePermission(prisma, false);

    expect(result.superAdmin).toEqual({
      action: "role_not_found",
      roleKey: "super_admin",
      permissionKey: "teams.delete",
    });
  });
});

// ── E. No materialized tenant Club Admin roles yet ──────────────────────────────

describe("reconcileTeamsDeletePermission — no tenant Club Admin roles exist yet", () => {
  it("returns an empty tenantClubAdminRoles list without error", async () => {
    const prisma = makeMockPrisma({
      permissionFindUnique: vi.fn().mockResolvedValue(null),
      permissionUpsert: vi.fn().mockResolvedValue(TEAMS_DELETE_PERM),
      roleFindUnique: vi.fn().mockImplementation(({ where }: { where: { key: string } }) =>
        Promise.resolve(where.key === "super_admin" ? SUPER_ADMIN_ROLE : null),
      ),
      roleFindMany: vi.fn().mockResolvedValue([]),
      rolePermissionFindUnique: vi.fn().mockResolvedValue(null),
      rolePermissionUpsert: vi.fn().mockResolvedValue({}),
    });

    const result = await reconcileTeamsDeletePermission(prisma, false);

    expect(result.tenantClubAdminRoles).toEqual([]);
  });
});

// ── F. Dry-run mode ──────────────────────────────────────────────────────────────

describe("reconcileTeamsDeletePermission — dry run", () => {
  it("reports would-create/would-assign but performs no writes", async () => {
    const prisma = makeMockPrisma({
      permissionFindUnique: vi.fn().mockResolvedValue(null),
      permissionUpsert: vi.fn().mockResolvedValue(TEAMS_DELETE_PERM),
      roleFindUnique: vi.fn().mockImplementation(({ where }: { where: { key: string } }) =>
        Promise.resolve(where.key === "super_admin" ? SUPER_ADMIN_ROLE : null),
      ),
      roleFindMany: vi.fn().mockResolvedValue([]),
      rolePermissionFindUnique: vi.fn().mockResolvedValue(null),
      rolePermissionUpsert: vi.fn().mockResolvedValue({}),
    });

    const result = await reconcileTeamsDeletePermission(prisma, true);

    expect(result.permission).toEqual({ action: "created", key: "teams.delete" });
    // super_admin permission lookup returns null in dry run (never upserted),
    // so the assignment step correctly reports permission_not_in_db instead
    // of fabricating a grant against a non-existent row.
    expect(result.superAdmin).toEqual({
      action: "permission_not_in_db",
      roleKey: "super_admin",
      permissionKey: "teams.delete",
    });
    expect(prisma.permission.upsert).not.toHaveBeenCalled();
    expect(prisma.rolePermission.upsert).not.toHaveBeenCalled();
  });
});

// ── G. Multiple tenants ──────────────────────────────────────────────────────────

describe("reconcileTeamsDeletePermission — multiple tenant Club Admin roles", () => {
  it("assigns teams.delete to every materialized tenant Club Admin role", async () => {
    const roleFindUnique = vi.fn().mockImplementation(({ where }: { where: { key: string } }) => {
      if (where.key === "super_admin") return Promise.resolve(SUPER_ADMIN_ROLE);
      if (where.key === FCA_CLUB_ADMIN_ROLE.key) return Promise.resolve(FCA_CLUB_ADMIN_ROLE);
      if (where.key === OTHER_CLUB_ADMIN_ROLE.key) return Promise.resolve(OTHER_CLUB_ADMIN_ROLE);
      return Promise.resolve(null);
    });

    const prisma = makeMockPrisma({
      permissionFindUnique: vi.fn().mockResolvedValue(TEAMS_DELETE_PERM),
      permissionUpsert: vi.fn().mockResolvedValue(TEAMS_DELETE_PERM),
      roleFindUnique,
      roleFindMany: vi.fn().mockResolvedValue([
        { key: FCA_CLUB_ADMIN_ROLE.key },
        { key: OTHER_CLUB_ADMIN_ROLE.key },
      ]),
      rolePermissionFindUnique: vi.fn().mockResolvedValue(null),
      rolePermissionUpsert: vi.fn().mockResolvedValue({}),
    });

    const result = await reconcileTeamsDeletePermission(prisma, false);

    expect(result.tenantClubAdminRoles).toEqual([
      { action: "assigned", roleKey: FCA_CLUB_ADMIN_ROLE.key, permissionKey: "teams.delete" },
      { action: "assigned", roleKey: OTHER_CLUB_ADMIN_ROLE.key, permissionKey: "teams.delete" },
    ]);
  });

  it("never touches a non-club_admin tenant role (e.g. a custom delegated role)", async () => {
    // The role.findMany query filter itself is what enforces this — a
    // custom/delegated role never matches the `club_admin__` prefix +
    // isSystem filter — asserted again here as a behavioral regression
    // guard independent of the constant-level assertion above.
    const roleFindMany = vi.fn().mockResolvedValue([{ key: FCA_CLUB_ADMIN_ROLE.key }]);
    const prisma = makeMockPrisma({
      permissionFindUnique: vi.fn().mockResolvedValue(TEAMS_DELETE_PERM),
      permissionUpsert: vi.fn().mockResolvedValue(TEAMS_DELETE_PERM),
      roleFindUnique: vi.fn().mockImplementation(({ where }: { where: { key: string } }) => {
        if (where.key === "super_admin") return Promise.resolve(SUPER_ADMIN_ROLE);
        if (where.key === FCA_CLUB_ADMIN_ROLE.key) return Promise.resolve(FCA_CLUB_ADMIN_ROLE);
        return Promise.resolve(null);
      }),
      roleFindMany,
      rolePermissionFindUnique: vi.fn().mockResolvedValue(null),
      rolePermissionUpsert: vi.fn().mockResolvedValue({}),
    });

    const result = await reconcileTeamsDeletePermission(prisma, false);

    const roleKeys = result.tenantClubAdminRoles.map((o) => o.roleKey);
    expect(roleKeys).toEqual([FCA_CLUB_ADMIN_ROLE.key]);
    expect(roleKeys).not.toContain("some_custom_delegated_role");
  });
});

// ── H. ADMIN-DELETE-01B-C1 — FC Allschwil legacy Club Admin compatibility ────────
//
// Reproduces the exact STAGE finding: the actually-assigned FC Allschwil Club
// Admin role is `club_admin_fc_allschwil` (scope=TENANT, isSystem=false),
// which never matches Step 3's `club_admin__` canonical-prefix search.

function makeLegacyFcaMockPrisma(overrides: {
  tenantFindUnique?: ReturnType<typeof vi.fn>;
  roleFindUnique?: ReturnType<typeof vi.fn>;
  rolePermissionFindUnique?: ReturnType<typeof vi.fn>;
  permissionFindUnique?: ReturnType<typeof vi.fn>;
} = {}): PrismaClient {
  return makeMockPrisma({
    permissionFindUnique: overrides.permissionFindUnique ?? vi.fn().mockResolvedValue(TEAMS_DELETE_PERM),
    permissionUpsert: vi.fn().mockResolvedValue(TEAMS_DELETE_PERM),
    roleFindUnique:
      overrides.roleFindUnique ??
      vi.fn().mockImplementation(({ where }: { where: { key: string } }) => {
        if (where.key === "super_admin") return Promise.resolve(SUPER_ADMIN_ROLE);
        if (where.key === FC_ALLSCHWIL_LEGACY_CLUB_ADMIN_ROLE_KEY) {
          return Promise.resolve(FCA_LEGACY_CLUB_ADMIN_ROLE);
        }
        return Promise.resolve(null);
      }),
    roleFindMany: vi.fn().mockResolvedValue([]),
    rolePermissionFindUnique: overrides.rolePermissionFindUnique ?? vi.fn().mockResolvedValue(null),
    rolePermissionUpsert: vi.fn().mockResolvedValue({}),
    tenantFindUnique:
      overrides.tenantFindUnique ??
      vi.fn().mockImplementation(({ where }: { where: { key: string } }) =>
        Promise.resolve(where.key === FC_ALLSCHWIL_TENANT_KEY ? FCA_TENANT : null),
      ),
  });
}

describe("reconcileTeamsDeletePermission — FC Allschwil legacy Club Admin recognition", () => {
  it("assigns teams.delete to club_admin_fc_allschwil when it is scope=TENANT and owned by the real fc-allschwil tenant", async () => {
    const prisma = makeLegacyFcaMockPrisma();

    const result = await reconcileTeamsDeletePermission(prisma, false);

    expect(result.fcAllschwilLegacyClubAdmin).toEqual({
      action: "assigned",
      roleKey: FC_ALLSCHWIL_LEGACY_CLUB_ADMIN_ROLE_KEY,
      permissionKey: "teams.delete",
    });
  });

  it("looks up the fc-allschwil tenant by its known key before trusting the legacy role", async () => {
    const prisma = makeLegacyFcaMockPrisma();
    await reconcileTeamsDeletePermission(prisma, false);
    expect(prisma.tenant.findUnique).toHaveBeenCalledWith({
      where: { key: FC_ALLSCHWIL_TENANT_KEY },
      select: { id: true },
    });
  });

  it("is idempotent — reports already_assigned on a second run without duplicate writes", async () => {
    const prisma = makeLegacyFcaMockPrisma({
      rolePermissionFindUnique: vi.fn().mockResolvedValue({ roleId: "some-role-id" }),
    });

    const first = await reconcileTeamsDeletePermission(prisma, false);
    const second = await reconcileTeamsDeletePermission(prisma, false);

    expect(first.fcAllschwilLegacyClubAdmin).toEqual({
      action: "already_assigned",
      roleKey: FC_ALLSCHWIL_LEGACY_CLUB_ADMIN_ROLE_KEY,
      permissionKey: "teams.delete",
    });
    expect(second.fcAllschwilLegacyClubAdmin).toEqual(first.fcAllschwilLegacyClubAdmin);
  });

  it("dry-run mode reports the pending grant without writing", async () => {
    const prisma = makeLegacyFcaMockPrisma();

    const result = await reconcileTeamsDeletePermission(prisma, true);

    expect(result.fcAllschwilLegacyClubAdmin).toEqual({
      action: "assigned",
      roleKey: FC_ALLSCHWIL_LEGACY_CLUB_ADMIN_ROLE_KEY,
      permissionKey: "teams.delete",
    });
    expect(prisma.rolePermission.upsert).not.toHaveBeenCalled();
  });

  it("never touches the legacy role when the fc-allschwil tenant does not exist in this database", async () => {
    const prisma = makeLegacyFcaMockPrisma({
      tenantFindUnique: vi.fn().mockResolvedValue(null),
    });

    const result = await reconcileTeamsDeletePermission(prisma, false);

    expect(result.fcAllschwilLegacyClubAdmin).toBeNull();
  });

  it("never grants when the role key exists but its scope is not TENANT", async () => {
    const platformScopedImposter = { ...FCA_LEGACY_CLUB_ADMIN_ROLE, scope: "PLATFORM" };
    const prisma = makeLegacyFcaMockPrisma({
      roleFindUnique: vi.fn().mockImplementation(({ where }: { where: { key: string } }) => {
        if (where.key === "super_admin") return Promise.resolve(SUPER_ADMIN_ROLE);
        if (where.key === FC_ALLSCHWIL_LEGACY_CLUB_ADMIN_ROLE_KEY) {
          return Promise.resolve(platformScopedImposter);
        }
        return Promise.resolve(null);
      }),
    });

    const result = await reconcileTeamsDeletePermission(prisma, false);

    expect(result.fcAllschwilLegacyClubAdmin).toBeNull();
  });

  it("never grants when the role key exists but belongs to a different tenant", async () => {
    const wrongTenantImposter = { ...FCA_LEGACY_CLUB_ADMIN_ROLE, tenantId: "tenant-someone-else" };
    const prisma = makeLegacyFcaMockPrisma({
      roleFindUnique: vi.fn().mockImplementation(({ where }: { where: { key: string } }) => {
        if (where.key === "super_admin") return Promise.resolve(SUPER_ADMIN_ROLE);
        if (where.key === FC_ALLSCHWIL_LEGACY_CLUB_ADMIN_ROLE_KEY) {
          return Promise.resolve(wrongTenantImposter);
        }
        return Promise.resolve(null);
      }),
    });

    const result = await reconcileTeamsDeletePermission(prisma, false);

    expect(result.fcAllschwilLegacyClubAdmin).toBeNull();
  });

  it("never grants when no role exists at the exact legacy key", async () => {
    const prisma = makeLegacyFcaMockPrisma({
      roleFindUnique: vi.fn().mockImplementation(({ where }: { where: { key: string } }) =>
        Promise.resolve(where.key === "super_admin" ? SUPER_ADMIN_ROLE : null),
      ),
    });

    const result = await reconcileTeamsDeletePermission(prisma, false);

    expect(result.fcAllschwilLegacyClubAdmin).toBeNull();
  });

  it("never widens the match to an unrelated custom role with a merely similar key", async () => {
    // A custom/delegated role such as "club_admin_fc_allschwil_readonly" or
    // "club_admin_other_club" must NEVER be recognized — the lookup is an
    // exact-literal `Role.key` equality check, not a prefix/pattern match.
    const unrelatedCustomRole = {
      id: "role-custom-imposter",
      key: "club_admin_fc_allschwil_readonly",
      scope: "TENANT",
      tenantId: FCA_TENANT.id,
    };
    const prisma = makeLegacyFcaMockPrisma({
      roleFindUnique: vi.fn().mockImplementation(({ where }: { where: { key: string } }) => {
        if (where.key === "super_admin") return Promise.resolve(SUPER_ADMIN_ROLE);
        // The reconciliation only ever queries the exact literal key — a
        // mock that also (incorrectly) matched a near-miss key would mean
        // this test's own setup is broken, not the implementation, so we
        // deliberately return null for anything but the exact literal.
        if (where.key === FC_ALLSCHWIL_LEGACY_CLUB_ADMIN_ROLE_KEY) return Promise.resolve(null);
        return Promise.resolve(unrelatedCustomRole.key === where.key ? unrelatedCustomRole : null);
      }),
    });

    const result = await reconcileTeamsDeletePermission(prisma, false);

    expect(result.fcAllschwilLegacyClubAdmin).toBeNull();
    expect(prisma.role.findUnique).not.toHaveBeenCalledWith(
      expect.objectContaining({ where: { key: unrelatedCustomRole.key } }),
    );
  });
});
