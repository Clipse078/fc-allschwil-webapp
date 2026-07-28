/**
 * STAGE-OPS-01-V / STAGE-OPS-03 / STAGE-OPS-03A / STAGE-OPS-03B
 * Tests for lib/permissions/training-permission-reconciliation.ts
 *
 * Test matrix:
 *   A. Constant definitions — keys, role assignments, modules
 *   B. First execution — permissions created, super_admin gets both
 *   C. Idempotency — repeated execution on already-synced state
 *   D. Partial state — permission exists, assignment missing
 *   E. Role not found — gracefully reported, does not throw
 *   F. Dry-run mode — reports changes but makes no writes
 *   G. No duplicate rows
 *   H. Safety — no broad operational grants
 *   K. STAGE-OPS-03 regression — module field is never undefined or null
 *   L. STAGE-OPS-03A regression — trainer does not receive manage
 *   M. STAGE-OPS-03B regression — trainer receives neither permission automatically
 *   N. Revocation — trainer bootstrap grants are cleaned up
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  reconcileTrainingPermissions,
  TRAINING_PERMISSION_DEFS,
  TRAINING_ROLE_ASSIGNMENTS,
  TRAINING_PERMISSION_REVOCATIONS,
} from "../training-permission-reconciliation";
import type { PrismaClient } from "@prisma/client";

// ── Mock Prisma client ─────────────────────────────────────────────────────────

function makeMockPrisma(overrides: {
  permissionFindUnique?: ReturnType<typeof vi.fn>;
  permissionUpsert?: ReturnType<typeof vi.fn>;
  roleFindUnique?: ReturnType<typeof vi.fn>;
  rolePermissionFindUnique?: ReturnType<typeof vi.fn>;
  rolePermissionUpsert?: ReturnType<typeof vi.fn>;
  rolePermissionDelete?: ReturnType<typeof vi.fn>;
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
      delete: overrides.rolePermissionDelete ?? vi.fn().mockResolvedValue({}),
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

describe("TRAINING_ROLE_ASSIGNMENTS — STAGE-OPS-03B bootstrap policy", () => {
  it("super_admin is the only automatic bootstrap recipient", () => {
    const roleKeys = TRAINING_ROLE_ASSIGNMENTS.map((a) => a.roleKey);
    expect(roleKeys).toEqual(["super_admin"]);
    expect(roleKeys).toHaveLength(1);
  });

  it("super_admin receives both trainings.view and trainings.manage", () => {
    const sa = TRAINING_ROLE_ASSIGNMENTS.find((a) => a.roleKey === "super_admin");
    expect(sa).toBeDefined();
    expect(sa!.permissionKeys).toContain("trainings.view");
    expect(sa!.permissionKeys).toContain("trainings.manage");
  });

  it("trainer is NOT in TRAINING_ROLE_ASSIGNMENTS (STAGE-OPS-03B)", () => {
    const roleKeys = TRAINING_ROLE_ASSIGNMENTS.map((a) => a.roleKey);
    expect(roleKeys).not.toContain("trainer");
  });

  it("viewer is NOT in TRAINING_ROLE_ASSIGNMENTS", () => {
    const roleKeys = TRAINING_ROLE_ASSIGNMENTS.map((a) => a.roleKey);
    expect(roleKeys).not.toContain("viewer");
  });

  it("match_coordinator is NOT in TRAINING_ROLE_ASSIGNMENTS", () => {
    const roleKeys = TRAINING_ROLE_ASSIGNMENTS.map((a) => a.roleKey);
    expect(roleKeys).not.toContain("match_coordinator");
  });

  it("website_publisher is NOT in TRAINING_ROLE_ASSIGNMENTS", () => {
    const roleKeys = TRAINING_ROLE_ASSIGNMENTS.map((a) => a.roleKey);
    expect(roleKeys).not.toContain("website_publisher");
  });
});

describe("TRAINING_PERMISSION_REVOCATIONS — cleanup targets", () => {
  it("revocation list targets trainer → trainings.view", () => {
    const rev = TRAINING_PERMISSION_REVOCATIONS.find(
      (r) => r.roleKey === "trainer" && r.permissionKey === "trainings.view"
    );
    expect(rev).toBeDefined();
  });

  it("revocation list targets trainer → trainings.manage", () => {
    const rev = TRAINING_PERMISSION_REVOCATIONS.find(
      (r) => r.roleKey === "trainer" && r.permissionKey === "trainings.manage"
    );
    expect(rev).toBeDefined();
  });

  it("revocation list has exactly 2 entries (trainer×view + trainer×manage)", () => {
    expect(TRAINING_PERMISSION_REVOCATIONS).toHaveLength(2);
  });

  it("revocation list does NOT target super_admin", () => {
    const roleKeys = TRAINING_PERMISSION_REVOCATIONS.map((r) => r.roleKey as string);
    expect(roleKeys).not.toContain("super_admin");
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

    // Permissions don't exist initially; created by upsert in step 1
    const createdPerms = new Set<string>();
    const permIdMap: Record<string, { id: string }> = {
      "trainings.view": PERM_VIEW,
      "trainings.manage": PERM_MANAGE,
    };
    const permFindUnique = vi.fn().mockImplementation(({ where }: { where: { key: string } }) => {
      return Promise.resolve(createdPerms.has(where.key) ? (permIdMap[where.key] ?? null) : null);
    });
    const permUpsert = vi.fn().mockImplementation(({ create }: { create: { key: string } }) => {
      createdPerms.add(create.key);
      return Promise.resolve(permIdMap[create.key] ?? { id: "perm-unknown", key: create.key });
    });

    prisma = makeMockPrisma({
      permissionFindUnique: permFindUnique,
      permissionUpsert: permUpsert,
      roleFindUnique,
      rolePermissionFindUnique: vi.fn().mockResolvedValue(null),
      rolePermissionUpsert: vi.fn().mockResolvedValue({}),
      rolePermissionDelete: vi.fn().mockResolvedValue({}),
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

  it("trainer does NOT appear in rolePermissions outcomes (STAGE-OPS-03B)", async () => {
    const result = await reconcileTrainingPermissions(prisma, false);
    const trainerOutcomes = result.rolePermissions.filter((r) => r.roleKey === "trainer");
    expect(trainerOutcomes).toHaveLength(0);
  });

  it("total rolePermission upserts = 2 (super_admin×view + super_admin×manage only)", async () => {
    await reconcileTrainingPermissions(prisma, false);
    const { rolePermission } = prisma as unknown as { rolePermission: { upsert: ReturnType<typeof vi.fn> } };
    expect(rolePermission.upsert).toHaveBeenCalledTimes(2);
  });
});

// ── C. Idempotency ─────────────────────────────────────────────────────────────

describe("reconcileTrainingPermissions — idempotency", () => {
  it("reports already_exists and already_assigned on second run", async () => {
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
    // super_admin assignments exist; trainer assignments absent
    const rolePermFindUnique = vi.fn().mockImplementation(({ where }: { where: { roleId_permissionId: { roleId: string } } }) => {
      if (where.roleId_permissionId.roleId === SUPER_ADMIN_ROLE.id) return Promise.resolve({ roleId: SUPER_ADMIN_ROLE.id });
      return Promise.resolve(null);
    });

    const prisma = makeMockPrisma({ permissionFindUnique: permFindUnique, roleFindUnique, rolePermissionFindUnique: rolePermFindUnique });
    const result = await reconcileTrainingPermissions(prisma, false);

    expect(result.permissions.every((p) => p.action === "already_exists")).toBe(true);
    expect(result.rolePermissions.filter((r) => r.action === "already_assigned")).toHaveLength(2);
  });

  it("trainer revocations report not_present on second run", async () => {
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
    // Trainer assignments are already absent
    const rolePermFindUnique = vi.fn().mockImplementation(({ where }: { where: { roleId_permissionId: { roleId: string } } }) => {
      if (where.roleId_permissionId.roleId === SUPER_ADMIN_ROLE.id) return Promise.resolve({ roleId: SUPER_ADMIN_ROLE.id });
      return Promise.resolve(null);
    });

    const prisma = makeMockPrisma({ permissionFindUnique: permFindUnique, roleFindUnique, rolePermissionFindUnique: rolePermFindUnique });
    const result = await reconcileTrainingPermissions(prisma, false);

    const notPresent = result.revocations.filter((r) => r.action === "not_present");
    expect(notPresent).toHaveLength(2);
    // No deletes on second run
    const { rolePermission } = prisma as unknown as { rolePermission: { delete: ReturnType<typeof vi.fn> } };
    expect(rolePermission.delete).not.toHaveBeenCalled();
  });
});

// ── D. Partial state ───────────────────────────────────────────────────────────

describe("reconcileTrainingPermissions — partial state", () => {
  it("assigns super_admin when permission exists but assignment is missing", async () => {
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
    const rolePermFindUnique = vi.fn().mockResolvedValue(null);
    const rolePermUpsert = vi.fn().mockResolvedValue({});

    const prisma = makeMockPrisma({ permissionFindUnique: permFindUnique, roleFindUnique, rolePermissionFindUnique: rolePermFindUnique, rolePermissionUpsert: rolePermUpsert });
    const result = await reconcileTrainingPermissions(prisma, false);

    const assigned = result.rolePermissions.filter((r) => r.action === "assigned" && r.roleKey === "super_admin");
    expect(assigned).toHaveLength(2);
    expect(rolePermUpsert).toHaveBeenCalledTimes(2);
  });
});

// ── E. Role not found ──────────────────────────────────────────────────────────

describe("reconcileTrainingPermissions — role not found", () => {
  it("reports role_not_found for super_admin when it does not exist", async () => {
    const prisma = makeMockPrisma({ roleFindUnique: vi.fn().mockResolvedValue(null) });
    const result = await reconcileTrainingPermissions(prisma, false);
    const notFound = result.rolePermissions.filter((r) => r.action === "role_not_found" && r.roleKey === "super_admin");
    expect(notFound.length).toBeGreaterThan(0);
  });

  it("reports role_not_found in revocations when trainer does not exist", async () => {
    const permFindUnique = vi.fn().mockImplementation(({ where }: { where: { key: string } }) => {
      if (where.key === "trainings.view") return Promise.resolve(PERM_VIEW);
      if (where.key === "trainings.manage") return Promise.resolve(PERM_MANAGE);
      return Promise.resolve(null);
    });
    // super_admin found, trainer not
    const roleFindUnique = vi.fn().mockImplementation(({ where }: { where: { key: string } }) => {
      if (where.key === "super_admin") return Promise.resolve(SUPER_ADMIN_ROLE);
      return Promise.resolve(null);
    });

    const prisma = makeMockPrisma({ permissionFindUnique: permFindUnique, roleFindUnique });
    const result = await reconcileTrainingPermissions(prisma, false);

    const revNotFound = result.revocations.filter((r) => r.action === "role_not_found" && r.roleKey === "trainer");
    expect(revNotFound.length).toBeGreaterThan(0);
  });
});

// ── F. Dry-run mode ────────────────────────────────────────────────────────────

describe("reconcileTrainingPermissions — dry-run mode", () => {
  it("does not call permission.upsert when dryRun=true", async () => {
    const permUpsert = vi.fn();
    const rolePermUpsert = vi.fn();
    const rolePermDelete = vi.fn();
    const roleFindUnique = vi.fn().mockImplementation(({ where }: { where: { key: string } }) => {
      if (where.key === "super_admin") return Promise.resolve(SUPER_ADMIN_ROLE);
      if (where.key === "trainer") return Promise.resolve(TRAINER_ROLE);
      return Promise.resolve(null);
    });

    const prisma = makeMockPrisma({
      permissionFindUnique: vi.fn().mockResolvedValue(null),
      permissionUpsert: permUpsert,
      roleFindUnique,
      rolePermissionFindUnique: vi.fn().mockResolvedValue(null),
      rolePermissionUpsert: rolePermUpsert,
      rolePermissionDelete: rolePermDelete,
    });

    const result = await reconcileTrainingPermissions(prisma, true);

    expect(result.permissions.some((p) => p.action === "created")).toBe(true);
    expect(permUpsert).not.toHaveBeenCalled();
    expect(rolePermUpsert).not.toHaveBeenCalled();
    expect(rolePermDelete).not.toHaveBeenCalled();
  });

  it("dry-run: reports revoked for trainer grants that exist", async () => {
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
    // Trainer assignments DO exist in DB
    const rolePermFindUnique = vi.fn().mockImplementation(({ where }: { where: { roleId_permissionId: { roleId: string } } }) => {
      if (where.roleId_permissionId.roleId === TRAINER_ROLE.id) return Promise.resolve({ roleId: TRAINER_ROLE.id });
      return Promise.resolve(null);
    });
    const rolePermDelete = vi.fn();

    const prisma = makeMockPrisma({ permissionFindUnique: permFindUnique, roleFindUnique, rolePermissionFindUnique: rolePermFindUnique, rolePermissionDelete: rolePermDelete });
    const result = await reconcileTrainingPermissions(prisma, true);

    const revoked = result.revocations.filter((r) => r.action === "revoked");
    expect(revoked.length).toBe(2);
    // Dry-run: no actual delete
    expect(rolePermDelete).not.toHaveBeenCalled();
  });

  it("dry-run: trainer not in rolePermissions bootstrap outcomes", async () => {
    const roleFindUnique = vi.fn().mockImplementation(({ where }: { where: { key: string } }) => {
      if (where.key === "super_admin") return Promise.resolve(SUPER_ADMIN_ROLE);
      if (where.key === "trainer") return Promise.resolve(TRAINER_ROLE);
      return Promise.resolve(null);
    });
    const prisma = makeMockPrisma({ permissionFindUnique: vi.fn().mockResolvedValue(null), roleFindUnique });
    const result = await reconcileTrainingPermissions(prisma, true);
    const trainerBootstrap = result.rolePermissions.filter((r) => r.roleKey === "trainer");
    expect(trainerBootstrap).toHaveLength(0);
  });
});

// ── H. Safety ─────────────────────────────────────────────────────────────────

describe("reconcileTrainingPermissions — safety", () => {
  it("no operational role appears in TRAINING_ROLE_ASSIGNMENTS", () => {
    const roleKeys = TRAINING_ROLE_ASSIGNMENTS.map((a) => a.roleKey);
    for (const role of ["trainer", "viewer", "website_publisher", "match_coordinator"]) {
      expect(roleKeys).not.toContain(role);
    }
  });

  it("TRAINING_ROLE_ASSIGNMENTS has exactly 1 entry (super_admin only)", () => {
    expect(TRAINING_ROLE_ASSIGNMENTS).toHaveLength(1);
  });

  it("does not create permissions with incorrect keys", async () => {
    const permUpsert = vi.fn().mockResolvedValue({});
    const prisma = makeMockPrisma({
      permissionFindUnique: vi.fn().mockResolvedValue(null),
      permissionUpsert: permUpsert,
      roleFindUnique: vi.fn().mockResolvedValue(null),
    });
    await reconcileTrainingPermissions(prisma, false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const createdKeys = permUpsert.mock.calls.map((c: any[]) => (c[0] as { create: { key: string } }).create.key);
    expect(createdKeys).not.toContain("training.view");
    expect(createdKeys).not.toContain("TRAININGS_VIEW");
    expect(createdKeys).toContain("trainings.view");
    expect(createdKeys).toContain("trainings.manage");
  });
});

// ── K. STAGE-OPS-03 regression — module not undefined ─────────────────────────

describe("STAGE-OPS-03 regression — module field is never undefined or null", () => {
  it("module value is exactly 'TRAININGS' for all defs", () => {
    for (const def of TRAINING_PERMISSION_DEFS) {
      expect(def.module).toBe("TRAININGS");
      expect(def.module).toBeDefined();
      expect(def.module).not.toBeNull();
    }
  });

  it("upsert create block includes module=TRAININGS (not undefined)", async () => {
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
      expect(createArg.module).toBe("TRAININGS");
      expect(createArg.module).not.toBeUndefined();
      expect(createArg).toHaveProperty("key");
      expect(createArg).toHaveProperty("name");
    }
  });
});

// ── M. STAGE-OPS-03B regression — trainer receives nothing automatically ───────

describe("STAGE-OPS-03B regression — trainer receives no automatic permissions", () => {
  it("trainer → trainings.view is NOT in TRAINING_ROLE_ASSIGNMENTS", () => {
    const roleKeys = TRAINING_ROLE_ASSIGNMENTS.map((a) => a.roleKey as string);
    expect(roleKeys).not.toContain("trainer");
  });

  it("reconciliation never upserts ANY trainer bootstrap RolePermission", async () => {
    const rolePermUpsert = vi.fn().mockResolvedValue({});
    const createdPerms = new Set<string>(["trainings.view", "trainings.manage"]);
    const permIdMap: Record<string, { id: string }> = { "trainings.view": PERM_VIEW, "trainings.manage": PERM_MANAGE };

    const prisma = makeMockPrisma({
      permissionFindUnique: vi.fn().mockImplementation(({ where }: { where: { key: string } }) =>
        Promise.resolve(createdPerms.has(where.key) ? (permIdMap[where.key] ?? null) : null)
      ),
      roleFindUnique: vi.fn().mockImplementation(({ where }: { where: { key: string } }) => {
        if (where.key === "super_admin") return Promise.resolve(SUPER_ADMIN_ROLE);
        if (where.key === "trainer") return Promise.resolve(TRAINER_ROLE);
        return Promise.resolve(null);
      }),
      rolePermissionFindUnique: vi.fn().mockResolvedValue(null),
      rolePermissionUpsert: rolePermUpsert,
    });

    await reconcileTrainingPermissions(prisma, false);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const trainerUpserts = (rolePermUpsert.mock.calls as any[][]).filter((call) => {
      const createArg = (call[0] as { create: { roleId: string } }).create;
      return createArg.roleId === TRAINER_ROLE.id;
    });
    expect(trainerUpserts).toHaveLength(0);
  });

  it("super_admin still receives exactly 2 upserts (view+manage)", async () => {
    const rolePermUpsert = vi.fn().mockResolvedValue({});
    const createdPerms = new Set<string>(["trainings.view", "trainings.manage"]);
    const permIdMap: Record<string, { id: string }> = { "trainings.view": PERM_VIEW, "trainings.manage": PERM_MANAGE };

    const prisma = makeMockPrisma({
      permissionFindUnique: vi.fn().mockImplementation(({ where }: { where: { key: string } }) =>
        Promise.resolve(createdPerms.has(where.key) ? (permIdMap[where.key] ?? null) : null)
      ),
      roleFindUnique: vi.fn().mockImplementation(({ where }: { where: { key: string } }) => {
        if (where.key === "super_admin") return Promise.resolve(SUPER_ADMIN_ROLE);
        if (where.key === "trainer") return Promise.resolve(TRAINER_ROLE);
        return Promise.resolve(null);
      }),
      rolePermissionFindUnique: vi.fn().mockResolvedValue(null),
      rolePermissionUpsert: rolePermUpsert,
    });

    await reconcileTrainingPermissions(prisma, false);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const saUpserts = (rolePermUpsert.mock.calls as any[][]).filter((call) => {
      const createArg = (call[0] as { create: { roleId: string } }).create;
      return createArg.roleId === SUPER_ADMIN_ROLE.id;
    });
    expect(saUpserts).toHaveLength(2);
    expect(rolePermUpsert).toHaveBeenCalledTimes(2);
  });
});

// ── N. Revocation tests ────────────────────────────────────────────────────────

describe("STAGE-OPS-03B revocation — cleanup obsolete trainer bootstrap grants", () => {
  it("calls rolePermission.delete for trainer → trainings.view when it exists", async () => {
    const rolePermDelete = vi.fn().mockResolvedValue({});
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
    // Trainer view assignment exists; manage assignment absent
    const rolePermFindUnique = vi.fn().mockImplementation(({ where }: { where: { roleId_permissionId: { roleId: string; permissionId: string } } }) => {
      const { roleId, permissionId } = where.roleId_permissionId;
      if (roleId === TRAINER_ROLE.id && permissionId === PERM_VIEW.id) return Promise.resolve({ roleId: TRAINER_ROLE.id });
      return Promise.resolve(null);
    });

    const prisma = makeMockPrisma({ permissionFindUnique: permFindUnique, roleFindUnique, rolePermissionFindUnique: rolePermFindUnique, rolePermissionDelete: rolePermDelete });
    const result = await reconcileTrainingPermissions(prisma, false);

    expect(rolePermDelete).toHaveBeenCalledTimes(1);
    const revokedView = result.revocations.find(
      (r) => r.roleKey === "trainer" && r.permissionKey === "trainings.view" && r.action === "revoked"
    );
    expect(revokedView).toBeDefined();
    const notPresentManage = result.revocations.find(
      (r) => r.roleKey === "trainer" && r.permissionKey === "trainings.manage" && r.action === "not_present"
    );
    expect(notPresentManage).toBeDefined();
  });

  it("calls rolePermission.delete for both trainer assignments when both exist", async () => {
    const rolePermDelete = vi.fn().mockResolvedValue({});
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
    // Both trainer assignments exist
    const rolePermFindUnique = vi.fn().mockImplementation(({ where }: { where: { roleId_permissionId: { roleId: string } } }) => {
      if (where.roleId_permissionId.roleId === TRAINER_ROLE.id) return Promise.resolve({ roleId: TRAINER_ROLE.id });
      return Promise.resolve(null);
    });

    const prisma = makeMockPrisma({ permissionFindUnique: permFindUnique, roleFindUnique, rolePermissionFindUnique: rolePermFindUnique, rolePermissionDelete: rolePermDelete });
    const result = await reconcileTrainingPermissions(prisma, false);

    expect(rolePermDelete).toHaveBeenCalledTimes(2);
    const revoked = result.revocations.filter((r) => r.action === "revoked" && r.roleKey === "trainer");
    expect(revoked).toHaveLength(2);
  });

  it("does NOT call delete when trainer assignments are already absent", async () => {
    const rolePermDelete = vi.fn().mockResolvedValue({});
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
    const rolePermFindUnique = vi.fn().mockResolvedValue(null); // No assignments exist

    const prisma = makeMockPrisma({ permissionFindUnique: permFindUnique, roleFindUnique, rolePermissionFindUnique: rolePermFindUnique, rolePermissionDelete: rolePermDelete });
    const result = await reconcileTrainingPermissions(prisma, false);

    expect(rolePermDelete).not.toHaveBeenCalled();
    const notPresent = result.revocations.filter((r) => r.action === "not_present");
    expect(notPresent).toHaveLength(2);
  });

  it("does NOT revoke super_admin assignments", async () => {
    const rolePermDelete = vi.fn().mockResolvedValue({});
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
    // Both super_admin and trainer have both assignments
    const rolePermFindUnique = vi.fn().mockResolvedValue({ roleId: "any" });

    const prisma = makeMockPrisma({ permissionFindUnique: permFindUnique, roleFindUnique, rolePermissionFindUnique: rolePermFindUnique, rolePermissionDelete: rolePermDelete });
    await reconcileTrainingPermissions(prisma, false);

    // Only 2 deletes (trainer×2), NOT super_admin
    expect(rolePermDelete).toHaveBeenCalledTimes(2);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const deletedRoleIds = (rolePermDelete.mock.calls as any[][]).map(
      (call) => (call[0] as { where: { roleId_permissionId: { roleId: string } } }).where.roleId_permissionId.roleId
    );
    expect(deletedRoleIds.every((id: string) => id === TRAINER_ROLE.id)).toBe(true);
  });
});
