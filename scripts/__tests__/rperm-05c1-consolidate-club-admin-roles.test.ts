/**
 * scripts/__tests__/rperm-05c1-consolidate-club-admin-roles.test.ts
 *
 * RPERM-05-C1 — Finding 1 consolidation tooling tests.
 *
 * Two layers:
 *   - Pure `buildPlan()` tests (no I/O) covering every plan-shape case.
 *   - Real, disposable local-database integration tests (same convention
 *     as `lib/roles/__tests__/test-helpers.ts`) covering the actual
 *     transactional merge for every required scenario: canonical-only,
 *     legacy-only, both roles (different/overlapping/disjoint users and
 *     permissions), dry-run, repeated execution (idempotency), and tenant
 *     isolation.
 *   - A mocked-Prisma test proving a mid-transaction failure propagates as
 *     a rejection (so Prisma's real transaction rolls back every write).
 */

import "dotenv/config";

import { afterAll, describe, expect, it, vi } from "vitest";
import { RoleScope } from "@prisma/client";
import {
  createTestTenant,
  createTestUser,
  ensurePermission,
  prisma,
} from "@/lib/roles/__tests__/test-helpers";
import { getTenantClubAdminRoleKey } from "@/lib/roles/tenant-role-keys";
import {
  buildPlan,
  inspect,
  runConsolidation,
  type InspectResult,
  type RoleCandidate,
} from "../rperm-05c1-consolidate-club-admin-roles";

// ---------------------------------------------------------------------------
// Fixture builders
// ---------------------------------------------------------------------------

function candidate(overrides: Partial<RoleCandidate> & { id: string; key: string }): RoleCandidate {
  return {
    id: overrides.id,
    key: overrides.key,
    name: overrides.name ?? "Club Admin",
    scope: overrides.scope ?? RoleScope.TENANT,
    tenantId: overrides.tenantId ?? "tenant-1",
    isSystem: overrides.isSystem ?? false,
    isArchived: overrides.isArchived ?? false,
    permissionKeys: overrides.permissionKeys ?? [],
    userIds: overrides.userIds ?? [],
  };
}

