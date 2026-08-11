/**
 * ADMIN-DELETE-02A
 * Tests for lib/permissions/planning-modules-delete-permission-reconciliation.ts
 *
 * Mirrors lib/permissions/__tests__/teams-delete-permission-reconciliation.test.ts's
 * mock-Prisma structure and test matrix (ADMIN-DELETE-01A/01B), adapted for
 * the three ADMIN-DELETE-02A permissions (trainings.delete, matches.delete,
 * tournaments.delete) reconciled together.
 *
 * Test matrix:
 *   A. Constant definitions
 *   B. First execution — permission created, super_admin + tenant Club
 *      Admin roles all assigned, for every one of the three permissions
 *   C. Idempotency — repeated execution on already-synced state is a no-op
 *   D. super_admin role not found — reported, does not throw
 *   E. No materialized tenant Club Admin roles exist yet — empty list
 *   F. Dry-run mode — reports changes but makes no writes
 *   G. Multiple tenants — every materialized Club Admin role receives the grant
 *   H. Never grants to a non-club_admin custom/delegated role
 */

import { describe, it, expect, vi } from "vitest";
import {
  reconcilePlanningDeletePermission,
  reconcilePlanningDeletePermissions,
  PLANNING_DELETE_PERMISSION_DEFS,
  TRAININGS_DELETE_PERMISSION_DEF,
  MATCHES_DELETE_PERMISSION_DEF,
  TOURNAMENTS_DELETE_PERMISSION_DEF,
  PLANNING_DELETE_SUPER_ADMIN_ROLE_KEY,
  TENANT_CLUB_ADMIN_ROLE_KEY_PREFIX,
} from "../planning-modules-delete-permission-reconciliation";
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

// ── A. Constant definitions ────────────────────────────────────────────────────

describe("PLANNING_DELETE_PERMISSION_DEFS — constants", () => {
  it("defines all three keys with TENANT scope and grantableByAdmin true", () => {
    expect(TRAININGS_DELETE_PERMISSION_DEF.key).toBe("trainings.delete");
    expect(MATCHES_DELETE_PERMISSION_DEF.key).toBe("matches.delete");
    expect(TOURNAMENTS_DELETE_PERMISSION_DEF.key).toBe("tournaments.delete");

    for (const def of PLANNING_DELETE_PERMISSION_DEFS) {
      expect(def.scope).toBe("TENANT");
      expect(def.grantableByAdmin).toBe(true);
    }
  });

  it("trainings.delete uses the TRAININGS module; matches/tournaments.delete use EVENTS", () => {
    expect(TRAININGS_DELETE_PERMISSION_DEF.module).toBe("TRAININGS");
    expect(MATCHES_DELETE_PERMISSION_DEF.module).toBe("EVENTS");
    expect(TOURNAMENTS_DELETE_PERMISSION_DEF.module).toBe("EVENTS");
  });

  it("super_admin is the automatic PLATFORM recipient", () => {
    expect(PLANNING_DELETE_SUPER_ADMIN_ROLE_KEY).toBe("super_admin");
  });

  it("the tenant Club Admin role prefix matches lib/roles/tenant-role-keys.ts's convention", () => {
    expect(TENANT_CLUB_ADMIN_ROLE_KEY_PREFIX).toBe("club_admin__");
  });
});

// ── B. First execution ─────────────────────────────────────────────────────────

