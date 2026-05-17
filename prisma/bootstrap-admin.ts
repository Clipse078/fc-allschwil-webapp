/**
 * bootstrap-admin.ts
 *
 * Minimal, safe script to ensure a working Superadmin login and the default
 * FC Allschwil tenant record both exist.
 *
 * Creates or updates ONLY:
 *   - super_admin Role
 *   - superadmin@sportclubevo.com User
 *   - UserRole relation (superadmin ↔ super_admin role)
 *   - Tenant record for FC Allschwil (slug: fc-allschwil)
 *   - UserTenant relation (superadmin ↔ fc-allschwil, isDefault: true)
 *
 * No teams, seasons, events or any other data is touched.
 * No prisma.*.upsert() calls — all operations use findFirst + update/create
 * so the script works even if the DB has drifted unique constraints.
 */

import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { Pool } from "pg";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("ERROR: DATABASE_URL environment variable is not set.");
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const ADMIN_EMAIL    = "superadmin@sportclubevo.com";
const ADMIN_PASSWORD = "ChangeMe123!";
const ROLE_KEY       = "super_admin";
const ROLE_NAME      = "Super Admin";
const ROLE_DESC      = "Full platform access";

const FCA_TENANT = {
  slug:           "fc-allschwil",
  name:           "FC Allschwil",
  displayName:    "FC Allschwil",
  countryCode:    "CH",
  sportType:      "football",
  logoUrl:        "/images/logos/fc-allschwil.png",
} as const;

async function bootstrap() {
  console.log("\n── SportClubEvo bootstrap-admin ──────────────────────────");

  // ── 1. Role ───────────────────────────────────────────────────────────────
  const existingRole = await prisma.role.findFirst({ where: { key: ROLE_KEY } });

  let roleId: string;

  if (existingRole) {
    await prisma.role.update({
      where: { id: existingRole.id },
      data: { name: ROLE_NAME, description: ROLE_DESC },
    });
    roleId = existingRole.id;
    console.log(`✓  Role updated:          ${ROLE_KEY} (id: ${roleId})`);
  } else {
    const created = await prisma.role.create({
      data: { key: ROLE_KEY, name: ROLE_NAME, description: ROLE_DESC },
    });
    roleId = created.id;
    console.log(`✓  Role created:          ${ROLE_KEY} (id: ${roleId})`);
  }

  // ── 2. Superadmin user ────────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);

  const existingUser = await prisma.user.findFirst({ where: { email: ADMIN_EMAIL } });

  let userId: string;

  if (existingUser) {
    await prisma.user.update({
      where: { id: existingUser.id },
      data: { firstName: "Platform", lastName: "Admin", passwordHash, isActive: true },
    });
    userId = existingUser.id;
    console.log(`✓  User updated:          ${ADMIN_EMAIL} (id: ${userId})`);
  } else {
    const created = await prisma.user.create({
      data: {
        email:        ADMIN_EMAIL,
        firstName:    "Platform",
        lastName:     "Admin",
        passwordHash,
        isActive:     true,
      },
    });
    userId = created.id;
    console.log(`✓  User created:          ${ADMIN_EMAIL} (id: ${userId})`);
  }

  // ── 3. UserRole relation ──────────────────────────────────────────────────
  const existingUserRole = await prisma.userRole.findFirst({ where: { userId, roleId } });

  if (existingUserRole) {
    console.log(`✓  UserRole relation:     already exists (id: ${existingUserRole.id})`);
  } else {
    const created = await prisma.userRole.create({ data: { userId, roleId } });
    console.log(`✓  UserRole relation:     created (id: ${created.id})`);
  }

  // ── 4. FC Allschwil Tenant ────────────────────────────────────────────────
  const existingTenant = await prisma.tenant.findFirst({
    where: { slug: FCA_TENANT.slug },
  });

  let tenantId: string;

  if (existingTenant) {
    await prisma.tenant.update({
      where: { id: existingTenant.id },
      data: {
        name:        FCA_TENANT.name,
        displayName: FCA_TENANT.displayName,
        countryCode: FCA_TENANT.countryCode,
        sportType:   FCA_TENANT.sportType,
        logoUrl:     FCA_TENANT.logoUrl,
        isActive:    true,
      },
    });
    tenantId = existingTenant.id;
    console.log(`✓  Tenant updated:        ${FCA_TENANT.slug} (id: ${tenantId})`);
  } else {
    const created = await prisma.tenant.create({
      data: {
        slug:        FCA_TENANT.slug,
        name:        FCA_TENANT.name,
        displayName: FCA_TENANT.displayName,
        countryCode: FCA_TENANT.countryCode,
        sportType:   FCA_TENANT.sportType,
        logoUrl:     FCA_TENANT.logoUrl,
        isActive:    true,
      },
    });
    tenantId = created.id;
    console.log(`✓  Tenant created:        ${FCA_TENANT.slug} (id: ${tenantId})`);
  }

  // ── 5. UserTenant relation ────────────────────────────────────────────────
  const existingUserTenant = await prisma.userTenant.findFirst({
    where: { userId, tenantId },
  });

  if (existingUserTenant) {
    console.log(`✓  UserTenant relation:   already exists (id: ${existingUserTenant.id})`);
  } else {
    const created = await prisma.userTenant.create({
      data: { userId, tenantId, isDefault: true },
    });
    console.log(`✓  UserTenant relation:   created (id: ${created.id})`);
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log("\n── Login credentials ─────────────────────────────────────");
  console.log(`   Email:    ${ADMIN_EMAIL}`);
  console.log(`   Password: ${ADMIN_PASSWORD}  ← change after first login`);
  console.log(`   Role:     ${ROLE_KEY}`);
  console.log("\n── Tenant seeded ─────────────────────────────────────────");
  console.log(`   Slug:     ${FCA_TENANT.slug}`);
  console.log(`   Name:     ${FCA_TENANT.name}`);
  console.log("──────────────────────────────────────────────────────────\n");
}

bootstrap()
  .catch((error: unknown) => {
    console.error("\nbootstrap-admin failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