function inspectionFixture(overrides: Partial<InspectResult> = {}): InspectResult {
  return {
    tenant: { exists: true, id: "tenant-1", key: "fc-allschwil", name: "FC Allschwil" },
    roleName: "Club Admin",
    canonicalKey: "club_admin__fc-allschwil",
    canonical: null,
    duplicates: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// buildPlan() — pure function
// ---------------------------------------------------------------------------

describe("buildPlan (pure)", () => {
  it("tenant not found → TENANT_NOT_FOUND no-op with a conflict-free plan shape", () => {
    const plan = buildPlan(inspectionFixture({ tenant: { exists: false } }));
    expect(plan.tenantFound).toBe(false);
    expect(plan.noOpReason).toBe("TENANT_NOT_FOUND");
    expect(plan.legacyRoleKeys).toHaveLength(0);
  });

  it("neither role exists → NO_DUPLICATES_FOUND no-op, nothing to create or move", () => {
    const plan = buildPlan(inspectionFixture({ canonical: null, duplicates: [] }));
    expect(plan.canonicalRoleExists).toBe(false);
    expect(plan.willCreateCanonicalRole).toBe(false);
    expect(plan.noOpReason).toBe("NO_DUPLICATES_FOUND");
  });

  it("canonical role only → no-op, nothing to merge", () => {
    const plan = buildPlan(
      inspectionFixture({
        canonical: candidate({ id: "canon-1", key: "club_admin__fc-allschwil", isSystem: true, permissionKeys: ["a"], userIds: ["u1"] }),
        duplicates: [],
      }),
    );
    expect(plan.canonicalRoleExists).toBe(true);
    expect(plan.noOpReason).toBe("NO_DUPLICATES_FOUND");
    expect(plan.permissionKeysToMerge).toHaveLength(0);
    expect(plan.userIdsToMove).toHaveLength(0);
  });

  it("legacy role only (no canonical yet) → will create canonical and migrate everything", () => {
    const plan = buildPlan(
      inspectionFixture({
        canonical: null,
        duplicates: [candidate({ id: "legacy-1", key: "club_admin_fc_allschwil", permissionKeys: ["a", "b"], userIds: ["u1"] })],
      }),
    );
    expect(plan.canonicalRoleExists).toBe(false);
    expect(plan.willCreateCanonicalRole).toBe(true);
    expect(plan.noOpReason).toBeNull();
    expect(plan.permissionKeysToMerge.sort()).toEqual(["a", "b"]);
    expect(plan.userIdsToMove).toEqual(["u1"]);
  });

  it("both roles, disjoint permissions → merges only the legacy-only permissions", () => {
    const plan = buildPlan(
      inspectionFixture({
        canonical: candidate({ id: "canon-1", key: "club_admin__fc-allschwil", isSystem: true, permissionKeys: ["a"] }),
        duplicates: [candidate({ id: "legacy-1", key: "club_admin_fc_allschwil", permissionKeys: ["b", "c"] })],
      }),
    );
    expect(plan.permissionKeysToMerge.sort()).toEqual(["b", "c"]);
  });

  it("both roles, overlapping users → only the not-already-canonical user is planned to move", () => {
    const plan = buildPlan(
      inspectionFixture({
        canonical: candidate({ id: "canon-1", key: "club_admin__fc-allschwil", isSystem: true, userIds: ["u1"] }),
        duplicates: [candidate({ id: "legacy-1", key: "club_admin_fc_allschwil", userIds: ["u1", "u2"] })],
      }),
    );
    expect(plan.userIdsToMove).toEqual(["u2"]);
  });

  it("both roles, disjoint users → both are planned to move to canonical", () => {
    const plan = buildPlan(
      inspectionFixture({
        canonical: candidate({ id: "canon-1", key: "club_admin__fc-allschwil", isSystem: true, userIds: ["u1"] }),
        duplicates: [candidate({ id: "legacy-1", key: "club_admin_fc_allschwil", userIds: ["u2"] })],
      }),
    );
    expect(plan.userIdsToMove).toEqual(["u2"]);
  });

  it("tenant mismatch on a duplicate → flags a conflict, never silently merges cross-tenant", () => {
    const plan = buildPlan(
      inspectionFixture({
        canonical: candidate({ id: "canon-1", key: "club_admin__fc-allschwil", isSystem: true, tenantId: "tenant-1" }),
        duplicates: [candidate({ id: "legacy-1", key: "club_admin_fc_allschwil", tenantId: "tenant-2" })],
      }),
    );
    expect(plan.conflicts.length).toBeGreaterThan(0);
    expect(plan.conflicts[0]).toMatch(/cross-tenant/i);
  });

  it("tenant mismatch on the canonical role itself → flags a conflict", () => {
    const plan = buildPlan(
      inspectionFixture({
        canonical: candidate({ id: "canon-1", key: "club_admin__fc-allschwil", isSystem: true, tenantId: "tenant-99" }),
        duplicates: [candidate({ id: "legacy-1", key: "club_admin_fc_allschwil", tenantId: "tenant-1" })],
      }),
    );
    expect(plan.conflicts.length).toBeGreaterThan(0);
    expect(plan.conflicts.some((c) => c.includes("club_admin__fc-allschwil"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// runConsolidation() — real disposable local database
// ---------------------------------------------------------------------------

describe("runConsolidation (real local DB)", () => {
  const tenantIds: string[] = [];
  const userIds: string[] = [];

  afterAll(async () => {
    await cleanup();
  });

  async function cleanup() {
    if (tenantIds.length === 0 && userIds.length === 0) return;
    const roleIds = (
      await prisma.role.findMany({ where: { tenantId: { in: tenantIds } }, select: { id: true } })
    ).map((r) => r.id);
    await prisma.rolePermission.deleteMany({ where: { roleId: { in: roleIds } } });
    await prisma.userRole.deleteMany({ where: { OR: [{ roleId: { in: roleIds } }, { userId: { in: userIds } }] } });
    await prisma.role.deleteMany({ where: { id: { in: roleIds } } });
    await prisma.tenantMembership.deleteMany({
      where: { OR: [{ tenantId: { in: tenantIds } }, { userId: { in: userIds } }] },
    });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.tenant.deleteMany({ where: { id: { in: tenantIds } } });
  }

  async function createCanonicalRole(tenantId: string, tenantKey: string, opts: { isSystem?: boolean; isArchived?: boolean } = {}) {
    return prisma.role.create({
      data: {
        key: getTenantClubAdminRoleKey(tenantKey),
        name: "Club Admin",
        scope: "TENANT",
        tenantId,
        isSystem: opts.isSystem ?? true,
        isArchived: opts.isArchived ?? false,
      },
    });
  }

  async function createLegacyDuplicateRole(tenantId: string, keySuffix: string) {
    return prisma.role.create({
      data: {
        key: `club_admin_legacy_${keySuffix}`,
        name: "Club Admin",
        scope: "TENANT",
        tenantId,
        isSystem: false,
        isArchived: false,
      },
    });
  }

  it("canonical role only: no-op, self-heals isSystem drift, never touches other data", async () => {
    const tenant = await createTestTenant("c1-canonical-only");
    tenantIds.push(tenant.id);
    const perm = await ensurePermission("rperm05c1-perm-a", { scope: "TENANT" });
    const user = await createTestUser("c1-canonical-only");
    userIds.push(user.id);

    const canonical = await createCanonicalRole(tenant.id, tenant.key, { isSystem: false });
    await prisma.rolePermission.create({ data: { roleId: canonical.id, permissionId: perm.id } });
    await prisma.userRole.create({ data: { userId: user.id, roleId: canonical.id, tenantId: tenant.id } });

    const result = await runConsolidation(prisma, { tenantKey: tenant.key, dryRun: false });

    expect(result.noOp).toBe(true);
    expect(result.canonicalRoleCreated).toBe(false);
    expect(result.legacyRolesArchived).toHaveLength(0);

    const healed = await prisma.role.findUnique({ where: { id: canonical.id } });
    expect(healed?.isSystem).toBe(true); // self-healed even though no-op
    expect(healed?.isArchived).toBe(false);

    const permCount = await prisma.rolePermission.count({ where: { roleId: canonical.id } });
    expect(permCount).toBe(1);
    const userRoleCount = await prisma.userRole.count({ where: { roleId: canonical.id } });
    expect(userRoleCount).toBe(1);
  });

  it("legacy role only (no canonical yet): creates the canonical role and migrates everything", async () => {
    const tenant = await createTestTenant("c1-legacy-only");
    tenantIds.push(tenant.id);
    const perm = await ensurePermission("rperm05c1-perm-b", { scope: "TENANT" });
    const user = await createTestUser("c1-legacy-only");
    userIds.push(user.id);

    const legacy = await createLegacyDuplicateRole(tenant.id, tenant.key);
    await prisma.rolePermission.create({ data: { roleId: legacy.id, permissionId: perm.id } });
    await prisma.userRole.create({ data: { userId: user.id, roleId: legacy.id, tenantId: tenant.id } });

    const result = await runConsolidation(prisma, { tenantKey: tenant.key, dryRun: false });

    expect(result.canonicalRoleCreated).toBe(true);
    expect(result.legacyRolesArchived).toEqual([legacy.key]);
    expect(result.permissionsMergedCount).toBe(1);
    expect(result.userAssignmentsMovedCount).toBe(1);

    const canonicalKey = getTenantClubAdminRoleKey(tenant.key);
    const canonical = await prisma.role.findUnique({ where: { key: canonicalKey } });
    expect(canonical).not.toBeNull();
    expect(canonical?.isSystem).toBe(true);
    expect(canonical?.scope).toBe("TENANT");
    expect(canonical?.tenantId).toBe(tenant.id);

    const canonicalPermCount = await prisma.rolePermission.count({ where: { roleId: canonical!.id } });
    expect(canonicalPermCount).toBe(1);
    const canonicalUserRole = await prisma.userRole.findFirst({ where: { roleId: canonical!.id, userId: user.id } });
    expect(canonicalUserRole).not.toBeNull();

    const legacyAfter = await prisma.role.findUnique({ where: { id: legacy.id } });
    expect(legacyAfter?.isArchived).toBe(true);
    const legacyPermCount = await prisma.rolePermission.count({ where: { roleId: legacy.id } });
    expect(legacyPermCount).toBe(0);
    const legacyUserRoleCount = await prisma.userRole.count({ where: { roleId: legacy.id } });
    expect(legacyUserRoleCount).toBe(0);

    // Exactly one active (non-archived) "Club Admin" role remains for this tenant.
    const activeClubAdminRoles = await prisma.role.count({
      where: { scope: "TENANT", tenantId: tenant.id, name: "Club Admin", isArchived: false },
    });
    expect(activeClubAdminRoles).toBe(1);
  });

  it("both roles with different permissions: canonical ends up with the union", async () => {
    const tenant = await createTestTenant("c1-both-diff-perms");
    tenantIds.push(tenant.id);
    const permA = await ensurePermission("rperm05c1-perm-c1", { scope: "TENANT" });
    const permB = await ensurePermission("rperm05c1-perm-c2", { scope: "TENANT" });

    const canonical = await createCanonicalRole(tenant.id, tenant.key);
    await prisma.rolePermission.create({ data: { roleId: canonical.id, permissionId: permA.id } });

    const legacy = await createLegacyDuplicateRole(tenant.id, tenant.key);
    await prisma.rolePermission.create({ data: { roleId: legacy.id, permissionId: permB.id } });

    const result = await runConsolidation(prisma, { tenantKey: tenant.key, dryRun: false });

    expect(result.permissionsMergedCount).toBe(1);
    const canonicalPerms = await prisma.rolePermission.findMany({
      where: { roleId: canonical.id },
      select: { permission: { select: { key: true } } },
    });
    expect(canonicalPerms.map((p) => p.permission.key).sort()).toEqual(
      [permA.key, permB.key].sort(),
    );
  });

  it("both roles with overlapping users: no duplicate UserRole row is created", async () => {
    const tenant = await createTestTenant("c1-overlap-users");
    tenantIds.push(tenant.id);
    const sharedUser = await createTestUser("c1-overlap-shared");
    const legacyOnlyUser = await createTestUser("c1-overlap-legacy-only");
    userIds.push(sharedUser.id, legacyOnlyUser.id);

    const canonical = await createCanonicalRole(tenant.id, tenant.key);
    await prisma.userRole.create({ data: { userId: sharedUser.id, roleId: canonical.id, tenantId: tenant.id } });

    const legacy = await createLegacyDuplicateRole(tenant.id, tenant.key);
    await prisma.userRole.create({ data: { userId: sharedUser.id, roleId: legacy.id, tenantId: tenant.id } });
    await prisma.userRole.create({ data: { userId: legacyOnlyUser.id, roleId: legacy.id, tenantId: tenant.id } });

    const result = await runConsolidation(prisma, { tenantKey: tenant.key, dryRun: false });

    // Only the legacy-only user counts as "moved" — the shared user already existed.
    expect(result.userAssignmentsMovedCount).toBe(1);

    const canonicalUserRoles = await prisma.userRole.findMany({ where: { roleId: canonical.id } });
    expect(canonicalUserRoles).toHaveLength(2);
    expect(canonicalUserRoles.filter((ur) => ur.userId === sharedUser.id)).toHaveLength(1); // no duplicate row

    const legacyUserRoleCount = await prisma.userRole.count({ where: { roleId: legacy.id } });
    expect(legacyUserRoleCount).toBe(0);
  });

  it("both roles with disjoint users: canonical ends up with both, no access lost", async () => {
    const tenant = await createTestTenant("c1-disjoint-users");
    tenantIds.push(tenant.id);
    const userA = await createTestUser("c1-disjoint-a");
    const userB = await createTestUser("c1-disjoint-b");
    userIds.push(userA.id, userB.id);

    const canonical = await createCanonicalRole(tenant.id, tenant.key);
    await prisma.userRole.create({ data: { userId: userA.id, roleId: canonical.id, tenantId: tenant.id } });

    const legacy = await createLegacyDuplicateRole(tenant.id, tenant.key);
    await prisma.userRole.create({ data: { userId: userB.id, roleId: legacy.id, tenantId: tenant.id } });

    await runConsolidation(prisma, { tenantKey: tenant.key, dryRun: false });

    const canonicalUserIds = (
      await prisma.userRole.findMany({ where: { roleId: canonical.id }, select: { userId: true } })
    ).map((ur) => ur.userId);
    expect(canonicalUserIds.sort()).toEqual([userA.id, userB.id].sort());
  });

  it("dry run performs zero writes and reports the exact would-be merge", async () => {
    const tenant = await createTestTenant("c1-dry-run");
    tenantIds.push(tenant.id);
    const perm = await ensurePermission("rperm05c1-perm-dry", { scope: "TENANT" });
    const user = await createTestUser("c1-dry-run");
    userIds.push(user.id);

    const canonical = await createCanonicalRole(tenant.id, tenant.key);
    const legacy = await createLegacyDuplicateRole(tenant.id, tenant.key);
    await prisma.rolePermission.create({ data: { roleId: legacy.id, permissionId: perm.id } });
    await prisma.userRole.create({ data: { userId: user.id, roleId: legacy.id, tenantId: tenant.id } });

    const result = await runConsolidation(prisma, { tenantKey: tenant.key, dryRun: true });

    expect(result.dryRun).toBe(true);
    expect(result.completed).toBe(false);
    expect(result.permissionsMergedCount).toBe(1);
    expect(result.userAssignmentsMovedCount).toBe(1);

    // Nothing was actually written.
    const legacyAfter = await prisma.role.findUnique({ where: { id: legacy.id } });
    expect(legacyAfter?.isArchived).toBe(false);
    const canonicalPermCount = await prisma.rolePermission.count({ where: { roleId: canonical.id } });
    expect(canonicalPermCount).toBe(0);
    const canonicalUserRoleCount = await prisma.userRole.count({ where: { roleId: canonical.id } });
    expect(canonicalUserRoleCount).toBe(0);
  });

  it("repeated execution is idempotent — the second run is a clean no-op", async () => {
    const tenant = await createTestTenant("c1-repeat");
    tenantIds.push(tenant.id);
    const perm = await ensurePermission("rperm05c1-perm-repeat", { scope: "TENANT" });
    const user = await createTestUser("c1-repeat");
    userIds.push(user.id);

    const legacy = await createLegacyDuplicateRole(tenant.id, tenant.key);
    await prisma.rolePermission.create({ data: { roleId: legacy.id, permissionId: perm.id } });
    await prisma.userRole.create({ data: { userId: user.id, roleId: legacy.id, tenantId: tenant.id } });

    const first = await runConsolidation(prisma, { tenantKey: tenant.key, dryRun: false });
    expect(first.noOp).toBe(false);
    expect(first.permissionsMergedCount).toBe(1);

    const second = await runConsolidation(prisma, { tenantKey: tenant.key, dryRun: false });
    expect(second.noOp).toBe(true);
    expect(second.permissionsMergedCount).toBe(0);
    expect(second.userAssignmentsMovedCount).toBe(0);
    expect(second.legacyRolesArchived).toHaveLength(0);

    const activeClubAdminRoles = await prisma.role.count({
      where: { scope: "TENANT", tenantId: tenant.id, name: "Club Admin", isArchived: false },
    });
    expect(activeClubAdminRoles).toBe(1);
  });

  it("tenant isolation: a same-named role belonging to a different tenant is never touched", async () => {
    const tenantA = await createTestTenant("c1-isolation-a");
    const tenantB = await createTestTenant("c1-isolation-b");
    tenantIds.push(tenantA.id, tenantB.id);

    const legacyA = await createLegacyDuplicateRole(tenantA.id, tenantA.key);
    const otherTenantRole = await prisma.role.create({
      data: { key: `club-admin-${tenantB.key}-other`, name: "Club Admin", scope: "TENANT", tenantId: tenantB.id, isSystem: false },
    });

    const inspection = await inspect(prisma, { tenantKey: tenantA.key });
    expect(inspection.duplicates.map((d) => d.id)).toEqual([legacyA.id]);
    expect(inspection.duplicates.some((d) => d.id === otherTenantRole.id)).toBe(false);

    await runConsolidation(prisma, { tenantKey: tenantA.key, dryRun: false });

    const untouched = await prisma.role.findUnique({ where: { id: otherTenantRole.id } });
    expect(untouched?.isArchived).toBe(false);
    expect(untouched?.name).toBe("Club Admin");
  });
});

// ---------------------------------------------------------------------------
// Rollback on failure — mocked Prisma, no real DB required
// ---------------------------------------------------------------------------

describe("runConsolidation — rollback on failure (mocked transaction)", () => {
  it("propagates a mid-transaction error instead of resolving — Prisma rolls back every write in the failed transaction", async () => {
    const roleCreateCalls: unknown[] = [];

    const mockPrisma = {
      tenant: {
        findUnique: vi.fn(async () => ({ id: "tenant-1", key: "fc-allschwil", name: "FC Allschwil" })),
      },
      role: {
        findFirst: vi.fn(async () => null), // no canonical role yet
        findMany: vi.fn(async ({ where }: { where?: { id?: { in?: string[] } } } = {}) => {
          if (where?.id?.in) {
            // Duplicate lookup inside the transaction.
            return [
              {
                id: "legacy-1",
                key: "club_admin_fc_allschwil",
                tenantId: "tenant-1",
                rolePermissions: [],
                userRoles: [],
              },
            ];
          }
          // Top-level duplicate discovery in inspect().
          return [
            {
              id: "legacy-1",
              key: "club_admin_fc_allschwil",
              name: "Club Admin",
              scope: "TENANT",
              tenantId: "tenant-1",
              isSystem: false,
              isArchived: false,
              rolePermissions: [],
              userRoles: [],
            },
          ];
        }),
        create: vi.fn(async (args: unknown) => {
          roleCreateCalls.push(args);
          throw new Error("Simulated mid-transaction failure");
        }),
      },
      $transaction: vi.fn(async (callback: (tx: unknown) => unknown) => {
        // A real Prisma interactive transaction rejects (and rolls back)
        // when the callback throws — this mock preserves that contract.
        return callback(mockPrisma);
      }),
    };

    await expect(
      runConsolidation(mockPrisma as never, { tenantKey: "fc-allschwil", dryRun: false }),
    ).rejects.toThrow("Simulated mid-transaction failure");

    // The create call was attempted (proving the failure happens mid-flight,
    // not before any write was even issued) — but the caller only ever
    // observes the rejection, never a "completed: true" result.
    expect(roleCreateCalls).toHaveLength(1);
  });
});
