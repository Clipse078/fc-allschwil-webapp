/**
 * scripts/sync-training-permissions.ts
 *
 * Idempotent Training permission sync.
 *
 * Ensures the following Permission rows exist and are assigned to every role
 * that requires them according to the canonical seed definitions:
 *   - trainings.view   (TRAININGS — Trainings anzeigen)
 *   - trainings.manage (TRAININGS — Trainings verwalten)
 *
 * Role assignments:
 *   - super_admin  → both trainings.view and trainings.manage
 *   - trainer      → both trainings.view and trainings.manage
 *   - match_coordinator → neither (intentional — not a training workflow role)
 *
 * Root cause this script fixes:
 *   Migration 20260727400000_training_core_01_canonical_foundation adds the
 *   TRAININGS value to the PermissionModule enum. The matching seed entries
 *   (trainings.view, trainings.manage) were added to seed.ts at the same time.
 *   However, the seed is NOT automatically re-run after a migration deploy.
 *   Any STAGE database that was seeded before this migration will be missing
 *   the trainings.view and trainings.manage Permission rows — and their
 *   RolePermission assignments — causing the Trainingsplaner entry to be
 *   invisible in the navigation sidebar for all users, including super_admin.
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
 *   npx tsx scripts/sync-training-permissions.ts
 *
 * Usage (apply):
 *   APPLY_PERMISSION_SYNC=true npx tsx scripts/sync-training-permissions.ts
 */

import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

import { PrismaPg } from "@prisma/adapter-pg";
import { PermissionModule, PrismaClient } from "@prisma/client";
import { Pool } from "pg";

// ── Mode ───────────────────────────────────────────────────────────────────────

const DRY_RUN = process.env.APPLY_PERMISSION_SYNC !== "true";

// ── Permission definitions ─────────────────────────────────────────────────────

const TRAINING_PERMISSIONS = [
  {
    key: "trainings.view",
    name: "View training allocations",
    module: PermissionModule.TRAININGS,
  },
  {
    key: "trainings.manage",
    name: "Manage training allocations",
    module: PermissionModule.TRAININGS,
  },
] as const;

// Roles that must receive both training permissions.
// Matches the canonical seed.ts role definitions exactly.
const ROLES_WITH_TRAINING_PERMISSIONS = ["super_admin", "trainer"] as const;

// ── Safety check ───────────────────────────────────────────────────────────────

const connectionString =
  process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL;

if (!connectionString) {
  console.error(
    "[sync-training-permissions] ERROR: Neither DIRECT_DATABASE_URL nor DATABASE_URL is set."
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
    `\n[sync-training-permissions] Starting… (mode: ${DRY_RUN ? "DRY RUN" : "APPLY"})\n`
  );

  // 1. Check / upsert permission rows
  console.log("── Permissions ────────────────────────────────────────────────");
  for (const def of TRAINING_PERMISSIONS) {
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

  // 2. Resolve roles and assign permissions
  console.log("\n── Role assignments ────────────────────────────────────────────");

  for (const roleKey of ROLES_WITH_TRAINING_PERMISSIONS) {
    const role = await prisma.role.findUnique({
      where: { key: roleKey },
      select: { id: true },
    });

    if (!role) {
      console.log(
        `  ?  Role not found: ${roleKey} — skipping (run \`npm run db:seed\` first)`
      );
      continue;
    }

    console.log(`\n  Role: ${roleKey} (id: ${role.id})`);

    for (const def of TRAINING_PERMISSIONS) {
      const permission = await prisma.permission.findUnique({
        where: { key: def.key },
        select: { id: true },
      });

      if (!permission) {
        console.log(
          `  ?    RolePermission: ${roleKey} → ${def.key} — permission row not yet in DB (will be created in apply mode)`
        );
        continue;
      }

      const existingRolePermission = await prisma.rolePermission.findUnique({
        where: {
          roleId_permissionId: {
            roleId: role.id,
            permissionId: permission.id,
          },
        },
        select: { roleId: true },
      });

      if (existingRolePermission) {
        console.log(
          `  ✓    RolePermission: ${roleKey} → ${def.key} — already assigned`
        );
      } else {
        console.log(
          `  +    RolePermission: ${roleKey} → ${def.key} — would assign`
        );
      }

      if (!DRY_RUN) {
        await prisma.rolePermission.upsert({
          where: {
            roleId_permissionId: {
              roleId: role.id,
              permissionId: permission.id,
            },
          },
          update: {},
          create: {
            roleId: role.id,
            permissionId: permission.id,
          },
        });
      }
    }
  }

  if (DRY_RUN) {
    console.log(
      "\n[sync-training-permissions] DRY RUN complete — no database changes were made."
    );
    console.log(
      "  To apply: APPLY_PERMISSION_SYNC=true npx tsx scripts/sync-training-permissions.ts\n"
    );
  } else {
    console.log(
      "\n[sync-training-permissions] Done. Training permissions synced successfully.\n"
    );
    console.log(
      "  NOTE: Users must log out and log back in for the new permissions to appear\n" +
      "        in their session JWT. Alternatively, have them clear their cookies.\n"
    );
  }
}

main()
  .catch((err) => {
    console.error(
      "[sync-training-permissions] FAILED:",
      err instanceof Error ? err.message : String(err)
    );
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
