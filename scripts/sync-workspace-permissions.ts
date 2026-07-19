/**
 * scripts/sync-workspace-permissions.ts
 *
 * Idempotent Workspace permission sync.
 *
 * Ensures the following Permission rows exist and are assigned to super_admin:
 *   - workspace.view   (WORKSPACE — Workspace anzeigen)
 *   - workspace.manage (WORKSPACE — Workspace verwalten)
 *
 * Defaults to DRY RUN — shows what would change without touching the database.
 * Set APPLY_PERMISSION_SYNC=true to perform actual writes (all via upsert —
 * safe to re-run as many times as needed).
 *
 * Loads environment via @next/env so .env.local is respected,
 * matching the Next.js application's environment resolution order:
 *   .env.${NODE_ENV}.local → .env.local → .env.${NODE_ENV} → .env
 *
 * Requirements:
 *   DIRECT_DATABASE_URL or DATABASE_URL — connection string for the target database
 *
 * Usage (dry run — default):
 *   npx tsx scripts/sync-workspace-permissions.ts
 *
 * Usage (apply):
 *   APPLY_PERMISSION_SYNC=true npx tsx scripts/sync-workspace-permissions.ts
 */

import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

import { PrismaPg } from "@prisma/adapter-pg";
import { PermissionModule, PrismaClient } from "@prisma/client";
import { Pool } from "pg";

// ── Mode ───────────────────────────────────────────────────────────────────────

const DRY_RUN = process.env.APPLY_PERMISSION_SYNC !== "true";

// ── Permission definitions ─────────────────────────────────────────────────────

const WORKSPACE_PERMISSIONS = [
  {
    key: "workspace.view",
    name: "Workspace anzeigen",
    module: PermissionModule.WORKSPACE,
  },
  {
    key: "workspace.manage",
    name: "Workspace verwalten",
    module: PermissionModule.WORKSPACE,
  },
] as const;

const SUPER_ADMIN_ROLE_KEY = "super_admin";

// ── Safety check ───────────────────────────────────────────────────────────────

const connectionString =
  process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL;

if (!connectionString) {
  console.error(
    "[sync-workspace-permissions] ERROR: Neither DIRECT_DATABASE_URL nor DATABASE_URL is set."
  );
  process.exit(1);
}

// ── Client ─────────────────────────────────────────────────────────────────────

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  console.log(
    `\n[sync-workspace-permissions] Starting… (mode: ${DRY_RUN ? "DRY RUN" : "APPLY"})\n`
  );

  // 1. Check / upsert permission rows
  for (const def of WORKSPACE_PERMISSIONS) {
    const existing = await prisma.permission.findUnique({
      where: { key: def.key },
      select: { id: true, name: true, module: true },
    });

    if (existing) {
      const needsUpdate =
        existing.name !== def.name || existing.module !== def.module;
      console.log(
        `  ${needsUpdate ? "~" : "✓"}  Permission: ${def.key} — ${
          needsUpdate ? "would update" : "already up-to-date"
        }`
      );
    } else {
      console.log(`  +  Permission: ${def.key} — would create`);
    }

    if (!DRY_RUN) {
      await prisma.permission.upsert({
        where: { key: def.key },
        update: { name: def.name, module: def.module },
        create: { key: def.key, name: def.name, module: def.module },
      });
    }
  }

  // 2. Resolve super_admin role
  const superAdminRole = await prisma.role.findUnique({
    where: { key: SUPER_ADMIN_ROLE_KEY },
    select: { id: true },
  });

  if (!superAdminRole) {
    console.error(
      `\n[sync-workspace-permissions] ERROR: Role "${SUPER_ADMIN_ROLE_KEY}" not found. ` +
        "Run `npm run db:seed` first to create roles."
    );
    process.exit(1);
  }

  console.log(`\n  ✓  Role found: ${SUPER_ADMIN_ROLE_KEY} (id: ${superAdminRole.id})\n`);

  // 3. Check / assign permissions to super_admin
  for (const def of WORKSPACE_PERMISSIONS) {
    const permission = await prisma.permission.findUnique({
      where: { key: def.key },
      select: { id: true },
    });

    if (!permission) {
      console.log(
        `  ?  RolePermission: ${SUPER_ADMIN_ROLE_KEY} → ${def.key} — permission row not yet in DB (will be created in apply mode)`
      );
      continue;
    }

    const existingRolePermission = await prisma.rolePermission.findUnique({
      where: {
        roleId_permissionId: {
          roleId: superAdminRole.id,
          permissionId: permission.id,
        },
      },
      select: { roleId: true },
    });

    if (existingRolePermission) {
      console.log(
        `  ✓  RolePermission: ${SUPER_ADMIN_ROLE_KEY} → ${def.key} — already assigned`
      );
    } else {
      console.log(
        `  +  RolePermission: ${SUPER_ADMIN_ROLE_KEY} → ${def.key} — would assign`
      );
    }

    if (!DRY_RUN) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: superAdminRole.id,
            permissionId: permission.id,
          },
        },
        update: {},
        create: {
          roleId: superAdminRole.id,
          permissionId: permission.id,
        },
      });
    }
  }

  if (DRY_RUN) {
    console.log(
      "\n[sync-workspace-permissions] DRY RUN complete — no database changes were made."
    );
    console.log(
      "  To apply: APPLY_PERMISSION_SYNC=true npx tsx scripts/sync-workspace-permissions.ts\n"
    );
  } else {
    console.log("\n[sync-workspace-permissions] Done.\n");
  }
}

main()
  .catch((err) => {
    console.error(
      "[sync-workspace-permissions] FAILED:",
      err instanceof Error ? err.message : String(err)
    );
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
