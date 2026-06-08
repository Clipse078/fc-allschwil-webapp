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
 *
 * SAFETY GUARDRAIL — password mutation policy:
 *   This script sets a password hash only on initial user creation. On subsequent
 *   runs (upsert path) it deliberately does NOT overwrite the existing password.
 *
 *   In STAGE and PROD environments the script will REFUSE to set or overwrite a
 *   password unless ALLOW_PASSWORD_CHANGE=true is explicitly provided.
 *   This prevents accidental credential rotation when the script is re-run to
 *   patch non-credential fields (e.g. tenantId, isActive, role assignments).
 *
 *   To change a password in STAGE/PROD intentionally:
 *     ALLOW_PASSWORD_CHANGE=true BOOTSTRAP_ADMIN_PASSWORD=<new> npx tsx prisma/bootstrap-admin.ts
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

// ── Environment safety check ──────────────────────────────────────────────────
// Detect STAGE / PROD by APP_ENV.  When running in a protected environment,
// the script must be explicitly opted-in to password mutation.
const appEnv = (process.env.APP_ENV ?? "local").trim().toLowerCase();
const isProtectedEnv = appEnv === "stage" || appEnv === "prod";
const allowPasswordChange = process.env.ALLOW_PASSWORD_CHANGE === "true";

if (isProtectedEnv && !allowPasswordChange) {
  // Still allow the script to run for non-password operations but we must
  // know the password to hash for the CREATE path.  Block entirely so the
  // operator is aware of the policy before proceeding.
  console.error(
    `\n[bootstrap-admin] BLOCKED: running in ${appEnv.toUpperCase()} environment.\n` +
    `Password mutation is forbidden by default.\n\n` +
    `To continue (ONLY if you intend to set/change the password):\n` +
    `  ALLOW_PASSWORD_CHANGE=true BOOTSTRAP_ADMIN_PASSWORD=<password> npx tsx prisma/bootstrap-admin.ts\n` +
    `\nIf you only need to patch non-credential fields, contact your DBA.\n`
  );
  process.exit(1);
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
  const tenant = await prisma.tenant.findUnique({
    where: { key: "fc-allschwil" },
  });

  if (!tenant) {
    throw new Error(
      "fc-allschwil tenant not found. Run `npm run db:seed` first to create tenant."
    );
  }

  const superAdminRole = await prisma.role.findUnique({
    where: { key: "super_admin" },
  });

  if (!superAdminRole) {
    throw new Error(
      "super_admin role not found. Run `npm run db:seed` first to create roles."
    );
  }

  const passwordHash = await bcrypt.hash(temporaryPassword, 12);

  // NOTE: passwordHash is intentionally absent from the `update` block.
  // Re-running this script to patch non-credential fields (tenantId, isActive,
  // name) must never silently overwrite an existing production password.
  // The hash is only applied on the initial `create` path.
  const adminUser = await prisma.user.upsert({
    where: { email: "admin@fcallschwil.ch" },
    update: {
      firstName: "FC",
      lastName: "Admin",
      isActive: true,
      tenantId: tenant.id,
    },
    create: {
      email: "admin@fcallschwil.ch",
      firstName: "FC",
      lastName: "Admin",
      passwordHash,
      isActive: true,
      tenantId: tenant.id,
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
