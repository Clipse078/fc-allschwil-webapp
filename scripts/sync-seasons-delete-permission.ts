/**
 * scripts/sync-seasons-delete-permission.ts
 *
 * ADMIN-DELETE-SEASON-01 — Idempotent seasons.delete permission backfill.
 *
 * CLI wrapper around
 * lib/permissions/seasons-delete-permission-reconciliation.ts.
 * Mirrors scripts/sync-planning-delete-permissions.ts (ADMIN-DELETE-02A).
 *
 * Ensures for seasons.delete:
 *   - the Permission row exists (module=SEASONS, scope=TENANT, grantableByAdmin=true)
 *   - `super_admin` (PLATFORM) holds it
 *   - every already-materialized per-tenant Club Admin role holds it
 *
 * Defaults to DRY RUN — shows what would change without touching the database.
 * Set APPLY_PERMISSION_SYNC=true to perform actual writes (all via upsert — safe
 * to re-run any number of times).
 *
 * Loads environment via @next/env so .env.local is respected.
 *
 * Requirements:
 *   DIRECT_DATABASE_URL or DATABASE_URL — connection string for the target database
 *
 * Usage (dry run — default):
 *   npx tsx scripts/sync-seasons-delete-permission.ts
 *
 * Usage (apply):
 *   APPLY_PERMISSION_SYNC=true npx tsx scripts/sync-seasons-delete-permission.ts
 *
 * After applying, affected users must log out and log back in for the new
 * permission to appear in their session JWT (permissions are embedded at
 * sign-in time via the credentials authorize() callback).
 */

import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { reconcileSeasonsDeletePermission } from "@/lib/permissions/seasons-delete-permission-reconciliation";

const DRY_RUN = process.env.APPLY_PERMISSION_SYNC !== "true";

const connectionString = process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL;
if (!connectionString) {
  console.error(
    "[sync-seasons-delete-permission] ERROR: Neither DIRECT_DATABASE_URL nor DATABASE_URL is set.",
  );
  process.exit(1);
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log(
    `\n[sync-seasons-delete-permission] Starting… (mode: ${DRY_RUN ? "DRY RUN" : "APPLY"})\n`,
  );

  const result = await reconcileSeasonsDeletePermission(prisma, DRY_RUN);

  const p = result.permission;
  const pMarker = p.action === "created" ? "+" : p.action === "updated" ? "~" : "✓";
  const pLabel =
    p.action === "created" ? "would create" : p.action === "updated" ? "would update" : "already up-to-date";
  console.log(`── seasons.delete ─────────────────────────────────────────────`);
  console.log(`  ${pMarker}  ${p.key} — ${pLabel}`);

  const roleAssignmentOutcomes = [result.superAdmin, ...result.tenantClubAdminRoles];
  for (const outcome of roleAssignmentOutcomes) {
    if (outcome.action === "role_not_found") {
      console.log(`  ?  Role not found: ${outcome.roleKey} — skipping`);
    } else if (outcome.action === "permission_not_in_db") {
      console.log(`  ?  Permission not in DB yet: ${outcome.permissionKey} for ${outcome.roleKey} — will be assigned in apply mode`);
    } else if (outcome.action === "assigned") {
      console.log(`  +  ${outcome.roleKey} → ${outcome.permissionKey} — would assign`);
    } else {
      console.log(`  ✓  ${outcome.roleKey} → ${outcome.permissionKey} — already assigned`);
    }
  }

  if (result.tenantClubAdminRoles.length === 0) {
    console.log("  (no already-materialized tenant Club Admin roles found)");
  }

  console.log("");

  if (DRY_RUN) {
    console.log(
      "[sync-seasons-delete-permission] DRY RUN complete — no database changes were made.",
    );
    console.log(
      "  To apply: APPLY_PERMISSION_SYNC=true npx tsx scripts/sync-seasons-delete-permission.ts\n",
    );
  } else {
    console.log(
      "[sync-seasons-delete-permission] Done. seasons.delete synced successfully.\n",
    );
    console.log(
      "  NOTE: Users must log out and log back in for the new permission to appear\n" +
      "        in their session JWT. Authoritative server-side checks take effect\n" +
      "        immediately regardless.\n",
    );
  }
}

main()
  .catch((err) => {
    console.error(
      "[sync-seasons-delete-permission] FAILED:",
      err instanceof Error ? err.message : String(err),
    );
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
