/**
 * lib/roles/__tests__/test-helpers.ts
 *
 * Shared fixtures for RPERM-05 integration tests. Uses the application's
 * own Prisma singleton (`@/lib/db/prisma`, connected via `DATABASE_URL`) —
 * a disposable local database, per repository convention for
 * mutation-heavy tests (see `prisma/__tests__/rperm-02-seed-and-backfill.test.ts`).
 * Every fixture is created with a random suffix and torn down in the
 * calling test file's `afterAll`, so tests are safe to run repeatedly
 * against a database that also carries the canonical seed data.
 */

import "dotenv/config";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db/prisma";

export { prisma };

export function uniqueSuffix(): string {
  return randomUUID().slice(0, 8);
}

export async function createTestTenant(label: string) {
  const suffix = uniqueSuffix();
  return prisma.tenant.create({
    data: { key: `rperm05-${label}-${suffix}`, name: `RPERM-05 Test Tenant ${label} ${suffix}` },
  });
}

export async function createTestUser(label: string) {
  const suffix = uniqueSuffix();
  return prisma.user.create({
    data: {
      email: `rperm05-${label}-${suffix}@example.test`,
      firstName: label,
      lastName: "Test",
      passwordHash: "test-hash-not-used",
      isActive: true,
    },
  });
}

export async function createTestMembership(tenantId: string, userId: string, isActive = true) {
  return prisma.tenantMembership.create({ data: { tenantId, userId, isActive } });
}

export async function ensurePermission(
  key: string,
  opts: {
    module?: "USERS" | "WORKSPACE" | "TEAMS" | "ROLES";
    scope?: "TENANT" | "PLATFORM";
    grantableByAdmin?: boolean;
  } = {},
) {
  return prisma.permission.upsert({
    where: { key },
    update: {},
    create: {
      key,
      name: key,
      module: opts.module ?? "TEAMS",
      scope: opts.scope ?? "TENANT",
      grantableByAdmin: opts.grantableByAdmin ?? true,
    },
  });
}

export async function createTenantRoleFixture(params: {
  tenantId: string;
  name: string;
  isSystem?: boolean;
  isArchived?: boolean;
  permissionKeys?: string[];
}) {
  const suffix = uniqueSuffix();
  const role = await prisma.role.create({
    data: {
      key: `rperm05-role-${suffix}`,
      name: params.name,
      scope: "TENANT",
      tenantId: params.tenantId,
      isSystem: params.isSystem ?? false,
      isArchived: params.isArchived ?? false,
    },
  });

  for (const key of params.permissionKeys ?? []) {
    const permission = await prisma.permission.findUnique({ where: { key } });
    if (!permission) throw new Error(`Fixture permission missing: ${key}`);
    await prisma.rolePermission.create({ data: { roleId: role.id, permissionId: permission.id } });
  }

  return role;
}

export async function assignUserRoleFixture(params: {
  userId: string;
  roleId: string;
  tenantId: string | null;
}) {
  return prisma.userRole.create({
    data: { userId: params.userId, roleId: params.roleId, tenantId: params.tenantId },
  });
}

/**
 * Cleans up every row created under the given tenant ids and user ids, in
 * an order that respects FK constraints (RolePermission/UserRole before
 * Role; TenantMembership + Role before Tenant, since Role.tenant is
 * onDelete: Restrict).
 */
export async function cleanupTestFixtures(params: { tenantIds: string[]; userIds: string[] }) {
  const { tenantIds, userIds } = params;
  if (tenantIds.length === 0 && userIds.length === 0) return;

  const roleIds = (
    await prisma.role.findMany({
      where: { tenantId: { in: tenantIds } },
      select: { id: true },
    })
  ).map((r) => r.id);

  await prisma.rolePermission.deleteMany({ where: { roleId: { in: roleIds } } });
  await prisma.userRole.deleteMany({
    where: { OR: [{ roleId: { in: roleIds } }, { userId: { in: userIds } }] },
  });
  await prisma.role.deleteMany({ where: { id: { in: roleIds } } });
  await prisma.tenantMembership.deleteMany({
    where: { OR: [{ tenantId: { in: tenantIds } }, { userId: { in: userIds } }] },
  });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.tenant.deleteMany({ where: { id: { in: tenantIds } } });
}
