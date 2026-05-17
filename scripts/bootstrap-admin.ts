/**
 * Bootstrap platform identity and FC Allschwil tenant.
 * Safe to run on an existing DB — all operations are idempotent.
 *
 * Creates / updates:
 *   superadmin@sportclubevo.com  →  super_admin  (true platform owner)
 *   admin@fcallschwil.ch         →  club_admin   (FC Allschwil tenant admin)
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

// ── Permission sets ────────────────────────────────────────────────────────────

const ALL_PERMISSIONS = [
  { key: "users.manage",                  name: "Manage users",                       module: PermissionModule.USERS },
  { key: "users.impersonate",             name: "Impersonate users",                  module: PermissionModule.USERS },
  { key: "seasons.view",                  name: "View seasons",                       module: PermissionModule.SEASONS },
  { key: "seasons.manage",                name: "Manage seasons",                     module: PermissionModule.SEASONS },
  { key: "teams.view",                    name: "View teams",                         module: PermissionModule.TEAMS },
  { key: "teams.manage",                  name: "Manage teams",                       module: PermissionModule.TEAMS },
  { key: "people.view",                   name: "View people",                        module: PermissionModule.PEOPLE },
  { key: "people.manage",                 name: "Manage people",                      module: PermissionModule.PEOPLE },
  { key: "events.view",                   name: "View events",                        module: PermissionModule.EVENTS },
  { key: "events.manage",                 name: "Manage events",                      module: PermissionModule.EVENTS },
  { key: "events.import",                 name: "Import events",                      module: PermissionModule.EVENTS },
  { key: "events.publish_website",        name: "Publish events to website",          module: PermissionModule.EVENTS },
  { key: "events.publish_infoboard",      name: "Publish events to infoboard",        module: PermissionModule.EVENTS },
  { key: "fixtures.view",                 name: "View fixtures",                      module: PermissionModule.FIXTURES },
  { key: "fixtures.create",               name: "Create fixtures",                    module: PermissionModule.FIXTURES },
  { key: "fixtures.edit_all",             name: "Edit all fixtures",                  module: PermissionModule.FIXTURES },
  { key: "fixtures.submit_for_publication", name: "Submit fixtures for publication",  module: PermissionModule.FIXTURES },
  { key: "fixtures.publish_website",      name: "Publish fixtures to website",        module: PermissionModule.FIXTURES },
  { key: "fixtures.publish_infoboard",    name: "Publish fixtures to infoboard",      module: PermissionModule.FIXTURES },
  { key: "wochenplan.manage",             name: "Manage Wochenplan",                  module: PermissionModule.WOCHENPLAN },
  { key: "news.manage",                   name: "Manage news",                        module: PermissionModule.NEWS },
  { key: "website.manage",               name: "Manage website content",              module: PermissionModule.WEBSITE },
  { key: "infoboard.manage",              name: "Manage infoboard",                   module: PermissionModule.INFOBOARD },
  { key: "functions.manage",              name: "Manage functions",                   module: PermissionModule.FUNCTIONS },
  { key: "tenants.manage",               name: "Manage tenants",                      module: PermissionModule.TENANTS },
] as const;

// Club admin gets all permissions except platform-level super-powers
const CLUB_ADMIN_EXCLUDED = new Set(["tenants.manage", "users.impersonate"]);

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

  // ── 2. Ensure all permissions exist ───────────────────────────────────────
  for (const perm of ALL_PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key: perm.key },
      update: { name: perm.name, module: perm.module },
      create: { key: perm.key, name: perm.name, module: perm.module },
    });
  }

  console.log(`✓ Permissions ensured (${ALL_PERMISSIONS.length})`);

  // ── 3. Ensure super_admin role ────────────────────────────────────────────
  const superAdminRole = await prisma.role.upsert({
    where: { key: "super_admin" },
    update: { name: "Super Admin", description: "Full platform access", updatedAt: now },
    create: { key: "super_admin", name: "Super Admin", description: "Full platform access", updatedAt: now },
  });

  for (const perm of ALL_PERMISSIONS) {
    const permission = await prisma.permission.findUnique({ where: { key: perm.key } });
    if (!permission) continue;
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: superAdminRole.id, permissionId: permission.id } },
      update: {},
      create: { roleId: superAdminRole.id, permissionId: permission.id },
    });
  }

  console.log(`✓ Role: ${superAdminRole.name}`);

  // ── 4. Ensure club_admin role ─────────────────────────────────────────────
  const clubAdminRole = await prisma.role.upsert({
    where: { key: "club_admin" },
    update: { name: "Club Admin", description: "Full club management — no platform super-powers", updatedAt: now },
    create: { key: "club_admin", name: "Club Admin", description: "Full club management — no platform super-powers", updatedAt: now },
  });

  for (const perm of ALL_PERMISSIONS) {
    if (CLUB_ADMIN_EXCLUDED.has(perm.key)) continue;
    const permission = await prisma.permission.findUnique({ where: { key: perm.key } });
    if (!permission) continue;
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: clubAdminRole.id, permissionId: permission.id } },
      update: {},
      create: { roleId: clubAdminRole.id, permissionId: permission.id },
    });
  }

  console.log(`✓ Role: ${clubAdminRole.name}`);

  const passwordHash = await bcrypt.hash("ChangeMe123!", 12);

  // ── 5. Platform superadmin: superadmin@sportclubevo.com ───────────────────
  const superadminUser = await prisma.user.upsert({
    where: { email: "superadmin@sportclubevo.com" },
    update: {
      firstName: "Platform",
      lastName: "Admin",
      passwordHash,
      isActive: true,
      updatedAt: now,
    },
    create: {
      email: "superadmin@sportclubevo.com",
      firstName: "Platform",
      lastName: "Admin",
      passwordHash,
      isActive: true,
      updatedAt: now,
    },
  });

  // Assign super_admin role
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: superadminUser.id, roleId: superAdminRole.id } },
    update: {},
    create: { userId: superadminUser.id, roleId: superAdminRole.id },
  });

  // Link to fc-allschwil as default tenant context
  await prisma.userTenant.upsert({
    where: { userId_tenantId: { userId: superadminUser.id, tenantId: tenant.id } },
    update: { isActive: true, role: "super_admin", isDefault: true, updatedAt: now },
    create: {
      userId: superadminUser.id,
      tenantId: tenant.id,
      role: "super_admin",
      isActive: true,
      isDefault: true,
      updatedAt: now,
    },
  });

  console.log(`✓ Platform superadmin: ${superadminUser.email} → super_admin → ${tenant.slug} (default)`);

  // ── 6. Tenant admin: admin@fcallschwil.ch ─────────────────────────────────
  const clubAdminUser = await prisma.user.upsert({
    where: { email: "admin@fcallschwil.ch" },
    update: {
      firstName: "FC Allschwil",
      lastName: "Admin",
      passwordHash,
      isActive: true,
      updatedAt: now,
    },
    create: {
      email: "admin@fcallschwil.ch",
      firstName: "FC Allschwil",
      lastName: "Admin",
      passwordHash,
      isActive: true,
      updatedAt: now,
    },
  });

  // Remove any super_admin role from club admin (downgrade to club_admin only)
  await prisma.userRole.deleteMany({
    where: { userId: clubAdminUser.id, roleId: superAdminRole.id },
  });

  // Assign club_admin role
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: clubAdminUser.id, roleId: clubAdminRole.id } },
    update: {},
    create: { userId: clubAdminUser.id, roleId: clubAdminRole.id },
  });

  // Link to fc-allschwil as default tenant context
  await prisma.userTenant.upsert({
    where: { userId_tenantId: { userId: clubAdminUser.id, tenantId: tenant.id } },
    update: { isActive: true, role: "club_admin", isDefault: true, updatedAt: now },
    create: {
      userId: clubAdminUser.id,
      tenantId: tenant.id,
      role: "club_admin",
      isActive: true,
      isDefault: true,
      updatedAt: now,
    },
  });

  console.log(`✓ Club admin: ${clubAdminUser.email} → club_admin → ${tenant.slug} (default)`);

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("Bootstrap complete.\n");
  console.log("Platform Superadmin:");
  console.log("  Email:    superadmin@sportclubevo.com");
  console.log("  Password: ChangeMe123!  ← change on first login");
  console.log("  Role:     super_admin (full platform access)");
  console.log("");
  console.log("FC Allschwil Tenant Admin:");
  console.log("  Email:    admin@fcallschwil.ch");
  console.log("  Password: ChangeMe123!  ← change on first login");
  console.log("  Role:     club_admin (no platform super-powers)");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
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
