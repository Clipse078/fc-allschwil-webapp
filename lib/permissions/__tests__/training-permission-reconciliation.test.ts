/**
 * STAGE-OPS-01-V / STAGE-OPS-03 / STAGE-OPS-03A
 * Tests for lib/permissions/training-permission-reconciliation.ts
 *
 * Test matrix:
 *   A. Constant definitions — keys, role assignments, modules
 *   B. First execution — all permissions and assignments are new
 *   C. Idempotency — repeated execution on already-synced state
 *   D. Partial state — permission exists, role assignment is missing
 *   E. Role not found — gracefully reported, does not throw
 *   F. Dry-run mode — reports changes but makes no writes
 *   G. No duplicate rows created
 *   H. No cross-tenant hardcoding (permissions are global)
 *   I. Correct permission keys: trainings.view and trainings.manage only
 *   J. Correct role assignments per canonical policy
 *   K. STAGE-OPS-03 regression — module field is never undefined or null
 *   L. STAGE-OPS-03A regression — trainer does not receive trainings.manage
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  reconcileTrainingPermissions,
  TRAINING_PERMISSION_DEFS,
  TRAINING_ROLE_ASSIGNMENTS,
} from "../training-permission-reconciliation";
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

// ── A. Constant definitions ────────────────────────────────────────────────────

describe("TRAINING_PERMISSION_DEFS — constants", () => {
  it("defines exactly trainings.view and trainings.manage", () => {
    const keys = TRAINING_PERMISSION_DEFS.map((d) => d.key);
    expect(keys).toEqual(["trainings.view", "trainings.manage"]);
  });

  it("all permissions use the TRAININGS module", () => {
    for (const def of TRAINING_PERMISSION_DEFS) {
      expect(def.module).toBe("TRAININGS");
    }
  });

  it("module is never undefined or null (STAGE-OPS-03 stale-enum regression)", () => {
    for (const def of TRAINING_PERMISSION_DEFS) {
      expect(def.module).toBeDefined();
      expect(def.module).not.toBeNull();
      expect(typeof def.module).toBe("string");
      expect((def.module as string).length).toBeGreaterThan(0);
    }
  });
});

describe("TRAINING_ROLE_ASSIGNMENTS — canonical policy", () => {
  it("super_admin receives both trainings.view and trainings.manage", () => {
    const sa = TRAINING_ROLE_ASSIGNMENTS.find((a) => a.roleKey === "super_admin");
    expect(sa).toBeDefined();
    expect(sa!.permissionKeys).toContain("trainings.view");
    expect(sa!.permissionKeys).toContain("trainings.manage");
  });

  it("trainer receives trainings.view", () => {
    const tr = TRAINING_ROLE_ASSIGNMENTS.find((a) => a.roleKey === "trainer");
    expect(tr).toBeDefined();
    expect(tr!.permissionKeys).toContain("trainings.view");
  });

  it("trainer does NOT receive trainings.manage (STAGE-OPS-03A policy)", () => {
    const tr = TRAINING_ROLE_ASSIGNMENTS.find((a) => a.roleKey === "trainer");
    expect(tr).toBeDefined();
    expect(tr!.permissionKeys).not.toContain("trainings.manage");
  });

  it("only super_admin and trainer are in the role assignment list", () => {
    const roleKeys = TRAINING_ROLE_ASSIGNMENTS.map((a) => a.roleKey);
    expect(roleKeys).toContain("super_admin");
    expect(roleKeys).toContain("trainer");
    expect(roleKeys).toHaveLength(2);
  });

  it("no role receives permissions outside trainings.view/trainings.manage", () => {
    const permissionKeys = new Set(
      TRAINING_ROLE_ASSIGNMENTS.flatMap((a) => [...a.permissionKeys])
    );
    expect(permissionKeys.size).toBe(2);
    expect(permissionKeys.has("trainings.view")).toBe(true);
    expect(permissionKeys.has("trainings.manage")).toBe(true);
  });
});

// ── B. First execution ─────────────────────────────────────────────────────────

describe("reconcileTrainingPermissions — first execution (all new)", () => {
  let prisma: PrismaClient;

  beforeEach(() => {
    const roleFindUnique = vi.fn().mockImplementation(({ where }: { where: { key: string } }) => {
      if (where.key === "super_admin") return Promise.resolve(SUPER_ADMIN_ROLE);
      if (where.key === "trainer") return Promise.resolve(TRAINER_ROLE);
      return Promise.resolve(null);
    });

    // Simulate: permissions don't exist on first check (step 1), but exist for
    // role-assignment lookup (step 2) after upsert has been called.
    const createdPerms = new Set<string>();
    const permIdMap: Record<string, { id: string; key: string }> = {
      "trainings.view": { id: "perm-view", key: "trainings.view" },
      "trainings.manage": { id: "perm-manage", key: "trainings.manage" },
    };

    const permFindUnique = vi.fn().mockImplementation(({ where }: { where: { key: string } }) => {
      if (createdPerms.has(where.key)) return Promise.resolve(permIdMap[where.key] ?? null);
      return Promise.resolve(null);
    });
    const permUpsert = vi.fn().mockImplementation(({ create }: { create: { key: string } }) => {
      createdPerms.add(create.key);
      return Promise.resolve(permIdMap[create.key] ?? { id: "perm-unknown", key: create.key });
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

  it("upsert create includes module=TRAININGS (never undefined)", async () => {
    await reconcileTrainingPermissions(prisma, false);
    const { permission } = prisma as unknown as { permission: { upsert: ReturnType<typeof vi.fn> } };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const call of permission.upsert.mock.calls as any[][]) {
      const createArg = (call[0] as { create: Record<string, unknown> }).create;
      expect(createArg.module).toBe("TRAININGS");
      expect(createArg.module).not.toBeUndefined();
    }
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

  it("super_admin receives trainings.view assignment", async () => {
    const result = await reconcileTrainingPermissions(prisma, false);
    const saView = result.rolePermissions.find(
      (r) => r.roleKey === "super_admin" && r.permissionKey === "trainings.view"
    );
    expect(saView?.action).toBe("assigned");
  });

  it("super_admin receives trainings.manage assignment", async () => {
    const result = await reconcileTrainingPermissions(prisma, false);
    const saManage = result.rolePermissions.find(
      (r) => r.roleKey === "super_admin" && r.permissionKey === "trainings.manage"
    );
    expect(saManage?.action).toBe("assigned");
  });

  it("trainer receives trainings.view assignment", async () => {
    const result = await reconcileTrainingPermissions(prisma, false);
    const trView = result.rolePermissions.find(
      (r) => r.roleKey === "trainer" && r.permissionKey === "trainings.view"
    );
    expect(trView?.action).toBe("assigned");
  });

  it("trainer does NOT receive trainings.manage assignment (STAGE-OPS-03A policy)", async () => {
    const result = await reconcileTrainingPermissions(prisma, false);
    const trManage = result.rolePermissions.find(
      (r) => r.roleKey === "trainer" && r.permissionKey === "trainings.manage"
    );
    expect(trManage).toBeUndefined();
  });
});

// ── C. Idempotency ─────────────────────────────────────────────────────────────

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
  });

  it("trainer → trainings.view is reported as already_assigned on second run", async () => {
    const permFindUnique = vi.fn().mockImplementation(({ where }: { where: { key: string } }) => {
      if (where.key === "trainings.view") return Promise.resolve(PERM_VIEW);
      if (where.key === "trainings.manage") return Promise.resolve(PERM_MANAGE);
      return Promise.resolve(null);
    });
    const roleFindUnique = vi.fn().mockImplementation(({ where }: { where: { key: string } }) => {
      if (where.key === "super_admin") return Promise.resolve(SUPER_ADMIN_ROLE);
      if (where.key === "trainer") return Promise.resolve(TRAINER_ROLE);
      return Promise.resolve(null);
    });
    const rolePermFindUnique = vi.fn().mockResolvedValue({ roleId: "exists" });

    const prisma = makeMockPrisma({ permissionFindUnique: permFindUnique, roleFindUnique, rolePermissionFindUnique: rolePermFindUnique });
    const result = await reconcileTrainingPermissions(prisma, false);

    const trViewAssignment = result.rolePermissions.find(
      (r) => r.roleKey === "trainer" && r.permissionKey === "trainings.view"
    );
    expect(trViewAssignment?.action).toBe("already_assigned");
  });

  it("trainer → trainings.manage never appears in rolePermissions outcomes", async () => {
    const permFindUnique = vi.fn().mockImplementation(({ where }: { where: { key: string } }) => {
      if (where.key === "trainings.view") return Promise.resolve(PERM_VIEW);
      if (where.key === "trainings.manage") return Promise.resolve(PERM_MANAGE);
      return Promise.resolve(null);
    });
    const roleFindUnique = vi.fn().mockImplementation(({ where }: { where: { key: string } }) => {
      if (where.key === "super_admin") return Promise.resolve(SUPER_ADMIN_ROLE);
      if (where.key === "trainer") return Promise.resolve(TRAINER_ROLE);
      return Promise.resolve(null);
    });
    const rolePermFindUnique = vi.fn().mockResolvedValue({ roleId: "exists" });

    const prisma = makeMockPrisma({ permissionFindUnique: permFindUnique, roleFindUnique, rolePermissionFindUnique: rolePermFindUnique });
    const result = await reconcileTrainingPermissions(prisma, false);

    const trManage = result.rolePermissions.filter(
      (r) => r.roleKey === "trainer" && r.permissionKey === "trainings.manage"
    );
    expect(trManage).toHaveLength(0);
  });

  it("does not assign new rolePermission rows when already assigned (upsert update={} is no-op)", async () => {
    const permFindUnique = vi.fn().mockImplementation(({ where }: { where: { key: string } }) => {
      if (where.key === "trainings.view") return Promise.resolve(PERM_VIEW);
      if (where.key === "trainings.manage") return Promise.resolve(PERM_MANAGE);
      return Promise.resolve(null);
    });
    const roleFindUnique = vi.fn().mockResolvedValue(SUPER_ADMIN_ROLE);
    const rolePermFindUnique = vi.fn().mockResolvedValue({ roleId: "exists" });
    const rolePermUpsert = vi.fn().mockResolvedValue({});

    const prisma = makeMockPrisma({
      permissionFindUnique: permFindUnique,
      roleFindUnique,
      rolePermissionFindUnique: rolePermFindUnique,
      rolePermissionUpsert: rolePermUpsert,
    });

    const result = await reconcileTrainingPermissions(prisma, false);
    const alreadyAssigned = result.rolePermissions.filter((r) => r.action === "already_assigned");
    expect(alreadyAssigned.length).toBeGreaterThan(0);
    if (rolePermUpsert.mock.calls.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      rolePermUpsert.mock.calls.forEach((call: any[]) => {
        expect((call[0] as { update: unknown }).update).toEqual({});
      });
    }
  });
});

// ── D. Partial state ───────────────────────────────────────────────────────────

describe("reconcileTrainingPermissions — partial state (permission exists, assignment missing)", () => {
  it("creates rolePermission assignment when permission exists but is not yet assigned", async () => {
    const permFindUnique = vi.fn().mockImplementation(({ where }: { where: { key: string } }) => {
      if (where.key === "trainings.view") return Promise.resolve(PERM_VIEW);
      if (where.key === "trainings.manage") return Promise.resolve(PERM_MANAGE);
      return Promise.resolve(null);
    });
    const roleFindUnique = vi.fn().mockResolvedValue(SUPER_ADMIN_ROLE);
    const rolePermFindUnique = vi.fn().mockResolvedValue(null);
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

// ── E. Role not found ──────────────────────────────────────────────────────────

describe("reconcileTrainingPermissions — role not found", () => {
  it("reports 'role_not_found' when a role does not exist, does not throw", async () => {
    const permFindUnique = vi.fn().mockResolvedValue(null);
    const roleFindUnique = vi.fn().mockResolvedValue(null);

    const prisma = makeMockPrisma({ permissionFindUnique: permFindUnique, roleFindUnique });

    const result = await reconcileTrainingPermissions(prisma, false);

    const notFound = result.rolePermissions.filter((r) => r.action === "role_not_found");
    expect(notFound.length).toBeGreaterThan(0);
    notFound.forEach((r) => {
      expect(["super_admin", "trainer"]).toContain(r.roleKey);
    });
  });
});

// ── F. Dry-run mode ────────────────────────────────────────────────────────────

describe("reconcileTrainingPermissions — dry-run mode", () => {
  it("reports changes but does not call permission.upsert when dryRun=true", async () => {
    const permFindUnique = vi.fn().mockResolvedValue(null);
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

    expect(result.permissions.some((p) => p.action === "created")).toBe(true);
    expect(permUpsert).not.toHaveBeenCalled();
    expect(rolePermUpsert).not.toHaveBeenCalled();
  });

  it("dry-run: trainer management outcome is not present", async () => {
    const prisma = makeMockPrisma({
      permissionFindUnique: vi.fn().mockResolvedValue(null),
      roleFindUnique: vi.fn().mockImplementation(({ where }: { where: { key: string } }) => {
        if (where.key === "super_admin") return Promise.resolve(SUPER_ADMIN_ROLE);
        if (where.key === "trainer") return Promise.resolve(TRAINER_ROLE);
        return Promise.resolve(null);
      }),
    });

    const result = await reconcileTrainingPermissions(prisma, true);

    const trManage = result.rolePermissions.filter(
      (r) => r.roleKey === "trainer" && r.permissionKey === "trainings.manage"
    );
    expect(trManage).toHaveLength(0);
  });
});

// ── G/H. Safety and coverage ───────────────────────────────────────────────────

describe("reconcileTrainingPermissions — coverage and safety", () => {
  it("only super_admin and trainer appear in TRAINING_ROLE_ASSIGNMENTS", () => {
    const roleKeys = TRAINING_ROLE_ASSIGNMENTS.map((a) => a.roleKey);
    expect(roleKeys).not.toContain("viewer");
    expect(roleKeys).not.toContain("website_publisher");
    expect(roleKeys).not.toContain("match_coordinator");
    expect(roleKeys).toHaveLength(2);
  });

  it("permission module is TRAININGS for both permissions", () => {
    TRAINING_PERMISSION_DEFS.forEach((def) => {
      expect(def.module).toBe("TRAININGS");
    });
  });
});

// ── K. STAGE-OPS-03 regression — module field is never undefined or null ──────

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
      permissionFindUnique: vi.fn().mockResolvedValue({ id: "perm-existing", name: "View training allocations", module: "TRAININGS" }),
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
});

// ── L. STAGE-OPS-03A regression — trainer does NOT get trainings.manage ────────

describe("STAGE-OPS-03A regression — trainer management access policy", () => {
  it("reconciliation never upserts trainer → trainings.manage RolePermission", async () => {
    const rolePermUpsert = vi.fn().mockResolvedValue({});

    const roleFindUnique = vi.fn().mockImplementation(({ where }: { where: { key: string } }) => {
      if (where.key === "super_admin") return Promise.resolve(SUPER_ADMIN_ROLE);
      if (where.key === "trainer") return Promise.resolve(TRAINER_ROLE);
      return Promise.resolve(null);
    });

    const permFindUnique = vi.fn().mockImplementation(({ where }: { where: { key: string } }) => {
      if (where.key === "trainings.view") return Promise.resolve(PERM_VIEW);
      if (where.key === "trainings.manage") return Promise.resolve(PERM_MANAGE);
      return Promise.resolve(null);
    });

    const prisma = makeMockPrisma({
      permissionFindUnique: permFindUnique,
      roleFindUnique,
      rolePermissionFindUnique: vi.fn().mockResolvedValue(null),
      rolePermissionUpsert: rolePermUpsert,
    });

    await reconcileTrainingPermissions(prisma, false);

    // Collect all (roleId, permissionId) pairs passed to upsert
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const upsertCalls = rolePermUpsert.mock.calls as any[][];
    const trainerManageCalls = upsertCalls.filter((call) => {
      const createArg = (call[0] as { create: { roleId: string; permissionId: string } }).create;
      return (
        createArg.roleId === TRAINER_ROLE.id &&
        createArg.permissionId === PERM_MANAGE.id
      );
    });
    expect(trainerManageCalls).toHaveLength(0);
  });

  it("reconciliation DOES upsert trainer → trainings.view RolePermission", async () => {
    const rolePermUpsert = vi.fn().mockResolvedValue({});

    const roleFindUnique = vi.fn().mockImplementation(({ where }: { where: { key: string } }) => {
      if (where.key === "super_admin") return Promise.resolve(SUPER_ADMIN_ROLE);
      if (where.key === "trainer") return Promise.resolve(TRAINER_ROLE);
      return Promise.resolve(null);
    });

    const permFindUnique = vi.fn().mockImplementation(({ where }: { where: { key: string } }) => {
      if (where.key === "trainings.view") return Promise.resolve(PERM_VIEW);
      if (where.key === "trainings.manage") return Promise.resolve(PERM_MANAGE);
      return Promise.resolve(null);
    });

    const prisma = makeMockPrisma({
      permissionFindUnique: permFindUnique,
      roleFindUnique,
      rolePermissionFindUnique: vi.fn().mockResolvedValue(null),
      rolePermissionUpsert: rolePermUpsert,
    });

    await reconcileTrainingPermissions(prisma, false);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const upsertCalls = rolePermUpsert.mock.calls as any[][];
    const trainerViewCalls = upsertCalls.filter((call) => {
      const createArg = (call[0] as { create: { roleId: string; permissionId: string } }).create;
      return (
        createArg.roleId === TRAINER_ROLE.id &&
        createArg.permissionId === PERM_VIEW.id
      );
    });
    expect(trainerViewCalls).toHaveLength(1);
  });

  it("super_admin receives BOTH trainings.view and trainings.manage upserts", async () => {
    const rolePermUpsert = vi.fn().mockResolvedValue({});

    const roleFindUnique = vi.fn().mockImplementation(({ where }: { where: { key: string } }) => {
      if (where.key === "super_admin") return Promise.resolve(SUPER_ADMIN_ROLE);
      if (where.key === "trainer") return Promise.resolve(TRAINER_ROLE);
      return Promise.resolve(null);
    });

    const permFindUnique = vi.fn().mockImplementation(({ where }: { where: { key: string } }) => {
      if (where.key === "trainings.view") return Promise.resolve(PERM_VIEW);
      if (where.key === "trainings.manage") return Promise.resolve(PERM_MANAGE);
      return Promise.resolve(null);
    });

    const prisma = makeMockPrisma({
      permissionFindUnique: permFindUnique,
      roleFindUnique,
      rolePermissionFindUnique: vi.fn().mockResolvedValue(null),
      rolePermissionUpsert: rolePermUpsert,
    });

    await reconcileTrainingPermissions(prisma, false);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const upsertCalls = rolePermUpsert.mock.calls as any[][];
    const saViewCalls = upsertCalls.filter((call) => {
      const createArg = (call[0] as { create: { roleId: string; permissionId: string } }).create;
      return createArg.roleId === SUPER_ADMIN_ROLE.id && createArg.permissionId === PERM_VIEW.id;
    });
    const saManageCalls = upsertCalls.filter((call) => {
      const createArg = (call[0] as { create: { roleId: string; permissionId: string } }).create;
      return createArg.roleId === SUPER_ADMIN_ROLE.id && createArg.permissionId === PERM_MANAGE.id;
    });
    expect(saViewCalls).toHaveLength(1);
    expect(saManageCalls).toHaveLength(1);
  });

  it("total rolePermission upserts: 3 (super_admin×2 + trainer×1), not 4", async () => {
    const rolePermUpsert = vi.fn().mockResolvedValue({});

    const roleFindUnique = vi.fn().mockImplementation(({ where }: { where: { key: string } }) => {
      if (where.key === "super_admin") return Promise.resolve(SUPER_ADMIN_ROLE);
      if (where.key === "trainer") return Promise.resolve(TRAINER_ROLE);
      return Promise.resolve(null);
    });

    const permFindUnique = vi.fn().mockImplementation(({ where }: { where: { key: string } }) => {
      if (where.key === "trainings.view") return Promise.resolve(PERM_VIEW);
      if (where.key === "trainings.manage") return Promise.resolve(PERM_MANAGE);
      return Promise.resolve(null);
    });

    const prisma = makeMockPrisma({
      permissionFindUnique: permFindUnique,
      roleFindUnique,
      rolePermissionFindUnique: vi.fn().mockResolvedValue(null),
      rolePermissionUpsert: rolePermUpsert,
    });

    await reconcileTrainingPermissions(prisma, false);

    // super_admin gets 2 (view+manage), trainer gets 1 (view only) = 3 total
    expect(rolePermUpsert).toHaveBeenCalledTimes(3);
  });

  it("missing role assignment: trainer → trainings.view reports 'assigned'", async () => {
    const rolePermUpsert = vi.fn().mockResolvedValue({});

    const prisma = makeMockPrisma({
      permissionFindUnique: vi.fn().mockImplementation(({ where }: { where: { key: string } }) => {
        if (where.key === "trainings.view") return Promise.resolve(PERM_VIEW);
        if (where.key === "trainings.manage") return Promise.resolve(PERM_MANAGE);
        return Promise.resolve(null);
      }),
      roleFindUnique: vi.fn().mockImplementation(({ where }: { where: { key: string } }) => {
        if (where.key === "trainer") return Promise.resolve(TRAINER_ROLE);
        if (where.key === "super_admin") return Promise.resolve(SUPER_ADMIN_ROLE);
        return Promise.resolve(null);
      }),
      rolePermissionFindUnique: vi.fn().mockResolvedValue(null),
      rolePermissionUpsert: rolePermUpsert,
    });

    const result = await reconcileTrainingPermissions(prisma, false);

    const trViewAssigned = result.rolePermissions.find(
      (r) => r.roleKey === "trainer" && r.permissionKey === "trainings.view" && r.action === "assigned"
    );
    expect(trViewAssigned).toBeDefined();
    expect(rolePermUpsert).toHaveBeenCalled();
  });

  it("existing role assignment: trainer → trainings.view reports 'already_assigned'", async () => {
    const rolePermUpsert = vi.fn().mockResolvedValue({});

    const prisma = makeMockPrisma({
      permissionFindUnique: vi.fn().mockImplementation(({ where }: { where: { key: string } }) => {
        if (where.key === "trainings.view") return Promise.resolve(PERM_VIEW);
        if (where.key === "trainings.manage") return Promise.resolve(PERM_MANAGE);
        return Promise.resolve(null);
      }),
      roleFindUnique: vi.fn().mockImplementation(({ where }: { where: { key: string } }) => {
        if (where.key === "trainer") return Promise.resolve(TRAINER_ROLE);
        if (where.key === "super_admin") return Promise.resolve(SUPER_ADMIN_ROLE);
        return Promise.resolve(null);
      }),
      rolePermissionFindUnique: vi.fn().mockResolvedValue({ roleId: "exists" }),
      rolePermissionUpsert: rolePermUpsert,
    });

    const result = await reconcileTrainingPermissions(prisma, false);

    const trViewAlreadyAssigned = result.rolePermissions.find(
      (r) => r.roleKey === "trainer" && r.permissionKey === "trainings.view" && r.action === "already_assigned"
    );
    expect(trViewAlreadyAssigned).toBeDefined();
  });
});
