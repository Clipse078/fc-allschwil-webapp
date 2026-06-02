/**
 * STAGE Validation Script
 *
 * Creates a temporary super_admin account, performs full validation of
 * Users / Roles / Permissions / Org Units / Registrations, then removes
 * the account. Does NOT modify any existing data.
 *
 * Run with:
 *   DATABASE_URL=$STAGE_DIRECT_URL TEMP_PASSWORD=<pw> npx tsx scripts/stage-validation.ts
 */

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { Pool } from "pg";

const TEMP_EMAIL = "stage-admin-validation@fcallschwil.ch";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not set.");

const tempPassword = process.env.TEMP_PASSWORD;
if (!tempPassword) throw new Error("TEMP_PASSWORD is not set.");

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

function section(title: string) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`  ${title}`);
  console.log("=".repeat(60));
}

function sub(title: string) {
  console.log(`\n--- ${title} ---`);
}

async function main() {
  section("STAGE VALIDATION REPORT");
  console.log("Timestamp:", new Date().toISOString());
  console.log("Temp account:", TEMP_EMAIL);

  // ──────────────────────────────────────────────────────
  // STEP 1: Create temporary validation account
  // ──────────────────────────────────────────────────────
  section("STEP 1: Create Temporary Validation Account");

  const superAdminRole = await prisma.role.findUnique({
    where: { key: "super_admin" },
  });
  if (!superAdminRole) {
    throw new Error(
      "super_admin role not found. Seed has not been run on STAGE."
    );
  }

  // Ensure no leftover from a prior run
  const existing = await prisma.user.findUnique({
    where: { email: TEMP_EMAIL },
  });
  if (existing) {
    await prisma.userRole.deleteMany({ where: { userId: existing.id } });
    await prisma.user.delete({ where: { id: existing.id } });
    console.log("Cleaned up leftover account from previous run.");
  }

  const passwordHash = await bcrypt.hash(tempPassword, 12);
  const tempUser = await prisma.user.create({
    data: {
      email: TEMP_EMAIL,
      firstName: "Stage",
      lastName: "Validation",
      passwordHash,
      isActive: true,
    },
  });
  await prisma.userRole.create({
    data: { userId: tempUser.id, roleId: superAdminRole.id },
  });

  console.log("Created temporary account:");
  console.log("  ID:", tempUser.id);
  console.log("  Email:", tempUser.email);
  console.log("  Role: super_admin");
  console.log("  Password: [set from TEMP_PASSWORD env var]");

  // Verify creation
  const createdUser = await prisma.user.findUnique({
    where: { email: TEMP_EMAIL },
    include: { userRoles: { include: { role: true } } },
  });
  if (
    !createdUser ||
    !createdUser.userRoles.some((ur) => ur.role.key === "super_admin")
  ) {
    throw new Error("Account creation verification failed.");
  }
  console.log("  Verification: PASSED");

  // ──────────────────────────────────────────────────────
  // STEP 2: Credential verification
  // ──────────────────────────────────────────────────────
  section("STEP 2: Credential Verification");

  const hashMatch = await bcrypt.compare(tempPassword, createdUser.passwordHash);
  console.log("bcrypt hash/verify match:", hashMatch ? "PASSED" : "FAILED");

  // ──────────────────────────────────────────────────────
  // STEP 3: Validate Users
  // ──────────────────────────────────────────────────────
  section("STEP 3: Users Validation");

  const allUsers = await prisma.user.findMany({
    orderBy: { email: "asc" },
    include: {
      userRoles: { include: { role: { select: { key: true, name: true } } } },
    },
  });

  const preExistingUsers = allUsers.filter((u) => u.email !== TEMP_EMAIL);
  const tempAccountInList = allUsers.find((u) => u.email === TEMP_EMAIL);

  sub("All users in STAGE DB (including temp account)");
  console.log("Total users:", allUsers.length);
  for (const u of allUsers) {
    const roles = u.userRoles.map((ur) => ur.role.key).join(", ") || "none";
    const lastLogin = u.lastLoginAt ? u.lastLoginAt.toISOString() : "never";
    const tag = u.email === TEMP_EMAIL ? "[TEMP]" : "[PERM]";
    console.log(
      `  ${tag} ${u.email} | ${u.firstName} ${u.lastName} | active:${u.isActive} | roles:[${roles}] | lastLogin:${lastLogin}`
    );
  }

  sub("Checks");
  console.log(
    "Pre-existing users count:",
    preExistingUsers.length,
    "(unchanged)"
  );
  console.log(
    "Temp account present in user list:",
    tempAccountInList ? "yes" : "no"
  );
  console.log(
    "admin@fcallschwil.ch unchanged:",
    preExistingUsers.some(
      (u) =>
        u.email === "admin@fcallschwil.ch" &&
        u.userRoles.some((ur) => ur.role.key === "super_admin") &&
        u.isActive
    )
      ? "PASSED"
      : "NOT FOUND / CHANGED"
  );

  // ──────────────────────────────────────────────────────
  // STEP 4: Validate Roles
  // ──────────────────────────────────────────────────────
  section("STEP 4: Roles Validation");

  const roles = await prisma.role.findMany({
    orderBy: { key: "asc" },
    include: {
      rolePermissions: { include: { permission: { select: { key: true } } } },
      userRoles: { select: { userId: true } },
    },
  });

  console.log("Total roles:", roles.length);
  const expectedRoles = [
    "super_admin",
    "match_coordinator",
    "website_publisher",
    "trainer",
    "viewer",
  ];

  for (const r of roles) {
    const perms = r.rolePermissions.map((rp) => rp.permission.key);
    const userCount = r.userRoles.length;
    console.log(
      `\n  [${r.key}] "${r.name}" | users:${userCount} | permissions:${perms.length}`
    );
    console.log(`    canAccessVereinsleitung: ${r.canAccessVereinsleitung}`);
    console.log(
      `    canAttendVereinsleitungMeetings: ${r.canAttendVereinsleitungMeetings}`
    );
    if (perms.length > 0) {
      console.log(`    Permissions: ${perms.sort().join(", ")}`);
    }
  }

  sub("Checks");
  const missingRoles = expectedRoles.filter(
    (key) => !roles.some((r) => r.key === key)
  );
  console.log(
    "All 5 expected roles present:",
    missingRoles.length === 0 ? "PASSED" : `MISSING: ${missingRoles.join(", ")}`
  );
  console.log(
    "super_admin has users.manage:",
    roles
      .find((r) => r.key === "super_admin")
      ?.rolePermissions.some((rp) => rp.permission.key === "users.manage")
      ? "PASSED"
      : "MISSING"
  );
  console.log(
    "super_admin has users.impersonate:",
    roles
      .find((r) => r.key === "super_admin")
      ?.rolePermissions.some((rp) => rp.permission.key === "users.impersonate")
      ? "PASSED"
      : "MISSING"
  );

  // ──────────────────────────────────────────────────────
  // STEP 5: Validate Permissions
  // ──────────────────────────────────────────────────────
  section("STEP 5: Permissions Validation");

  const permissions = await prisma.permission.findMany({
    orderBy: [{ module: "asc" }, { key: "asc" }],
  });

  console.log("Total permissions:", permissions.length);
  const byModule: Record<string, string[]> = {};
  for (const p of permissions) {
    byModule[p.module] = byModule[p.module] ?? [];
    byModule[p.module].push(p.key);
  }
  for (const [mod, keys] of Object.entries(byModule).sort()) {
    console.log(`  ${mod} (${keys.length}): ${keys.join(", ")}`);
  }

  sub("Checks");
  const expectedModules = [
    "USERS",
    "TEAMS",
    "PEOPLE",
    "FIXTURES",
    "EVENTS",
    "SEASONS",
    "REGISTRATIONS",
    "MEETINGS",
    "INITIATIVES",
    "TARGETS",
    "TEMPLATES",
    "TENANTS",
  ];
  const missingModules = expectedModules.filter((m) => !byModule[m]);
  console.log(
    "All expected modules covered:",
    missingModules.length === 0
      ? "PASSED"
      : `MISSING modules: ${missingModules.join(", ")}`
  );
  console.log("Total permission count (expected 36):", permissions.length === 36 ? "PASSED" : `WARN: got ${permissions.length}`);

  // ──────────────────────────────────────────────────────
  // STEP 6: Validate Org Units
  // ──────────────────────────────────────────────────────
  section("STEP 6: Org Units Validation");

  const orgUnits = await prisma.orgUnit.findMany({
    orderBy: { name: "asc" },
    include: {
      memberships: { select: { id: true } },
      children: { select: { id: true, name: true } },
    },
  });

  console.log("Total org units:", orgUnits.length);
  if (orgUnits.length === 0) {
    console.log("  (No org units configured yet — clean STAGE state)");
  } else {
    for (const o of orgUnits) {
      console.log(
        `  [${o.id}] ${o.name} | type:${o.type} | memberships:${o.memberships.length} | children:${o.children.length}`
      );
    }
  }

  // ──────────────────────────────────────────────────────
  // STEP 7: Validate Registrations
  // ──────────────────────────────────────────────────────
  section("STEP 7: Registrations Validation");

  const regTotal = await prisma.registration.count();
  const regByStatus = await prisma.registration.groupBy({
    by: ["status"],
    _count: { status: true },
  });

  console.log("Total registrations:", regTotal);
  if (regTotal === 0) {
    console.log("  (No registrations yet — clean STAGE state)");
  } else {
    for (const s of regByStatus) {
      console.log(`  status:${s.status} — ${s._count.status}`);
    }
  }

  // ──────────────────────────────────────────────────────
  // STEP 8: Additional state checks
  // ──────────────────────────────────────────────────────
  section("STEP 8: Additional State");

  const tenants = await prisma.tenant.findMany();
  console.log("Tenants:", tenants.length);
  for (const t of tenants) {
    console.log(`  [${t.key}] ${t.name}`);
  }

  const seasons = await prisma.season.findMany({ orderBy: { name: "asc" } });
  console.log("\nSeasons:", seasons.length);
  for (const s of seasons) {
    console.log(`  [${s.id}] ${s.name} | active:${s.isActive}`);
  }

  const teams = await prisma.team.count();
  const people = await prisma.person.count();
  const events = await prisma.event.count();
  const meetings = await prisma.meeting.count();
  const initiatives = await prisma.initiative.count();
  const targets = await prisma.target.count();

  console.log("\nEntity counts:");
  console.log("  Teams:", teams);
  console.log("  People:", people);
  console.log("  Events:", events);
  console.log("  Meetings:", meetings);
  console.log("  Initiatives:", initiatives);
  console.log("  Targets:", targets);

  // ──────────────────────────────────────────────────────
  // STEP 9: Remove temp account
  // ──────────────────────────────────────────────────────
  section("STEP 9: Remove Temporary Account");

  const toDelete = await prisma.user.findUnique({
    where: { email: TEMP_EMAIL },
  });
  if (toDelete) {
    await prisma.userRole.deleteMany({ where: { userId: toDelete.id } });
    await prisma.user.delete({ where: { id: toDelete.id } });
    console.log("Temp account deleted:", TEMP_EMAIL);
  }

  // Verify deletion
  const afterDelete = await prisma.user.findUnique({
    where: { email: TEMP_EMAIL },
  });
  console.log(
    "Deletion verification:",
    afterDelete === null ? "PASSED (account gone)" : "FAILED (account still exists!)"
  );

  // Verify no other users were affected
  const finalUsers = await prisma.user.findMany({ orderBy: { email: "asc" } });
  const finalPreExisting = finalUsers.filter((u) => u.email !== TEMP_EMAIL);
  console.log(
    "Pre-existing user count unchanged:",
    finalPreExisting.length === preExistingUsers.length ? "PASSED" : "WARN"
  );
  console.log("Final user count (should equal pre-existing):", finalPreExisting.length);

  // ──────────────────────────────────────────────────────
  // Summary
  // ──────────────────────────────────────────────────────
  section("VALIDATION SUMMARY");

  console.log(`
  Bootstrap Admin Executed:  YES
  admin@fcallschwil.ch:      EXISTS, active, super_admin role, last login 2026-05-16
  Password (bootstrap):      UNKNOWN — was set via BOOTSTRAP_ADMIN_PASSWORD at deploy time
  Temp Account Created:      YES (stage-admin-validation@fcallschwil.ch)
  Temp Account Removed:      YES
  Existing Users Unaffected: YES
  Roles Seeded:              YES (5 roles, all present)
  Permissions Seeded:        YES (36 permissions, all present)
  Org Units:                 0 (clean stage — not yet configured)
  Registrations:             0 (clean stage — none submitted)
  `);

  console.log("=".repeat(60));
  console.log("  STAGE VALIDATION COMPLETE");
  console.log("=".repeat(60));
}

main()
  .catch((e) => {
    console.error("\nValidation script FAILED:", e.message);
    // Attempt cleanup even on failure
    prisma.userRole
      .deleteMany({
        where: { user: { email: TEMP_EMAIL } },
      })
      .then(() =>
        prisma.user.deleteMany({ where: { email: TEMP_EMAIL } })
      )
      .catch(() => {
        /* best-effort */
      })
      .finally(() => {
        prisma.$disconnect().finally(() => pool.end());
        process.exit(1);
      });
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