describe("reconcilePlanningDeletePermissions — first execution (all new)", () => {
  function makePrismaForFirstRun() {
    const roleFindUnique = vi.fn().mockImplementation(({ where }: { where: { key: string } }) => {
      if (where.key === "super_admin") return Promise.resolve(SUPER_ADMIN_ROLE);
      if (where.key === FCA_CLUB_ADMIN_ROLE.key) return Promise.resolve(FCA_CLUB_ADMIN_ROLE);
      return Promise.resolve(null);
    });
    const roleFindMany = vi.fn().mockResolvedValue([{ key: FCA_CLUB_ADMIN_ROLE.key }]);

    const createdPerms = new Set<string>();
    const permFindUnique = vi.fn().mockImplementation((args: { where: { key: string } }) => {
      return Promise.resolve(createdPerms.has(args.where.key) ? { id: `perm-${args.where.key}` } : null);
    });
    const permUpsert = vi.fn().mockImplementation(({ create }: { create: { key: string } }) => {
      createdPerms.add(create.key);
      return Promise.resolve({ id: `perm-${create.key}` });
    });

    return makeMockPrisma({
      permissionFindUnique: permFindUnique,
      permissionUpsert: permUpsert,
      roleFindUnique,
      roleFindMany,
      rolePermissionFindUnique: vi.fn().mockResolvedValue(null),
      rolePermissionUpsert: vi.fn().mockResolvedValue({}),
    });
  }

  it("reports every permission as created", async () => {
    const prisma = makePrismaForFirstRun();
    const results = await reconcilePlanningDeletePermissions(prisma, false);

    expect(results.map((r) => r.permission)).toEqual([
      { action: "created", key: "trainings.delete" },
      { action: "created", key: "matches.delete" },
      { action: "created", key: "tournaments.delete" },
    ]);
  });

  it("assigns every permission to super_admin", async () => {
    const prisma = makePrismaForFirstRun();
    const results = await reconcilePlanningDeletePermissions(prisma, false);

    for (const result of results) {
      expect(result.superAdmin).toEqual({
        action: "assigned",
        roleKey: "super_admin",
        permissionKey: result.key,
      });
    }
  });

  it("assigns every permission to the materialized fc-allschwil Club Admin role", async () => {
    const prisma = makePrismaForFirstRun();
    const results = await reconcilePlanningDeletePermissions(prisma, false);

    for (const result of results) {
      expect(result.tenantClubAdminRoles).toEqual([
        { action: "assigned", roleKey: FCA_CLUB_ADMIN_ROLE.key, permissionKey: result.key },
      ]);
    }
  });

  it("only queries roles matching the club_admin__ prefix + isSystem TENANT filter", async () => {
    const prisma = makePrismaForFirstRun();
    await reconcilePlanningDeletePermissions(prisma, false);

    expect(prisma.role.findMany).toHaveBeenCalledWith({
      where: {
        scope: "TENANT",
        isSystem: true,
        key: { startsWith: "club_admin__" },
      },
      select: { key: true },
    });
  });

  it("upserts each Permission row with the exact seed.ts definition", async () => {
    const prisma = makePrismaForFirstRun();
    await reconcilePlanningDeletePermissions(prisma, false);

    expect(prisma.permission.upsert).toHaveBeenCalledWith({
      where: { key: "trainings.delete" },
      update: { name: "Permanently delete trainings", module: "TRAININGS", scope: "TENANT", grantableByAdmin: true },
      create: { key: "trainings.delete", name: "Permanently delete trainings", module: "TRAININGS", scope: "TENANT", grantableByAdmin: true },
    });
    expect(prisma.permission.upsert).toHaveBeenCalledWith({
      where: { key: "matches.delete" },
      update: { name: "Permanently delete matches", module: "EVENTS", scope: "TENANT", grantableByAdmin: true },
      create: { key: "matches.delete", name: "Permanently delete matches", module: "EVENTS", scope: "TENANT", grantableByAdmin: true },
    });
    expect(prisma.permission.upsert).toHaveBeenCalledWith({
      where: { key: "tournaments.delete" },
      update: { name: "Permanently delete tournaments", module: "EVENTS", scope: "TENANT", grantableByAdmin: true },
      create: { key: "tournaments.delete", name: "Permanently delete tournaments", module: "EVENTS", scope: "TENANT", grantableByAdmin: true },
    });
  });
});

// ── C. Idempotency ──────────────────────────────────────────────────────────────

