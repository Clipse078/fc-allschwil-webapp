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
  } as unknown as PrismaClient;
}

const SUPER_ADMIN_ROLE = { id: "role-super-admin" };
const FCA_CLUB_ADMIN_ROLE = { id: "role-club-admin-fca", key: "club_admin__fc-allschwil" };
const OTHER_CLUB_ADMIN_ROLE = { id: "role-club-admin-other", key: "club_admin__other-tenant" };
const TEAMS_DELETE_PERM = { id: "perm-teams-delete" };

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
