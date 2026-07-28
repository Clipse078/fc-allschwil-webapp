/**
 * scripts/sync-training-permissions.ts
 *
 * Idempotent Training permission sync.
 *
 * CLI wrapper around lib/permissions/training-permission-reconciliation.ts.
 * The reconciliation logic is tested independently in:
 *   lib/permissions/__tests__/training-permission-reconciliation.test.ts
 *
 * Ensures the following Permission rows exist and are assigned to the correct roles:
 *   - trainings.view   (TRAININGS — View training allocations)
 *   - trainings.manage (TRAININGS — Manage training allocations)
 *
 * Automatic bootstrap (STAGE-OPS-03B policy):
 *   - super_admin → trainings.view + trainings.manage   (only automatic recipient)
 *
 * No canonical club-admin role exists; super_admin is the sole automatic bootstrap
 * recipient. Trainers and other operational users receive training permissions only
 * through explicit custom-role assignment via /dashboard/roles.
 *
 * Cleanup: removes previously-bootstrapped trainer → trainings.view and
 * trainer → trainings.manage assignments (STAGE-OPS-03 / STAGE-OPS-03A regression).
 *
 * Root cause this script fixes (STAGE-OPS-01, Issue 1):
 *   Migration 20260727400000_training_core_01_canonical_foundation adds the
 *   TRAININGS value to the PermissionModule enum. The matching seed entries
 *   (trainings.view, trainings.manage) were added to seed.ts at the same time.
 *   However, the seed is NOT automatically re-run after a migration deploy.
 *   Any STAGE database seeded before this migration will be missing the
 *   trainings.view and trainings.manage Permission rows — and their
 *   RolePermission assignments — causing the Trainingsplaner navigation entry
 *   to be invisible for all users including super_admin.
 *
 * Defaults to DRY RUN — shows what would change without touching the database.
 * Set APPLY_PERMISSION_SYNC=true to perform actual writes (all via upsert —
 * safe to re-run as many times as needed).
 *
 * Loads environment via @next/env so .env.local is respected.
 *
 * Requirements:
 *   DIRECT_DATABASE_URL or DATABASE_URL — connection string for the target database
 *
 * Usage (dry run — default):
 *   npx tsx scripts/sync-training-permissions.ts
 *
 * Usage (apply):
 *   APPLY_PERMISSION_SYNC=true npx tsx scripts/sync-training-permissions.ts
 *
 * After applying, affected users must log out and log back in for the new
 * permissions to appear in their session JWT (permissions are embedded at
 * sign-in time via the credentials authorize() callback).
 */

import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { reconcileTrainingPermissions } from "@/lib/permissions/training-permission-reconciliation";

// ── Mode ───────────────────────────────────────────────────────────────────────

const DRY_RUN = process.env.APPLY_PERMISSION_SYNC !== "true";

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

  const result = await reconcileTrainingPermissions(prisma, DRY_RUN);

  // ── Report permissions ──────────────────────────────────────────────────────
  console.log("── Permissions ────────────────────────────────────────────────");
  for (const outcome of result.permissions) {
    const marker = outcome.action === "created" ? "+" : outcome.action === "updated" ? "~" : "✓";
    const label = outcome.action === "created"
      ? "would create"
      : outcome.action === "updated"
      ? "would update"
      : "already up-to-date";
    console.log(`  ${marker}  ${outcome.key} — ${label}`);
  }

  // ── Report role assignments ─────────────────────────────────────────────────
  console.log("\n── Role assignments (bootstrap) ────────────────────────────────");
  for (const outcome of result.rolePermissions) {
    if (outcome.action === "role_not_found") {
      console.log(`  ?  Role not found: ${outcome.roleKey} — skipping (run \`npm run db:seed\` first)`);
    } else if (outcome.action === "permission_not_in_db") {
      console.log(`  ?  Permission not in DB yet: ${outcome.permissionKey} for ${outcome.roleKey} — will be assigned in apply mode`);
    } else if (outcome.action === "assigned") {
      console.log(`  +  ${outcome.roleKey} → ${outcome.permissionKey} — would assign`);
    } else {
      console.log(`  ✓  ${outcome.roleKey} → ${outcome.permissionKey} — already assigned`);
    }
  }

  // ── Report revocations ──────────────────────────────────────────────────────
  console.log("\n── Revocations (cleanup obsolete bootstrap grants) ─────────────");
  for (const outcome of result.revocations) {
    if (outcome.action === "revoked") {
      console.log(`  -  ${outcome.roleKey} → ${outcome.permissionKey} — would revoke`);
    } else if (outcome.action === "not_present") {
      console.log(`  ✓  ${outcome.roleKey} → ${outcome.permissionKey} — already absent`);
    } else if (outcome.action === "role_not_found") {
      console.log(`  ?  Role not found: ${outcome.roleKey} — skipping`);
    } else {
      console.log(`  ?  Permission not in DB: ${outcome.permissionKey} — skipping`);
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
      "        in their session JWT. Permissions are embedded at sign-in time and\n" +
      "        are not refreshed automatically between sessions.\n"
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