describe("reconcilePlanningDeletePermission — idempotency (already synced)", () => {
  it("reports already_exists / already_assigned on a second run, still no throw", async () => {
    const roleFindUnique = vi.fn().mockImplementation(({ where }: { where: { key: string } }) => {
      if (where.key === "super_admin") return Promise.resolve(SUPER_ADMIN_ROLE);
      if (where.key === FCA_CLUB_ADMIN_ROLE.key) return Promise.resolve(FCA_CLUB_ADMIN_ROLE);
      return Promise.resolve(null);
    });

    const prisma = makeMockPrisma({
      permissionFindUnique: vi.fn().mockResolvedValue({
        id: "perm-trainings-delete",
        name: "Permanently delete trainings",
        module: "TRAININGS",
        scope: "TENANT",
        grantableByAdmin: true,
      }),
      permissionUpsert: vi.fn().mockResolvedValue({ id: "perm-trainings-delete" }),
      roleFindUnique,
      roleFindMany: vi.fn().mockResolvedValue([{ key: FCA_CLUB_ADMIN_ROLE.key }]),
      rolePermissionFindUnique: vi.fn().mockResolvedValue({ roleId: "some-role-id" }),
      rolePermissionUpsert: vi.fn().mockResolvedValue({}),
    });

    const result = await reconcilePlanningDeletePermission(prisma, TRAININGS_DELETE_PERMISSION_DEF, false);

    expect(result.permission).toEqual({ action: "already_exists", key: "trainings.delete" });
    expect(result.superAdmin).toEqual({
      action: "already_assigned",
      roleKey: "super_admin",
      permissionKey: "trainings.delete",
    });
    expect(result.tenantClubAdminRoles).toEqual([
      { action: "already_assigned", roleKey: FCA_CLUB_ADMIN_ROLE.key, permissionKey: "trainings.delete" },
    ]);

    expect(prisma.permission.upsert).toHaveBeenCalledTimes(1);
  });
});

// ── D. Role not found ────────────────────────────────────────────────────────────

describe("reconcilePlanningDeletePermission — super_admin role missing", () => {
  it("reports role_not_found instead of throwing", async () => {
    const prisma = makeMockPrisma({
      permissionFindUnique: vi.fn().mockResolvedValue(null),
      permissionUpsert: vi.fn().mockResolvedValue({ id: "perm-1" }),
      roleFindUnique: vi.fn().mockResolvedValue(null),
      roleFindMany: vi.fn().mockResolvedValue([]),
    });

    const result = await reconcilePlanningDeletePermission(prisma, MATCHES_DELETE_PERMISSION_DEF, false);

    expect(result.superAdmin).toEqual({
      action: "role_not_found",
      roleKey: "super_admin",
      permissionKey: "matches.delete",
    });
  });
});

// ── E. No materialized tenant Club Admin roles yet ──────────────────────────────

describe("reconcilePlanningDeletePermission — no tenant Club Admin roles exist yet", () => {
  it("returns an empty tenantClubAdminRoles list without error", async () => {
    const prisma = makeMockPrisma({
      permissionFindUnique: vi.fn().mockResolvedValue(null),
      permissionUpsert: vi.fn().mockResolvedValue({ id: "perm-1" }),
      roleFindUnique: vi.fn().mockImplementation(({ where }: { where: { key: string } }) =>
        Promise.resolve(where.key === "super_admin" ? SUPER_ADMIN_ROLE : null),
      ),
      roleFindMany: vi.fn().mockResolvedValue([]),
      rolePermissionFindUnique: vi.fn().mockResolvedValue(null),
      rolePermissionUpsert: vi.fn().mockResolvedValue({}),
    });

    const result = await reconcilePlanningDeletePermission(prisma, TOURNAMENTS_DELETE_PERMISSION_DEF, false);

    expect(result.tenantClubAdminRoles).toEqual([]);
  });
});

// ── F. Dry-run mode ──────────────────────────────────────────────────────────────

describe("reconcilePlanningDeletePermission — dry run", () => {
  it("reports would-create/would-assign but performs no writes", async () => {
    const prisma = makeMockPrisma({
      permissionFindUnique: vi.fn().mockResolvedValue(null),
      permissionUpsert: vi.fn().mockResolvedValue({ id: "perm-1" }),
      roleFindUnique: vi.fn().mockImplementation(({ where }: { where: { key: string } }) =>
        Promise.resolve(where.key === "super_admin" ? SUPER_ADMIN_ROLE : null),
      ),
      roleFindMany: vi.fn().mockResolvedValue([]),
      rolePermissionFindUnique: vi.fn().mockResolvedValue(null),
      rolePermissionUpsert: vi.fn().mockResolvedValue({}),
    });

    const result = await reconcilePlanningDeletePermission(prisma, TRAININGS_DELETE_PERMISSION_DEF, true);

    expect(result.permission).toEqual({ action: "created", key: "trainings.delete" });
    // super_admin permission lookup returns null in dry run (never
    // upserted), so the assignment step correctly reports
    // permission_not_in_db instead of fabricating a grant.
    expect(result.superAdmin).toEqual({
      action: "permission_not_in_db",
      roleKey: "super_admin",
      permissionKey: "trainings.delete",
    });
    expect(prisma.permission.upsert).not.toHaveBeenCalled();
    expect(prisma.rolePermission.upsert).not.toHaveBeenCalled();
  });
});

