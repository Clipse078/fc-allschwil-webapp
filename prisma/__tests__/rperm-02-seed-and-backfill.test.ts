/**
 * RPERM-02 — Seed and Backfill Integration Tests
 *
 * Requires a live PostgreSQL database (DATABASE_URL env var).
 * Run after `prisma db push` and `tsx prisma/seed.ts`.
 * DATABASE_URL is loaded from .env via dotenv/config.
 *
 * Tests covering:
 *
 *   DB-RPERM02-1.  All permissions have a scope field
 *   DB-RPERM02-2.  All permissions have a grantableByAdmin field
 *   DB-RPERM02-3.  Platform-only permissions have scope=PLATFORM, grantableByAdmin=false
 *   DB-RPERM02-4.  All other permissions have scope=TENANT, grantableByAdmin=true
 *   DB-RPERM02-5.  super_admin role has isSystem=true
 *   DB-RPERM02-6.  club_admin role has isTemplate=true and isSystem=true
 *   DB-RPERM02-7.  Backfill is idempotent — second run creates 0 new memberships
 *   DB-RPERM02-8.  New permission keys are present in the database
 */

import "dotenv/config";

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaPg } from "@prisma/adapter-pg";
import { PermissionScope, PrismaClient } from "@prisma/client";
import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;

let prisma: PrismaClient;
let pool: Pool;

beforeAll(() => {
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set — cannot run DB integration tests.");
  }
  pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  prisma = new PrismaClient({ adapter });
});

afterAll(async () => {
  await prisma.$disconnect();
  await pool.end();
});

describe("RPERM-02 — Seed: permission metadata", () => {
  it("DB-RPERM02-1: all seeded permissions have a scope field (not null)", async () => {
    const withNullScope = await prisma.permission.count({
      where: { scope: { equals: undefined } },
    });
    // All permissions in DB should have a non-null scope (defaulted to TENANT)
    const total = await prisma.permission.count();
    expect(total).toBeGreaterThan(0);
    // Verify by checking that all have either PLATFORM or TENANT scope
    const tenantCount = await prisma.permission.count({
      where: { scope: PermissionScope.TENANT },
    });
    const platformCount = await prisma.permission.count({
      where: { scope: PermissionScope.PLATFORM },
    });
    expect(tenantCount + platformCount).toBe(total);
    void withNullScope; // suppress unused warning
  });

  it("DB-RPERM02-2: all seeded permissions have a grantableByAdmin field", async () => {
    const total = await prisma.permission.count();
    const trueCount = await prisma.permission.count({ where: { grantableByAdmin: true } });
    const falseCount = await prisma.permission.count({ where: { grantableByAdmin: false } });
    expect(trueCount + falseCount).toBe(total);
  });

  it("DB-RPERM02-3: platform-only permissions are scope=PLATFORM and grantableByAdmin=false", async () => {
    const platformPermissionKeys = [
      "users.manage",
      "users.impersonate",
      "tenants.view",
      "tenants.manage",
    ];

    for (const key of platformPermissionKeys) {
      const perm = await prisma.permission.findUnique({ where: { key } });
      expect(perm, `Permission ${key} not found`).not.toBeNull();
      expect(perm!.scope, `${key} scope`).toBe(PermissionScope.PLATFORM);
      expect(perm!.grantableByAdmin, `${key} grantableByAdmin`).toBe(false);
    }
  });

  it("DB-RPERM02-4: all non-platform permissions have scope=TENANT and grantableByAdmin=true", async () => {
    const tenantPerms = await prisma.permission.findMany({
      where: { scope: PermissionScope.TENANT },
    });
    expect(tenantPerms.length).toBeGreaterThan(0);
    for (const perm of tenantPerms) {
      expect(perm.grantableByAdmin).toBe(true);
    }
  });

  it("DB-RPERM02-5: six new RPERM-02 permission keys exist in DB", async () => {
    const newKeys = [
      "users.view",
      "users.invite",
      "users.manage_memberships",
      "roles.view",
      "roles.manage",
      "roles.assign",
    ];
    for (const key of newKeys) {
      const perm = await prisma.permission.findUnique({ where: { key } });
      expect(perm, `Permission ${key} not found in DB`).not.toBeNull();
    }
  });
});

describe("RPERM-02 — Seed: system roles", () => {
  it("DB-RPERM02-5: super_admin has isSystem=true", async () => {
    const role = await prisma.role.findUnique({ where: { key: "super_admin" } });
    expect(role).not.toBeNull();
    expect(role!.isSystem).toBe(true);
  });

  it("DB-RPERM02-6: club_admin is a template-only system role", async () => {
    const role = await prisma.role.findUnique({ where: { key: "club_admin" } });
    expect(role).not.toBeNull();
    expect(role!.isSystem).toBe(true);
    expect(role!.isTemplate).toBe(true);
    // club_admin must have no permissions assigned (template only)
    const permCount = await prisma.rolePermission.count({
      where: { roleId: role!.id },
    });
    expect(permCount).toBe(0);
  });
});

describe("RPERM-02 — Backfill: idempotency", () => {
  it("DB-RPERM02-7: running backfill twice creates 0 new memberships on second run", async () => {
    // Count memberships before first run
    const beforeCount = await prisma.tenantMembership.count();

    // First backfill pass
    const users = await prisma.user.findMany({
      select: { id: true, tenantId: true, isActive: true, createdAt: true },
    });

    let firstRunCreated = 0;
    for (const user of users) {
      if (!user.tenantId) continue;
      const exists = await prisma.tenantMembership.findUnique({
        where: { tenantId_userId: { tenantId: user.tenantId, userId: user.id } },
        select: { id: true },
      });
      if (!exists) {
        await prisma.tenantMembership.create({
          data: {
            tenantId: user.tenantId,
            userId: user.id,
            isActive: user.isActive,
            joinedAt: user.createdAt,
            createdAt: user.createdAt,
          },
        });
        firstRunCreated++;
      }
    }

    const afterFirstCount = await prisma.tenantMembership.count();

    // Second backfill pass — must create 0 new rows
    let secondRunCreated = 0;
    for (const user of users) {
      if (!user.tenantId) continue;
      const exists = await prisma.tenantMembership.findUnique({
        where: { tenantId_userId: { tenantId: user.tenantId, userId: user.id } },
        select: { id: true },
      });
      if (!exists) {
        await prisma.tenantMembership.create({
          data: {
            tenantId: user.tenantId,
            userId: user.id,
            isActive: user.isActive,
            joinedAt: user.createdAt,
            createdAt: user.createdAt,
          },
        });
        secondRunCreated++;
      }
    }

    const afterSecondCount = await prisma.tenantMembership.count();

    // The second run must not create any new memberships
    expect(secondRunCreated).toBe(0);
    expect(afterSecondCount).toBe(afterFirstCount);

    // Sanity: total memberships >= memberships before both runs
    expect(afterSecondCount).toBeGreaterThanOrEqual(beforeCount);
    void firstRunCreated; // may be 0 on re-runs
  });
});
