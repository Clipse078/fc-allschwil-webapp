/**
 * scripts/check-user-permissions.ts
 *
 * Read-only diagnostic: reports the effective permission keys for a specific
 * user within a tenant without exposing secrets, tokens, or password hashes.
 *
 * Reads from the database in real-time — reflects the current DB state,
 * not any cached session or JWT.
 *
 * Usage:
 *   npx tsx scripts/check-user-permissions.ts \
 *     --tenant fc-allschwil \
 *     --email admin@fcallschwil.ch
 *
 *   npx tsx scripts/check-user-permissions.ts \
 *     --tenant-id <tenantId> \
 *     --user-id <userId>
 *
 * Environment:
 *   DIRECT_DATABASE_URL or DATABASE_URL — target database connection.
 *
 * Output (safe — no tokens, secrets, hashes, credentials):
 *   assigned role keys;
 *   effective permission keys;
 *   whether trainings.view is present;
 *   whether trainings.manage is present.
 */

import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { createEffectivePermissionResolver } from "@/lib/permissions/services/effective-permission-resolver";

// ── Arg parsing ────────────────────────────────────────────────────────────────

function parseArgs(): { tenantKey?: string; tenantId?: string; email?: string; userId?: string } {
  const args = process.argv.slice(2);
  const result: { tenantKey?: string; tenantId?: string; email?: string; userId?: string } = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--tenant" && args[i + 1]) result.tenantKey = args[++i];
    if (args[i] === "--tenant-id" && args[i + 1]) result.tenantId = args[++i];
    if (args[i] === "--email" && args[i + 1]) result.email = args[++i];
    if (args[i] === "--user-id" && args[i + 1]) result.userId = args[++i];
  }
  return result;
}

const args = parseArgs();

if ((!args.tenantKey && !args.tenantId) || (!args.email && !args.userId)) {
  console.error(
    "Usage:\n" +
    "  npx tsx scripts/check-user-permissions.ts --tenant <key> --email <email>\n" +
    "  npx tsx scripts/check-user-permissions.ts --tenant-id <id> --user-id <id>"
  );
  process.exit(1);
}

// ── Connection ─────────────────────────────────────────────────────────────────

const connectionString =
  process.env.DIRECT_DATABASE_URL ??
  process.env.DATABASE_URL;

if (!connectionString) {
  console.error("[check-user-permissions] ERROR: Neither DIRECT_DATABASE_URL nor DATABASE_URL is set.");
  process.exit(1);
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  // Resolve tenant
  const tenant = args.tenantId
    ? await prisma.tenant.findUnique({ where: { id: args.tenantId }, select: { id: true, key: true, name: true } })
    : await prisma.tenant.findUnique({ where: { key: args.tenantKey! }, select: { id: true, key: true, name: true } });

  if (!tenant) {
    console.error(`[check-user-permissions] ERROR: Tenant not found (${args.tenantKey ?? args.tenantId})`);
    process.exit(1);
  }

  // RPERM-04: TenantMembership is the canonical source of tenant scope — a
  // user is resolved as belonging to this tenant only via an active
  // TenantMembership row, never via the legacy User.tenantId column.
  const membershipWhere = { tenantMemberships: { some: { tenantId: tenant.id, isActive: true } } };

  // Resolve user (without exposing sensitive fields)
  const user = args.userId
    ? await prisma.user.findFirst({
        where: { id: args.userId, ...membershipWhere },
        select: {
          id: true,
          isActive: true,
          userRoles: { select: { role: { select: { key: true } } } },
        },
      })
    : await prisma.user.findFirst({
        where: { email: args.email!, ...membershipWhere },
        select: {
          id: true,
          isActive: true,
          userRoles: { select: { role: { select: { key: true } } } },
        },
      });

  if (!user) {
    const identifier = args.email ?? args.userId;
    console.error(`[check-user-permissions] ERROR: User not found (${identifier}) with an active TenantMembership in tenant ${tenant.key}`);
    process.exit(1);
  }

  const roleKeys = user.userRoles.map(ur => ur.role.key).sort();

  // RPERM-04: effective permissions computed via the canonical
  // EffectivePermissionResolver (platform ∪ tenant), never a blind flatten of
  // every role a user happens to hold regardless of scope/tenant ownership.
  const resolver = createEffectivePermissionResolver(prisma);
  const { platform, tenant: tenantPermissions } = await resolver.getEffectivePermissions({
    userId: user.id,
    tenantId: tenant.id,
  });
  const permissionKeys = Array.from(new Set([...platform, ...tenantPermissions])).sort();

  console.log("\n[check-user-permissions] Result\n");
  console.log(`  Tenant          : ${tenant.name} (${tenant.key})`);
  console.log(`  User ID         : ${user.id.slice(0, 8)}... [REDACTED]`);
  console.log(`  Is Active       : ${user.isActive}`);
  console.log(`  Tenant Membership Active : true`);
  console.log(`\n  Assigned Roles  : ${roleKeys.length === 0 ? "(none)" : roleKeys.join(", ")}`);
  console.log(`\n  Platform Permissions : ${platform.length}`);
  console.log(`  Tenant Permissions   : ${tenantPermissions.length}`);
  console.log(`  Total Permissions    : ${permissionKeys.length}`);
  console.log(`  trainings.view    : ${permissionKeys.includes("trainings.view") ? "✓ PRESENT" : "✗ MISSING"}`);
  console.log(`  trainings.manage  : ${permissionKeys.includes("trainings.manage") ? "✓ PRESENT" : "✗ MISSING"}`);

  if (!permissionKeys.includes("trainings.view") || !permissionKeys.includes("trainings.manage")) {
    console.log("\n  ACTION REQUIRED: Run sync-training-permissions.ts to add missing training permissions.");
  } else {
    console.log("\n  Training permissions OK. If Trainingsplaner is still missing, the user");
    console.log("  must log out and log back in to refresh their session JWT.");
  }

  console.log("");
}

main()
  .catch(err => {
    console.error("[check-user-permissions] FAILED:", err instanceof Error ? err.message : String(err));
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