// ── G. Multiple tenants ──────────────────────────────────────────────────────────

describe("reconcilePlanningDeletePermission — multiple tenant Club Admin roles", () => {
  it("assigns the permission to every materialized tenant Club Admin role", async () => {
    const roleFindUnique = vi.fn().mockImplementation(({ where }: { where: { key: string } }) => {
      if (where.key === "super_admin") return Promise.resolve(SUPER_ADMIN_ROLE);
      if (where.key === FCA_CLUB_ADMIN_ROLE.key) return Promise.resolve(FCA_CLUB_ADMIN_ROLE);
      if (where.key === OTHER_CLUB_ADMIN_ROLE.key) return Promise.resolve(OTHER_CLUB_ADMIN_ROLE);
      return Promise.resolve(null);
    });

    const prisma = makeMockPrisma({
      permissionFindUnique: vi.fn().mockResolvedValue({ id: "perm-1" }),
      permissionUpsert: vi.fn().mockResolvedValue({ id: "perm-1" }),
      roleFindUnique,
      roleFindMany: vi.fn().mockResolvedValue([
        { key: FCA_CLUB_ADMIN_ROLE.key },
        { key: OTHER_CLUB_ADMIN_ROLE.key },
      ]),
      rolePermissionFindUnique: vi.fn().mockResolvedValue(null),
      rolePermissionUpsert: vi.fn().mockResolvedValue({}),
    });

    const result = await reconcilePlanningDeletePermission(prisma, MATCHES_DELETE_PERMISSION_DEF, false);

    expect(result.tenantClubAdminRoles).toEqual([
      { action: "assigned", roleKey: FCA_CLUB_ADMIN_ROLE.key, permissionKey: "matches.delete" },
      { action: "assigned", roleKey: OTHER_CLUB_ADMIN_ROLE.key, permissionKey: "matches.delete" },
    ]);
  });
});

// ── H. Never grants to a non-club_admin custom/delegated role ───────────────────

describe("reconcilePlanningDeletePermission — never touches an unrelated custom role", () => {
  it("the role.findMany query filter itself excludes any non-club_admin__ role", async () => {
    const roleFindMany = vi.fn().mockResolvedValue([{ key: FCA_CLUB_ADMIN_ROLE.key }]);
    const prisma = makeMockPrisma({
      permissionFindUnique: vi.fn().mockResolvedValue({ id: "perm-1" }),
      permissionUpsert: vi.fn().mockResolvedValue({ id: "perm-1" }),
      roleFindUnique: vi.fn().mockImplementation(({ where }: { where: { key: string } }) => {
        if (where.key === "super_admin") return Promise.resolve(SUPER_ADMIN_ROLE);
        if (where.key === FCA_CLUB_ADMIN_ROLE.key) return Promise.resolve(FCA_CLUB_ADMIN_ROLE);
        return Promise.resolve(null);
      }),
      roleFindMany,
      rolePermissionFindUnique: vi.fn().mockResolvedValue(null),
      rolePermissionUpsert: vi.fn().mockResolvedValue({}),
    });

    const result = await reconcilePlanningDeletePermission(prisma, TOURNAMENTS_DELETE_PERMISSION_DEF, false);

    const roleKeys = result.tenantClubAdminRoles.map((o) => o.roleKey);
    expect(roleKeys).toEqual([FCA_CLUB_ADMIN_ROLE.key]);
    expect(roleKeys).not.toContain("match_coordinator");
    expect(roleKeys).not.toContain("trainer");
  });
});
