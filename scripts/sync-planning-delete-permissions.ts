/**
 * scripts/sync-planning-delete-permissions.ts
 *
 * ADMIN-DELETE-02A — Idempotent trainings.delete / matches.delete /
 * tournaments.delete permission backfill.
 *
 * CLI wrapper around
 * lib/permissions/planning-modules-delete-permission-reconciliation.ts.
 * Mirrors scripts/sync-teams-delete-permission.ts (ADMIN-DELETE-01A).
 *
 * Ensures, for each of trainings.delete / matches.delete / tournaments.delete:
 *   - the Permission row exists (module/scope/grantableByAdmin matching
 *     prisma/seed.ts)
 *   - `super_admin` (PLATFORM) holds it
 *   - every already-materialized per-tenant Club Admin role holds it
 *
 * Root cause this script fixes: prisma/seed.ts is not automatically re-run
 * after a deploy (see package.json's `build` script), so any STAGE/
 * production database seeded before the ADMIN-DELETE-02A commit added these
 * three keys to prisma/seed.ts is missing them entirely — mirrors the exact
 * gap scripts/sync-teams-delete-permission.ts fixed for teams.delete.
 *
 * Defaults to DRY RUN — shows what would change without touching the
 * database. Set APPLY_PERMISSION_SYNC=true to perform actual writes (all
 * via upsert — safe to re-run as many times as needed).
 *
 * Loads environment via @next/env so .env.local is respected.
 *
 * Requirements:
 *   DIRECT_DATABASE_URL or DATABASE_URL — connection string for the target database
 *
 * Usage (dry run — default):
 *   npx tsx scripts/sync-planning-delete-permissions.ts
 *
 * Usage (apply):
 *   APPLY_PERMISSION_SYNC=true npx tsx scripts/sync-planning-delete-permissions.ts
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
import { reconcilePlanningDeletePermissions } from "@/lib/permissions/planning-modules-delete-permission-reconciliation";

// ── Mode ───────────────────────────────────────────────────────────────────────

const DRY_RUN = process.env.APPLY_PERMISSION_SYNC !== "true";

// ── Safety check ───────────────────────────────────────────────────────────────

const connectionString = process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL;

if (!connectionString) {
  console.error(
    "[sync-planning-delete-permissions] ERROR: Neither DIRECT_DATABASE_URL nor DATABASE_URL is set."
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
    `\n[sync-planning-delete-permissions] Starting… (mode: ${DRY_RUN ? "DRY RUN" : "APPLY"})\n`
  );

  const results = await reconcilePlanningDeletePermissions(prisma, DRY_RUN);

  for (const result of results) {
    console.log(`── ${result.key} ──────────────────────────────────────────────`);

    const p = result.permission;
    const pMarker = p.action === "created" ? "+" : p.action === "updated" ? "~" : "✓";
    const pLabel =
      p.action === "created" ? "would create" : p.action === "updated" ? "would update" : "already up-to-date";
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
  }

  if (DRY_RUN) {
    console.log(
      "[sync-planning-delete-permissions] DRY RUN complete — no database changes were made."
    );
    console.log(
      "  To apply: APPLY_PERMISSION_SYNC=true npx tsx scripts/sync-planning-delete-permissions.ts\n"
    );
  } else {
    console.log(
      "[sync-planning-delete-permissions] Done. trainings.delete / matches.delete / tournaments.delete synced successfully.\n"
    );
    console.log(
      "  NOTE: Users must log out and log back in for the new permissions to appear\n" +
      "        in their session JWT. Permissions are embedded at sign-in time and\n" +
      "        are not refreshed automatically between sessions. Authoritative\n" +
      "        server-side checks (requireApiPermission, hasTenantDeletionAuthority)\n" +
      "        take effect immediately regardless.\n"
    );
  }
}

main()
  .catch((err) => {
    console.error(
      "[sync-planning-delete-permissions] FAILED:",
      err instanceof Error ? err.message : String(err)
    );
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
