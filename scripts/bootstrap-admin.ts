/**
 * Bootstrap the admin user and the fc-allschwil tenant.
 * Safe to run on an existing DB — all operations are idempotent.
 *
 * Usage:
 *   npm run bootstrap:admin
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, PermissionModule } from "@prisma/client";
import bcrypt from "bcryptjs";
import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not set.");

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const now = new Date();

  // ── 1. Ensure fc-allschwil tenant exists ──────────────────────────────────
  const existingTenant = await prisma.tenant.findUnique({
    where: { slug: "fc-allschwil" },
  });

  const tenant = existingTenant
    ? await prisma.tenant.update({
        where: { slug: "fc-allschwil" },
        data: {
          name: "FC Allschwil",
          displayName: "FC Allschwil",
          countryCode: "CH",
          sportType: "football",
          primaryColor: "#0b4aa2",
          isActive: true,
          updatedAt: now,
        },
      })
    : await prisma.tenant.create({
        data: {
          slug: "fc-allschwil",
          name: "FC Allschwil",
          displayName: "FC Allschwil",
          countryCode: "CH",
          sportType: "football",
          primaryColor: "#0b4aa2",
          isActive: true,
          updatedAt: now,
        },
      });

  console.log(`✓ Tenant: ${tenant.displayName ?? tenant.name} (${tenant.id})`);

  // ── 2. Ensure tenants.manage permission exists ────────────────────────────
  await prisma.permission.upsert({
    where: { key: "tenants.manage" },
    update: { name: "Manage tenants", module: PermissionModule.TENANTS },
    create: { key: "tenants.manage", name: "Manage tenants", module: PermissionModule.TENANTS },
  });

  // ── 3. Ensure super_admin role exists ──────────────────────────────────────
  const superAdminRole = await prisma.role.upsert({
    where: { key: "super_admin" },
    update: { name: "Super Admin", description: "Full platform access", updatedAt: now },
    create: {
      key: "super_admin",
      name: "Super Admin",
      description: "Full platform access",
      updatedAt: now,
    },
  });

  console.log(`✓ Role: ${superAdminRole.name}`);

  // ── 4. Upsert admin user ──────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash("ChangeMe123!", 12);

  const adminUser = await prisma.user.upsert({
    where: { email: "admin@fcallschwil.ch" },
    update: {
      firstName: "FC",
      lastName: "Admin",
      passwordHash,
      isActive: true,
      updatedAt: now,
    },
    create: {
      email: "admin@fcallschwil.ch",
      firstName: "FC",
      lastName: "Admin",
      passwordHash,
      isActive: true,
      updatedAt: now,
    },
  });

  console.log(`✓ User: ${adminUser.email}`);

  // ── 5. Assign super_admin role ─────────────────────────────────────────────
  await prisma.userRole.upsert({
    where: {
      userId_roleId: { userId: adminUser.id, roleId: superAdminRole.id },
    },
    update: {},
    create: { userId: adminUser.id, roleId: superAdminRole.id },
  });

  console.log(`✓ Role assigned: super_admin → ${adminUser.email}`);

  // ── 6. Link admin to tenant ────────────────────────────────────────────────
  await prisma.userTenant.upsert({
    where: {
      userId_tenantId: { userId: adminUser.id, tenantId: tenant.id },
    },
    update: { isActive: true, role: "super_admin", updatedAt: now },
    create: {
      userId: adminUser.id,
      tenantId: tenant.id,
      role: "super_admin",
      isActive: true,
      updatedAt: now,
    },
  });

  console.log(`✓ UserTenant: ${adminUser.email} → ${tenant.slug}`);
  console.log("\nBootstrap complete.");
  console.log("  Email:    admin@fcallschwil.ch");
  console.log("  Password: ChangeMe123!  ← change on first login");
}

main()
  .catch((e) => {
    console.error("bootstrap:admin failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
