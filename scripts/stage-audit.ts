/**
 * STAGE Auth State Audit Script
 * Connects to STAGE database and inspects authentication state.
 * Run with: DATABASE_URL=$STAGE_DIRECT_URL npx tsx scripts/stage-audit.ts
 */

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set.");
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("=== STAGE Authentication State Audit ===\n");

  // 1. Check admin@fcallschwil.ch
  console.log("--- 1. admin@fcallschwil.ch ---");
  const adminUser = await prisma.user.findUnique({
    where: { email: "admin@fcallschwil.ch" },
    include: { userRoles: { include: { role: true } } },
  });

  if (adminUser) {
    console.log("EXISTS: yes");
    console.log("ID:", adminUser.id);
    console.log("Name:", adminUser.firstName, adminUser.lastName);
    console.log("isActive:", adminUser.isActive);
    console.log(
      "lastLoginAt:",
      adminUser.lastLoginAt
        ? adminUser.lastLoginAt.toISOString()
        : "never logged in"
    );
    const roles = adminUser.userRoles.map((ur) => ur.role.key).join(", ");
    console.log("Roles assigned:", roles || "none");
    // Identify bcrypt prefix (cost factor visible)
    console.log(
      "passwordHash present:",
      adminUser.passwordHash.startsWith("$2") ? "yes (bcrypt)" : "unknown format"
    );
  } else {
    console.log("EXISTS: no (admin@fcallschwil.ch not found in DB)");
  }

  // 2. All users summary
  console.log("\n--- 2. All Users ---");
  const allUsers = await prisma.user.findMany({
    orderBy: { email: "asc" },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      isActive: true,
      lastLoginAt: true,
      userRoles: { include: { role: { select: { key: true, name: true } } } },
    },
  });
  console.log("Total users:", allUsers.length);
  for (const u of allUsers) {
    const roles = u.userRoles.map((ur) => ur.role.key).join(", ") || "none";
    const lastLogin = u.lastLoginAt ? u.lastLoginAt.toISOString() : "never";
    console.log(
      `  ${u.email} | ${u.firstName} ${u.lastName} | active:${u.isActive} | roles:[${roles}] | lastLogin:${lastLogin}`
    );
  }

  // 3. All Roles
  console.log("\n--- 3. All Roles ---");
  const roles = await prisma.role.findMany({
    orderBy: { key: "asc" },
    include: {
      rolePermissions: { include: { permission: { select: { key: true } } } },
    },
  });
  console.log("Total roles:", roles.length);
  for (const r of roles) {
    const perms = r.rolePermissions.map((rp) => rp.permission.key);
    console.log(`  [${r.key}] "${r.name}" — ${perms.length} permissions`);
    if (perms.length > 0) {
      console.log(`    Permissions: ${perms.join(", ")}`);
    }
  }

  // 4. All Permissions
  console.log("\n--- 4. All Permissions ---");
  const permissions = await prisma.permission.findMany({
    orderBy: { key: "asc" },
  });
  console.log("Total permissions:", permissions.length);
  for (const p of permissions) {
    console.log(`  [${p.key}] module:${p.module}`);
  }

  // 5. Org Units
  console.log("\n--- 5. Org Units ---");
  const orgUnits = await prisma.orgUnit.findMany({ orderBy: { name: "asc" } });
  console.log("Total org units:", orgUnits.length);
  for (const o of orgUnits) {
    console.log(`  [${o.id}] ${o.name} (type:${o.type})`);
  }

  // 6. Registrations
  console.log("\n--- 6. Registrations ---");
  const regCount = await prisma.registration.count();
  const regStats = await prisma.registration.groupBy({
    by: ["status"],
    _count: { status: true },
  });
  console.log("Total registrations:", regCount);
  for (const s of regStats) {
    console.log(`  status:${s.status} — count:${s._count.status}`);
  }

  // 7. Super admins check
  console.log("\n--- 7. Super Admin Accounts ---");
  const superAdminRole = await prisma.role.findUnique({
    where: { key: "super_admin" },
    include: {
      userRoles: {
        include: {
          user: {
            select: {
              email: true,
              firstName: true,
              lastName: true,
              isActive: true,
            },
          },
        },
      },
    },
  });
  if (superAdminRole) {
    console.log(
      "super_admin role exists, assigned to",
      superAdminRole.userRoles.length,
      "user(s):"
    );
    for (const ur of superAdminRole.userRoles) {
      console.log(
        `  ${ur.user.email} | ${ur.user.firstName} ${ur.user.lastName} | active:${ur.user.isActive}`
      );
    }
  } else {
    console.log("super_admin role NOT found — seed not run");
  }

  console.log("\n=== Audit Complete ===");
}

main()
  .catch((e) => {
    console.error("Audit failed:", e.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
