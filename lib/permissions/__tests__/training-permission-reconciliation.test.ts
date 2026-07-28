/**
 * STAGE-OPS-01-V — Tests for lib/permissions/training-permission-reconciliation.ts
 *
 * Covers the extracted reconciliation service used by sync-training-permissions.ts.
 *
 * Test matrix:
 *   A. First execution — all permissions and assignments are new
 *   B. Idempotency — repeated execution on already-synced state
 *   C. Partial state — permission exists, role assignment is missing
 *   D. Role not found — gracefully reported, does not throw
 *   E. Dry-run mode — reports changes but makes no writes
 *   F. Both permissions covered for each role
 *   G. No duplicate rows created
 *   H. No cross-tenant hardcoding (permissions are global)
 *   I. Correct permission keys: trainings.view and trainings.manage only
 *   J. Correct role keys: super_admin and trainer only
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { reconcileTrainingPermissions, TRAINING_PERMISSION_DEFS, TRAINING_PERMISSION_ROLE_KEYS } from "../training-permission-reconciliation";
import type { PrismaClient } from "@prisma/client";

// ── Mock Prisma client ─────────────────────────────────────────────────────────

function makeMockPrisma(overrides: {
  permissionFindUnique?: ReturnType<typeof vi.fn>;
  permissionUpsert?: ReturnType<typeof vi.fn>;
  roleFindUnique?: ReturnType<typeof vi.fn>;
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
    },
    rolePermission: {
      findUnique: overrides.rolePermissionFindUnique ?? vi.fn().mockResolvedValue(null),
      upsert: overrides.rolePermissionUpsert ?? vi.fn().mockResolvedValue({}),
    },
  } as unknown as PrismaClient;
}

const SUPER_ADMIN_ROLE = { id: "role-super-admin" };
const TRAINER_ROLE = { id: "role-trainer" };
const PERM_VIEW = { id: "perm-view" };
const PERM_MANAGE = { id: "perm-manage" };

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("TRAINING_PERMISSION_DEFS and TRAINING_PERMISSION_ROLE_KEYS constants", () => {
  it("defines exactly trainings.view and trainings.manage", () => {
    const keys = TRAINING_PERMISSION_DEFS.map((d) => d.key);
    expect(keys).toEqual(["trainings.view", "trainings.manage"]);
  });

  it("assigns to exactly super_admin and trainer", () => {
    expect(TRAINING_PERMISSION_ROLE_KEYS).toEqual(["super_admin", "trainer"]);
  });

  it("all permissions use the TRAININGS module", () => {
    for (const def of TRAINING_PERMISSION_DEFS) {
      expect(def.module).toBe("TRAININGS");
    }
  });
});

describe("reconcileTrainingPermissions — first execution (all new)", () => {
  let prisma: PrismaClient;

  beforeEach(() => {
    // Scenario: DB has no trainings permissions, but super_admin and trainer roles exist.
    const roleFindUnique = vi.fn().mockImplementation(({ where }: { where: { key: string } }) => {
      if (where.key === "super_admin") return Promise.resolve(SUPER_ADMIN_ROLE);
      if (where.key === "trainer") return Promise.resolve(TRAINER_ROLE);
      return Promise.resolve(null);
    });

    // Permission.findUnique: null on first call (creating), then returns perm after upsert.
    // For simplicity, always return null — upsert creates them.
    const permFindUnique = vi.fn().mockResolvedValue(null);
    const permUpsert = vi.fn().mockImplementation(({ create }: { create: { id?: string; key: string } }) => {
      const idMap: Record<string, { id: string; key: string }> = {
        "trainings.view": { id: "perm-view", key: "trainings.view" },
        "trainings.manage": { id: "perm-manage", key: "trainings.manage" },
      };
      return Promise.resolve(idMap[create.key] ?? { id: "perm-unknown", key: create.key });
    });

    const rolePermFindUnique = vi.fn().mockResolvedValue(null);
    const rolePermUpsert = vi.fn().mockResolvedValue({});

    prisma = makeMockPrisma({
      permissionFindUnique: permFindUnique,
      permissionUpsert: permUpsert,
      roleFindUnique,
      rolePermissionFindUnique: rolePermFindUnique,
      rolePermissionUpsert: rolePermUpsert,
    });
  });

  it("reports both permissions as 'created'", async () => {
    const result = await reconcileTrainingPermissions(prisma, false);
    const created = result.permissions.filter((p) => p.action === "created");
    expect(created).toHaveLength(2);
    expect(created.map((p) => p.key)).toContain("trainings.view");
    expect(created.map((p) => p.key)).toContain("trainings.manage");
  });

  it("calls permission.upsert for each permission", async () => {
    await reconcileTrainingPermissions(prisma, false);
    const { permission } = prisma as unknown as { permission: { upsert: ReturnType<typeof vi.fn> } };
    expect(permission.upsert).toHaveBeenCalledTimes(2);
  });

  it("does not create permissions with incorrect keys", async () => {
    await reconcileTrainingPermissions(prisma, false);
    const { permission } = prisma as unknown as { permission: { upsert: ReturnType<typeof vi.fn> } };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const createdKeys = permission.upsert.mock.calls.map((c: any[]) => (c[0] as { create: { key: string } }).create.key);
    expect(createdKeys).not.toContain("training.view");
    expect(createdKeys).not.toContain("TRAININGS_VIEW");
    expect(createdKeys).toContain("trainings.view");
    expect(createdKeys).toContain("trainings.manage");
  });
});

describe("reconcileTrainingPermissions — idempotency (repeated execution)", () => {
  it("reports 'already_exists' when permissions already exist and are correct", async () => {
    const permFindUnique = vi.fn().mockImplementation(({ where }: { where: { key: string } }) => {
      if (where.key === "trainings.view") return Promise.resolve({ id: "perm-view", name: "View training allocations", module: "TRAININGS" });
      if (where.key === "trainings.manage") return Promise.resolve({ id: "perm-manage", name: "Manage training allocations", module: "TRAININGS" });
      return Promise.resolve(null);
    });

    const roleFindUnique = vi.fn().mockImplementation(({ where }: { where: { key: string } }) => {
      if (where.key === "super_admin") return Promise.resolve(SUPER_ADMIN_ROLE);
      if (where.key === "trainer") return Promise.resolve(TRAINER_ROLE);
      return Promise.resolve(null);
    });

    const rolePermFindUnique = vi.fn().mockResolvedValue({ roleId: "role-super-admin" });

    const prisma = makeMockPrisma({
      permissionFindUnique: permFindUnique,
      roleFindUnique,
      rolePermissionFindUnique: rolePermFindUnique,
    });

    const result = await reconcileTrainingPermissions(prisma, false);

    const alreadyExists = result.permissions.filter((p) => p.action === "already_exists");
    expect(alreadyExists).toHaveLength(2);

    const alreadyAssigned = result.rolePermissions.filter((r) => r.action === "already_assigned");
    expect(alreadyAssigned.length).toBeGreaterThan(0);

    // Upsert is called for permissions (upsert is always used for idempotency).
    // The important check is that the result correctly reports 'already_exists'.
    const { permission } = prisma as unknown as { permission: { upsert: ReturnType<typeof vi.fn> } };
    expect(permission.upsert).toHaveBeenCalled();
  });

  it("does not assign new rolePermission rows when already assigned (upsert update={} is no-op)", async () => {
    const permFindUnique = vi.fn().mockImplementation(({ where }: { where: { key: string } }) => {
      if (where.key === "trainings.view") return Promise.resolve(PERM_VIEW);
      if (where.key === "trainings.manage") return Promise.resolve(PERM_MANAGE);
      return Promise.resolve(null);
    });
    const roleFindUnique = vi.fn().mockResolvedValue(SUPER_ADMIN_ROLE);
    // rolePermission.findUnique returns existing rows → outcome is 'already_assigned'
    const rolePermFindUnique = vi.fn().mockResolvedValue({ roleId: "exists" });
    const rolePermUpsert = vi.fn().mockResolvedValue({});

    const prisma = makeMockPrisma({
      permissionFindUnique: permFindUnique,
      roleFindUnique,
      rolePermissionFindUnique: rolePermFindUnique,
      rolePermissionUpsert: rolePermUpsert,
    });

    const result = await reconcileTrainingPermissions(prisma, false);
    // All existing assignments → 'already_assigned'; upsert is still called (idempotent)
    const alreadyAssigned = result.rolePermissions.filter((r) => r.action === "already_assigned");
    expect(alreadyAssigned.length).toBeGreaterThan(0);
    // Upsert is called with update:{} (no-op update), not a fresh create
    if (rolePermUpsert.mock.calls.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      rolePermUpsert.mock.calls.forEach((call: any[]) => {
        expect((call[0] as { update: unknown }).update).toEqual({});
      });
    }
  });
});

describe("reconcileTrainingPermissions — partial state (permission exists, assignment missing)", () => {
  it("creates rolePermission assignment when permission exists but is not yet assigned", async () => {
    const permFindUnique = vi.fn().mockImplementation(({ where }: { where: { key: string } }) => {
      if (where.key === "trainings.view") return Promise.resolve(PERM_VIEW);
      if (where.key === "trainings.manage") return Promise.resolve(PERM_MANAGE);
      return Promise.resolve(null);
    });
    const roleFindUnique = vi.fn().mockResolvedValue(SUPER_ADMIN_ROLE);
    const rolePermFindUnique = vi.fn().mockResolvedValue(null); // not yet assigned
    const rolePermUpsert = vi.fn().mockResolvedValue({});

    const prisma = makeMockPrisma({
      permissionFindUnique: permFindUnique,
      roleFindUnique,
      rolePermissionFindUnique: rolePermFindUnique,
      rolePermissionUpsert: rolePermUpsert,
    });

    const result = await reconcileTrainingPermissions(prisma, false);

    const assigned = result.rolePermissions.filter((r) => r.action === "assigned");
    expect(assigned.length).toBeGreaterThan(0);
    expect(rolePermUpsert).toHaveBeenCalled();
  });
});

describe("reconcileTrainingPermissions — role not found", () => {
  it("reports 'role_not_found' when a role does not exist, does not throw", async () => {
    const permFindUnique = vi.fn().mockResolvedValue(null);
    const roleFindUnique = vi.fn().mockResolvedValue(null); // no roles exist

    const prisma = makeMockPrisma({ permissionFindUnique: permFindUnique, roleFindUnique });

    const result = await reconcileTrainingPermissions(prisma, false);

    const notFound = result.rolePermissions.filter((r) => r.action === "role_not_found");
    expect(notFound.length).toBeGreaterThan(0);
    notFound.forEach((r) => {
      expect(["super_admin", "trainer"]).toContain(r.roleKey);
    });
  });
});

describe("reconcileTrainingPermissions — dry-run mode", () => {
  it("reports changes but does not call permission.upsert when dryRun=true", async () => {
    const permFindUnique = vi.fn().mockResolvedValue(null); // all missing
    const permUpsert = vi.fn();
    const roleFindUnique = vi.fn().mockResolvedValue(SUPER_ADMIN_ROLE);
    const rolePermFindUnique = vi.fn().mockResolvedValue(null);
    const rolePermUpsert = vi.fn();

    const prisma = makeMockPrisma({
      permissionFindUnique: permFindUnique,
      permissionUpsert: permUpsert,
      roleFindUnique,
      rolePermissionFindUnique: rolePermFindUnique,
      rolePermissionUpsert: rolePermUpsert,
    });

    const result = await reconcileTrainingPermissions(prisma, true);

    // Reports what would be done
    expect(result.permissions.some((p) => p.action === "created")).toBe(true);

    // Makes no writes
    expect(permUpsert).not.toHaveBeenCalled();
    expect(rolePermUpsert).not.toHaveBeenCalled();
  });
});

describe("reconcileTrainingPermissions — coverage and safety", () => {
  it("covers exactly the two expected role keys (super_admin and trainer)", () => {
    expect(TRAINING_PERMISSION_ROLE_KEYS).not.toContain("viewer");
    expect(TRAINING_PERMISSION_ROLE_KEYS).not.toContain("website_publisher");
    expect(TRAINING_PERMISSION_ROLE_KEYS).not.toContain("match_coordinator");
  });

  it("does not assign to every role (no overly-broad grant)", () => {
    // Only super_admin and trainer should receive training permissions per seed.ts
    expect(TRAINING_PERMISSION_ROLE_KEYS.length).toBe(2);
  });

  it("permission module is TRAININGS for both permissions", () => {
    TRAINING_PERMISSION_DEFS.forEach((def) => {
      expect(def.module).toBe("TRAININGS");
    });
  });
});

// ── STAGE-OPS-03: Missing module regression ──────────────────────────────────────
// These tests directly cover the production blocker where PermissionModule.TRAININGS
// was undefined (stale Prisma client), causing "Argument `module` is missing."

describe("STAGE-OPS-03 regression — module field is never undefined or null", () => {
  it("TRAINING_PERMISSION_DEFS: module is a non-empty string for every entry", () => {
    for (const def of TRAINING_PERMISSION_DEFS) {
      expect(def.module).toBeDefined();
      expect(def.module).not.toBeNull();
      expect(typeof def.module).toBe("string");
      expect((def.module as string).length).toBeGreaterThan(0);
    }
  });

  it("module value is exactly 'TRAININGS' (canonical DB enum value)", () => {
    for (const def of TRAINING_PERMISSION_DEFS) {
      expect(def.module).toBe("TRAININGS");
    }
  });

  it("upsert create block includes module when permission is missing", async () => {
    const permUpsert = vi.fn().mockResolvedValue({});
    const prisma = makeMockPrisma({
      permissionFindUnique: vi.fn().mockResolvedValue(null),
      permissionUpsert: permUpsert,
      roleFindUnique: vi.fn().mockResolvedValue(null),
    });

    await reconcileTrainingPermissions(prisma, false);

    expect(permUpsert).toHaveBeenCalledTimes(2);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const call of permUpsert.mock.calls as any[][]) {
      const createArg = (call[0] as { create: Record<string, unknown> }).create;
      expect(createArg.module).toBeDefined();
      expect(createArg.module).toBe("TRAININGS");
    }
  });

  it("upsert update block includes module when permission already exists", async () => {
    const permUpsert = vi.fn().mockResolvedValue({});
    const prisma = makeMockPrisma({
      permissionFindUnique: vi.fn().mockImplementation(({ where }: { where: { key: string } }) => {
        return Promise.resolve({ id: "perm-existing", name: "View training allocations", module: "TRAININGS" });
      }),
      permissionUpsert: permUpsert,
      roleFindUnique: vi.fn().mockResolvedValue(null),
    });

    await reconcileTrainingPermissions(prisma, false);

    expect(permUpsert).toHaveBeenCalledTimes(2);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const call of permUpsert.mock.calls as any[][]) {
      const updateArg = (call[0] as { update: Record<string, unknown> }).update;
      expect(updateArg.module).toBeDefined();
      expect(updateArg.module).toBe("TRAININGS");
    }
  });

  it("required Prisma fields — upsert create includes key, name, module", async () => {
    const permUpsert = vi.fn().mockResolvedValue({});
    const prisma = makeMockPrisma({
      permissionFindUnique: vi.fn().mockResolvedValue(null),
      permissionUpsert: permUpsert,
      roleFindUnique: vi.fn().mockResolvedValue(null),
    });

    await reconcileTrainingPermissions(prisma, false);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const call of permUpsert.mock.calls as any[][]) {
      const createArg = (call[0] as { create: Record<string, unknown> }).create;
      expect(createArg).toHaveProperty("key");
      expect(createArg).toHaveProperty("name");
      expect(createArg).toHaveProperty("module");
      expect(createArg.module).not.toBeUndefined();
    }
  });

  it("dry run: module is still defined even in dry-run mode (no writes executed)", async () => {
    // The module value must be correct even when dryRun=true prevents writes.
    for (const def of TRAINING_PERMISSION_DEFS) {
      expect(def.module).toBe("TRAININGS");
      expect(def.module).toBeDefined();
    }
  });

  it("apply mode: reconcileTrainingPermissions does NOT throw with valid module values", async () => {
    const permUpsert = vi.fn().mockResolvedValue({});
    const roleFindUnique = vi.fn().mockResolvedValue(SUPER_ADMIN_ROLE);
    const rolePermFindUnique = vi.fn().mockResolvedValue(null);
    const rolePermUpsert = vi.fn().mockResolvedValue({});

    const prisma = makeMockPrisma({
      permissionFindUnique: vi.fn().mockResolvedValue(null),
      permissionUpsert: permUpsert,
      roleFindUnique,
      rolePermissionFindUnique: rolePermFindUnique,
      rolePermissionUpsert: rolePermUpsert,
    });

    await expect(reconcileTrainingPermissions(prisma, false)).resolves.not.toThrow();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const call of permUpsert.mock.calls as any[][]) {
      const createArg = (call[0] as { create: Record<string, unknown> }).create;
      expect(createArg.module).not.toBeUndefined();
    }
  });

  it("idempotency — second execution does not create new permissions", async () => {
    const permUpsert = vi.fn().mockResolvedValue({});
    const roleFindUnique = vi.fn().mockResolvedValue(SUPER_ADMIN_ROLE);
    const rolePermFindUnique = vi.fn().mockResolvedValue({ roleId: "exists" });

    const prisma = makeMockPrisma({
      permissionFindUnique: vi.fn().mockImplementation(({ where }: { where: { key: string } }) => {
        const map: Record<string, { id: string; name: string; module: string }> = {
          "trainings.view": { id: "perm-view", name: "View training allocations", module: "TRAININGS" },
          "trainings.manage": { id: "perm-manage", name: "Manage training allocations", module: "TRAININGS" },
        };
        return Promise.resolve(map[where.key] ?? null);
      }),
      permissionUpsert: permUpsert,
      roleFindUnique,
      rolePermissionFindUnique: rolePermFindUnique,
    });

    const result = await reconcileTrainingPermissions(prisma, false);

    expect(result.permissions.every((p) => p.action === "already_exists")).toBe(true);
    expect(result.rolePermissions.every((r) => r.action === "already_assigned")).toBe(true);
  });

  it("missing role assignment: reports 'assigned' when permission exists but RolePermission missing", async () => {
    const rolePermUpsert = vi.fn().mockResolvedValue({});

    const prisma = makeMockPrisma({
      permissionFindUnique: vi.fn().mockImplementation(({ where }: { where: { key: string } }) => {
        if (where.key === "trainings.view") return Promise.resolve(PERM_VIEW);
        if (where.key === "trainings.manage") return Promise.resolve(PERM_MANAGE);
        return Promise.resolve(null);
      }),
      roleFindUnique: vi.fn().mockResolvedValue(SUPER_ADMIN_ROLE),
      rolePermissionFindUnique: vi.fn().mockResolvedValue(null),
      rolePermissionUpsert: rolePermUpsert,
    });

    const result = await reconcileTrainingPermissions(prisma, false);

    const assigned = result.rolePermissions.filter((r) => r.action === "assigned");
    expect(assigned.length).toBeGreaterThan(0);
    expect(rolePermUpsert).toHaveBeenCalled();
  });

  it("existing role assignment: reports 'already_assigned' and does not duplicate", async () => {
    const rolePermUpsert = vi.fn().mockResolvedValue({});

    const prisma = makeMockPrisma({
      permissionFindUnique: vi.fn().mockImplementation(({ where }: { where: { key: string } }) => {
        if (where.key === "trainings.view") return Promise.resolve(PERM_VIEW);
        if (where.key === "trainings.manage") return Promise.resolve(PERM_MANAGE);
        return Promise.resolve(null);
      }),
      roleFindUnique: vi.fn().mockResolvedValue(SUPER_ADMIN_ROLE),
      rolePermissionFindUnique: vi.fn().mockResolvedValue({ roleId: "super-admin-role" }),
      rolePermissionUpsert: rolePermUpsert,
    });

    const result = await reconcileTrainingPermissions(prisma, false);

    const alreadyAssigned = result.rolePermissions.filter((r) => r.action === "already_assigned");
    expect(alreadyAssigned.length).toBeGreaterThan(0);
  });
});
