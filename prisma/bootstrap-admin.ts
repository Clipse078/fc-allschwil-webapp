/**
 * Bootstrap Admin Script
 *
 * Creates or updates the admin@fcallschwil.ch super-admin account with a
 * temporary password. Run this ONCE after a fresh deployment or database reset.
 *
 * Usage:
 *   BOOTSTRAP_ADMIN_PASSWORD=<temp-password> npx tsx prisma/bootstrap-admin.ts
 *
 * This script does NOT run as part of `prisma db seed`. It must be invoked
 * explicitly. Change the password immediately after first login.
 */

import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set.");
}

const rawTemporaryPassword = process.env.BOOTSTRAP_ADMIN_PASSWORD;

if (!rawTemporaryPassword) {
  throw new Error(
    "BOOTSTRAP_ADMIN_PASSWORD is not set. " +
      "Pass it as an environment variable: BOOTSTRAP_ADMIN_PASSWORD=<temp-password> npx tsx prisma/bootstrap-admin.ts"
  );
}

const temporaryPassword: string = rawTemporaryPassword;

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const superAdminRole = await prisma.role.findUnique({
    where: { key: "super_admin" },
  });

  if (!superAdminRole) {
    throw new Error(
      "super_admin role not found. Run `npm run db:seed` first to create roles."
    );
  }

  const passwordHash = await bcrypt.hash(temporaryPassword, 12);

  const adminUser = await prisma.user.upsert({
    where: { email: "admin@fcallschwil.ch" },
    update: {
      firstName: "FC",
      lastName: "Admin",
      passwordHash,
      isActive: true,
    },
    create: {
      email: "admin@fcallschwil.ch",
      firstName: "FC",
      lastName: "Admin",
      passwordHash,
      isActive: true,
    },
  });

  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: adminUser.id,
        roleId: superAdminRole.id,
      },
    },
    update: {},
    create: {
      userId: adminUser.id,
      roleId: superAdminRole.id,
    },
  });

  console.log("Bootstrap admin complete.");
  console.log("Email:", adminUser.email);
  console.log("Change the password immediately after first login.");
}

main()
  .catch((error) => {
    console.error("Bootstrap admin failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
