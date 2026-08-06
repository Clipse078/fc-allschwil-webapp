/**
 * scripts/__tests__/rperm-05c1-seed-bootstrap-idempotency.test.ts
 *
 * RPERM-05-C1 — Finding 1 regression coverage: prisma/seed.ts and
 * scripts/rperm-03b-bootstrap-admin-separation.ts must resolve to exactly
 * ONE canonical FC Allschwil Club Admin role (getTenantClubAdminRoleKey),
 * regardless of run order or repetition.
 *
 * Requires a live, disposable local `DATABASE_URL` (never `STAGE_DB_URL`) —
 * see `lib/roles/__tests__/test-helpers.ts` and
 * `prisma/__tests__/rperm-02-seed-and-backfill.test.ts` for the same
 * repository convention. This file mirrors the exact Role upsert
 * `prisma/seed.ts` performs (rather than shelling out to the script) and
 * calls the real, exported `runExecute` from the bootstrap script with the
 * app's own Prisma client.
 */

import "dotenv/config";

import { beforeAll, describe, expect, it } from "vitest";
import { PermissionScope, RoleScope } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getTenantClubAdminRoleKey } from "@/lib/roles/tenant-role-keys";
import {
  CLUB_ADMIN_EMAIL,
  LEGACY_EMAIL,
  PLATFORM_EMAIL,
  TENANT_KEY,
  TENANT_PERMISSION_KEYS,
  runExecute,
} from "../rperm-03b-bootstrap-admin-separation";

const CANONICAL_KEY = getTenantClubAdminRoleKey(TENANT_KEY);

/** Mirrors the exact Role upsert prisma/seed.ts performs for the tenant Club Admin role. */
async function seedMaterializeTenantClubAdminRole(tenantId: string) {
  const role = await prisma.role.upsert({
    where: { key: CANONICAL_KEY },
    update: {
      name: "Club Admin",
      description: "Full operational access within this club",
      scope: RoleScope.TENANT,
      tenantId,
      isSystem: true,
      isTemplate: false,
      isArchived: false,
    },
    create: {
      key: CANONICAL_KEY,
      name: "Club Admin",
      description: "Full operational access within this club",
      scope: RoleScope.TENANT,
      tenantId,
      isSystem: true,
      isTemplate: false,
    },
  });

  const tenantPermissions = await prisma.permission.findMany({
    where: { scope: PermissionScope.TENANT },
  });
  for (const permission of tenantPermissions) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
      update: {},
      create: { roleId: role.id, permissionId: permission.id },
    });
  }
  return role;
}

/**
 * Counts only ACTIVE (non-archived) "Club Admin" roles — an archived
 * duplicate left behind by a prior RPERM-05-C1 consolidation run (see
 * scripts/rperm-05c1-consolidate-club-admin-roles.ts) is intentionally
 * excluded: it is no longer a live divergent identity, just an inert,
 * auditable shell.
 */
async function countFcaClubAdminRoles(tenantId: string): Promise<number> {
  return prisma.role.count({
    where: { scope: RoleScope.TENANT, tenantId, name: "Club Admin", isArchived: false },
  });
}

async function bootstrap03bExecute() {
  return runExecute(prisma, {
    platformEmail: PLATFORM_EMAIL,
    clubAdminEmail: CLUB_ADMIN_EMAIL,
    legacyAdminEmail: LEGACY_EMAIL,
    tenantKey: TENANT_KEY,
    platformPassword: "Test-Password-123!",
    clubAdminPassword: "Test-Password-456!",
  });
}

describe("RPERM-05-C1 — seed + bootstrap resolve to one canonical Club Admin role (real local DB)", () => {
  let tenantId: string;

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL is not set — cannot run DB integration tests.");
    }

    const tenant = await prisma.tenant.upsert({
      where: { key: TENANT_KEY },
      update: {},
      create: { key: TENANT_KEY, name: "FC Allschwil" },
    });
    tenantId = tenant.id;

    await prisma.role.upsert({
      where: { key: "super_admin" },
      update: {},
      create: { key: "super_admin", name: "Super Admin", scope: RoleScope.PLATFORM, isSystem: true },
    });

    // rperm-03b Step 12 requires the legacy fallback account to already exist.
    await prisma.user.upsert({
      where: { email: LEGACY_EMAIL },
      update: {},
      create: {
        email: LEGACY_EMAIL,
        firstName: "FC",
        lastName: "Admin",
        passwordHash: "test-hash-not-used",
        isActive: true,
      },
    });

    for (const key of TENANT_PERMISSION_KEYS) {
      await prisma.permission.upsert({
        where: { key },
        update: {},
        create: { key, name: key, module: "TEAMS", scope: PermissionScope.TENANT, grantableByAdmin: true },
      });
    }
  });

  it("seed materializes exactly one canonical Club Admin role, TENANT/isSystem/tenantId correct", async () => {
    await seedMaterializeTenantClubAdminRole(tenantId);

    expect(await countFcaClubAdminRoles(tenantId)).toBe(1);

    const role = await prisma.role.findUnique({ where: { key: CANONICAL_KEY } });
    expect(role).not.toBeNull();
    expect(role?.scope).toBe(RoleScope.TENANT);
    expect(role?.isSystem).toBe(true);
    expect(role?.tenantId).toBe(tenantId);
  });

  it("seed then bootstrap: bootstrap resolves the same canonical role — still exactly one", async () => {
    await seedMaterializeTenantClubAdminRole(tenantId);

    const result = await bootstrap03bExecute();

    expect(result.success).toBe(true);
    expect(result.rolesCreated).toHaveLength(0); // resolved by canonical key, never re-created
    expect(await countFcaClubAdminRoles(tenantId)).toBe(1);
  });

  it("bootstrap then seed: seed resolves the same canonical role — still exactly one", async () => {
    await bootstrap03bExecute();
    await seedMaterializeTenantClubAdminRole(tenantId);

    expect(await countFcaClubAdminRoles(tenantId)).toBe(1);
  });

  it("re-running seed + bootstrap repeatedly remains idempotent, protection is never weakened", async () => {
    await seedMaterializeTenantClubAdminRole(tenantId);
    await bootstrap03bExecute();
    await seedMaterializeTenantClubAdminRole(tenantId);
    await bootstrap03bExecute();

    expect(await countFcaClubAdminRoles(tenantId)).toBe(1);

    const role = await prisma.role.findUnique({ where: { key: CANONICAL_KEY } });
    expect(role?.isSystem).toBe(true);
    expect(role?.isArchived).toBe(false);
    expect(role?.scope).toBe(RoleScope.TENANT);
    expect(role?.tenantId).toBe(tenantId);
  });

  it("the FC Allschwil Club Admin (it@fcallschwil.ch) retains active tenant access after both flows", async () => {
    await seedMaterializeTenantClubAdminRole(tenantId);
    await bootstrap03bExecute();

    const clubAdminUser = await prisma.user.findUnique({ where: { email: CLUB_ADMIN_EMAIL } });
    expect(clubAdminUser).not.toBeNull();

    const membership = await prisma.tenantMembership.findUnique({
      where: { tenantId_userId: { tenantId, userId: clubAdminUser!.id } },
    });
    expect(membership?.isActive).toBe(true);

    const userRole = await prisma.userRole.findFirst({
      where: { userId: clubAdminUser!.id, role: { key: CANONICAL_KEY } },
    });
    expect(userRole).not.toBeNull();
    expect(userRole?.tenantId).toBe(tenantId);
  });
});
